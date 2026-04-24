-- =============================================================
-- Analytics predictivo — Window Functions
-- Ayuntamiento de Aspe · Cargadores EV
-- =============================================================
-- ⚠️  REQUISITOS:
--   1. schema.sql ya ejecutado
--   2. timescaledb.sql ya ejecutado (opcional pero recomendado)
--   3. Ejecutar en Supabase → SQL Editor
--   4. Puedes re-ejecutar para actualizar las vistas
-- =============================================================

-- ─── Limpiar vistas anteriores ───────────────────────────────
DROP VIEW IF EXISTS public.v_media_movil_1h        CASCADE;
DROP VIEW IF EXISTS public.v_disponibilidad_horas  CASCADE;
DROP VIEW IF EXISTS public.v_tendencia_diaria       CASCADE;
DROP VIEW IF EXISTS public.v_picos_demanda          CASCADE;
DROP VIEW IF EXISTS public.v_anomalias              CASCADE;
DROP VIEW IF EXISTS public.v_resumen_predictivo     CASCADE;

-- =============================================================
-- VISTA 1: Media móvil de disponibilidad (últimas 12 muestras ≈ 1h)
-- Suaviza los picos puntuales para ver la tendencia real
-- Uso: ¿está mejorando o empeorando la disponibilidad ahora mismo?
-- =============================================================
CREATE VIEW public.v_media_movil_1h AS
SELECT
  station_id,
  location_name,
  created_at,
  available_connectors,
  total_connectors,
  -- Media móvil: promedio de las últimas 12 muestras (12 × 5min = 1h)
  ROUND(
    AVG(available_connectors::float) OVER (
      PARTITION BY station_id
      ORDER BY created_at
      ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
    )::numeric,
    2
  ) AS media_movil_disponibles_1h,
  -- % disponibilidad actual
  ROUND(
    (available_connectors::float / NULLIF(total_connectors, 0) * 100)::numeric,
    1
  ) AS pct_disponibilidad,
  -- % media móvil
  ROUND(
    (AVG(available_connectors::float) OVER (
      PARTITION BY station_id
      ORDER BY created_at
      ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
    ) / NULLIF(AVG(total_connectors::float) OVER (
      PARTITION BY station_id
      ORDER BY created_at
      ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
    ), 0) * 100)::numeric,
    1
  ) AS pct_media_movil_1h
FROM public.charging_logs
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- =============================================================
-- VISTA 2: Disponibilidad histórica por hora del día y día de semana
-- Uso: predecir la mejor hora para cargar según patrón histórico
-- =============================================================
CREATE VIEW public.v_disponibilidad_horas AS
SELECT
  station_id,
  location_name,
  EXTRACT(DOW  FROM created_at AT TIME ZONE 'Europe/Madrid')::int AS dia_semana,   -- 0=dom, 1=lun ... 6=sab
  TO_CHAR(created_at AT TIME ZONE 'Europe/Madrid', 'Day')         AS nombre_dia,
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Madrid')::int AS hora,
  COUNT(*)                                                          AS muestras,
  ROUND(AVG(available_connectors::float)::numeric, 2)              AS media_disponibles,
  ROUND(AVG(total_connectors::float)::numeric, 2)                  AS media_total,
  ROUND(
    (AVG(available_connectors::float) / NULLIF(AVG(total_connectors::float), 0) * 100)::numeric,
    1
  )                                                                 AS pct_disponibilidad,
  -- Rango de variabilidad (cuánto varía la disponibilidad en esa franja)
  ROUND(STDDEV(available_connectors::float)::numeric, 2)           AS desviacion_tipica,
  -- Percentil 25 y 75 (rango intercuartil)
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY available_connectors::float) AS p25_disponibles,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY available_connectors::float) AS p75_disponibles
FROM public.charging_logs
WHERE
  available_connectors IS NOT NULL
  AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY station_id, location_name, dia_semana, nombre_dia, hora
ORDER BY station_id, dia_semana, hora;

