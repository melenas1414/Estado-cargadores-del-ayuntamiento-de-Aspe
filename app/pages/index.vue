<script setup lang="ts">
/**
 * pages/index.vue — Dashboard principal de Estado de Cargadores EV · Aspe
 *
 * Flujo de datos:
 * 1. useFetch('/api/chargers/current')         → estado en tiempo real
 * 2. useFetch('/api/analytics/heatmap?...')    → heatmap semanal
 * 3. useFetch('/api/analytics/prediction')     → predicción horaria
 * 4. useFetch('/api/analytics/metrics?...')    → KPIs de uso
 *
 * Los llamados de análisis se reactivan cuando cambia el período seleccionado.
 */
import { Zap, RefreshCw, MapPin, Wifi } from 'lucide-vue-next';

type Periodo = 'today' | '7d' | '30d';
type HorizontePrediccion = 0 | 1 | 2 | 3 | 7 | 14;

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

// ─── Estado de período seleccionado ─────────────────────────────────────────
const periodo = ref<Periodo>('7d');
const diasPrediccion = ref<HorizontePrediccion>(0);

// ─── Datos en tiempo real (cargadores) ──────────────────────────────────────
const {
  data:    cargadoresData,
  pending: cargadoresPending,
  refresh: refrescarCargadores,
  error:   cargadoresError,
} = useFetch('/api/chargers/current', {
  // lazy: true → renderiza la página inmediatamente con estado de carga
  lazy: true,
});

// ─── Análisis: heatmap ───────────────────────────────────────────────────────
const {
  data:    heatmapData,
  pending: heatmapPending,
  refresh: refrescarHeatmap,
} = useFetch('/api/analytics/heatmap', {
  query: computed(() => ({ periodo: periodo.value })),
  watch: [periodo],
  lazy: true,
});

// ─── Análisis: predicción ────────────────────────────────────────────────────
const {
  data:    prediccionData,
  pending: prediccionPending,
} = useFetch('/api/analytics/prediction', {
  query: computed(() => ({ dias: diasPrediccion.value })),
  watch: [diasPrediccion],
  lazy: true,
});

// ─── Análisis: métricas ──────────────────────────────────────────────────────
const {
  data:    metricasData,
  pending: metricasPending,
  refresh: refrescarMetricas,
} = useFetch('/api/analytics/metrics', {
  query: computed(() => ({ periodo: periodo.value })),
  watch: [periodo],
  lazy: true,
});

const etaMinutes = ref(30);

const {
  data:    diagnosticoData,
  pending: diagnosticoPending,
  refresh: refrescarDiagnostico,
} = useFetch('/api/analytics/diagnostic', {
  query: computed(() => ({ periodo: periodo.value })),
  watch: [periodo],
  lazy: true,
});

const {
  data:    etaData,
  pending: etaPending,
} = useFetch('/api/analytics/eta', {
  query: computed(() => ({ minutes: etaMinutes.value })),
  watch: [etaMinutes],
  lazy: true,
});

// ─── Refresco manual ─────────────────────────────────────────────────────────
const refrescando = ref(false);

async function refrescarTodo() {
  refrescando.value = true;
  await Promise.all([
    refrescarCargadores(),
    refrescarHeatmap(),
    refrescarMetricas(),
    refrescarDiagnostico(),
  ]);
  refrescando.value = false;
}

// ─── Refresco automático cada 60 s ────────────────────────────────────────
let intervaloRefresco: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  intervaloRefresco = setInterval(() => {
    refrescarCargadores();
  }, 60_000);
});

onBeforeUnmount(() => {
  if (intervaloRefresco !== null) clearInterval(intervaloRefresco);
});

// ─── Datos derivados ─────────────────────────────────────────────────────────
const cargadores   = computed(() => cargadoresData.value?.cargadores ?? []);
const ultimaActualizacion = computed(() => cargadoresData.value?.ultimaActualizacion ?? '');

function libresPorCargador(c: any) {
  if (typeof c.available_connectors === 'number') return Math.max(0, Math.min(2, c.available_connectors));
  return c.is_available ? 1 : 0;
}

