import { createError, type H3Event } from 'h3';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function supabaseRestRequest<T>(
  event: H3Event,
  pathWithQuery: string,
  method: Method,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const runtimeConfig = useRuntimeConfig(event);
  const supabaseUrl = String(runtimeConfig.public.supabaseUrl || '').replace(/\/+$/, '');
  const serviceKey = String(runtimeConfig.supabaseServiceKey || '');

  if (!supabaseUrl || !serviceKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Falta configurar Supabase (NUXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY).',
    });
  }

  const url = `${supabaseUrl}/rest/v1/${pathWithQuery.replace(/^\/+/, '')}`;
  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  return await $fetch<T>(url, {
    method,
    headers,
    body,
    onResponseError({ response }) {
      const errorData = response._data as { code?: string; message?: string; details?: string; hint?: string } | undefined;
      if (response.status === 404 && String(errorData?.code || '') === 'PGRST205') {
        throw createError({
          statusCode: 503,
          statusMessage:
            'Faltan tablas nuevas en Supabase. Ejecuta supabase/schema.sql para crear telegram_login_challenges, telegram_users, telegram_sessions y notification_subscriptions.',
        });
      }
    },
  });
}

export function toIsoDatePlusSeconds(seconds: number): string {
  return new Date(Date.now() + Math.max(0, seconds) * 1000).toISOString();
}

export function toIsoDatePlusHours(hours: number): string {
  return new Date(Date.now() + Math.max(0, hours) * 60 * 60 * 1000).toISOString();
}

export function toIsoDatePlusDays(days: number): string {
  return new Date(Date.now() + Math.max(0, days) * 24 * 60 * 60 * 1000).toISOString();
}
