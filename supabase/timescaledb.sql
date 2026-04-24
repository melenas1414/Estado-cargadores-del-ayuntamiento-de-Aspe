-- =============================================================
-- TimescaleDB — Configuración para charging_logs
-- Ayuntamiento de Aspe · Cargadores EV
-- =============================================================
-- ⚠️  REQUISITOS:
--   1. schema.sql ya ejecutado (tabla charging_logs existente)
--   2. Ejecutar en Supabase → SQL Editor
--   3. Ejecutar UNA SOLA VEZ
-- =============================================================

-- ─── 1. Activar extensión ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ─── 2. Convertir en hypertable ──────────────────────────────
-- Particiona por created_at en chunks de 7 días.
-- migrate_data: TRUE migra los datos existentes automáticamente.
SELECT create_hypertable(
  'public.charging_logs',
  'created_at',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists       => TRUE,
  migrate_data        => TRUE
);

-- ─── 3. Índice optimizado para TimescaleDB ───────────────────
-- Maximiza la velocidad de consultas por estación + rango de tiempo
CREATE INDEX IF NOT EXISTS idx_tsl_station_time
  ON public.charging_logs (station_id, created_at DESC);

-- ─── 4. Compresión automática ────────────────────────────────
-- Chunks con más de 30 días se comprimen automáticamente.
-- Reducción típica: 80–90% del espacio en disco.
ALTER TABLE public.charging_logs SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'station_id',
  timescaledb.compress_orderby   = 'created_at DESC'
);

SELECT add_compression_policy(
  'public.charging_logs',
  INTERVAL '30 days',
  if_not_exists => TRUE
);

-- ─── 5. Retención de datos (opcional) ────────────────────────
-- Descomenta para eliminar automáticamente registros > 2 años:
-- SELECT add_retention_policy(
--   'public.charging_logs',
--   INTERVAL '2 years',
--   if_not_exists => TRUE
-- );

-- ─── 6. Verificación ─────────────────────────────────────────
SELECT
  hypertable_name,
  num_chunks,
  compression_enabled
FROM timescaledb_information.hypertables
WHERE hypertable_name = 'charging_logs';
