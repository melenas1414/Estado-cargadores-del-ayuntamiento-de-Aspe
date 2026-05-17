<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import 'leaflet/dist/leaflet.css'

type ChargerMapPoint = {
  stationId: string
  locationName: string
  libres: number
  total: number
  lat: number
  lon: number
  googleUrl: string
}

const props = defineProps<{
  points: ChargerMapPoint[]
}>()

const mapContainer = ref<HTMLElement | null>(null)

let mapInstance: any = null
let layerGroup: any = null
let leafletModule: any = null

async function getLeaflet() {
  if (leafletModule) return leafletModule
  const mod: any = await import('leaflet')
  leafletModule = mod.default ?? mod
  return leafletModule
}

const validPoints = computed(() =>
  props.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)),
)

function markerColor(libres: number, total: number) {
  const totalSafe = total > 0 ? total : 1
  const ratio = libres / totalSafe

  if (ratio <= 0) return '#fb7185' // rose-400
  if (ratio >= 1) return '#34d399' // emerald-400
  return '#fbbf24' // amber-400
}

async function initMap() {
  if (!mapContainer.value || mapInstance) return

  const L = await getLeaflet()
  mapInstance = L.map(mapContainer.value, {
    zoomControl: true,
    scrollWheelZoom: true,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance)

  layerGroup = L.layerGroup().addTo(mapInstance)
  renderPoints()

  // Leaflet necesita invalidar tamaño cuando el contenedor se monta en cliente
  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize()
  }, 0)
}

async function renderPoints() {
  if (!mapInstance || !layerGroup) return

  const L = await getLeaflet()
  layerGroup.clearLayers()

  for (const p of validPoints.value) {
    const color = markerColor(p.libres, p.total)
    const marker = L.circleMarker([p.lat, p.lon], {
      radius: 9,
      color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 2,
    })

    marker.bindPopup(
      `<div style="font-size: 0.875rem; min-width: 200px;"><strong style="display: block; margin-bottom: 0.5rem;">${p.stationId}</strong><a href="/charger/${p.stationId}" style="color: #0ea5e9; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 0.25rem;"><span>${p.locationName}</span><span style="font-size: 0.625rem; color: #94a3b8;">→</span></a><br><span style="color: #cbd5e1; display: block; margin: 0.5rem 0;">${p.libres}/${p.total} conectores libres</span><a href="${p.googleUrl}" target="_blank" rel="noopener noreferrer" style="color: #0ea5e9; text-decoration: none; font-size: 0.75rem;">Abrir en Google Maps ↗</a></div>`,
    )

    marker.addTo(layerGroup)
  }

  if (!validPoints.value.length) {
    mapInstance.setView([38.3485, -0.7639], 14)
    return
  }

  const bounds = L.latLngBounds(validPoints.value.map((p) => [p.lat, p.lon]))
  mapInstance.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 })
}

onMounted(() => {
  initMap()
})

watch(
  () => validPoints.value,
  () => {
    renderPoints()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})
</script>

<template>
  <div ref="mapContainer" class="h-72 w-full" aria-label="Mapa interactivo de cargadores en Aspe" />
</template>

<style scoped>
:deep(.leaflet-popup-content-wrapper) {
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
}

:deep(.leaflet-popup-tip) {
  background: #0f172a;
}

:deep(.leaflet-control-zoom a) {
  background: #0f172a;
  color: #e2e8f0;
  border-color: #334155;
}
</style>