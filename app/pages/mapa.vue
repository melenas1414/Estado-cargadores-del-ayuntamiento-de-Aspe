<script setup lang="ts">
/**
 * pages/mapa.vue — Mapa Interactivo de Cargadores en Aspe
 * SEO: Mapa de Ubicaciones y Disponibilidad en Tiempo Real
 */
import { Zap, RefreshCw, MapPin } from 'lucide-vue-next';

const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');

// ─── SEO para Mapa ─────────────────────────────────────────────────────────
const SEO_MAPA = {
  title: 'Mapa de Cargadores de Coche en Aspe | Ubicaciones y Disponibilidad',
  description: 'Explora el mapa interactivo de cargadores de coche eléctrico en Aspe, Alicante. Consulta ubicación detallada de cada punto y disponibilidad actual de conectores.',
  keywords: 'mapa cargadores aspe, donde cargar coche electrico aspe, puntos de recarga aspe mapa, ubicacion cargadores aspe, cargadores en mapa',
  ogTitle: 'Mapa de Cargadores en Aspe',
  ogDescription: 'Ubicaciones de cargadores de coche eléctrico en Aspe con estado de disponibilidad en tiempo real.',
};

const canonicalUrl = `${siteUrl}/mapa`;
const rootUrl = `${siteUrl}/`;

// ─── Datos y Estado ────────────────────────────────────────────────────────
const periodo = ref<'today' | '7d' | '30d'>('7d');
const cargadorSeleccionado = ref<'all' | string>('all');
const { trackAction } = useAnalytics();

const STATION_COORDS: Record<string, { lat: number; lon: number }> = {
  ESIBE22E0001001: { lat: 38.341118679046346, lon: -0.7654778230267333 },
  ESIBE22E0001002: { lat: 38.3476704, lon: -0.7691027 },
  ESIBE22E0001003: { lat: 38.3498799, lon: -0.7649660 },
  ESIBE22E0001004: { lat: 38.3430059, lon: -0.7610202 },
  ESIBE22E0001005: { lat: 38.3385331, lon: -0.7766776 },
};

const STATION_MAP_LINKS: Record<string, string> = {
  ESIBE22E0001005: 'https://maps.app.goo.gl/9q9Jibv3bMDw16xG7',
};

const STATION_STREETS: Record<string, string> = {
  ESIBE22E0001001: 'Avenida Carlos Soria, 11',
  ESIBE22E0001002: 'Avenida Constitución, 42',
  ESIBE22E0001003: 'Avenida Padre Ismael, 34',
  ESIBE22E0001004: 'Avenida Juan Carlos I, 36',
  ESIBE22E0001005: 'Calle Orihuela, 100',
};

const {
  data: cargadoresData,
  pending: cargadoresPending,
  refresh: refrescarCargadores,
  error: cargadoresError,
} = useFetch('/api/chargers/current', { lazy: true });

const refrescando = ref(false);

async function refrescarTodo() {
  refrescando.value = true;
  await refrescarCargadores();
  refrescando.value = false;
  trackAction('manual_refresh', { page: 'mapa' });
}

const cargadores = computed(() => cargadoresData.value?.cargadores ?? []);
const ultimaActualizacion = computed(() => cargadoresData.value?.ultimaActualizacion ?? '');

const horaLegible = computed(() => {
  if (!ultimaActualizacion.value) return '—';
  return new Date(ultimaActualizacion.value).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Madrid',
  });
});

function libresPorCargador(c: any) {
  if (typeof c.available_connectors === 'number') return Math.max(0, Math.min(2, c.available_connectors));
  return c.is_available ? 1 : 0;
}

const disponibilidadPorPunto = computed(() => cargadores.value.map((c: any) => {
  const total = typeof c.total_connectors === 'number' && c.total_connectors > 0 ? c.total_connectors : 2;
  const libres = libresPorCargador(c);

  return {
    stationId: c.station_id,
    locationName: c.location_name,
    libres,
    ocupados: Math.max(0, total - libres),
    total,
    lat: STATION_COORDS[c.station_id]?.lat,
    lon: STATION_COORDS[c.station_id]?.lon,
    googleUrl:
      STATION_MAP_LINKS[c.station_id] ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.location_name)}`,
  };
}));

const puntosMapa = computed(() => {
  if (cargadorSeleccionado.value !== 'all') {
    return disponibilidadPorPunto.value.filter((p: any) => p.stationId === cargadorSeleccionado.value);
  }

  const byStation = new Map<string, any>(
    disponibilidadPorPunto.value.map((p: any) => [p.stationId, p]),
  );

  return Object.entries(STATION_COORDS).map(([stationId, coords]) => {
    const current = byStation.get(stationId);
    if (current) return current;
    const fallbackName = STATION_STREETS[stationId] ?? stationId;
    return {
      stationId,
      locationName: fallbackName,
      libres: 0,
      ocupados: 2,
      total: 2,
      lat: coords.lat,
      lon: coords.lon,
      googleUrl:
        STATION_MAP_LINKS[stationId] ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackName)}`,
    };
  });
});