-- =============================================================
-- VISTA 3: Tendencia diaria (¿hoy está mejor o peor que ayer?)
-- Compara la disponibilidad media de hoy vs. los últimos 7 días
-- =============================================================
CREATE VIEW public.v_tendencia_diaria AS
WITH diario AS (
  SELECT
    station_id,
    location_name,
    DATE(created_at AT TIME ZONE 'Europe/Madrid')          AS fecha,
    ROUND(AVG(available_connectors::float)::numeric, 2)    AS media_disponibles,
    ROUND(
      (AVG(available_connectors::float) / NULLIF(AVG(total_connectors::float), 0) * 100)::numeric,
      1
    )                                                       AS pct_disponibilidad,
    COUNT(*)                                                AS muestras
  FROM public.charging_logs
  WHERE
    available_connectors IS NOT NULL
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY station_id, location_name, fecha
)
SELECT
  station_id,
  location_name,
  fecha,
  media_disponibles,
  pct_disponibilidad,
  muestras,
  -- Comparación con el día anterior
  LAG(pct_disponibilidad, 1) OVER (PARTITION BY station_id ORDER BY fecha) AS pct_dia_anterior,
  ROUND(
    pct_disponibilidad - LAG(pct_disponibilidad, 1) OVER (PARTITION BY station_id ORDER BY fecha),
    1
  ) AS variacion_vs_ayer,
  -- Media móvil de 7 días
  ROUND(
    AVG(pct_disponibilidad) OVER (
      PARTITION BY station_id
      ORDER BY fecha
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    )::numeric,
    1
  ) AS media_movil_7d,
  -- Tendencia: MEJORANDO / ESTABLE / EMPEORANDO
  CASE
    WHEN pct_disponibilidad > LAG(pct_disponibilidad, 1) OVER (PARTITION BY station_id ORDER BY fecha) + 5 THEN 'MEJORANDO'
    WHEN pct_disponibilidad < LAG(pct_disponibilidad, 1) OVER (PARTITION BY station_id ORDER BY fecha) - 5 THEN 'EMPEORANDO'
    ELSE 'ESTABLE'
  END AS tendencia
FROM diario
ORDER BY station_id, fecha DESC;

-- =============================================================
-- VISTA 4: Picos de demanda (franjas de máxima ocupación)
-- Uso: detectar las horas donde la red está más presionada
-- =============================================================
CREATE VIEW public.v_picos_demanda AS
SELECT
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Madrid')::int AS hora,
  TO_CHAR(created_at AT TIME ZONE 'Europe/Madrid', 'Day')          AS dia_semana,
  EXTRACT(DOW FROM created_at AT TIME ZONE 'Europe/Madrid')::int   AS num_dia,
  COUNT(*)                                                          AS total_muestras,
  SUM(CASE WHEN NOT is_available THEN 1 ELSE 0 END)                AS muestras_ocupado,
  ROUND(
    SUM(CASE WHEN NOT is_available THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) * 100,
    1
  )                                                                 AS pct_ocupacion,
  COUNT(DISTINCT station_id)                                        AS estaciones_monitorizadas,
  -- Rank de horas más ocupadas de la semana
  RANK() OVER (
    PARTITION BY EXTRACT(DOW FROM created_at AT TIME ZONE 'Europe/Madrid')
    ORDER BY
      SUM(CASE WHEN NOT is_available THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0) DESC
  ) AS rank_ocupacion_dia
FROM public.charging_logs
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY hora, dia_semana, num_dia
ORDER BY num_dia, pct_ocupacion DESC;

-- =============================================================
-- VISTA 5: Detección de anomalías
-- Identifica registros donde la disponibilidad se aleja >2σ de la media
-- Uso: detectar averías, cortes o comportamientos inusuales
-- =============================================================
CREATE VIEW public.v_anomalias AS
WITH stats AS (
  SELECT
    station_id,
    EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Madrid')::int AS hora,
    AVG(available_connectors::float)                                 AS media,
    STDDEV(available_connectors::float)                              AS stddev
  FROM public.charging_logs
  WHERE
    available_connectors IS NOT NULL
    AND created_at >= NOW() - INTERVAL '90 days'
  GROUP BY station_id, hora
)
SELECT
  l.id,
  l.created_at,
  l.station_id,
  l.location_name,
  l.available_connectors,
  l.total_connectors,
  ROUND(s.media::numeric, 2)        AS media_historica,
  ROUND(s.stddev::numeric, 2)       AS stddev_historica,
  ROUND(
    ABS(l.available_connectors - s.media) / NULLIF(s.stddev, 0),
    2
  )                                 AS z_score,
  CASE
    WHEN s.stddev > 0
      AND ABS(l.available_connectors - s.media) > 2 * s.stddev THEN 'ANOMALIA'
    ELSE 'NORMAL'
  END                               AS estado
