import { createError, getHeader, readBody } from 'h3';
import { parseCsvSet } from '../../utils/telegram-auth';
import { supabaseRestRequest } from '../../utils/supabase-rest';

type Body = {
  eventKey: string;
  stationId?: string;
  zone?: string;
  message?: string;
  url?: string;
  wave?: 'priority' | 'regular';
};

type SubscriptionRow = {
  id: string;
  notify_mode: 'first_only' | 'repeat';
  cooldown_minutes: number;
  last_notified_at: string | null;
  expires_at: string;
  user: {
    telegram_user_id: string | number;
    telegram_chat_id: string | number | null;
    telegram_username: string | null;
  } | null;
};

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  await $fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    body: {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    },
  });
}

function isInCooldown(lastNotifiedAt: string | null, cooldownMinutes: number): boolean {
  if (!lastNotifiedAt) return false;
  const elapsedMs = Date.now() - new Date(lastNotifiedAt).getTime();
  return elapsedMs < Math.max(1, cooldownMinutes) * 60 * 1000;
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const triggerSecret = String(runtimeConfig.notificationTriggerSecret || '');
  const providedSecret = String(getHeader(event, 'x-notification-secret') || '');

  if (!triggerSecret || providedSecret !== triggerSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Trigger no autorizado.' });
  }

  const body = await readBody<Body>(event);
  if (!body?.eventKey) {
    throw createError({ statusCode: 400, statusMessage: 'eventKey es obligatorio.' });
  }

  const botToken = String(runtimeConfig.telegramBotToken || '');
  if (!botToken) {
    throw createError({ statusCode: 500, statusMessage: 'Falta TELEGRAM_BOT_TOKEN.' });
  }

  const stationId = body.stationId ? String(body.stationId).trim() : '';
  const zone = body.zone ? String(body.zone).trim() : '';
  const wave = body.wave || 'priority';

  if (!stationId && !zone) {
    throw createError({ statusCode: 400, statusMessage: 'Debes indicar stationId o zone.' });
  }

  const filterByStation = stationId
    ? `and(active.eq.true,expires_at.gt.${encodeURIComponent(new Date().toISOString())},station_id.eq.${encodeURIComponent(stationId)})`
    : null;
  const filterByZone = zone
    ? `and(active.eq.true,expires_at.gt.${encodeURIComponent(new Date().toISOString())},zone.eq.${encodeURIComponent(zone)})`
    : null;

  const orFilter = [filterByStation, filterByZone].filter(Boolean).join(',');
  const rows = await supabaseRestRequest<SubscriptionRow[]>(
    event,
    `notification_subscriptions?select=id,notify_mode,cooldown_minutes,last_notified_at,expires_at,user:telegram_users(telegram_user_id,telegram_chat_id,telegram_username)&or=(${orFilter})`,
    'GET',
  );

  const prioritySet = parseCsvSet(String(runtimeConfig.priorityTelegramUsers || ''));
  const priorityMatchField = String(runtimeConfig.priorityMatchField || 'telegram_user_id');
  const priorityDelaySeconds = Number(runtimeConfig.priorityNotifyDelaySeconds || 120);

  const isPriorityUser = (row: SubscriptionRow): boolean => {
    const user = row.user;
    if (!user) return false;

    if (priorityMatchField === 'telegram_chat_id') {
      return user.telegram_chat_id ? prioritySet.has(String(user.telegram_chat_id)) : false;
    }
    return prioritySet.has(String(user.telegram_user_id));
  };

  const targetRows = rows.filter((row) => {
    if (!row.user) return false;
    if (row.notify_mode === 'repeat' && isInCooldown(row.last_notified_at, row.cooldown_minutes)) {
      return false;
    }
    if (row.notify_mode === 'first_only' && row.last_notified_at) {
      return false;
    }

    const priority = isPriorityUser(row);
    if (wave === 'priority') return priority;
    return !priority;
  });

  let sent = 0;
  let skippedByDuplicate = 0;

  for (const row of targetRows) {
    const dispatchInsert = await supabaseRestRequest<Array<{ id: string }>>(
      event,
      'notification_dispatches?on_conflict=subscription_id,event_key,wave',
      'POST',
      {
        subscription_id: row.id,
        event_key: body.eventKey,
        wave,
      },
      {
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
    );

    if (!dispatchInsert.length) {
      skippedByDuplicate += 1;
      continue;
    }

    const chatId = String(row.user?.telegram_chat_id || row.user?.telegram_user_id || '').trim();
    if (!chatId) continue;

    const baseText = body.message?.trim() || 'Uno de tus cargadores suscritos parece estar libre ahora.';
    const text = body.url ? `${baseText}\n${body.url}` : baseText;

    await sendTelegramMessage(botToken, chatId, text);

    await supabaseRestRequest(
      event,
      `notification_subscriptions?id=eq.${encodeURIComponent(row.id)}`,
      'PATCH',
      {
        last_notified_at: new Date().toISOString(),
        active: row.notify_mode === 'first_only' ? false : true,
      },
      { Prefer: 'return=minimal' },
    );

    sent += 1;
  }

  return {
    ok: true,
    wave,
    sent,
    skippedByDuplicate,
    priorityDelaySeconds,
    nextWaveHint: wave === 'priority' ? 'regular' : null,
  };
});
