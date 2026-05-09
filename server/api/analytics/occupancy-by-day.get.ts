import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';

const DIAS_POR_PERIODO: Record<string, number | null> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  all: null,
};

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

type Row = {
  created_at: string;
  is_available: boolean;
  available_connectors: number | null;
  total_connectors: number | null;
};

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

function parsePeriodo(raw: unknown): number | null {
  const periodo = String(raw ?? '30d');
  if (!Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, periodo)) return 30;
  return DIAS_POR_PERIODO[periodo];
}

function occupancyRatio(row: Row): number {
  const total = typeof row.total_connectors === 'number' && row.total_connectors > 0 ? row.total_connectors : 2;
  const free = typeof row.available_connectors === 'number' ? row.available_connectors : (row.is_available ? 1 : 0);
  const freeSafe = Math.max(0, Math.min(total, free));
  return total > 0 ? (1 - freeSafe / total) : 0;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const stationId = parseStationId(query.station_id);
  const dias = parsePeriodo(query.periodo);

  const supabase = await serverSupabaseClient(event);

  let queryLogs = supabase
    .from('charging_logs')
    .select('created_at, is_available, available_connectors, total_connectors')
    .order('created_at', { ascending: true });

  if (dias !== null) {
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    queryLogs = queryLogs.gte('created_at', since);
  }

  if (stationId) {
    queryLogs = queryLogs.eq('station_id', stationId);
  }

  const { data, error } = await queryLogs;
  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al calcular ocupacion por dia: ${error.message}`,
    });
  }

  const rows = (data ?? []) as Row[];
  const acc = Array.from({ length: 7 }, () => ({ occ: 0, samples: 0 }));

  for (const row of rows) {
    const day = new Date(row.created_at).getDay();
    acc[day].occ += occupancyRatio(row);
    acc[day].samples += 1;
  }

  const points = acc.map((item, dayIndex) => ({
    dayIndex,
    dayLabel: DIAS_ES[dayIndex],
    occupancyPct: item.samples ? Math.round((item.occ / item.samples) * 100) : 0,
    samples: item.samples,
  }));

  return {
    periodoDias: dias,
    stationId,
    points,
  };
});
