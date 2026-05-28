import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';
import { defineCachedEventHandler } from 'nitropack/runtime';

const DIAS_POR_PERIODO: Record<string, number | null> = {
  '7d': 7,
  '30d': 30,
  all: null,
};

type LogRow = {
  station_id: string;
  location_name: string;
  created_at: string;
  is_available: boolean;
  available_connectors: number | null;
  total_connectors: number | null;
  out_of_service_connectors: number | null;
};

function parsePeriodo(raw: unknown): number | null {
  const periodo = String(raw ?? '30d');
  if (!Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, periodo)) return 30;
  return DIAS_POR_PERIODO[periodo];
}

function disponibilidadRatio(row: LogRow): number {
  const total = typeof row.total_connectors === 'number' && row.total_connectors > 0 ? row.total_connectors : 2;
  const free = typeof row.available_connectors === 'number' ? row.available_connectors : (row.is_available ? 1 : 0);
  return total > 0 ? Math.max(0, Math.min(total, free)) / total : 0;
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
  const dias = parsePeriodo(query.period);

  const supabase = await serverSupabaseClient(event);

  let queryLogs = supabase
    .from('charging_logs')
    .select('station_id, location_name, created_at, is_available, available_connectors, total_connectors, out_of_service_connectors')
    .order('created_at', { ascending: true });

  if (dias !== null) {
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    queryLogs = queryLogs.gte('created_at', since);
  }

  const rows = await fetchAllRows(supabase, queryLogs);
  if (!rows.length) return { anomalies: [] };

  const byStation = new Map<string, LogRow[]>();
  for (const row of rows) {
    if (!byStation.has(row.station_id)) byStation.set(row.station_id, []);
    byStation.get(row.station_id)!.push(row);
  }

  const anomalies: Array<{
    type: 'occupied_long' | 'occupancy_spike' | 'frequent_disconnects' | 'pattern_change';
    stationId: string;
    stationName: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    detectedAt: string;
  }> = [];

  for (const [stationId, stationRows] of byStation.entries()) {
    if (!stationRows.length) continue;
    const stationName = stationRows[0].location_name;
    const latest = stationRows[stationRows.length - 1];

    let rachaOcupado = 0;
    for (let i = stationRows.length - 1; i >= 0; i--) {
      const row = stationRows[i];
      const total = typeof row.total_connectors === 'number' && row.total_connectors > 0 ? row.total_connectors : 2;
      const free = typeof row.available_connectors === 'number' ? row.available_connectors : (row.is_available ? 1 : 0);
      if (free <= 0 || (!row.is_available && total === 1)) {
        rachaOcupado++;
      } else {
        break;
      }
    }

    if (rachaOcupado >= 16) {
      anomalies.push({
        type: 'occupied_long',
        stationId,
        stationName,
        severity: rachaOcupado >= 48 ? 'high' : 'medium',
        description: `Posible vehículo abandonado: ${rachaOcupado} muestras consecutivas sin conectores libres.`,
        detectedAt: latest.created_at,
      });
    }

    const desconexiones = stationRows.filter((r) => (r.out_of_service_connectors ?? 0) > 0).length;
    const ratioDesconexion = stationRows.length ? desconexiones / stationRows.length : 0;
    if (ratioDesconexion >= 0.2) {
      anomalies.push({
        type: 'frequent_disconnects',
        stationId,
        stationName,
        severity: ratioDesconexion >= 0.4 ? 'high' : 'medium',
        description: `Desconexiones frecuentes: ${(ratioDesconexion * 100).toFixed(0)}% de muestras con conectores fuera de servicio.`,
        detectedAt: latest.created_at,
      });
    }

    const disponibilidad = stationRows.map(disponibilidadRatio);
    const n = disponibilidad.length;
    const baseN = Math.max(8, Math.floor(n * 0.8));
    const ref = disponibilidad.slice(0, baseN);
    const rec = disponibilidad.slice(baseN);

    const avgRef = ref.length ? ref.reduce((acc, v) => acc + v, 0) / ref.length : 0;
    const avgRec = rec.length ? rec.reduce((acc, v) => acc + v, 0) / rec.length : avgRef;
    const delta = avgRec - avgRef;

    if (Math.abs(delta) >= 0.2) {
      anomalies.push({
        type: 'pattern_change',
        stationId,
        stationName,
        severity: Math.abs(delta) >= 0.35 ? 'high' : 'medium',
        description: delta > 0
          ? `Cambio de patrón: mejora de ${(delta * 100).toFixed(0)} puntos en disponibilidad reciente.`
          : `Cambio de patrón: caída de ${Math.abs(delta * 100).toFixed(0)} puntos en disponibilidad reciente.`,
        detectedAt: latest.created_at,
      });
    }

    const ultimaHora = stationRows.slice(-12);
    const avgUltimaHora = ultimaHora.length
      ? ultimaHora.map(disponibilidadRatio).reduce((acc, v) => acc + v, 0) / ultimaHora.length
      : avgRec;

    if (avgRef > 0 && avgUltimaHora < avgRef * 0.5 && stationRows.length >= 24) {
      anomalies.push({
        type: 'occupancy_spike',
        stationId,
        stationName,
        severity: avgUltimaHora < avgRef * 0.35 ? 'high' : 'medium',
        description: `Pico de ocupación: disponibilidad última hora ${(avgUltimaHora * 100).toFixed(0)}% vs histórico ${(avgRef * 100).toFixed(0)}%.`,
        detectedAt: latest.created_at,
      });
    }
  }

  return {
    anomalies: anomalies
      .sort((a, b) => {
        const sevOrder = { high: 3, medium: 2, low: 1 };
        if (sevOrder[a.severity] !== sevOrder[b.severity]) {
          return sevOrder[b.severity] - sevOrder[a.severity];
        }
        return b.detectedAt.localeCompare(a.detectedAt);
      })
      .slice(0, 12),
  };
}, {
  name: 'analytics-anomalies',
  maxAge: 3600,
  swr: true,
});
