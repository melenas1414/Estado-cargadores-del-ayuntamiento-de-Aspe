import { createError, getRequestIP, readBody } from 'h3';
import { generateChallengeToken, generateOtpCode } from '../../../utils/telegram-auth';
import { supabaseRestRequest, toIsoDatePlusSeconds } from '../../../utils/supabase-rest';

type Body = {
  redirectPath?: string;
};

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const body = await readBody<Body>(event).catch(() => ({} as Body));
  const challengeToken = generateChallengeToken();
  const otpCode = generateOtpCode();
  const challengeTtl = Number(runtimeConfig.telegramAuthChallengeTtlSeconds || 600);
  const botUsername = String(runtimeConfig.public.telegramBotUsername || '').trim();

  if (!botUsername) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Falta NUXT_PUBLIC_TELEGRAM_BOT_USERNAME para generar el deep-link.',
    });
  }

  await supabaseRestRequest(
    event,
    'telegram_login_challenges',
    'POST',
    {
      challenge_token: challengeToken,
      otp_code: otpCode,
      expires_at: toIsoDatePlusSeconds(challengeTtl),
      requested_ip: getRequestIP(event, { xForwardedFor: true }) || null,
    },
    {
      Prefer: 'return=minimal',
    },
  );

  const redirectPath = String(body.redirectPath || '/').trim() || '/';
  const payload = `login_${challengeToken}_${otpCode}`;
  const botDeepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(payload)}`;

  return {
    challengeToken,
    challengeExpiresInSeconds: challengeTtl,
    redirectPath,
    botDeepLink,
  };
});
