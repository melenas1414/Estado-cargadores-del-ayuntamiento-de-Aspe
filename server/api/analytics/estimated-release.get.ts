import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';

type NivelConfianza = 'alta' | 'media' | 'baja';

type CurrentRow = {
  station_id: string;
  location_name: string;
  created_at: string;
  is_available: boolean;
  available_connectors: number | null;
  total_connectors: number | null;
};

type LogRow = {
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

function median(values: number[]): number {
  if (!values.length) return 0;
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

function isOccupied(row: { is_available: boolean; available_connectors: number | null; total_connectors: number | null }): boolean {
  if (typeof row.available_connectors === 'number' && typeof row.total_connectors === 'number' && row.total_connectors > 0) {
    return row.available_connectors <= 0;
  }
  return !row.is_available;
}

function confidenceFromSamples(n: number): NivelConfianza {
  if (n >= 20) return 'alta';
  if (n >= 8) return 'media';
  return 'baja';
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const requestedStationId = parseStationId(query.station_id);
  const days = parseDays(query.dias_historico);

  const supabase = await serverSupabaseClient(event);

  const { data: currentRows, error: currentError } = await supabase
    .from('charger_current_status')
    .select('station_id, location_name, created_at, is_available, available_connectors, total_connectors')
    .order('location_name', { ascending: true });

  if (currentError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al consultar estado actual: ${currentError.message}`,
    });
  }

  const current = (currentRows ?? []) as CurrentRow[];
  if (!current.length) {
    return {
      station_id: null,
      location_name: null,
      estaLibreAhora: null,
      estimatedMinutesUntilFree: 0,
      confianza: 'baja' as NivelConfianza,
      metodo: 'sin_datos',
      muestrasReferencia: 0,
      diasHistorico: days,
    };
  }

  let target: CurrentRow | undefined;
  if (requestedStationId) {
    target = current.find((row) => row.station_id === requestedStationId);
  } else {
    target = current.find((row) => isOccupied(row)) ?? current[0];
  }

  if (!target) {
    return {
      station_id: requestedStationId,
      location_name: requestedStationId,
      estaLibreAhora: null,
      estimatedMinutesUntilFree: 0,
      confianza: 'baja' as NivelConfianza,
      metodo: 'sin_datos',
      muestrasReferencia: 0,
      diasHistorico: days,
    };
  }

  const estaLibreAhora = !isOccupied(target);
  if (estaLibreAhora) {
    return {
      station_id: target.station_id,
      location_name: target.location_name,
      estaLibreAhora,
      estimatedMinutesUntilFree: 0,
      confianza: 'alta' as NivelConfianza,
      metodo: 'actual_libre',
      muestrasReferencia: 0,
      diasHistorico: days,
    };
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: historyRows, error: historyError } = await supabase
    .from('charging_logs')
    .select('created_at, is_available, available_connectors, total_connectors')
    .eq('station_id', target.station_id)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (historyError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al calcular ETA de liberacion: ${historyError.message}`,
    });
  }

  const rows = (historyRows ?? []) as LogRow[];
  if (!rows.length) {
    return {
      station_id: target.station_id,
      location_name: target.location_name,
      estaLibreAhora,
      estimatedMinutesUntilFree: 0,
      confianza: 'baja' as NivelConfianza,
      metodo: 'sin_datos',
      muestrasReferencia: 0,
      diasHistorico: days,
    };
  }

  const sampleMin = inferSampleMinutes(rows);
  const durationsAll: number[] = [];
  const byStartHour = new Map<number, number[]>();

  let startMs: number | null = null;
  let startHour: number | null = null;

  for (const row of rows) {
    const ts = new Date(row.created_at).getTime();
    const occupied = isOccupied(row);

    if (occupied && startMs === null) {
      startMs = ts;
      startHour = new Date(row.created_at).getHours();
    }

    if (!occupied && startMs !== null) {
      const duration = Math.max(1, Math.round((ts - startMs) / 60000));
      durationsAll.push(duration);
      if (startHour !== null) {
        if (!byStartHour.has(startHour)) byStartHour.set(startHour, []);
        byStartHour.get(startHour)!.push(duration);
      }
      startMs = null;
      startHour = null;
    }
  }

  if (startMs !== null) {
    const lastTs = new Date(rows[rows.length - 1].created_at).getTime() + sampleMin * 60000;
    const duration = Math.max(1, Math.round((lastTs - startMs) / 60000));
    durationsAll.push(duration);
    if (startHour !== null) {
      if (!byStartHour.has(startHour)) byStartHour.set(startHour, []);
      byStartHour.get(startHour)!.push(duration);
    }
  }

  const currentHour = new Date().getHours();
  const hourDurations = byStartHour.get(currentHour) ?? [];
  const useHourModel = hourDurations.length >= 3;
  const reference = useHourModel ? hourDurations : durationsAll;

  const muestrasReferencia = reference.length;
  const estimatedMinutesUntilFree = muestrasReferencia
    ? Math.max(sampleMin, Math.round(reference.reduce((acc, v) => acc + v, 0) / muestrasReferencia))
    : 0;

  return {
    station_id: target.station_id,
    location_name: target.location_name,
    estaLibreAhora,
    estimatedMinutesUntilFree,
    confianza: confidenceFromSamples(muestrasReferencia),
    metodo: useHourModel ? 'modelo_hora' : 'modelo_global',
    muestrasReferencia,
    diasHistorico: days,
    muestraMinutos: sampleMin,
  };
});
