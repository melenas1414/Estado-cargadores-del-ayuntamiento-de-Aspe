<script setup lang="ts">
const route = useRoute();
const { user, isAuthenticated, pending, loginPending, startLogin, logout } = useTelegramAuth();

const userLabel = computed(() => {
  const username = String(user.value?.telegramUsername || '').trim();
  if (username) return `@${username}`;
  const telegramUserId = user.value?.telegramUserId;
  return telegramUserId ? `ID ${telegramUserId}` : 'Usuario';
});

const handleLogin = async () => {
  await startLogin(String(route.fullPath || '/'));
};
</script>

<template>
  <div class="dark">
    <header class="sticky top-0 z-40 border-b border-slate-800/70 bg-slate-950/85 backdrop-blur supports-[backdrop-filter]:bg-slate-950/75">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div class="min-w-0">
          <p class="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Estado de Cargadores</p>
          <p class="truncate text-sm text-slate-200">Aspe · acceso y alertas Telegram</p>
        </div>

        <div class="pointer-events-auto">
        <div v-if="pending" class="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-xs text-slate-400 shadow-lg backdrop-blur">
          Restaurando sesion...
        </div>

        <div
          v-else-if="isAuthenticated"
          class="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-cyan-500/10 px-2.5 py-1 text-xs text-emerald-50 shadow-[0_10px_30px_rgba(16,185,129,0.18)] backdrop-blur"
        >
          <span class="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/30">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="h-3.5 w-3.5 fill-current">
              <path d="M9.04 15.89 8.9 19.7c.39 0 .56-.17.77-.38l1.85-1.78 3.84 2.81c.7.39 1.2.19 1.38-.65l2.47-11.58h0c.22-1.02-.37-1.42-1.05-1.17L4.72 11.24c-.98.38-.97.93-.18 1.17l3.9 1.22 9.06-5.71c.43-.26.83-.12.51.16"/>
            </svg>
          </span>
          <span class="hidden rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-50 sm:inline">Telegram</span>
          <span class="max-w-[160px] truncate font-medium text-emerald-100">{{ userLabel }}</span>
          <button
            class="rounded-full border border-emerald-300/40 bg-slate-950/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-50 transition-colors hover:bg-emerald-500/20"
            @click="logout"
          >
            Salir
          </button>
        </div>

        <div
          v-else
          class="flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-sky-400/30 bg-gradient-to-r from-sky-500/20 via-cyan-500/10 to-slate-900/80 px-2.5 py-1 text-xs text-sky-50 shadow-[0_10px_30px_rgba(14,165,233,0.18)] backdrop-blur"
        >
          <span class="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/30">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="h-3.5 w-3.5 fill-current">
              <path d="M9.04 15.89 8.9 19.7c.39 0 .56-.17.77-.38l1.85-1.78 3.84 2.81c.7.39 1.2.19 1.38-.65l2.47-11.58h0c.22-1.02-.37-1.42-1.05-1.17L4.72 11.24c-.98.38-.97.93-.18 1.17l3.9 1.22 9.06-5.71c.43-.26.83-.12.51.16"/>
            </svg>
          </span>
          <div class="hidden min-w-0 flex-col sm:flex">
            <span class="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">Login Oficial Telegram</span>
            <span class="truncate text-[11px] text-sky-100/80">Inicia sesión web para guardar alertas temporales</span>
          </div>
          <button
            class="rounded-full border border-sky-300/40 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-white transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loginPending"
            @click="handleLogin"
          >
            {{ loginPending ? 'Abriendo...' : 'Entrar' }}
          </button>
        </div>
        </div>
      </div>
    </header>

    <NuxtPage />
    <CookieConsent />
  </div>
</template>

<style>
/* Estilos base globales */
html,
body {
  @apply bg-slate-950 text-slate-100 antialiased;
  font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
}

/* Scrollbar personalizada para modo oscuro */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  @apply bg-slate-900;
}
::-webkit-scrollbar-thumb {
  @apply bg-slate-600 rounded-full;
}
::-webkit-scrollbar-thumb:hover {
  @apply bg-slate-500;
}
</style>
