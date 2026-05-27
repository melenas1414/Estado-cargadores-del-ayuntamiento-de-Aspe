import { createError, readBody } from 'h3';
import { requireTelegramSession } from '../../utils/auth-session';
import { supabaseRestRequest, toIsoDatePlusHours } from '../../utils/supabase-rest';

type Body = {
  scope: 'station' | 'zone';
  stationId?: string;
  zone?: string;
  durationHours: number;
  notifyMode?: 'first_only' | 'repeat';
  cooldownMinutes?: number;
};

export default defineEventHandler(async (event) => {
  const session = await requireTelegramSession(event);
  const body = await readBody<Body>(event);

  if (!body?.scope || !body?.durationHours) {
    throw createError({ statusCode: 400, statusMessage: 'scope y durationHours son obligatorios.' });
  }

  const durationHours = Number(body.durationHours);
  if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 24 * 7) {
    throw createError({ statusCode: 400, statusMessage: 'durationHours debe estar entre 1 y 168 horas.' });
  }

  const scope = body.scope;
  const stationId = scope === 'station' ? String(body.stationId || '').trim() : null;
  const zone = scope === 'zone' ? String(body.zone || '').trim() : null;

  if (scope === 'station' && !stationId) {
    throw createError({ statusCode: 400, statusMessage: 'stationId es obligatorio para scope=station.' });
  }
  if (scope === 'zone' && !zone) {
    throw createError({ statusCode: 400, statusMessage: 'zone es obligatorio para scope=zone.' });
  }

  const notifyMode = body.notifyMode === 'repeat' ? 'repeat' : 'first_only';
  const cooldownMinutes = Math.max(1, Math.min(720, Number(body.cooldownMinutes || 30)));
  const expiresAt = toIsoDatePlusHours(durationHours);

  const rows = await supabaseRestRequest<Array<{ id: string }>>(
    event,
    'notification_subscriptions',
    'POST',
    {
      user_id: session.user_id,
      station_id: stationId,
      zone,
      notify_mode: notifyMode,
      cooldown_minutes: cooldownMinutes,
      expires_at: expiresAt,
      active: true,
    },
    {
      Prefer: 'return=representation',
    },
  );

  return {
    ok: true,
    subscriptionId: rows[0]?.id ?? null,
    expiresAt,
  };
});
