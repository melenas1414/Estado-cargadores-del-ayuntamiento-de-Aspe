/**
 * GET /api/analytics/prediction
 *
 * Analiza los últimos 30 días de datos históricos para el día de la semana actual
 * y devuelve la hora con mayor probabilidad de encontrar cargador libre.
 *
 * Respuesta:
 * {
 *   mejorHora: 10,
 *   probabilidad: 87,
 *   diaSemana: "Lunes",
 *   franjas: [ { hora: 0, disponibilidad: 45 }, … ]
 * }
 */
import { serverSupabaseClient } from '#supabase/server';

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default defineEventHandler(async (event) => {
  const supabase   = await serverSupabaseClient(event);
  const ahora      = new Date();
  const diaActual  = ahora.getDay(); // 0 = Dom … 6 = Sáb
  const hace30dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('charging_logs')
    .select('created_at, is_available')
    .gte('created_at', hace30dias.toISOString());

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al calcular predicción: ${error.message}`,
    });
  }

  // ─── Agrupar por hora para el día de la semana actual ──────────────────
  const porHora: Record<number, { total: number; disponibles: number }> = {};

  for (let h = 0; h < 24; h++) {
    porHora[h] = { total: 0, disponibles: 0 };
  }

  for (const fila of data ?? []) {
    const fecha = new Date(fila.created_at);
    if (fecha.getDay() !== diaActual) continue;

    const hora = fecha.getHours();
    porHora[hora].total++;
    if (fila.is_available) porHora[hora].disponibles++;
  }

  // ─── Calcular disponibilidad (%) por hora ──────────────────────────────
  const franjas = Array.from({ length: 24 }, (_, h) => {
    const { total, disponibles } = porHora[h];
    return {
      hora:           h,
      disponibilidad: total > 0 ? Math.round((disponibles / total) * 100) : 0,
      conDatos:       total > 0,
    };
  });

  // ─── Elegir la mejor hora (máxima disponibilidad con suficientes datos) ─
  const franjasConDatos = franjas.filter((f) => f.conDatos);

  let mejorFranja = franjasConDatos.length
    ? franjasConDatos.reduce((a, b) => (a.disponibilidad >= b.disponibilidad ? a : b))
    : { hora: 8, disponibilidad: 0, conDatos: false }; // Fallback sin datos

  // ─── Horas recomendables (disponibilidad ≥ 70 %) ────────────────────────
  const horasRecomendadas = franjasConDatos
    .filter((f) => f.disponibilidad >= 70)
    .map((f) => f.hora)
    .sort((a, b) => a - b);

  return {
    mejorHora:        mejorFranja.hora,
    probabilidad:     mejorFranja.disponibilidad,
    diaSemana:        DIAS_ES[diaActual],
    franjas,
    horasRecomendadas,
    haySuficientesDatos: franjasConDatos.length > 0,
  };
});
