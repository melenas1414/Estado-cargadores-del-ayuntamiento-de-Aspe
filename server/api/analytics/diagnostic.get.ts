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
  station_id: string;
  location_name: string;
  created_at: string;
  is_available: boolean;
  available_connectors: number | null;
  total_connectors: number | null;
  out_of_service_connectors: number | null;
  availability_updated_at: string | null;
};

type ZonaDiagnostico = {
  zona: string;
  prioridad: 'critical' | 'high' | 'medium' | 'low';
  ocupacionMediaPct: number;
  minutosSinConectoresLibres: number;
  estaciones: number;
  estacionIds: string[];
  recomendacion: string;
};

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function round(n: number): number {
  return Math.round(n);
}

function inferSampleMinutes(sortedTimestamps: number[]): number {
  if (sortedTimestamps.length < 2) return 15;
  const deltas: number[] = [];
  for (let i = 1; i < sortedTimestamps.length; i++) {
    const d = (sortedTimestamps[i] - sortedTimestamps[i - 1]) / 60000;
    if (Number.isFinite(d) && d > 0) deltas.push(d);
  }
  if (!deltas.length) return 15;
  deltas.sort((a, b) => a - b);
  return Math.max(1, round(deltas[Math.floor(deltas.length / 2)]));
}

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

