<script setup lang="ts">
const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = `${siteUrl}/mapa-ev-aspe-tiempo-real`;

useSeoMeta({
  title: 'Mapa EV Aspe en Tiempo Real | Cargadores Disponibles Ahora',
  description: 'Abre el mapa EV de Aspe en tiempo real y consulta qué cargadores tienen conectores libres en este momento.',
  keywords: 'mapa ev aspe tiempo real, cargadores disponibles ahora aspe, mapa cargadores electricos aspe',
  ogTitle: 'Mapa EV de Aspe en Tiempo Real',
  ogDescription: 'Visualiza en mapa los cargadores de Aspe y su estado instantáneo.',
  ogUrl: canonicalUrl,
});

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
});
</script>

<template>
  <main class="min-h-screen bg-[#020617] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-5xl space-y-6">
      <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 class="text-3xl font-extrabold text-white md:text-4xl">Mapa EV Aspe en tiempo real</h1>
        <p class="mt-3 text-sm text-slate-300">
          Revisa el estado de cada punto de carga de Aspe sobre mapa y abre navegación directa al cargador seleccionado.
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <NuxtLink to="/mapa" class="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Abrir mapa en vivo</NuxtLink>
          <NuxtLink to="/" class="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500">Volver al dashboard</NuxtLink>
        </div>
      </section>

      <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 class="text-lg font-semibold text-white">Consejos de uso rápido</h2>
        <ul class="mt-3 space-y-2 text-sm text-slate-300">
          <li>Si un punto está al límite, revisa la pestaña Inteligencia antes de desplazarte.</li>
          <li>Consulta la predicción por franjas para elegir horas con mayor probabilidad de hueco.</li>
          <li>Comprueba fiabilidad para evitar estaciones con incidencias recurrentes.</li>
        </ul>
      </section>
    </div>
  </main>
</template>
