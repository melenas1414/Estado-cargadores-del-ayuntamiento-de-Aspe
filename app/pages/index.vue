<script setup lang="ts">
/**
 * pages/index.vue — Dashboard principal de Estado de Cargadores EV · Aspe
 *
 * Flujo de datos:
 * 1. useFetch('/api/chargers/current')         → estado en tiempo real
 * 2. useFetch('/api/analytics/heatmap?...')    → heatmap semanal
 * 3. useFetch('/api/analytics/metrics?...')    → KPIs de uso
 *
 * Los llamados de análisis se reactivan cuando cambia el período seleccionado.
 */
import { Zap, RefreshCw, MapPin, Wifi, LayoutPanelTop, Map as MapIcon, BrainCircuit, Activity, TrendingUp, Navigation, AlertTriangle } from 'lucide-vue-next';

type Periodo = 'today' | '7d' | '30d' | 'all';
type FiltroCargador = 'all' | string;
type OpcionCargador = { id: string; nombre: string };
type DashboardTab = 'resumen' | 'mapa' | 'inteligencia' | 'diagnostico' | 'expansion';
type DashboardTabTheme = {
  button: string;
  panel: string;
  panelRing: string;
  title: string;
  badge: string;
};

const props = withDefaults(defineProps<{ disableSeo?: boolean; initialTab?: DashboardTab }>(), {
  disableSeo: false,
  initialTab: undefined,
});

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string; icon: any }> = [
  { id: 'resumen', label: 'Resumen', icon: LayoutPanelTop },
  { id: 'mapa', label: 'Mapa', icon: MapIcon },
  { id: 'inteligencia', label: 'Inteligencia', icon: BrainCircuit },
  { id: 'diagnostico', label: 'Diagnóstico', icon: Activity },
  { id: 'expansion', label: 'Expansión', icon: TrendingUp },
];

const TAB_PATHS: Record<DashboardTab, string> = {
  resumen: '/',
  mapa: '/mapa',
  inteligencia: '/inteligencia',
  diagnostico: '/diagnostico',
  expansion: '/expansion',
};

const PATH_TO_TAB: Record<string, DashboardTab> = {
  '/': 'resumen',
  '/resumen': 'resumen',
  '/mapa': 'mapa',
  '/inteligencia': 'inteligencia',
  '/diagnostico': 'diagnostico',
  '/expansion': 'expansion',
};

const TAB_SEO: Record<DashboardTab, {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  breadcrumbName: string;
}> = {
  resumen: {
    title: 'Estado de Cargadores en Aspe en Tiempo Real | Disponibilidad Actual',
    description: 'Consulta el estado en tiempo real de los cargadores de coche eléctrico en Aspe: puntos libres, ocupados, conectores disponibles y última actualización.',
    keywords: 'cargadores coche aspe, cargadores electricos aspe, estado cargadores aspe, cargador coche electrico aspe, recarga aspe',
    ogTitle: 'Cargadores en Aspe | Estado en Tiempo Real',
    ogDescription: 'Disponibilidad actual de cargadores de coche en Aspe con actualización periódica.',
    breadcrumbName: 'Resumen',
  },
  mapa: {
    title: 'Mapa de Cargadores de Coche en Aspe | Ubicaciones y Disponibilidad',
    description: 'Explora el mapa de cargadores de coche eléctrico en Aspe, Alicante. Consulta ubicación por punto y disponibilidad de conectores.',
    keywords: 'mapa cargadores aspe, donde cargar coche electrico aspe, puntos de recarga aspe mapa, ubicacion cargadores aspe',
    ogTitle: 'Mapa de Cargadores en Aspe',
    ogDescription: 'Ubicaciones de cargadores de coche en Aspe con estado de disponibilidad.',
    breadcrumbName: 'Mapa',
  },
  inteligencia: {
    title: 'Predicción de Carga en Aspe | Mejores Horas para Recargar',
    description: 'Consulta analítica y predicción para cargar tu coche eléctrico en Aspe: heatmap, franjas recomendadas y tendencias de ocupación.',
    keywords: 'mejor hora cargar coche electrico aspe, prediccion cargadores aspe, analitica recarga aspe, ocupacion cargadores aspe',
    ogTitle: 'Predicción de Carga en Aspe',
    ogDescription: 'Análisis histórico y predicción de disponibilidad de cargadores en Aspe.',
    breadcrumbName: 'Inteligencia',
  },
  diagnostico: {
    title: 'Diagnóstico de Red de Cargadores en Aspe | Saturación y Prioridades',
    description: 'Diagnóstico avanzado de la red de recarga de Aspe: saturación, incidencias y zonas prioritarias para refuerzo de puntos.',
    keywords: 'diagnostico cargadores aspe, saturacion cargadores aspe, incidencias recarga aspe, zonas prioritarias cargadores aspe',
    ogTitle: 'Diagnóstico de Cargadores en Aspe',
    ogDescription: 'Estado de salud de la red de cargadores y prioridades de mejora en Aspe.',
    breadcrumbName: 'Diagnóstico',
  },
  expansion: {
    title: 'Mapa de Expansión de Cargadores | Ubicaciones Recomendadas para Aspe',
    description: 'Análisis inteligente de ubicaciones recomendadas para nuevos puntos de recarga basado en demanda real, cobertura geográfica e infraestructura de parkings en Aspe.',
    keywords: 'expansion cargadores aspe, nuevos puntos recarga aspe, ubicaciones recomendadas cargadores, planificacion recarga aspe',
    ogTitle: 'Mapa de Expansión de Cargadores',
    ogDescription: 'Análisis inteligente de ubicaciones recomendadas para nuevos puntos de carga en Aspe.',
    breadcrumbName: 'Expansión',
  },
};

const TAB_THEMES: Record<DashboardTab, DashboardTabTheme> = {
  resumen: {
    button: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200 shadow-[0_0_30px_-12px_rgba(16,185,129,0.8)]',
    panel: 'bg-gradient-to-br from-emerald-500/10 via-slate-900/70 to-slate-950/80',
    panelRing: 'ring-emerald-500/25',
    title: 'text-emerald-300',
    badge: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/35',
  },
  mapa: {
    button: 'border-cyan-400/35 bg-cyan-400/10 text-cyan-200 shadow-[0_0_30px_-12px_rgba(34,211,238,0.8)]',
    panel: 'bg-gradient-to-br from-cyan-500/10 via-slate-900/70 to-slate-950/80',
    panelRing: 'ring-cyan-500/25',
    title: 'text-cyan-300',
    badge: 'bg-cyan-500/15 text-cyan-200 ring-cyan-500/35',
  },
  inteligencia: {
    button: 'border-amber-400/35 bg-amber-400/10 text-amber-100 shadow-[0_0_30px_-12px_rgba(251,191,36,0.8)]',
    panel: 'bg-gradient-to-br from-amber-500/10 via-slate-900/70 to-slate-950/80',
    panelRing: 'ring-amber-500/25',
    title: 'text-amber-300',
    badge: 'bg-amber-500/15 text-amber-100 ring-amber-500/35',
  },
  diagnostico: {
    button: 'border-rose-400/35 bg-rose-400/10 text-rose-100 shadow-[0_0_30px_-12px_rgba(251,113,133,0.8)]',
    panel: 'bg-gradient-to-br from-rose-500/10 via-slate-900/70 to-slate-950/80',
    panelRing: 'ring-rose-500/25',
    title: 'text-rose-300',
    badge: 'bg-rose-500/15 text-rose-100 ring-rose-500/35',
  },
  expansion: {
    button: 'border-purple-400/35 bg-purple-400/10 text-purple-100 shadow-[0_0_30px_-12px_rgba(168,85,247,0.8)]',
    panel: 'bg-gradient-to-br from-purple-500/10 via-slate-900/70 to-slate-950/80',
    panelRing: 'ring-purple-500/25',
    title: 'text-purple-300',
    badge: 'bg-purple-500/15 text-purple-100 ring-purple-500/35',
  },
};

const RECOMMENDED_LINKS = {
  tariffComparator: 'https://zoeconecta.com/?fluent-form=9',
  teslaReferral: 'https://www.tesla.com/referral/santiago767265',
} as const;

const maxWidth = 1280;

type RecommendedLinksVariant = 'A' | 'B';
type RecommendedLinksPosition = 'top' | 'bottom';

const STATION_COORDS: Record<string, { lat: number; lon: number }> = {
  ESIBE22E0001001: { lat: 38.341118679046346, lon: -0.7654778230267333 },
  ESIBE22E0001002: { lat: 38.3476704, lon: -0.7691027 },
  ESIBE22E0001003: { lat: 38.3498799, lon: -0.7649660 },
  ESIBE22E0001004: { lat: 38.3430059, lon: -0.7610202 },
  ESIBE22E0001005: { lat: 38.3385331, lon: -0.7766776 },
  'IBERDROLA-5629': { lat: 38.3810859, lon: -0.7308562 },
  ESIBE22E0005629: { lat: 38.3810859, lon: -0.7308562 },
};

const STATION_MAP_LINKS: Record<string, string> = {
  ESIBE22E0001005: 'https://maps.app.goo.gl/9q9Jibv3bMDw16xG7',
};

const STATION_STREETS: Record<string, string> = {
  ESIBE22E0001001: 'Avenida Carlos Soria, 11',
  ESIBE22E0001002: 'Avenida Constitucion, 42',
  ESIBE22E0001003: 'Avenida Padre Ismael, 34',
  ESIBE22E0001004: 'Avenida Juan Carlos I, 36',
  ESIBE22E0001005: 'Calle Orihuela, 100',
  'IBERDROLA-5629': 'Calle Agost, 5, Monforte del Cid',
  ESIBE22E0005629: 'Calle Agost, 5, Monforte del Cid',
};

// ─── Estado de período seleccionado ─────────────────────────────────────────
const periodo = ref<Periodo>('7d');
const cargadorSeleccionado = ref<FiltroCargador>('all');
const tooltipActivo = ref<string | null>(null);
const route = useRoute();
const { trackAction } = useAnalytics();
const recommendedLinksVariant = useCookie<RecommendedLinksVariant>('ab_recommended_links_variant', {
  default: () => (Math.random() < 0.5 ? 'A' : 'B'),
  maxAge: 60 * 60 * 24 * 120,
  sameSite: 'lax',
});

if (recommendedLinksVariant.value !== 'A' && recommendedLinksVariant.value !== 'B') {
  recommendedLinksVariant.value = Math.random() < 0.5 ? 'A' : 'B';
}

