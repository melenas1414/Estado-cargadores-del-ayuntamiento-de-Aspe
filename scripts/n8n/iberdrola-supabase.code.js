// n8n Code node (Run once for all items)
// Required env vars in n8n:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// Optional:
// - SCRAPER_MODE: incremental | full
// - IBERDROLA_LANGUAGE: es | en
// - SCRAPER_STATION_IDS: CSV con station_id objetivo
// - IBERDROLA_BBOX_LAT_MAX, IBERDROLA_BBOX_LAT_MIN, IBERDROLA_BBOX_LON_MAX, IBERDROLA_BBOX_LON_MIN
// - IBERDROLA_DAILY_BBOX_LAT_MAX, IBERDROLA_DAILY_BBOX_LAT_MIN, IBERDROLA_DAILY_BBOX_LON_MAX, IBERDROLA_DAILY_BBOX_LON_MIN

const inputConfig = $input.first()?.json || {};

const SUPABASE_URL = inputConfig.supabaseUrl || $env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = inputConfig.supabaseServiceRoleKey || $env.SUPABASE_SERVICE_ROLE_KEY;
const SCRAPER_MODE = String(inputConfig.scraperMode || $env.SCRAPER_MODE || 'incremental').toLowerCase();
const IBERDROLA_LANGUAGE = String(inputConfig.iberdrolaLanguage || $env.IBERDROLA_LANGUAGE || 'es');

function parseCsvList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const SCRAPER_STATION_IDS = new Set(
  parseCsvList(inputConfig.scraperStationIds || $env.SCRAPER_STATION_IDS),
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en n8n');
}

const IBERDROLA_BASE_URL =
  'https://www.iberdrola.es/o/webclipb/iberdrola/puntosrecargacontroller';

const KNOWN_STATIONS = [
  {
    station_id: 'ESIBE22E0001001',
    cupr_id: '144579',
    location_name: 'Av. Carlos Soria, 11, Aspe',
    address_tokens: ['carlos', 'soria', '11', 'aspe'],
  },
  {
    station_id: 'ESIBE22E0001002',
    cupr_id: '5848',
    location_name: 'Av. Constitucion 42, Aspe',
    address_tokens: ['constitucion', '42', 'aspe'],
  },
  {
    station_id: 'ESIBE22E0001003',
    cupr_id: '97897',
    location_name: 'Av. Padre Ismael 34, Aspe',
    address_tokens: ['padre', 'ismael', '34', 'aspe'],
  },
  {
    station_id: 'ESIBE22E0001004',
    cupr_id: '97917',
    location_name: 'Av. Juan Carlos I 36, Aspe',
    address_tokens: ['juan', 'carlos', '36', 'aspe'],
  },
  {
    station_id: 'ESIBE22E0001005',
    cupr_id: '5849',
    location_name: 'Calle Orihuela 100, Aspe',
    address_tokens: ['orihuela', '100', 'aspe'],
  },
  {
    station_id: 'IBERDROLA-5629',
    cp_id: '5629',
    location_name: 'Plaza del Progreso 1, Monforte del Cid',
    address_tokens: ['progreso', 'monforte'],
  },
];

const ACTIVE_STATIONS =
  SCRAPER_STATION_IDS.size > 0
    ? KNOWN_STATIONS.filter((station) => SCRAPER_STATION_IDS.has(station.station_id))
    : KNOWN_STATIONS;

const KNOWN_STATION_IDS = new Set(ACTIVE_STATIONS.map((station) => station.station_id));
const KNOWN_STATIONS_BY_CUPR = new Map(
  ACTIVE_STATIONS.filter((station) => station.cupr_id).map((station) => [station.cupr_id, station]),
);
const KNOWN_STATIONS_BY_CP = new Map(
  ACTIVE_STATIONS.filter((station) => station.cp_id).map((station) => [station.cp_id, station]),
);

const BBOX_INCREMENTAL = {
  latitudeMax: Number(inputConfig.incrementalLatMax ?? $env.IBERDROLA_BBOX_LAT_MAX ?? '38.41'),
  latitudeMin: Number(inputConfig.incrementalLatMin ?? $env.IBERDROLA_BBOX_LAT_MIN ?? '38.325'),
  longitudeMax: Number(inputConfig.incrementalLonMax ?? $env.IBERDROLA_BBOX_LON_MAX ?? '-0.72'),
  longitudeMin: Number(inputConfig.incrementalLonMin ?? $env.IBERDROLA_BBOX_LON_MIN ?? '-0.805'),
};

