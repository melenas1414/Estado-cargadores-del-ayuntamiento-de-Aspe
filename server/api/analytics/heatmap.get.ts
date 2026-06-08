/**
 * GET /api/analytics/heatmap?periodo=7d|30d|today&station_id=...
 *
 * Devuelve una matriz de ocupación agrupada por día de la semana (0=Dom…6=Sáb)
 * y hora del día (0-23), expresada como porcentaje de ocupación (0-100).
 *
 * Usa la RPC fn_heatmap_data() para que PostgreSQL agregue los datos
 * antes de enviarlos. Devuelve máx 168 filas en vez de miles de filas crudas.
 */
import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';
import { defineCachedEventHandler } from 'nitropack/runtime';

const DIAS_POR_PERIODO: Record<string, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

function parsePeriodo(raw: unknown): number {
  const periodo = String(raw ?? '7d');
  return DIAS_POR_PERIODO[periodo] ?? 7;
}

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);
  const stationId = parseStationId(query.station_id);
  const dias = parsePeriodo(query.periodo);

  const supabase = await serverSupabaseClient(event);

  // RPC agrega en PostgreSQL → máx 168 filas en vez de miles de filas crudas
  const { data, error } = await supabase.rpc('fn_heatmap_data', {
    p_dias: dias,
    p_station_id: stationId,
  });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `fn_heatmap_data: ${error.message}` });
  }

  // Indexar por "dia-hora" para construcción eficiente de la matriz
  const byKey = new Map<string, { porcentaje: number; muestras: number }>();
  for (const row of (data ?? [])) {
    byKey.set(`${row.dia}-${row.hora}`, {
      porcentaje: Math.round(Number(row.porcentaje)),
      muestras: row.muestras,
    });
  }

  // Construir matriz completa 7×24 (−1 = sin datos)
  const points: Array<{ dia: number; hora: number; porcentaje: number }> = [];
  for (let dia = 0; dia < 7; dia++) {
    for (let hora = 0; hora < 24; hora++) {
      const entry = byKey.get(`${dia}-${hora}`);
      points.push({ dia, hora, porcentaje: entry ? entry.porcentaje : -1 });
    }
  }

  const totalSamples = (data ?? []).reduce((s: number, r: any) => s + (r.muestras ?? 0), 0);

  return {
    periodoDias: dias,
    stationId,
    datos: points,
    totalSamples,
    usedFallback: false,
  };
}, {
  name: 'analytics-heatmap',
  maxAge: 600,
  swr: true,
});
