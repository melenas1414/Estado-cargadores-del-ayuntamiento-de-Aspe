import { serverSupabaseClient } from '#supabase/server';
import { getQuery } from 'h3';

// Coordenadas de estaciones actuales (lat, lon)
const ESTACIONES_ACTUALES = {
  'ESIBE22E0001001': { lat: 38.341118679046346, lon: -0.7654778230267333, zona: 'Carlos Soria' },
  'ESIBE22E0001002': { lat: 38.3476704, lon: -0.7691027, zona: 'Constitución' },
  'ESIBE22E0001003': { lat: 38.3498799, lon: -0.7649660, zona: 'Padre Ismael' },
  'ESIBE22E0001004': { lat: 38.3430059, lon: -0.7610202, zona: 'Juan Carlos I' },
  'ESIBE22E0001005': { lat: 38.3385331, lon: -0.7766776, zona: 'Orihuela' },
};

// Parkings conocidos en Aspe (acceso público y controlado)
const PARKINGS_ASPE = [
  { nombre: 'Parking Mercado', lat: 38.3481, lon: -0.7675, capacidad: 150, tipo: 'público' },
  { nombre: 'Parking Ayuntamiento', lat: 38.3469, lon: -0.7662, capacidad: 80, tipo: 'público' },
  { nombre: 'Parking Estación', lat: 38.3493, lon: -0.7647, capacidad: 200, tipo: 'público' },
  { nombre: 'Parking Centro Comercial', lat: 38.3448, lon: -0.7694, capacidad: 300, tipo: 'privado' },
  { nombre: 'Parking Polígono', lat: 38.3519, lon: -0.7585, capacidad: 400, tipo: 'público' },
  { nombre: 'Parking Hospital', lat: 38.3425, lon: -0.7725, capacidad: 120, tipo: 'público' },
  { nombre: 'Parking Biblioteca', lat: 38.3485, lon: -0.7659, capacidad: 60, tipo: 'público' },
  { nombre: 'Parking Plaza Mayor', lat: 38.3475, lon: -0.7668, capacidad: 100, tipo: 'público' },
];

interface Parking {
  nombre: string;
  lat: number;
  lon: number;
  capacidad: number;
  tipo: 'público' | 'privado';
}

interface Estacion {
  id: string;
  zona: string;
  lat: number;
  lon: number;
}

interface UbicacionRecomendada {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  razonamiento: string;
  puntajeTotal: number;
  demandaCercana: number;
  distanciaAEstaciones: number;
  parkingsCercanos: Parking[];
  beneficioEstimado: string;
  prioridad: 'critical' | 'high' | 'medium' | 'low';
}

interface ZonaPrioritaria {
  zona: string;
  ocupacionMediaPct: number;
  prioridad: 'critical' | 'high' | 'medium' | 'low';
  centroide: { lat: number; lon: number };
}

interface DemandaEstacion {
  occ: number;
  total: number;
  count: number;
}

interface CandidatoExpansion {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  tipo: 'parking' | 'avenida' | 'parque';
}

const CANDIDATOS_EXPANSION: CandidatoExpansion[] = [
  { id: 'parking-mercado', nombre: 'Parking Mercado · Av. Constitución', lat: 38.3481, lon: -0.7675, tipo: 'parking' },
  { id: 'parking-ayuntamiento', nombre: 'Parking Ayuntamiento · Centro', lat: 38.3469, lon: -0.7662, tipo: 'parking' },
  { id: 'parking-estacion', nombre: 'Parking Estación · Av. Padre Ismael', lat: 38.3493, lon: -0.7647, tipo: 'parking' },
  { id: 'parking-biblioteca', nombre: 'Parking Biblioteca · Centro Cívico', lat: 38.3485, lon: -0.7659, tipo: 'parking' },
  { id: 'av-carlos-soria', nombre: 'Bulevar Carlos Soria', lat: 38.3418, lon: -0.7648, tipo: 'avenida' },
  { id: 'av-juan-carlos', nombre: 'Entorno Juan Carlos I', lat: 38.3436, lon: -0.7608, tipo: 'avenida' },
  { id: 'av-padre-ismael', nombre: 'Frente Av. Padre Ismael', lat: 38.3495, lon: -0.7638, tipo: 'avenida' },
  { id: 'av-constitucion', nombre: 'Tramo principal Av. Constitución', lat: 38.3476, lon: -0.7684, tipo: 'avenida' },
  { id: 'parque-doctor-calatayud', nombre: 'Entorno Parque Doctor Calatayud', lat: 38.3472, lon: -0.7660, tipo: 'parque' },
  { id: 'parque-centro-civico', nombre: 'Entorno Parque Centro Cívico', lat: 38.3465, lon: -0.7651, tipo: 'parque' },
  { id: 'nodo-constitucion-padre-ismael', nombre: 'Nodo Constitución · Padre Ismael', lat: 38.3488, lon: -0.7670, tipo: 'avenida' },
  { id: 'nodo-padre-ismael-juan-carlos', nombre: 'Nodo Padre Ismael · Juan Carlos I', lat: 38.3464, lon: -0.7630, tipo: 'avenida' },
  { id: 'nodo-centro-civico', nombre: 'Nodo Centro Cívico', lat: 38.3460, lon: -0.7655, tipo: 'parque' },
];

function distancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calcularCentroide(
  estaciones: Estacion[],
  demandas: Record<string, number | DemandaEstacion>
): { lat: number; lon: number } {
  if (estaciones.length === 0) return { lat: 38.3485, lon: -0.7639 }; // Centro de Aspe

  let sumLat = 0;
  let sumLon = 0;
  let sumPeso = 0;

  for (const est of estaciones) {
    if (!est.lat || !est.lon) continue;
    const demanda = demandas[est.id];
    const pesoBase =
      typeof demanda === 'number'
        ? demanda
        : demanda && typeof demanda === 'object'
          ? demanda.occ > 0
            ? demanda.occ
            : demanda.count
          : 50;
    const peso = Math.max(1, Number.isFinite(pesoBase) ? pesoBase : 50);
    sumLat += est.lat * peso;
    sumLon += est.lon * peso;
    sumPeso += peso;
  }

  if (sumPeso === 0) return { lat: 38.3485, lon: -0.7639 };

  return {
    lat: Number((sumLat / sumPeso).toFixed(4)),
    lon: Number((sumLon / sumPeso).toFixed(4)),
  };
}

function generarIdUbicacion(lat: number, lon: number): string {
  return `RECO-${lat.toFixed(4)}-${lon.toFixed(4)}`;
}

function puntuarUbicacion(
  lat: number,
  lon: number,
  zonaPrioritaria: ZonaPrioritaria,
  demandaZona: number,
  estacionesActuales: Estacion[]
): {
  puntaje: number;
  distanciaPromedio: number;
} {
  // 1. Proximidad a la zona prioritaria (máx 40 puntos)
  const distAZona = distancia(lat, lon, zonaPrioritaria.centroide.lat, zonaPrioritaria.centroide.lon);
  const proximidadZonaScore = Math.max(0, 40 - distAZona * 20);

  // 2. Proximidad a estaciones existentes - pero alejadas (máx 30 puntos)
  // Queremos estar relativamente cerca (< 500m) pero no demasiado cerca (> 200m)
  const distanciasAEstaciones = estacionesActuales.map((e) => distancia(lat, lon, e.lat, e.lon));
  const distanciaPromedio = distanciasAEstaciones.reduce((a, b) => a + b, 0) / distanciasAEstaciones.length;
  const distanciaMin = Math.min(...distanciasAEstaciones);

  let proximidadEstacionesScore = 0;
  if (distanciaMin > 0.2 && distanciaMin < 0.8) {
    // Rango óptimo: 200-800m
    proximidadEstacionesScore = 30 - Math.abs(0.5 - distanciaMin) * 30;
  }

  // 3. Demanda local (máx 20 puntos)
  const demandaScore = Math.min(20, (demandaZona / 100) * 20);

  // 4. Nivel de prioridad de zona (máx 10 puntos)
  const prioridadScore =
    zonaPrioritaria.prioridad === 'critical'
      ? 10
      : zonaPrioritaria.prioridad === 'high'
        ? 8
        : zonaPrioritaria.prioridad === 'medium'
          ? 5
          : 2;

  const puntajeTotal = proximidadZonaScore + proximidadEstacionesScore + demandaScore + prioridadScore;

  return {
    puntaje: Math.max(0, puntajeTotal),
    distanciaPromedio,
  };
}