const libres   = computed(() => cargadores.value.filter((c: any) => c.is_available).length);
const ocupados = computed(() => cargadores.value.filter((c: any) => !c.is_available).length);
const conectoresLibres = computed(() => cargadores.value.reduce((sum: number, c: any) => {
  return sum + libresPorCargador(c);
}, 0));
const conectoresTotales = computed(() => cargadores.value.reduce((sum: number, c: any) => {
  if (typeof c.total_connectors === 'number' && c.total_connectors > 0) return sum + c.total_connectors;
  return sum + 2;
}, 0));

const horaLegible = computed(() => {
  if (!ultimaActualizacion.value) return '—';
  return new Date(ultimaActualizacion.value).toLocaleTimeString('es-ES', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Madrid',
  });
});

// Supertítulo de estado global
const estadoGlobal = computed(() => {
  if (!cargadores.value.length) return null;
  if (conectoresLibres.value === conectoresTotales.value) {
    return { texto: `${conectoresLibres.value}/${conectoresTotales.value} conectores libres`, clase: 'text-emerald-400' };
  }
  if (conectoresLibres.value === 0) {
    return { texto: `0/${conectoresTotales.value} conectores libres`, clase: 'text-rose-400' };
  }
  return { texto: `${conectoresLibres.value}/${conectoresTotales.value} conectores libres`, clase: 'text-amber-400' };
});

