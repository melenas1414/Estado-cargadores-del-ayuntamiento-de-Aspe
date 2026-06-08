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

  const rawRows = Array.isArray(data) ? data : [];
  if (rawRows.length === 0) {
    return { recommendations: [] };
  }

  // Reconstruir byHour y byDayHour desde datos ya agregados
  const byHour = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
  const byDayHour = new Map<string, { sum: number; n: number }>();

  for (const row of rawRows) {
    if (!row || typeof row !== 'object') continue;

    const r = row as Partial<AggRow>;
    const dayOfWeek = r.day_of_week;
    const hourOfDay = r.hour_of_day;
    const avgDisp = r.avg_disponibilidad;
    const sampleCount = r.sample_count;

    if (
      dayOfWeek === undefined || dayOfWeek === null ||
      hourOfDay === undefined || hourOfDay === null ||
      avgDisp === undefined || avgDisp === null ||
      sampleCount === undefined || sampleCount === null
    ) {
      continue;
    }

    const disp = Number(avgDisp);
    const n = Number(sampleCount);

    // Acceso seguro a byHour
    const hourSlot = byHour[hourOfDay];
    if (hourSlot !== undefined && hourSlot !== null) {
      hourSlot.sum += disp * n;
      hourSlot.n += n;
    }

    const key = `${dayOfWeek}-${hourOfDay}`;
    let item = byDayHour.get(key);
    if (item === undefined) {
      item = { sum: 0, n: 0 };
      byDayHour.set(key, item);
    }
    item.sum += disp * n;
    item.n += n;
  }

  const mejoresHoras = byHour
    .map((x, hour) => {
      const sumValue = x.sum;
      const nCount = x.n;
      const score = nCount > 0 ? sumValue / nCount : 0;
      return { hour, score, n: nCount };
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const franjasMapeadas = Array.from(byDayHour.entries())
    .map(([key, value]) => {
      const parts = key.split('-').map(Number);
      const day = parts[0] !== undefined ? parts[0] : 0;
      const hour = parts[1] !== undefined ? parts[1] : 0;
      const sumValue = value.sum;
      const nCount = value.n;
      const score = nCount > 0 ? sumValue / nCount : 0;
      return { day, hour, score, n: nCount };
    })
    .filter((x) => x.n >= 4)
    .sort((a, b) => b.score - a.score);

  const mejorFranjaDia = franjasMapeadas.length > 0 ? franjasMapeadas[0] : null;

  const now = new Date();
  const nowDay = now.getDay();
  const nowHour = now.getHours();
  const keyNow = `${nowDay}-${nowHour}`;
  const slotNow = byDayHour.get(keyNow);
  
  const scoreNow = (slotNow !== undefined && slotNow !== null && slotNow.n > 0)
    ? slotNow.sum / slotNow.n
    : null;

  const hourSlotNow = byHour[nowHour];
  const scoreHourBase = (hourSlotNow !== undefined && hourSlotNow !== null && hourSlotNow.n > 0)
    ? hourSlotNow.sum / hourSlotNow.n
    : null;

  const recommendations: Array<{ text: string; confidence: 'alta' | 'media' | 'baja' }> = [];

  if (mejorFranjaDia !== null && mejorFranjaDia !== undefined) {
    const dayIndex = mejorFranjaDia.day;
    const dayName = DIAS_ES[dayIndex];
    if (dayName !== undefined && dayName !== null) {
      const pct = Math.round(mejorFranjaDia.score * 100);
      const confidenceLevel = mejorFranjaDia.n >= 20 ? ('alta' as const) : ('media' as const);
      recommendations.push({
        text: `Los ${dayName} sobre las ${fmtHora(mejorFranjaDia.hour)} suele haber una disponibilidad del ${pct}%.`,
        confidence: confidenceLevel,
      });
    }
  }

  const m0 = mejoresHoras[0];
  const m1 = mejoresHoras[1];
  if (m0 !== undefined && m0 !== null && m1 !== undefined && m1 !== null) {
    const inicio = m0.hour;
    const fin = (m1.hour + 1) % 24;
    const pct = Math.round(((m0.score + m1.score) / 2) * 100);
    const confidenceLevel = Math.min(m0.n, m1.n) >= 20 ? ('alta' as const) : ('media' as const);
    recommendations.push({
      text: `Mejor ventana general para cargar: entre ${fmtHora(inicio)} y ${fmtHora(fin)} (${pct}% de disponibilidad estimada).`,
      confidence: confidenceLevel,
    });
  }

  if (scoreNow !== null && scoreHourBase !== null && slotNow !== undefined && slotNow !== null) {
    const diff = Math.round((scoreNow - scoreHourBase) * 100);
    if (Math.abs(diff) >= 10) {
      const confidenceLevel = slotNow.n >= 12 ? ('media' as const) : ('baja' as const);
      recommendations.push({
        text: diff > 0
          ? `Ahora hay más disponibilidad de lo normal para esta hora (+${diff} puntos).`
          : `Ahora hay más ocupación de lo normal para esta hora (${diff} puntos).`,
        confidence: confidenceLevel,
      });
    }
  }

  return { recommendations: recommendations.slice(0, 5) };
}, {
  name: 'analytics-recommendations',
  maxAge: 600,
  swr: true,
});
