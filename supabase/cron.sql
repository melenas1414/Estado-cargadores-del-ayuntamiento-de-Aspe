-- =============================================================
-- Programador en Supabase: desactivar cron legado
-- =============================================================
-- Este proyecto ahora usa GitHub Actions para ejecutar el scraper Iberdrola.
-- Ejecuta este script una vez en SQL Editor para evitar ejecuciones duplicadas
-- del cron de Supabase.

create extension if not exists pg_cron with schema extensions;

-- Elimina el job anterior si existía
select cron.unschedule('monitor-cargadores-aspe')
where exists (
  select 1 from cron.job where jobname = 'monitor-cargadores-aspe'
);

-- Verificación rápida: no debe existir monitor-cargadores-aspe
select jobid, jobname, schedule, active
from cron.job
where jobname = 'monitor-cargadores-aspe';