/**
 * GET /api/chargers/current
 * Devuelve el estado más reciente de cada una de las 5 estaciones.
 */
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event);

  const { data, error } = await supabase
    .from('charger_current_status')
    .select('*')
    .order('location_name', { ascending: true });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al consultar Supabase: ${error.message}`,
    });
  }

  return {
    cargadores: data ?? [],
    ultimaActualizacion: new Date().toISOString(),
  };
});
