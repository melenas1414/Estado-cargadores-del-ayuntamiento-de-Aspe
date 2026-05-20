//

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useFetch, useRuntimeConfig, useSeoMeta, useHead } from '#imports';
import 'leaflet/dist/leaflet.css';
import FilterButtons from '~/components/FilterButtons.vue';
import WeeklyHeatmap from '~/components/WeeklyHeatmap.vue';

const periodo = ref('7d');
const tooltipActivo = ref<string | null>(null);

const route = useRoute();
const stationId = computed(() => String(route.params.id ?? '').trim());

const STATION_ID_ALIASES: Record<string, string> = {
  'IBERDROLA-5629': 'ESIBE22E0005629',
};

const normalizedRouteStationId = computed(() => STATION_ID_ALIASES[stationId.value] ?? stationId.value);

// Coordenadas de los cargadores
const STATION_COORDS: Record<string, { lat: number; lon: number }> = {
  'ESIBE22E0001001': { lat: 38.341118679046346, lon: -0.7654778230267333 },
  'ESIBE22E0001002': { lat: 38.3476704, lon: -0.7691027 },
  'ESIBE22E0001003': { lat: 38.3498799, lon: -0.7649660 },
  'ESIBE22E0001004': { lat: 38.3430059, lon: -0.7610202 },
  'ESIBE22E0001005': { lat: 38.3385331, lon: -0.7766776 },
  'ESIBE22E0005629': { lat: 38.3810859, lon: -0.7308562 },
  'IBERDROLA-5629': { lat: 38.3810859, lon: -0.7308562 },
};

// Información de las estaciones (dirección y nombre)
const STATION_INFO: Record<string, { name: string; street: string }> = {
  'ESIBE22E0001001': { name: 'Cargador Eléctrico Aspe · Av. Carlos Soria', street: 'Avenida Carlos Soria, 11' },
  'ESIBE22E0001002': { name: 'Cargador Eléctrico Aspe · Av. Constitución', street: 'Avenida Constitución, 42' },
  'ESIBE22E0001003': { name: 'Cargador Eléctrico Aspe · Av. Padre Ismael', street: 'Avenida Padre Ismael, 34' },
  'ESIBE22E0001004': { name: 'Cargador Eléctrico Aspe · Av. Juan Carlos I', street: 'Avenida Juan Carlos I, 36' },
  'ESIBE22E0001005': { name: 'Cargador Eléctrico Aspe · Calle Orihuela', street: 'Calle Orihuela, 100' },
  'ESIBE22E0005629': { name: 'Cargador Eléctrico Monforte del Cid · C. Agost', street: 'Calle Agost, 5, Monforte del Cid' },
  'IBERDROLA-5629': { name: 'Cargador Eléctrico Monforte del Cid · C. Agost', street: 'Calle Agost, 5, Monforte del Cid' },
};

const mapContainer = ref<HTMLElement | null>(null);
let mapInstance: any = null;
let leafletModule: any = null;

// Track screen width for responsive display
const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0);

async function getLeaflet() {
  if (leafletModule) return leafletModule;
  const mod: any = await import('leaflet');
  leafletModule = mod.default ?? mod;
  return leafletModule;
}

const stationCoords = computed(() => STATION_COORDS[normalizedRouteStationId.value] ?? STATION_COORDS[stationId.value] ?? null);

async function initMap() {
  if (!mapContainer.value || !stationCoords.value) return;

  // Clean up existing map if it exists
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  const L = await getLeaflet();
  const coords = stationCoords.value;
  
  mapInstance = L.map(mapContainer.value, {
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false,
    zoom: 16,
    center: [coords.lat, coords.lon],
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(mapInstance);

  // Marker for the charger
  L.circleMarker([coords.lat, coords.lon], {
    radius: 8,
    color: '#06b6d4',
    fillColor: '#06b6d4',
    fillOpacity: 0.85,
    weight: 2,
  }).addTo(mapInstance);

  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 100);
}

// Watch for station changes and reinitialize map
watch(() => normalizedRouteStationId.value, () => {
  if (mapContainer.value) {
    initMap();
  }
});

// Current time: keep in UTC for data comparison, display in local timezone
const currentHourUTC = computed(() => new Date().getUTCHours());
const currentHourLocal = computed(() => new Date().getHours());
const timezoneOffset = ref(0);

onMounted(() => {
  timezoneOffset.value = currentHourLocal.value - currentHourUTC.value;
  
  // Initialize map after a brief delay to ensure DOM is ready
  setTimeout(() => {
    initMap();
  }, 100);
  
  // Listen for window resize to update screen width
  const handleResize = () => {
    screenWidth.value = window.innerWidth;
  };
  
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
  };
});

