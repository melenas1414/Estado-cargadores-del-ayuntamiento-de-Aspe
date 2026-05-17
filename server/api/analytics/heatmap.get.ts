/**
 * GET /api/analytics/heatmap?periodo=7d|30d|today|all&station_id=...
 *
 * Devuelve una matriz de ocupación agrupada por día de la semana (0=Dom…6=Sáb)
 * y hora del día (0-23), expresada como porcentaje de ocupación (0-100).
 *
 * Estructura de respuesta:
 * {
 *   points: [
 *     { dia: 1, hora: 8, porcentaje: 75 },
 *     …
 *   ]
 * }
 */
import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';

const DIAS_POR_PERIODO: Record<string, number | null> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  all: null,
};

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
  
  let free = 0;
  if (typeof row.available_connectors === 'number' && row.available_connectors >= 0) {
    free = row.available_connectors;
  } else if (row.is_available) {
    free = 1;
  } else {
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

  // Agrupar por día de semana + hora
  const accByWeekdayHour: Record<string, { occ: number; samples: number }> = {};

  for (const row of finalRows) {
    const date = new Date(row.created_at);
    const dayIndex = date.getUTCDay(); // 0 = domingo, 6 = sábado
    const hour = date.getUTCHours();
    const key = `${dayIndex}-${hour}`;
    
    if (!accByWeekdayHour[key]) {
      accByWeekdayHour[key] = { occ: 0, samples: 0 };
    }
    
    accByWeekdayHour[key].occ += occupancyRatio(row);
    accByWeekdayHour[key].samples += 1;
  }

  // Crear puntos del heatmap (7 días × 24 horas)
  const points: any[] = [];

  for (let dia = 0; dia < 7; dia++) {
    for (let hora = 0; hora < 24; hora++) {
      const key = `${dia}-${hora}`;
      const item = accByWeekdayHour[key] ?? { occ: 0, samples: 0 };
      
      points.push({
        dia,
        hora,
        porcentaje: item.samples ? Math.round((item.occ / item.samples) * 100) : -1, // -1 = sin datos
      });
    }
  }

  return {
    periodoDias: dias,
    stationId,
    datos: points,
    totalSamples: finalRows.length,
    usedFallback: false,
  };
});