function normalizarPath(path: string): string {
  const clean = path.replace(/\/+$/, '');
  return clean || '/';
}

function tabDesdePath(path: string): DashboardTab {
  const normalizado = normalizarPath(path);
  return PATH_TO_TAB[normalizado] ?? 'resumen';
}

const toggleTooltip = (id: string) => {
  tooltipActivo.value = tooltipActivo.value === id ? null : id;
};

const closeTooltip = () => {
  tooltipActivo.value = null;
};

const activeTab = ref<DashboardTab>(props.initialTab ?? tabDesdePath(route.path));
const recommendedLinksPosition = computed<RecommendedLinksPosition>(() => {
  return recommendedLinksVariant.value === 'B' ? 'top' : 'bottom';
});
const lastRecommendedImpressionPath = ref('');

function trackRecommendedLinksImpression(reason: 'mount' | 'route_change', path: string): void {
  if (lastRecommendedImpressionPath.value === path) return;

  lastRecommendedImpressionPath.value = path;
  trackAction('recommended_links_impression', {
    reason,
    path,
    variant: recommendedLinksVariant.value,
    position: recommendedLinksPosition.value,
    active_tab: activeTab.value,
  });
}

watch(
  () => route.path,
  (newPath) => {
    if (!props.initialTab) {
      const tab = tabDesdePath(newPath);
      if (tab !== activeTab.value) activeTab.value = tab;
    }

    trackRecommendedLinksImpression('route_change', newPath);
  },
);

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

const {
  data:    duracionOcupacionData,
  pending: duracionOcupacionPending,
  refresh: refrescarDuracionOcupacion,
} = useFetch('/api/analytics/occupation-duration', {
  query: computed(() => ({
    dias_historico: periodo.value === 'today' ? 7 : 14,
  })),
  watch: [periodo],
  lazy: true,
});

const {
  data:    saludCargadoresData,
  pending: saludCargadoresPending,
  refresh: refrescarSaludCargadores,
} = useFetch('/api/analytics/charger-health', {
  query: computed(() => ({ periodo: periodo.value })),
  watch: [periodo],
  lazy: true,
});

const {
  data:    anomaliasData,
  pending: anomaliasPending,
  refresh: refrescarAnomalias,
} = useFetch('/api/analytics/anomalies', {
  query: computed(() => ({
    period: periodo.value === 'today' ? '7d' : periodo.value,
  })),
  watch: [periodo],
  lazy: true,
});

const {
  data:    recomendacionesData,
  pending: recomendacionesPending,
  refresh: refrescarRecomendaciones,
} = useFetch('/api/analytics/recommendations', {
  lazy: true,
});

const {
  data:    rankingsData,
  pending: rankingsPending,
  refresh: refrescarRankings,
} = useFetch('/api/analytics/rankings', {
  query: computed(() => ({
    period: periodo.value,
  })),
  watch: [periodo],
  lazy: true,
});

// ─── Análisis: métricas ──────────────────────────────────────────────────────
const {
  data:    metricasData,
  pending: metricasPending,
  refresh: refrescarMetricas,
} = useFetch('/api/analytics/metrics', {
  query: computed(() => ({
    periodo: periodo.value,
  })),
  watch: [periodo],
  lazy: true,
});

const etaMinutes = ref(30);

const {
  data:    diagnosticoData,
  pending: diagnosticoPending,
  refresh: refrescarDiagnostico,
} = useFetch('/api/analytics/diagnostic', {
  query: computed(() => ({
    periodo: periodo.value,
  })),
  watch: [periodo],
  lazy: true,
});

const {
  data:    etaData,
  pending: etaPending,
  refresh: refrescarEta,
} = useFetch('/api/analytics/eta', {
  query: computed(() => ({
    minutes: etaMinutes.value,
    periodo: '30d',
  })),
  watch: [etaMinutes],
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
    refrescarDiagnostico(),
    refrescarEta(),
    refrescarDuracionOcupacion(),
    refrescarSaludCargadores(),
    refrescarAnomalias(),
    refrescarRecomendaciones(),
    refrescarRankings(),
  ]);
  refrescando.value = false;

  trackAction('manual_refresh', {
    active_tab: activeTab.value,
    period: periodo.value,
  });
}

// ─── Polling inteligente cada 60 s ────────────────────────────────────────
let intervaloRefresco: ReturnType<typeof setInterval> | null = null;
let refrescoEnCurso = false;

async function pollingInteligente() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  if (refrescoEnCurso) return;
  refrescoEnCurso = true;

  try {
    const ultimaAntes = cargadoresData.value?.ultimaActualizacion ?? '';
    await refrescarCargadores();
    const ultimaDespues = cargadoresData.value?.ultimaActualizacion ?? '';

    if (ultimaDespues && ultimaDespues !== ultimaAntes) {
      await Promise.all([
        refrescarHeatmap(),
        refrescarMetricas(),
        refrescarDiagnostico(),
        refrescarEta(),
        refrescarDuracionOcupacion(),
        refrescarSaludCargadores(),
        refrescarAnomalias(),
        refrescarRecomendaciones(),
        refrescarRankings(),
      ]);
    }
  } finally {
    refrescoEnCurso = false;
  }
}

onMounted(() => {
  trackRecommendedLinksImpression('mount', route.path);

  intervaloRefresco = setInterval(() => {
    pollingInteligente();
  }, 900_000);
});

onBeforeUnmount(() => {
  if (intervaloRefresco !== null) clearInterval(intervaloRefresco);
});

// ─── Datos derivados ─────────────────────────────────────────────────────────
const cargadores   = computed(() => cargadoresData.value?.cargadores ?? []);
const cargadoresFiltrados = computed(() => cargadores.value);
const ultimaActualizacion = computed(() => cargadoresData.value?.ultimaActualizacion ?? '');
const ultimoEstadoProveedor = computed(() => cargadoresData.value?.ultimoEstadoProveedor ?? '');
const opcionesCargador = computed<OpcionCargador[]>(() => {
  const unicos = new Set<string>();
  return cargadores.value
    .filter((c: any) => {
      if (!c?.station_id || unicos.has(c.station_id)) return false;
      unicos.add(c.station_id);
      return true;
    })
    .map((c: any) => ({
      id: c.station_id as string,
      nombre: c.location_name as string,
    }));
});

watch(opcionesCargador, (opciones: OpcionCargador[]) => {
  if (cargadorSeleccionado.value === 'all') return;
  const existe = opciones.some((op: OpcionCargador) => op.id === cargadorSeleccionado.value);
  if (!existe) cargadorSeleccionado.value = 'all';
});

watch(periodo, (value) => {
  trackAction('filter_period_change', { value });
});

watch(cargadorSeleccionado, (value) => {
  trackAction('station_filter_change', { value });
});

const cargadorSeleccionadoLabel = computed(() => {
  if (cargadorSeleccionado.value === 'all') return 'Todos los cargadores';
  const found = opcionesCargador.value.find((op: OpcionCargador) => op.id === cargadorSeleccionado.value);
  return found ? `${found.id} · ${found.nombre}` : cargadorSeleccionado.value;
});

const cargadorSeleccionadoDetalle = computed(() => {
  if (cargadorSeleccionado.value === 'all') return null;

  const stationId = cargadorSeleccionado.value;
  const actual = cargadores.value.find((c: any) => c.station_id === stationId);

  return {
    stationId,
    locationName: actual?.location_name ?? stationId,
    direccion: STATION_STREETS[stationId] ?? 'Direccion no disponible',
  };
});

const estacionRecomendadaDetalle = computed(() => {
  const stationId = etaData.value?.estacionRecomendada?.station_id;
  if (!stationId) return null;

  const coords = STATION_COORDS[stationId];
  if (!coords) return null;

  const locationName =
    etaData.value?.estacionRecomendada?.location_name ||
    STATION_STREETS[stationId] ||
    stationId;

  return {
    stationId,
    locationName,
    direccion: STATION_STREETS[stationId] ?? 'Direccion no disponible',
    lat: coords.lat,
    lon: coords.lon,
    googleUrl:
      STATION_MAP_LINKS[stationId] ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`,
  };
});

const activeTabTheme = computed<DashboardTabTheme>(() => TAB_THEMES[activeTab.value]);
const isResumenOrMapa = computed<boolean>(() => activeTab.value === 'resumen' || activeTab.value === 'mapa');
const muestraFiltroPeriodo = computed<boolean>(() => !isResumenOrMapa.value);

const saludTop = computed(() => saludCargadoresData.value?.porEstacion?.slice(0, 5) ?? []);
const recomendacionesTop = computed(() => recomendacionesData.value?.recommendations ?? []);
const anomaliasTop = computed(() => anomaliasData.value?.anomalies?.slice(0, 6) ?? []);
const rankingTop = computed(() => rankingsData.value?.rankings?.slice(0, 5) ?? []);
const activeTabLabel = computed<string>(() => {
  const found = DASHBOARD_TABS.find((tab) => tab.id === activeTab.value);
  return found?.label ?? 'Resumen';
});

function claseColorOcupacion(tasa: number): string {
  if (tasa < 40) return 'text-emerald-400';
  if (tasa < 70) return 'text-amber-400';
  return 'text-rose-400';
}

function anchoBarraOcupacion(tasa: number): string {
  return `${Math.min(Math.max(tasa, 0), 100)}%`;
}

function claseBarraOcupacion(tasa: number): string {
  if (tasa < 40) return 'bg-emerald-500';
  if (tasa < 70) return 'bg-amber-500';
  return 'bg-rose-500';
}

function tabButtonClass(tabId: DashboardTab): string {
  if (activeTab.value === tabId) {
    return TAB_THEMES[tabId].button;
  }
  return 'border border-transparent bg-slate-950/50 text-slate-400 hover:bg-slate-900 hover:text-slate-200';
}

function onTabClick(tabId: DashboardTab): void {
  trackAction('tab_navigation_click', { tab: tabId });
}

function onRecommendedLinkClick(linkKey: 'tariff_comparator' | 'tesla_referral', position: RecommendedLinksPosition): void {
  trackAction('recommended_link_click', {
    link: linkKey,
    position,
    variant: recommendedLinksVariant.value,
    active_tab: activeTab.value,
  });
}

function libresPorCargador(c: any) {
  if (typeof c.available_connectors === 'number') return Math.max(0, Math.min(2, c.available_connectors));
  return c.is_available ? 1 : 0;
}

const libres   = computed(() => cargadoresFiltrados.value.filter((c: any) => c.is_available).length);
const ocupados = computed(() => cargadoresFiltrados.value.filter((c: any) => !c.is_available).length);
const conectoresLibres = computed(() => cargadoresFiltrados.value.reduce((sum: number, c: any) => {
  return sum + libresPorCargador(c);
}, 0));
const conectoresTotales = computed(() => cargadoresFiltrados.value.reduce((sum: number, c: any) => {
  if (typeof c.total_connectors === 'number' && c.total_connectors > 0) return sum + c.total_connectors;
  return sum + 2;
}, 0));

const horaLegible = computed(() => {
  if (!ultimaActualizacion.value) return '—';
  return new Date(ultimaActualizacion.value).toLocaleTimeString('es-ES', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Madrid',
  });
});

const horaLegibleEstado = computed(() => {
  if (!ultimoEstadoProveedor.value) return '—';
  return new Date(ultimoEstadoProveedor.value).toLocaleTimeString('es-ES', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Madrid',
  });
});

// Supertítulo de estado global
const estadoGlobal = computed(() => {
  if (!cargadoresFiltrados.value.length) return null;
  if (conectoresLibres.value === conectoresTotales.value) {
    return { texto: `${conectoresLibres.value}/${conectoresTotales.value} conectores libres`, clase: 'text-emerald-400' };
  }
  if (conectoresLibres.value === 0) {
    return { texto: `0/${conectoresTotales.value} conectores libres`, clase: 'text-rose-400' };
  }
  return { texto: `${conectoresLibres.value}/${conectoresTotales.value} conectores libres`, clase: 'text-amber-400' };
});

const disponibilidadPorPunto = computed(() => cargadoresFiltrados.value.map((c: any) => {
  const total = typeof c.total_connectors === 'number' && c.total_connectors > 0 ? c.total_connectors : 2;
  const libres = libresPorCargador(c);
  const ocupados = Math.max(0, total - libres);

  return {
    stationId: c.station_id,
    locationName: c.location_name,
    libres,
    ocupados,
    total,
    lat: STATION_COORDS[c.station_id]?.lat,
    lon: STATION_COORDS[c.station_id]?.lon,
    googleUrl:
      STATION_MAP_LINKS[c.station_id] ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.location_name)}`,
  };
}));