// Convert UTC hour to local hour
function convertToLocalHour(utcHour: number | undefined): number | undefined {
  if (utcHour === undefined) return undefined;
  const local = (utcHour + timezoneOffset.value) % 24;
  return local < 0 ? local + 24 : local;
}

// Tooltip management
const toggleTooltip = (id: string) => {
  tooltipActivo.value = tooltipActivo.value === id ? null : id;
};

const closeTooltip = () => {
  tooltipActivo.value = null;
};

// ETA target hour converted to local time
const etaTargetHourLocal = computed(() => {
  return convertToLocalHour(etaData.value?.targetHour);
});

// Current charger status
const { data: currentChargerData, pending: currentChargerPending } = useFetch('/api/chargers/current', {
  watch: [stationId],
  lazy: true,
});

const chargerStatus = computed(() => {
  if (!currentChargerData.value || !currentChargerData.value.cargadores) return null;
  return currentChargerData.value.cargadores.find((c: any) => {
    const id = c?.station_id;
    return id === stationId.value || id === normalizedRouteStationId.value;
  });
});

const stationIdForAnalytics = computed(() => chargerStatus.value?.station_id ?? normalizedRouteStationId.value);

const stationInfo = computed(() => {
  const fromMap = STATION_INFO[normalizedRouteStationId.value] ?? STATION_INFO[stationId.value] ?? null;
  if (fromMap) return fromMap;
  const fallbackName = chargerStatus.value?.location_name || `Cargador ${stationId.value}`;
  return {
    name: fallbackName,
    street: 'Direccion no disponible',
  };
});

const { data: healthData, pending: healthPending } = useFetch('/api/analytics/charger-health', {
  query: computed(() => ({
    periodo: periodo.value,
    station_id: stationIdForAnalytics.value,
  })),
  watch: [stationIdForAnalytics, periodo],
  lazy: true,
});

const { data: occHourData, pending: occHourPending } = useFetch('/api/analytics/occupancy-by-hour', {
  query: computed(() => ({
    periodo: periodo.value,
    station_id: stationIdForAnalytics.value,
  })),
  watch: [stationIdForAnalytics, periodo],
  lazy: true,
});

const currentHourOccupancy = computed(() => {
  if (!occHourData.value?.points) return null;
  return occHourData.value.points.find(p => p.hour === currentHourUTC.value);
});

const { data: occDayData, pending: occDayPending } = useFetch('/api/analytics/occupancy-by-day', {
  query: computed(() => ({
    periodo: periodo.value,
    station_id: stationIdForAnalytics.value,
  })),
  watch: [stationIdForAnalytics, periodo],
  lazy: true,
});

const { data: durationData, pending: durationPending } = useFetch('/api/analytics/occupation-duration', {
  query: computed(() => ({
    dias_historico: periodo.value === 'today' ? 7 : (periodo.value === '7d' ? 30 : (periodo.value === '30d' ? 90 : 180)),
    station_id: stationIdForAnalytics.value,
  })),
  watch: [stationIdForAnalytics, periodo],
  lazy: true,
});

const { data: releaseData, pending: releasePending } = useFetch('/api/analytics/estimated-release', {
  query: computed(() => ({
    dias_historico: periodo.value === 'today' ? 7 : (periodo.value === '7d' ? 30 : (periodo.value === '30d' ? 90 : 180)),
    station_id: stationIdForAnalytics.value,
  })),
  watch: [stationIdForAnalytics, periodo],
  lazy: true,
});

