<script setup lang="ts">
/**
 * pages/diagnostico.vue — Diagnóstico Avanzado de Red de Cargadores
 * SEO: Saturación, Incidencias y Prioridades
 */
import { Zap, RefreshCw, Activity } from 'lucide-vue-next';

const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');

// ─── SEO para Diagnóstico ─────────────────────────────────────────────────
const SEO_DIAGNOSTICO = {
  title: 'Diagnóstico de Red de Cargadores en Aspe | Saturación y Mejoras',
  description: 'Diagnóstico avanzado de la red de recarga de Aspe: análisis de saturación, detección de incidencias y zonas prioritarias para refuerzo de puntos de carga.',
  keywords: 'diagnostico cargadores aspe, saturacion cargadores aspe, incidencias recarga aspe, zonas prioritarias cargadores aspe, mejoras red carga',
  ogTitle: 'Diagnóstico de Cargadores en Aspe',
  ogDescription: 'Estado de salud de la red de cargadores y prioridades de mejora en Aspe con análisis predictivo.',
};

const canonicalUrl = `${siteUrl}/diagnostico`;
const rootUrl = `${siteUrl}/`;

// ─── Datos y Estado ────────────────────────────────────────────────────────
const periodo = ref<'today' | '7d' | '30d'>('7d');
const cargadorSeleccionado = ref<'all' | string>('all');
const etaMinutes = ref(30);
const { trackAction } = useAnalytics();

const {
  data: diagnosticoData,
  pending: diagnosticoPending,
  refresh: refrescarDiagnostico,
} = useFetch('/api/analytics/diagnostic', {
  query: computed(() => ({
    periodo: periodo.value,
    station_id: cargadorSeleccionado.value === 'all' ? undefined : cargadorSeleccionado.value,
  })),
  watch: [periodo, cargadorSeleccionado],
  lazy: true,
});

const {
  data: etaData,
  pending: etaPending,
  refresh: refrescarEta,
} = useFetch('/api/analytics/eta', {
  query: computed(() => ({
    minutes: etaMinutes.value,
    station_id: cargadorSeleccionado.value === 'all' ? undefined : cargadorSeleccionado.value,
  })),
  watch: [etaMinutes, cargadorSeleccionado],
  lazy: true,
});

const refrescando = ref(false);

async function refrescarTodo() {
  refrescando.value = true;
  await Promise.all([
    refrescarDiagnostico(),
    refrescarEta(),
  ]);
  refrescando.value = false;
  trackAction('manual_refresh', { page: 'diagnostico' });
}

// ─── SEO Meta Tags ─────────────────────────────────────────────────────────
useSeoMeta(() => ({
  title: SEO_DIAGNOSTICO.title,
  description: SEO_DIAGNOSTICO.description,
  keywords: SEO_DIAGNOSTICO.keywords,
  ogTitle: SEO_DIAGNOSTICO.ogTitle,
  ogDescription: SEO_DIAGNOSTICO.ogDescription,
  ogType: 'website',
  ogLocale: 'es_ES',
  ogUrl: canonicalUrl,
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  twitterCard: 'summary_large_image',
  twitterTitle: SEO_DIAGNOSTICO.ogTitle,
  twitterDescription: SEO_DIAGNOSTICO.ogDescription,
}));

useHead(() => ({
  htmlAttrs: { lang: 'es' },
  link: [
    { rel: 'canonical', href: canonicalUrl },
    { rel: 'alternate', hreflang: 'es', href: rootUrl },
    { rel: 'alternate', hreflang: 'x-default', href: rootUrl },
  ],
  meta: [
    { name: 'geo.region', content: 'ES-VC' },
    { name: 'geo.placename', content: 'Aspe, Alicante, España' },
    { name: 'geo.position', content: '38.3485;-0.7639' },
    { name: 'ICBM', content: '38.3485, -0.7639' },
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Diagnóstico de Cargadores en Aspe',
        url: canonicalUrl,
        description: SEO_DIAGNOSTICO.description,
        inLanguage: 'es-ES',
        isPartOf: { '@type': 'WebSite', url: rootUrl },
      }),
    },
  ],
}));
</script>

<template>
  <main class="min-h-screen bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(251,113,133,0.08),transparent),#020617] px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl space-y-8">

      <!-- HEADER -->
      <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <Activity class="mr-2 inline h-7 w-7 text-rose-400" />
            Diagnóstico de Red
          </h1>
          <p class="mt-1 text-sm text-slate-400">
            Análisis avanzado de saturación, incidencias y prioridades de mejora
          </p>
        </div>
        <button
          class="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:opacity-50"
          :disabled="refrescando"
          @click="refrescarTodo"
        >
          <RefreshCw
            class="h-3.5 w-3.5 transition-transform"
            :class="{ 'animate-spin': refrescando }"
          />
          Actualizar
        </button>
      </header>

      <!-- FILTROS -->
      <section class="rounded-2xl border border-slate-800 p-4 bg-slate-900/30">
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2 rounded-xl border border-rose-800 bg-rose-950/50 px-2.5 py-1.5 text-xs text-rose-300">
            <span>Período</span>
            <select
              v-model="periodo"
              class="rounded-md border border-rose-700 bg-rose-900/30 px-2 py-1 text-xs text-rose-100 outline-none"
            >
              <option value="today">Hoy</option>
              <option value="7d">7 días</option>
              <option value="30d">30 días</option>
            </select>
          </div>
          <label class="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300">
            ETA en
            <select
              v-model.number="etaMinutes"
              class="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none"
            >
              <option :value="5">5 min</option>
              <option :value="15">15 min</option>
              <option :value="30">30 min</option>
              <option :value="60">60 min</option>
            </select>
          </label>
          <label class="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300">
            Cargador
            <select
              v-model="cargadorSeleccionado"
              class="max-w-[240px] rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none"
            >
              <option value="all">Todos</option>
              <option value="ESIBE22E0001001">ESIBE22E0001001 · Av. Carlos Soria</option>
              <option value="ESIBE22E0001002">ESIBE22E0001002 · Av. Constitución</option>
              <option value="ESIBE22E0001003">ESIBE22E0001003 · Av. Padre Ismael</option>
              <option value="ESIBE22E0001004">ESIBE22E0001004 · Av. Juan Carlos I</option>
              <option value="ESIBE22E0001005">ESIBE22E0001005 · Calle Orihuela</option>
            </select>
          </label>
        </div>
      </section>

      <!-- CONTENIDO -->
      <div v-if="diagnosticoPending || etaPending" class="h-56 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
      <AiDiagnostics
        v-else-if="diagnosticoData"
        :saturacion="diagnosticoData.saturacion"
        :averias="diagnosticoData.averias ?? []"
        :insights="diagnosticoData.insights ?? []"
        :zonas-prioritarias="diagnosticoData.zonasPrioritarias ?? []"
      />

      <!-- FOOTER -->
      <footer class="border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
        <NuxtLink to="/" class="hover:text-white">← Volver al inicio</NuxtLink>
      </footer>

    </div>
  </main>
</template>
