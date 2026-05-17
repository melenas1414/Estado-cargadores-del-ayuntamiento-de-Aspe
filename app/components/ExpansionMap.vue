<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useFetch } from 'nuxt/app';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation } from 'lucide-vue-next';

type PrioridadZona = 'critical' | 'high' | 'medium' | 'low';

interface Parking {
  nombre: string;
  lat: number;
  lon: number;
  capacidad: number;
  tipo: 'público' | 'privado';
}

interface UbicacionRecomendada {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  razonamiento: string;
  puntajeTotal: number;
  demandaCercana: number;
  distanciaAEstaciones: number;
  parkingsCercanos: Parking[];
  beneficioEstimado: string;
  prioridad: PrioridadZona;
}

interface ZonaPrioritaria {
  zona: string;
  ocupacionMediaPct: number;
  prioridad: PrioridadZona;
  centroide: { lat: number; lon: number };
}

interface ResumenAnalisis {
  zonasConDemandaAlta: number;
}

interface ExpansionRecommendationsResponse {
  resumenAnalisis: ResumenAnalisis;
  ubicacionesRecomendadas: UbicacionRecomendada[];
  zonasPrioritarias: ZonaPrioritaria[];
}

const mapContainer = ref<HTMLDivElement>();
let mapInstance: any = null;
let markersGroup: any = null;
let L: any = null;

const { pending, data } = await useFetch<ExpansionRecommendationsResponse>('/api/analytics/expansion-recommendations', {
  query: { periodo: '30d' },
});

const ubicacionSeleccionada = ref<UbicacionRecomendada | null>(null);

function colorPrioridad(prioridad: PrioridadZona): string {
  if (prioridad === 'critical') return '#f43f5e'; // Rose
  if (prioridad === 'high') return '#f97316'; // Orange
  if (prioridad === 'medium') return '#eab308'; // Yellow
  return '#22c55e'; // Green
}

function iconoPrioridad(prioridad: PrioridadZona) {
  if (prioridad === 'critical') return '⚠️';
  if (prioridad === 'high') return '↗️';
  if (prioridad === 'medium') return '→';
  return '✓';
}

function normalizarPuntaje(puntaje: number): number {
  if (!Number.isFinite(puntaje)) return 0;
  return Math.max(0, Math.min(100, puntaje));
}

