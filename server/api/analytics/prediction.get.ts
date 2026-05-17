/**
 * GET /api/analytics/prediction
 *
 * Analiza la ventana histórica completa y calcula la mejor hora agregada
 * por hora del día (00-23), con estrategia robusta de fallback.
 * 
 * ESTRATEGIA (en orden):
 * 1. Predicción por día semana (si hay ≥2 días históricos o ≥24 muestras)
 * 2. Fallback global (si hay ≥48 muestras totales)
 * 3. Horas "sugeridas" con lógica inteligente (basada en patrones típicos EV)
 */
import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const VENTANA_HISTORICA_DIAS = 56;

// Umbrales más permisivos
const MIN_DIAS_CON_DATOS_WEEKDAY = 2;      // Mínimo 2 días del mismo día de la semana
const MIN_MUESTRAS_WEEKDAY = 24;            // Mínimo 24 muestras (1 día de datos cada hora)
const MIN_MUESTRAS_FALLBACK_GLOBAL = 24;   // Mínimo 24 muestras globales para fallback
const MIN_MUESTRAS_SUGERENCIA = 1;          // Modo best-guess: ≥1 muestra válida

type NivelConfianza = 'alta' | 'media' | 'baja';
type MetodoPrediccion = 'weekday' | 'global' | 'sin_datos';

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDiasHaciaFuturo(raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(30, Math.trunc(n)));
}

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

function confianzaDesdeMuestras(muestras: number): NivelConfianza {
  if (muestras >= 240) return 'alta';    // 10 días de datos
  if (muestras >= 72) return 'media';    // 3 días de datos
  return 'baja';
}

// Horas recomendadas típicas para carga de vehículos eléctricos
// Basadas en patrones de uso: mañana temprana (6-9h), mediodía (12-14h), tarde (17-19h)
const HORAS_SUGERIDAS_POR_DEFECTO = [8, 9, 13, 18];

/**
 * Calcula la mejor hora con criterio de desempate inteligente
 * - Prioriza horas con mayor disponibilidad
 * - Si hay empate, prefiere horas "razonables" (evita 00:00 - 06:00)
 * - Si todas tienen igual disponibilidad, elige la hora sugerida más temprana
 */
function mejorHoraConDesempate(
  franjas: Array<{ hora: number; disponibilidad: number; conDatos: boolean; muestras: number }>
): { hora: number; disponibilidad: number; conDatos: boolean; muestras: number } {
  if (franjas.length === 0) {
    return { hora: 9, disponibilidad: 0, conDatos: false, muestras: 0 };
  }

  // Ordenar por disponibilidad descendente
  const sorted = [...franjas].sort((a, b) => b.disponibilidad - a.disponibilidad);
  const maxDisponibilidad = sorted[0].disponibilidad;

  // Candidatos con máxima disponibilidad
  const mejoresCandidatos = sorted.filter((f) => f.disponibilidad === maxDisponibilidad);

  // Si hay múltiples con igual disponibilidad, aplicar criterios de desempate
  if (mejoresCandidatos.length > 1) {
    // 1. Preferir horas razonables (06:00 - 22:00)
    const horasRazonables = mejoresCandidatos.filter((f) => f.hora >= 6 && f.hora <= 22);
    if (horasRazonables.length > 0) {
      // 2. De las razonables, preferir horas sugeridas
      const horasSugeridas = horasRazonables.filter((f) => HORAS_SUGERIDAS_POR_DEFECTO.includes(f.hora));
      if (horasSugeridas.length > 0) {
        return horasSugeridas[0];
      }
      // 3. Si no hay sugeridas, retornar la primera razonable
      return horasRazonables[0];
    }
    // Si no hay razonables, retornar la primera del ranking
    return mejoresCandidatos[0];
  }

  return mejoresCandidatos[0];
}

