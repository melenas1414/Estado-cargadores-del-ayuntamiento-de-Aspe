<script setup lang="ts">
import WeeklyHeatmap from '~/components/WeeklyHeatmap.vue';

const route = useRoute();
const stationId = computed(() => String(route.params.id ?? '').trim());

const { data: healthData, pending: healthPending } = useFetch('/api/analytics/charger-health', {
  query: computed(() => ({
    periodo: '30d',
    station_id: stationId.value,
  })),
  watch: [stationId],
  lazy: true,
});

const { data: occHourData, pending: occHourPending } = useFetch('/api/analytics/occupancy-by-hour', {
  query: computed(() => ({
    periodo: '30d',
    station_id: stationId.value,
  })),
  watch: [stationId],
  lazy: true,
});

const { data: occDayData, pending: occDayPending } = useFetch('/api/analytics/occupancy-by-day', {
  query: computed(() => ({
    periodo: '30d',
    station_id: stationId.value,
  })),
  watch: [stationId],
  lazy: true,
});

const { data: durationData, pending: durationPending } = useFetch('/api/analytics/occupation-duration', {
  query: computed(() => ({
    dias_historico: 90,
    station_id: stationId.value,
  })),
  watch: [stationId],
  lazy: true,
});

const { data: releaseData, pending: releasePending } = useFetch('/api/analytics/estimated-release', {

  const { data: heatmapData, pending: heatmapPending } = useFetch('/api/analytics/heatmap', {
    query: computed(() => ({
      periodo: '30d',
      station_id: stationId.value,
    })),
    watch: [stationId],
    lazy: true,
  });

  const { data: recommendationsData, pending: recommendationsPending } = useFetch('/api/analytics/recommendations', {
    query: computed(() => ({
      station_id: stationId.value,
    })),
    watch: [stationId],
    lazy: true,
  });

  const { data: anomaliesData, pending: anomaliesPending } = useFetch('/api/analytics/anomalies', {
    query: computed(() => ({
      period: '30d',
      station_id: stationId.value,
    })),
    watch: [stationId],
    lazy: true,
  });
  query: computed(() => ({
    dias_historico: 90,
    station_id: stationId.value,
  })),
  watch: [stationId],
  lazy: true,
});

const stationHealth = computed(() => healthData.value?.porEstacion?.[0] ?? null);

const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalUrl = computed(() => `${siteUrl}/charger/${encodeURIComponent(stationId.value || '')}`);

useSeoMeta({
  title: () => `Detalle del cargador ${stationId.value} | Aspe`,
  description: () => `Analítica histórica, salud y predicción del cargador ${stationId.value} en Aspe.`,
  ogTitle: () => `Detalle cargador ${stationId.value}`,
  ogDescription: () => `Estado, salud y tendencias del cargador ${stationId.value}.`,
  ogUrl: () => canonicalUrl.value,
});

useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
}));
</script>

