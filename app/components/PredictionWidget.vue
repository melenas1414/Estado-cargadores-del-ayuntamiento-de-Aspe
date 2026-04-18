<script setup lang="ts">
/**
 * PredictionWidget.vue
 * Muestra la predicción del mejor momento para cargar hoy,
 * basada en el análisis histórico de los últimos 30 días.
 */
import { BrainCircuit, TrendingUp, Clock, CalendarCheck } from 'lucide-vue-next';

interface Franja {
  hora:           number;
  disponibilidad: number;
  conDatos:       boolean;
}

const props = defineProps<{
  mejorHora:            number;
  probabilidad:         number;
  diaSemana:            string;
  franjas:              Franja[];
  horasRecomendadas:    number[];
  haySuficientesDatos:  boolean;
}>();

function formatHora(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

// Color de la barra según disponibilidad (0-100 %)
function colorBarra(pct: number): string {
  if (pct >= 70) return '#10b981'; // emerald
  if (pct >= 40) return '#f59e0b'; // amber
  return '#f43f5e';                // rose
}

// Nivel de confianza textual
const nivelConfianza = computed(() => {
  if (!props.haySuficientesDatos) return 'Sin datos suficientes';
  if (props.probabilidad >= 80) return 'Alta confianza';
  if (props.probabilidad >= 60) return 'Confianza media';
  return 'Confianza baja';
});

const colorConfianza = computed(() => {
  if (!props.haySuficientesDatos) return 'text-slate-500';
  if (props.probabilidad >= 80) return 'text-emerald-400';
  if (props.probabilidad >= 60) return 'text-amber-400';
  return 'text-rose-400';
});
</script>

<template>
  <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
    <div class="mb-4 flex items-center gap-2">
      <BrainCircuit class="h-4 w-4 text-blue-400" />
      <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Predicción Inteligente · {{ diaSemana }}
      </h2>
    </div>

    <!-- Sin datos suficientes -->
    <div
      v-if="!haySuficientesDatos"
      class="flex flex-col items-center justify-center gap-2 py-8 text-center"
    >
      <CalendarCheck class="h-8 w-8 text-slate-600" />
      <p class="text-sm text-slate-500">
        Acumulando datos históricos…<br />
        <span class="text-xs">Disponible tras varios días de monitorización.</span>
      </p>
    </div>

    <template v-else>
      <!-- Predicción principal -->
      <div
        class="mb-4 flex items-center justify-between rounded-xl
               border border-blue-500/20 bg-blue-500/10 px-4 py-3"
      >
        <div>
          <p class="text-xs text-slate-400">Mejor momento para cargar hoy</p>
          <p class="mt-0.5 text-2xl font-bold text-white">
            {{ formatHora(mejorHora) }}
          </p>
          <p class="mt-0.5 flex items-center gap-1 text-xs" :class="colorConfianza">
            <TrendingUp class="h-3 w-3" />
            {{ nivelConfianza }} · {{ probabilidad }}% disponibilidad
          </p>
        </div>
        <div
          class="flex h-14 w-14 items-center justify-center rounded-full
                 border-2 border-blue-400/40 bg-blue-500/20 text-xl font-bold text-blue-300"
        >
          {{ probabilidad }}%
        </div>
      </div>

      <!-- Horas recomendadas (≥ 70 %) -->
      <div v-if="horasRecomendadas.length" class="mb-4">
        <p class="mb-2 text-xs text-slate-500">
          <Clock class="mr-1 inline h-3 w-3" />
          Otras horas recomendadas (≥ 70% disponibilidad)
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="h in horasRecomendadas"
            :key="h"
            class="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs
                   font-medium text-emerald-300 ring-1 ring-emerald-500/25"
          >
            {{ formatHora(h) }}
          </span>
        </div>
      </div>

      <!-- Mini-gráfico de barras: disponibilidad a lo largo del día -->
      <div>
        <p class="mb-2 text-xs text-slate-500">Disponibilidad histórica por hora</p>
        <div class="flex h-16 items-end gap-px" role="img" aria-label="Gráfico de disponibilidad por hora">
          <div
            v-for="f in franjas"
            :key="f.hora"
            class="group relative flex-1"
            :title="`${formatHora(f.hora)}: ${f.conDatos ? f.disponibilidad + '%' : 'sin datos'}`"
          >
            <!-- Barra -->
            <div
              class="w-full rounded-t-sm transition-all duration-300"
              :style="{
                height:           f.conDatos ? `${f.disponibilidad}%` : '2px',
                backgroundColor:  f.conDatos ? colorBarra(f.disponibilidad) : '#1e293b',
                minHeight:        '2px',
              }"
            />
            <!-- Etiqueta de hora cada 6 horas -->
            <div
              v-if="f.hora % 6 === 0"
              class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-slate-600"
            >
              {{ f.hora }}h
            </div>
          </div>
        </div>
        <!-- Espacio para etiquetas inferiores -->
        <div class="mt-5" />
      </div>
    </template>
  </div>
</template>
