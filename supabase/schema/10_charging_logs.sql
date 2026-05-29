-- Charging logs: reset + create
DROP VIEW IF EXISTS public.charger_current_status CASCADE;
DROP TABLE IF EXISTS public.charging_logs CASCADE;

-- Tabla principal de registros de disponibilidad
CREATE TABLE public.charging_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  station_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  is_available BOOLEAN NOT NULL,
  power_kw NUMERIC(10,2) DEFAULT 22 NOT NULL,
  available_connectors INT,
  total_connectors INT,
  out_of_service_connectors INT,
  availability_updated_at TIMESTAMPTZ,
  source TEXT,
  data_quality TEXT NOT NULL DEFAULT 'observed'
);

CREATE INDEX idx_charging_logs_station_id
  ON public.charging_logs (station_id);

CREATE INDEX idx_charging_logs_created_at
  ON public.charging_logs (created_at DESC);

CREATE INDEX idx_charging_logs_station_created
  ON public.charging_logs (station_id, created_at DESC);

CREATE INDEX idx_charging_logs_available
  ON public.charging_logs (is_available, created_at DESC);

ALTER TABLE public.charging_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura publica"
  ON public.charging_logs
  FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion al servicio"
  ON public.charging_logs
  FOR INSERT
  WITH CHECK (true);

-- Vista de ultimo estado por estacion
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