function inferZona(locationName: string): string {
  const base = String(locationName || '')
    .split(',')[0]
    .replace(/\s+/g, ' ')
    .trim();

  if (!base) return 'Zona sin identificar';

  const sinNumero = base
    .replace(/\b\d+[a-zA-Z]*\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return sinNumero || base;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const periodo = String(query.periodo ?? '7d');
  const dias = Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, periodo)
    ? DIAS_POR_PERIODO[periodo]
    : 7;
  const stationId = parseStationId(query.station_id);

  const supabase = await serverSupabaseClient(event);
  const desde = dias === null
    ? null
    : new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  let queryLogs = supabase
    .from('charging_logs')
    .select('station_id, location_name, created_at, is_available, available_connectors, total_connectors, out_of_service_connectors, availability_updated_at')
    .order('created_at', { ascending: true });

  if (desde) {
    queryLogs = queryLogs.gte('created_at', desde.toISOString());
  }

  if (stationId) {
    queryLogs = queryLogs.eq('station_id', stationId);
  }

  const { data, error } = await queryLogs;

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error en diagnostico: ${error.message}`,
    });
  }

  const rows = (data ?? []) as Row[];
  if (!rows.length) {
    return {
      saturacion: {
        porcentaje: 0,
        minutosSinConectoresLibres: 0,
        muestraMinutos: 15,
        sugerencia: 'Sin datos suficientes',
        conectoresExtraRecomendados: 0,
        puntosExtraRecomendados: 0,
      },
      averias: [],
      insights: [],
      zonasPrioritarias: [],
    };
  }

  const snapshots: Record<string, { free: number; total: number }> = {};
  for (const r of rows) {
    if (!snapshots[r.created_at]) snapshots[r.created_at] = { free: 0, total: 0 };
    const free = typeof r.available_connectors === 'number' ? Math.max(0, r.available_connectors) : (r.is_available ? 1 : 0);
    const total = typeof r.total_connectors === 'number' && r.total_connectors > 0 ? r.total_connectors : 2;
    snapshots[r.created_at].free += free;
    snapshots[r.created_at].total += total;
  }

  const snapshotKeys = Object.keys(snapshots).sort();
  const snapshotTimes = snapshotKeys.map((k) => toMs(k));
  const sampleMinutes = inferSampleMinutes(snapshotTimes);

  const totalSnapshots = snapshotKeys.length;
  const saturatedSnapshots = snapshotKeys.filter((k) => snapshots[k].free <= 0).length;
  const saturationPct = totalSnapshots > 0 ? round((saturatedSnapshots / totalSnapshots) * 100) : 0;
  const saturatedMinutes = saturatedSnapshots * sampleMinutes;

  const conectoresExtraRecomendados = saturationPct >= 15 ? Math.max(1, Math.ceil((saturationPct - 15) / 10) + 1) : 0;
  const puntosExtraRecomendados = Math.ceil(conectoresExtraRecomendados / 2);

  const saturacion = {
    porcentaje: saturationPct,
    minutosSinConectoresLibres: saturatedMinutes,
    muestraMinutos: sampleMinutes,
    sugerencia:
      saturationPct >= 25
        ? 'Alta saturacion. Recomendable ampliar infraestructura.'
        : saturationPct >= 15
          ? 'Saturacion moderada. Vigilar demanda y planificar ampliacion.'
          : 'Saturacion baja. Red estable.',
    conectoresExtraRecomendados,
    puntosExtraRecomendados,
  };

  const byStation: Record<string, Row[]> = {};
  for (const r of rows) {
    if (!byStation[r.station_id]) byStation[r.station_id] = [];
    byStation[r.station_id].push(r);
  }

  const now = Date.now();
  const averias = Object.entries(byStation).map(([stationId, stationRows]) => {
    stationRows.sort((a, b) => toMs(a.created_at) - toMs(b.created_at));
    const locationName = stationRows[0]?.location_name ?? stationId;

    const outRows = stationRows.filter((r) => (r.out_of_service_connectors ?? 0) > 0).length;
    const outRatio = stationRows.length ? (outRows / stationRows.length) * 100 : 0;

    let maxOutStreak = 0;
    let currentStreak = 0;
    for (const r of stationRows) {
      if ((r.out_of_service_connectors ?? 0) > 0) {
        currentStreak++;
        maxOutStreak = Math.max(maxOutStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    const outStreakHours = round((maxOutStreak * sampleMinutes) / 60);

    const latestAvailabilityUpdate = stationRows
      .map((r) => r.availability_updated_at)
      .filter((x): x is string => Boolean(x))
      .sort()
      .at(-1) ?? null;

    const staleHours = latestAvailabilityUpdate
      ? (now - new Date(latestAvailabilityUpdate).getTime()) / (1000 * 60 * 60)
      : Infinity;

    const last48h = stationRows.filter((r) => now - toMs(r.created_at) <= 48 * 60 * 60 * 1000);
    const availSeries = last48h
      .map((r) => (typeof r.available_connectors === 'number' ? r.available_connectors : (r.is_available ? 1 : 0)))
      .filter((n) => Number.isFinite(n));
    const uniq = new Set(availSeries);
    const flatline = availSeries.length >= 8 && uniq.size === 1;

    const reasons: string[] = [];
    if (outRatio >= 30) reasons.push(`Fuera de servicio frecuente (${round(outRatio)}%)`);
    if (outStreakHours >= 24) reasons.push(`Fuera de servicio prolongado (${outStreakHours}h)`);
    if (staleHours >= 6) reasons.push(`Dato dinamico desactualizado (${round(staleHours)}h)`);
    if (flatline) reasons.push('Patron plano de disponibilidad en 48h');

    const level =
      reasons.length >= 2 || outStreakHours >= 24
        ? 'critical'
        : reasons.length === 1
          ? 'warning'
          : 'ok';

    return {
      station_id: stationId,
      location_name: locationName,
      nivel: level,
      razones: reasons,
      ratioFueraServicio: round(outRatio),
      rachaFueraServicioHoras: outStreakHours,
      horasSinActualizarDinamico: Number.isFinite(staleHours) ? round(staleHours) : null,
    };
  });

  const hh: Record<string, { occ: number; total: number }> = {};
  const stationOcc: Record<string, { name: string; occ: number; total: number }> = {};
  const zonaOcc: Record<string, { occ: number; total: number; sinLibres: number; stations: Set<string> }> = {};

  for (const r of rows) {
    const date = new Date(r.created_at);
    const key = `${date.getDay()}-${date.getHours()}`;
    const free = typeof r.available_connectors === 'number' ? r.available_connectors : (r.is_available ? 1 : 0);
    const total = typeof r.total_connectors === 'number' && r.total_connectors > 0 ? r.total_connectors : 2;
    const occRatio = total > 0 ? 1 - Math.min(Math.max(free, 0), total) / total : 0;

    if (!hh[key]) hh[key] = { occ: 0, total: 0 };
    hh[key].occ += occRatio;
    hh[key].total++;

    const zona = inferZona(r.location_name);
    if (!zonaOcc[zona]) {
      zonaOcc[zona] = { occ: 0, total: 0, sinLibres: 0, stations: new Set<string>() };
    }
    zonaOcc[zona].occ += occRatio;
    zonaOcc[zona].total++;
    zonaOcc[zona].stations.add(r.station_id);
    if (free <= 0) zonaOcc[zona].sinLibres++;

    if (!stationOcc[r.station_id]) {
      stationOcc[r.station_id] = { name: r.location_name, occ: 0, total: 0 };
    }
    stationOcc[r.station_id].occ += occRatio;
    stationOcc[r.station_id].total++;
  }

  let worstKey = '0-0';
  let worstVal = -1;
  for (const [k, v] of Object.entries(hh)) {
    const avg = v.total ? v.occ / v.total : 0;
    if (avg > worstVal) {
      worstVal = avg;
      worstKey = k;
    }
  }

  let bestKey = '0-0';
  let bestVal = 2;
  for (const [k, v] of Object.entries(hh)) {
    const avg = v.total ? v.occ / v.total : 0;
    if (avg < bestVal) {
      bestVal = avg;
      bestKey = k;
    }
  }

  const [worstDay, worstHour] = worstKey.split('-').map(Number);
  const [bestDay, bestHour] = bestKey.split('-').map(Number);

  let stressedStation = { station_id: '', location_name: '', ocupacion: 0 };
  for (const [id, v] of Object.entries(stationOcc)) {
    const avg = v.total ? v.occ / v.total : 0;
    if (avg > stressedStation.ocupacion) {
      stressedStation = { station_id: id, location_name: v.name, ocupacion: avg };
    }
  }

  const insights = [
    `Franja critica: ${DIAS_ES[worstDay]} ${String(worstHour).padStart(2, '0')}:00 con ${round(worstVal * 100)}% de ocupacion media.`,
    `Franja favorable: ${DIAS_ES[bestDay]} ${String(bestHour).padStart(2, '0')}:00 con ${round((1 - bestVal) * 100)}% de disponibilidad media.`,
    `Estacion con mayor estres: ${stressedStation.location_name} (${round(stressedStation.ocupacion * 100)}% ocupacion media).`,
    saturationPct >= 15
      ? `Demanda insatisfecha detectada: red saturada ${saturationPct}% del tiempo.`
      : `Red estable: saturacion municipal en ${saturationPct}%.`,
  ];

  const zonasPrioritarias: ZonaDiagnostico[] = Object.entries(zonaOcc)
    .map(([zona, stats]) => {
      const avgOcc = stats.total ? stats.occ / stats.total : 0;
      const ocupacionMediaPct = round(avgOcc * 100);
      const minutosSinConectoresLibres = stats.sinLibres * sampleMinutes;

      let prioridad: ZonaDiagnostico['prioridad'] = 'low';
      if (ocupacionMediaPct >= 75) prioridad = 'critical';
      else if (ocupacionMediaPct >= 60) prioridad = 'high';
      else if (ocupacionMediaPct >= 45) prioridad = 'medium';

      const recomendacion =
        prioridad === 'critical'
          ? 'Refuerzo urgente: valorar 1-2 puntos nuevos en esta zona.'
          : prioridad === 'high'
            ? 'Refuerzo recomendado: planificar ampliacion de conectores.'
            : prioridad === 'medium'
              ? 'Seguimiento activo: revisar tendencia antes de ampliar.'
              : 'Zona estable: no requiere refuerzo inmediato.';

      return {
        zona,
        prioridad,
        ocupacionMediaPct,
        minutosSinConectoresLibres,
        estaciones: stats.stations.size,
        estacionIds: Array.from(stats.stations),
        recomendacion,
      };
    })
    .sort((a, b) => b.ocupacionMediaPct - a.ocupacionMediaPct)
    .slice(0, 4);

  return {
    saturacion,
    averias,
    insights,
    zonasPrioritarias,
  };
});