const { data: heatmapData, pending: heatmapPending } = useFetch('/api/analytics/heatmap', {
  query: computed(() => ({
    periodo: periodo.value,
    station_id: stationIdForAnalytics.value,
  })),
  watch: [stationIdForAnalytics, periodo],
  lazy: true,
});

const { data: recommendationsData, pending: recommendationsPending } = useFetch('/api/analytics/recommendations', {
  query: computed(() => ({
    station_id: stationIdForAnalytics.value,
    periodo: periodo.value,
  })),
  watch: [stationIdForAnalytics, periodo],
  lazy: true,
});

const { data: anomaliesData, pending: anomaliesPending } = useFetch('/api/analytics/anomalies', {
  query: computed(() => ({
    period: periodo.value,
    station_id: stationIdForAnalytics.value,
  })),
  watch: [stationIdForAnalytics, periodo],
  lazy: true,
});

const stationHealth = computed(() => healthData.value?.porEstacion?.[0] ?? null);

// ETA - Probabilidad al llegar
const etaMinutes = ref(30);

const { data: etaData, pending: etaPending } = useFetch('/api/analytics/eta', {
  query: computed(() => ({
    minutes: etaMinutes.value,
    periodo: 'all',
    station_id: stationIdForAnalytics.value,
  })),
  watch: [etaMinutes, stationIdForAnalytics],
  lazy: true,
});

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
      <div class="mb-4">
          <NuxtLink to="/" class="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500">Volver al dashboard</NuxtLink>
      </div>
      <div class="flex justify-end mb-2">
        <FilterButtons v-model="periodo" />
      </div>
      <header class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" @click.self="closeTooltip()">
        <!-- For desktop: show info and map side by side, for mobile: stack vertically -->
        <div v-if="screenWidth >= 768" class="flex gap-6">
          <!-- Información a la izquierda -->
          <div class="flex-1 space-y-3">
            <div>
              <p class="text-xs uppercase tracking-wider text-slate-400 mb-1">Ficha de cargador</p>
              <div class="relative inline-block">
                <h1 
                  @click="toggleTooltip('header-title')"
                  class="text-2xl font-extrabold text-white cursor-help border-b border-dashed border-blue-500/30 hover:border-blue-500/50 transition-colors select-none pb-1 inline-block"
                >
                  {{ stationId }}
                </h1>
                <!-- Tooltip del título -->
                <div
                  v-if="tooltipActivo === 'header-title'"
                  class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                >
                  <p class="font-semibold text-slate-200 mb-1">Detalle de Cargador</p>
                  <p>Información completa de este punto de recarga incluyendo salud técnica, patrones de ocupación y pronósticos de disponibilidad.</p>
                  <button
                    @click.stop="closeTooltip()"
                    class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>
            </div>

            <!-- Dirección -->
            <div v-if="stationInfo" class="text-sm text-slate-300">
              <p class="text-slate-400 text-xs uppercase tracking-wider mb-1">Ubicación</p>
              <p class="font-semibold text-white">{{ stationInfo.name }}</p>
              <p class="text-slate-400">📍 {{ stationInfo.street }}</p>
            </div>

            <!-- Estado actual y conectores -->
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
                <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Estado</p>
                <div v-if="currentChargerPending" class="animate-pulse">
                  <p class="text-sm text-slate-400">Cargando...</p>
                </div>
                <div v-else-if="chargerStatus">
                  <p class="text-lg font-bold" :class="chargerStatus.is_available ? 'text-emerald-400' : 'text-rose-400'">
                    {{ chargerStatus.is_available ? '✓ Disponible' : '✗ Ocupado' }}
                  </p>
                </div>
                <div v-else>
                  <p class="text-sm text-slate-400">Sin datos</p>
                </div>
              </div>
              <div class="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
                <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Conectores</p>
                <div v-if="currentChargerPending" class="animate-pulse">
                  <p class="text-sm text-slate-400">Cargando...</p>
                </div>
                <div v-else-if="chargerStatus">
                  <p class="text-lg font-bold text-cyan-400">
                    {{ chargerStatus.available_connectors ?? 0 }}/{{ chargerStatus.total_connectors ?? 0 }}
                  </p>
                </div>
                <div v-else>
                  <p class="text-sm text-slate-400">Sin datos</p>
                </div>
              </div>
            </div>

            <!-- Última actualización -->
            <div v-if="chargerStatus" class="text-xs text-slate-500 pt-2 border-t border-slate-700">
              Actualizado hace {{ new Date(chargerStatus.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) }}
            </div>
          </div>

          <!-- Mapa a la derecha -->
          <div v-if="stationCoords" class="flex-shrink-0">
            <div 
              ref="mapContainer"
              class="w-56 h-40 rounded-xl border border-slate-700 overflow-hidden shadow-lg"
            />
          </div>
        </div>

        <!-- Mobile view: stack vertically -->
        <div v-else class="space-y-3">
          <div>
            <p class="text-xs uppercase tracking-wider text-slate-400 mb-1">Ficha de cargador</p>
            <div class="relative inline-block">
              <h1 
                @click="toggleTooltip('header-title')"
                class="text-2xl font-extrabold text-white cursor-help border-b border-dashed border-blue-500/30 hover:border-blue-500/50 transition-colors select-none pb-1 inline-block"
              >
                {{ stationId }}
              </h1>
              <!-- Tooltip del título (mobile) -->
              <div
                v-if="tooltipActivo === 'header-title'"
                class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
              >
                <p class="font-semibold text-slate-200 mb-1">Detalle de Cargador</p>
                <p>Información completa de este punto de recarga incluyendo salud técnica, patrones de ocupación y pronósticos de disponibilidad.</p>
                <button
                  @click.stop="closeTooltip()"
                  class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>
          </div>

          <!-- Dirección mobile -->
          <div v-if="stationInfo" class="text-sm text-slate-300">
            <p class="text-slate-400 text-xs uppercase tracking-wider mb-1">Ubicación</p>
            <p class="font-semibold text-white">{{ stationInfo.name }}</p>
            <p class="text-slate-400">📍 {{ stationInfo.street }}</p>
          </div>

          <!-- Estado actual y conectores mobile -->
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Estado</p>
              <div v-if="currentChargerPending" class="animate-pulse">
                <p class="text-sm text-slate-400">Cargando...</p>
              </div>
              <div v-else-if="chargerStatus">
                <p class="text-lg font-bold" :class="chargerStatus.is_available ? 'text-emerald-400' : 'text-rose-400'">
                  {{ chargerStatus.is_available ? '✓ Disponible' : '✗ Ocupado' }}
                </p>
              </div>
              <div v-else>
                <p class="text-sm text-slate-400">Sin datos</p>
              </div>
            </div>
            <div class="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Conectores</p>
              <div v-if="currentChargerPending" class="animate-pulse">
                <p class="text-sm text-slate-400">Cargando...</p>
              </div>
              <div v-else-if="chargerStatus">
                <p class="text-lg font-bold text-cyan-400">
                  {{ chargerStatus.available_connectors ?? 0 }}/{{ chargerStatus.total_connectors ?? 0 }}
                </p>
              </div>
              <div v-else>
                <p class="text-sm text-slate-400">Sin datos</p>
              </div>
            </div>
          </div>

          <!-- Última actualización mobile -->
          <div v-if="chargerStatus" class="text-xs text-slate-500 pt-2 border-t border-slate-700">
            Actualizado hace {{ new Date(chargerStatus.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) }}
          </div>

          <!-- Mapa debajo en mobile -->
          <div v-if="stationCoords" class="mt-4">
            <div 
              ref="mapContainer"
              class="w-full h-40 rounded-xl border border-slate-700 overflow-hidden shadow-lg"
            />
          </div>
        </div>
      </header>

      <!-- Probabilidad al llegar -->
      <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="relative inline-block">
            <h2
              @click="toggleTooltip('eta-detail')"
              class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-cyan-500/30 hover:border-cyan-500/50 transition-colors select-none pb-0.5"
            >
              Probabilidad al llegar
            </h2>
            <!-- Tooltip ETA -->
            <div
              v-if="tooltipActivo === 'eta-detail'"
              class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
            >
              <p class="font-semibold text-slate-200 mb-1">Probabilidad al Llegar</p>
              <p>Probabilidad de encontrar este cargador disponible si llegas en el tiempo indicado, basada en patrones históricos de ocupación.</p>
              <button
                @click.stop="closeTooltip()"
                class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
              >
                ✕ Cerrar
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="m in [5, 15, 30, 60]"
              :key="`eta-charger-${m}`"
              class="rounded-full border px-3 py-1 text-xs transition-colors"
              :class="etaMinutes === m ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'"
              @click="etaMinutes = m"
            >
              {{ m }} min
            </button>
          </div>
        </div>

        <div v-if="etaPending" class="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
        <div v-else class="space-y-3">
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p class="text-xs text-slate-500">Disponibilidad en {{ etaMinutes }} min</p>
            <p class="mt-1 text-2xl font-bold" :class="(etaData?.estacionRecomendada?.probabilidadLibre ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'">{{ etaData?.estacionRecomendada?.probabilidadLibre ?? 0 }}%</p>
            <p class="text-[11px] text-slate-500">{{ etaData?.estacionRecomendada?.muestras ?? 0 }} muestras históricas</p>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <template v-if="(etaData?.estacionRecomendada?.probabilidadLibre ?? 0) > 0">
              <p class="text-xs text-slate-500">Previsión</p>
              <p class="mt-1 text-sm font-semibold text-emerald-400">✓ Probablemente libre</p>
              <p class="mt-1 text-[11px] text-slate-400">Según el histórico a esta hora ({{ etaData?.targetDay ?? '-' }}){{ etaTargetHourLocal !== undefined ? ` a las ${etaTargetHourLocal}:00` : '' }}, hay {{ etaData?.estacionRecomendada?.probabilidadLibre ?? 0 }}% probabilidad de encontrar cargador disponible.</p>
            </template>
            <template v-else>
              <p class="text-xs text-slate-500">Previsión</p>
              <p class="mt-1 text-sm font-semibold text-red-400">✗ Probablemente ocupado</p>
              <p class="mt-1 text-[11px] text-slate-400">Según el histórico, es muy poco probable que haya disponibilidad en {{ etaMinutes }} minutos.</p>
            </template>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-4" @click.self="closeTooltip()">
        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-2">
          <p
            @click="toggleTooltip('health-detail')"
            class="text-xs text-slate-500 cursor-help border-b border-dashed border-green-400/30 hover:border-green-400/50 transition-colors select-none inline-block pb-0.5"
          >
            Estado de salud (30d)
          </p>
          <!-- Tooltip salud -->
          <div
            v-if="tooltipActivo === 'health-detail'"
            class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
          >
            <p class="font-semibold text-slate-200 mb-1">Estado de Salud</p>
            <p class="mb-1.5">Indicadores de confiabilidad del cargador:</p>
            <ul class="space-y-1 text-[10px]">
              <li><strong class="text-emerald-400">Uptime:</strong> % de tiempo operativo</li>
              <li><strong class="text-amber-400">Offline:</strong> Horas fuera de servicio</li>
              <li><strong class="text-slate-300">Desconexiones:</strong> Fallos detectados</li>
            </ul>
            <button
              @click.stop="closeTooltip()"
              class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
            >
              ✕ Cerrar
            </button>
          </div>
          <div v-if="healthPending" class="mt-2 h-16 animate-pulse rounded-lg bg-slate-900" />
          <div v-else class="mt-2">
            <p class="text-xl font-semibold text-white">{{ stationHealth?.locationName ?? 'Sin datos' }}</p>
            <p class="text-sm text-slate-300">Uptime {{ stationHealth?.uptime ?? 0 }}% · Offline {{ stationHealth?.tiempoOfflineHoras ?? 0 }}h</p>
            <p class="text-sm text-slate-400">Desconexiones {{ stationHealth?.desconexiones ?? 0 }} · Fiabilidad {{ stationHealth?.fiabilidad ?? 'N/D' }}</p>
          </div>
        </article>

        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p
            @click="toggleTooltip('duration-detail')"
            class="text-xs text-slate-500 cursor-help border-b border-dashed border-purple-400/30 hover:border-purple-400/50 transition-colors select-none inline-block pb-0.5"
          >
            Duración media
          </p>
          <!-- Tooltip duración -->
          <div
            v-if="tooltipActivo === 'duration-detail'"
            class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-48 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
          >
            <p class="font-semibold text-slate-200 mb-1">Duración Media</p>
            <p><strong class="text-slate-200">Media:</strong> Tiempo promedio que dura una ocupación</p>
            <p class="mt-1"><strong class="text-slate-200">P90:</strong> 90% de ocupaciones duran menos que esto</p>
            <button
              @click.stop="closeTooltip()"
              class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
            >
              ✕ Cerrar
            </button>
          </div>
          <div v-if="durationPending" class="mt-2 h-16 animate-pulse rounded-lg bg-slate-900" />
          <div v-else>
            <p class="mt-2 text-3xl font-bold text-white">{{ durationData?.duracionMediaMin ?? 0 }} min</p>
            <p class="text-xs text-slate-500">P90 {{ durationData?.p90Min ?? 0 }} min</p>
          </div>
        </article>

        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p
            @click="toggleTooltip('release-detail')"
            class="text-xs text-slate-500 cursor-help border-b border-dashed border-orange-400/30 hover:border-orange-400/50 transition-colors select-none inline-block pb-0.5"
          >
            ETA liberación
          </p>
          <!-- Tooltip liberación -->
          <div
            v-if="tooltipActivo === 'release-detail'"
            class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-48 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
          >
            <p class="font-semibold text-slate-200 mb-1">ETA Liberación</p>
            <p>Estimación de minutos hasta que este cargador vuelva a estar disponible basada en datos históricos.</p>
            <button
              @click.stop="closeTooltip()"
              class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
            >
              ✕ Cerrar
            </button>
          </div>
          <div v-if="releasePending" class="mt-2 h-16 animate-pulse rounded-lg bg-slate-900" />
          <div v-else>
            <p class="mt-2 text-3xl font-bold text-white">{{ releaseData?.estimatedMinutesUntilFree ?? 0 }} min</p>
            <p class="text-xs text-slate-500">Confianza {{ releaseData?.confianza ?? 'baja' }}</p>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 lg:grid-cols-2" @click.self="closeTooltip()">
        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h2 
                @click="toggleTooltip('hour-occupancy')"
                class="text-xs uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none inline-block pb-0.5"
              >
                Ocupación por hora
              </h2>
              <!-- Tooltip ocupación por hora -->
              <div
                v-if="tooltipActivo === 'hour-occupancy'"
                class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
              >
                <p class="font-semibold text-slate-200 mb-1">Ocupación por Hora</p>
                <p class="mb-1.5">Gráfico del patrón de ocupación a lo largo del día:</p>
                <ul class="space-y-1 text-[10px]">
                  <li><strong class="text-green-400">Verde:</strong> Baja ocupación (cargador disponible)</li>
                  <li><strong class="text-yellow-400">Amarillo/Naranja:</strong> Ocupación media</li>
                  <li><strong class="text-red-400">Rojo:</strong> Alta ocupación (saturado)</li>
                </ul>
                <p class="mt-1.5">La línea <strong class="text-cyan-400">cyan</strong> indica la hora actual.</p>
                <button
                  @click.stop="closeTooltip()"
                  class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                >
                  ✕ Cerrar
                </button>
              </div>
              <p v-if="occHourData?.isAverageData" class="text-[10px] text-slate-500 mt-1">Media del período</p>
            </div>
            <div v-if="currentHourOccupancy" class="text-right">
              <p class="text-xs text-slate-400">Ahora ({{ String(currentHourLocal).padStart(2, '0') }}h)</p>
              <p class="text-xl font-bold" :style="{ color: `hsl(${120 * (1 - currentHourOccupancy.occupancyPct / 100)}, 85%, 50%)` }">
                {{ currentHourOccupancy.occupancyPct }}%
              </p>
            </div>
          </div>
          <div v-if="occHourPending" class="mt-3 h-64 animate-pulse rounded-lg bg-slate-900" />
          <div v-else-if="occHourData?.points?.length" class="mt-4">
            <!-- Y axis labels -->
            <div class="flex gap-2">
              <div class="w-8 flex flex-col justify-between text-right text-[10px] text-slate-500 h-64">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>
              <!-- Chart area -->
              <div class="flex-1">
                <!-- Grid lines -->
                <div class="relative h-64 border-l border-b border-slate-700">
                  <div class="absolute top-0 left-0 right-0 border-t border-slate-700/30 opacity-50" style="height: 0%;"></div>
                  <div class="absolute left-0 right-0 border-t border-slate-700/30 opacity-50" style="top: 25%;"></div>
                  <div class="absolute left-0 right-0 border-t border-slate-700/30 opacity-50" style="top: 50%;"></div>
                  <div class="absolute left-0 right-0 border-t border-slate-700/30 opacity-50" style="top: 75%;"></div>
                  <div class="absolute left-0 right-0 border-t border-slate-700/30 opacity-50" style="top: 100%;"></div>
                  
                  <!-- Current hour indicator line -->
                  <div 
                    v-if="currentHourOccupancy"
                    class="absolute top-0 bottom-0 border-l-2 border-cyan-400/60 pointer-events-none"
                    :style="{ left: `${(currentHourUTC + 0.5) / 24 * 100}%` }"
                  />
                  
                  <!-- Bars -->
                  <div class="absolute inset-0 flex items-end gap-0.5 px-0.5 py-1">
                    <div 
                      v-for="point in occHourData.points" 
                      :key="`h-${point.hour}`" 
                      class="flex-1 group flex flex-col items-center justify-end h-full relative"
                      :class="point.hour === currentHourUTC ? 'ring-1 ring-cyan-400/60 rounded-t' : ''"
                      :title="`${String(convertToLocalHour(point.hour) ?? point.hour).padStart(2, '0')}h: ${point.occupancyPct}%`"
                    >
                      <div 
                        class="w-full rounded-t transition-all border border-slate-600 shadow-md hover:shadow-lg"
                        :style="{ 
                          height: `${Math.max(2, point.occupancyPct)}%`,
                          backgroundColor: `hsl(${120 * (1 - point.occupancyPct / 100)}, 80%, 45%)`,
                          borderColor: `hsl(${120 * (1 - point.occupancyPct / 100)}, 85%, 35%)`
                        }"
                      />
                    </div>
                  </div>
                </div>
                
                <!-- X axis labels (hours) -->
                <div class="flex gap-0.5 px-0.5 mt-2 text-[10px] text-slate-500">
                  <div v-for="point in occHourData.points" :key="`label-${point.hour}`" class="flex-1 text-center" :class="point.hour === currentHourUTC ? 'text-cyan-400 font-semibold' : ''">
                    {{ String(convertToLocalHour(point.hour) ?? point.hour).padStart(2, '0') }}h
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="mt-3 text-xs text-slate-500">Sin datos suficientes para mostrar la ocupación por hora.</p>
        </article>

        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
          <h2 
            @click="toggleTooltip('day-occupancy')"
            class="text-xs uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none inline-block pb-0.5"
          >
            Ocupación por día
          </h2>
          <!-- Tooltip ocupación por día -->
          <div
            v-if="tooltipActivo === 'day-occupancy'"
            class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
          >
            <p class="font-semibold text-slate-200 mb-1">Ocupación por Día</p>
            <p>Ocupación promedio para cada día de la semana. Las barras más largas indican mayor ocupación en ese día.</p>
            <button
              @click.stop="closeTooltip()"
              class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
            >
              ✕ Cerrar
            </button>
          </div>
          <div v-if="occDayPending" class="mt-3 h-24 animate-pulse rounded-lg bg-slate-900" />
          <div v-else-if="occDayData?.points?.length" class="mt-3 space-y-2">
            <div v-for="point in occDayData.points" :key="`d-${point.dayIndex}`" class="space-y-1">
              <div class="flex justify-between text-xs">
                <span :class="point.samples > 0 ? 'text-slate-300' : 'text-slate-500'">
                  {{ point.dayLabel }}
                </span>
                <span :class="point.samples > 0 ? 'text-slate-300' : 'text-slate-500'">
                  {{ point.samples > 0 ? `${point.occupancyPct}%` : 'Sin datos' }}
                </span>
              </div>
              <div class="h-2 rounded-full" :class="point.samples > 0 ? 'bg-slate-800' : 'bg-slate-900'">
                <div 
                  v-if="point.samples > 0"
                  class="h-full rounded-full transition-all bg-amber-400"
                  :style="{ width: `${Math.max(point.occupancyPct, 1)}%` }" 
                />
                <div v-else class="h-full rounded-full bg-slate-700 opacity-30" />
              </div>
            </div>
          </div>
          <p v-else class="mt-3 text-xs text-slate-500">Sin datos suficientes para mostrar la ocupación por día.</p>
        </article>
      </section>

      <!-- Heatmap semanal -->
      <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
        <h2 
          @click="toggleTooltip('heatmap-detail')"
          class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none inline-block pb-0.5"
        >
          Mapa de calor semanal
        </h2>
        <!-- Tooltip heatmap -->
        <div
          v-if="tooltipActivo === 'heatmap-detail'"
          class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
        >
          <p class="font-semibold text-slate-200 mb-1">Mapa de Calor</p>
          <p class="mb-1.5">Patrón de ocupación en formato de matriz 7×24 (días × horas):</p>
          <ul class="space-y-1 text-[10px]">
            <li><strong class="text-green-400">Verde:</strong> Disponible</li>
            <li><strong class="text-red-400">Rojo:</strong> Ocupado/Saturado</li>
          </ul>
          <p class="mt-1.5">Identifica patrones: horarios pico, días con más demanda.</p>
          <button
            @click.stop="closeTooltip()"
            class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
          >
            ✕ Cerrar
          </button>
        </div>
        <div v-if="heatmapPending" class="mt-3 h-48 animate-pulse rounded-xl bg-slate-900" />
        <WeeklyHeatmap v-else-if="heatmapData?.datos?.length" :datos="heatmapData.datos" class="mt-3" />
        <p v-else class="mt-3 text-xs text-slate-500">Sin datos suficientes para mostrar el mapa de calor.</p>
      </section>

      <!-- Insights y anomalías -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2" @click.self="closeTooltip()">
        <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
          <h2 
            @click="toggleTooltip('insights-detail')"
            class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none inline-block pb-0.5"
          >
            Insights automáticos
          </h2>
          <!-- Tooltip insights -->
          <div
            v-if="tooltipActivo === 'insights-detail'"
            class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
          >
            <p class="font-semibold text-slate-200 mb-1">Insights Automáticos</p>
            <p>Recomendaciones y observaciones generadas automáticamente analizando los patrones de ocupación históricos.</p>
            <button
              @click.stop="closeTooltip()"
              class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
            >
              ✕ Cerrar
            </button>
          </div>
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

        <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
          <h2 
            @click="toggleTooltip('anomalies-detail')"
            class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none inline-block pb-0.5"
          >
            Anomalías detectadas
          </h2>
          <!-- Tooltip anomalías -->
          <div
            v-if="tooltipActivo === 'anomalies-detail'"
            class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
          >
            <p class="font-semibold text-slate-200 mb-1">Anomalías Detectadas</p>
            <p class="mb-1.5">Patrones inusuales encontrados en este cargador:</p>
            <ul class="space-y-1 text-[9px]">
              <li><strong class="text-rose-400">High:</strong> Requiere atención inmediata</li>
              <li><strong class="text-amber-400">Medium:</strong> Vigilancia recomendada</li>
              <li><strong class="text-slate-400">Low:</strong> Para referencia</li>
            </ul>
            <button
              @click.stop="closeTooltip()"
              class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
            >
              ✕ Cerrar
            </button>
          </div>
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
