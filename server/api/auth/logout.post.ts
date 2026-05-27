import { getCookie } from 'h3';
import { clearTelegramSessionCookie, TELEGRAM_SESSION_COOKIE } from '../../utils/auth-session';
import { hashSessionToken } from '../../utils/telegram-auth';
import { supabaseRestRequest } from '../../utils/supabase-rest';

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const token = getCookie(event, TELEGRAM_SESSION_COOKIE);

  if (token) {
    const sessionSecret = String(runtimeConfig.telegramSessionSecret || '');
    if (sessionSecret) {
      const tokenHash = hashSessionToken(token, sessionSecret);
      await supabaseRestRequest(
        event,
        `telegram_sessions?session_token_hash=eq.${encodeURIComponent(tokenHash)}`,
        'DELETE',
        undefined,
        { Prefer: 'return=minimal' },
      );
    }
  }

  clearTelegramSessionCookie(event);

  return { ok: true };
});
