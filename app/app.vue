<template>
  <div class="dark">
    <NuxtPage />
  </div>
</template>

<style>
/* Estilos base globales */
html,
body {
  @apply bg-slate-950 text-slate-100 antialiased;
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
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
