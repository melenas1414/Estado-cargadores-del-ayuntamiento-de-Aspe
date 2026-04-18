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

export default defineEventHandler(async (event) => {
  const query   = getQuery(event);
  const periodo = String(query.periodo ?? '7d');
  const intervalo = PERIODOS[periodo] ?? '7 days';

  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase.rpc('heatmap_ocupacion', {
    intervalo_dias: intervalo,
  });

  if (error) {
    // Si la función RPC no existe todavía, usamos una query directa como fallback
    const desde = new Date();
    desde.setDate(desde.getDate() - (periodo === 'today' ? 1 : periodo === '7d' ? 7 : 30));

    const { data: rawData, error: rawError } = await supabase
      .from('charging_logs')
      .select('created_at, is_available')
      .gte('created_at', desde.toISOString());

    if (rawError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Error al consultar heatmap: ${rawError.message}`,
      });
    }

    // Agrupar en memoria
    const mapa: Record<string, { total: number; ocupados: number }> = {};

    for (const fila of rawData ?? []) {
      const fecha = new Date(fila.created_at);
      const dia   = fecha.getDay();   // 0 = Dom
      const hora  = fecha.getHours();
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
  }

  return { datos: data ?? [] };
});
