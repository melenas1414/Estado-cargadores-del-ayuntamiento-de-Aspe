import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';

const DIAS_POR_PERIODO: Record<string, number | null> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  all: null,
};

type Row = {
  station_id: string;
  location_name: string;
  is_available: boolean;
  available_connectors: number | null;
  total_connectors: number | null;
  out_of_service_connectors: number | null;
  created_at: string;
};

function parsePeriodo(raw: unknown): number | null {
  const periodo = String(raw ?? '7d');
  if (!Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, periodo)) return 7;
  return DIAS_POR_PERIODO[periodo];
}

function disponibilidad(row: Row): number {
  const total = typeof row.total_connectors === 'number' && row.total_connectors > 0 ? row.total_connectors : 2;
  const free = typeof row.available_connectors === 'number' ? row.available_connectors : (row.is_available ? 1 : 0);
  return total > 0 ? Math.max(0, Math.min(total, free)) / total : 0;
}

// Función auxiliar para paginar y traer todos los datos
async function fetchAllRows(supabase: any, baseQuery: any, pageSize: number = 1000): Promise<Row[]> {
  let allRows: Row[] = [];
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
    
    const rows = (data ?? []) as Row[];
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
  const query = getQuery(event);
  const dias = parsePeriodo(query.period);

  const supabase = await serverSupabaseClient(event);
  let queryLogs = supabase
    .from('charging_logs')
    .select('station_id, location_name, is_available, available_connectors, total_connectors, out_of_service_connectors, created_at')
    .order('created_at', { ascending: true });

  if (dias !== null) {
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    queryLogs = queryLogs.gte('created_at', since);
  }

  const rows = await fetchAllRows(supabase, queryLogs);
  if (!rows.length) return { rankings: [] };

  const byStation = new Map<string, {
    name: string;
    n: number;
    disponibilidadSum: number;
    offlineN: number;
  }>();

  for (const row of rows) {
    if (!byStation.has(row.station_id)) {
      byStation.set(row.station_id, { name: row.location_name, n: 0, disponibilidadSum: 0, offlineN: 0 });
    }
    const item = byStation.get(row.station_id)!;
    item.n += 1;
    item.disponibilidadSum += disponibilidad(row);
    if ((row.out_of_service_connectors ?? 0) > 0) item.offlineN += 1;
  }

  const ranking = Array.from(byStation.entries())
    .map(([stationId, item]) => {
      const disponibilidadPct = item.n ? Math.round((item.disponibilidadSum / item.n) * 100) : 0;
      const fiabilidadPct = item.n ? Math.round(((item.n - item.offlineN) / item.n) * 100) : 0;
      const score = Math.round(disponibilidadPct * 0.7 + fiabilidadPct * 0.3);
      return {
        stationId,
        stationName: item.name,
        disponibilidadPct,
        fiabilidadPct,
        score,
      };
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
});
