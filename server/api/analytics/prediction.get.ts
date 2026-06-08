/**
 * GET /api/analytics/prediction
 *
 * Usa RPCs fn_availability_by_day_hour() + fn_days_with_data()
 * para agregar en PostgreSQL. Devuelve ~168 + 7 = 175 filas
 * en vez de 26.900+ filas crudas (56 días antes → 14 días ahora).
 */
import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';
import { defineCachedEventHandler } from 'nitropack/runtime';

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const VENTANA_HISTORICA_DIAS = 14; // Reducido de 56 → ahorro ~75 % de egress

const MIN_DIAS_CON_DATOS_WEEKDAY = 2;
const MIN_MUESTRAS_WEEKDAY = 24;
const MIN_MUESTRAS_FALLBACK_GLOBAL = 24;

type NivelConfianza = 'alta' | 'media' | 'baja';
type MetodoPrediccion = 'weekday' | 'global' | 'sin_datos';

type AggRow = {
  day_of_week: number;
  hour_of_day: number;
  avg_disponibilidad: number;
  sample_count: number;
};

type DaysRow = {
  day_of_week: number;
  distinct_days: number;
  total_samples: number;
};

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
  if (muestras >= 240) return 'alta';
  if (muestras >= 72) return 'media';
  return 'baja';
}

const HORAS_SUGERIDAS_POR_DEFECTO = [8, 9, 13, 18];

function mejorHoraConDesempate(
  franjas: Array<{ hora: number; disponibilidad: number; conDatos: boolean; muestras: number }>
): { hora: number; disponibilidad: number; conDatos: boolean; muestras: number } {
  if (!franjas.length) return { hora: 9, disponibilidad: 0, conDatos: false, muestras: 0 };
  const sorted = [...franjas].sort((a, b) => b.disponibilidad - a.disponibilidad);
  const maxDisp = sorted[0].disponibilidad;
  const mejores = sorted.filter((f) => f.disponibilidad === maxDisp);
  if (mejores.length > 1) {
    const razonables = mejores.filter((f) => f.hora >= 6 && f.hora <= 22);
    if (razonables.length > 0) {
      const sugeridas = razonables.filter((f) => HORAS_SUGERIDAS_POR_DEFECTO.includes(f.hora));
      return sugeridas.length ? sugeridas[0] : razonables[0];
    }
  }
  return mejores[0];
}


