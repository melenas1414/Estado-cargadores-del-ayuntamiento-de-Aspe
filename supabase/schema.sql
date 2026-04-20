-- =============================================================
-- Esquema de Base de Datos — Cargadores EV Ayuntamiento de Aspe
-- Motor: Supabase (PostgreSQL)
-- =============================================================

-- ─── Tabla principal de registros ────────────────────────────
CREATE TABLE IF NOT EXISTS public.charging_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW()             NOT NULL,
  station_id   TEXT                                  NOT NULL,
  location_name TEXT                                 NOT NULL,
  is_available BOOLEAN                               NOT NULL,
  power_kw     INT         DEFAULT 22                NOT NULL,
  available_connectors INT,
  total_connectors     INT
);

-- Asegura columnas nuevas en instalaciones ya creadas
ALTER TABLE public.charging_logs
  ADD COLUMN IF NOT EXISTS available_connectors INT,
  ADD COLUMN IF NOT EXISTS total_connectors INT;

-- ─── Índices para consultas frecuentes ───────────────────────
CREATE INDEX IF NOT EXISTS idx_charging_logs_station_id
  ON public.charging_logs (station_id);

CREATE INDEX IF NOT EXISTS idx_charging_logs_created_at
  ON public.charging_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_charging_logs_station_created
  ON public.charging_logs (station_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_charging_logs_available
  ON public.charging_logs (is_available, created_at DESC);

-- ─── Seguridad a nivel de fila (RLS) ─────────────────────────
ALTER TABLE public.charging_logs ENABLE ROW LEVEL SECURITY;

-- Lectura pública (sin autenticación requerida)
CREATE POLICY "Permitir lectura pública"
  ON public.charging_logs
  FOR SELECT
  USING (true);

-- Inserción restringida al rol de servicio (GitHub Actions / scraper)
CREATE POLICY "Permitir inserción al servicio"
  ON public.charging_logs
  FOR INSERT
  WITH CHECK (true);

-- ─── Vista de último estado de cada estación ─────────────────
CREATE OR REPLACE VIEW public.charger_current_status AS
SELECT DISTINCT ON (station_id)
  id,
  created_at,
  station_id,
  location_name,
  is_available,
  power_kw,
  available_connectors,
  total_connectors
FROM public.charging_logs
ORDER BY station_id, created_at DESC;

-- ─── Comentarios de columnas ──────────────────────────────────
COMMENT ON TABLE  public.charging_logs          IS 'Histórico de estados de los cargadores EV de Aspe';
COMMENT ON COLUMN public.charging_logs.id           IS 'Identificador único del registro';
COMMENT ON COLUMN public.charging_logs.created_at   IS 'Fecha y hora en que se tomó la muestra (UTC)';
COMMENT ON COLUMN public.charging_logs.station_id   IS 'ID de la estación de carga según la red Iberdrola';
COMMENT ON COLUMN public.charging_logs.location_name IS 'Nombre descriptivo de la ubicación física';
COMMENT ON COLUMN public.charging_logs.is_available  IS 'TRUE = libre para cargar, FALSE = ocupado';
COMMENT ON COLUMN public.charging_logs.power_kw      IS 'Potencia del cargador en kW (siempre 22 para esta red)';
COMMENT ON COLUMN public.charging_logs.available_connectors IS 'Número de conectores disponibles en la muestra';
COMMENT ON COLUMN public.charging_logs.total_connectors     IS 'Número total de conectores detectados en la estación';
