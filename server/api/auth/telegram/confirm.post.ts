import { createError, readBody } from 'h3';
import { generateSessionToken, hashSessionToken } from '../../../utils/telegram-auth';
import { setTelegramSessionCookie } from '../../../utils/auth-session';
import { supabaseRestRequest, toIsoDatePlusDays } from '../../../utils/supabase-rest';

type Body = {
  challengeToken: string;
  otpCode?: string;
  telegramUsername?: string;
  telegramChatId?: string | number;
  telegramUserId?: string | number;
};

type ChallengeRow = {
  id: string;
  challenge_token: string;
  otp_code: string;
  expires_at: string;
  consumed_at: string | null;
  verified_at: string | null;
  telegram_user_id: string | number | null;
  telegram_chat_id: string | number | null;
  telegram_username: string | null;
};

type UserRow = {
  id: string;
  telegram_user_id: string | number;
  telegram_chat_id: string | number | null;
  telegram_username: string | null;
};

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const body = await readBody<Body>(event);

  if (!body?.challengeToken) {
    throw createError({ statusCode: 400, statusMessage: 'challengeToken es obligatorio.' });
  }

  const challengeToken = String(body.challengeToken).trim();
  const otpCode = String(body.otpCode || '').trim();

  const challenges = await supabaseRestRequest<ChallengeRow[]>(
    event,
    `telegram_login_challenges?select=id,challenge_token,otp_code,expires_at,consumed_at&challenge_token=eq.${encodeURIComponent(challengeToken)}&limit=1`,
    'GET',
  );

  if (!challenges.length) {
    throw createError({ statusCode: 404, statusMessage: 'Challenge no encontrado.' });
  }

  const challenge = challenges[0];
  if (challenge.consumed_at) {
    throw createError({ statusCode: 409, statusMessage: 'Challenge ya consumido.' });
  }
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'Challenge expirado.' });
  }
  const isVerifiedByBot = Boolean(challenge.verified_at && challenge.telegram_user_id);
  if (!isVerifiedByBot && challenge.otp_code !== otpCode) {
    throw createError({ statusCode: 401, statusMessage: 'OTP incorrecto.' });
  }

  const telegramUserId = String(body.telegramUserId ?? challenge.telegram_user_id ?? '').trim();
  const telegramChatId = body.telegramChatId === undefined || body.telegramChatId === null
    ? String(challenge.telegram_chat_id ?? telegramUserId)
    : String(body.telegramChatId).trim();
  const telegramUsername = body.telegramUsername ? String(body.telegramUsername).trim() : String(challenge.telegram_username || '').trim() || null;

  if (!telegramUserId) {
    throw createError({ statusCode: 409, statusMessage: 'La verificacion de Telegram aun no esta lista. Vuelve a intentarlo en unos segundos.' });
  }

  const users = await supabaseRestRequest<UserRow[]>(
    event,
    'telegram_users?on_conflict=telegram_user_id',
    'POST',
    {
      telegram_user_id: telegramUserId,
      telegram_chat_id: telegramChatId,
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

  await supabaseRestRequest(
    event,
    `telegram_login_challenges?challenge_token=eq.${encodeURIComponent(challengeToken)}&consumed_at=is.null`,
    'PATCH',
    { consumed_at: new Date().toISOString() },
    {
      Prefer: 'return=minimal',
    },
  );

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
