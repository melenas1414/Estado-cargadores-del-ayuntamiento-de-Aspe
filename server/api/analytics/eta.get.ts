import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';
import { defineCachedEventHandler } from 'nitropack/runtime';

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

function parseDias(raw: unknown): number {
  // Elimina la opción 'all' que antes descargaba datos ilimitados.
  // Máximo 30 días para controlar el egress.
  const OPCIONES: Record<string, number> = { today: 1, '7d': 7, '30d': 30 };
  return OPCIONES[String(raw ?? '30d')] ?? 30;
}

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);
  const minutes = parseMinutes(query.minutes);
  const dias = parseDias(query.periodo);
  const stationId = parseStationId(query.station_id ?? query.stationId);

  const target = new Date(Date.now() + minutes * 60 * 1000);
  const targetDow = target.getUTCDay();
  const targetHour = target.getUTCHours();

  const supabase = await serverSupabaseClient(event);

  // RPC: devuelve 1 fila 'municipal' + N filas por estación (4-6 total)
  // vs la descarga anterior de TODOS los datos históricos sin filtro temporal.
  const { data, error } = await supabase.rpc('fn_eta_full', {
    p_target_dow:  targetDow,
    p_target_hour: targetHour,
    p_dias:        dias,
  });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `fn_eta_full: ${error.message}` });
  }

  const rows = (data ?? []) as Array<{
    scope: string;
    station_name: string;
    prob_libre: number;
    prob_saturada: number;
    muestras: number;
  }>;

  if (!rows.length) {
    return {
      etaMinutes: minutes,
      targetDay: targetDow,
      targetHour,
      muestras: 0,
      probabilidadMunicipalLibre: 0,
      probabilidadMunicipalSaturada: 0,
      estacionRecomendada: null,
      porEstacion: [],
    };
  }

  const municipal = rows.find((r) => r.scope === 'municipal');
  const porEstacion = rows
    .filter((r) => r.scope !== 'municipal')
    .map((r) => ({
      station_id: r.scope,
      location_name: r.station_name,
      probabilidadLibre: Math.round(Number(r.prob_libre)),
      muestras: r.muestras,
    }))
    .sort((a, b) => b.probabilidadLibre - a.probabilidadLibre);

  const recomendada = stationId
    ? porEstacion.find((p) => p.station_id === stationId) ?? null
    : (porEstacion[0] ?? null);

  return {
    etaMinutes: minutes,
    targetDay: targetDow,
    targetHour,
    muestras: municipal?.muestras ?? 0,
    probabilidadMunicipalLibre: Math.round(Number(municipal?.prob_libre ?? 0)),
    probabilidadMunicipalSaturada: Math.round(Number(municipal?.prob_saturada ?? 0)),
    estacionRecomendada: recomendada,
    porEstacion,
  };
}, {
  name: 'analytics-eta',
  maxAge: 600,
  swr: true,
});