async function iniciarMapa() {
  if (!mapContainer.value || mapInstance) return;

  await nextTick();

  if (!L) {
    L = (await import('leaflet')).default;
  }

  mapInstance = L.map(mapContainer.value).setView([38.3485, -0.7639], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(mapInstance);

  markersGroup = L.featureGroup().addTo(mapInstance);

  // Renderizar recomendaciones
  if (data.value?.ubicacionesRecomendadas) {
    for (const ubicacion of data.value.ubicacionesRecomendadas) {
      const marker = L.circle([ubicacion.lat, ubicacion.lon], {
        radius: 300, // metros reales
        color: '#ef4444',
        weight: 2,
        opacity: 0.9,
        fillColor: '#ef4444',
        fillOpacity: 0.18,
      })
        .bindPopup(
          `<div class="text-xs">
            <p class="font-bold">${ubicacion.nombre}</p>
            <p>Puntuación: ${normalizarPuntaje(ubicacion.puntajeTotal).toFixed(1)}/100</p>
            <p>Demanda: ${ubicacion.demandaCercana}%</p>
            <p>Zona sugerida: radio 300 m</p>
          </div>`,
          { maxWidth: 250 }
        )
        .addTo(markersGroup!);

      marker.on('click', () => {
        ubicacionSeleccionada.value = ubicacion;
        mapInstance?.setView([ubicacion.lat, ubicacion.lon], 17);
      });
    }
  }

  // Renderizar estaciones actuales con color gris
  if (data.value?.ubicacionesRecomendadas) {
    const estacionesIds = new Set<string>();
    // Esto es una simplificación - en producción sería mejor hacer un endpoint dedicado
    // o traer las coords desde el backend
    const estacionesCoords = [
      { lat: 38.341118679046346, lon: -0.7654778230267333, id: 'ESIBE22E0001001' },
      { lat: 38.3476704, lon: -0.7691027, id: 'ESIBE22E0001002' },
      { lat: 38.3498799, lon: -0.7649660, id: 'ESIBE22E0001003' },
      { lat: 38.3430059, lon: -0.7610202, id: 'ESIBE22E0001004' },
      { lat: 38.3385331, lon: -0.7766776, id: 'ESIBE22E0001005' },
    ];

    for (const est of estacionesCoords) {
      L.circleMarker([est.lat, est.lon], {
        radius: 8,
        fillColor: '#64748b',
        color: 'rgba(255,255,255,0.2)',
        weight: 1.5,
        opacity: 0.8,
        fillOpacity: 0.6,
      })
        .bindPopup(`<div class="text-xs"><p>Estación: ${est.id}</p><p>Estado: Actual</p></div>`)
        .addTo(markersGroup!);
    }
  }

  // El mapa se monta dentro de una pestaña con transición; Leaflet necesita recalcular tamaño.
  setTimeout(() => {
    mapInstance?.invalidateSize();
    if (markersGroup && markersGroup.getLayers().length > 0) {
      mapInstance?.fitBounds(markersGroup.getBounds(), { padding: [24, 24], maxZoom: 16 });
    }
  }, 100);
}

onMounted(async () => {
  await nextTick();
  if (!pending.value && mapContainer.value) {
    iniciarMapa();
  }
});

watch(
  [() => pending.value, () => mapContainer.value],
  async ([nuevoPending, container]) => {
    if (!nuevoPending && container && mapInstance === null) {
      await nextTick();
      iniciarMapa();
    }
  },
  { immediate: true, flush: 'post' }
);

const nivelConfidencia = computed(() => {
  if (!data.value?.ubicacionesRecomendadas) return 'baja';
  const promedioPuntaje = (
    data.value.ubicacionesRecomendadas.reduce((acumulado: number, ubicacion: UbicacionRecomendada) => acumulado + normalizarPuntaje(ubicacion.puntajeTotal), 0) /
    data.value.ubicacionesRecomendadas.length
  ).toFixed(1);
  return parseFloat(promedioPuntaje) > 70 ? 'alta' : parseFloat(promedioPuntaje) > 50 ? 'media' : 'baja';
});
</script>

<template>
  <ClientOnly>
    <div class="space-y-4">
      <!-- Header -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <Navigation class="h-5 w-5 text-cyan-400" />
          <h2 class="text-xl font-bold text-slate-100">Mapa de Expansión Inteligente</h2>
        </div>
        <p class="text-sm text-slate-400">
          Ubicaciones recomendadas para nuevos puntos de carga basadas en demanda, cobertura y proximidad a parkings
        </p>
      </div>

    <!-- Stats Summary -->
    <div v-if="data && !pending" class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <p class="text-xs text-slate-400 uppercase tracking-wide">Zonas de Alta Demanda</p>
        <p class="mt-1 text-2xl font-bold text-cyan-400">{{ data.resumenAnalisis.zonasConDemandaAlta }}</p>
      </div>
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <p class="text-xs text-slate-400 uppercase tracking-wide">Ubicaciones Recomendadas</p>
        <p class="mt-1 text-2xl font-bold text-cyan-400">{{ data.ubicacionesRecomendadas.length }}</p>
      </div>
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <p class="text-xs text-slate-400 uppercase tracking-wide">Confianza del Análisis</p>
        <p class="mt-1 text-sm font-semibold capitalize" :class="nivelConfidencia === 'alta' ? 'text-emerald-400' : 'text-amber-400'">
          {{ nivelConfidencia }}
        </p>
      </div>
    </div>

    <!-- Mapa -->
    <div class="overflow-hidden rounded-2xl border border-slate-800">
      <div v-if="pending" class="h-96 animate-pulse bg-slate-900" />
      <div v-else ref="mapContainer" class="h-96 w-full bg-slate-900" />
    </div>

    <!-- Leyenda -->
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p class="mb-3 text-xs font-semibold uppercase text-slate-400">Leyenda</p>
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <div class="h-3 w-3 rounded-full" style="background-color: #ef4444" />
          <span class="text-xs text-slate-300">Zona recomendada (círculo rojo de 300 m reales)</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="h-3 w-3 rounded-full" style="background-color: #64748b" />
          <span class="text-xs text-slate-300">Estaciones actuales</span>
        </div>
      </div>
    </div>

    <!-- Recomendaciones Detalladas -->
    <div v-if="data && !pending" class="space-y-3">
      <h3 class="text-sm font-semibold text-slate-300">Ubicaciones Recomendadas Detalladas</h3>

      <div class="space-y-2">
        <div
          v-for="ubicacion in data.ubicacionesRecomendadas.slice(0, 6)"
          :key="ubicacion.id"
          class="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700 hover:bg-slate-900/80"
          :class="ubicacionSeleccionada?.id === ubicacion.id ? 'ring-2 ring-cyan-500/50' : ''"
          @click="ubicacionSeleccionada = ubicacion; mapInstance?.setView([ubicacion.lat, ubicacion.lon], 17)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 space-y-2">
              <div class="flex items-center gap-2">
                <div
                  class="h-3 w-3 rounded-full"
                  :style="{ backgroundColor: colorPrioridad(ubicacion.prioridad) }"
                />
                <p class="font-semibold text-slate-100">{{ ubicacion.nombre }}</p>
                <span class="rounded-full border border-current/30 px-2 py-0.5 text-[10px] uppercase tracking-wider" :style="{ color: colorPrioridad(ubicacion.prioridad) }">
                  {{ ubicacion.prioridad }}
                </span>
              </div>

              <p class="text-xs text-slate-400">{{ ubicacion.razonamiento }}</p>

              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div class="rounded-lg bg-slate-800/50 p-2">
                  <p class="text-[10px] text-slate-400">Puntuación</p>
                  <p class="font-bold text-cyan-400">{{ normalizarPuntaje(ubicacion.puntajeTotal).toFixed(1) }}/100</p>
                </div>
                <div class="rounded-lg bg-slate-800/50 p-2">
                  <p class="text-[10px] text-slate-400">Demanda</p>
                  <p class="font-bold text-amber-400">{{ ubicacion.demandaCercana }}%</p>
                </div>
                <div class="rounded-lg bg-slate-800/50 p-2">
                  <p class="text-[10px] text-slate-400">Distancia</p>
                  <p class="font-bold text-slate-200">{{ ubicacion.distanciaAEstaciones }}m</p>
                </div>
                <div class="rounded-lg bg-slate-800/50 p-2">
                  <p class="text-[10px] text-slate-400">Parkings</p>
                  <p class="font-bold text-slate-200">{{ ubicacion.parkingsCercanos.length }}</p>
                </div>
              </div>

              <div class="space-y-1 rounded-lg border border-slate-700/50 bg-slate-800/30 p-2">
                <p class="text-[11px] font-semibold text-slate-300">{{ ubicacion.beneficioEstimado }}</p>
              </div>

              <!-- Parkings cercanos -->
              <div v-if="ubicacion.parkingsCercanos.length > 0" class="space-y-1">
                <p class="text-[10px] font-semibold text-slate-400">Parkings cercanos:</p>
                <div class="space-y-1">
                  <div v-for="parking in ubicacion.parkingsCercanos" :key="parking.nombre" class="flex items-center gap-2 rounded-lg bg-slate-800/40 px-2 py-1">
                    <MapPin class="h-3 w-3 flex-shrink-0 text-cyan-400" />
                    <span class="text-[10px] text-slate-300">
                      {{ parking.nombre }} ({{ parking.capacidad }} puestos · {{ parking.tipo }})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700"
              @click.stop="mapInstance?.setView([ubicacion.lat, ubicacion.lon], 17)"
            >
              Ver en mapa
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="space-y-3">
      <div class="h-12 animate-pulse rounded-xl bg-slate-800" />
      <div class="h-12 animate-pulse rounded-xl bg-slate-800" />
    </div>
  </div>
  </ClientOnly>
</template>

<style scoped>
/* Leaflet customizations */
:deep(.leaflet-container) {
  background-color: rgb(15, 23, 42);
  border-radius: 0.25rem;
}

:deep(.leaflet-popup-content) {
  color: rgb(226, 232, 240);
  background-color: rgb(15, 23, 42);
  border: 1px solid rgb(71, 85, 105);
  border-radius: 0.5rem;
}

:deep(.leaflet-popup-tip) {
  background-color: rgb(15, 23, 42);
  border: 1px solid rgb(71, 85, 105);
}

:deep(.leaflet-control-attribution) {
  background-color: rgba(15, 23, 42, 0.8);
  color: rgb(148, 163, 184);
}

:deep(.leaflet-control-zoom) {
  background-color: rgba(15, 23, 42, 0.8);
  border: 1px solid rgb(71, 85, 105);
  border-radius: 0.5rem;
}

:deep(.leaflet-control-zoom-in,
  .leaflet-control-zoom-out) {
  background-color: rgb(30, 41, 59);
  color: rgb(148, 163, 184);
  border: none;
}

:deep(.leaflet-control-zoom-in:hover,
  .leaflet-control-zoom-out:hover) {
  background-color: rgb(51, 65, 85);
}
</style>
