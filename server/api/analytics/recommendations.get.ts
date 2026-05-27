import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';
import { defineCachedEventHandler } from 'nitropack/runtime';

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

type LogRow = {
  station_id: string;
  location_name: string;
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

function disponibilidad(row: LogRow): number {
  const total = typeof row.total_connectors === 'number' && row.total_connectors > 0 ? row.total_connectors : 2;
  const free = typeof row.available_connectors === 'number' ? row.available_connectors : (row.is_available ? 1 : 0);
  return total > 0 ? Math.max(0, Math.min(total, free)) / total : 0;
}

function fmtHora(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

// Función auxiliar para paginar y traer todos los datos
async function fetchAllRows(supabase: any, baseQuery: any, pageSize: number = 1000): Promise<LogRow[]> {
  let allRows: LogRow[] = [];
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
    
    const rows = (data ?? []) as LogRow[];
    allRows = allRows.concat(rows);
    
    if (rows.length < pageSize) {
      hasMore = false;
    } else {
      offset += pageSize;
    }
  }
  
  return allRows;
}

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);
  const stationId = parseStationId(query.station_id);

  const supabase = await serverSupabaseClient(event);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  let queryLogs = supabase
    .from('charging_logs')
    .select('station_id, location_name, created_at, is_available, available_connectors, total_connectors')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (stationId) {
    queryLogs = queryLogs.eq('station_id', stationId);
  }

  const rows = await fetchAllRows(supabase, queryLogs);
  if (!rows.length) return { recommendations: [] };

  const byHour = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
  const byDayHour = new Map<string, { sum: number; n: number }>();

  for (const row of rows) {
    const date = new Date(row.created_at);
    const day = date.getDay();
    const hour = date.getHours();
    const disp = disponibilidad(row);

    byHour[hour].sum += disp;
    byHour[hour].n += 1;

    const key = `${day}-${hour}`;
    if (!byDayHour.has(key)) byDayHour.set(key, { sum: 0, n: 0 });
    const item = byDayHour.get(key)!;
    item.sum += disp;
    item.n += 1;
  }

  const mejoresHoras = byHour
    .map((x, hour) => ({
      hour,
      score: x.n ? x.sum / x.n : 0,
      n: x.n,
    }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const mejorFranjaDia = Array.from(byDayHour.entries())
    .map(([key, value]) => {
      const [day, hour] = key.split('-').map(Number);
      return {
        day,
        hour,
        score: value.n ? value.sum / value.n : 0,
        n: value.n,
      };
    })
    .filter((x) => x.n >= 4)
    .sort((a, b) => b.score - a.score)[0] ?? null;

  const now = new Date();
  const nowDay = now.getDay();
  const nowHour = now.getHours();
  const keyNow = `${nowDay}-${nowHour}`;
  const slotNow = byDayHour.get(keyNow);
  const scoreNow = slotNow && slotNow.n ? slotNow.sum / slotNow.n : null;
  const scoreHourBase = byHour[nowHour].n ? byHour[nowHour].sum / byHour[nowHour].n : null;

  const recommendations: Array<{ text: string; confidence: 'alta' | 'media' | 'baja' }> = [];

  if (mejorFranjaDia) {
    const pct = Math.round(mejorFranjaDia.score * 100);
    recommendations.push({
      text: `Los ${DIAS_ES[mejorFranjaDia.day]} sobre las ${fmtHora(mejorFranjaDia.hour)} suele haber una disponibilidad del ${pct}%.`,
      confidence: mejorFranjaDia.n >= 20 ? 'alta' : 'media',
    });
  }

  if (mejoresHoras.length >= 2) {
    const inicio = mejoresHoras[0].hour;
    const fin = (mejoresHoras[1].hour + 1) % 24;
    const pct = Math.round(((mejoresHoras[0].score + mejoresHoras[1].score) / 2) * 100);
    recommendations.push({
      text: `Mejor ventana general para cargar: entre ${fmtHora(inicio)} y ${fmtHora(fin)} (${pct}% de disponibilidad estimada).`,
      confidence: Math.min(mejoresHoras[0].n, mejoresHoras[1].n) >= 20 ? 'alta' : 'media',
    });
  }

  if (scoreNow !== null && scoreHourBase !== null) {
    const diff = Math.round((scoreNow - scoreHourBase) * 100);
    if (Math.abs(diff) >= 10) {
      recommendations.push({
        text: diff > 0
          ? `Ahora hay más disponibilidad de lo normal para esta hora (+${diff} puntos).`
          : `Ahora hay más ocupación de lo normal para esta hora (${diff} puntos).`,
        confidence: slotNow && slotNow.n >= 12 ? 'media' : 'baja',
      });
    }
  }

  return { recommendations: recommendations.slice(0, 5) };
}, {
  name: 'analytics-recommendations',
  maxAge: 3600,
  swr: true,
});