const puntosMapa = computed(() => {
  if (cargadorSeleccionado.value !== 'all') return disponibilidadPorPunto.value;

  const byStation = new Map<string, any>(
    disponibilidadPorPunto.value.map((p: any) => [p.stationId, p]),
  );

  return Object.entries(STATION_COORDS).map(([stationId, coords]) => {
    const current = byStation.get(stationId);
    if (current) return current;

    const fallbackName = STATION_STREETS[stationId] ?? stationId;

    return {
      stationId,
      locationName: fallbackName,
      libres: 0,
      ocupados: 2,
      total: 2,
      lat: coords.lat,
      lon: coords.lon,
      googleUrl:
        STATION_MAP_LINKS[stationId] ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackName)}`,
    };
  });
});

function classesEstadoPunto(libres: number, total: number) {
  const totalSafe = total > 0 ? total : 1;
  const ratio = libres / totalSafe;

  if (ratio <= 0) {
    return {
      card: 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-400/60 hover:text-rose-200',
      detail: 'text-rose-300',
      tono: 'ocupado',
    };
  }

  if (ratio >= 1) {
    return {
      card: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/60 hover:text-emerald-200',
      detail: 'text-emerald-300',
      tono: 'libre',
    };
  }

  return {
    card: 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400/60 hover:text-amber-200',
    detail: 'text-amber-300',
    tono: 'parcial',
  };
}

const runtimeConfig = useRuntimeConfig();
const siteUrl = (runtimeConfig.public.siteUrl || 'https://cargadores-aspe.onlineexpansions.com').replace(/\/+$/, '');
const tabActual = computed<DashboardTab>(() => props.initialTab ?? tabDesdePath(route.path));
const seoActual = computed(() => TAB_SEO[tabActual.value]);
const canonicalPath = computed(() => TAB_PATHS[tabActual.value]);
const canonicalUrl = computed(() => `${siteUrl}${canonicalPath.value}`);
const rootUrl = `${siteUrl}/`;
const socialImageUrl = `${siteUrl}/map.png`;

// ─── SEO estructurado ────────────────────────────────────────────────────────
// Datos de estaciones para JSON-LD (LocalBusiness por punto de carga)
const SEO_STATIONS = [
  { id: 'ESIBE22E0001001', name: 'Cargador Eléctrico Aspe · Av. Carlos Soria',  street: 'Avenida Carlos Soria, 11',  lat: 38.341118679046346, lon: -0.7654778230267333 },
  { id: 'ESIBE22E0001002', name: 'Cargador Eléctrico Aspe · Av. Constitución',  street: 'Avenida Constitución, 42', lat: 38.3476704, lon: -0.7691027 },
  { id: 'ESIBE22E0001003', name: 'Cargador Eléctrico Aspe · Av. Padre Ismael',  street: 'Avenida Padre Ismael, 34', lat: 38.3498799, lon: -0.7649660 },
  { id: 'ESIBE22E0001004', name: 'Cargador Eléctrico Aspe · Av. Juan Carlos I', street: 'Avenida Juan Carlos I, 36', lat: 38.3430059, lon: -0.7610202 },
  { id: 'ESIBE22E0001005', name: 'Cargador Eléctrico Aspe · Calle Orihuela',    street: 'Calle Orihuela, 100',      lat: 38.3385331, lon: -0.7766776 },
];

if (!props.disableSeo) {
  useSeoMeta({
    title: () => seoActual.value.title,
    description: () => seoActual.value.description,
    keywords: () => seoActual.value.keywords,
    ogTitle: () => seoActual.value.ogTitle,
    ogDescription: () => seoActual.value.ogDescription,
    ogImage: () => socialImageUrl,
    ogImageSecureUrl: () => socialImageUrl,
    ogImageAlt: 'Panel de estado de cargadores en Aspe',
    ogImageWidth: '1200',
    ogImageHeight: '630',
    ogType: 'website',
    ogLocale: 'es_ES',
    ogUrl: () => canonicalUrl.value,
    robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    twitterCard: 'summary_large_image',
    twitterTitle: () => seoActual.value.ogTitle,
    twitterDescription: () => seoActual.value.ogDescription,
    twitterImage: () => socialImageUrl,
    twitterImageAlt: 'Panel de estado de cargadores en Aspe',
  });

  useHead(() => ({
    htmlAttrs: { lang: 'es' },
    link: [
      { rel: 'canonical', href: canonicalUrl.value },
      { rel: 'alternate', hreflang: 'es', href: rootUrl },
      { rel: 'alternate', hreflang: 'x-default', href: rootUrl },
    ],
    meta: [
      // Geo meta tags para SEO local
      { name: 'geo.region',    content: 'ES-VC' },
      { name: 'geo.placename', content: 'Aspe, Alicante, España' },
      { name: 'geo.position',  content: '38.3485;-0.7639' },
      { name: 'ICBM',          content: '38.3485, -0.7639' },
    ],
    script: [
    // ── 1. WebSite ────────────────────────────────────────────────────────────
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Estado de Cargadores de Aspe',
        alternateName: 'Cargadores Aspe',
        url: rootUrl,
        description:
          'Monitor de disponibilidad de cargadores eléctricos públicos en Aspe (Alicante) con vista de estado, mapa, analítica y diagnóstico.',
        inLanguage: 'es-ES',
        creator:   { '@type': 'Organization', name: 'OnlineExpansions', url: 'https://onlineexpansions.com' },
        publisher: { '@type': 'Organization', name: 'OnlineExpansions', url: 'https://onlineexpansions.com' },
        about: {
          '@type': 'City',
          name: 'Aspe',
          containedInPlace: { '@type': 'AdministrativeArea', name: 'Alicante' },
        },
      }),
    },

    // ── 2. ItemList · LocalBusiness por punto de carga ────────────────────────
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Puntos de carga eléctrica pública en Aspe, Alicante',
        description:
          '5 puntos de recarga para vehículos eléctricos del Ayuntamiento de Aspe gestionados por Iberdrola. Conector Tipo 2 · 11 kW.',
        numberOfItems: SEO_STATIONS.length,
        itemListElement: SEO_STATIONS.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'LocalBusiness',
            '@id': `${rootUrl}#${s.id}`,
            name: s.name,
            description: `Punto de carga eléctrica pública en Aspe (Alicante). Conector Tipo 2 · 11 kW AC. ID REEV: ${s.id}. Gestionado por Iberdrola.`,
            url: rootUrl,
            address: {
              '@type': 'PostalAddress',
              streetAddress:   s.street,
              addressLocality: 'Aspe',
              addressRegion:   'Alicante',
              postalCode:      '03680',
              addressCountry:  'ES',
            },
            geo: {
              '@type':    'GeoCoordinates',
              latitude:   s.lat,
              longitude:  s.lon,
            },
            amenityFeature: [
              { '@type': 'LocationFeatureSpecification', name: 'Conector Tipo 2 (IEC 62196)', value: true },
              { '@type': 'LocationFeatureSpecification', name: 'Potencia 11 kW AC',           value: true },
              { '@type': 'LocationFeatureSpecification', name: 'Carga pública 24h',            value: true },
              { '@type': 'LocationFeatureSpecification', name: '2 conectores por punto',       value: true },
            ],
            openingHoursSpecification: {
              '@type':      'OpeningHoursSpecification',
              dayOfWeek:    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
              opens:        '00:00',
              closes:       '23:59',
            },
            areaServed: {
              '@type': 'City',
              name: 'Aspe',
              containedInPlace: { '@type': 'AdministrativeArea', name: 'Alicante' },
            },
            servesCuisine: null,
          },
        })),
      }),
    },

    // ── 3. FAQPage · preguntas frecuentes sobre cargadores en Aspe ────────────
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: '¿Dónde hay cargadores para coches eléctricos en Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Aspe dispone de 5 puntos de carga pública gestionados por Iberdrola: Avenida Carlos Soria 11, Avenida Constitución 42, Avenida Padre Ismael 34, Avenida Juan Carlos I 36 y Calle Orihuela 100. Todos en el término municipal de Aspe (Alicante), código postal 03680.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Qué tipo de conector tienen los cargadores eléctricos de Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Los cargadores de Aspe disponen de conectores Tipo 2 (IEC 62196) con una potencia de 11 kW en corriente alterna (AC). Este estándar es compatible con la gran mayoría de vehículos eléctricos e híbridos enchufables europeos.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Cuántos conectores tiene cada punto de recarga de Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Cada punto de carga en Aspe dispone de 2 conectores Tipo 2 de 11 kW, lo que permite cargar dos vehículos simultáneamente. En total, Aspe cuenta con 10 conectores repartidos en 5 ubicaciones.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Son gratuitos los cargadores eléctricos del Ayuntamiento de Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Los puntos de recarga del Ayuntamiento de Aspe están gestionados por Iberdrola. Para conocer las tarifas y condiciones más actualizadas, consulta la aplicación oficial Iberdrola e-mobility o el portal del Ayuntamiento de Aspe.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Cuál es la mejor hora para cargar el coche eléctrico en Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Según el análisis histórico de disponibilidad, los cargadores de Aspe suelen estar más libres durante las primeras horas de la mañana (7:00-9:00h) y al mediodía (13:00-15:00h). En esta página encontrarás una predicción actualizada basada en inteligencia artificial.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Cómo saber si los cargadores de Aspe están libres ahora mismo?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Puedes consultar el estado en tiempo real directamente en esta página. Verás el estado libre u ocupado de cada uno de los 5 puntos de recarga de Aspe con actualización periódica.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Hay cargadores rápidos (DC) en Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Los cargadores públicos de Aspe son de tipo semi-rápido con 11 kW en corriente alterna (AC). Actualmente no hay cargadores ultra-rápidos de corriente continua (DC) tipo CCS Combo 2 o CHAdeMO en Aspe.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Con qué frecuencia se actualiza el estado de los cargadores de Aspe?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'El estado de los cargadores de Aspe se actualiza de forma periódica para ofrecer información de disponibilidad reciente y útil para planificar la recarga.',
            },
          },
        ],
      }),
    },

    // ── 4. BreadcrumbList ─────────────────────────────────────────────────────
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: rootUrl },
          { '@type': 'ListItem', position: 2, name: seoActual.value.breadcrumbName, item: canonicalUrl.value },
        ],
      }),
    },
    ],
  }));
}
</script>