function classesEstadoPunto(libres: number, total: number) {
  const totalSafe = total > 0 ? total : 1;
  const ratio = libres / totalSafe;

  if (ratio <= 0) {
    return {
      card: 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-400/60 hover:text-rose-200',
      detail: 'text-rose-300',
    };
  }

  if (ratio >= 1) {
    return {
      card: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/60 hover:text-emerald-200',
      detail: 'text-emerald-300',
    };
  }

  return {
    card: 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400/60 hover:text-amber-200',
    detail: 'text-amber-300',
  };
}

// ─── SEO Meta Tags ─────────────────────────────────────────────────────────
useSeoMeta(() => ({
  title: SEO_MAPA.title,
  description: SEO_MAPA.description,
  keywords: SEO_MAPA.keywords,
  ogTitle: SEO_MAPA.ogTitle,
  ogDescription: SEO_MAPA.ogDescription,
  ogType: 'website',
  ogLocale: 'es_ES',
  ogUrl: canonicalUrl,
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  twitterCard: 'summary_large_image',
  twitterTitle: SEO_MAPA.ogTitle,
  twitterDescription: SEO_MAPA.ogDescription,
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
        name: 'Mapa de Cargadores en Aspe',
        url: canonicalUrl,
        description: SEO_MAPA.description,
        inLanguage: 'es-ES',
        isPartOf: { '@type': 'WebSite', url: rootUrl },
      }),
    },
  ],
}));
</script>

<template>
  <main class="min-h-screen bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(34,211,238,0.08),transparent),#020617] px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl space-y-8">

      <!-- HEADER -->
      <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <MapPin class="mr-2 inline h-7 w-7 text-cyan-400" />
            Mapa de Cargadores en Aspe
          </h1>
          <p class="mt-1 text-sm text-slate-400">
            Ubicaciones en tiempo real con disponibilidad actual de conectores
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <p class="text-xs text-slate-500">Actualizado</p>
            <p class="text-sm font-medium text-slate-300">{{ horaLegible }}</p>
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
        </div>
      </header>

      <!-- FILTROS -->
      <section class="rounded-2xl border border-slate-800 p-4 bg-slate-900/30">
        <div class="flex flex-wrap items-center gap-2">
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

      <!-- ERROR -->
      <div
        v-if="cargadoresError"
        class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
      >
        Error al cargar los datos: {{ cargadoresError.message }}
      </div>

      <!-- MAPA -->
      <section class="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div class="mb-3 p-4 border-b border-slate-800">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            Mapa interactivo
          </h2>
          <p class="mt-1 text-xs text-slate-500">Aspe, Alicante · España</p>
        </div>

        <div class="overflow-hidden rounded-b-2xl border-t border-slate-800 bg-slate-900/70">
          <ClientOnly>
            <ChargersMap :points="puntosMapa" />
            <template #fallback>
              <div class="h-72 w-full animate-pulse bg-slate-900" />
            </template>
          </ClientOnly>
          <div class="grid grid-cols-1 gap-2 border-t border-slate-800 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <a
              v-for="p in puntosMapa"
              :key="`map-${p.stationId}`"
              :href="p.googleUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-lg border px-3 py-2 text-xs transition-colors"
              :class="classesEstadoPunto(p.libres, p.total).card"
            >
              <span class="block font-medium" :class="classesEstadoPunto(p.libres, p.total).detail">{{ p.stationId }} · {{ p.libres }}/{{ p.total }}</span>
              <span class="block truncate text-slate-500">{{ p.locationName }}</span>
            </a>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
        <NuxtLink to="/" class="hover:text-white">← Volver al inicio</NuxtLink>
      </footer>

    </div>
  </main>
</template>
