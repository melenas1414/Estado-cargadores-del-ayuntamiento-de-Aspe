<script setup lang="ts">
import { AlertTriangle, Gauge, Activity, Sparkles } from 'lucide-vue-next';

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
}>();

function nivelClase(nivel: Averia['nivel']): string {
  if (nivel === 'critical') return 'text-rose-300 bg-rose-500/10 border-rose-500/30';
  if (nivel === 'warning') return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
}

const saludTelemetria = computed(() => {
  const total = props.averias.length;
  const criticas = props.averias.filter((a) => a.nivel === 'critical').length;
  const warning = props.averias.filter((a) => a.nivel === 'warning').length;
  const desactualizadas = props.averias.filter((a) => (a.horasSinActualizarDinamico ?? 0) >= 6).length;
  const patronesPlanos = props.averias.filter((a) =>
    a.razones.some((r) => r.toLowerCase().includes('patron plano')),
  ).length;

  return {
    total,
    criticas,
    warning,
    desactualizadas,
    patronesPlanos,
  };
});
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
        <Activity class="h-4 w-4 text-cyan-400" />
        <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Salud de telemetria</h3>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-500">Estaciones criticas</p>
          <p class="mt-1 text-2xl font-bold text-rose-400">{{ saludTelemetria.criticas }}</p>
          <p class="text-[11px] text-slate-500">de {{ saludTelemetria.total }} estaciones</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-500">Alertas warning</p>
          <p class="mt-1 text-2xl font-bold text-amber-400">{{ saludTelemetria.warning }}</p>
          <p class="text-[11px] text-slate-500">incidencias moderadas</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-500">Datos desactualizados</p>
          <p class="mt-1 text-2xl font-bold text-cyan-300">{{ saludTelemetria.desactualizadas }}</p>
          <p class="text-[11px] text-slate-500">&gt;= 6h sin cambio dinamico</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-500">Patrones planos</p>
          <p class="mt-1 text-2xl font-bold text-fuchsia-300">{{ saludTelemetria.patronesPlanos }}</p>
          <p class="text-[11px] text-slate-500">sin variacion en 48h</p>
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
