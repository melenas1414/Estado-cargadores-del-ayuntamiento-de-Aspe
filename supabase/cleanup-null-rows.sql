-- =============================================================
-- Limpieza de filas inválidas en charging_logs
-- Objetivo: eliminar muestras sin datos dinámicos reales
-- =============================================================

-- 1) Vista previa: cuántas filas se van a borrar
SELECT COUNT(*) AS filas_invalidas
FROM public.charging_logs
WHERE available_connectors IS NULL
  AND total_connectors IS NULL
  AND out_of_service_connectors IS NULL
  AND availability_updated_at IS NULL;

-- 2) Vista previa: últimas filas afectadas
SELECT id, created_at, station_id, location_name, is_available, power_kw,
       available_connectors, total_connectors, out_of_service_connectors, availability_updated_at
FROM public.charging_logs
WHERE available_connectors IS NULL
  AND total_connectors IS NULL
  AND out_of_service_connectors IS NULL
  AND availability_updated_at IS NULL
ORDER BY created_at DESC
LIMIT 100;

-- 3) Borrado de filas inválidas
DELETE FROM public.charging_logs
WHERE available_connectors IS NULL
  AND total_connectors IS NULL
  AND out_of_service_connectors IS NULL
  AND availability_updated_at IS NULL;

-- 4) Verificación posterior
SELECT COUNT(*) AS filas_invalidas_restantes
FROM public.charging_logs
WHERE available_connectors IS NULL
  AND total_connectors IS NULL
  AND out_of_service_connectors IS NULL
  AND availability_updated_at IS NULL;