<template>
  <!-- Tesla M3 Popup -->
  <TeslaM3Popup v-if="activeTab !== 'expansion'" />

  <main class="min-h-screen bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(16,185,129,0.08),transparent),radial-gradient(1000px_500px_at_90%_-5%,rgba(34,211,238,0.08),transparent),#020617] px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl space-y-8">

      <!-- ════════ HEADER ════════ -->
      <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" @click.self="closeTooltip()">
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

          <div class="relative inline-block">
            <h1
              @click="toggleTooltip('titulo')"
              class="text-2xl font-bold tracking-tight text-white sm:text-3xl cursor-help border-b border-dashed border-blue-500/30 pb-1 hover:border-blue-500/50 transition-colors select-none inline-block"
            >
              <Zap class="mr-2 inline h-7 w-7 text-blue-400" fill="currentColor" />
              Estado de Carga en Aspe
            </h1>
            <!-- Tooltip del título -->
            <div
              v-if="tooltipActivo === 'titulo'"
              class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
            >
              <p class="font-semibold text-slate-200 mb-1">Estado en Tiempo Real</p>
              <p>
                Monitor de disponibilidad actual de todos los cargadores de coche eléctrico en Aspe. Los datos se actualizan cada pocos minutos para reflejar el estado real de los puntos de recarga.
              </p>
              <button
                @click.stop="closeTooltip()"
                class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
              >
                ✕ Cerrar
              </button>
            </div>
          </div>

          <p class="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
            <MapPin class="h-3.5 w-3.5" />
            Iberdrola 22 kW · Ayuntamiento de Aspe, Alicante
          </p>
        </div>

        <!-- Última actualización + botón de refresco -->
        <div class="flex items-center gap-3">
          <div class="text-right">
            <p class="text-xs text-slate-500">Muestra</p>
            <p class="text-sm font-medium text-slate-300">{{ horaLegible }}</p>
            <p class="text-[11px] text-slate-500">Proveedor: {{ horaLegibleEstado }}</p>
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

      <!-- ════════ NAVEGACIÓN DEL DASHBOARD ════════ -->
      <nav
        class="rounded-2xl border border-slate-800 bg-slate-900/60 p-2 backdrop-blur"
        aria-label="Secciones del dashboard"
        @click.self="closeTooltip()"
      >
        <div class="flex snap-x gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
          <NuxtLink
            v-for="tab in DASHBOARD_TABS"
            :key="tab.id"
            :to="TAB_PATHS[tab.id]"
            class="relative min-w-[150px] snap-start flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all md:min-w-0"
            :class="tabButtonClass(tab.id)"
            @click="onTabClick(tab.id)"
          >
            <component :is="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
            
            <!-- Tooltip de sección -->
            <div
              v-if="tooltipActivo === `tab-${tab.id}`"
              class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-1/2 md:-translate-x-1/2 md:translate-y-0 md:mt-2 w-[90vw] md:w-52 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
            >
              <p class="font-semibold text-slate-200 mb-1">{{ tab.label }}</p>
              <p v-if="tab.id === 'resumen'">
                Vista general del estado actual de los cargadores con disponibilidad y ocupación en tiempo real.
              </p>
              <p v-else-if="tab.id === 'mapa'">
                Mapa interactivo que muestra la ubicación exacta de cada punto de recarga en Aspe.
              </p>
              <p v-else-if="tab.id === 'inteligencia'">
                Análisis predictivo y estadísticas: mejores horas para cargar, tendencias y predicciones.
              </p>
              <p v-else-if="tab.id === 'diagnostico'">
                Diagnóstico completo de la red: saturación, incidencias, zonas críticas y recomendaciones.
              </p>
              <p v-else-if="tab.id === 'expansion'">
                Análisis inteligente de ubicaciones recomendadas para nuevos puntos de recarga basado en demanda y parkings.
              </p>
              <button
                @click.stop="closeTooltip()"
                class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
              >
                ✕ Cerrar
              </button>
            </div>
          </NuxtLink>
        </div>
      </nav>

      <!-- ════════ BANNER ANUNCIO TOP (variante B) ════════ -->
      <section
        v-if="recommendedLinksPosition === 'top'"
        class="relative overflow-hidden rounded-2xl p-px"
        style="background: linear-gradient(135deg, rgba(6,182,212,0.6) 0%, rgba(16,185,129,0.5) 50%, rgba(139,92,246,0.4) 100%)"
      >
        <!-- Label publicidad -->
        <span class="absolute right-3 top-2.5 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-slate-400">
          Publicidad
        </span>

        <div class="relative rounded-2xl bg-slate-950/92 p-4 backdrop-blur-sm md:p-5">
          <!-- Glow de fondo -->
          <div class="pointer-events-none absolute inset-0 rounded-2xl opacity-20" style="background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(6,182,212,0.5) 0%, transparent 70%)"></div>

          <div class="relative grid grid-cols-1 gap-3 md:grid-cols-2">
            <!-- Tarifa luz -->
            <a
              :href="RECOMMENDED_LINKS.tariffComparator"
              target="_blank"
              rel="sponsored noopener noreferrer"
              class="group relative overflow-hidden rounded-xl p-px transition-all duration-300"
              style="background: linear-gradient(135deg, rgba(6,182,212,0.5) 0%, rgba(6,182,212,0.15) 100%)"
              @click="onRecommendedLinkClick('tariff_comparator', 'top')"
            >
              <div class="relative flex h-full flex-col gap-2 rounded-xl bg-slate-950/85 p-4 transition-colors group-hover:bg-slate-900/90">
                <div class="flex items-center gap-2">
                  <div class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-cyan-500/40">
                    <img src="/zoeconecta-icon.png" alt="ZOE Conecta" class="h-6 w-6 object-contain" />
                  </div>
                  <p class="text-[11px] font-semibold uppercase tracking-widest text-cyan-300">Tarifa de luz</p>
                </div>
                <p class="text-sm font-bold leading-snug text-white">
                  ¿Estás pagando de más? Compara tu tarifa eléctrica ahora
                </p>
                <p class="mt-auto flex items-center gap-1 text-xs font-medium text-cyan-400 group-hover:text-cyan-300">
                  Comparar gratis <svg class="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </p>
              </div>
            </a>

            <!-- Tesla -->
            <a
              :href="RECOMMENDED_LINKS.teslaReferral"
              target="_blank"
              rel="sponsored noopener noreferrer"
              class="group relative overflow-hidden rounded-xl p-px transition-all duration-300"
              style="background: linear-gradient(135deg, rgba(16,185,129,0.5) 0%, rgba(16,185,129,0.15) 100%)"
              @click="onRecommendedLinkClick('tesla_referral', 'top')"
            >
              <div class="relative flex h-full flex-col gap-2 rounded-xl bg-slate-950/85 p-4 transition-colors group-hover:bg-slate-900/90">
                <div class="flex items-center gap-2">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-black ring-1 ring-emerald-500/40 p-1">
                    <img src="/tesla-logo.svg" alt="Tesla" class="h-full w-full object-contain" />
                  </div>
                  <p class="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">Tesla Referral</p>
                </div>
                <p class="text-sm font-bold leading-snug text-white">
                  1.000 km de Supercarga gratis o €500 de descuento en tu Tesla
                </p>
                <p class="mt-auto flex items-center gap-1 text-xs font-medium text-emerald-400 group-hover:text-emerald-300">
                  Ver oferta <svg class="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </p>
              </div>
            </a>
          </div>
        </div>
      </section>

      <!-- ════════ BARRA DE CONTROLES GLOBAL ════════ -->
      <section
        class="rounded-2xl border border-slate-800 p-4 transition-all"
        :class="[activeTabTheme.panel, `ring-1 ${activeTabTheme.panelRing}`]"
        @click.self="closeTooltip()"
      >
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <FilterButtons v-if="muestraFiltroPeriodo" v-model="periodo" />
          <div v-if="muestraFiltroPeriodo" class="relative">
            <button
              @click="toggleTooltip('periodo')"
              class="cursor-help text-slate-500 hover:text-slate-300 transition-colors"
              title="Información sobre períodos"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <!-- Tooltip períodos -->
            <div
              v-if="tooltipActivo === 'periodo'"
              class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
            >
              <p class="font-semibold text-slate-200 mb-1.5">Período de Análisis</p>
              <ul class="space-y-1.5 text-[10px]">
                <li><strong class="text-emerald-400">Hoy:</strong> Últimas 24 horas</li>
                <li><strong class="text-blue-400">7d:</strong> Últimos 7 días</li>
                <li><strong class="text-purple-400">30d:</strong> Últimos 30 días</li>
                <li><strong class="text-orange-400">Todo:</strong> Historial completo</li>
              </ul>
              <button
                @click.stop="closeTooltip()"
                class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
              >
                ✕ Cerrar
              </button>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span class="inline-flex items-center rounded-full px-2.5 py-1 ring-1" :class="activeTabTheme.badge">
            Vista: {{ activeTabLabel }}
          </span>
        </div>
      </section>

      <div class="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100/90">
        Actualización: hemos añadido el cargador de Monforte del Cid. Aunque no pertenece a Aspe,
        puede ayudar a vecinos cercanos a encontrar una alternativa de recarga.
      </div>

      <!-- ════════ ERROR ════════ -->
      <div
        v-if="cargadoresError"
        class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
      >
        Error al cargar los datos: {{ cargadoresError.message }}
      </div>

      <Transition name="tab-panel" mode="out-in">
        <div :key="activeTab">
          <!-- ════════ TAB: RESUMEN ════════ -->
          <section v-if="activeTab === 'resumen'" aria-labelledby="tab-resumen" class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 md:p-5" @click.self="closeTooltip()">
            <div class="relative inline-block">
              <h2
                id="tab-resumen"
                @click="toggleTooltip('resumen-titulo')"
                class="text-xs font-semibold uppercase tracking-wider cursor-help border-b border-dashed border-emerald-500/30 pb-1 hover:border-emerald-500/50 transition-colors select-none"
                :class="activeTabTheme.title"
              >
                Resumen operativo
              </h2>
              <!-- Tooltip del resumen -->
              <div
                v-if="tooltipActivo === 'resumen-titulo'"
                class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
              >
                <p class="font-semibold text-slate-200 mb-1">Resumen Operativo</p>
                <p>
                  Vista de las métricas principales de disponibilidad: conectores libres, puntos disponibles y ocupados en tiempo real.
                </p>
                <button
                  @click.stop="closeTooltip()"
                  class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-4 group">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1">
                    <p
                      @click="toggleTooltip('conectores-libres')"
                      class="text-xs text-slate-500 cursor-help border-b border-dashed border-emerald-400/30 hover:border-emerald-400/50 transition-colors select-none inline-block pb-0.5"
                    >
                      Conectores libres
                    </p>
                  </div>
                </div>
                <p class="mt-1 text-3xl font-bold text-emerald-400">{{ conectoresLibres }}</p>
                <p class="text-xs text-slate-600">de {{ conectoresTotales }} conectores</p>
                <!-- Tooltip conectores -->
                <div
                  v-if="tooltipActivo === 'conectores-libres'"
                  class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-1/2 md:-translate-x-1/2 md:translate-y-0 md:mt-2 w-[90vw] md:w-48 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                >
                  <p class="font-semibold text-slate-200 mb-1">Conectores Libres</p>
                  <p>Cantidad total de conectores disponibles en todos los cargadores de la red.</p>
                  <button
                    @click.stop="closeTooltip()"
                    class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p
                  @click="toggleTooltip('puntos-disponibles')"
                  class="text-xs text-slate-500 cursor-help border-b border-dashed border-blue-400/30 hover:border-blue-400/50 transition-colors select-none inline-block pb-0.5"
                >
                  Puntos disponibles
                </p>
                <p class="mt-1 text-3xl font-bold text-white">{{ libres }}</p>
                <p class="text-xs text-slate-600">{{ cargadores.length }} puntos monitorizados</p>
                <!-- Tooltip puntos disponibles -->
                <div
                  v-if="tooltipActivo === 'puntos-disponibles'"
                  class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-1/2 md:-translate-x-1/2 md:translate-y-0 md:mt-2 w-[90vw] md:w-48 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                >
                  <p class="font-semibold text-slate-200 mb-1">Puntos Disponibles</p>
                  <p>Cantidad de cargadores que tienen al menos un conector libre.</p>
                  <button
                    @click.stop="closeTooltip()"
                    class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>
              <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p
                  @click="toggleTooltip('puntos-ocupados')"
                  class="text-xs text-slate-500 cursor-help border-b border-dashed border-rose-400/30 hover:border-rose-400/50 transition-colors select-none inline-block pb-0.5"
                >
                  Puntos ocupados
                </p>
                <p class="mt-1 text-3xl font-bold text-rose-400">{{ ocupados }}</p>
                <p class="text-xs text-slate-600">estado instantáneo</p>
                <!-- Tooltip puntos ocupados -->
                <div
                  v-if="tooltipActivo === 'puntos-ocupados'"
                  class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-1/2 md:-translate-x-1/2 md:translate-y-0 md:mt-2 w-[90vw] md:w-48 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                >
                  <p class="font-semibold text-slate-200 mb-1">Puntos Ocupados</p>
                  <p>Cantidad de cargadores completamente llenos sin conectores disponibles.</p>
                  <button
                    @click.stop="closeTooltip()"
                    class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>
            </div>

            <section aria-labelledby="probabilidad-llegada-home" class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="relative inline-block">
                  <h3
                    id="probabilidad-llegada-home"
                    @click="toggleTooltip('eta-explicacion')"
                    class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-cyan-400/30 hover:border-cyan-400/50 transition-colors select-none pb-0.5"
                  >
                    Probabilidad al llegar
                  </h3>
                  <!-- Tooltip ETA -->
                  <div
                    v-if="tooltipActivo === 'eta-explicacion'"
                    class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                  >
                    <p class="font-semibold text-slate-200 mb-1">Probabilidad al Llegar</p>
                    <p>
                      Probabilidad de encontrar un conector libre al llegar en el tiempo indicado, basada en patrones históricos de ocupación.
                    </p>
                    <button
                      @click.stop="closeTooltip()"
                      class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                    >
                      ✕ Cerrar
                    </button>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="m in [5, 15, 30, 60]"
                    :key="`eta-home-${m}`"
                    class="rounded-full border px-3 py-1 text-xs transition-colors"
                    :class="etaMinutes === m ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'"
                    @click="etaMinutes = m"
                  >
                    {{ m }} min
                  </button>
                </div>
              </div>

              <div v-if="etaPending" class="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
              <div v-else class="space-y-3">
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p class="text-xs text-slate-500">Red municipal libre en {{ etaMinutes }} min</p>
                    <p class="mt-1 text-2xl font-bold" :class="(etaData?.probabilidadMunicipalLibre ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'">{{ etaData?.probabilidadMunicipalLibre ?? 0 }}%</p>
                    <p class="text-[11px] text-slate-500">{{ etaData?.muestras ?? 0 }} muestras historicas</p>
                  </div>
                  <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <template v-if="(etaData?.probabilidadMunicipalLibre ?? 0) > 0">
                      <p class="text-xs text-slate-500">Mejor opcion estimada</p>
                      <p class="mt-1 text-sm font-semibold text-white">{{ etaData?.estacionRecomendada?.location_name ?? 'Sin datos' }}</p>
                      <p class="text-[11px] text-slate-400">{{ estacionRecomendadaDetalle?.direccion ?? 'Direccion no disponible' }}</p>
                      <p class="text-[11px] text-slate-500">{{ etaData?.estacionRecomendada?.probabilidadLibre ?? 0 }}% probabilidad libre</p>
                    </template>
                    <template v-else>
                      <p class="text-xs text-slate-500">Previsión</p>
                      <p class="mt-1 text-sm font-semibold text-red-400">Sin posibilidad en {{ etaMinutes }} min</p>
                      <p class="mt-1 text-[11px] text-slate-400">
                        Según el histórico, es muy poco probable que haya un cargador libre en los próximos {{ etaMinutes }} minutos.
                      </p>
                    </template>
                  </div>
                </div>

                <!-- Mapa de la estación recomendada (siempre visible cuando hay datos) -->
                <div v-if="estacionRecomendadaDetalle && (etaData?.probabilidadMunicipalLibre ?? 0) > 0" class="overflow-hidden rounded-xl border border-slate-800">
                  <iframe
                    :src="`https://www.openstreetmap.org/export/embed.html?bbox=${estacionRecomendadaDetalle.lon - 0.004},${estacionRecomendadaDetalle.lat - 0.003},${estacionRecomendadaDetalle.lon + 0.004},${estacionRecomendadaDetalle.lat + 0.003}&layer=mapnik&marker=${estacionRecomendadaDetalle.lat},${estacionRecomendadaDetalle.lon}`"
                    class="h-44 w-full border-0"
                    loading="lazy"
                    :title="`Mapa de ${estacionRecomendadaDetalle.locationName}`"
                    sandbox="allow-scripts allow-same-origin"
                  />
                  <div class="flex items-center justify-between bg-slate-950/80 px-3 py-2">
                    <span class="text-[11px] text-slate-400">{{ estacionRecomendadaDetalle.locationName }}</span>
                    <a
                      :href="estacionRecomendadaDetalle.googleUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      Abrir en Maps ↗
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="estado-actual">
              <h3 id="estado-actual" class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Estado actual por punto
              </h3>

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
                  v-for="c in cargadoresFiltrados"
                  :key="c.station_id"
                  :station-id="c.station_id"
                  :location-name="c.location_name"
                  :is-available="c.is_available"
                  :power-kw="c.power_kw"
                  :updated-at="c.created_at"
                  :provider-updated-at="c.availability_updated_at"
                  :available-connectors="libresPorCargador(c)"
                  :total-connectors="c.total_connectors || 2"
                  :connector-type="c.connector_type"
                  :connectors="c.connectors"
                />
              </div>
            </section>
          </section>

          <!-- ════════ TAB: MAPA ════════ -->
          <section v-else-if="activeTab === 'mapa'" aria-labelledby="tab-mapa" class="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 md:p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h2 id="tab-mapa" class="text-xs font-semibold uppercase tracking-wider" :class="activeTabTheme.title">
                Mapa y disponibilidad por cargador
              </h2>
              <span class="text-[11px] text-slate-500">Aspe · Alicante</span>
            </div>

            <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
              <ClientOnly>
                <ChargersMap :points="puntosMapa" />
                <template #fallback>
                  <div class="h-72 w-full animate-pulse bg-slate-900" />
                </template>
              </ClientOnly>
              <div class="grid grid-cols-1 gap-2 border-t border-slate-800 p-3 sm:grid-cols-2 lg:grid-cols-3">
                <div
                  v-for="p in puntosMapa"
                  :key="`map-${p.stationId}`"
                  class="rounded-lg border px-3 py-2 text-xs transition-colors"
                  :class="classesEstadoPunto(p.libres, p.total).card"
                >
                  <span class="block font-medium" :class="classesEstadoPunto(p.libres, p.total).detail">{{ p.stationId }}</span>
                  <NuxtLink :to="`/charger/${p.stationId}`" class="block truncate text-slate-300 hover:text-slate-100 hover:underline transition-colors font-medium mt-1">
                    {{ p.locationName }}
                    <span class="text-slate-500 text-[10px]">→</span>
                  </NuxtLink>
                  <span class="block text-slate-500 mt-1">{{ p.libres }}/{{ p.total }} libres</span>
                  <div class="mt-2 flex gap-2">
                    <a
                      :href="p.googleUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex-1 rounded px-2 py-1 text-[10px] font-medium text-center text-slate-400 hover:text-white transition-colors border border-slate-700/50 hover:border-slate-600"
                    >
                      Maps
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ════════ TAB: INTELIGENCIA ════════ -->
          <section v-else-if="activeTab === 'inteligencia'" aria-labelledby="tab-inteligencia" class="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 md:p-5" @click.self="closeTooltip()">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div class="relative inline-block">
                <h2
                  id="tab-inteligencia"
                  @click="toggleTooltip('inteligencia-titulo')"
                  class="text-xs font-semibold uppercase tracking-wider cursor-help border-b border-dashed border-purple-500/30 hover:border-purple-500/50 transition-colors select-none pb-0.5"
                  :class="activeTabTheme.title"
                >
                  Inteligencia y analítica
                </h2>
                <!-- Tooltip inteligencia -->
                <div
                  v-if="tooltipActivo === 'inteligencia-titulo'"
                  class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                >
                  <p class="font-semibold text-slate-200 mb-1">Inteligencia y Analítica</p>
                  <p>
                    Análisis histórico de patrones de ocupación, gráficos de calor y recomendaciones basadas en datos.
                  </p>
                  <button
                    @click.stop="closeTooltip()"
                    class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>
            </div>

            <div class="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-10">
              <div class="xl:col-span-7 space-y-4">
                <div v-if="heatmapPending" class="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
                <div v-else-if="heatmapData" class="space-y-2">
                  <h3 class="text-sm font-semibold text-slate-300">Mapa de Calor Semanal · Ocupación por Hora</h3>
                  <WeeklyHeatmap :datos="heatmapData.datos ?? []" />
                </div>

                <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Ocupación por cargador</h3>
                  <div v-if="metricasPending" class="mt-3 h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
                  <ul v-else-if="metricasData?.porEstacion?.length" class="mt-3 space-y-3">
                    <li
                      v-for="est in metricasData.porEstacion"
                      :key="`intel-ocupacion-${est.station_id}`"
                      class="flex flex-col gap-1"
                    >
                      <div class="flex items-center justify-between text-xs">
                        <span class="truncate text-slate-300" :title="est.location_name">
                          {{ est.location_name }}
                        </span>
                        <span class="ml-2 shrink-0 font-semibold" :class="claseColorOcupacion(est.tasaOcupacion)">
                          {{ est.tasaOcupacion }}%
                        </span>
                      </div>
                      <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          class="h-full rounded-full transition-all duration-700"
                          :class="claseBarraOcupacion(est.tasaOcupacion)"
                          :style="{ width: anchoBarraOcupacion(est.tasaOcupacion) }"
                        />
                      </div>
                      <p class="text-[10px] text-slate-600">
                        {{ est.sesionesEstimadas }} sesiones · ~{{ est.minutosPorSesion }} min/sesión
                      </p>
                    </li>
                  </ul>
                  <p v-else class="mt-3 text-xs text-slate-500">Sin datos de ocupación por cargador.</p>
                </section>
              </div>

              <div class="xl:col-span-3 space-y-4">
                <div v-if="metricasPending" class="space-y-3">
                  <div class="h-20 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
                  <div class="h-20 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
                </div>
                <div v-else-if="metricasData" class="space-y-3">
                  <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div class="relative inline-block">
                      <p
                        @click="toggleTooltip('intel-ocupacion-media')"
                        class="text-xs text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-500 transition-colors pb-0.5"
                      >
                        Ocupación media
                      </p>
                      <div
                        v-if="tooltipActivo === 'intel-ocupacion-media'"
                        class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                      >
                        <p class="font-semibold text-slate-200 mb-1">Ocupación media</p>
                        <p>Porcentaje de tiempo en que los conectores han estado ocupados durante el periodo seleccionado.</p>
                        <button
                          @click.stop="closeTooltip()"
                          class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                        >
                          ✕ Cerrar
                        </button>
                      </div>
                    </div>
                    <p class="mt-1 text-3xl font-bold" :class="claseColorOcupacion(metricasData.tasaOcupacionMedia)">
                      {{ metricasData.tasaOcupacionMedia }}%
                    </p>
                    <p class="text-[11px] text-slate-500">del tiempo ocupados</p>
                  </div>

                  <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div class="relative inline-block">
                      <p
                        @click="toggleTooltip('intel-sesiones-estimadas')"
                        class="text-xs text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-500 transition-colors pb-0.5"
                      >
                        Sesiones estimadas
                      </p>
                      <div
                        v-if="tooltipActivo === 'intel-sesiones-estimadas'"
                        class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                      >
                        <p class="font-semibold text-slate-200 mb-1">Sesiones estimadas</p>
                        <p>Número aproximado de sesiones de carga detectadas a partir de los cambios de disponibilidad.</p>
                        <button
                          @click.stop="closeTooltip()"
                          class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                        >
                          ✕ Cerrar
                        </button>
                      </div>
                    </div>
                    <p class="mt-1 text-3xl font-bold text-white">{{ metricasData.sesionesEstimadas }}</p>
                    <p class="text-[11px] text-slate-500">cargas estimadas</p>
                  </div>

                  <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div class="relative inline-block">
                      <p
                        @click="toggleTooltip('intel-minutos-medio')"
                        class="text-xs text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-500 transition-colors pb-0.5"
                      >
                        Minutos ocupados medio
                      </p>
                      <div
                        v-if="tooltipActivo === 'intel-minutos-medio'"
                        class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                      >
                        <p class="font-semibold text-slate-200 mb-1">Minutos ocupados medio</p>
                        <p>Duración promedio de una sesión de ocupación del conector, expresada en minutos.</p>
                        <button
                          @click.stop="closeTooltip()"
                          class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                        >
                          ✕ Cerrar
                        </button>
                      </div>
                    </div>
                    <p class="mt-1 text-3xl font-bold text-white">{{ metricasData.minutosOcupadosMedio }}<span class="text-lg font-normal text-slate-400"> min</span></p>
                    <p class="text-[11px] text-slate-500">por sesión de carga</p>
                  </div>

                  <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div class="relative inline-block">
                      <p
                        @click="toggleTooltip('intel-cargador-mas-usado')"
                        class="text-xs text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-500 transition-colors pb-0.5"
                      >
                        Cargador más usado
                      </p>
                      <div
                        v-if="tooltipActivo === 'intel-cargador-mas-usado'"
                        class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                      >
                        <p class="font-semibold text-slate-200 mb-1">Cargador más usado</p>
                        <p>Estación con mayor número de sesiones estimadas en el periodo seleccionado.</p>
                        <button
                          @click.stop="closeTooltip()"
                          class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                        >
                          ✕ Cerrar
                        </button>
                      </div>
                    </div>
                    <p v-if="metricasData.cargadorMasUsado" class="mt-1 text-sm font-semibold leading-snug text-white">
                      {{ metricasData.cargadorMasUsado.location_name }}
                    </p>
                    <p v-else class="mt-1 text-sm text-slate-500">Sin datos</p>
                    <p v-if="metricasData.cargadorMasUsado" class="text-[11px] text-slate-500">
                      {{ metricasData.cargadorMasUsado.sesionesEstimadas }} sesiones
                    </p>
                  </div>
                </div>

                <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
                <div class="relative inline-block">
                  <h3
                    @click="toggleTooltip('duracion-ocupacion')"
                    class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none pb-0.5"
                  >
                    Duración media de ocupación
                  </h3>
                  <!-- Tooltip duración -->
                  <div
                    v-if="tooltipActivo === 'duracion-ocupacion'"
                    class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-52 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                  >
                    <p class="font-semibold text-slate-200 mb-1">Duración de Ocupación</p>
                    <ul class="space-y-1">
                      <li><strong class="text-emerald-400">Media:</strong> Promedio de minutos que dura una ocupación</li>
                      <li><strong class="text-blue-400">Mediana:</strong> Valor central (50% arriba, 50% abajo)</li>
                      <li><strong class="text-purple-400">P90:</strong> 90% de ocupaciones duran menos que esto</li>
                    </ul>
                    <button
                      @click.stop="closeTooltip()"
                      class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                    >
                      ✕ Cerrar
                    </button>
                  </div>
                </div>
                <div v-if="duracionOcupacionPending" class="mt-3 h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
                <div v-else class="mt-3 grid grid-cols-1 gap-3">
                  <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p class="text-xs text-slate-500">Media</p>
                    <p class="text-2xl font-bold text-white">{{ duracionOcupacionData?.duracionMediaMin ?? 0 }} min</p>
                  </div>
                  <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p class="text-xs text-slate-500">Mediana</p>
                    <p class="text-2xl font-bold text-white">{{ duracionOcupacionData?.medianaMin ?? 0 }} min</p>
                  </div>
                  <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p class="text-xs text-slate-500">P90</p>
                    <p class="text-2xl font-bold text-white">{{ duracionOcupacionData?.p90Min ?? 0 }} min</p>
                  </div>
                </div>
                </section>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2" @click.self="closeTooltip()">
                <div class="relative inline-block">
                  <h3
                    @click="toggleTooltip('salud-fiabilidad')"
                    class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none pb-0.5"
                  >
                    Salud y fiabilidad
                  </h3>
                  <!-- Tooltip salud -->
                  <div
                    v-if="tooltipActivo === 'salud-fiabilidad'"
                    class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                  >
                    <p class="font-semibold text-slate-200 mb-1">Salud y Fiabilidad</p>
                    <p class="mb-1.5">Índice de confiabilidad de cada cargador incluyendo:</p>
                    <ul class="space-y-1">
                      <li><strong class="text-emerald-400">Uptime:</strong> % tiempo operativo</li>
                      <li><strong class="text-amber-400">Offline:</strong> Horas fuera de servicio</li>
                      <li><strong class="text-rose-400">Desconexiones:</strong> Fallos detectados</li>
                    </ul>
                    <button
                      @click.stop="closeTooltip()"
                      class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                    >
                      ✕ Cerrar
                    </button>
                  </div>
                </div>
                <div v-if="saludCargadoresPending" class="mt-3 h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
                <div v-else class="mt-3 space-y-2">
                  <div v-for="item in saludTop" :key="`health-${item.stationId}`" class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
                    <div class="flex items-center justify-between gap-2">
                      <NuxtLink :to="`/charger/${item.stationId}`" class="flex items-center gap-1 font-semibold text-slate-200 hover:text-slate-100 hover:underline transition-colors">
                        {{ item.locationName }}
                        <span class="text-slate-500 text-[10px]">→</span>
                      </NuxtLink>
                      <span
                        class="rounded-full px-2 py-0.5 font-semibold uppercase"
                        :class="item.fiabilidad === 'green' ? 'bg-emerald-500/20 text-emerald-300' : (item.fiabilidad === 'yellow' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300')"
                      >
                        {{ item.fiabilidad }}
                      </span>
                    </div>
                    <p class="mt-1 text-slate-400">Uptime {{ item.uptime }}% · Offline {{ item.tiempoOfflineHoras }}h · Desconexiones {{ item.desconexiones }}</p>
                  </div>
                </div>
              </section>

              <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
                <div class="relative inline-block">
                  <h3
                    @click="toggleTooltip('ranking-red')"
                    class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none pb-0.5"
                  >
                    Ranking red
                  </h3>
                  <!-- Tooltip ranking -->
                  <div
                    v-if="tooltipActivo === 'ranking-red'"
                    class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-52 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                  >
                    <p class="font-semibold text-slate-200 mb-1">Ranking de Red</p>
                    <p>Clasificación de cargadores por disponibilidad y confiabilidad. Los cargadores mejor posicionados tienen más disponibilidad y menos incidencias.</p>
                    <button
                      @click.stop="closeTooltip()"
                      class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                    >
                      ✕ Cerrar
                    </button>
                  </div>
                </div>
                <div v-if="rankingsPending" class="mt-3 h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
                <ol v-else class="mt-3 space-y-2 text-xs">
                  <li v-for="item in rankingTop" :key="`ranking-${item.stationId}`" class="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300">
                    <p class="font-semibold text-white">
                      #{{ item.position }} {{ item.icon }}
                      <NuxtLink :to="`/charger/${item.stationId}`" class="hover:text-slate-100 hover:underline transition-colors">
                        {{ item.stationName }}
                        <span class="text-slate-500 text-[10px]">→</span>
                      </NuxtLink>
                    </p>
                    <p class="text-slate-500">Score {{ item.value }} · Disp. {{ item.details?.disponibilidadPct ?? 0 }}%</p>
                  </li>
                </ol>
              </section>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
                <div class="relative inline-block">
                  <h3
                    @click="toggleTooltip('insights-automaticos')"
                    class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none pb-0.5"
                  >
                    Insights automáticos
                  </h3>
                  <!-- Tooltip insights -->
                  <div
                    v-if="tooltipActivo === 'insights-automaticos'"
                    class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                  >
                    <p class="font-semibold text-slate-200 mb-1">Insights Automáticos</p>
                    <p>Recomendaciones generadas automáticamente basadas en patrones de datos históricos y tendencias actuales.</p>
                    <button
                      @click.stop="closeTooltip()"
                      class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                    >
                      ✕ Cerrar
                    </button>
                  </div>
                </div>
                <div v-if="recomendacionesPending" class="mt-3 h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
                <ul v-else class="mt-3 space-y-2 text-xs text-slate-300">
                  <li v-for="(rec, i) in recomendacionesTop" :key="`rec-${i}`" class="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    {{ rec.text }}
                  </li>
                </ul>
              </section>

              <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" @click.self="closeTooltip()">
                <div class="relative inline-block">
                  <h3
                    @click="toggleTooltip('anomalias-detectadas')"
                    class="text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-help border-b border-dashed border-slate-600/50 hover:border-slate-600 transition-colors select-none pb-0.5"
                  >
                    Anomalías detectadas
                  </h3>
                  <!-- Tooltip anomalías -->
                  <div
                    v-if="tooltipActivo === 'anomalias-detectadas'"
                    class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
                  >
                    <p class="font-semibold text-slate-200 mb-1">Anomalías Detectadas</p>
                    <p class="mb-1.5">Patrones inusuales y problemas identificados automáticamente.</p>
                    <ul class="space-y-1 text-[9px]">
                      <li><strong class="text-rose-400">High:</strong> Requiere atención inmediata</li>
                      <li><strong class="text-amber-400">Medium:</strong> Vigilancia recomendada</li>
                      <li><strong class="text-slate-400">Low:</strong> Información para referencia</li>
                    </ul>
                    <button
                      @click.stop="closeTooltip()"
                      class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                    >
                      ✕ Cerrar
                    </button>
                  </div>
                </div>
                <div v-if="anomaliasPending" class="mt-3 h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
                <ul v-else class="mt-3 space-y-2 text-xs text-slate-300">
                  <li v-for="(a, i) in anomaliasTop" :key="`anom-${i}`" class="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <p class="font-semibold" :class="a.severity === 'high' ? 'text-rose-300' : (a.severity === 'medium' ? 'text-amber-300' : 'text-slate-300')">
                      <NuxtLink :to="`/charger/${a.stationId}`" class="hover:underline transition-colors">
                        {{ a.stationName }}
                        <span class="text-slate-500 text-[10px]">→</span>
                      </NuxtLink>
                      · {{ a.type }}
                    </p>
                    <p class="text-slate-400">{{ a.description }}</p>
                  </li>
                </ul>
              </section>
            </div>


          </section>

          <!-- ════════ TAB: DIAGNÓSTICO ════════ -->
          <section v-else-if="activeTab === 'diagnostico'" aria-labelledby="tab-diagnostico" class="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 md:p-5" @click.self="closeTooltip()">
            <div class="relative inline-block mb-4">
              <h2
                id="tab-diagnostico"
                @click="toggleTooltip('diagnostico-titulo')"
                class="text-xs font-semibold uppercase tracking-wider cursor-help border-b border-dashed border-rose-500/30 hover:border-rose-500/50 transition-colors select-none pb-0.5"
                :class="activeTabTheme.title"
              >
                Diagnóstico avanzado
              </h2>
              <!-- Tooltip diagnóstico -->
              <div
                v-if="tooltipActivo === 'diagnostico-titulo'"
                class="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-full md:left-0 md:translate-x-0 md:translate-y-0 md:mt-2 w-[90vw] md:w-56 rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300 shadow-xl ring-1 ring-slate-700 z-50"
              >
                <p class="font-semibold text-slate-200 mb-1">Diagnóstico Avanzado</p>
                <p>
                  Análisis completo de incidencias, zonas saturadas y recomendaciones para expansión de infraestructura. Identifica dónde instalar nuevos cargadores.
                </p>
                <button
                  @click.stop="closeTooltip()"
                  class="mt-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors md:hidden"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>

            <div v-if="diagnosticoPending || etaPending" class="h-56 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
            
            <!-- Insights automáticos y Mapa de demanda en 2 columnas -->
            <div v-if="diagnosticoData" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <!-- Insights automáticos + Resumen de salud -->
              <div class="space-y-4">
                <!-- Saturación y recomendación -->
                <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div class="mb-3 flex items-center gap-2">
                    <span class="text-blue-400">⚡</span>
                    <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Red municipal</h3>
                  </div>
                  <div class="space-y-2">
                    <div>
                      <p class="text-xs text-slate-500">Saturación actual</p>
                      <p class="text-xl font-bold" :class="diagnosticoData.saturacion.porcentaje >= 25 ? 'text-rose-400' : diagnosticoData.saturacion.porcentaje >= 15 ? 'text-amber-400' : 'text-emerald-400'">
                        {{ diagnosticoData.saturacion.porcentaje }}%
                      </p>
                    </div>
                    <div class="border-t border-slate-700 pt-2">
                      <p class="text-xs text-slate-500">Recomendación técnica</p>
                      <p class="text-sm font-semibold text-slate-100">+{{ diagnosticoData.saturacion.conectoresExtraRecomendados }} conectores</p>
                      <p class="text-xs text-slate-400">{{ diagnosticoData.saturacion.puntosExtraRecomendados }} puntos de recarga</p>
                    </div>
                  </div>
                </div>

                <!-- Salud de telemetría -->
                <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div class="mb-3 flex items-center gap-2">
                    <span class="text-cyan-400">🔧</span>
                    <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Salud de telemetría</h3>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2">
                      <p class="text-xs text-rose-300">Estaciones críticas</p>
                      <p class="text-lg font-bold text-rose-400">{{ diagnosticoData.averias.filter((a: any) => a.nivel === 'critical').length }}</p>
                      <p class="text-[10px] text-rose-400/70">de {{ diagnosticoData.averias.length }}</p>
                    </div>
                    <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                      <p class="text-xs text-amber-300">Alertas warning</p>
                      <p class="text-lg font-bold text-amber-400">{{ diagnosticoData.averias.filter((a: any) => a.nivel === 'warning').length }}</p>
                      <p class="text-[10px] text-amber-400/70">incidencias</p>
                    </div>
                    <div class="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2">
                      <p class="text-xs text-cyan-300">Datos desactualizados</p>
                      <p class="text-lg font-bold text-cyan-300">{{ diagnosticoData.averias.filter((a: any) => (a.horasSinActualizarDinamico ?? 0) >= 6).length }}</p>
                      <p class="text-[10px] text-cyan-300/70">&gt;= 6h</p>
                    </div>
                    <div class="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 p-2">
                      <p class="text-xs text-fuchsia-300">Patrones planos</p>
                      <p class="text-lg font-bold text-fuchsia-300">{{ diagnosticoData.averias.filter((a: any) => a.razones.some((r: string) => r.toLowerCase().includes('patron plano'))).length }}</p>
                      <p class="text-[10px] text-fuchsia-300/70">sin variación</p>
                    </div>
                  </div>
                </div>

                <!-- Insights automáticos -->
                <div v-if="diagnosticoData.insights?.length" class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div class="mb-3 flex items-center gap-2">
                    <span class="text-fuchsia-400">✨</span>
                    <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Insights IA</h3>
                  </div>
                  <ul class="space-y-1.5 text-xs text-slate-300">
                    <li v-for="(i, idx) in diagnosticoData.insights" :key="idx" class="flex gap-2">
                      <span class="flex-shrink-0 text-slate-500">→</span>
                      <span>{{ i }}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Mapa de demanda por zonas -->
              <DiagnosticDemandHeatmap
                :zonas="diagnosticoData.zonasPrioritarias ?? []"
              />
            </div>

            <!-- Zonas prioritarias y Posibles averías -->
            <AiDiagnostics
              v-if="diagnosticoData"
              :saturacion="diagnosticoData.saturacion"
              :averias="diagnosticoData.averias ?? []"
              :insights="diagnosticoData.insights ?? []"
              :zonas-prioritarias="diagnosticoData.zonasPrioritarias ?? []"
              :show-insights="false"
              :show-zones-and-beyond="true"
            />
          </section>

          <!-- ════════ TAB: EXPANSIÓN ════════ -->
          <section v-else-if="activeTab === 'expansion'" aria-labelledby="tab-expansion" class="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 md:p-5" @click.self="closeTooltip()">
            <div class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
              <!-- Navbar -->
              <nav class="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
                <div :style="{ maxWidth: `${maxWidth}px` }" class="mx-auto flex items-center justify-between px-4 py-3 sm:px-6">
                  <div class="flex items-center gap-2">
                    <div class="rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 p-2">
                      <Navigation class="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <h1 class="text-lg font-bold text-slate-100">Expansión Inteligente</h1>
                      <p class="text-[11px] text-slate-500">Ubicaciones recomendadas por demanda</p>
                    </div>
                  </div>
                </div>
              </nav>

              <!-- Main Content -->
              <div :style="{ maxWidth: `${maxWidth}px` }" class="mx-auto space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                <!-- Info Banner -->
                <div class="space-y-2 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 p-6">
                  <div class="flex items-start gap-3">
                    <TrendingUp class="h-5 w-5 flex-shrink-0 text-cyan-400" />
                    <div class="space-y-1">
                      <h2 class="font-semibold text-slate-100">Análisis de Expansión Basado en Datos</h2>
                      <p class="text-sm text-slate-400">
                        Este mapa muestra ubicaciones óptimas para nuevos puntos de carga, identificadas mediante análisis de:
                        demanda histórica, zonas saturadas, cobertura geográfica y proximidad a parkings públicos y privados.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Metodología -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div class="mb-2 rounded-lg bg-slate-800/50 p-2 w-fit">
                      <Zap class="h-4 w-4 text-amber-400" />
                    </div>
                    <h3 class="text-sm font-semibold text-slate-200">Demanda Real</h3>
                    <p class="mt-1 text-xs text-slate-400">Basada en ocupación histórica de últimos 30 días</p>
                  </div>
                  <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div class="mb-2 rounded-lg bg-slate-800/50 p-2 w-fit">
                      <Navigation class="h-4 w-4 text-cyan-400" />
                    </div>
                    <h3 class="text-sm font-semibold text-slate-200">Cobertura</h3>
                    <p class="mt-1 text-xs text-slate-400">Optimización de distancia entre puntos</p>
                  </div>
                  <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div class="mb-2 rounded-lg bg-slate-800/50 p-2 w-fit">
                      <AlertTriangle class="h-4 w-4 text-rose-400" />
                    </div>
                    <h3 class="text-sm font-semibold text-slate-200">Prioridades</h3>
                    <p class="mt-1 text-xs text-slate-400">Refuerzo en zonas críticas identificadas</p>
                  </div>
                  <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div class="mb-2 rounded-lg bg-slate-800/50 p-2 w-fit">
                      <MapPin class="h-4 w-4 text-emerald-400" />
                    </div>
                    <h3 class="text-sm font-semibold text-slate-200">Infraestructura</h3>
                    <p class="mt-1 text-xs text-slate-400">Proximidad a parkings y vías principales</p>
                  </div>
                </div>

                <!-- ExpansionMap Component -->
                <ExpansionMap />

                <!-- Recomendaciones Adicionales -->
                <div class="space-y-4">
                  <h2 class="text-lg font-bold text-slate-100">Consideraciones de Implementación</h2>

                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 class="mb-3 flex items-center gap-2 font-semibold text-slate-200">
                        <TrendingUp class="h-4 w-4 text-cyan-400" />
                        Fases de Implementación
                      </h3>
                      <ul class="space-y-2 text-sm text-slate-400">
                        <li class="flex items-start gap-2">
                          <span class="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                          <span><strong>Fase 1:</strong> Instalar 2-3 puntos en zonas críticas (demanda > 70%)</span>
                        </li>
                        <li class="flex items-start gap-2">
                          <span class="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <span><strong>Fase 2:</strong> Expandir a zonas de demanda alta (55-70%) dentro de 3-6 meses</span>
                        </li>
                        <li class="flex items-start gap-2">
                          <span class="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                          <span><strong>Fase 3:</strong> Revisar datos trimestralmente y ajustar ubicaciones</span>
                        </li>
                      </ul>
                    </div>

                    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 class="mb-3 flex items-center gap-2 font-semibold text-slate-200">
                        <AlertTriangle class="h-4 w-4 text-amber-400" />
                        Criterios de Viabilidad
                      </h3>
                      <ul class="space-y-2 text-sm text-slate-400">
                        <li class="flex items-start gap-2">
                          <span class="text-emerald-400">✓</span>
                          <span>Acceso a red eléctrica (< 50m de línea de distribución)</span>
                        </li>
                        <li class="flex items-start gap-2">
                          <span class="text-emerald-400">✓</span>
                          <span>Zona de estacionamiento público o privado disponible</span>
                        </li>
                        <li class="flex items-start gap-2">
                          <span class="text-emerald-400">✓</span>
                          <span>Tránsito peatonal moderado a alto</span>
                        </li>
                        <li class="flex items-start gap-2">
                          <span class="text-rose-400">✗</span>
                          <span>Evitar duplicación excesiva (mínimo 200m de distancia)</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- Footer Info -->
                <div class="rounded-xl border border-slate-800/50 bg-slate-900/30 p-4 text-center text-xs text-slate-500">
                  <p>
                    Este análisis se basa en datos históricos de {{ new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }) }}.
                    Los resultados son recomendaciones de ubicación óptima y deben validarse con reconocimiento in situ.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Transition>

      <!-- ════════ BANNER ANUNCIO BOTTOM (variante A) ════════ -->
      <section
        v-if="recommendedLinksPosition === 'bottom'"
        class="relative overflow-hidden rounded-2xl p-px"
        style="background: linear-gradient(135deg, rgba(6,182,212,0.6) 0%, rgba(16,185,129,0.5) 50%, rgba(139,92,246,0.4) 100%)"
      >
        <!-- Label publicidad -->
        <span class="absolute right-3 top-2.5 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-slate-400">
          Publicidad
        </span>

        <div class="relative rounded-2xl bg-slate-950/92 p-4 backdrop-blur-sm md:p-5">
          <!-- Glow de fondo -->
          <div class="pointer-events-none absolute inset-0 rounded-2xl opacity-20" style="background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(6,182,212,0.5) 0%, transparent 70%)"></div>

          <div class="relative grid grid-cols-1 gap-3 md:grid-cols-2">
            <!-- Tarifa luz -->
            <a
              :href="RECOMMENDED_LINKS.tariffComparator"
              target="_blank"
              rel="sponsored noopener noreferrer"
              class="group relative overflow-hidden rounded-xl p-px transition-all duration-300"
              style="background: linear-gradient(135deg, rgba(6,182,212,0.5) 0%, rgba(6,182,212,0.15) 100%)"
              @click="onRecommendedLinkClick('tariff_comparator', 'bottom')"
            >
              <div class="relative flex h-full flex-col gap-2 rounded-xl bg-slate-950/85 p-4 transition-colors group-hover:bg-slate-900/90">
                <div class="flex items-center gap-2">
                  <div class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-cyan-500/40">
                    <img src="/zoeconecta-icon.png" alt="ZOE Conecta" class="h-6 w-6 object-contain" />
                  </div>
                  <p class="text-[11px] font-semibold uppercase tracking-widest text-cyan-300">Tarifa de luz</p>
                </div>
                <p class="text-sm font-bold leading-snug text-white">
                  ¿Estás pagando de más? Compara tu tarifa eléctrica ahora
                </p>
                <p class="mt-auto flex items-center gap-1 text-xs font-medium text-cyan-400 group-hover:text-cyan-300">
                  Comparar gratis <svg class="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </p>
              </div>
            </a>

            <!-- Tesla -->
            <a
              :href="RECOMMENDED_LINKS.teslaReferral"
              target="_blank"
              rel="sponsored noopener noreferrer"
              class="group relative overflow-hidden rounded-xl p-px transition-all duration-300"
              style="background: linear-gradient(135deg, rgba(16,185,129,0.5) 0%, rgba(16,185,129,0.15) 100%)"
              @click="onRecommendedLinkClick('tesla_referral', 'bottom')"
            >
              <div class="relative flex h-full flex-col gap-2 rounded-xl bg-slate-950/85 p-4 transition-colors group-hover:bg-slate-900/90">
                <div class="flex items-center gap-2">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-black ring-1 ring-emerald-500/40 p-1">
                    <img src="/tesla-logo.svg" alt="Tesla" class="h-full w-full object-contain" />
                  </div>
                  <p class="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">Tesla Referral</p>
                </div>
                <p class="text-sm font-bold leading-snug text-white">
                  1.000 km de Supercarga gratis o €500 de descuento en tu Tesla
                </p>
                <p class="mt-auto flex items-center gap-1 text-xs font-medium text-emerald-400 group-hover:text-emerald-300">
                  Ver oferta <svg class="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </p>
              </div>
            </a>
          </div>
        </div>
      </section>

      <!-- ════════ FOOTER ════════ -->
      <footer class="border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
        Panel municipal de disponibilidad de carga para Aspe · Información actualizada periódicamente ·
        Desarrollado por
        <a
          href="https://onlineexpansions.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-slate-400 underline-offset-2 hover:text-white hover:underline"
        >
          OnlineExpansions
        </a>
      </footer>

    </div>
  </main>
</template>

<style scoped>
.tab-panel-enter-active,
.tab-panel-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.tab-panel-enter-from,
.tab-panel-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
