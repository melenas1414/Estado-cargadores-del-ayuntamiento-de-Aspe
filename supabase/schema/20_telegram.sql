-- Telegram: reset + create (usuarios, subscripciones, dispatches, RLS y comentarios)
DROP TABLE IF EXISTS public.notification_dispatches CASCADE;
DROP TABLE IF EXISTS public.notification_subscriptions CASCADE;
DROP TABLE IF EXISTS public.telegram_sessions CASCADE;
DROP TABLE IF EXISTS public.telegram_login_challenges CASCADE;
DROP TABLE IF EXISTS public.telegram_users CASCADE;

-- Usuarios del bot de Telegram
CREATE TABLE public.telegram_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  telegram_chat_id BIGINT,
  telegram_username TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  is_bot_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_until TIMESTAMPTZ,
  anti_bot_strikes INT NOT NULL DEFAULT 0,
  command_window_start TIMESTAMPTZ,
  command_window_count INT NOT NULL DEFAULT 0,
  last_command_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (anti_bot_strikes >= 0),
  CHECK (command_window_count >= 0)
);

CREATE INDEX idx_telegram_users_premium_active
  ON public.telegram_users (is_premium, is_active);

CREATE INDEX idx_telegram_users_admin_active
  ON public.telegram_users (is_bot_admin, is_active);

CREATE INDEX idx_telegram_users_blocked
  ON public.telegram_users (is_blocked, blocked_until);

-- Suscripciones de notificacion
CREATE TABLE public.notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES public.telegram_users(id) ON DELETE CASCADE,
  station_id TEXT,
  zone TEXT,
  notify_mode TEXT NOT NULL DEFAULT 'first_only',
  cooldown_minutes INT NOT NULL DEFAULT 30,
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_notified_at TIMESTAMPTZ,
  CHECK (station_id IS NOT NULL OR zone IS NOT NULL),
  CHECK (notify_mode IN ('first_only', 'repeat')),
  CHECK (cooldown_minutes BETWEEN 1 AND 720)
);

CREATE INDEX idx_notification_subscriptions_station
  ON public.notification_subscriptions (station_id, active, expires_at DESC);

CREATE INDEX idx_notification_subscriptions_zone
  ON public.notification_subscriptions (zone, active, expires_at DESC);

-- Historial de envios para deduplicacion
CREATE TABLE public.notification_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subscription_id UUID NOT NULL REFERENCES public.notification_subscriptions(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  wave TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (wave IN ('priority', 'regular')),
  UNIQUE (subscription_id, event_key, wave)
);

CREATE INDEX idx_notification_dispatches_event
  ON public.notification_dispatches (event_key, wave, created_at DESC);

-- RLS para tablas del bot
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only telegram_users"
  ON public.telegram_users
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role only notification_subscriptions"
  ON public.notification_subscriptions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role only notification_dispatches"
  ON public.notification_dispatches
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Comentarios y notas operativas del bot
COMMENT ON TABLE public.telegram_users IS 'Usuarios del bot de Telegram, incluyendo flags de premium y administracion';
COMMENT ON COLUMN public.telegram_users.is_premium IS 'TRUE = recibe la ola prioritaria de notificaciones';
COMMENT ON COLUMN public.telegram_users.is_bot_admin IS 'TRUE = puede gestionar premium desde el bot';
COMMENT ON COLUMN public.telegram_users.is_blocked IS 'TRUE = usuario bloqueado temporalmente por anti-bot';
COMMENT ON COLUMN public.telegram_users.blocked_until IS 'Fin del bloqueo automatico por anti-bot';
COMMENT ON COLUMN public.telegram_users.anti_bot_strikes IS 'Contador acumulado de eventos sospechosos';
COMMENT ON COLUMN public.telegram_users.command_window_start IS 'Inicio de la ventana de rate-limit por usuario';
COMMENT ON COLUMN public.telegram_users.command_window_count IS 'Numero de comandos en la ventana activa';
COMMENT ON COLUMN public.telegram_users.last_command_at IS 'Timestamp del ultimo comando recibido por el bot';
COMMENT ON COLUMN public.telegram_users.last_interaction_at IS 'Ultima interaccion observada del usuario con el bot';

-- Bootstrap del primer administrador tras el primer /start:
-- UPDATE public.telegram_users
-- SET is_bot_admin = TRUE
-- WHERE telegram_user_id = <TU_TELEGRAM_USER_ID>;