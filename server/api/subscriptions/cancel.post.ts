import { createError, readBody } from 'h3';
import { requireTelegramSession } from '../../utils/auth-session';
import { supabaseRestRequest } from '../../utils/supabase-rest';

type Body = {
  subscriptionId?: string;
  stationId?: string;
  zone?: string;
  all?: boolean;
};

type UpdatedSubscriptionRow = {
  id: string;
};

export default defineEventHandler(async (event) => {
  const session = await requireTelegramSession(event);
  const body = await readBody<Body>(event).catch(() => ({} as Body));

  const subscriptionId = String(body.subscriptionId || '').trim();
  const stationId = String(body.stationId || '').trim();
  const zone = String(body.zone || '').trim();
  const cancelAll = Boolean(body.all);

  const criteriaCount = [Boolean(subscriptionId), Boolean(stationId), Boolean(zone), cancelAll].filter(Boolean).length;
  if (criteriaCount !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Debes indicar exactamente un criterio: subscriptionId, stationId, zone o all=true.',
    });
  }

  const filters: string[] = [
    `user_id=eq.${encodeURIComponent(session.user_id)}`,
    'active=eq.true',
  ];

  if (subscriptionId) filters.push(`id=eq.${encodeURIComponent(subscriptionId)}`);
  if (stationId) filters.push(`station_id=eq.${encodeURIComponent(stationId)}`);
  if (zone) filters.push(`zone=eq.${encodeURIComponent(zone)}`);

  const path = `notification_subscriptions?${filters.join('&')}`;
  const nowIso = new Date().toISOString();

  const updatedRows = await supabaseRestRequest<UpdatedSubscriptionRow[]>(
    event,
    path,
    'PATCH',
    {
      active: false,
      expires_at: nowIso,
    },
    {
      Prefer: 'return=representation',
    },
  );

  return {
    ok: true,
    cancelled: updatedRows.length,
    cancelledIds: updatedRows.map((row) => row.id),
  };
});
