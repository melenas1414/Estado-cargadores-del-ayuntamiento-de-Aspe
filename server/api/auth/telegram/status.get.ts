import { createError, getQuery } from 'h3';
import { supabaseRestRequest } from '../../../utils/supabase-rest';

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

export default defineEventHandler(async (event) => {
  const challengeToken = String(getQuery(event).challengeToken || '').trim();
  if (!challengeToken) {
    throw createError({ statusCode: 400, statusMessage: 'challengeToken es obligatorio.' });
  }

  const challenges = await supabaseRestRequest<ChallengeRow[]>(
    event,
    `telegram_login_challenges?select=id,challenge_token,otp_code,expires_at,consumed_at,verified_at,telegram_user_id,telegram_chat_id,telegram_username&challenge_token=eq.${encodeURIComponent(challengeToken)}&limit=1`,
    'GET',
  );

  if (!challenges.length) {
    throw createError({ statusCode: 404, statusMessage: 'Challenge no encontrado.' });
  }

  const challenge = challenges[0];
  return {
    ok: true,
    challengeToken,
    verified: Boolean(challenge.verified_at),
    consumed: Boolean(challenge.consumed_at),
    expiresAt: challenge.expires_at,
    user: challenge.verified_at
      ? {
          telegramUserId: challenge.telegram_user_id,
          telegramChatId: challenge.telegram_chat_id,
          telegramUsername: challenge.telegram_username,
        }
      : null,
  };
});