FROM public.charging_logs l
JOIN stats s
  ON l.station_id = s.station_id
  AND EXTRACT(HOUR FROM l.created_at AT TIME ZONE 'Europe/Madrid')::int = s.hora
WHERE
  l.available_connectors IS NOT NULL
  AND l.created_at >= NOW() - INTERVAL '7 days'
  AND s.stddev > 0
  AND ABS(l.available_connectors - s.media) > 2 * s.stddev
ORDER BY l.created_at DESC;

-- =============================================================
-- VISTA 6: Resumen predictivo (vista de alto nivel para el dashboard)
-- Combina disponibilidad actual + predicción próxima hora
-- =============================================================
CREATE VIEW public.v_resumen_predictivo AS
WITH actual AS (
  SELECT DISTINCT ON (station_id)
    station_id,
    location_name,
    available_connectors,
    total_connectors,
    is_available,
    created_at AS ultima_muestra
  FROM public.charging_logs
  ORDER BY station_id, created_at DESC
),
proxima_hora AS (
  SELECT
    station_id,
    ROUND(
      AVG(available_connectors::float) / NULLIF(AVG(total_connectors::float), 0) * 100,
      1
    ) AS pct_predicho_proxima_hora
  FROM public.charging_logs
  WHERE
    available_connectors IS NOT NULL
    AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Madrid')::int
        = EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Europe/Madrid') + INTERVAL '1 hour')::int
    AND EXTRACT(DOW FROM created_at AT TIME ZONE 'Europe/Madrid')
        = EXTRACT(DOW FROM NOW() AT TIME ZONE 'Europe/Madrid')
    AND created_at >= NOW() - INTERVAL '60 days'
  GROUP BY station_id
),
tendencia AS (
  SELECT DISTINCT ON (station_id)
    station_id,
    tendencia,
    variacion_vs_ayer
  FROM public.v_tendencia_diaria
  ORDER BY station_id, fecha DESC
)
SELECT
  a.station_id,
  a.location_name,
  a.available_connectors,
  a.total_connectors,
  a.is_available,
  a.ultima_muestra,
  ROUND(
    (a.available_connectors::float / NULLIF(a.total_connectors, 0) * 100)::numeric,
    1
  )                                          AS pct_actual,
  p.pct_predicho_proxima_hora,
  CASE
    WHEN p.pct_predicho_proxima_hora >= 70 THEN 'LIBRE'
    WHEN p.pct_predicho_proxima_hora >= 40 THEN 'PARCIAL'
    WHEN p.pct_predicho_proxima_hora IS NOT NULL THEN 'SATURADO'
    ELSE 'SIN_DATOS'
  END                                        AS prediccion_proxima_hora,
  t.tendencia,
  t.variacion_vs_ayer
FROM actual a
LEFT JOIN proxima_hora p ON a.station_id = p.station_id
LEFT JOIN tendencia    t ON a.station_id = t.station_id
ORDER BY a.station_id;

-- ─── RLS: lectura pública en todas las vistas ─────────────────
-- Las vistas heredan RLS de charging_logs, pero por claridad:
GRANT SELECT ON public.v_media_movil_1h        TO anon, authenticated;
GRANT SELECT ON public.v_disponibilidad_horas  TO anon, authenticated;
GRANT SELECT ON public.v_tendencia_diaria      TO anon, authenticated;
GRANT SELECT ON public.v_picos_demanda         TO anon, authenticated;
GRANT SELECT ON public.v_anomalias             TO anon, authenticated;
GRANT SELECT ON public.v_resumen_predictivo    TO anon, authenticated;

-- ─── Verificación ─────────────────────────────────────────────
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_%'
ORDER BY table_name;
