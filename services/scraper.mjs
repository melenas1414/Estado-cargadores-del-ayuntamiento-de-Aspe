/**
 * scraper.mjs — Monitor de Cargadores EV (Iberdrola 22 kW) · Aspe, Alicante
 *
 * Ejecutado por GitHub Actions cada 15 minutos.
 * Consulta el estado de los 5 cargadores municipales y guarda el resultado en Supabase.
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL      — URL del proyecto Supabase
 *   SUPABASE_KEY      — Clave de servicio (service_role) de Supabase
 *   IBERDROLA_API_URL — URL base de la API de Iberdrola (opcional, ver nota)
 *   IBERDROLA_API_KEY — Token/API Key de Iberdrola (opcional)
 *
 * Nota: Si no dispones de acceso a la API privada de Iberdrola, el scraper
 * usa OpenChargeMap como fuente principal gratuita.
 * Obtén tu clave en: https://openchargemap.org/site/developerinfo
 * y añádela como OCM_API_KEY en los secretos de GitHub.
 */

import { createClient } from '@supabase/supabase-js';

// ─── Configuración ─────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const OCM_API_KEY  = (process.env.OCM_API_KEY ?? '').trim();
const IBERDROLA_API_KEY = process.env.IBERDROLA_API_KEY ?? '';

const MAX_RETRIES    = 3;
const RETRY_PAUSE_MS = 2000; // ms entre reintentos
const FETCH_TIMEOUT_MS = 10_000; // ms de timeout por petición HTTP

/**
 * Catálogo de las 5 estaciones del Ayuntamiento de Aspe.
 *
 * station_id  → ID interno de la red Iberdrola / OCPI (EVSE ID).
 *               Puedes encontrarlo en la app Iberdrola Smart Charging
 *               o mediante la llamada a /api/chargers/list descrita más abajo.
 * ocm_id      → ID en OpenChargeMap (fallback). Búscalos en https://openchargemap.org
 * lat / lon   → Coordenadas para consultas geoespaciales.
 */
const ESTACIONES = [
  {
    station_id:    'ESIBE22E0001001',
    location_name: 'Av. Navarra 67, Aspe',
    lat: 38.3471,
    lon: -0.7654,
    ocm_id: 216923,
  },
  {
    station_id:    'ESIBE22E0001002',
    location_name: 'Av. Constitución 42, Aspe',
    lat: 38.3460,
    lon: -0.7670,
    ocm_id: 204184,
  },
  {
    station_id:    'ESIBE22E0001003',
    location_name: 'Av. Padre Ismael 34, Aspe',
    lat: 38.3448,
    lon: -0.7682,
    ocm_id: 204183,
  },
  {
    station_id:    'ESIBE22E0001004',
    location_name: 'Av. Juan Carlos I 36, Aspe',
    lat: 38.3435,
    lon: -0.7695,
    ocm_id: 204185,
  },
  {
    station_id:    'ESIBE22E0001005',
    location_name: 'Calle Orihuela 100, Aspe',
    lat: 38.3420,
    lon: -0.7710,
    ocm_id: 204186,
  },
];

// ─── Cliente Supabase ───────────────────────────────────────────────────────
function crearClienteSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Faltan variables de entorno: SUPABASE_URL y/o SUPABASE_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ─── Utilidades ─────────────────────────────────────────────────────────────
function esperar(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Ejecuta una función asíncrona con reintentos exponenciales.
 * @param {Function} fn        — Función a ejecutar
 * @param {number}   reintentos — Número máximo de reintentos
 * @param {string}   contexto  — Descripción para los logs
 */
async function conReintentos(fn, reintentos = MAX_RETRIES, contexto = '') {
  let ultimoError;
  for (let intento = 1; intento <= reintentos; intento++) {
    try {
      return await fn();
    } catch (err) {
      ultimoError = err;
      const pausa = RETRY_PAUSE_MS * intento;
      console.warn(`[reintento ${intento}/${reintentos}] ${contexto}: ${err.message} — esperando ${pausa}ms`);
      if (intento < reintentos) await esperar(pausa);
    }
  }
  throw ultimoError;
}

// ─── Fuente A: API privada Iberdrola ────────────────────────────────────────
/**
 * Consulta el estado de una estación en la API oficial de Iberdrola.
 * La API utiliza autenticación Bearer. Ajusta el endpoint y el parseo
 * según la documentación que te proporcione Iberdrola.
 *
 * Nota: este endpoint requiere acuerdo privado con el operador.
 */
async function consultarIberdrola(estacion) {
  const base = process.env.IBERDROLA_API_URL ?? 'https://api.iberdrola.es/ev/v1';
  const key  = IBERDROLA_API_KEY;

  if (!key) throw new Error('IBERDROLA_API_KEY no configurada');

  const url      = `${base}/chargepoints/${encodeURIComponent(estacion.station_id)}/status`;
  const respuesta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept:        'application/json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status} al consultar ${url}`);
  }

  const datos = await respuesta.json();

  // Formato esperado de respuesta Iberdrola (ajustar si difiere):
  // { evseId: "ESIBE22E0001001", status: "Available" | "Occupied" | "Unavailable" }
  const disponible = datos?.status === 'Available';
  return disponible;
}

