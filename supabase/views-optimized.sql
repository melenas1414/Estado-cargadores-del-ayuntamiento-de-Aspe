-- ============================================================
-- views-optimized.sql
-- Funciones RPC de agregación en Postgres para reducir egress.
-- En lugar de descargar miles de filas crudas a Node.js,
-- estas funciones devuelven solo el resultado ya agregado.
--
-- INSTRUCCIONES: Ejecutar en Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- fn_heatmap_data
-- Reemplaza la descarga de 14.400+ filas brutas en heatmap.get.ts
-- Devuelve máximo 168 filas (7 días × 24 horas) ya agregadas.
-- p_dias = NULL → sin filtro temporal (desaconsejado)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_heatmap_data(
  p_dias       INT  DEFAULT 30,
  p_station_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  dia        INT,
  hora       INT,
  porcentaje NUMERIC,
  muestras   INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW  FROM created_at)::INT AS dia,
    EXTRACT(HOUR FROM created_at)::INT AS hora,
    ROUND(
      AVG(
        1.0 - LEAST(
          GREATEST(
            COALESCE(
              available_connectors::FLOAT,
              CASE WHEN is_available THEN 1.0 ELSE 0.0 END
            ),
            0.0
          ),
          GREATEST(COALESCE(total_connectors, 2), 1)::FLOAT
        ) / GREATEST(COALESCE(total_connectors, 2), 1)::FLOAT
      ) * 100
    )::NUMERIC                         AS porcentaje,
    COUNT(*)::INT                      AS muestras
  FROM charging_logs
  WHERE
    (p_dias IS NULL OR created_at >= NOW() - (p_dias::TEXT || ' days')::INTERVAL)
    AND (p_station_id IS NULL OR station_id = p_station_id)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

-- ------------------------------------------------------------
-- fn_availability_by_day_hour
-- Agrega disponibilidad media por (día_semana, hora).
-- Reemplaza descargas crudas de 26.900–43.200 filas en:
--   recommendations.get.ts, prediction.get.ts, eta.get.ts
-- Devuelve máximo 168 filas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_availability_by_day_hour(
  p_dias       INT  DEFAULT 30,
  p_station_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  day_of_week        INT,
  hour_of_day        INT,
  avg_disponibilidad NUMERIC,
  sample_count       INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW  FROM created_at)::INT AS day_of_week,
    EXTRACT(HOUR FROM created_at)::INT AS hour_of_day,
    AVG(
      LEAST(
        GREATEST(
          COALESCE(
            available_connectors::FLOAT,
            CASE WHEN is_available THEN 1.0 ELSE 0.0 END
          ),
          0.0
        ),
        GREATEST(COALESCE(total_connectors, 2), 1)::FLOAT
      ) / GREATEST(COALESCE(total_connectors, 2), 1)::FLOAT
    )::NUMERIC                         AS avg_disponibilidad,
    COUNT(*)::INT                      AS sample_count
  FROM charging_logs
  WHERE
    (p_dias IS NULL OR created_at >= NOW() - (p_dias::TEXT || ' days')::INTERVAL)
    AND (p_station_id IS NULL OR station_id = p_station_id)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