const BBOX_DAILY_FULL = {
  latitudeMax: Number(inputConfig.fullLatMax ?? $env.IBERDROLA_DAILY_BBOX_LAT_MAX ?? '38.62'),
  latitudeMin: Number(inputConfig.fullLatMin ?? $env.IBERDROLA_DAILY_BBOX_LAT_MIN ?? '38.12'),
  longitudeMax: Number(inputConfig.fullLonMax ?? $env.IBERDROLA_DAILY_BBOX_LON_MAX ?? '-0.42'),
  longitudeMin: Number(inputConfig.fullLonMin ?? $env.IBERDROLA_DAILY_BBOX_LON_MIN ?? '-1.02'),
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeAddressForMatch(value) {
  return normalizeText(value)
    .replace(/\b\d{5}\b/g, ' ')
    .replace(/\b(avenida|avda|av\.)\b/g, ' av ')
    .replace(/\b(c\.|c\/)\b/g, ' calle ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressTokens(value) {
  return normalizeAddressForMatch(value).split(' ').filter(Boolean);
}

function toIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function numeric(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function formatAddressObject(value) {
  if (!value || typeof value !== 'object') return null;

  const streetName = firstNonEmpty(value.streetName, value.street, value.name);
  const streetNum = firstNonEmpty(value.streetNum, value.number);
  const townName = firstNonEmpty(value.townName, value.city);

  const line = [streetName, streetNum].filter(Boolean).join(' ');
  if (!line && !townName) return null;

  return [line, townName].filter(Boolean).join(', ');
}

function extractAddress(item) {
  const structuredAddress =
    formatAddressObject(item?.locationData?.cpAddress) ||
    formatAddressObject(item?.locationData?.supplyPointData?.cpAddress) ||
    formatAddressObject(item?.supplyPointData?.cpAddress);

  return firstNonEmpty(
    structuredAddress,
    item?.locationData?.cuprName,
    item?.locationData?.cpAddress,
    item?.locationData?.address,
    item?.locationData?.supplyPointData?.cpAddress,
    item?.supplyPointData?.cpAddress,
    item?.address,
    item?.addressFull,
    item?.name,
    `CP ${item?.cpId ?? item?.cuprId ?? 'UNKNOWN'}`,
  );
}

function extractCuprId(item) {
  return firstNonEmpty(
    item?.cuprId,
    item?.locationData?.cuprId,
    item?.cpId,
    item?.locationData?.cpId,
  );
}

function extractCpId(item) {
  return firstNonEmpty(item?.cpId, item?.locationData?.cpId, item?.cuprId);
}

function resolveKnownStationFromItem(item, addressText) {
  const cuprId = extractCuprId(item);
  if (cuprId) {
    const knownByCupr = KNOWN_STATIONS_BY_CUPR.get(String(cuprId));
    if (knownByCupr) return knownByCupr;
  }

  const cpId = extractCpId(item);
  if (cpId) {
    const knownByCp = KNOWN_STATIONS_BY_CP.get(String(cpId));
    if (knownByCp) return knownByCp;
  }

  const tokens = new Set(addressTokens(addressText));
  return ACTIVE_STATIONS.find((station) =>
    station.address_tokens.every((term) => tokens.has(term)),
  );
}

function headers() {
  return {
    'content-type': 'application/json',
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
    referer: 'https://www.iberdrola.es/movilidad-electrica/recarga-fuera-de-casa',
    origin: 'https://www.iberdrola.es',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
  };
}

async function requestText(url, options = {}) {
  if (typeof fetch === 'function') {
    const response = await fetch(url, options);
    const responseText = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      body: responseText,
    };
  }

  const helper = this?.helpers?.httpRequest;
  if (typeof helper !== 'function') {
    throw new Error('Ni fetch ni this.helpers.httpRequest estan disponibles en este nodo de n8n');
  }

  try {
    const response = await helper({
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      json: false,
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    });

    return {
      ok: response.statusCode >= 200 && response.statusCode < 300,
      status: response.statusCode,
      body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? ''),
    };
  } catch (error) {
    throw new Error(`HTTP request fallo: ${error.message || error}`);
  }
}

async function iberdrolaPost(endpoint, body) {
  const response = await requestText.call(this, `${IBERDROLA_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Iberdrola ${endpoint} HTTP ${response.status}: ${response.body.slice(0, 300)}`);
  }

  try {
    return JSON.parse(response.body);
  } catch {
    throw new Error(`Iberdrola ${endpoint} devolvio JSON invalido`);
  }
}

async function fetchStationsList(bbox) {
  const payload = {
    dto: {
      chargePointTypesCodes: ['P', 'R', 'I', 'N'],
      socketStatus: [],
      advantageous: false,
      connectorsType: [],
      loadSpeed: [],
      latitudeMax: bbox.latitudeMax,
      latitudeMin: bbox.latitudeMin,
      longitudeMax: bbox.longitudeMax,
      longitudeMin: bbox.longitudeMin,
    },
    language: IBERDROLA_LANGUAGE,
  };

  const data = await iberdrolaPost.call(this, 'getListarPuntosRecarga', payload);
  return Array.isArray(data?.entidad) ? data.entidad : [];
}