function bonusCandidato(candidato: CandidatoExpansion, parkingsCercanos: Parking[], distanciaZona: number): number {
  let bonus = 0;
  if (candidato.tipo === 'avenida') bonus += 10;
  if (candidato.tipo === 'parque') bonus += 9;
  if (candidato.tipo === 'parking') bonus += 7;
  if (parkingsCercanos.length > 0) bonus += Math.min(6, parkingsCercanos.length * 2);
  if (distanciaZona <= 0.35) bonus += 6;
  return bonus;
}

function distanciaAPuntoMedioDemandado(lat: number, lon: number, estacionesDemandadas: Estacion[]): number {
  if (estacionesDemandadas.length < 2) return 0;

  const [a, b] = estacionesDemandadas;
  const latMedio = (a.lat + b.lat) / 2;
  const lonMedio = (a.lon + b.lon) / 2;
  return distancia(lat, lon, latMedio, lonMedio);
}

function proximidadADemanda(
  lat: number,
  lon: number,
  estacionesDemandadas: Estacion[]
): { cercanas: number; distanciaMedia: number } {
  const distancias = estacionesDemandadas
    .map((estacion) => distancia(lat, lon, estacion.lat, estacion.lon))
    .sort((a, b) => a - b);

  const distanciasRelevantes = distancias.slice(0, Math.min(3, distancias.length));
  const distanciaMedia = distanciasRelevantes.reduce((acumulado, valor) => acumulado + valor, 0) / distanciasRelevantes.length;
  const cercanas = distancias.filter((valor) => valor <= 0.75).length;

  return { cercanas, distanciaMedia };
}

function distanciaMinimaARecomendacionesExistentes(
  lat: number,
  lon: number,
  recomendaciones: UbicacionRecomendada[]
): number {
  if (recomendaciones.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...recomendaciones.map((reco) => distancia(lat, lon, reco.lat, reco.lon)));
}

