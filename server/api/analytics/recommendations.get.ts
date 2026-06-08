import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';
import { defineCachedEventHandler } from 'nitropack/runtime';

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

type AggRow = {
  day_of_week: number;
  hour_of_day: number;
  avg_disponibilidad: number;
  sample_count: number;
};

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

function fmtHora(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);
  const stationId = parseStationId(query.station_id);

  const supabase = await serverSupabaseClient(event);

  // RPC: 30 días, máx 168 filas agregadas vs ~43.200 filas crudas (90 días antes)
  const { data, error } = await supabase.rpc('fn_availability_by_day_hour', {
    p_dias: 30,
    p_station_id: stationId,
  });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `fn_availability_by_day_hour: ${error.message}` });
  }

  const aggRows = (data ?? []) as AggRow[];
  if (!aggRows.length) return { recommendations: [] };

  // Reconstruir byHour y byDayHour desde datos ya agregados
  const byHour = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
  const byDayHour = new Map<string, { sum: number; n: number }>();

  for (const row of aggRows) {
    const disp = Number(row.avg_disponibilidad);
    const n = row.sample_count;

    // Media ponderada: sum = avg * n, n = count → sum/n = weighted avg
    byHour[row.hour_of_day].sum += disp * n;
    byHour[row.hour_of_day].n += n;

    const key = `${row.day_of_week}-${row.hour_of_day}`;
    if (!byDayHour.has(key)) byDayHour.set(key, { sum: 0, n: 0 });
    const item = byDayHour.get(key)!;
    item.sum += disp * n;
    item.n += n;
  }

  const mejoresHoras = byHour
    .map((x, hour) => ({ hour, score: x.n ? x.sum / x.n : 0, n: x.n }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const mejorFranjaDia = Array.from(byDayHour.entries())
    .map(([key, value]) => {
      const [day, hour] = key.split('-').map(Number);
      return { day, hour, score: value.n ? value.sum / value.n : 0, n: value.n };
    })
    .filter((x) => x.n >= 4)
    .sort((a, b) => b.score - a.score)[0] ?? null;

  const now = new Date();
  const nowDay = now.getDay();
  const nowHour = now.getHours();
  const keyNow = `${nowDay}-${nowHour}`;
  const slotNow = byDayHour.get(keyNow);
  const scoreNow = slotNow && slotNow.n ? slotNow.sum / slotNow.n : null;
  const scoreHourBase = byHour[nowHour].n ? byHour[nowHour].sum / byHour[nowHour].n : null;

  const recommendations: Array<{ text: string; confidence: 'alta' | 'media' | 'baja' }> = [];

  if (mejorFranjaDia) {
    const pct = Math.round(mejorFranjaDia.score * 100);
    recommendations.push({
      text: `Los ${DIAS_ES[mejorFranjaDia.day]} sobre las ${fmtHora(mejorFranjaDia.hour)} suele haber una disponibilidad del ${pct}%.`,
      confidence: mejorFranjaDia.n >= 20 ? 'alta' : 'media',
    });
  }

  if (mejoresHoras.length >= 2) {
    const inicio = mejoresHoras[0].hour;
    const fin = (mejoresHoras[1].hour + 1) % 24;
    const pct = Math.round(((mejoresHoras[0].score + mejoresHoras[1].score) / 2) * 100);
    recommendations.push({
      text: `Mejor ventana general para cargar: entre ${fmtHora(inicio)} y ${fmtHora(fin)} (${pct}% de disponibilidad estimada).`,
      confidence: Math.min(mejoresHoras[0].n, mejoresHoras[1].n) >= 20 ? 'alta' : 'media',
    });
  }

  if (scoreNow !== null && scoreHourBase !== null) {
    const diff = Math.round((scoreNow - scoreHourBase) * 100);
    if (Math.abs(diff) >= 10) {
      recommendations.push({
        text: diff > 0
          ? `Ahora hay más disponibilidad de lo normal para esta hora (+${diff} puntos).`
          : `Ahora hay más ocupación de lo normal para esta hora (${diff} puntos).`,
        confidence: slotNow && slotNow.n >= 12 ? 'media' : 'baja',
      });
    }
  }

  return { recommendations: recommendations.slice(0, 5) };
}, {
  name: 'analytics-recommendations',
  maxAge: 600,
  swr: true,
});

  const byHour = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
  const byDayHour = new Map<string, { sum: number; n: number }>();

  for (const row of rows) {
    const date = new Date(row.created_at);
    const day = date.getDay();
    const hour = date.getHours();
    const disp = disponibilidad(row);

    byHour[hour].sum += disp;
    byHour[hour].n += 1;

    const key = `${day}-${hour}`;
    if (!byDayHour.has(key)) byDayHour.set(key, { sum: 0, n: 0 });
    const item = byDayHour.get(key)!;
    item.sum += disp;
    item.n += 1;
  }

  const mejoresHoras = byHour
    .map((x, hour) => ({
      hour,
      score: x.n ? x.sum / x.n : 0,
      n: x.n,
    }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const mejorFranjaDia = Array.from(byDayHour.entries())
    .map(([key, value]) => {
      const [day, hour] = key.split('-').map(Number);
      return {
        day,
        hour,
        score: value.n ? value.sum / value.n : 0,
        n: value.n,
      };
    })
    .filter((x) => x.n >= 4)
    .sort((a, b) => b.score - a.score)[0] ?? null;

  const now = new Date();
  const nowDay = now.getDay();
  const nowHour = now.getHours();
  const keyNow = `${nowDay}-${nowHour}`;
  const slotNow = byDayHour.get(keyNow);
  const scoreNow = slotNow && slotNow.n ? slotNow.sum / slotNow.n : null;
  const scoreHourBase = byHour[nowHour].n ? byHour[nowHour].sum / byHour[nowHour].n : null;

  const recommendations: Array<{ text: string; confidence: 'alta' | 'media' | 'baja' }> = [];

  if (mejorFranjaDia) {
    const pct = Math.round(mejorFranjaDia.score * 100);
    recommendations.push({
      text: `Los ${DIAS_ES[mejorFranjaDia.day]} sobre las ${fmtHora(mejorFranjaDia.hour)} suele haber una disponibilidad del ${pct}%.`,
      confidence: mejorFranjaDia.n >= 20 ? 'alta' : 'media',
    });
  }

  if (mejoresHoras.length >= 2) {
    const inicio = mejoresHoras[0].hour;
    const fin = (mejoresHoras[1].hour + 1) % 24;
    const pct = Math.round(((mejoresHoras[0].score + mejoresHoras[1].score) / 2) * 100);
    recommendations.push({
      text: `Mejor ventana general para cargar: entre ${fmtHora(inicio)} y ${fmtHora(fin)} (${pct}% de disponibilidad estimada).`,
      confidence: Math.min(mejoresHoras[0].n, mejoresHoras[1].n) >= 20 ? 'alta' : 'media',
    });
  }

  if (scoreNow !== null && scoreHourBase !== null) {
    const diff = Math.round((scoreNow - scoreHourBase) * 100);
    if (Math.abs(diff) >= 10) {
      recommendations.push({
        text: diff > 0
          ? `Ahora hay más disponibilidad de lo normal para esta hora (+${diff} puntos).`
          : `Ahora hay más ocupación de lo normal para esta hora (${diff} puntos).`,
        confidence: slotNow && slotNow.n >= 12 ? 'media' : 'baja',
      });
    }
  }

  return { recommendations: recommendations.slice(0, 5) };
}, {
  name: 'analytics-recommendations',
  maxAge: 3600,
  swr: true,
});
