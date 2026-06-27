-- iOS Mobile Users: reset + create (usuarios, subscripciones, RLS)
DROP TABLE IF EXISTS public.mobile_notification_subscriptions CASCADE;
DROP TABLE IF EXISTS public.mobile_users CASCADE;

-- Usuarios de la App Móvil (Expo)
CREATE TABLE public.mobile_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  apns_token TEXT UNIQUE,
  device_id TEXT UNIQUE NOT NULL, -- Identificador único para el dispositivo o instalación
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mobile_users_active
  ON public.mobile_users (is_active);

-- Suscripciones de notificacion para móvil
CREATE TABLE public.mobile_notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES public.mobile_users(id) ON DELETE CASCADE,
  station_id TEXT,
  notify_mode TEXT NOT NULL DEFAULT 'first_only',
  cooldown_minutes INT NOT NULL DEFAULT 30,
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_notified_at TIMESTAMPTZ,
  CHECK (station_id IS NOT NULL),
  CHECK (notify_mode IN ('first_only', 'repeat')),
  CHECK (cooldown_minutes BETWEEN 1 AND 720)
);

CREATE INDEX idx_mobile_notification_subscriptions_station
  ON public.mobile_notification_subscriptions (station_id, active, expires_at DESC);

-- RLS para tablas de la app móvil
ALTER TABLE public.mobile_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_notification_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir a todos crear o actualizar su usuario"
  ON public.mobile_users
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir a todos crear o actualizar su suscripcion"
  ON public.mobile_notification_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public.mobile_users IS 'Usuarios de la aplicación móvil nativa (iOS), incluye token APNs para notificaciones push.';
COMMENT ON COLUMN public.mobile_users.apns_token IS 'APNs Token para enviar notificaciones a este dispositivo de Apple.';
COMMENT ON COLUMN public.mobile_users.device_id IS 'ID generado en la app para rastrear la instalación y actualizar el token de manera segura.';
