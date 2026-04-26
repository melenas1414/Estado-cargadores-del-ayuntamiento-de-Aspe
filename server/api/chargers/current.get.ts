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

  const cargadores = data ?? [];

  // La cabecera debe reflejar cuándo se guardó la última muestra en nuestro sistema.
  // availability_updated_at puede venir retrasado desde el proveedor.
  const ultimaActualizacion = cargadores.length
    ? cargadores.reduce((max: string, c: any) => {
        const current = c.created_at;
        return current > max ? current : max;
      }, cargadores[0].created_at)
    : new Date().toISOString();

  const ultimoEstadoProveedor = cargadores.length
    ? cargadores.reduce((max: string | null, c: any) => {
        const current = c.availability_updated_at;
        if (!current) return max;
        if (!max) return current;
        return current > max ? current : max;
      }, null)
    : null;

  return {
    cargadores,
    ultimaActualizacion,
    ultimoEstadoProveedor,
  };
});
