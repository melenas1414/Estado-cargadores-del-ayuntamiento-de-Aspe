-- =============================================================
-- Esquema de Base de Datos — Cargadores EV Ayuntamiento de Aspe
-- Motor: Supabase (PostgreSQL)
-- =============================================================

-- ─── Limpiar esquema anterior (despliegue de 0) ──────────────
DROP VIEW IF EXISTS public.charger_current_status CASCADE;
DROP TABLE IF EXISTS public.charging_logs CASCADE;

-- ─── Tabla principal de registros ────────────────────────────
CREATE TABLE public.charging_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW()             NOT NULL,
  station_id   TEXT                                  NOT NULL,
  location_name TEXT                                 NOT NULL,
  is_available BOOLEAN                               NOT NULL,
  power_kw     NUMERIC(10,2) DEFAULT 22             NOT NULL,
  available_connectors INT,
  total_connectors     INT,
  out_of_service_connectors INT,
  availability_updated_at TIMESTAMPTZ
);

-- ─── Índices para consultas frecuentes ───────────────────────
CREATE INDEX idx_charging_logs_station_id
  ON public.charging_logs (station_id);

CREATE INDEX idx_charging_logs_created_at
  ON public.charging_logs (created_at DESC);

CREATE INDEX idx_charging_logs_station_created
  ON public.charging_logs (station_id, created_at DESC);

CREATE INDEX idx_charging_logs_available
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
CREATE VIEW public.charger_current_status AS
SELECT DISTINCT ON (station_id)
  id,
  created_at,
  station_id,
  location_name,
  is_available,
  power_kw,
  available_connectors,
  total_connectors,
  out_of_service_connectors,
  availability_updated_at
FROM public.charging_logs
ORDER BY station_id, created_at DESC;

-- ─── Comentarios de columnas ──────────────────────────────────
COMMENT ON TABLE  public.charging_logs          IS 'Histórico de estados de los cargadores EV de Aspe';
COMMENT ON COLUMN public.charging_logs.id           IS 'Identificador único del registro';
COMMENT ON COLUMN public.charging_logs.created_at   IS 'Fecha y hora en que se tomó la muestra (UTC)';
COMMENT ON COLUMN public.charging_logs.station_id   IS 'ID de la estación de carga según la red Iberdrola';
COMMENT ON COLUMN public.charging_logs.location_name IS 'Nombre descriptivo de la ubicación física';
COMMENT ON COLUMN public.charging_logs.is_available  IS 'TRUE = libre para cargar, FALSE = ocupado';
COMMENT ON COLUMN public.charging_logs.power_kw      IS 'Potencia por conector en kW derivada desde Google Places; admite valores decimales';
COMMENT ON COLUMN public.charging_logs.available_connectors IS 'Número de conectores disponibles en la muestra';
COMMENT ON COLUMN public.charging_logs.total_connectors     IS 'Número total de conectores detectados en la estación';
COMMENT ON COLUMN public.charging_logs.out_of_service_connectors IS 'Número de conectores fuera de servicio reportados por Google Places';
COMMENT ON COLUMN public.charging_logs.availability_updated_at IS 'Fecha y hora del último dato dinámico reportado por Google Places';
