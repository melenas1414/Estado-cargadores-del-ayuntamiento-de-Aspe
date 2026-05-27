type TelegramAuthUser = {
  telegramUserId: string | number | null;
  telegramChatId: string | number | null;
  telegramUsername: string | null;
};

type TelegramSessionResponse = {
  ok: boolean;
  user: TelegramAuthUser;
  expiresAt: string;
};

type TelegramLoginStartResponse = {
  ok: boolean;
  sessionExpiresAt: string;
  user: TelegramAuthUser;
};

type TelegramWidgetAuthData = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

type TelegramLoginApi = {
  auth: (options: { bot_id: number; request_access?: 'write' }, callback: (data: TelegramWidgetAuthData | false) => void) => void;
};

type TelegramGlobal = {
  Login?: TelegramLoginApi;
};

declare global {
  interface Window {
    Telegram?: TelegramGlobal;
  }
}

export function useTelegramAuth() {
  const user = useState<TelegramAuthUser | null>('tg-auth-user', () => null);
  const isAuthenticated = useState<boolean>('tg-auth-is-authenticated', () => false);
  const pending = useState<boolean>('tg-auth-pending', () => false);
  const loginPending = useState<boolean>('tg-auth-login-pending', () => false);
  const initialized = useState<boolean>('tg-auth-initialized', () => false);

  async function ensureTelegramLoginSdk(): Promise<void> {
    if (!import.meta.client) return;
    if (window.Telegram?.Login?.auth) return;

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-telegram-login-sdk="1"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar Telegram Login SDK.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.defer = true;
      script.dataset.telegramLoginSdk = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Telegram Login SDK.'));
      document.head.appendChild(script);
    });
  }

  async function restoreSession(): Promise<void> {
    if (pending.value) return;

    pending.value = true;
    try {
      const session = await $fetch<TelegramSessionResponse>('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
      });
      user.value = session.user;
      isAuthenticated.value = true;
    } catch {
      user.value = null;
      isAuthenticated.value = false;
    } finally {
      pending.value = false;
      initialized.value = true;
    }
  }

  async function logout(): Promise<void> {
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      user.value = null;
      isAuthenticated.value = false;
      initialized.value = true;
    }
  }

  async function startLogin(redirectPath = '/'): Promise<void> {
    if (loginPending.value) return;

    loginPending.value = true;
    try {
      void redirectPath;
      if (!import.meta.client) return;

      const config = useRuntimeConfig();
      const botIdRaw = String(config.public.telegramBotId || '').trim();
      const botId = Number(botIdRaw);
      if (!Number.isFinite(botId) || botId <= 0) {
        throw new Error('Falta NUXT_PUBLIC_TELEGRAM_BOT_ID para login oficial.');
      }

      await ensureTelegramLoginSdk();
      const loginApi = window.Telegram?.Login;
      if (!loginApi?.auth) {
        throw new Error('Telegram Login no está disponible en el navegador.');
      }

      const authData = await new Promise<TelegramWidgetAuthData>((resolve, reject) => {
        loginApi.auth({ bot_id: botId, request_access: 'write' }, (data) => {
          if (!data) {
            reject(new Error('Login de Telegram cancelado o no autorizado.'));
            return;
          }
          resolve(data);
        });
      });

      await $fetch<TelegramLoginStartResponse>('/api/auth/telegram/widget-login', {
        method: 'POST',
        credentials: 'include',
        body: authData,
      });

      await restoreSession();
    } finally {
      loginPending.value = false;
    }
  }

  return {
    user,
    isAuthenticated,
    pending,
    loginPending,
    initialized,
    restoreSession,
    startLogin,
    logout,
  };
}
