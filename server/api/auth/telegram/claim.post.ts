import { createError, getHeader, readBody } from 'h3';
import { supabaseRestRequest } from '../../../utils/supabase-rest';

type Body = {
  challengeToken: string;
  otpCode: string;
  telegramUserId: string | number;
  telegramUsername?: string;
  telegramChatId?: string | number;
};

type ChallengeRow = {
  id: string;
  challenge_token: string;
  otp_code: string;
  expires_at: string;
  consumed_at: string | null;
};

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const claimSecret = String(runtimeConfig.telegramClaimSecret || '');
  const providedSecret = String(getHeader(event, 'x-telegram-claim-secret') || '');

  if (!claimSecret || providedSecret !== claimSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Claim no autorizado.' });
  }

  const body = await readBody<Body>(event);

  if (!body?.challengeToken || !body?.otpCode || !body?.telegramUserId) {
    throw createError({ statusCode: 400, statusMessage: 'challengeToken, otpCode y telegramUserId son obligatorios.' });
  }

  const challengeToken = String(body.challengeToken).trim();
  const otpCode = String(body.otpCode).trim();
  const telegramUserId = String(body.telegramUserId).trim();
  const telegramChatId = body.telegramChatId === undefined || body.telegramChatId === null
    ? telegramUserId
    : String(body.telegramChatId).trim();
  const telegramUsername = body.telegramUsername ? String(body.telegramUsername).trim() : null;

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
  if (challenge.otp_code !== otpCode) {
    throw createError({ statusCode: 401, statusMessage: 'OTP incorrecto.' });
  }

  await supabaseRestRequest(
    event,
    `telegram_login_challenges?challenge_token=eq.${encodeURIComponent(challengeToken)}&consumed_at=is.null`,
    'PATCH',
    {
      telegram_user_id: telegramUserId,
      telegram_chat_id: telegramChatId,
      telegram_username: telegramUsername,
      verified_at: new Date().toISOString(),
    },
    { Prefer: 'return=minimal' },
  );

  return {
    ok: true,
    challengeToken,
    verified: true,
  };
});
