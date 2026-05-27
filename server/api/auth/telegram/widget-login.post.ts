import { createError, readBody } from 'h3';
import { setTelegramSessionCookie } from '../../../utils/auth-session';
import { generateSessionToken, hashSessionToken, verifyTelegramLoginHash } from '../../../utils/telegram-auth';
import { supabaseRestRequest, toIsoDatePlusDays } from '../../../utils/supabase-rest';

type TelegramLoginBody = {
  id: string | number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string | number;
  hash: string;
};

type UserRow = {
  id: string;
  telegram_user_id: string | number;
  telegram_chat_id: string | number | null;
  telegram_username: string | null;
};

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const botToken = String(runtimeConfig.telegramBotToken || '').trim();
  if (!botToken) {
    throw createError({ statusCode: 500, statusMessage: 'Falta TELEGRAM_BOT_TOKEN.' });
  }

  const body = await readBody<TelegramLoginBody>(event);
  if (!body?.id || !body?.auth_date || !body?.hash) {
    throw createError({ statusCode: 400, statusMessage: 'Datos de login Telegram incompletos.' });
  }

  const authTimestamp = Number(body.auth_date);
  if (!Number.isFinite(authTimestamp)) {
    throw createError({ statusCode: 400, statusMessage: 'auth_date inválido.' });
  }

  // 10 minutes max age to limit replay window.
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - authTimestamp) > 600) {
    throw createError({ statusCode: 401, statusMessage: 'Login de Telegram expirado. Vuelve a intentarlo.' });
  }

  const payloadForHash: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'hash' || value === null || value === undefined) continue;
    payloadForHash[key] = String(value);
  }

  const validHash = verifyTelegramLoginHash(payloadForHash, botToken, String(body.hash));
  if (!validHash) {
    throw createError({ statusCode: 401, statusMessage: 'Firma de Telegram inválida.' });
  }

  const telegramUserId = String(body.id).trim();
  const telegramUsername = body.username ? String(body.username).trim() : null;

  const users = await supabaseRestRequest<UserRow[]>(
    event,
    'telegram_users?on_conflict=telegram_user_id',
    'POST',
    {
      telegram_user_id: telegramUserId,
      telegram_chat_id: telegramUserId,
      telegram_username: telegramUsername,
      is_active: true,
    },
    {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
  );

  if (!users.length) {
    throw createError({ statusCode: 500, statusMessage: 'No se pudo crear/actualizar el usuario Telegram.' });
  }

  const ttlDays = Number(runtimeConfig.telegramSessionTtlDays || 14);
  const sessionSecret = String(runtimeConfig.telegramSessionSecret || '');
  if (!sessionSecret) {
    throw createError({ statusCode: 500, statusMessage: 'Falta TELEGRAM_SESSION_SECRET.' });
  }

  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken, sessionSecret);
  const expiresAt = toIsoDatePlusDays(ttlDays);

  await supabaseRestRequest(
    event,
    'telegram_sessions',
    'POST',
    {
      user_id: users[0].id,
      session_token_hash: sessionTokenHash,
      expires_at: expiresAt,
    },
    {
      Prefer: 'return=minimal',
    },
  );

  setTelegramSessionCookie(event, sessionToken, ttlDays);

  return {
    ok: true,
    sessionExpiresAt: expiresAt,
    user: {
      telegramUserId: users[0].telegram_user_id,
      telegramChatId: users[0].telegram_chat_id,
      telegramUsername: users[0].telegram_username,
    },
  };
});
