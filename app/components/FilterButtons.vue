<script setup lang="ts">
/**
 * FilterButtons.vue
 * Botones para seleccionar el período de análisis: Hoy / 7 días / Mes completo.
 */

type Periodo = 'today' | '7d' | '30d' | 'all';

interface Opcion {
  valor:    Periodo;
  etiqueta: string;
}

const OPCIONES: Opcion[] = [
  { valor: 'today', etiqueta: 'Hoy' },
  { valor: '7d',    etiqueta: 'Últimos 7 días' },
  { valor: '30d',   etiqueta: 'Mes completo' },
  { valor: 'all',   etiqueta: 'Toda la vida' },
];

const props = defineProps<{
  modelValue: Periodo;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: Periodo): void;
}>();

function seleccionar(valor: Periodo) {
  emit('update:modelValue', valor);
}
</script>

<template>
  <div
    class="inline-flex rounded-xl bg-slate-900 p-1 ring-1 ring-slate-800"
    role="group"
    aria-label="Filtrar período de análisis"
  >
    <button
      v-for="op in OPCIONES"
      :key="op.valor"
      class="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
      :class="
        modelValue === op.valor
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
          : 'text-slate-400 hover:text-slate-200'
      "
      :aria-pressed="modelValue === op.valor"
      @click="seleccionar(op.valor)"
    >
      {{ op.etiqueta }}
    </button>
  </div>
</template>
