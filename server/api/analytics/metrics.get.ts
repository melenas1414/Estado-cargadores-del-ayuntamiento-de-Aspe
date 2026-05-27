/**
 * GET /api/analytics/metrics?periodo=today|7d|30d|all
 *
 * Devuelve métricas de uso agregadas:
 * - Tasa media de ocupación (% del tiempo con al menos un cargador ocupado)
 * - Número total de sesiones de carga estimadas
 * - Disponibilidad actual (cargadores libres ahora)
 * - Cargador más usado
 */
import { serverSupabaseClient } from '#supabase/server';

const DIAS_POR_PERIODO: Record<string, number | null> = {
  today: 1,
  '7d':  7,
  '30d': 30,
  all: null,
};

type LogRow = {
  station_id: string;
  location_name: string;
  is_available: boolean;
  created_at: string;
};

function parseStationId(raw: unknown): string | null {
  const stationId = String(raw ?? '').trim();
  if (!stationId || stationId === 'all') return null;
  return stationId;
}

// Función auxiliar para paginar y traer todos los datos
async function fetchAllRows(supabase: any, baseQuery: any, pageSize: number = 1000): Promise<LogRow[]> {
  let allRows: LogRow[] = [];
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
    
    const rows = (data ?? []) as LogRow[];
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
  export default defineCachedEventHandler(async (event) => {
  }, {
    name: 'analytics-metrics',
    maxAge: 3600,
    swr: true,
  });
  const query   = getQuery(event);
  const periodo = String(query.periodo ?? '7d');
  const dias = Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, periodo)
    ? DIAS_POR_PERIODO[periodo]
    : 7;
  const stationId = parseStationId(query.station_id);

  const supabase = await serverSupabaseClient(event);
  const desde = dias === null
    ? null
    : new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  // ─── Obtener todos los registros del período (con paginación) ─────────
  const buildQuery = () => {
    let q = supabase
      .from('charging_logs')
      .select('station_id, location_name, is_available, created_at')
      .order('created_at', { ascending: true });

    if (desde) {
      q = q.gte('created_at', desde.toISOString());
    }

    if (stationId) {
      q = q.eq('station_id', stationId);
    }

    return q;
  };

  const registros = await fetchAllRows(supabase, buildQuery());

  if (!registros.length) {
    return {
      tasaOcupacionMedia: 0,
      sesionesEstimadas:  0,
      minutosOcupadosMedio: 0,
      cargadorMasUsado:  null,
      porEstacion:       [],
    };
  }

  // ─── Calcular métricas por estación ────────────────────────────────────
  const porEstacion: Record<
    string,
    { nombre: string; total: number; ocupados: number; sesiones: number; prevDisponible: boolean | null }
  > = {};

  for (const fila of registros) {
    if (!porEstacion[fila.station_id]) {
      porEstacion[fila.station_id] = {
        nombre:         fila.location_name,
        total:          0,
        ocupados:       0,
        sesiones:       0,
        prevDisponible: null,
      };
    }

    const est = porEstacion[fila.station_id];
    est.total++;
    if (!fila.is_available) est.ocupados++;

    // Contar transiciones disponible → ocupado como "inicio de sesión"
    if (est.prevDisponible === true && !fila.is_available) {
      est.sesiones++;
    }
    est.prevDisponible = fila.is_available;
  }

  // ─── Agregar resultados ─────────────────────────────────────────────────
  const estadisticas = Object.entries(porEstacion).map(([id, est]) => ({
    station_id:          id,
    location_name:       est.nombre,
    tasaOcupacion:       est.total > 0 ? Math.round((est.ocupados / est.total) * 100) : 0,
    sesionesEstimadas:   est.sesiones,
    // Con muestras cada 15 min, cada sesión dura aprox. (ocupados/sesiones)*15 minutos
    minutosPorSesion:    est.sesiones > 0
      ? Math.round((est.ocupados / est.sesiones) * 15)
      : 0,
  }));

  const tasaMedia = estadisticas.length
    ? Math.round(estadisticas.reduce((s, e) => s + e.tasaOcupacion, 0) / estadisticas.length)
    : 0;

  const totalSesiones = estadisticas.reduce((s, e) => s + e.sesionesEstimadas, 0);

  const minutosOcupadosMedio = estadisticas.length
    ? Math.round(estadisticas.reduce((s, e) => s + e.minutosPorSesion, 0) / estadisticas.length)
    : 0;

  const cargadorMasUsado = estadisticas.length
    ? estadisticas.reduce((a, b) => (a.sesionesEstimadas >= b.sesionesEstimadas ? a : b))
    : null;

  return {
    tasaOcupacionMedia:   tasaMedia,
    sesionesEstimadas:    totalSesiones,
    minutosOcupadosMedio,
    cargadorMasUsado,
    porEstacion:          estadisticas,
  };
});
