<script setup lang="ts">
import { AlertTriangle, Gauge, Clock3, Sparkles } from 'lucide-vue-next';

type Averia = {
  station_id: string;
  location_name: string;
  nivel: 'ok' | 'warning' | 'critical';
  razones: string[];
  ratioFueraServicio: number;
  rachaFueraServicioHoras: number;
  horasSinActualizarDinamico: number | null;
};

const props = defineProps<{
  saturacion: {
    porcentaje: number;
    minutosSinConectoresLibres: number;
    muestraMinutos: number;
    sugerencia: string;
    conectoresExtraRecomendados: number;
    puntosExtraRecomendados: number;
  };
  averias: Averia[];
  insights: string[];
  etaMinutes: number;
  etaData: {
    probabilidadMunicipalLibre: number;
    probabilidadMunicipalSaturada: number;
    muestras: number;
    estacionRecomendada: {
      station_id: string;
      location_name: string;
      probabilidadLibre: number;
      muestras: number;
    } | null;
  } | null;
}>();

const emit = defineEmits<{
  (e: 'update:etaMinutes', value: number): void;
}>();

function nivelClase(nivel: Averia['nivel']): string {
  if (nivel === 'critical') return 'text-rose-300 bg-rose-500/10 border-rose-500/30';
  if (nivel === 'warning') return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
}

const botonesEta = [5, 15, 30, 60];
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div class="mb-3 flex items-center gap-2">
        <Gauge class="h-4 w-4 text-blue-400" />
        <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Diagnostico de red</h3>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-500">Saturacion municipal</p>
          <p class="mt-1 text-2xl font-bold" :class="saturacion.porcentaje >= 25 ? 'text-rose-400' : saturacion.porcentaje >= 15 ? 'text-amber-400' : 'text-emerald-400'">
            {{ saturacion.porcentaje }}%
          </p>
          <p class="text-[11px] text-slate-500">{{ saturacion.minutosSinConectoresLibres }} min sin conectores libres</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-500">Recomendacion tecnica</p>
          <p class="mt-1 text-sm font-semibold text-white">+{{ saturacion.conectoresExtraRecomendados }} conectores</p>
          <p class="text-[11px] text-slate-500">({{ saturacion.puntosExtraRecomendados }} puntos nuevos aprox.)</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-500">Interpretacion</p>
          <p class="mt-1 text-sm text-slate-300">{{ saturacion.sugerencia }}</p>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div class="mb-3 flex items-center gap-2">
        <Clock3 class="h-4 w-4 text-cyan-400" />
        <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Probabilidad al llegar</h3>
      </div>
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          v-for="m in botonesEta"
          :key="m"
          class="rounded-full border px-3 py-1 text-xs transition-colors"
          :class="etaMinutes === m ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'"
          @click="emit('update:etaMinutes', m)"
        >
          {{ m }} min
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-500">Red municipal libre en {{ etaMinutes }} min</p>
          <p class="mt-1 text-2xl font-bold text-emerald-400">{{ etaData?.probabilidadMunicipalLibre ?? 0 }}%</p>
          <p class="text-[11px] text-slate-500">{{ etaData?.muestras ?? 0 }} muestras historicas</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-500">Mejor opcion estimada</p>
          <p class="mt-1 text-sm font-semibold text-white">
            {{ etaData?.estacionRecomendada?.location_name ?? 'Sin datos' }}
          </p>
          <p class="text-[11px] text-slate-500">
            {{ etaData?.estacionRecomendada?.probabilidadLibre ?? 0 }}% probabilidad libre
          </p>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div class="mb-3 flex items-center gap-2">
        <AlertTriangle class="h-4 w-4 text-amber-400" />
        <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Posibles averias</h3>
      </div>
      <div v-if="averias.length" class="space-y-2">
        <div
          v-for="a in averias"
          :key="a.station_id"
          class="rounded-xl border p-3"
          :class="nivelClase(a.nivel)"
        >
          <p class="text-sm font-semibold">{{ a.location_name }}</p>
          <p class="text-xs">
            {{ a.razones.length ? a.razones.join(' · ') : 'Sin anomalias detectadas' }}
          </p>
        </div>
      </div>
      <p v-else class="text-sm text-slate-500">Sin incidencias detectadas.</p>
    </div>

    <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div class="mb-3 flex items-center gap-2">
        <Sparkles class="h-4 w-4 text-fuchsia-400" />
        <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Insights automaticos</h3>
      </div>
      <ul class="space-y-1.5 text-sm text-slate-300">
        <li v-for="(i, idx) in insights" :key="idx">- {{ i }}</li>
      </ul>
    </div>
  </div>
</template>
