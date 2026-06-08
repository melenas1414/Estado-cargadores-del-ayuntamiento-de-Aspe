import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';
import { defineCachedEventHandler } from 'nitropack/runtime';

const DIAS_POR_PERIODO: Record<string, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

function parsePeriodo(raw: unknown): number {
  const periodo = String(raw ?? '7d');
  return DIAS_POR_PERIODO[periodo] ?? 7;
}

type AggRow = {
  station_id: string;
  location_name: string;
  total_samples: number;
  occupied_samples: number;
  available_samples: number;
  oos_samples: number;
  avg_disponibilidad: number;
  avg_ocupacion: number;
};

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);
  const dias = parsePeriodo(query.period);

  const supabase = await serverSupabaseClient(event);

  // RPC: 1 fila por estación (3-5 filas) vs miles de filas crudas
  const { data, error } = await supabase.rpc('fn_station_aggregates', {
    p_dias: dias,
    p_station_id: null,
  });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `fn_station_aggregates: ${error.message}` });
  }

  const aggRows = (data ?? []) as AggRow[];
  if (!aggRows.length) return { rankings: [] };

  const ranking = aggRows.map((row) => {
    const disponibilidadPct = Math.round(Number(row.avg_disponibilidad));
    const fiabilidadPct = row.total_samples > 0
      ? Math.round(((row.total_samples - row.oos_samples) / row.total_samples) * 100)
      : 0;
    const score = Math.round(disponibilidadPct * 0.7 + fiabilidadPct * 0.3);
    return { stationId: row.station_id, stationName: row.location_name, disponibilidadPct, fiabilidadPct, score };
  })
    .sort((a, b) => b.score - a.score)
    .map((item, i) => ({
      position: i + 1,
      stationId: item.stationId,
      stationName: item.stationName,
      value: item.score,
      icon: i === 0 ? '🏆' : (item.fiabilidadPct >= 95 ? '🟢' : '⚡'),
      details: {
        disponibilidadPct: item.disponibilidadPct,
        fiabilidadPct: item.fiabilidadPct,
      },
    }));

  return { rankings: ranking };
}, {
  name: 'analytics-rankings',
  maxAge: 600,
  swr: true,
});