const disponibilidadPorPunto = computed(() => cargadores.value.map((c: any) => {
  const total = typeof c.total_connectors === 'number' && c.total_connectors > 0 ? c.total_connectors : 2;
  const libres = libresPorCargador(c);
  const ocupados = Math.max(0, total - libres);

  return {
    stationId: c.station_id,
    locationName: c.location_name,
    libres,
    ocupados,
    total,
    lat: STATION_COORDS[c.station_id]?.lat,
    lon: STATION_COORDS[c.station_id]?.lon,
    googleUrl:
      STATION_MAP_LINKS[c.station_id] ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.location_name)}`,
  };
}));

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

const runtimeConfig = useRuntimeConfig();
const requestUrl = useRequestURL();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const canonicalPath = requestUrl.pathname || '/';
const canonicalUrl = `${siteUrl}${canonicalPath}`;

// ─── SEO estructurado ────────────────────────────────────────────────────────
// Datos de estaciones para JSON-LD (LocalBusiness por punto de carga)
const SEO_STATIONS = [
  { id: 'ESIBE22E0001001', name: 'Cargador Eléctrico Aspe · Av. Carlos Soria',  street: 'Avenida Carlos Soria, 11',  lat: 38.341118679046346, lon: -0.7654778230267333 },
  { id: 'ESIBE22E0001002', name: 'Cargador Eléctrico Aspe · Av. Constitución',  street: 'Avenida Constitución, 42', lat: 38.3476704, lon: -0.7691027 },
  { id: 'ESIBE22E0001003', name: 'Cargador Eléctrico Aspe · Av. Padre Ismael',  street: 'Avenida Padre Ismael, 34', lat: 38.3498799, lon: -0.7649660 },
  { id: 'ESIBE22E0001004', name: 'Cargador Eléctrico Aspe · Av. Juan Carlos I', street: 'Avenida Juan Carlos I, 36', lat: 38.3430059, lon: -0.7610202 },
  { id: 'ESIBE22E0001005', name: 'Cargador Eléctrico Aspe · Calle Orihuela',    street: 'Calle Orihuela, 100',      lat: 38.3385331, lon: -0.7766776 },
];

useSeoMeta({
  title: 'Cargadores Eléctricos en Aspe (Alicante) · Disponibilidad en Tiempo Real + Mapa',
  description:
    'Consulta en tiempo real el estado de los 5 puntos de carga eléctrica del Ayuntamiento de Aspe (Alicante). Tipo 2 · 11 kW · Iberdrola. Mapa, disponibilidad libre/ocupado y predicción de mejor hora para cargar tu coche eléctrico.',
  keywords:
    'cargadores electricos aspe, puntos de recarga aspe, cargador tipo 2 aspe, cargar coche electrico aspe alicante, iberdrola aspe, punto recarga ayuntamiento aspe, cargador ev aspe, estado cargadores aspe, mapa cargadores aspe, recarga vehiculo electrico aspe, aspe carga electrica, cargadores publicos aspe, cargador 11kw aspe, donde cargar coche electrico aspe',
  ogTitle: 'Cargadores Eléctricos Aspe · Estado en Tiempo Real',
  ogDescription:
    '5 puntos de carga pública en Aspe (Alicante). Tipo 2 · 11 kW. Consulta disponibilidad en tiempo real, mapa y predicción de mejor hora para recargar tu vehículo eléctrico.',
  ogType: 'website',
  ogLocale: 'es_ES',
  ogUrl: canonicalUrl,
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Cargadores Eléctricos en Aspe · Tiempo Real',
  twitterDescription: '5 puntos de recarga pública en Aspe, Alicante. Tipo 2 · 11 kW · Mapa + IA.',
});

useHead({
  htmlAttrs: { lang: 'es' },
  link: [
    { rel: 'canonical', href: canonicalUrl },
  ],
  meta: [
    // Geo meta tags para SEO local
    { name: 'geo.region',    content: 'ES-VC' },
    { name: 'geo.placename', content: 'Aspe, Alicante, España' },
    { name: 'geo.position',  content: '38.3485;-0.7639' },
    { name: 'ICBM',          content: '38.3485, -0.7639' },
  ],
  script: [
    // ── 1. WebSite ────────────────────────────────────────────────────────────
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Estado de Cargadores de Aspe',
        alternateName: 'Cargadores Aspe',
        url: canonicalUrl,
        description:
          'Monitor en tiempo real de disponibilidad de cargadores eléctricos públicos en Aspe (Alicante). Fuente: Google Places · Actualización cada 15 min.',
        inLanguage: 'es-ES',
        creator:   { '@type': 'Organization', name: 'OnlineExpansions', url: 'https://onlineexpansions.com' },
        publisher: { '@type': 'Organization', name: 'OnlineExpansions', url: 'https://onlineexpansions.com' },
        about: {
          '@type': 'City',
          name: 'Aspe',
          containedInPlace: { '@type': 'AdministrativeArea', name: 'Alicante' },
        },
      }),
    },

    // ── 2. ItemList · LocalBusiness por punto de carga ────────────────────────
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Puntos de carga eléctrica pública en Aspe, Alicante',
        description:
          '5 puntos de recarga para vehículos eléctricos del Ayuntamiento de Aspe gestionados por Iberdrola. Conector Tipo 2 · 11 kW.',
        numberOfItems: SEO_STATIONS.length,
        itemListElement: SEO_STATIONS.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'LocalBusiness',
            '@id': `${canonicalUrl}#${s.id}`,
            name: s.name,
            description: `Punto de carga eléctrica pública en Aspe (Alicante). Conector Tipo 2 · 11 kW AC. ID REEV: ${s.id}. Gestionado por Iberdrola.`,
            url: canonicalUrl,
            address: {
              '@type': 'PostalAddress',
              streetAddress:   s.street,
              addressLocality: 'Aspe',
              addressRegion:   'Alicante',
              postalCode:      '03680',
              addressCountry:  'ES',
            },
            geo: {
              '@type':    'GeoCoordinates',
              latitude:   s.lat,
              longitude:  s.lon,
            },
            amenityFeature: [
              { '@type': 'LocationFeatureSpecification', name: 'Conector Tipo 2 (IEC 62196)', value: true },
              { '@type': 'LocationFeatureSpecification', name: 'Potencia 11 kW AC',           value: true },
              { '@type': 'LocationFeatureSpecification', name: 'Carga pública 24h',            value: true },
              { '@type': 'LocationFeatureSpecification', name: '2 conectores por punto',       value: true },
            ],
            openingHoursSpecification: {
              '@type':      'OpeningHoursSpecification',
              dayOfWeek:    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
              opens:        '00:00',
              closes:       '23:59',
            },
            areaServed: {
              '@type': 'City',
              name: 'Aspe',
              containedInPlace: { '@type': 'AdministrativeArea', name: 'Alicante' },
            },
            servesCuisine: null,
          },
        })),
      }),
    },

    // ── 3. FAQPage · preguntas frecuentes sobre cargadores en Aspe ────────────
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: '¿Dónde hay cargadores para coches eléctricos en Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Aspe dispone de 5 puntos de carga pública gestionados por Iberdrola: Avenida Carlos Soria 11, Avenida Constitución 42, Avenida Padre Ismael 34, Avenida Juan Carlos I 36 y Calle Orihuela 100. Todos en el término municipal de Aspe (Alicante), código postal 03680.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Qué tipo de conector tienen los cargadores eléctricos de Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Los cargadores de Aspe disponen de conectores Tipo 2 (IEC 62196) con una potencia de 11 kW en corriente alterna (AC). Este estándar es compatible con la gran mayoría de vehículos eléctricos e híbridos enchufables europeos.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Cuántos conectores tiene cada punto de recarga de Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Cada punto de carga en Aspe dispone de 2 conectores Tipo 2 de 11 kW, lo que permite cargar dos vehículos simultáneamente. En total, Aspe cuenta con 10 conectores repartidos en 5 ubicaciones.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Son gratuitos los cargadores eléctricos del Ayuntamiento de Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Los puntos de recarga del Ayuntamiento de Aspe están gestionados por Iberdrola. Para conocer las tarifas y condiciones más actualizadas, consulta la aplicación oficial Iberdrola e-mobility o el portal del Ayuntamiento de Aspe.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Cuál es la mejor hora para cargar el coche eléctrico en Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Según el análisis histórico de disponibilidad, los cargadores de Aspe suelen estar más libres durante las primeras horas de la mañana (7:00-9:00h) y al mediodía (13:00-15:00h). En esta página encontrarás una predicción actualizada basada en inteligencia artificial.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Cómo saber si los cargadores de Aspe están libres ahora mismo?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Puedes consultar el estado en tiempo real directamente en esta página. Los datos se actualizan cada 15 minutos a través de la API de Google Places. Verás el estado libre u ocupado de cada uno de los 5 puntos de recarga de Aspe.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Hay cargadores rápidos (DC) en Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Los cargadores públicos de Aspe son de tipo semi-rápido con 11 kW en corriente alterna (AC). Actualmente no hay cargadores ultra-rápidos de corriente continua (DC) tipo CCS Combo 2 o CHAdeMO en Aspe.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Con qué frecuencia se actualiza el estado de los cargadores de Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'El estado de los cargadores de Aspe se actualiza automáticamente cada 15 minutos mediante Supabase Edge Functions y la API oficial de Google Places, ofreciendo información de disponibilidad casi en tiempo real.',
            },
          },
        ],
      }),
    },

    // ── 4. BreadcrumbList ─────────────────────────────────────────────────────
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio',                          item: canonicalUrl },
          { '@type': 'ListItem', position: 2, name: 'Cargadores Eléctricos en Aspe',   item: canonicalUrl },
        ],
      }),
    },
  ],
});
</script>

