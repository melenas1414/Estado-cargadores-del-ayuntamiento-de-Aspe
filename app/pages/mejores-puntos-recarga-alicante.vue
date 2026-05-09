<script setup lang="ts">
const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = `${siteUrl}/mejores-puntos-recarga-alicante`;

useSeoMeta({
  title: 'Mejores Puntos de Recarga en Alicante (Aspe) | Ranking y Fiabilidad',
  description: 'Analiza los mejores puntos de recarga en Aspe, Alicante, según disponibilidad, fiabilidad y ocupación histórica.',
  keywords: 'mejores puntos recarga alicante, ranking cargadores alicante, cargadores fiables aspe',
  ogTitle: 'Ranking de Puntos de Recarga en Aspe',
  ogDescription: 'Comparativa de fiabilidad y disponibilidad de cargadores en Aspe (Alicante).',
  ogUrl: canonicalUrl,
});

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
});
</script>

<template>
  <main class="min-h-screen bg-[linear-gradient(160deg,#020617_20%,#0f172a_100%)] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-5xl space-y-6">
      <section class="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
        <h1 class="text-3xl font-extrabold text-white md:text-5xl">Mejores puntos de recarga en Alicante (Aspe)</h1>
        <p class="mt-4 text-sm text-slate-300 md:text-base">
          Ranking dinámico basado en disponibilidad, estabilidad y salud técnica de cada punto de carga monitorizado en Aspe.
        </p>
      </section>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-emerald-300">Qué medimos</h2>
          <ul class="mt-3 space-y-2 text-sm text-slate-300">
            <li>Disponibilidad media por franja horaria</li>
            <li>Porcentaje de uptime por estación</li>
            <li>Frecuencia de desconexiones y tiempo offline</li>
          </ul>
        </article>
        <article class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-amber-300">Cómo usarlo</h2>
          <ul class="mt-3 space-y-2 text-sm text-slate-300">
            <li>Consulta el ranking de red en la pestaña Inteligencia</li>
            <li>Filtra por cargador para ver su rendimiento real</li>
            <li>Combina ranking + predicción para decidir mejor</li>
          </ul>
        </article>
      </section>

      <NuxtLink to="/inteligencia" class="inline-flex rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300">
        Ver ranking en tiempo real
      </NuxtLink>
    </div>
  </main>
</template>
