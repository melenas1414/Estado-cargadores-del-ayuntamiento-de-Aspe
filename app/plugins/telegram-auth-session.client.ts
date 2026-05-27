export default defineNuxtPlugin(async () => {
  const { restoreSession, initialized } = useTelegramAuth();

  // Restores login state from HttpOnly cookie on app startup.
  if (!initialized.value) {
    await restoreSession();
  }
});
