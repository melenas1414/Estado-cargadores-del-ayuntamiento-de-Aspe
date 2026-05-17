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

// Función auxiliar para paginar y traer todos los datos
async function fetchAllRows(supabase: any, baseQuery: any, pageSize: number = 1000): Promise<Row[]> {
  let allRows: Row[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await baseQuery.range(offset, offset + pageSize - 1);
    
    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Error al obtener datos: ${error.message}`,
      });
    }
    
    const rows = (data ?? []) as Row[];
    allRows = allRows.concat(rows);
    
    if (rows.length < pageSize) {
      hasMore = false;
    } else {
      offset += pageSize;
    }
  }
  
  return allRows;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const stationId = parseStationId(query.station_id);
  const dias = parsePeriodo(query.periodo);

  const supabase = await serverSupabaseClient(event);

  // Construir query base sin aplicar limit/offset aún
  const buildQuery = () => {
    let q = supabase
      .from('charging_logs')
      .select('created_at, is_available, available_connectors, total_connectors')
      .order('created_at', { ascending: true });

    if (dias !== null) {
      const now = new Date();
      const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dias, 0, 0, 0, 0));
      const since = startDate.toISOString();
      q = q.gte('created_at', since);
    }

    if (stationId) {
      q = q.eq('station_id', stationId);
    }

    return q;
  };

  // Obtener todos los datos paginando
  let finalRows = await fetchAllRows(supabase, buildQuery());
  
  // Si no hay datos específicos del cargador, intentar con datos globales
  if (finalRows.length === 0 && stationId) {
    const buildFallbackQuery = () => {
      let q = supabase
        .from('charging_logs')
        .select('created_at, is_available, available_connectors, total_connectors')
        .order('created_at', { ascending: true });

      if (dias !== null) {
        const now = new Date();
        const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dias, 0, 0, 0, 0));
        const since = startDate.toISOString();
        q = q.gte('created_at', since);
      }

      return q;
    };

    finalRows = await fetchAllRows(supabase, buildFallbackQuery());
  }

  // Agrupar por DÍA DE SEMANA (solo datos del período solicitado)
  const accByWeekday: Record<number, { occ: number; samples: number }> = {};
  
  for (let day = 0; day < 7; day++) {
    accByWeekday[day] = { occ: 0, samples: 0 };
  }
  
  for (const row of finalRows) {
    const date = new Date(row.created_at);
    const dayIndex = date.getUTCDay(); // UTC para consistencia
    const occupancyRatioValue = occupancyRatio(row);
    accByWeekday[dayIndex].occ += occupancyRatioValue;
    accByWeekday[dayIndex].samples += 1;
  }
  
  // Crear puntos ordenados por día de semana
  const points = Array.from({ length: 7 }, (_, dayIndex) => {
    const item = accByWeekday[dayIndex];
    
    return {
      dayIndex,
      dayLabel: DIAS_ES[dayIndex],
      occupancyPct: item.samples ? Math.round((item.occ / item.samples) * 100) : 0,
      samples: item.samples,
    };
  });

  return {
    periodoDias: dias,
    stationId,
    points,
    totalSamples: finalRows.length,
    usedFallback: false,
  };
});
