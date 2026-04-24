-- =============================================================
-- Programador en Supabase: Edge Functions + pg_cron
-- =============================================================
-- 1) Sustituye <PROJECT_REF> por tu ref de proyecto (ej: abcd1234efgh5678)
-- 2) Sustituye <SERVICE_ROLE_KEY> por la service_role key de Supabase
-- 3) Ejecuta este script en SQL Editor

-- Extensiones necesarias
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Elimina el job anterior si existía
select cron.unschedule('monitor-cargadores-aspe')
where exists (
  select 1 from cron.job where jobname = 'monitor-cargadores-aspe'
);

-- Programa la llamada cada 15 minutos
select cron.schedule(
  'monitor-cargadores-aspe',
  '*/5 * * * *',
  $$
  select
    net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/monitor-cargadores',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Consulta rápida de jobs
select jobid, jobname, schedule, active from cron.job order by jobid desc;