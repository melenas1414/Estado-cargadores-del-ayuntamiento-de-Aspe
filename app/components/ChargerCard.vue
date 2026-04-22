<script setup lang="ts">
import { Zap, CheckCircle, XCircle, Clock } from 'lucide-vue-next';

interface ConnectorDetail {
  type: string;
  power_kw: number | null;
  total: number;
  available: number;
}

interface Props {
  stationId:    string;
  locationName: string;
  isAvailable:  boolean;
  powerKw:      number;
  updatedAt:    string;
  availableConnectors?: number | null;
  totalConnectors?: number | null;
  connectorType?: string | null;
  connectors?: ConnectorDetail[] | null;
}

const props = defineProps<Props>();

// Formatear la fecha de actualización
const horaActualizacion = computed(() => {
  if (!props.updatedAt) return '—';
  return new Date(props.updatedAt).toLocaleTimeString('es-ES', {
    hour:   '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
});

// Clases dinámicas según disponibilidad
const cardClasses = computed(() => [
  'relative flex flex-col gap-3 rounded-2xl border p-5 transition-all duration-500',
  'bg-slate-900/70 backdrop-blur-sm',
  props.isAvailable
    ? 'border-emerald-500/40 shadow-glow-green'
    : 'border-rose-500/40 shadow-glow-red',
]);

const statusDotClasses = computed(() => [
  'w-3 h-3 rounded-full',
  props.isAvailable
    ? 'bg-emerald-400 animate-pulse-slow'
    : 'bg-rose-400 animate-pulse-slow',
]);

const badgeClasses = computed(() => [
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
  props.isAvailable
    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
    : 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30',
]);

const conectoresTexto = computed(() => {
  const total = props.totalConnectors;
  const libres = props.availableConnectors;

  if (typeof total === 'number' && total > 0 && typeof libres === 'number') {
    return `${libres}/${total} conectores libres`;
  }

  return 'Sin detalle de conectores';
});

const resumenConectores = computed(() => {
  const total = props.totalConnectors;
  const libres = props.availableConnectors;

  if (typeof total === 'number' && total >= 0 && typeof libres === 'number' && libres >= 0) {
    const ocupados = Math.max(0, total - libres);
    return `${total} total · ${ocupados} ocupados · ${libres} libres`;
  }

  return 'Sin resumen de conectores';
});

const potenciaTexto = computed(() => {
  if (!Number.isFinite(props.powerKw) || props.powerKw <= 0) return null;
  return `${props.powerKw} kW por conector`;
});
</script>

<template>
  <div :class="cardClasses" role="article" :aria-label="`Cargador ${locationName}`">
    <!-- Indicador de estado (esquina superior derecha) -->
    <div class="absolute right-4 top-4 flex items-center gap-2">
      <span :class="statusDotClasses" />
      <span :class="badgeClasses">
        <CheckCircle v-if="isAvailable" class="h-3 w-3" />
        <XCircle v-else class="h-3 w-3" />
        {{ isAvailable ? 'Libre' : 'Ocupado' }}
      </span>
    </div>

    <!-- Icono de rayo -->
    <div
      class="flex h-10 w-10 items-center justify-center rounded-xl"
      :class="isAvailable ? 'bg-emerald-500/15' : 'bg-rose-500/15'"
    >
      <Zap
        class="h-5 w-5"
        :class="isAvailable ? 'text-emerald-400' : 'text-rose-400'"
        fill="currentColor"
      />
    </div>

    <!-- Nombre de la ubicación -->
    <div class="mt-1">
      <h3 class="text-sm font-medium leading-snug text-slate-200 pr-28">
        {{ locationName }}
      </h3>
      <p class="mt-0.5 text-xs text-slate-500">{{ stationId }}</p>
      <p v-if="potenciaTexto" class="mt-1 text-[11px] text-slate-400">{{ potenciaTexto }}</p>
    </div>

    <!-- Detalles: conectores por tipo o resumen -->
    <div class="mt-auto space-y-1.5 text-xs text-slate-500">
      <p class="text-[11px] text-slate-400">
        {{ resumenConectores }}
      </p>

      <!-- Lista por tipo de conector -->
      <template v-if="connectors && connectors.length">
        <div
          v-for="c in connectors"
          :key="c.type"
          class="flex items-center justify-between text-[11px]"
        >
          <span class="flex items-center gap-1 text-slate-400">
            <Zap class="h-3 w-3 text-blue-400" />
            {{ c.type }}{{ c.power_kw ? ` · ${c.power_kw} kW` : '' }}
          </span>
          <span
            class="font-medium"
            :class="c.available > 0 ? 'text-emerald-400' : 'text-rose-400'"
          >
            {{ c.available }}/{{ c.total }} libres
          </span>
        </div>
      </template>
      <!-- Fallback sin detalle por tipo -->
      <p v-else class="text-[11px] text-slate-400">
        {{ conectoresTexto }}
      </p>

      <div class="flex items-center justify-end pt-0.5">
        <span class="flex items-center gap-1">
          <Clock class="h-3 w-3" />
          Act. {{ horaActualizacion }}
        </span>
      </div>
    </div>
  </div>
</template>