export default defineEventHandler(async (event) => {
  export default defineCachedEventHandler(async (event) => {
  }, {
    name: 'analytics-expansion-recommendations',
    maxAge: 3600,
    swr: true,
  });
  const query = getQuery(event);
  const periodo = String(query.periodo ?? '30d');

  const supabase = await serverSupabaseClient(event);

  const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 14;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  // Obtener datos de ocupación por zona de los últimos días
  const { data: logs, error: logsError } = await supabase
    .from('charging_logs')
    .select('station_id, location_name, is_available, available_connectors, total_connectors')
    .gte('created_at', desde.toISOString())
    .order('created_at', { ascending: true });

  if (logsError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al obtener logs: ${logsError.message}`,
    });
  }

  const rows = (logs ?? []) as Array<{
    station_id: string;
    location_name: string;
    is_available: boolean;
    available_connectors: number | null;
    total_connectors: number | null;
  }>;

  // Inferir zonas y calcular ocupación
  const zonaOcupacion: Record<string, { occ: number; total: number; estaciones: Set<string> }> = {};
  const estacionesOcupacion: Record<string, { occ: number; total: number; count: number }> = {};

  for (const row of rows) {
    const zona = row.location_name.split(',')[0].trim();
    const free = row.available_connectors ?? (row.is_available ? 1 : 0);
    const total = (row.total_connectors ?? 0) > 0 ? row.total_connectors : 2;

    if (!zonaOcupacion[zona]) {
      zonaOcupacion[zona] = { occ: 0, total: 0, estaciones: new Set() };
    }
    zonaOcupacion[zona].occ += total - free;
    zonaOcupacion[zona].total += total;
    zonaOcupacion[zona].estaciones.add(row.station_id);

    if (!estacionesOcupacion[row.station_id]) {
      estacionesOcupacion[row.station_id] = { occ: 0, total: 0, count: 0 };
    }
    estacionesOcupacion[row.station_id].occ += total - free;
    estacionesOcupacion[row.station_id].total += total;
    estacionesOcupacion[row.station_id].count += 1;
  }

  // Crear lista de zonas prioritarias con ocupación
  const zonasPrioritarias: ZonaPrioritaria[] = Object.entries(zonaOcupacion)
    .map(([zona, stats]) => {
      const ocupacionPct = stats.total > 0 ? Math.round((stats.occ / stats.total) * 100) : 0;
      const estacionesDeZona: Estacion[] = Array.from(stats.estaciones)
        .map((id) => {
          const coords = ESTACIONES_ACTUALES[id as keyof typeof ESTACIONES_ACTUALES];
          if (coords) {
            return {
              id,
              zona,
              lat: coords.lat,
              lon: coords.lon,
            };
          }
          return null;
        })
        .filter((e) => e !== null) as Estacion[];

      // Si no hay estaciones con coordenadas, usar el centro de Aspe con offset aleatorio
      const centroide =
        estacionesDeZona.length > 0
          ? calcularCentroide(estacionesDeZona, estacionesOcupacion)
          : {
              lat: 38.3485 + (Math.random() - 0.5) * 0.01,
              lon: -0.7639 + (Math.random() - 0.5) * 0.01,
            };

      let prioridad: ZonaPrioritaria['prioridad'] = 'low';
      if (ocupacionPct >= 70) prioridad = 'critical';
      else if (ocupacionPct >= 55) prioridad = 'high';
      else if (ocupacionPct >= 40) prioridad = 'medium';

      return {
        zona,
        ocupacionMediaPct: ocupacionPct,
        prioridad,
        centroide,
      };
    })
    .filter((z) => z.prioridad !== 'low')
    .sort((a, b) => b.ocupacionMediaPct - a.ocupacionMediaPct);

  const recomendaciones: UbicacionRecomendada[] = [];
  const candidatosUsados = new Set<string>();

  const estacionesActuales = Object.entries(ESTACIONES_ACTUALES).map(([id, coords]) => ({
    id,
    zona: coords.zona,
    lat: coords.lat,
    lon: coords.lon,
  }));

  const estacionesMasDemandadas = zonasPrioritarias
    .slice(0, 4)
    .map((zona) => estacionesActuales.find((estacion) => zona.zona.toLowerCase().includes(estacion.zona.toLowerCase()) || estacion.zona.toLowerCase().includes(zona.zona.toLowerCase())))
    .filter((estacion): estacion is Estacion => Boolean(estacion));

  const ejeDemandaPrincipal = estacionesMasDemandadas.slice(0, 2);
  const reglasSeleccion = [
    { maxDistZona: 0.95, maxDistObjetivo: 0.85, minSeparacion: 0.45, maxDistPuntoMedio: 0.95, minCercanas: 2 },
    { maxDistZona: 1.2, maxDistObjetivo: 1.2, minSeparacion: 0.32, maxDistPuntoMedio: 2.2, minCercanas: 1 },
  ];

  const zonasObjetivo = zonasPrioritarias.slice(0, 4);

  for (const [zonaIndice, zona] of zonasObjetivo.entries()) {
    const estacionObjetivo = estacionesActuales.find(
      (estacion) =>
        zona.zona.toLowerCase().includes(estacion.zona.toLowerCase()) ||
        estacion.zona.toLowerCase().includes(zona.zona.toLowerCase())
    );

    const candidatosDeZona = CANDIDATOS_EXPANSION
      .filter((candidato) => !candidatosUsados.has(candidato.id))
      .map((candidato) => {
        const puntuacionBase = puntuarUbicacion(
          candidato.lat,
          candidato.lon,
          zona,
          zona.ocupacionMediaPct,
          estacionesActuales
        );

        const distanciaZona = distancia(candidato.lat, candidato.lon, zona.centroide.lat, zona.centroide.lon);
        const distanciaMinEstacion = Math.min(
          ...estacionesActuales.map((estacion) => distancia(candidato.lat, candidato.lon, estacion.lat, estacion.lon))
        );

        const parkingsCercanos = PARKINGS_ASPE.filter(
          (p) => distancia(candidato.lat, candidato.lon, p.lat, p.lon) < 0.35
        ).sort(
          (a, b) =>
            distancia(candidato.lat, candidato.lon, a.lat, a.lon) -
            distancia(candidato.lat, candidato.lon, b.lat, b.lon)
        );

        const puntaje = puntuacionBase.puntaje + bonusCandidato(candidato, parkingsCercanos, distanciaZona);
        const proximidadDemanda = proximidadADemanda(candidato.lat, candidato.lon, estacionesMasDemandadas);
        const distanciaPuntoMedio = distanciaAPuntoMedioDemandado(candidato.lat, candidato.lon, ejeDemandaPrincipal);
        const esUbicacionPrincipal = candidato.tipo === 'avenida' || candidato.tipo === 'parque' || candidato.tipo === 'parking';
        const distanciaAEstacionObjetivo = estacionObjetivo
          ? distancia(candidato.lat, candidato.lon, estacionObjetivo.lat, estacionObjetivo.lon)
          : distanciaZona;
        const separacionConRecomendadas = distanciaMinimaARecomendacionesExistentes(
          candidato.lat,
          candidato.lon,
          recomendaciones
        );

        return {
          candidato,
          distanciaZona,
          distanciaMinEstacion,
          distanciaPuntoMedio,
          esUbicacionPrincipal,
          distanciaAEstacionObjetivo,
          separacionConRecomendadas,
          proximidadDemanda,
          puntuacionBase,
          parkingsCercanos,
          puntaje:
            puntaje +
            Math.max(0, 12 - proximidadDemanda.distanciaMedia * 20) +
            Math.min(8, proximidadDemanda.cercanas * 2) +
            Math.max(0, 10 - distanciaPuntoMedio * 24) +
            Math.max(0, 8 - distanciaAEstacionObjetivo * 16) +
            Math.min(6, Math.max(0, separacionConRecomendadas - 0.35) * 10),
        };
      })
      .filter(({ esUbicacionPrincipal }) => {
        return (
          esUbicacionPrincipal &&
          true
        );
      })
      .sort((a, b) => b.puntaje - a.puntaje);

    let seleccionZona = null as (typeof candidatosDeZona)[number] | null;

    for (const regla of reglasSeleccion) {
      seleccionZona =
        candidatosDeZona.find(({ distanciaZona, proximidadDemanda, distanciaPuntoMedio, distanciaAEstacionObjetivo, separacionConRecomendadas }) => {
          const esZonaNucleo = zonaIndice <= 1;
          const cumpleNucleo = esZonaNucleo
            ? proximidadDemanda.cercanas >= regla.minCercanas && distanciaPuntoMedio <= regla.maxDistPuntoMedio
            : proximidadDemanda.cercanas >= 1;
          const minDistanciaEstacion = esZonaNucleo ? 0.18 : 0.1;

          return (
            distanciaZona <= regla.maxDistZona &&
            cumpleNucleo &&
            distanciaAEstacionObjetivo <= regla.maxDistObjetivo &&
            distanciaAEstacionObjetivo >= minDistanciaEstacion &&
            separacionConRecomendadas >= regla.minSeparacion
          );
        }) ?? null;

      if (seleccionZona) break;
    }

    if (!seleccionZona) continue;

    for (const indice of [0]) {
      const { candidato, puntuacionBase, parkingsCercanos, puntaje } = seleccionZona;
      candidatosUsados.add(candidato.id);

      const beneficioEstimado =
        zona.prioridad === 'critical'
          ? `+${Math.ceil(zona.ocupacionMediaPct / 20)} conectores para aliviar saturación`
          : `Cobertura de ${Math.ceil(puntuacionBase.distanciaPromedio * 1000)}m de radio`;

      recomendaciones.push({
        id: generarIdUbicacion(candidato.lat, candidato.lon),
        nombre: `${candidato.nombre} · Prioridad ${zonaIndice + indice + 1}`,
        lat: Number(candidato.lat.toFixed(4)),
        lon: Number(candidato.lon.toFixed(4)),
        razonamiento: `Ubicación en ${candidato.tipo === 'parking' ? 'parking principal' : candidato.tipo === 'parque' ? 'entorno de parque' : 'gran avenida'} para la zona ${zona.zona}, con demanda del ${zona.ocupacionMediaPct}% y separación adecuada respecto a estaciones existentes.`,
        puntajeTotal: Math.max(0, Math.min(100, Math.round(puntaje * 10) / 10)),
        demandaCercana: zona.ocupacionMediaPct,
        distanciaAEstaciones: Math.round(puntuacionBase.distanciaPromedio * 1000),
        parkingsCercanos: parkingsCercanos.slice(0, 3),
        beneficioEstimado,
        prioridad: zona.prioridad,
      });
    }
  }

  // Ordenar por puntuación
  recomendaciones.sort((a, b) => b.puntajeTotal - a.puntajeTotal);

  return {
    periodo,
    zonasPrioritarias: zonasPrioritarias.slice(0, 4),
    ubicacionesRecomendadas: recomendaciones.slice(0, 8),
    resumenAnalisis: {
      totalZonasAnalizadas: zonasPrioritarias.length,
      zonasConDemandaAlta: zonasPrioritarias.filter((z) => z.prioridad === 'critical').length,
      coberturaMunicipal: `${Math.round((estacionesActuales.length / 5) * 100)}% de cobertura actual`,
    },
  };
});
