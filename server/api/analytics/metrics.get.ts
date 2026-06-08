/**
 * GET /api/analytics/metrics?periodo=today|7d|30d
 *
 * Usa la RPC fn_session_metrics() para que PostgreSQL compute
 * conteo de sesiones, ocupación y disponibilidad directamente.
 * Devuelve 1 fila por estación (3-5 filas) en vez de miles de filas crudas.
 */
import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';
import { defineCachedEventHandler } from 'nitropack/runtime';

const DIAS_POR_PERIODO: Record<string, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

type AggRow = {
  station_id: string;
  location_name: string;
  total_samples: number;
  occupied_samples: number;
  sessions_estimated: number;
};

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

export default defineCachedEventHandler(async (event) => {
  const query   = getQuery(event);
  const periodo = String(query.periodo ?? '7d');
  const dias    = DIAS_POR_PERIODO[periodo] ?? 7;
  const stationId = parseStationId(query.station_id);

  const supabase = await serverSupabaseClient(event);

  // RPC con LAG(): 1 fila por estación vs miles de filas crudas
  const { data, error } = await supabase.rpc('fn_session_metrics', {
    p_dias: dias,
    p_station_id: stationId,
  });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `fn_session_metrics: ${error.message}` });
  }

  const aggRows = (data ?? []) as AggRow[];

  if (!aggRows.length) {
    return {
      tasaOcupacionMedia:   0,
      sesionesEstimadas:    0,
      minutosOcupadosMedio: 0,
      cargadorMasUsado:     null,
      porEstacion:          [],
    };
  }

  const estadisticas = aggRows.map((row) => {
    const tasaOcupacion = row.total_samples > 0
      ? Math.round((row.occupied_samples / row.total_samples) * 100)
      : 0;
    const sesionesEstimadas = row.sessions_estimated;
    const minutosPorSesion = sesionesEstimadas > 0
      ? Math.round((row.occupied_samples / sesionesEstimadas) * 15)
      : 0;
    return {
      station_id:        row.station_id,
      location_name:     row.location_name,
      tasaOcupacion,
      sesionesEstimadas,
      minutosPorSesion,
    };
  });

  const tasaMedia = Math.round(
    estadisticas.reduce((s, e) => s + e.tasaOcupacion, 0) / estadisticas.length
  );
  const totalSesiones = estadisticas.reduce((s, e) => s + e.sesionesEstimadas, 0);
  const minutosOcupadosMedio = Math.round(
    estadisticas.reduce((s, e) => s + e.minutosPorSesion, 0) / estadisticas.length
  );
  const cargadorMasUsado = estadisticas.reduce((a, b) =>
    a.sesionesEstimadas >= b.sesionesEstimadas ? a : b
  );

  return {
    tasaOcupacionMedia:   tasaMedia,
    sesionesEstimadas:    totalSesiones,
    minutosOcupadosMedio,
    cargadorMasUsado,
    porEstacion:          estadisticas,
  };
}, {
  name: 'analytics-metrics',
  maxAge: 600,
  swr: true,
});
