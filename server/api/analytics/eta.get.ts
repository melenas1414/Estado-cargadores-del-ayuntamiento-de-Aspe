import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';
import { defineCachedEventHandler } from 'nitropack/runtime';

const DIAS_POR_PERIODO: Record<string, number | null> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  all: null,
};

type Row = {
  station_id: string;
  location_name: string;
  created_at: string;
  is_available: boolean;
  available_connectors: number | null;
  total_connectors: number | null;
};

function parseMinutes(raw: unknown): number {
  const n = Number(raw ?? 30);
  if (!Number.isFinite(n)) return 30;
  return Math.max(0, Math.min(180, Math.trunc(n)));
}

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

function parsePeriodo(raw: unknown): number | null {
  const periodo = String(raw ?? 'all');
  if (!Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, periodo)) {
    return DIAS_POR_PERIODO.all;
  }
  return DIAS_POR_PERIODO[periodo];
}

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);
  const minutes = parseMinutes(query.minutes);
  const dias = parsePeriodo(query.periodo);
  const stationId = parseStationId(query.station_id ?? query.stationId);

  const supabase = await serverSupabaseClient(event);
  const since = dias === null
    ? null
    : new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  let queryLogs = supabase
    .from('charging_logs')
    .select('station_id, location_name, created_at, is_available, available_connectors, total_connectors')
    .order('created_at', { ascending: true });

  if (since) {
    queryLogs = queryLogs.gte('created_at', since.toISOString());
  }

  if (stationId) {
    queryLogs = queryLogs.eq('station_id', stationId);
  }

  const { data, error } = await queryLogs;

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error en ETA: ${error.message}`,
    });
  }

  const rows = (data ?? []) as Row[];
  if (!rows.length) {
    return {
      etaMinutes: minutes,
      probabilidadMunicipalLibre: 0,
      probabilidadMunicipalSaturada: 0,
      muestras: 0,
      porEstacion: [],
    };
  }

  const target = new Date(Date.now() + minutes * 60 * 1000);
  const day = target.getUTCDay();
  const hour = target.getUTCHours();

  const snapshots: Record<string, { day: number; hour: number; free: number; total: number }> = {};
  const byStationSnapshot: Record<string, Record<string, { free: number; total: number; name: string }>> = {};

  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = r.created_at;

    if (!snapshots[key]) {
      snapshots[key] = { day: d.getUTCDay(), hour: d.getUTCHours(), free: 0, total: 0 };
    }

    const free = typeof r.available_connectors === 'number' ? Math.max(0, r.available_connectors) : (r.is_available ? 1 : 0);
    const total = typeof r.total_connectors === 'number' && r.total_connectors > 0 ? r.total_connectors : 2;

    snapshots[key].free += free;
    snapshots[key].total += total;

    if (!byStationSnapshot[r.station_id]) byStationSnapshot[r.station_id] = {};
    if (!byStationSnapshot[r.station_id][key]) {
      byStationSnapshot[r.station_id][key] = { free: 0, total: 0, name: r.location_name };
    }
    byStationSnapshot[r.station_id][key].free += free;
    byStationSnapshot[r.station_id][key].total += total;
  }

  const targetSnapshots = Object.entries(snapshots).filter(([, s]) => s.day === day && s.hour === hour);
  const muestras = targetSnapshots.length;
  const municipalLibres = targetSnapshots.filter(([, s]) => s.free > 0).length;
  const municipalSaturadas = targetSnapshots.filter(([, s]) => s.free <= 0).length;

  const probabilidadMunicipalLibre = muestras ? Math.round((municipalLibres / muestras) * 100) : 0;
  const probabilidadMunicipalSaturada = muestras ? Math.round((municipalSaturadas / muestras) * 100) : 0;

  const porEstacion = Object.entries(byStationSnapshot)
    .map(([id, snapMap]) => {
      const arr = Object.entries(snapMap).filter(([k]) => {
        const s = snapshots[k];
        return s && s.day === day && s.hour === hour;
      });
      const sampleCount = arr.length;
      const freeCount = arr.filter(([, s]) => s.free > 0).length;
      return {
        station_id: id,
        location_name: arr[0]?.[1]?.name ?? id,
        probabilidadLibre: sampleCount ? Math.round((freeCount / sampleCount) * 100) : 0,
        muestras: sampleCount,
      };
    })
    .sort((a, b) => b.probabilidadLibre - a.probabilidadLibre);

  const recomendada = stationId
    ? porEstacion.find((p) => p.station_id === stationId) ?? null
    : (porEstacion[0] ?? null);

  return {
    etaMinutes: minutes,
    targetDay: day,
    targetHour: hour,
    muestras,
    probabilidadMunicipalLibre,
    probabilidadMunicipalSaturada,
    estacionRecomendada: recomendada,
    porEstacion,
  };
}, {
  name: 'analytics-eta',
  maxAge: 3600,
  swr: true,
});
