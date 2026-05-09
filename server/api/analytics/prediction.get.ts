/**
 * GET /api/analytics/prediction
 *
 * Analiza la ventana histórica completa y calcula la mejor hora agregada
 * por hora del día (00-23), sin restringir por día de la semana.
 */
import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const VENTANA_HISTORICA_DIAS = 56;
const MIN_DIAS_CON_DATOS = 4;
const MIN_MUESTRAS_TOTALES = 168;

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

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);
  const query = getQuery(event);
  const diasHaciaFuturo = parseDiasHaciaFuturo(query.dias);
  const stationId = parseStationId(query.station_id);

  const ahora = new Date();
  const fechaObjetivo = new Date(ahora.getTime() + diasHaciaFuturo * 24 * 60 * 60 * 1000);
  const diaObjetivo = fechaObjetivo.getDay(); // 0 = Dom … 6 = Sáb
  const haceVentana = new Date(ahora.getTime() - VENTANA_HISTORICA_DIAS * 24 * 60 * 60 * 1000);

  let queryLogs = supabase
    .from('charging_logs')
    .select('created_at, is_available')
    .gte('created_at', haceVentana.toISOString());

  if (stationId) {
    queryLogs = queryLogs.eq('station_id', stationId);
  }

  const { data, error } = await queryLogs;

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al calcular predicción: ${error.message}`,
    });
  }

  // ─── Agrupar por hora para el día objetivo (fecha seleccionada) ─────────
  const porHora: Record<number, { total: number; disponibles: number }> = {};
  const diasHistoricosConDatosSet = new Set<string>();
  const diasConDatosPorDiaSemana: Array<Set<string>> = Array.from({ length: 7 }, () => new Set<string>());
  const muestrasPorDiaSemana = Array.from({ length: 7 }, () => 0);

  for (let h = 0; h < 24; h++) {
    porHora[h] = { total: 0, disponibles: 0 };
  }

  for (const fila of data ?? []) {
    const fecha = new Date(fila.created_at);
    const diaSemana = fecha.getDay();

    diasHistoricosConDatosSet.add(toISODate(fecha));
    diasConDatosPorDiaSemana[diaSemana].add(toISODate(fecha));
    muestrasPorDiaSemana[diaSemana]++;

    if (diaSemana !== diaObjetivo) continue;

    const hora = fecha.getHours();
    porHora[hora].total++;
    if (fila.is_available) porHora[hora].disponibles++;
  }

  // ─── Calcular disponibilidad (%) por hora ──────────────────────────────
  const franjas = Array.from({ length: 24 }, (_, h) => {
    const { total, disponibles } = porHora[h];
    return {
      hora:           h,
      disponibilidad: total > 0 ? Math.round((disponibles / total) * 100) : 0,
      conDatos:       total > 0,
      muestras:       total,
    };
  });

  // ─── Elegir la mejor hora (máxima disponibilidad con suficientes datos) ─
  const franjasConDatos = franjas.filter((f) => f.conDatos);
  const diasHistoricosConDatos = diasHistoricosConDatosSet.size;
  const diasConDatos = diasConDatosPorDiaSemana[diaObjetivo].size;
  const muestrasTotales = franjas.reduce((acc, f) => acc + f.muestras, 0);
  const haySuficientesDatos =
    franjasConDatos.length > 0 &&
    (diasConDatos >= MIN_DIAS_CON_DATOS || muestrasTotales >= MIN_MUESTRAS_TOTALES);

  const mejorFranja = haySuficientesDatos
    ? franjasConDatos.reduce((a, b) => (a.disponibilidad >= b.disponibilidad ? a : b))
    : { hora: 8, disponibilidad: 0, conDatos: false }; // Fallback sin datos

  // ─── Horas recomendables (disponibilidad ≥ 70 %) ────────────────────────
  const horasRecomendadas = haySuficientesDatos
    ? franjasConDatos
      .filter((f) => f.disponibilidad >= 70)
      .map((f) => f.hora)
      .sort((a, b) => a - b)
    : [];

  const diasDisponibles = Array.from({ length: 31 }, (_, dias) => {
    const fecha = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
    const diaSemana = fecha.getDay();
    const diasConDatosDia = diasConDatosPorDiaSemana[diaSemana].size;
    const muestrasDia = muestrasPorDiaSemana[diaSemana];
    const disponible = diasConDatosDia >= MIN_DIAS_CON_DATOS || muestrasDia >= MIN_MUESTRAS_TOTALES;

    return {
      dias,
      fecha: toISODate(fecha),
      diaSemana: DIAS_ES[diaSemana],
      diasConDatos: diasConDatosDia,
      muestras: muestrasDia,
      disponible,
    };
  }).filter((item) => item.disponible);

  return {
    mejorHora: mejorFranja.hora,
    probabilidad: mejorFranja.disponibilidad,
    diaSemana: DIAS_ES[diaObjetivo],
    fechaObjetivo: toISODate(fechaObjetivo),
    diasHaciaFuturo,
    franjas,
    horasRecomendadas,
    haySuficientesDatos,
    diasConDatos,
    diasHistoricosConDatos,
    muestrasTotales,
    diasDisponibles,
    diasMinimosRecomendados: 28,
    diasFaltantesEstimados: Math.max(0, 28 - diasHistoricosConDatos),
    ventanaHistoricaDias: VENTANA_HISTORICA_DIAS,
  };
});
