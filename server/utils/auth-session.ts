import { createError, deleteCookie, getCookie, getHeader, setCookie, type H3Event } from 'h3';
import { hashSessionToken } from './telegram-auth';
import { supabaseRestRequest } from './supabase-rest';

export const TELEGRAM_SESSION_COOKIE = 'tg_session';

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
  user: {
    telegram_user_id: string | number;
    telegram_chat_id: string | number | null;
    telegram_username: string | null;
  } | null;
};

export async function requireTelegramSession(event: H3Event): Promise<SessionRow> {
  const runtimeConfig = useRuntimeConfig(event);
  const sessionSecret = String(runtimeConfig.telegramSessionSecret || '');
  if (!sessionSecret) {
    throw createError({ statusCode: 500, statusMessage: 'Falta TELEGRAM_SESSION_SECRET.' });
  }

  const token = getCookie(event, TELEGRAM_SESSION_COOKIE);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Sesion no iniciada.' });
  }

  const tokenHash = hashSessionToken(token, sessionSecret);
  const nowIso = new Date().toISOString();
  const rows = await supabaseRestRequest<SessionRow[]>(
    event,
    `telegram_sessions?select=id,user_id,expires_at,user:telegram_users(telegram_user_id,telegram_chat_id,telegram_username)&session_token_hash=eq.${encodeURIComponent(tokenHash)}&expires_at=gt.${encodeURIComponent(nowIso)}&limit=1`,
    'GET',
  );

  if (!rows.length) {
    deleteCookie(event, TELEGRAM_SESSION_COOKIE, { path: '/' });
    throw createError({ statusCode: 401, statusMessage: 'Sesion expirada o invalida.' });
  }

  await supabaseRestRequest(
    event,
    `telegram_sessions?id=eq.${encodeURIComponent(rows[0].id)}`,
    'PATCH',
    { last_seen_at: nowIso },
  );

  return rows[0];
}

export function setTelegramSessionCookie(event: H3Event, sessionToken: string, ttlDays: number): void {
  const forwardedProto = String(getHeader(event, 'x-forwarded-proto') || '').toLowerCase();
  const host = String(getHeader(event, 'host') || '').toLowerCase();
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const secureCookie = forwardedProto === 'https' || (!isLocalHost && process.env.NODE_ENV === 'production');

  setCookie(event, TELEGRAM_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    path: '/',
    maxAge: Math.max(1, ttlDays) * 24 * 60 * 60,
  });
}

export function clearTelegramSessionCookie(event: H3Event): void {
  deleteCookie(event, TELEGRAM_SESSION_COOKIE, { path: '/' });
}
