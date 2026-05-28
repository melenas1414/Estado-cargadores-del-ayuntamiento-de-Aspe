<template>
  <div class="dark">
    <header class="sticky top-0 z-40 border-b border-slate-800/70 bg-slate-950/85 backdrop-blur supports-[backdrop-filter]:bg-slate-950/75">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div class="min-w-0">
          <p class="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Estado de Cargadores</p>
          <p class="truncate text-sm text-slate-200">Aspe · estado en tiempo real</p>
        </div>

        <div class="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-400 shadow-lg backdrop-blur">
          Alertas gestionadas por bot de Telegram
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
