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

// ─── Estado de período seleccionado ─────────────────────────────────────────
const periodo = ref<Periodo>('7d');

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
} = useFetch('/api/analytics/prediction', { lazy: true });

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

// ─── Refresco manual ─────────────────────────────────────────────────────────
const refrescando = ref(false);

async function refrescarTodo() {
  refrescando.value = true;
  await Promise.all([
    refrescarCargadores(),
    refrescarHeatmap(),
    refrescarMetricas(),
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

const libres   = computed(() => cargadores.value.filter((c: any) => c.is_available).length);
const ocupados = computed(() => cargadores.value.filter((c: any) => !c.is_available).length);

const horaLegible = computed(() => {
  if (!ultimaActualizacion.value) return '—';
  return new Date(ultimaActualizacion.value).toLocaleTimeString('es-ES', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});

// Supertítulo de estado global
const estadoGlobal = computed(() => {
  if (!cargadores.value.length) return null;
  if (libres.value === cargadores.value.length) return { texto: 'Todos libres',  clase: 'text-emerald-400' };
  if (ocupados.value === cargadores.value.length) return { texto: 'Todos ocupados', clase: 'text-rose-400' };
  return { texto: `${libres.value} libre${libres.value !== 1 ? 's' : ''}`, clase: 'text-amber-400' };
});

// ─── Meta tags dinámicos ──────────────────────────────────────────────────────
useSeoMeta({
  title: 'Estado de Carga en Aspe · Cargadores Iberdrola 22 kW',
  description:
    'Monitor en tiempo real de los 5 cargadores eléctricos del Ayuntamiento de Aspe. Disponibilidad, historial y predicciones basadas en IA.',
  ogTitle:       'Cargadores EV · Aspe, Alicante',
  ogDescription: 'Estado en tiempo real · Análisis semanal · Predicción horaria',
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
          Estado Actual · {{ cargadores.length }} cargadores
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
            :updated-at="c.created_at"
          />
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
          <!-- Filtro de período -->
          <FilterButtons v-model="periodo" />
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
            :franjas="prediccionData.franjas"
            :horas-recomendadas="prediccionData.horasRecomendadas"
            :hay-suficientes-datos="prediccionData.haySuficientesDatos"
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
      </section>

      <!-- ════════ FOOTER ════════ -->
      <footer class="border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
        Datos actualizados cada 15 minutos por GitHub Actions · Fuentes: Iberdrola / OpenChargeMap ·
        <a
          href="https://github.com/melenas1414/Estado-cargadores-del-ayuntamiento-de-Aspe"
          target="_blank"
          rel="noopener noreferrer"
          class="text-slate-500 underline-offset-2 hover:text-slate-400 hover:underline"
        >
          Código fuente
        </a>
      </footer>

    </div>
  </main>
</template>
