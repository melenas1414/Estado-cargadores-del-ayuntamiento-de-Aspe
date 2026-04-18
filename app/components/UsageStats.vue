<script setup lang="ts">
/**
 * UsageStats.vue
 * Tarjetas de métricas de uso: tasa de ocupación, sesiones estimadas,
 * tiempo medio de carga y cargador más utilizado.
 */
import { Activity, Zap, Timer, Award } from 'lucide-vue-next';

interface EstacionMetrica {
  station_id:        string;
  location_name:     string;
  tasaOcupacion:     number;
  sesionesEstimadas: number;
  minutosPorSesion:  number;
}

interface CargadorMasUsado {
  location_name:     string;
  sesionesEstimadas: number;
}

const props = defineProps<{
  tasaOcupacionMedia:   number;
  sesionesEstimadas:    number;
  minutosOcupadosMedio: number;
  cargadorMasUsado:     CargadorMasUsado | null;
  porEstacion:          EstacionMetrica[];
}>();

function colorTasa(tasa: number): string {
  if (tasa < 40) return 'text-emerald-400';
  if (tasa < 70) return 'text-amber-400';
  return 'text-rose-400';
}

// Barra de progreso de ocupación de cada estación
function anchoBarraEstacion(tasa: number): string {
  return `${Math.min(tasa, 100)}%`;
}

function colorBarraEstacion(tasa: number): string {
  if (tasa < 40) return 'bg-emerald-500';
  if (tasa < 70) return 'bg-amber-500';
  return 'bg-rose-500';
}
</script>

<template>
  <div class="space-y-4">
    <!-- ─── KPIs principales ─────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <!-- Tasa de ocupación media -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div class="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Activity class="h-3.5 w-3.5 text-blue-400" />
          Ocupación media
        </div>
        <p class="text-3xl font-bold" :class="colorTasa(tasaOcupacionMedia)">
          {{ tasaOcupacionMedia }}%
        </p>
        <p class="mt-0.5 text-xs text-slate-600">del tiempo ocupados</p>
      </div>

      <!-- Sesiones estimadas -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div class="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Zap class="h-3.5 w-3.5 text-emerald-400" />
          Sesiones
        </div>
        <p class="text-3xl font-bold text-white">{{ sesionesEstimadas }}</p>
        <p class="mt-0.5 text-xs text-slate-600">cargas estimadas</p>
      </div>

      <!-- Tiempo medio de carga -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div class="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Timer class="h-3.5 w-3.5 text-violet-400" />
          Duración media
        </div>
        <p class="text-3xl font-bold text-white">
          {{ minutosOcupadosMedio }}<span class="text-lg font-normal text-slate-400"> min</span>
        </p>
        <p class="mt-0.5 text-xs text-slate-600">por sesión de carga</p>
      </div>

      <!-- Cargador más usado -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div class="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Award class="h-3.5 w-3.5 text-amber-400" />
          Más usado
        </div>
        <p
          v-if="cargadorMasUsado"
          class="text-sm font-semibold leading-snug text-white"
        >
          {{ cargadorMasUsado.location_name }}
        </p>
        <p v-else class="text-sm text-slate-500">—</p>
        <p v-if="cargadorMasUsado" class="mt-0.5 text-xs text-slate-500">
          {{ cargadorMasUsado.sesionesEstimadas }} sesiones
        </p>
      </div>
    </div>

    <!-- ─── Ocupación por estación ────────────────────────────────────────── -->
    <div
      v-if="porEstacion.length"
      class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
    >
      <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Ocupación por Cargador
      </h3>
      <ul class="space-y-3">
        <li
          v-for="est in porEstacion"
          :key="est.station_id"
          class="flex flex-col gap-1"
        >
          <div class="flex items-center justify-between text-xs">
            <span class="truncate text-slate-300" :title="est.location_name">
              {{ est.location_name }}
            </span>
            <span class="ml-2 shrink-0 font-semibold" :class="colorTasa(est.tasaOcupacion)">
              {{ est.tasaOcupacion }}%
            </span>
          </div>
          <!-- Barra de progreso -->
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              class="h-full rounded-full transition-all duration-700"
              :class="colorBarraEstacion(est.tasaOcupacion)"
              :style="{ width: anchoBarraEstacion(est.tasaOcupacion) }"
            />
          </div>
          <p class="text-[10px] text-slate-600">
            {{ est.sesionesEstimadas }} sesiones · ~{{ est.minutosPorSesion }} min/sesión
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>
