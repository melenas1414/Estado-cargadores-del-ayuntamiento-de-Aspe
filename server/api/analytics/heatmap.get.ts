/**
 * GET /api/analytics/heatmap?periodo=7d|30d|today
 *
 * Devuelve una matriz de ocupación agrupada por día de la semana (0=Dom…6=Sáb)
 * y hora del día (0-23), expresada como porcentaje de ocupación (0-100).
 *
 * Estructura de respuesta:
 * {
 *   datos: [
 *     { dia: 1, hora: 8, totalRegistros: 48, ocupados: 36, porcentaje: 75 },
 *     …
 *   ]
 * }
 */
import { serverSupabaseClient } from '#supabase/server';

const PERIODOS: Record<string, string> = {
  today: '1 day',
  '7d':  '7 days',
  '30d': '30 days',
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
  dom: 0,
  lun: 1,
  mar: 2,
  mie: 3,
  'mié': 3,
  jue: 4,
  vie: 5,
  sab: 6,
  'sáb': 6,
};

const madridFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  weekday: 'short',
  hour: '2-digit',
  hour12: false,
});

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

export default defineEventHandler(async (event) => {
  const query   = getQuery(event);
  const periodo = String(query.periodo ?? '7d');
  const intervalo = PERIODOS[periodo] ?? '7 days';
  const stationId = parseStationId(query.station_id);

  const supabase = await serverSupabaseClient(event);

  // Query directa estable para todos los casos (evita discrepancias de RPC en producción).
  const desde = new Date();
  desde.setDate(desde.getDate() - (periodo === 'today' ? 1 : periodo === '7d' ? 7 : 30));

  let queryLogs = supabase
    .from('charging_logs')
    .select('created_at, is_available, station_id')
    .gte('created_at', desde.toISOString());

  if (stationId) {
    queryLogs = queryLogs.eq('station_id', stationId);
  }

  const { data: rawData, error: rawError } = await queryLogs;

  if (rawError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al consultar heatmap: ${rawError.message}`,
    });
  }

  // Agrupar en memoria usando siempre hora local de Madrid.
  const mapa: Record<string, { total: number; ocupados: number }> = {};

  for (const fila of rawData ?? []) {
    const fecha = new Date(fila.created_at);
    if (Number.isNaN(fecha.getTime())) continue;

    const parts = madridFormatter.formatToParts(fecha);
    const weekdayText = (parts.find((p) => p.type === 'weekday')?.value || '')
      .toLowerCase()
      .replace('.', '')
      .trim();
    const hourText = parts.find((p) => p.type === 'hour')?.value || '';

    const dia = WEEKDAY_TO_INDEX[weekdayText];
    const hora = Number.parseInt(hourText, 10);

    if (!Number.isFinite(dia) || !Number.isFinite(hora)) continue;
    const clave = `${dia}-${hora}`;

    if (!mapa[clave]) mapa[clave] = { total: 0, ocupados: 0 };
    mapa[clave].total++;
    if (!fila.is_available) mapa[clave].ocupados++;
  }

  const datos = Object.entries(mapa).map(([clave, val]) => {
    const [dia, hora] = clave.split('-').map(Number);
    return {
      dia,
      hora,
      totalRegistros: val.total,
      ocupados:       val.ocupados,
      porcentaje:     Math.round((val.ocupados / val.total) * 100),
    };
  });

  return { datos };
});
