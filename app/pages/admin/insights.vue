<script setup lang="ts">
const route = useRoute();
const runtimeConfig = useRuntimeConfig();

const expectedToken = runtimeConfig.public.siteUrl ? 'aspe-insights' : 'aspe-insights';
const providedToken = String(route.query.token ?? '');
const authorized = computed(() => providedToken === expectedToken);

const { data: anomaliesData, pending: anomaliesPending } = useFetch('/api/analytics/anomalies', {
  query: { period: '30d' },
  lazy: true,
});

const { data: recommendationsData, pending: recommendationsPending } = useFetch('/api/analytics/recommendations', {
  lazy: true,
});

const { data: rankingsData, pending: rankingsPending } = useFetch('/api/analytics/rankings', {
  query: { period: '30d' },
  lazy: true,
});

const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = `${siteUrl}/admin/insights`;

useSeoMeta({
  title: 'Panel de Insights | Cargadores Aspe',
  description: 'Panel interno con anomalías, recomendaciones y ranking de la red de cargadores de Aspe.',
  robots: 'noindex,nofollow',
  ogUrl: canonicalUrl,
});

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
});
</script>

<template>
  <main class="min-h-screen bg-[#020617] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl space-y-5">
      <header class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h1 class="text-2xl font-extrabold text-white sm:text-3xl">Panel de insights</h1>
        <p class="mt-2 text-sm text-slate-300">Anomalías, recomendaciones automáticas y ranking operativo.</p>
      </header>

      <div v-if="!authorized" class="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
        Acceso restringido. Añade ?token=aspe-insights en la URL para ver el panel.
      </div>

      <template v-else>
        <section class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2">
            <h2 class="text-xs uppercase tracking-wider text-slate-400">Anomalías</h2>
            <div v-if="anomaliesPending" class="mt-3 h-28 animate-pulse rounded-lg bg-slate-900" />
            <ul v-else class="mt-3 space-y-2 text-sm">
              <li v-for="(anom, idx) in anomaliesData?.anomalies ?? []" :key="`a-${idx}`" class="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <p class="font-semibold" :class="anom.severity === 'high' ? 'text-rose-300' : (anom.severity === 'medium' ? 'text-amber-300' : 'text-slate-200')">{{ anom.stationName }} · {{ anom.type }}</p>
                <p class="text-xs text-slate-400">{{ anom.description }}</p>
              </li>
            </ul>
          </article>

          <article class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 class="text-xs uppercase tracking-wider text-slate-400">Ranking</h2>
            <div v-if="rankingsPending" class="mt-3 h-28 animate-pulse rounded-lg bg-slate-900" />
            <ol v-else class="mt-3 space-y-2 text-sm">
              <li v-for="item in (rankingsData?.rankings ?? []).slice(0, 5)" :key="item.stationId" class="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300">
                #{{ item.position }} {{ item.icon }} {{ item.stationName }} · {{ item.value }}
              </li>
            </ol>
          </article>
        </section>

        <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 class="text-xs uppercase tracking-wider text-slate-400">Recomendaciones automáticas</h2>
          <div v-if="recommendationsPending" class="mt-3 h-24 animate-pulse rounded-lg bg-slate-900" />
          <ul v-else class="mt-3 space-y-2 text-sm text-slate-300">
            <li v-for="(rec, idx) in recommendationsData?.recommendations ?? []" :key="`r-${idx}`" class="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
              {{ rec.text }}
            </li>
          </ul>
        </section>
      </template>
    </div>
  </main>
</template>