export default defineCachedEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);
  const query = getQuery(event);
  const diasHaciaFuturo = parseDiasHaciaFuturo(query.dias);
  const stationId = parseStationId(query.station_id);

  const ahora = new Date();
  const fechaObjetivo = new Date(ahora.getTime() + diasHaciaFuturo * 24 * 60 * 60 * 1000);
  const diaObjetivo = fechaObjetivo.getDay();

  // ── Dos RPCs pequeñas en paralelo: máx 168 + 7 = 175 filas ──────────────
  // (antes: ~26.900 filas crudas con fetchAllRows sobre 56 días)
  const [aggResult, daysResult] = await Promise.all([
    supabase.rpc('fn_availability_by_day_hour', {
      p_dias: VENTANA_HISTORICA_DIAS,
      p_station_id: stationId,
    }),
    supabase.rpc('fn_days_with_data', {
      p_dias: VENTANA_HISTORICA_DIAS,
      p_station_id: stationId,
    }),
  ]);

  if (aggResult.error) {
    throw createError({ statusCode: 500, statusMessage: `fn_availability_by_day_hour: ${aggResult.error.message}` });
  }
  if (daysResult.error) {
    throw createError({ statusCode: 500, statusMessage: `fn_days_with_data: ${daysResult.error.message}` });
  }

  const aggRows = (aggResult.data ?? []) as AggRow[];
  const daysRows = (daysResult.data ?? []) as DaysRow[];

  // Indexar días con datos por día de semana
  const diasConDatosPorDiaSemana: number[] = Array(7).fill(0);
  const muestrasPorDiaSemana: number[] = Array(7).fill(0);
  let muestrasGlobales = 0;
  let diasHistoricosConDatos = 0;

  for (const dr of daysRows) {
    diasConDatosPorDiaSemana[dr.day_of_week] = dr.distinct_days;
    muestrasPorDiaSemana[dr.day_of_week] = dr.total_samples;
    muestrasGlobales += dr.total_samples;
    diasHistoricosConDatos += dr.distinct_days;
  }

  // ─── Construir franjas por hora para el día objetivo y global ────────────
  const porHoraWeekday: Record<number, { total: number; disponibles: number }> = {};
  const porHoraGlobal:  Record<number, { total: number; disponibles: number }> = {};
  for (let h = 0; h < 24; h++) {
    porHoraWeekday[h] = { total: 0, disponibles: 0 };
    porHoraGlobal[h]  = { total: 0, disponibles: 0 };
  }

  for (const row of aggRows) {
    const disp = Number(row.avg_disponibilidad);
    const n    = row.sample_count;
    const h    = row.hour_of_day;
    const dow  = row.day_of_week;

    // Ponderado: total += n, disponibles += disp*n
    porHoraGlobal[h].total      += n;
    porHoraGlobal[h].disponibles += Math.round(disp * n);

    if (dow === diaObjetivo) {
      porHoraWeekday[h].total      += n;
      porHoraWeekday[h].disponibles += Math.round(disp * n);
    }
  }

  const franjasWeekday = Array.from({ length: 24 }, (_, h) => {
    const { total, disponibles } = porHoraWeekday[h];
    return { hora: h, disponibilidad: total > 0 ? Math.round((disponibles / total) * 100) : 0, conDatos: total > 0, muestras: total };
  });

  const franjasGlobal = Array.from({ length: 24 }, (_, h) => {
    const { total, disponibles } = porHoraGlobal[h];
    return { hora: h, disponibilidad: total > 0 ? Math.round((disponibles / total) * 100) : 0, conDatos: total > 0, muestras: total };
  });

  const franjasWeekdayConDatos = franjasWeekday.filter((f) => f.conDatos);
  const franjasGlobalConDatos  = franjasGlobal.filter((f)  => f.conDatos);
  const diasConDatos           = diasConDatosPorDiaSemana[diaObjetivo];
  const muestrasTotalesWeekday = franjasWeekdayConDatos.reduce((acc, f) => acc + f.muestras, 0);

  const haySuficientesDatosWeekday =
    franjasWeekdayConDatos.length > 0 &&
    (diasConDatos >= MIN_DIAS_CON_DATOS_WEEKDAY || muestrasTotalesWeekday >= MIN_MUESTRAS_WEEKDAY);

  const hayDatosFallbackGlobal =
    franjasGlobalConDatos.length > 0 && muestrasGlobales >= MIN_MUESTRAS_FALLBACK_GLOBAL;

  let metodoPrediccion: MetodoPrediccion;
  let franjas: typeof franjasWeekday;
  let franjasConDatos: typeof franjasWeekdayConDatos;
  let haySuficientesDatos: boolean;

  if (haySuficientesDatosWeekday) {
    metodoPrediccion = 'weekday';
    franjas = franjasWeekday;
    franjasConDatos = franjasWeekdayConDatos;
    haySuficientesDatos = true;
  } else if (hayDatosFallbackGlobal) {
    metodoPrediccion = 'global';
    franjas = franjasGlobal;
    franjasConDatos = franjasGlobalConDatos;
    haySuficientesDatos = true;
  } else {
    metodoPrediccion = 'sin_datos';
    franjas = franjasWeekday;
    franjasConDatos = [];
    haySuficientesDatos = false;
  }

  const mejorFranja = haySuficientesDatos
    ? mejorHoraConDesempate(franjasConDatos)
    : mejorHoraConDesempate(HORAS_SUGERIDAS_POR_DEFECTO.map((h) => ({
        hora: h, disponibilidad: 50, conDatos: false, muestras: 0,
      })));

  const confianza: NivelConfianza = metodoPrediccion === 'sin_datos'
    ? 'baja'
    : (metodoPrediccion === 'global'
      ? (muestrasGlobales >= 120 ? 'media' : 'baja')
      : confianzaDesdeMuestras(muestrasTotalesWeekday));

  const fallbackGlobalCercanoDisponible =
    muestrasGlobales >= MIN_MUESTRAS_FALLBACK_GLOBAL || diasHistoricosConDatos >= MIN_DIAS_CON_DATOS_WEEKDAY;

  const diasDisponibles = Array.from({ length: 31 }, (_, dias) => {
    const fecha = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
    const diaSemana = fecha.getDay();
    const diasConDatosDia = diasConDatosPorDiaSemana[diaSemana];
    const muestrasDia = muestrasPorDiaSemana[diaSemana];

    const disponibleWeekday = diasConDatosDia >= MIN_DIAS_CON_DATOS_WEEKDAY || muestrasDia >= MIN_MUESTRAS_WEEKDAY;
    const disponibleFallbackCercano = fallbackGlobalCercanoDisponible && dias <= 7;
    const disponibleBestGuess = dias <= 14;
    const disponible = disponibleWeekday || disponibleFallbackCercano || disponibleBestGuess;

    const confianzaFecha: NivelConfianza = disponibleWeekday
      ? confianzaDesdeMuestras(muestrasDia)
      : 'baja';

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
    franjas,
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
}, {
  name: 'analytics-prediction',
  maxAge: 600,
  swr: true,
});
