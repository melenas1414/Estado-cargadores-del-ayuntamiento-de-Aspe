import { requireTelegramSession } from '../../utils/auth-session';

export default defineEventHandler(async (event) => {
  const session = await requireTelegramSession(event);
  return {
    ok: true,
    user: {
      telegramUserId: session.user?.telegram_user_id ?? null,
      telegramChatId: session.user?.telegram_chat_id ?? null,
      telegramUsername: session.user?.telegram_username ?? null,
    },
    expiresAt: session.expires_at,
  };
});
