<script setup lang="ts">
/**
 * DiagnosticDemandHeatmap.vue
 * Mapa de calor de demanda de cargadores por zona.
 * Muestra las zonas más saturadas y dónde se recomienda instalar nuevos puntos.
 */

interface ZonaPrioritaria {
  zona: string;
  prioridad: 'critical' | 'high' | 'medium' | 'low';
  ocupacionMediaPct: number;
  minutosSinConectoresLibres: number;
  estaciones: number;
  estacionIds: string[];
  recomendacion: string;
}

const props = defineProps<{
  zonas: ZonaPrioritaria[];
}>();

const tooltipVisibleZona = ref<string | null>(null);
const tooltipActivo = ref<string | null>(null);

const closeTooltip = () => {
  tooltipActivo.value = null;
  tooltipVisibleZona.value = null;
};

const toggleTooltip = (id: string) => {
  tooltipActivo.value = tooltipActivo.value === id ? null : id;
};

// Agrupar por zona única (ignorar variaciones de nombre)
const zonasUnicas = computed(() => {
  const mapa = new Map<string, ZonaPrioritaria>();
  
  for (const zona of props.zonas) {
    const key = zona.zona.toLowerCase().trim();
    
    // Si ya existe, tomar la de mayor ocupación
    if (mapa.has(key)) {
      const existing = mapa.get(key)!;
      if (zona.ocupacionMediaPct > existing.ocupacionMediaPct) {
        mapa.set(key, zona);
      }
    } else {
      mapa.set(key, zona);
    }
  }
  
  // Ordenar por ocupación descendente
  return Array.from(mapa.values()).sort((a, b) => b.ocupacionMediaPct - a.ocupacionMediaPct);
});

const maxOcupacion = computed(() => Math.max(...zonas.map(z => z.ocupacionMediaPct), 50));

function colorPrioridad(prioridad: string, ocupacion: number): string {
  if (prioridad === 'critical') return `hsl(0, 100%, ${Math.max(30, 70 - ocupacion * 0.5)}%)`;    // Rojo
  if (prioridad === 'high')     return `hsl(35, 100%, ${Math.max(30, 70 - ocupacion * 0.5)}%)`;  // Naranja
  if (prioridad === 'medium')   return `hsl(55, 100%, ${Math.max(30, 70 - ocupacion * 0.5)}%)`;  // Amarillo
  return `hsl(120, 70%, ${Math.max(30, 70 - ocupacion * 0.5)}%)`;                                 // Verde
}

function etiquetaPrioridad(prioridad: string): string {
  const mapa: Record<string, string> = {
    critical: 'CRÍTICO',
    high: 'ALTO',
    medium: 'MEDIO',
    low: 'BAJO',
  };
  return mapa[prioridad] || prioridad;
}

