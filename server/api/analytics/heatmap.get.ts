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

const madridFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  hour12: false,
});

function getMadridDayHour(fechaUtc: Date): { dia: number; hora: number } | null {
  const parts = madridFormatter.formatToParts(fechaUtc);

  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);

  if (![year, month, day, hour].every((n) => Number.isFinite(n))) return null;

  // Construimos una fecha UTC con componentes ya convertidos a hora local Madrid.
  // Así obtenemos día de semana/hora estables sin depender de abreviaturas locales.
  const pseudoUtc = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  return {
    dia: pseudoUtc.getUTCDay(),
    hora: hour,
  };
}

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

  const chunkSize = 1000;
  const maxRows = 30000;
  const rawData: Array<{ created_at: string; is_available: boolean; station_id: string }> = [];

  for (let offset = 0; offset < maxRows; offset += chunkSize) {
    let pageQuery = supabase
      .from('charging_logs')
      .select('created_at, is_available, station_id')
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: true })
      .range(offset, offset + chunkSize - 1);

    if (stationId) {
      pageQuery = pageQuery.eq('station_id', stationId);
    }

    const { data: pageData, error: pageError } = await pageQuery;

    if (pageError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Error al consultar heatmap: ${pageError.message}`,
      });
    }

    const rows = pageData ?? [];
    rawData.push(...rows);

    if (rows.length < chunkSize) break;
  }

  // Agrupar en memoria usando siempre hora local de Madrid.
  const mapa: Record<string, { total: number; ocupados: number }> = {};

  for (const fila of rawData ?? []) {
    const fecha = new Date(fila.created_at);
    if (Number.isNaN(fecha.getTime())) continue;

    const zoned = getMadridDayHour(fecha);
    if (!zoned) continue;

    const { dia, hora } = zoned;

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
