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
  created_at: string;
  is_available: boolean;
  available_connectors: number | null;
  total_connectors: number | null;
};

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

function parsePeriodo(raw: unknown): number | null {
  const periodo = String(raw ?? '30d');
  if (!Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, periodo)) return 30;
  return DIAS_POR_PERIODO[periodo];
}

function occupancyRatio(row: Row): number {
  const total = typeof row.total_connectors === 'number' && row.total_connectors > 0 ? row.total_connectors : 2;
  
  // Preferir available_connectors si es un número válido (≥ 0)
  let free = 0;
  if (typeof row.available_connectors === 'number' && row.available_connectors >= 0) {
    free = row.available_connectors;
  } else if (row.is_available) {
    // Fallback: si is_available es true, asumir 1 conector libre de total
    free = 1;
  } else {
    // Si is_available es false, asumir que está completamente ocupado
    free = 0;
  }
  
  const freeSafe = Math.max(0, Math.min(total, free));
  return total > 0 ? (1 - freeSafe / total) : 0;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const stationId = parseStationId(query.station_id);
  const dias = parsePeriodo(query.periodo);

  const supabase = await serverSupabaseClient(event);

  let queryLogs = supabase
    .from('charging_logs')
    .select('created_at, is_available, available_connectors, total_connectors')
    .order('created_at', { ascending: true });

  if (dias !== null) {
    const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    queryLogs = queryLogs.gte('created_at', since);
  }

  if (stationId) {
    queryLogs = queryLogs.eq('station_id', stationId);
  }

  const { data, error } = await queryLogs;
  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al calcular ocupacion por dia: ${error.message}`,
    });
  }

  const rows = (data ?? []) as Row[];
  
  // Si no hay datos específicos del cargador, intentar con datos globales
  let finalRows = rows;
  if (rows.length === 0 && stationId) {
    let fallbackQuery = supabase
      .from('charging_logs')
      .select('created_at, is_available, available_connectors, total_connectors')
      .order('created_at', { ascending: true });
    
    if (dias !== null) {
      const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
      fallbackQuery = fallbackQuery.gte('created_at', since);
    }
    
    const { data: fallbackData } = await fallbackQuery;
    finalRows = (fallbackData ?? []) as Row[];
  }

  // Agrupar por FECHA DEL CALENDARIO (no por día de semana)
  const accByDate: Record<string, { occ: number; samples: number }> = {};

  for (const row of finalRows) {
    const date = new Date(row.created_at);
    const dateKey = date.toISOString().slice(0, 10); // Formato YYYY-MM-DD
    
    if (!accByDate[dateKey]) {
      accByDate[dateKey] = { occ: 0, samples: 0 };
    }
    
    accByDate[dateKey].occ += occupancyRatio(row);
    accByDate[dateKey].samples += 1;
  }

  // Convertir a array ordenado por fecha
  const sortedDates = Object.keys(accByDate).sort();
  
  // Si estamos viendo por día de semana (sin período específico o período largo), agrupar por día de semana
  // Si no, mostrar por fecha calendario
  const points = sortedDates.map((dateStr) => {
    const date = new Date(dateStr);
    const item = accByDate[dateStr];
    const dayIndex = date.getDay();
    
    return {
      dateStr,
      dayIndex,
      dayLabel: DIAS_ES[dayIndex],
      dateLabel: formatDateForDisplay(dateStr),
      occupancyPct: item.samples ? Math.round((item.occ / item.samples) * 100) : 0,
      samples: item.samples,
    };
  });

  return {
    periodoDias: dias,
    stationId,
    points,
    totalSamples: finalRows.length,
    usedFallback: rows.length === 0 && stationId,
  };
});

function formatDateForDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${day} ${monthNames[parseInt(month) - 1]}`;
}