<template>
  <main class="min-h-screen bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl space-y-8">

      <!-- ════════ HEADER ════════ -->
      <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <!-- Indicador de estado global -->
          <div
            v-if="estadoGlobal"
            class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider"
            :class="estadoGlobal.clase"
          >
            <Wifi class="h-3 w-3" />
            {{ estadoGlobal.texto }}
          </div>

          <h1 class="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <Zap class="mr-2 inline h-7 w-7 text-blue-400" fill="currentColor" />
            Estado de Carga en Aspe
          </h1>
          <p class="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
            <MapPin class="h-3.5 w-3.5" />
            Iberdrola 22 kW · Ayuntamiento de Aspe, Alicante
          </p>
        </div>

        <!-- Última actualización + botón de refresco -->
        <div class="flex items-center gap-3">
          <div class="text-right">
            <p class="text-xs text-slate-500">Última actualización</p>
            <p class="text-sm font-medium text-slate-300">{{ horaLegible }}</p>
          </div>
          <button
            class="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900
                   px-3 py-2 text-xs font-medium text-slate-300 transition-all
                   hover:border-slate-600 hover:text-white disabled:opacity-50"
            :disabled="refrescando"
            title="Actualizar ahora"
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

      <!-- ════════ DISPONIBILIDAD POR PUNTO ════════ -->
      <!-- ════════ ERROR ════════ -->
      <div
        v-if="cargadoresError"
        class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
      >
        Error al cargar los datos: {{ cargadoresError.message }}
      </div>

      <!-- ════════ TARJETAS EN TIEMPO REAL ════════ -->
      <section aria-labelledby="estado-actual">
        <h2
          id="estado-actual"
          class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Estado Actual · {{ cargadores.length }} puntos · {{ conectoresLibres }}/{{ conectoresTotales }} conectores libres
        </h2>

        <!-- Skeleton mientras carga -->
        <div
          v-if="cargadoresPending && !cargadores.length"
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          <div
            v-for="i in 5"
            :key="i"
            class="h-36 animate-pulse rounded-2xl border border-slate-800 bg-slate-900"
          />
        </div>

        <div
          v-else
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          <ChargerCard
            v-for="c in cargadores"
            :key="c.station_id"
            :station-id="c.station_id"
            :location-name="c.location_name"
            :is-available="c.is_available"
            :power-kw="c.power_kw"
            :updated-at="c.availability_updated_at || c.created_at"
            :available-connectors="libresPorCargador(c)"
            :total-connectors="c.total_connectors || 2"
            :connector-type="c.connector_type"
            :connectors="c.connectors"
          />
        </div>
      </section>

      <!-- ════════ MAPA DE UBICACIONES ════════ -->
      <section aria-labelledby="mapa-ubicaciones">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2
            id="mapa-ubicaciones"
            class="text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Mapa y Disponibilidad por Cargador
          </h2>
          <span class="text-[11px] text-slate-500">Aspe · Alicante</span>
        </div>

        <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <ClientOnly>
            <ChargersMap :points="disponibilidadPorPunto" />
            <template #fallback>
              <div class="h-72 w-full animate-pulse bg-slate-900" />
            </template>
          </ClientOnly>
          <div class="grid grid-cols-1 gap-2 border-t border-slate-800 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <a
              v-for="p in disponibilidadPorPunto"
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

      <!-- ════════ INTELIGENCIA / ANALÍTICA ════════ -->
      <section aria-labelledby="analitica">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="analitica"
            class="text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Análisis e Inteligencia
          </h2>
          <div class="flex flex-wrap items-center gap-2">
            <!-- Filtro de período -->
            <FilterButtons v-model="periodo" />
            <label class="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300">
              IA en
              <select
                v-model.number="diasPrediccion"
                class="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none"
              >
                <option :value="0">hoy</option>
                <option :value="1">1 día</option>
                <option :value="2">2 días</option>
                <option :value="3">3 días</option>
                <option :value="7">7 días</option>
                <option :value="14">14 días</option>
              </select>
            </label>
          </div>
        </div>

        <!-- ── Fila 1: heatmap + predicción ───────────────────────────── -->
        <div class="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <!-- Heatmap semanal -->
          <div v-if="heatmapPending" class="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
          <WeeklyHeatmap
            v-else-if="heatmapData"
            :datos="heatmapData.datos ?? []"
          />

          <!-- Widget de predicción -->
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

        <!-- ── Fila 2: métricas de uso ─────────────────────────────────── -->
        <div v-if="metricasPending" class="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
        <UsageStats
          v-else-if="metricasData"
          :tasa-ocupacion-media="metricasData.tasaOcupacionMedia"
          :sesiones-estimadas="metricasData.sesionesEstimadas"
          :minutos-ocupados-medio="metricasData.minutosOcupadosMedio"
          :cargador-mas-usado="metricasData.cargadorMasUsado"
          :por-estacion="metricasData.porEstacion ?? []"
        />

        <div v-if="diagnosticoPending || etaPending" class="mt-4 h-56 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
        <AiDiagnostics
          v-else-if="diagnosticoData"
          class="mt-4"
          :saturacion="diagnosticoData.saturacion"
          :averias="diagnosticoData.averias ?? []"
          :insights="diagnosticoData.insights ?? []"
          :eta-minutes="etaMinutes"
          :eta-data="etaData ?? null"
          @update:eta-minutes="etaMinutes = $event"
        />
      </section>

      <!-- ════════ FOOTER ════════ -->
      <footer class="border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
        Datos actualizados cada 15 minutos por Supabase Cron + Edge Functions · Fuente principal: OpenChargeMap ·
        <a
          href="https://github.com/melenas1414/Estado-cargadores-del-ayuntamiento-de-Aspe"
          target="_blank"
          rel="noopener noreferrer"
          class="text-slate-500 underline-offset-2 hover:text-slate-400 hover:underline"
        >
          Código fuente
        </a>
        <span class="mx-1">·</span>
        Desarrollado por
        <a
          href="https://onlineexpansions.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-slate-400 underline-offset-2 hover:text-white hover:underline"
        >
          OnlineExpansions
        </a>
      </footer>

    </div>
  </main>
</template>