function hortasADias(minutos: number): string {
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas}h`;
  const dias = Math.round(horas / 24);
  return `${dias}d`;
}
</script>

<template>
  <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5" @click.self="closeTooltip()">
    <h2
      @click="toggleTooltip('titulo')"
      class="relative mb-4 cursor-help text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-dashed border-slate-600 inline-block pb-1 hover:border-slate-500 transition-colors select-none"
    >
      Mapa de Demanda · Zonas Prioritarias para Expansión
      <!-- Tooltip título -->
      <div
        v-if="tooltipActivo === 'titulo'"
        class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
      >
        <p class="font-semibold text-slate-200 mb-1">Mapa de Demanda</p>
        <p>
          Visualiza las zonas con mayor ocupación de cargadores. Las zonas críticas necesitan expansión urgente de infraestructura para satisfacer la demanda.
        </p>
        <button
          @click.stop="closeTooltip()"
          class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
        >
          ✕ Cerrar
        </button>
      </div>
    </h2>

    <div v-if="!zonasUnicas.length" class="py-8 text-center text-slate-500">
      Sin datos de zonas prioritarias
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="zona in zonasUnicas"
        :key="zona.zona"
        class="group"
      >
        <!-- Barra horizontal con ocupación -->
        <div class="mb-1.5 flex items-center justify-between text-xs">
          <div class="flex flex-col gap-1">
            <span class="font-medium text-slate-200">{{ zona.zona }}</span>
            <span class="text-[10px] text-slate-500">
              {{ zona.estaciones }} {{ zona.estaciones === 1 ? 'estación' : 'estaciones' }}
            </span>
          </div>
          <div class="text-right">
            <div
              @click="toggleTooltip(`ocupacion-${zona.zona}`)"
              class="relative inline-block cursor-help select-none"
            >
              <div
                class="font-bold border-b border-dashed border-slate-600 pb-0.5 hover:border-slate-500 transition-colors"
                :style="{ color: colorPrioridad(zona.prioridad, zona.ocupacionMediaPct).replace('hsl(', '').replace(')', '').split(',')[0] }"
              >
                {{ zona.ocupacionMediaPct }}%
              </div>
              <!-- Tooltip ocupación -->
              <div
                v-if="tooltipActivo === `ocupacion-${zona.zona}`"
                class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:bottom-full md:right-0 md:translate-x-0 md:translate-y-0 md:mb-2 w-[90vw] md:w-48 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
              >
                <p class="font-semibold text-slate-200 mb-1">Ocupación Media</p>
                <p>
                  Promedio de ocupación de conectores en esta zona durante el período seleccionado. Valores altos indican alta demanda y necesidad de más puntos de recarga.
                </p>
                <button
                  @click.stop="closeTooltip()"
                  class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>
            <span class="text-[10px] text-slate-500 block mt-1">
              {{ etiquetaPrioridad(zona.prioridad) }}
            </span>
          </div>
        </div>

        <!-- Barra visual de ocupación -->
        <div class="relative h-8 w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
          <div
            class="flex h-full items-center justify-center transition-all duration-300"
            :style="{
              width: `${(zona.ocupacionMediaPct / 100) * 100}%`,
              backgroundColor: colorPrioridad(zona.prioridad, zona.ocupacionMediaPct),
            }"
          >
            <span v-if="zona.ocupacionMediaPct > 30" class="text-xs font-semibold text-white drop-shadow">
              {{ zona.ocupacionMediaPct }}%
            </span>
          </div>
          
          <!-- Texto fuera si la barra es muy pequeña -->
          <span v-if="zona.ocupacionMediaPct <= 30" class="absolute inset-0 flex items-center px-2 text-xs font-medium text-slate-300">
            {{ zona.ocupacionMediaPct }}%
          </span>
        </div>

        <!-- Indicadores de demanda insatisfecha -->
        <div class="mt-2 flex flex-wrap gap-2">
          <div
            @click="toggleTooltip(`saturacion-${zona.zona}`)"
            class="relative flex items-center gap-1 rounded-md bg-slate-800/50 px-2 py-1 cursor-help select-none"
          >
            <span class="text-[10px] text-slate-500">Sin conectores libres:</span>
            <span class="font-semibold text-amber-300 border-b border-dashed border-amber-400 pb-0 hover:border-amber-300 transition-colors">
              {{ hortasADias(zona.minutosSinConectoresLibres) }}
            </span>
            <!-- Tooltip -->
            <div
              v-if="tooltipActivo === `saturacion-${zona.zona}`"
              class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:bottom-full md:left-0 md:translate-x-0 md:translate-y-0 md:mb-2 w-[90vw] md:w-48 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
            >
              <p class="font-semibold text-slate-200 mb-1">Conectores Saturados</p>
              <p>
                Aunque hay conectores libres, se ocupan rápidamente. Este tiempo mide cuánto duraban <strong>completamente ocupados</strong> sin disponibilidad alguna.
              </p>
              <button
                @click.stop="closeTooltip()"
                class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
              >
                ✕ Cerrar
              </button>
            </div>
          </div>
          <div
            v-if="zona.prioridad === 'critical'"
            class="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-1 ring-1 ring-red-500/50"
          >
            <span class="text-[10px] text-red-300">⚠ {{ zona.recomendacion }}</span>
          </div>
          <div
            v-else-if="zona.prioridad === 'high'"
            class="flex items-center gap-1 rounded-md bg-orange-500/20 px-2 py-1 ring-1 ring-orange-500/50"
          >
            <span class="text-[10px] text-orange-300">💡 {{ zona.recomendacion }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Leyenda de intensidad -->
    <div class="mt-6 border-t border-slate-700 pt-4">
      <div
        @click="toggleTooltip('leyenda')"
        class="mb-2 relative cursor-help inline-block select-none"
      >
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-dashed border-slate-600 pb-1 hover:border-slate-500 transition-colors">
          Prioridad de Expansión
        </span>
        <!-- Tooltip leyenda -->
        <div
          v-if="tooltipActivo === 'leyenda'"
          class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
        >
          <p class="font-semibold text-slate-200 mb-1">Niveles de Prioridad</p>
          <ul class="space-y-1 text-[10px]">
            <li><strong class="text-red-400">Crítico:</strong> Acción inmediata requerida. Saturación grave.</li>
            <li><strong class="text-orange-400">Alto:</strong> Ampliación recomendada a corto plazo.</li>
            <li><strong class="text-yellow-400">Medio:</strong> Monitorear y considerar expansión.</li>
            <li><strong class="text-green-400">Bajo:</strong> Cobertura adecuada, sin urgencia.</li>
          </ul>
          <button
            @click.stop="closeTooltip()"
            class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-2">
        <div class="flex items-center gap-2">
          <div class="h-4 w-4 rounded" style="background-color: hsl(0, 100%, 40%)" />
          <span class="text-xs text-slate-400">Crítico</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="h-4 w-4 rounded" style="background-color: hsl(35, 100%, 40%)" />
          <span class="text-xs text-slate-400">Alto</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="h-4 w-4 rounded" style="background-color: hsl(55, 100%, 40%)" />
          <span class="text-xs text-slate-400">Medio</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="h-4 w-4 rounded" style="background-color: hsl(120, 70%, 40%)" />
          <span class="text-xs text-slate-400">Bajo</span>
        </div>
      </div>
    </div>
  </div>
</template>
