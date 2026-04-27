<script setup lang="ts">
/**
 * pages/inteligencia.vue — Inteligencia y Analítica de Cargadores
 * SEO: Predicción y Análisis de Disponibilidad
 */
import { Zap, RefreshCw, BrainCircuit } from 'lucide-vue-next';

const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');

// ─── SEO para Inteligencia ─────────────────────────────────────────────────
const SEO_INTELIGENCIA = {
  title: 'Predicción de Carga en Aspe | Mejores Horas para Recargar tu Coche Eléctrico',
  description: 'Consulta analítica y predicción con IA para cargar tu coche eléctrico en Aspe: heatmap histórico, franjas recomendadas y tendencias de ocupación en tiempo real.',
  keywords: 'mejor hora cargar coche electrico aspe, prediccion cargadores aspe, analitica recarga aspe, ocupacion cargadores aspe, disponibilidad prediccion',
  ogTitle: 'Predicción de Carga en Aspe',
  ogDescription: 'Análisis histórico y predicción de disponibilidad de cargadores en Aspe con recomendaciones personalizadas.',
};

const canonicalUrl = `${siteUrl}/inteligencia`;
const rootUrl = `${siteUrl}/`;

// ─── Datos y Estado ────────────────────────────────────────────────────────
const periodo = ref<'today' | '7d' | '30d'>('7d');
const diasPrediccion = ref<0 | 1 | 2 | 3 | 7 | 14>(0);
const cargadorSeleccionado = ref<'all' | string>('all');
const { trackAction } = useAnalytics();

const {
  data: heatmapData,
  pending: heatmapPending,
  refresh: refrescarHeatmap,
} = useFetch('/api/analytics/heatmap', {
  query: computed(() => ({
    periodo: periodo.value,
    station_id: cargadorSeleccionado.value === 'all' ? undefined : cargadorSeleccionado.value,
  })),
  watch: [periodo, cargadorSeleccionado],
  lazy: true,
});

const {
  data: prediccionData,
  pending: prediccionPending,
  refresh: refrescarPrediccion,
} = useFetch('/api/analytics/prediction', {
  query: computed(() => ({
    dias: diasPrediccion.value,
    station_id: cargadorSeleccionado.value === 'all' ? undefined : cargadorSeleccionado.value,
  })),
  watch: [diasPrediccion, cargadorSeleccionado],
  lazy: true,
});

const {
  data: metricasData,
  pending: metricasPending,
  refresh: refrescarMetricas,
} = useFetch('/api/analytics/metrics', {
  query: computed(() => ({
    periodo: periodo.value,
    station_id: cargadorSeleccionado.value === 'all' ? undefined : cargadorSeleccionado.value,
  })),
  watch: [periodo, cargadorSeleccionado],
  lazy: true,
});

const refrescando = ref(false);

async function refrescarTodo() {
  refrescando.value = true;
  await Promise.all([
    refrescarHeatmap(),
    refrescarMetricas(),
    refrescarPrediccion(),
  ]);
  refrescando.value = false;
  trackAction('manual_refresh', { page: 'inteligencia' });
}

// ─── SEO Meta Tags ─────────────────────────────────────────────────────────
useSeoMeta(() => ({
  title: SEO_INTELIGENCIA.title,
  description: SEO_INTELIGENCIA.description,
  keywords: SEO_INTELIGENCIA.keywords,
  ogTitle: SEO_INTELIGENCIA.ogTitle,
  ogDescription: SEO_INTELIGENCIA.ogDescription,
  ogType: 'website',
  ogLocale: 'es_ES',
  ogUrl: canonicalUrl,
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  twitterCard: 'summary_large_image',
  twitterTitle: SEO_INTELIGENCIA.ogTitle,
  twitterDescription: SEO_INTELIGENCIA.ogDescription,
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
        name: 'Predicción de Carga en Aspe',
        url: canonicalUrl,
        description: SEO_INTELIGENCIA.description,
        inLanguage: 'es-ES',
        isPartOf: { '@type': 'WebSite', url: rootUrl },
      }),
    },
  ],
}));
</script>

<template>
  <main class="min-h-screen bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(251,191,36,0.08),transparent),#020617] px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl space-y-8">

      <!-- HEADER -->
      <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <BrainCircuit class="mr-2 inline h-7 w-7 text-amber-400" />
            Inteligencia y Predicción
          </h1>
          <p class="mt-1 text-sm text-slate-400">
            Análisis histórico y predicción de disponibilidad con inteligencia artificial
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
          <div class="flex items-center gap-2 rounded-xl border border-amber-800 bg-amber-950/50 px-2.5 py-1.5 text-xs text-amber-300">
            <span>Período</span>
            <select
              v-model="periodo"
              class="rounded-md border border-amber-700 bg-amber-900/30 px-2 py-1 text-xs text-amber-100 outline-none"
            >
              <option value="today">Hoy</option>
              <option value="7d">7 días</option>
              <option value="30d">30 días</option>
            </select>
          </div>
          <label class="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300">
            Horizonte IA
            <select
              v-model.number="diasPrediccion"
              class="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none"
            >
              <option :value="0">Hoy</option>
              <option :value="1">1 día</option>
              <option :value="2">2 días</option>
              <option :value="3">3 días</option>
              <option :value="7">7 días</option>
              <option :value="14">14 días</option>
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
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div v-if="heatmapPending" class="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
        <WeeklyHeatmap
          v-else-if="heatmapData"
          :datos="heatmapData.datos ?? []"
        />

        <div v-if="prediccionPending" class="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
        <PredictionWidget
          v-else-if="prediccionData"
          :mejor-hora="prediccionData.mejorHora"
          :probabilidad="prediccionData.probabilidad"
          :dia-semana="prediccionData.diaSemana"
          :fecha-objetivo="prediccionData.fechaObjetivo"
          :dias-hacia-futuro="prediccionData.diasHaciaFuturo"
          :franjas="prediccionData.franjas"
          :horas-recomendadas="prediccionData.horasRecomendadas"
          :hay-suficientes-datos="prediccionData.haySuficientesDatos"
          :dias-con-datos="prediccionData.diasConDatos"
          :muestras-totales="prediccionData.muestrasTotales"
          :dias-minimos-recomendados="prediccionData.diasMinimosRecomendados"
          :dias-faltantes-estimados="prediccionData.diasFaltantesEstimados"
          :ventana-historica-dias="prediccionData.ventanaHistoricaDias"
        />
      </div>

      <div v-if="metricasPending" class="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
      <UsageStats
        v-else-if="metricasData"
        :tasa-ocupacion-media="metricasData.tasaOcupacionMedia"
        :sesiones-estimadas="metricasData.sesionesEstimadas"
        :minutos-ocupados-medio="metricasData.minutosOcupadosMedio"
        :cargador-mas-usado="metricasData.cargadorMasUsado"
        :por-estacion="metricasData.porEstacion ?? []"
      />

      <!-- FOOTER -->
      <footer class="border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
        <NuxtLink to="/" class="hover:text-white">← Volver al inicio</NuxtLink>
      </footer>

    </div>
  </main>
</template>