function buildFailure(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  return error;
}

async function fetchStationDetail(cuprId) {
  const payload = {
    dto: { cuprId: [Number(cuprId)] },
    language: IBERDROLA_LANGUAGE,
  };

  const data = await iberdrolaPost.call(this, 'getDatosPuntoRecarga', payload);
  return Array.isArray(data?.entidad) && data.entidad.length ? data.entidad[0] : null;
}

function socketIsAvailable(statusCode) {
  const normalized = normalizeText(statusCode);
  if (!normalized) return false;
  return (
    normalized.includes('free') ||
    normalized.includes('available') ||
    normalized.includes('disponible') ||
    normalized === 'operative'
  );
}

function socketIsOutOfService(statusCode) {
  const normalized = normalizeText(statusCode);
  if (!normalized) return false;
  return (
    normalized.includes('fault') ||
    normalized.includes('error') ||
    normalized.includes('out') ||
    normalized.includes('inoperative')
  );
}

function extractLatestProviderTimestamp(listItem, detailItem, logicalSockets) {
  const socketCandidates = logicalSockets.flatMap((socket) => [
    socket?.status?.updateDate,
    socket?.status?.updateDatetime,
    socket?.status?.date,
    socket?.status?.lastUpdate,
    socket?.updateDate,
    socket?.updateDatetime,
  ]);

  const candidates = [
    detailItem?.cpStatus?.updateDate,
    detailItem?.cpStatus?.updateDatetime,
    detailItem?.cpStatus?.date,
    detailItem?.cpStatus?.statusDate,
    detailItem?.cpStatus?.lastUpdate,
    detailItem?.status?.updateDate,
    detailItem?.status?.updateDatetime,
    detailItem?.status?.date,
    detailItem?.status?.lastUpdate,
    detailItem?.updateDate,
    detailItem?.updateDatetime,
    detailItem?.lastUpdate,
    detailItem?.lastUpdatedAt,
    listItem?.cpStatus?.updateDate,
    listItem?.cpStatus?.updateDatetime,
    listItem?.cpStatus?.date,
    listItem?.status?.updateDate,
    listItem?.status?.updateDatetime,
    listItem?.status?.date,
    listItem?.updateDate,
    listItem?.updateDatetime,
    listItem?.lastUpdate,
    ...socketCandidates,
  ];

  const latest = candidates
    .filter(Boolean)
    .map((value) => toIso(value))
    .filter(Boolean)
    .sort()
    .at(-1);

  return latest || new Date().toISOString();
}

function buildRow(listItem, detailItem) {
  const address = extractAddress(detailItem) || extractAddress(listItem);
  const known =
    resolveKnownStationFromItem(detailItem, address) ||
    resolveKnownStationFromItem(listItem, address);

  if (!known) return null;

  const logicalSockets = Array.isArray(detailItem?.logicalSocket)
    ? detailItem.logicalSocket
    : [];

  const totalConnectors =
    numeric(detailItem?.socketNum, null) ??
    (logicalSockets.length > 0 ? logicalSockets.length : null);

  const availableConnectors = logicalSockets.reduce((sum, socket) => {
    const statusCode = socket?.status?.statusCode;
    return sum + (socketIsAvailable(statusCode) ? 1 : 0);
  }, 0);

  const outOfServiceConnectors = logicalSockets.reduce((sum, socket) => {
    const statusCode = socket?.status?.statusCode;
    return sum + (socketIsOutOfService(statusCode) ? 1 : 0);
  }, 0);

  const availabilityUpdatedAt = extractLatestProviderTimestamp(
    listItem,
    detailItem,
    logicalSockets,
  );

  const maxPowers = logicalSockets
    .flatMap((socket) =>
      Array.isArray(socket?.physicalSocket)
        ? socket.physicalSocket.map((p) => numeric(p?.maxPower, null))
        : [],
    )
    .filter((v) => v !== null);

  const powerKw = maxPowers.length ? Math.max(...maxPowers) : 22;

  const totalSafe = totalConnectors ?? logicalSockets.length;
  const availableSafe =
    totalSafe > 0
      ? Math.max(0, Math.min(totalSafe, availableConnectors))
      : null;

  return {
    station_id: known.station_id,
    location_name: known.location_name,
    is_available: (availableSafe ?? 0) > 0,
    power_kw: powerKw ?? 22,
    available_connectors: availableSafe,
    total_connectors: totalSafe || null,
    out_of_service_connectors: outOfServiceConnectors,
    availability_updated_at: availabilityUpdatedAt,
    source: 'iberdrola-web',
    data_quality: 'observed',
  };
}

