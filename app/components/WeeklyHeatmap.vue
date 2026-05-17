<script setup lang="ts">
/**
 * WeeklyHeatmap.vue
 * Mapa de calor semanal: días de la semana (X) × horas del día (Y).
 * Color: verde = libre, rojo = ocupado.
 * Implementado como SVG/CSS puro, sin dependencias adicionales.
 */

interface HeatmapPoint {
  dia:        number; // 0=Dom … 6=Sáb
  hora:       number; // 0-23
  porcentaje: number; // 0-100 (% ocupación)
}

const props = defineProps<{
  datos: HeatmapPoint[];
}>();

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORAS = Array.from({ length: 24 }, (_, i) => i);

// Construir mapa de búsqueda rápida
const mapaOcupacion = computed<Map<string, number>>(() => {
  const m = new Map<string, number>();
  for (const p of props.datos) {
    m.set(`${p.dia}-${p.hora}`, p.porcentaje);
  }
  return m;
});

function getPorcentaje(dia: number, hora: number): number {
  return mapaOcupacion.value.get(`${dia}-${hora}`) ?? -1; // -1 = sin datos
}

/**
 * Convierte un porcentaje de ocupación (0-100) en un color HSL.
 * 0%  = verde  (120°)
 * 50% = naranja (40°)
 * 100% = rojo  (0°)
 */
function colorPorcentaje(pct: number): string {
  if (pct < 0) return 'rgba(30, 41, 59, 0.5)'; // sin datos — gris oscuro
  const hue = Math.round(120 - pct * 1.2); // 120→0
  const sat = 70;
  const lum = 38 + pct * 0.08; // 38-46%
  return `hsl(${hue}, ${sat}%, ${lum}%)`;
}

function labelHora(h: number): string {
  return `${String(h).padStart(2, '0')}h`;
}

// Tooltip reactivo
const tooltip = ref<{ visible: boolean; x: number; y: number; texto: string }>({
  visible: false,
  x: 0,
  y: 0,
  texto: '',
});

function mostrarTooltip(event: MouseEvent, dia: number, hora: number, pct: number) {
  const target = event.target as HTMLElement;
  const rect   = target.getBoundingClientRect();
  const parent = (target.closest('[data-heatmap]') as HTMLElement)?.getBoundingClientRect();

  tooltip.value = {
    visible: true,
    x: rect.left - (parent?.left ?? 0) + rect.width / 2,
    y: rect.top  - (parent?.top  ?? 0) - 10,
    texto:
      pct >= 0
        ? `${DIAS[dia]} ${labelHora(hora)}: ${pct}% ocupado`
        : `${DIAS[dia]} ${labelHora(hora)}: sin datos`,
  };
}

function ocultarTooltip() {
  tooltip.value.visible = false;
}
</script>

<template>
  <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
    <div class="relative overflow-x-auto" data-heatmap>
      <!-- Tooltip flotante -->
      <div
        v-if="tooltip.visible"
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg
               bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 shadow-lg ring-1 ring-slate-700"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
      >
        {{ tooltip.texto }}
      </div>

      <!-- Grilla del heatmap -->
      <div class="flex gap-0.5">
        <!-- Etiquetas de horas (eje Y) -->
        <div class="flex flex-col gap-0.5 pr-1">
          <!-- Espaciador para la cabecera de días -->
          <div class="h-5" />
          <div
            v-for="h in HORAS"
            :key="h"
            class="flex h-5 w-7 items-center justify-end text-[10px] text-slate-600"
          >
            {{ h % 3 === 0 ? labelHora(h) : '' }}
          </div>
        </div>

        <!-- Columnas por día -->
        <div
          v-for="dia in 7"
          :key="dia - 1"
          class="flex flex-1 flex-col gap-0.5"
        >
          <!-- Cabecera del día -->
          <div class="mb-0.5 flex h-5 items-center justify-center text-[11px] font-medium text-slate-500">
            {{ DIAS[dia - 1] }}
          </div>

          <!-- Celdas de horas -->
          <div
            v-for="h in HORAS"
            :key="h"
            class="relative h-5 w-full cursor-pointer rounded-sm transition-transform hover:scale-110"
            :style="{ backgroundColor: colorPorcentaje(getPorcentaje(dia - 1, h)) }"
            @mouseenter="(e) => mostrarTooltip(e, dia - 1, h, getPorcentaje(dia - 1, h))"
            @mouseleave="ocultarTooltip"
          />
        </div>
      </div>

      <!-- Leyenda de colores -->
      <div class="mt-4 flex items-center justify-end gap-2 text-[10px] text-slate-500">
        <span>Libre</span>
        <div
          class="h-3 w-24 rounded-sm"
          style="background: linear-gradient(to right, hsl(120,70%,38%), hsl(60,70%,42%), hsl(0,70%,38%))"
        />
        <span>Ocupado</span>
        <div class="ml-4 h-3 w-4 rounded-sm bg-slate-700/50 ring-1 ring-slate-700" />
        <span>Sin datos</span>
      </div>
    </div>
  </div>
</template>