// ─── Fuente B: OpenChargeMap (fallback gratuito) ─────────────────────────────
/**
 * Consulta el estado de un cargador por geolocalización en OpenChargeMap.
 * Menos preciso que la API directa, pero sirve como respaldo.
 * https://openchargemap.org/site/develop/api
 */
async function consultarOpenChargeMap(estacion) {
  if (!OCM_API_KEY) {
    throw new Error('OCM_API_KEY no configurada');
  }

  const params = new URLSearchParams({
    output:  'json',
    compact: 'false',
    verbose: 'false',
    key:     OCM_API_KEY,
  });

  if (estacion.ocm_id) {
    params.set('chargepointid', String(estacion.ocm_id));
  } else {
    params.set('countrycode', 'ES');
    params.set('maxresults', '10');
    params.set('latitude', String(estacion.lat));
    params.set('longitude', String(estacion.lon));
    params.set('distance', '0.5');
    params.set('distanceunit', 'KM');
  }

  const url       = `https://api.openchargemap.io/v3/poi/?${params}`;
  const respuesta = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-api-key': OCM_API_KEY,
      'user-agent': 'estado-cargadores-aspe/1.0',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!respuesta.ok) {
    throw new Error(`OCM HTTP ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  if (!datos?.length) {
    throw new Error(`Sin resultados OCM para ${estacion.location_name}`);
  }

  const punto = estacion.ocm_id
    ? datos[0]
    : [...datos].sort((a, b) => (a.AddressInfo?.Distance ?? Infinity) - (b.AddressInfo?.Distance ?? Infinity))[0];
  const conexiones = punto.Connections ?? [];

  // StatusType.IsOperational indica si el punto está operativo y disponible.
  const disponible = conexiones.some((c) => c.StatusType?.IsOperational === true);
  return disponible;
}

// ─── Orquestador: obtener estado de una estación ─────────────────────────────
async function obtenerEstado(estacion) {
  // Si hay credenciales privadas, intentamos Iberdrola primero.
  if (IBERDROLA_API_KEY) {
    try {
      const disponible = await conReintentos(
        () => consultarIberdrola(estacion),
        MAX_RETRIES,
        `Iberdrola · ${estacion.location_name}`,
      );
      return { ...estacion, is_available: disponible, fuente: 'iberdrola' };
    } catch (errIberdrola) {
      console.warn(`API Iberdrola no disponible para ${estacion.location_name}: ${errIberdrola.message}`);
    }
  }

  // Fuente principal gratuita: OpenChargeMap.
  try {
    const disponible = await conReintentos(
      () => consultarOpenChargeMap(estacion),
      MAX_RETRIES,
      `OCM · ${estacion.location_name}`,
    );
    return { ...estacion, is_available: disponible, fuente: 'ocm' };
  } catch (errOCM) {
    console.error(`Sin datos para ${estacion.location_name}: ${errOCM.message}`);
    // Devolvemos null para omitir este registro sin detener el proceso
    return null;
  }
}

// ─── Guardar registros en Supabase ───────────────────────────────────────────
async function guardarEnSupabase(supabase, registros) {
  if (!registros.length) {
    console.warn('No hay registros para guardar.');
    return;
  }

  const filas = registros.map(({ station_id, location_name, is_available }) => ({
    station_id,
    location_name,
    is_available,
    power_kw: 22,
  }));

  const { error } = await supabase.from('charging_logs').insert(filas);

  if (error) throw new Error(`Error al insertar en Supabase: ${error.message}`);

  console.log(`✓ ${filas.length} registros guardados en Supabase`);
}

// ─── Punto de entrada ────────────────────────────────────────────────────────
async function main() {
  const inicio = Date.now();
  console.log(`\n🔌 Monitor de Cargadores EV · Aspe — ${new Date().toISOString()}`);
  console.log('─'.repeat(60));

  if (!IBERDROLA_API_KEY && !OCM_API_KEY) {
    throw new Error('Configura OCM_API_KEY (o credenciales privadas de Iberdrola) para obtener estados de cargadores.');
  }

  if (OCM_API_KEY.toLowerCase().includes('tu_clave_ocm')) {
    throw new Error('OCM_API_KEY contiene un placeholder. Sustituyelo por una clave real de OpenChargeMap.');
  }

  const supabase = crearClienteSupabase();

  // Consultar todas las estaciones en paralelo
  const resultados = await Promise.all(ESTACIONES.map(obtenerEstado));

  // Filtrar estaciones sin datos
  const validos = resultados.filter(Boolean);

  validos.forEach(({ location_name, is_available, fuente }) => {
    const estado = is_available ? '🟢 LIBRE' : '🔴 OCUPADO';
    console.log(`  ${estado}  ${location_name}  (fuente: ${fuente})`);
  });

  await guardarEnSupabase(supabase, validos);

  const duracion = ((Date.now() - inicio) / 1000).toFixed(2);
  console.log(`\n✅ Ciclo completado en ${duracion}s`);
}

main().catch((err) => {
  console.error('❌ Error fatal en el scraper:', err);
  process.exit(1);
});