function dedupeRowsByStation(rows) {
  const deduped = new Map();

  for (const row of rows) {
    const previous = deduped.get(row.station_id);
    if (!previous) {
      deduped.set(row.station_id, row);
      continue;
    }

    const prevTs = previous.availability_updated_at
      ? new Date(previous.availability_updated_at).getTime()
      : 0;
    const currTs = row.availability_updated_at
      ? new Date(row.availability_updated_at).getTime()
      : 0;

    if (currTs >= prevTs) {
      deduped.set(row.station_id, row);
    }
  }

  return Array.from(deduped.values());
}

async function insertRows(rows) {
  if (!rows.length) return;

  const response = await requestText.call(this, `${SUPABASE_URL}/rest/v1/charging_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    throw new Error(`Supabase insert HTTP ${response.status}: ${response.body}`);
  }
}

const bbox = SCRAPER_MODE === 'full' ? BBOX_DAILY_FULL : BBOX_INCREMENTAL;
const list = await fetchStationsList.call(this, bbox);

const unknownIds = Array.from(SCRAPER_STATION_IDS).filter(
  (id) => !KNOWN_STATIONS.some((station) => station.station_id === id),
);

if (!list.length) {
  throw buildFailure('Iberdrola no devolvio estaciones. Posible bloqueo, cambio de API o respuesta vacia.', {
    stage: 'getListarPuntosRecarga',
    bbox,
    mode: SCRAPER_MODE,
    targetStationIds: Array.from(KNOWN_STATION_IDS),
    unknownConfiguredIds: unknownIds,
  });
}

const detailRows = [];
const stationFailures = [];
let knownCandidates = 0;

for (const item of list) {
  const listAddress = extractAddress(item);
  const knownFromList = resolveKnownStationFromItem(item, listAddress);
  if (!knownFromList) continue;

  knownCandidates++;

  const cuprId = extractCuprId(item) || extractCpId(item);
  if (!cuprId) {
    stationFailures.push({
      station_id: knownFromList.station_id,
      stage: 'resolve_cupr',
      reason: 'Sin cuprId/cpId en listado Iberdrola',
    });
    continue;
  }

  try {
    const detail = await fetchStationDetail.call(this, cuprId);
    if (!detail) {
      stationFailures.push({
        station_id: knownFromList.station_id,
        stage: 'getDatosPuntoRecarga',
        reason: 'Detalle vacio para la estacion',
        cuprId,
      });
      continue;
    }

    const row = buildRow(item, detail);
    if (!row) {
      stationFailures.push({
        station_id: knownFromList.station_id,
        stage: 'build_row',
        reason: 'No se pudo mapear la estacion conocida',
        cuprId,
      });
      continue;
    }
    if (!KNOWN_STATION_IDS.has(row.station_id)) {
      stationFailures.push({
        station_id: row.station_id,
        stage: 'known_station_filter',
        reason: 'Station ID fuera del conjunto esperado',
        cuprId,
      });
      continue;
    }

    if (
      row.available_connectors !== null &&
      row.total_connectors !== null &&
      row.total_connectors > 0
    ) {
      detailRows.push(row);
    } else {
      stationFailures.push({
        station_id: row.station_id,
        stage: 'validate_row',
        reason: 'Fila sin conectores validos',
        cuprId,
      });
    }
  } catch (error) {
    stationFailures.push({
      station_id: knownFromList.station_id,
      stage: 'station_detail',
      reason: error?.message || String(error),
      cuprId,
    });
  }
}

if (!knownCandidates) {
  throw buildFailure('Iberdrola devolvio estaciones, pero ninguna coincide con las estaciones conocidas de Aspe.', {
    stage: 'match_known_stations',
    detected: list.length,
    mode: SCRAPER_MODE,
    targetStationIds: Array.from(KNOWN_STATION_IDS),
    unknownConfiguredIds: unknownIds,
  });
}

const dedupedRows = dedupeRowsByStation(detailRows).filter((row) =>
  KNOWN_STATION_IDS.has(row.station_id),
);

if (!dedupedRows.length) {
  throw buildFailure('No se pudo construir ninguna fila valida para insertar. Ejecucion marcada como fallida.', {
    stage: 'dedupe_rows',
    mode: SCRAPER_MODE,
    detected: list.length,
    knownCandidates,
    validRows: detailRows.length,
    targetStationIds: Array.from(KNOWN_STATION_IDS),
    unknownConfiguredIds: unknownIds,
    stationFailures,
  });
}

await insertRows.call(this, dedupedRows);

return [
  {
    json: {
      ok: true,
      mode: SCRAPER_MODE,
      detected: list.length,
      knownCandidates,
      validRows: detailRows.length,
      inserted: dedupedRows.length,
      targetStationIds: Array.from(KNOWN_STATION_IDS),
      unknownConfiguredIds: unknownIds,
      stationFailures,
      timestamp: new Date().toISOString(),
    },
  },
];