-- ------------------------------------------------------------
-- fn_eta_probability
-- Calcula la probabilidad histórica de encontrar cargadores libres
-- para cada combinación (día_semana, hora).
-- Reemplaza la descarga ilimitada de eta.get.ts.
-- Devuelve máximo 168 filas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_eta_probability(
  p_dias       INT  DEFAULT 30,
  p_station_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  day_of_week   INT,
  hour_of_day   INT,
  prob_libre    NUMERIC,
  prob_saturada NUMERIC,
  muestras      INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_snapshot AS (
    SELECT
      created_at,
      EXTRACT(DOW  FROM created_at)::INT AS dow,
      EXTRACT(HOUR FROM created_at)::INT AS hor,
      SUM(COALESCE(
        available_connectors,
        CASE WHEN is_available THEN 1 ELSE 0 END
      ))                                 AS total_free,
      SUM(COALESCE(total_connectors, 2)) AS total_conn
    FROM charging_logs
    WHERE
      (p_dias IS NULL OR created_at >= NOW() - (p_dias::TEXT || ' days')::INTERVAL)
      AND (p_station_id IS NULL OR station_id = p_station_id)
    GROUP BY created_at, dow, hor
  )
  SELECT
    dow,
    hor,
    ROUND(AVG(CASE WHEN total_free > 0 THEN 1.0 ELSE 0.0 END) * 100)::NUMERIC AS prob_libre,
    ROUND(AVG(CASE WHEN total_free <= 0 THEN 1.0 ELSE 0.0 END) * 100)::NUMERIC AS prob_saturada,
    COUNT(*)::INT AS muestras
  FROM per_snapshot
  GROUP BY dow, hor
  ORDER BY dow, hor;
$$;

-- ------------------------------------------------------------
-- fn_station_aggregates
-- Agrega métricas por estación para metrics.get.ts y rankings.get.ts.
-- Devuelve 1 fila por estación (típicamente 3-5 filas)
-- en lugar de 3.400+ filas crudas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_station_aggregates(
  p_dias       INT  DEFAULT 7,
  p_station_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  station_id          TEXT,
  location_name       TEXT,
  total_samples       INT,
  occupied_samples    INT,
  available_samples   INT,
  oos_samples         INT,
  avg_disponibilidad  NUMERIC,
  avg_ocupacion       NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    station_id,
    location_name,
    COUNT(*)::INT                                                           AS total_samples,
    COUNT(*) FILTER (WHERE
      COALESCE(available_connectors, CASE WHEN is_available THEN 1 ELSE 0 END) <= 0
      AND COALESCE(out_of_service_connectors, 0) = 0
    )::INT                                                                  AS occupied_samples,
    COUNT(*) FILTER (WHERE
      COALESCE(available_connectors, CASE WHEN is_available THEN 1 ELSE 0 END) > 0
    )::INT                                                                  AS available_samples,
    COUNT(*) FILTER (WHERE
      COALESCE(out_of_service_connectors, 0) > 0
    )::INT                                                                  AS oos_samples,
    ROUND(
      AVG(
        LEAST(
          GREATEST(
            COALESCE(
              available_connectors::FLOAT,
              CASE WHEN is_available THEN 1.0 ELSE 0.0 END
            ),
            0.0
          ),
          GREATEST(COALESCE(total_connectors, 2), 1)::FLOAT
        ) / GREATEST(COALESCE(total_connectors, 2), 1)::FLOAT
      ) * 100
    )::NUMERIC                                                              AS avg_disponibilidad,
    ROUND(
      AVG(
        1.0 - LEAST(
          GREATEST(
            COALESCE(
              available_connectors::FLOAT,
              CASE WHEN is_available THEN 1.0 ELSE 0.0 END
            ),
            0.0
          ),
          GREATEST(COALESCE(total_connectors, 2), 1)::FLOAT
        ) / GREATEST(COALESCE(total_connectors, 2), 1)::FLOAT
      ) * 100
    )::NUMERIC                                                              AS avg_ocupacion
  FROM charging_logs
  WHERE
    (p_dias IS NULL OR created_at >= NOW() - (p_dias::TEXT || ' days')::INTERVAL)
    AND (p_station_id IS NULL OR station_id = p_station_id)
  GROUP BY station_id, location_name
  ORDER BY avg_ocupacion DESC;
$$;

-- ------------------------------------------------------------
-- fn_eta_full
-- Para el widget ETA: dado un objetivo (día_semana, hora),
-- devuelve la probabilidad histórica a nivel municipal Y
-- por estación individual. Devuelve 4-6 filas (1 municipal + estaciones).
-- Reemplaza la descarga de TODOS los datos históricos sin límite.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_eta_full(
  p_target_dow  INT,
  p_target_hour INT,
  p_dias        INT DEFAULT 30
)
RETURNS TABLE(
  scope         TEXT,
  station_name  TEXT,
  prob_libre    NUMERIC,
  prob_saturada NUMERIC,
  muestras      INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Municipal: probabilidad de que exista AL MENOS UN conector libre
  WITH municipal AS (
    SELECT
      'municipal'::TEXT                                                          AS scope,
      'municipal'::TEXT                                                          AS station_name,
      ROUND(AVG(has_free::FLOAT) * 100)::NUMERIC                                AS prob_libre,
      ROUND((1.0 - AVG(has_free::FLOAT)) * 100)::NUMERIC                        AS prob_saturada,
      COUNT(*)::INT                                                              AS muestras
    FROM (
      SELECT
        created_at,
        CASE WHEN SUM(COALESCE(available_connectors,
          CASE WHEN is_available THEN 1 ELSE 0 END)) > 0 THEN 1 ELSE 0 END      AS has_free
      FROM charging_logs
      WHERE
        created_at >= NOW() - (p_dias::TEXT || ' days')::INTERVAL
        AND EXTRACT(DOW  FROM created_at)::INT = p_target_dow
        AND EXTRACT(HOUR FROM created_at)::INT = p_target_hour
      GROUP BY created_at
    ) snap
  ),
  -- Por estación: probabilidad de tener conectores libres
  per_station AS (
    SELECT
      station_id                                                                 AS scope,
      location_name                                                              AS station_name,
      ROUND(AVG(
        CASE WHEN COALESCE(available_connectors,
          CASE WHEN is_available THEN 1 ELSE 0 END) > 0 THEN 1.0 ELSE 0.0 END
      ) * 100)::NUMERIC                                                          AS prob_libre,
      ROUND((1.0 - AVG(
        CASE WHEN COALESCE(available_connectors,
          CASE WHEN is_available THEN 1 ELSE 0 END) > 0 THEN 1.0 ELSE 0.0 END
      )) * 100)::NUMERIC                                                         AS prob_saturada,
      COUNT(*)::INT                                                              AS muestras
    FROM charging_logs
    WHERE
      created_at >= NOW() - (p_dias::TEXT || ' days')::INTERVAL
      AND EXTRACT(DOW  FROM created_at)::INT = p_target_dow
      AND EXTRACT(HOUR FROM created_at)::INT = p_target_hour
    GROUP BY station_id, location_name
  )
  SELECT * FROM municipal
  UNION ALL
  SELECT * FROM per_station
  ORDER BY scope;
$$;

-- ------------------------------------------------------------
-- fn_days_with_data
-- Para prediction.get.ts: cuenta cuántos días distintos (calendario)
-- hay datos por día de la semana. Devuelve 7 filas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_days_with_data(
  p_dias       INT  DEFAULT 30,
  p_station_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  day_of_week   INT,
  distinct_days INT,
  total_samples INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW FROM created_at)::INT      AS day_of_week,
    COUNT(DISTINCT DATE(created_at))::INT  AS distinct_days,
    COUNT(*)::INT                          AS total_samples
  FROM charging_logs
  WHERE
    (p_dias IS NULL OR created_at >= NOW() - (p_dias::TEXT || ' days')::INTERVAL)
    AND (p_station_id IS NULL OR station_id = p_station_id)
  GROUP BY 1
  ORDER BY 1;
$$;

-- ------------------------------------------------------------
-- fn_session_metrics
-- Para metrics.get.ts: métricas por estación con conteo de sesiones
-- mediante LAG(). Devuelve 1 fila por estación (3-5 filas).
-- Reemplaza la descarga de 3.400+ filas crudas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_session_metrics(
  p_dias       INT  DEFAULT 7,
  p_station_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  station_id          TEXT,
  location_name       TEXT,
  total_samples       INT,
  occupied_samples    INT,
  sessions_estimated  INT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH lagged AS (
    SELECT
      station_id,
      location_name,
      is_available,
      LAG(is_available) OVER (PARTITION BY station_id ORDER BY created_at) AS prev_available
    FROM charging_logs
    WHERE
      (p_dias IS NULL OR created_at >= NOW() - (p_dias::TEXT || ' days')::INTERVAL)
      AND (p_station_id IS NULL OR station_id = p_station_id)
  )
  SELECT
    station_id,
    location_name,
    COUNT(*)::INT                                                         AS total_samples,
    COUNT(*) FILTER (WHERE NOT is_available)::INT                        AS occupied_samples,
    COUNT(*) FILTER (WHERE prev_available = TRUE AND NOT is_available)::INT AS sessions_estimated
  FROM lagged
  GROUP BY station_id, location_name
  ORDER BY sessions_estimated DESC;
$$;

-- Permisos para el rol anon (lectura desde el frontend si fuera necesario)
-- y para service_role (uso desde el backend Nitro).
GRANT EXECUTE ON FUNCTION public.fn_heatmap_data(INT, TEXT)              TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_availability_by_day_hour(INT, TEXT)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_eta_probability(INT, TEXT)           TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_station_aggregates(INT, TEXT)        TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_eta_full(INT, INT, INT)              TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_days_with_data(INT, TEXT)            TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_session_metrics(INT, TEXT)           TO anon, authenticated, service_role;
