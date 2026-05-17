import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';

type NivelConfianza = 'alta' | 'media' | 'baja';

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

function parseDays(raw: unknown): number {
  const n = Number(raw ?? 56);
  if (!Number.isFinite(n)) return 56;
  return Math.max(7, Math.min(365, Math.trunc(n)));
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

function toMinutes(ms: number): number {
  return Math.max(0, Math.round(ms / 60000));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[m];
  return Math.round((sorted[m - 1] + sorted[m]) / 2);
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
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

function isOccupied(row: LogRow): boolean {
  if (typeof row.available_connectors === 'number' && typeof row.total_connectors === 'number' && row.total_connectors > 0) {
    return row.available_connectors <= 0;
  }
  return !row.is_available;
}

function confidenceFromSessions(n: number): NivelConfianza {
  if (n >= 30) return 'alta';
  if (n >= 10) return 'media';
  return 'baja';
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const stationId = parseStationId(query.station_id);
  const days = parseDays(query.dias_historico);

  const supabase = await serverSupabaseClient(event);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let queryLogs = supabase
    .from('charging_logs')
    .select('station_id, location_name, created_at, is_available, available_connectors, total_connectors')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (stationId) {
    queryLogs = queryLogs.eq('station_id', stationId);
  }

  const rows = await fetchAllRows(supabase, queryLogs);
  if (!rows.length) {
    return {
      diasHistorico: days,
      stationId,
      sesionesTotales: 0,
      duracionMediaMin: 0,
      medianaMin: 0,
      p90Min: 0,
      confianza: 'baja' as NivelConfianza,
      porEstacion: [],
    };
  }

  const grouped = new Map<string, LogRow[]>();
  for (const row of rows) {
    if (!grouped.has(row.station_id)) grouped.set(row.station_id, []);
    grouped.get(row.station_id)!.push(row);
  }

  const porEstacion = Array.from(grouped.entries()).map(([id, stationRows]) => {
    const sampleMin = inferSampleMinutes(stationRows);
    const sesionesMin: number[] = [];
    const porHoraDuraciones = new Map<number, number[]>();

    let startMs: number | null = null;
    let startHour: number | null = null;

    for (const row of stationRows) {
      const ts = new Date(row.created_at).getTime();
      const occupied = isOccupied(row);

      if (occupied && startMs === null) {
        startMs = ts;
        startHour = new Date(row.created_at).getHours();
      }

      if (!occupied && startMs !== null) {
        const duration = toMinutes(ts - startMs);
        sesionesMin.push(duration);
        if (startHour !== null) {
          if (!porHoraDuraciones.has(startHour)) porHoraDuraciones.set(startHour, []);
          porHoraDuraciones.get(startHour)!.push(duration);
        }
        startMs = null;
        startHour = null;
      }
    }

    if (startMs !== null) {
      const lastTs = new Date(stationRows[stationRows.length - 1].created_at).getTime() + sampleMin * 60000;
      const duration = toMinutes(lastTs - startMs);
      sesionesMin.push(duration);
      if (startHour !== null) {
        if (!porHoraDuraciones.has(startHour)) porHoraDuraciones.set(startHour, []);
        porHoraDuraciones.get(startHour)!.push(duration);
      }
    }

    const sesiones = sesionesMin.length;
    const media = sesiones ? Math.round(sesionesMin.reduce((acc, v) => acc + v, 0) / sesiones) : 0;
    const mediana = median(sesionesMin);
    const p90 = percentile(sesionesMin, 90);

    const porHora = Array.from(porHoraDuraciones.entries())
      .map(([hora, values]) => ({
        hora,
        sesiones: values.length,
        duracionMediaMin: Math.round(values.reduce((acc, v) => acc + v, 0) / values.length),
      }))
      .sort((a, b) => a.hora - b.hora);

    return {
      station_id: id,
      location_name: stationRows[0]?.location_name ?? id,
      sesiones,
      duracionMediaMin: media,
      medianaMin: mediana,
      p90Min: p90,
      muestraMinutos: sampleMin,
      confianza: confidenceFromSessions(sesiones),
      porHora,
    };
  });

  const sesionesTotales = porEstacion.reduce((acc, s) => acc + s.sesiones, 0);
  const duracionMediaMin = sesionesTotales
    ? Math.round(
      porEstacion.reduce((acc, s) => acc + (s.duracionMediaMin * s.sesiones), 0) /
          sesionesTotales,
    )
    : 0;

  const allDurations = porEstacion.flatMap((s) => {
    const values: number[] = [];
    for (const h of s.porHora) {
      for (let i = 0; i < h.sesiones; i++) values.push(h.duracionMediaMin);
    }
    return values;
  });

  return {
    diasHistorico: days,
    stationId,
    sesionesTotales,
    duracionMediaMin,
    medianaMin: median(allDurations),
    p90Min: percentile(allDurations, 90),
    confianza: confidenceFromSessions(sesionesTotales),
    porEstacion,
  };
});
