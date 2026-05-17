import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';

const DIAS_POR_PERIODO: Record<string, number | null> = {
  today: 1,
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

function median(values: number[]): number {
  if (!values.length) return 15;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[m];
  return Math.round((sorted[m - 1] + sorted[m]) / 2);
}

function inferSampleMinutes(rows: LogRow[]): number {
  if (rows.length < 2) return 15;
  const deltas: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].created_at).getTime();
    const curr = new Date(rows[i].created_at).getTime();
    const diff = Math.round((curr - prev) / 60000);
    if (Number.isFinite(diff) && diff > 0 && diff <= 120) deltas.push(diff);
  }
  return deltas.length ? median(deltas) : 15;
}

function isOffline(row: LogRow): boolean {
  return (row.out_of_service_connectors ?? 0) > 0;
}

function availabilityRatio(row: LogRow): number {
  const total = typeof row.total_connectors === 'number' && row.total_connectors > 0 ? row.total_connectors : 2;
  const free = typeof row.available_connectors === 'number' ? row.available_connectors : (row.is_available ? 1 : 0);
  const freeSafe = Math.max(0, Math.min(total, free));
  return total > 0 ? (freeSafe / total) : 0;
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

function fiabilidadDesdeMetrica(uptime: number, desconexionesPor30d: number): 'green' | 'yellow' | 'red' {
  if (uptime >= 95 && desconexionesPor30d <= 1) return 'green';
  if (uptime >= 85 && desconexionesPor30d <= 3) return 'yellow';
  return 'red';
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const stationId = parseStationId(query.station_id);
  const dias = parsePeriodo(query.periodo);

  const supabase = await serverSupabaseClient(event);

  let queryLogs = supabase
    .from('charging_logs')
    .select('station_id, location_name, created_at, is_available, available_connectors, total_connectors, out_of_service_connectors')
    .order('created_at', { ascending: true });

  if (dias !== null) {
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    queryLogs = queryLogs.gte('created_at', since);
  }

  if (stationId) {
    queryLogs = queryLogs.eq('station_id', stationId);
  }

  const rows = await fetchAllRows(supabase, queryLogs);
  if (!rows.length) {
    return {
      periodoDias: dias,
      stationId,
      porEstacion: [],
    };
  }

  const byStation = new Map<string, LogRow[]>();
  for (const row of rows) {
    if (!byStation.has(row.station_id)) byStation.set(row.station_id, []);
    byStation.get(row.station_id)!.push(row);
  }

  const porEstacion = Array.from(byStation.entries()).map(([id, stationRows]) => {
    const sampleMin = inferSampleMinutes(stationRows);
    const totalSnapshots = stationRows.length;

    let offlineSnapshots = 0;
    let desconexiones = 0;
    let prevOffline: boolean | null = null;
    let ultimaDesconexion: string | null = null;

    const reparacionesHoras: number[] = [];
    let inicioOfflineMs: number | null = null;

    let sumDisponibilidad = 0;

    for (const row of stationRows) {
      const offline = isOffline(row);
      const ts = new Date(row.created_at).getTime();

      sumDisponibilidad += availabilityRatio(row);
      if (offline) offlineSnapshots++;

      if (prevOffline === false && offline) {
        desconexiones++;
        ultimaDesconexion = row.created_at;
      }

      if (offline && inicioOfflineMs === null) {
        inicioOfflineMs = ts;
      }

      if (!offline && inicioOfflineMs !== null) {
        reparacionesHoras.push(Math.max(0, Math.round((ts - inicioOfflineMs) / 3600000)));
        inicioOfflineMs = null;
      }

      prevOffline = offline;
    }

    if (inicioOfflineMs !== null) {
      const endTs = new Date(stationRows[stationRows.length - 1].created_at).getTime() + sampleMin * 60000;
      reparacionesHoras.push(Math.max(0, Math.round((endTs - inicioOfflineMs) / 3600000)));
    }

    const uptime = totalSnapshots ? Math.round(((totalSnapshots - offlineSnapshots) / totalSnapshots) * 100) : 0;
    const disponibilidadPromedio = totalSnapshots ? Math.round((sumDisponibilidad / totalSnapshots) * 100) : 0;
    const tiempoOfflineHoras = Math.round((offlineSnapshots * sampleMin) / 60);

    const ventanaDias = dias ?? 30;
    const desconexionesPor30d = ventanaDias > 0 ? Number(((desconexiones / ventanaDias) * 30).toFixed(2)) : desconexiones;

    const tiempoMedioReparacion = reparacionesHoras.length
      ? Math.round(reparacionesHoras.reduce((acc, h) => acc + h, 0) / reparacionesHoras.length)
      : 0;

    return {
      stationId: id,
      locationName: stationRows[0]?.location_name ?? id,
      uptime,
      desconexiones,
      tiempoOfflineHoras,
      disponibilidadPromedio,
      fiabilidad: fiabilidadDesdeMetrica(uptime, desconexionesPor30d),
      ultimaDesconexion,
      tiempoMedioReparacion,
      muestraMinutos: sampleMin,
      muestras: totalSnapshots,
    };
  }).sort((a, b) => b.uptime - a.uptime);

  return {
    periodoDias: dias,
    stationId,
    porEstacion,
  };
});