// Función auxiliar para paginar y traer todos los datos
async function fetchAllRows(supabase: any, baseQuery: any, pageSize: number = 1000): Promise<any[]> {
  let allRows: any[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await baseQuery.range(offset, offset + pageSize - 1);
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Error al obtener datos: ${error.message}`,
      });
    }
    
    const rows = (data ?? []) as any[];
    allRows = allRows.concat(rows);
    
    if (rows.length < pageSize) {
      hasMore = false;
    } else {
      offset += pageSize;
    }
  }
  
  return allRows;
}

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);
  const query = getQuery(event);
  const diasHaciaFuturo = parseDiasHaciaFuturo(query.dias);
  const stationId = parseStationId(query.station_id);

  const ahora = new Date();
  const fechaObjetivo = new Date(ahora.getTime() + diasHaciaFuturo * 24 * 60 * 60 * 1000);
  const diaObjetivo = fechaObjetivo.getDay(); // 0 = Dom … 6 = Sáb
  const haceVentana = new Date(ahora.getTime() - VENTANA_HISTORICA_DIAS * 24 * 60 * 60 * 1000);

  // Construir query con paginación
  const buildQuery = () => {
    let q = supabase
      .from('charging_logs')
      .select('created_at, is_available, available_connectors')
      .gte('created_at', haceVentana.toISOString())
      .order('created_at', { ascending: true });

    if (stationId) {
      q = q.eq('station_id', stationId);
    }

    return q;
  };

  const data = await fetchAllRows(supabase, buildQuery());

  // ─── Agrupar por hora para día objetivo y fallback global ────────────────
  const porHoraWeekday: Record<number, { total: number; disponibles: number }> = {};
  const porHoraGlobal: Record<number, { total: number; disponibles: number }> = {};
  const diasHistoricosConDatosSet = new Set<string>();
  const diasConDatosPorDiaSemana: Array<Set<string>> = Array.from({ length: 7 }, () => new Set<string>());
  const muestrasPorDiaSemana = Array.from({ length: 7 }, () => 0);
  let muestrasGlobales = 0;

  for (let h = 0; h < 24; h++) {
    porHoraWeekday[h] = { total: 0, disponibles: 0 };
    porHoraGlobal[h] = { total: 0, disponibles: 0 };
  }

  for (const fila of data ?? []) {
    const fecha = new Date(fila.created_at);
    const diaSemana = fecha.getUTCDay();
    const hora = fecha.getUTCHours();

    diasHistoricosConDatosSet.add(toISODate(fecha));
    diasConDatosPorDiaSemana[diaSemana].add(toISODate(fecha));
    muestrasPorDiaSemana[diaSemana]++;
    muestrasGlobales++;

    // Lógica de disponibilidad: preferir available_connectors, fallback a is_available
    const disponible = typeof fila.available_connectors === 'number' 
      ? fila.available_connectors > 0 
      : fila.is_available;

    porHoraGlobal[hora].total++;
    if (disponible) porHoraGlobal[hora].disponibles++;

    if (diaSemana !== diaObjetivo) continue;

    porHoraWeekday[hora].total++;
    if (disponible) porHoraWeekday[hora].disponibles++;
  }

  // ─── Calcular disponibilidad (%) por hora ──────────────────────────────
  const franjasWeekday = Array.from({ length: 24 }, (_, h) => {
    const { total, disponibles } = porHoraWeekday[h];
    return {
      hora:           h,
      disponibilidad: total > 0 ? Math.round((disponibles / total) * 100) : 0,
      conDatos:       total > 0,
      muestras:       total,
    };
  });

  const franjasGlobal = Array.from({ length: 24 }, (_, h) => {
    const { total, disponibles } = porHoraGlobal[h];
    return {
      hora:           h,
      disponibilidad: total > 0 ? Math.round((disponibles / total) * 100) : 0,
      conDatos:       total > 0,
      muestras:       total,
    };
  });

  // ─── Elegir la mejor hora con estrategia robusta de fallback ─────────────────
  const franjasWeekdayConDatos = franjasWeekday.filter((f) => f.conDatos);
  const franjasGlobalConDatos = franjasGlobal.filter((f) => f.conDatos);
  const diasHistoricosConDatos = diasHistoricosConDatosSet.size;
  const diasConDatos = diasConDatosPorDiaSemana[diaObjetivo].size;
  const muestrasTotalesWeekday = franjasWeekdayConDatos.reduce((acc, f) => acc + f.muestras, 0);

  // ESTRATEGIA 1: Predicción por día de semana (más confiable)
  const haySuficientesDatosWeekday =
    franjasWeekdayConDatos.length > 0 &&
    (diasConDatos >= MIN_DIAS_CON_DATOS_WEEKDAY || muestrasTotalesWeekday >= MIN_MUESTRAS_WEEKDAY);

  // ESTRATEGIA 2: Fallback global (cuando no hay datos específicos del día)
  const hayDatosFallbackGlobal =
    franjasGlobalConDatos.length > 0 &&
    muestrasGlobales >= MIN_MUESTRAS_FALLBACK_GLOBAL;

  // Elegir el mejor método disponible
  let metodoPrediccion: MetodoPrediccion;
  let franjas: Array<{ hora: number; disponibilidad: number; conDatos: boolean; muestras: number }>;
  let franjasConDatos: Array<{ hora: number; disponibilidad: number; conDatos: boolean; muestras: number }>;
  let haySuficientesDatos: boolean;

  if (haySuficientesDatosWeekday) {
    // MÉTODO 1: Usar predicción específica del día de la semana
    metodoPrediccion = 'weekday';
    franjas = franjasWeekday;
    franjasConDatos = franjasWeekdayConDatos;
    haySuficientesDatos = true;
  } else if (hayDatosFallbackGlobal) {
    // MÉTODO 2: Fallback a datos globales
    metodoPrediccion = 'global';
    franjas = franjasGlobal;
    franjasConDatos = franjasGlobalConDatos;
    haySuficientesDatos = true;
  } else {
    // MÉTODO 3: Modo best-guess (sugerir horas típicas sin datos históricos)
    metodoPrediccion = 'sin_datos';
    franjas = franjasWeekday;  // Retornar franjas vacías para mostrar gráfico vacío
    franjasConDatos = [];
    haySuficientesDatos = false;
  }

  // Calcular la mejor hora con desempate inteligente
  const mejorFranja = haySuficientesDatos
    ? mejorHoraConDesempate(franjasConDatos)
    : mejorHoraConDesempate(HORAS_SUGERIDAS_POR_DEFECTO.map((h) => ({
        hora: h,
        disponibilidad: 50,  // Disponibilidad neutral
        conDatos: false,
        muestras: 0,
      })));

  const confianza: NivelConfianza = metodoPrediccion === 'sin_datos'
    ? 'baja'
    : (metodoPrediccion === 'global'
      ? (muestrasGlobales >= 120 ? 'media' : 'baja')
      : confianzaDesdeMuestras(muestrasTotalesWeekday));

  // ─── Horas recomendables (disponibilidad ≥ 70 %) ────────────────────────
  const horasRecomendadas = haySuficientesDatos
    ? franjasConDatos
      .filter((f) => f.disponibilidad >= 70)
      .map((f) => f.hora)
      .sort((a, b) => a - b)
    : [];

  const fallbackGlobalCercanoDisponible =
    muestrasGlobales >= MIN_MUESTRAS_FALLBACK_GLOBAL || diasHistoricosConDatos >= MIN_DIAS_CON_DATOS_WEEKDAY;

  const diasDisponibles = Array.from({ length: 31 }, (_, dias) => {
    const fecha = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
    const diaSemana = fecha.getDay();
    const diasConDatosDia = diasConDatosPorDiaSemana[diaSemana].size;
    const muestrasDia = muestrasPorDiaSemana[diaSemana];
    
    // Criterios más permisivos para disponibilidad
    const disponibleWeekday = diasConDatosDia >= MIN_DIAS_CON_DATOS_WEEKDAY || muestrasDia >= MIN_MUESTRAS_WEEKDAY;
    const disponibleFallbackCercano = fallbackGlobalCercanoDisponible && dias <= 7;
    const disponibleBestGuess = dias <= 14;  // Ofrecer predicción best-guess para próximas 2 semanas
    const disponible = disponibleWeekday || disponibleFallbackCercano || disponibleBestGuess;
    
    const confianzaFecha: NivelConfianza = disponibleWeekday
      ? confianzaDesdeMuestras(muestrasDia)
      : (disponibleFallbackCercano ? 'baja' : 'baja');

    return {
      dias,
      fecha: toISODate(fecha),
      diaSemana: DIAS_ES[diaSemana],
      diasConDatos: diasConDatosDia,
      muestras: muestrasDia,
      confianza: confianzaFecha,
      metodo: disponibleWeekday ? 'weekday' : (disponibleFallbackCercano ? 'global' : 'sin_datos'),
      disponible,
    };
  }).filter((item) => item.disponible);

  return {
    mejorHora: mejorFranja.hora,
    probabilidad: mejorFranja.disponibilidad,
    diaSemana: DIAS_ES[diaObjetivo],
    fechaObjetivo: toISODate(fechaObjetivo),
    diasHaciaFuturo,
    franjas,  // Siempre devolver franjas (vacías o con datos)
    horasRecomendadas: franjasConDatos.length > 0
      ? franjasConDatos.filter((f) => f.disponibilidad >= 70).map((f) => f.hora).sort((a, b) => a - b)
      : HORAS_SUGERIDAS_POR_DEFECTO,
    confianza,
    metodoPrediccion,
    usaFallbackGlobal: metodoPrediccion === 'global',
    haySuficientesDatos,
    diasConDatos,
    diasHistoricosConDatos,
    muestrasTotales: muestrasTotalesWeekday,
    muestrasGlobales,
    diasDisponibles,
    diasMinimosRecomendados: MIN_DIAS_CON_DATOS_WEEKDAY,
    diasFaltantesEstimados: Math.max(0, MIN_DIAS_CON_DATOS_WEEKDAY - diasConDatos),
    ventanaHistoricaDias: VENTANA_HISTORICA_DIAS,
  };
});
