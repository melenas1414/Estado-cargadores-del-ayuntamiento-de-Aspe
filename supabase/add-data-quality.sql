-- =============================================================
-- Migración: columna data_quality en charging_logs
-- Ayuntamiento de Aspe · Cargadores EV
-- =============================================================
-- Ejecutar UNA SOLA VEZ en Supabase → SQL Editor
-- =============================================================

-- Añadir columna source si no existe (registra el origen del dato)
ALTER TABLE public.charging_logs
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Añadir columna data_quality con valor por defecto 'observed'
ALTER TABLE public.charging_logs
  ADD COLUMN IF NOT EXISTS data_quality TEXT NOT NULL DEFAULT 'observed';

-- Actualizar registros estimados existentes según el campo source
-- (los insertados con source que empiece por 'estimated-')
UPDATE public.charging_logs
SET data_quality = 'estimated'
WHERE source LIKE 'estimated-%';

-- Comentario de columna
COMMENT ON COLUMN public.charging_logs.data_quality IS
  'Calidad del dato: "observed" = dato real de Google Places, "estimated" = estimación por ratio de red';

-- Índice para filtrar analytics solo con datos reales
CREATE INDEX IF NOT EXISTS idx_charging_logs_data_quality
  ON public.charging_logs (data_quality, station_id, created_at DESC);

-- Verificar distribución
SELECT data_quality, COUNT(*) AS registros
FROM public.charging_logs
GROUP BY data_quality
ORDER BY data_quality;
