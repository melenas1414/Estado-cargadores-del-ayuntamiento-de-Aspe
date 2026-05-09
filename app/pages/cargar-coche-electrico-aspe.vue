<script setup lang="ts">
const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = `${siteUrl}/cargar-coche-electrico-aspe`;
const socialImageUrl = `${siteUrl}/dashboard.png`;

useSeoMeta({
  title: 'Dónde Cargar Coche Eléctrico en Aspe | Mapa EV en Tiempo Real',
  description: 'Consulta dónde cargar coche eléctrico en Aspe con mapa en tiempo real, disponibilidad por cargador y mejores horas para recargar.',
  keywords: 'donde cargar coche electrico en aspe, puntos recarga aspe, cargadores aspe tiempo real, mapa ev aspe',
  ogTitle: 'Dónde Cargar Coche Eléctrico en Aspe',
  ogDescription: 'Mapa EV en tiempo real con disponibilidad de cargadores en Aspe.',
  ogImage: socialImageUrl,
  ogUrl: canonicalUrl,
  twitterCard: 'summary_large_image',
});

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
});
</script>

<template>
  <main class="min-h-screen bg-[radial-gradient(900px_500px_at_10%_0%,rgba(16,185,129,0.18),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(34,211,238,0.14),transparent),#020617] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-5xl space-y-8">
      <section class="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur md:p-8">
        <p class="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Guía local EV</p>
        <h1 class="text-3xl font-extrabold leading-tight text-white md:text-5xl">Dónde cargar coche eléctrico en Aspe</h1>
        <p class="mt-4 max-w-3xl text-sm text-slate-300 md:text-base">
          Estado en tiempo real de los cargadores municipales de Aspe, con predicción de horas tranquilas, diagnóstico de saturación y mapa interactivo.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <NuxtLink to="/" class="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300">Ver resumen en tiempo real</NuxtLink>
          <NuxtLink to="/mapa" class="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500">Abrir mapa de cargadores</NuxtLink>
          <NuxtLink to="/inteligencia" class="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500">Mejores horas para cargar</NuxtLink>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-cyan-300">5 ubicaciones activas</h2>
          <p class="mt-2 text-sm text-slate-300">Carlos Soria, Constitución, Padre Ismael, Juan Carlos I y Orihuela.</p>
        </article>
        <article class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-amber-300">Predicción inteligente</h2>
          <p class="mt-2 text-sm text-slate-300">Detecta las franjas con mayor probabilidad de encontrar hueco.</p>
        </article>
        <article class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-rose-300">Diagnóstico de red</h2>
          <p class="mt-2 text-sm text-slate-300">Saturación, fiabilidad y anomalías para mejorar la experiencia de carga.</p>
        </article>
      </section>
    </div>
  </main>
</template>