<template>
  <main class="min-h-screen bg-[#020617] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-5xl space-y-5">
      <header class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <p class="text-xs uppercase tracking-wider text-slate-400">Ficha de cargador</p>
        <h1 class="mt-1 text-2xl font-extrabold text-white sm:text-3xl">{{ stationId }}</h1>
        <p class="mt-2 text-sm text-slate-300">Detalle de salud técnica, ocupación y tiempo estimado de liberación.</p>
      </header>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-4">
        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-2">
          <p class="text-xs text-slate-500">Estado de salud (30d)</p>
          <div v-if="healthPending" class="mt-2 h-16 animate-pulse rounded-lg bg-slate-900" />
          <div v-else class="mt-2">
            <p class="text-xl font-semibold text-white">{{ stationHealth?.locationName ?? 'Sin datos' }}</p>
            <p class="text-sm text-slate-300">Uptime {{ stationHealth?.uptime ?? 0 }}% · Offline {{ stationHealth?.tiempoOfflineHoras ?? 0 }}h</p>
            <p class="text-sm text-slate-400">Desconexiones {{ stationHealth?.desconexiones ?? 0 }} · Fiabilidad {{ stationHealth?.fiabilidad ?? 'N/D' }}</p>
          </div>
        </article>

        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p class="text-xs text-slate-500">Duración media</p>
          <div v-if="durationPending" class="mt-2 h-16 animate-pulse rounded-lg bg-slate-900" />
          <div v-else>
            <p class="mt-2 text-3xl font-bold text-white">{{ durationData?.duracionMediaMin ?? 0 }} min</p>
            <p class="text-xs text-slate-500">P90 {{ durationData?.p90Min ?? 0 }} min</p>
          </div>
        </article>

        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p class="text-xs text-slate-500">ETA liberación</p>
          <div v-if="releasePending" class="mt-2 h-16 animate-pulse rounded-lg bg-slate-900" />
          <div v-else>
            <p class="mt-2 text-3xl font-bold text-white">{{ releaseData?.estimatedMinutesUntilFree ?? 0 }} min</p>
            <p class="text-xs text-slate-500">Confianza {{ releaseData?.confianza ?? 'baja' }}</p>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 class="text-xs uppercase tracking-wider text-slate-400">Ocupación por hora</h2>
          <div v-if="occHourPending" class="mt-3 h-24 animate-pulse rounded-lg bg-slate-900" />
          <div v-else class="mt-3 flex h-24 items-end gap-1">
            <div v-for="point in occHourData?.points ?? []" :key="`h-${point.hour}`" class="flex-1" :title="`${point.hour}h ${point.occupancyPct}%`">
              <div class="w-full rounded-t-sm bg-cyan-400/80" :style="{ height: `${Math.max(3, point.occupancyPct)}%` }" />
            </div>
          </div>
        </article>

        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 class="text-xs uppercase tracking-wider text-slate-400">Ocupación por día</h2>
          <div v-if="occDayPending" class="mt-3 h-24 animate-pulse rounded-lg bg-slate-900" />
          <div v-else class="mt-3 space-y-2">
            <div v-for="point in occDayData?.points ?? []" :key="`d-${point.dayIndex}`" class="space-y-1">
              <div class="flex justify-between text-xs text-slate-300"><span>{{ point.dayLabel }}</span><span>{{ point.occupancyPct }}%</span></div>
              <div class="h-2 rounded-full bg-slate-800"><div class="h-full rounded-full bg-amber-400" :style="{ width: `${point.occupancyPct}%` }" /></div>
            </div>
          </div>
        </article>
      </section>

      <NuxtLink to="/" class="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500">Volver al dashboard</NuxtLink>

        <!-- Heatmap semanal -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Mapa de calor semanal</h2>
          <div v-if="heatmapPending" class="mt-3 h-48 animate-pulse rounded-xl bg-slate-900" />
          <WeeklyHeatmap v-else-if="heatmapData" :datos="heatmapData.datos ?? []" class="mt-3" />
          <p v-else class="mt-3 text-xs text-slate-500">Sin datos suficientes.</p>
        </section>

        <!-- Insights y anomalías -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Insights automáticos</h2>
            <div v-if="recommendationsPending" class="mt-3 h-24 animate-pulse rounded-xl bg-slate-900" />
            <ul v-else-if="recommendationsData?.recommendations?.length" class="mt-3 space-y-2 text-xs text-slate-300">
              <li
                v-for="(rec, i) in recommendationsData.recommendations"
                :key="`rec-${i}`"
                class="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
              >
                {{ rec.text }}
              </li>
            </ul>
            <p v-else class="mt-3 text-xs text-slate-500">No hay insights para este cargador.</p>
          </section>

          <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Anomalías detectadas</h2>
            <div v-if="anomaliesPending" class="mt-3 h-24 animate-pulse rounded-xl bg-slate-900" />
            <ul v-else-if="anomaliesData?.anomalies?.length" class="mt-3 space-y-2 text-xs text-slate-300">
              <li
                v-for="(a, i) in anomaliesData.anomalies"
                :key="`anom-${i}`"
                class="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
              >
                <p
                  class="font-semibold"
                  :class="a.severity === 'high' ? 'text-rose-300' : a.severity === 'medium' ? 'text-amber-300' : 'text-slate-300'"
                >
                  {{ a.type }}
                </p>
                <p class="text-slate-400">{{ a.description }}</p>
              </li>
            </ul>
            <p v-else class="mt-3 text-xs text-slate-500">No se detectan anomalías.</p>
          </section>
        </div>

    </div>
  </main>
</template>
