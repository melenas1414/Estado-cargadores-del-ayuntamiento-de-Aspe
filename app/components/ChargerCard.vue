<script setup lang="ts">
import { computed } from 'vue';
import { Zap, CheckCircle, XCircle, Clock, BarChart2 } from 'lucide-vue-next';

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
  providerUpdatedAt?: string | null;
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

const horaEstadoProveedor = computed(() => {
  if (!props.providerUpdatedAt) return '—';
  return new Date(props.providerUpdatedAt).toLocaleTimeString('es-ES', {
    hour:   '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
});

const totalConectores = computed(() => {
  if (typeof props.totalConnectors === 'number' && props.totalConnectors > 0) return props.totalConnectors;
  return null;
});

const conectoresLibres = computed(() => {
  if (typeof props.availableConnectors === 'number') return Math.max(0, props.availableConnectors);
  return null;
});

const tonoEstado = computed<'libre' | 'parcial' | 'ocupado'>(() => {
  if (totalConectores.value !== null && conectoresLibres.value !== null) {
    if (conectoresLibres.value <= 0) return 'ocupado';
    if (conectoresLibres.value >= totalConectores.value) return 'libre';
    return 'parcial';
  }

  return props.isAvailable ? 'libre' : 'ocupado';
});

// Clases dinámicas según disponibilidad
const cardClasses = computed(() => [
  'relative flex flex-col gap-3 rounded-2xl border p-5 transition-all duration-500',
  'bg-slate-900/70 backdrop-blur-sm',
  tonoEstado.value === 'libre'
    ? 'border-emerald-500/40 shadow-glow-green'
    : tonoEstado.value === 'parcial'
      ? 'border-amber-500/40 shadow-[0_0_24px_rgba(251,191,36,0.12)]'
      : 'border-rose-500/40 shadow-glow-red',
]);

const statusDotClasses = computed(() => [
  'w-3 h-3 rounded-full',
  tonoEstado.value === 'libre'
    ? 'bg-emerald-400 animate-pulse-slow'
    : tonoEstado.value === 'parcial'
      ? 'bg-amber-400 animate-pulse-slow'
      : 'bg-rose-400 animate-pulse-slow',
]);

const badgeClasses = computed(() => [
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
  tonoEstado.value === 'libre'
    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
    : tonoEstado.value === 'parcial'
      ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
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
        <CheckCircle v-if="tonoEstado === 'libre'" class="h-3 w-3" />
        <Clock v-else-if="tonoEstado === 'parcial'" class="h-3 w-3" />
        <XCircle v-else class="h-3 w-3" />
        {{ tonoEstado === 'libre' ? 'Libre' : tonoEstado === 'parcial' ? 'Parcial' : 'Ocupado' }}
      </span>
    </div>

    <!-- Icono de rayo -->
    <div
      class="flex h-10 w-10 items-center justify-center rounded-xl"
      :class="
        tonoEstado === 'libre'
          ? 'bg-emerald-500/15'
          : tonoEstado === 'parcial'
            ? 'bg-amber-500/15'
            : 'bg-rose-500/15'
      "
    >
      <Zap
        class="h-5 w-5"
        :class="
          tonoEstado === 'libre'
            ? 'text-emerald-400'
            : tonoEstado === 'parcial'
              ? 'text-amber-400'
              : 'text-rose-400'
        "
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
            :class="
              c.available <= 0
                ? 'text-rose-400'
                : c.available >= c.total
                  ? 'text-emerald-400'
                  : 'text-amber-400'
            "
          >
            {{ c.available }}/{{ c.total }} libres
          </span>
        </div>
      </template>
      <!-- Fallback sin detalle por tipo -->
      <p v-else class="text-[11px] text-slate-400">
        {{ conectoresTexto }}
      </p>

      <div class="pt-0.5 text-[11px] text-slate-500">
        <div class="flex items-center justify-end gap-1">
          <Clock class="h-3 w-3" />
          <span>Muestra {{ horaActualizacion }}</span>
        </div>
        <div class="mt-1 text-right text-slate-600">
          Proveedor {{ horaEstadoProveedor }}
        </div>
      </div>

      <!-- Botón ficha individual -->
      <NuxtLink
        :to="`/charger/${stationId}`"
        class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
        :class="
          tonoEstado === 'libre'
            ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
            : tonoEstado === 'parcial'
              ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
              : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
        "
      >
        <BarChart2 class="h-3.5 w-3.5" />
        Ver detalles
      </NuxtLink>
    </div>
  </div>
</template>
