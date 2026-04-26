#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCRAPER_MODE = (process.env.SCRAPER_MODE || 'incremental').toLowerCase()
const IBERDROLA_LANGUAGE = process.env.IBERDROLA_LANGUAGE || 'es'
const SCRAPER_PROXY_URL = process.env.SCRAPER_PROXY_URL || ''
const SCRAPER_DEBUG_RESPONSES = /^(1|true|yes|on)$/i.test(
  process.env.SCRAPER_DEBUG_RESPONSES || '',
)

if (SCRAPER_PROXY_URL) {
  // Node fetch puede usar proxy por variables de entorno cuando está habilitado.
  process.env.HTTP_PROXY = SCRAPER_PROXY_URL
  process.env.HTTPS_PROXY = SCRAPER_PROXY_URL
  process.env.NODE_USE_ENV_PROXY = '1'
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const IBERDROLA_BASE_URL =
  'https://www.iberdrola.es/o/webclipb/iberdrola/puntosrecargacontroller'

const KNOWN_STATIONS = [
  {
    station_id: 'ESIBE22E0001001',
    location_name: 'Av. Carlos Soria, 11, Aspe',
    address_tokens: ['av', 'carlos', 'soria', '11', 'aspe'],
  },
  {
    station_id: 'ESIBE22E0001002',
    location_name: 'Av. Constitución 42, Aspe',
    address_tokens: ['av', 'constitucion', '42', 'aspe'],
  },
  {
    station_id: 'ESIBE22E0001003',
    location_name: 'Av. Padre Ismael 34, Aspe',
    address_tokens: ['av', 'padre', 'ismael', '34', 'aspe'],
  },
  {
    station_id: 'ESIBE22E0001004',
    location_name: 'Av. Juan Carlos I 36, Aspe',
    address_tokens: ['av', 'juan', 'carlos', 'i', '36', 'aspe'],
  },
  {
    station_id: 'ESIBE22E0001005',
    location_name: 'Calle Orihuela 100, Aspe',
    address_tokens: ['calle', 'orihuela', '100', 'aspe'],
  },
]

const KNOWN_STATION_IDS = new Set(KNOWN_STATIONS.map((station) => station.station_id))

const BBOX_INCREMENTAL = {
  latitudeMax: Number(process.env.IBERDROLA_BBOX_LAT_MAX ?? '38.365'),
  latitudeMin: Number(process.env.IBERDROLA_BBOX_LAT_MIN ?? '38.325'),
  longitudeMax: Number(process.env.IBERDROLA_BBOX_LON_MAX ?? '-0.735'),
  longitudeMin: Number(process.env.IBERDROLA_BBOX_LON_MIN ?? '-0.805'),
}

const BBOX_DAILY_FULL = {
  latitudeMax: Number(process.env.IBERDROLA_DAILY_BBOX_LAT_MAX ?? '38.62'),
  latitudeMin: Number(process.env.IBERDROLA_DAILY_BBOX_LAT_MIN ?? '38.12'),
  longitudeMax: Number(process.env.IBERDROLA_DAILY_BBOX_LON_MAX ?? '-0.42'),
  longitudeMin: Number(process.env.IBERDROLA_DAILY_BBOX_LON_MIN ?? '-1.02'),
}

function clipText(value, maxLength = 2200) {
  if (!value) return ''
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...[truncated]`
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeAddressForMatch(value) {
  return normalizeText(value)
    .replace(/\b\d{5}\b/g, ' ')
    .replace(/\b(avenida|avda|av\.)\b/g, ' av ')
    .replace(/\b(c\.|c\/)\b/g, ' calle ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function addressTokens(value) {
  return normalizeAddressForMatch(value).split(' ').filter(Boolean)
}

function toIso(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function numeric(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value
    }
  }
  return null
}

function extractAddress(item) {
  return firstNonEmpty(
    item?.locationData?.cpAddress,
    item?.locationData?.address,
    item?.address,
    item?.addressFull,
    item?.name,
    `CP ${item?.cpId ?? item?.cuprId ?? 'UNKNOWN'}`,
  )
}

function extractCuprId(item) {
  return firstNonEmpty(
    item?.cuprId,
    item?.locationData?.cuprId,
    item?.cpId,
    item?.locationData?.cpId,
  )
}

function extractCpId(item) {
  return firstNonEmpty(item?.cpId, item?.locationData?.cpId, item?.cuprId)
}

function extractLat(item) {
  return numeric(
    firstNonEmpty(
      item?.locationData?.latitude,
      item?.locationData?.lat,
      item?.latitude,
      item?.lat,
    ),
    null,
  )
}

function extractLon(item) {
  return numeric(
    firstNonEmpty(
      item?.locationData?.longitude,
      item?.locationData?.lng,
      item?.locationData?.lon,
      item?.longitude,
      item?.lng,
      item?.lon,
    ),
    null,
  )
}

function resolveKnownStation(addressText) {
  const tokens = new Set(addressTokens(addressText))
  return KNOWN_STATIONS.find((station) =>
    station.address_tokens.every((term) => tokens.has(term)),
  )
}

function headers() {
  return {
    'content-type': 'application/json',
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
    referer:
      'https://www.iberdrola.es/movilidad-electrica/recarga-fuera-de-casa',
    origin: 'https://www.iberdrola.es',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
  }
}

async function iberdrolaPost(endpoint, body) {
  const response = await fetch(`${IBERDROLA_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  const responseText = await response.text()

  if (SCRAPER_DEBUG_RESPONSES) {
    console.log(`[debug] Iberdrola ${endpoint} request:`, JSON.stringify(body))
    console.log(`[debug] Iberdrola ${endpoint} response:`, clipText(responseText))
  }

  if (!response.ok) {
    throw new Error(`Iberdrola ${endpoint} HTTP ${response.status}`)
  }

  try {
    return JSON.parse(responseText)
  } catch {
    throw new Error(`Iberdrola ${endpoint} devolvio JSON invalido`)
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
  }

  const data = await iberdrolaPost('getListarPuntosRecarga', payload)
  return Array.isArray(data?.entidad) ? data.entidad : []
}

async function fetchStationDetail(cuprId) {
  const payload = {
    dto: { cuprId: [Number(cuprId)] },
    language: IBERDROLA_LANGUAGE,
  }

  const data = await iberdrolaPost('getDatosPuntoRecarga', payload)
  return Array.isArray(data?.entidad) && data.entidad.length ? data.entidad[0] : null
}

function socketIsAvailable(statusCode) {
  const normalized = normalizeText(statusCode)
  if (!normalized) return false
  return (
    normalized.includes('free') ||
    normalized.includes('available') ||
    normalized.includes('disponible') ||
    normalized === 'operative'
  )
}

function socketIsOutOfService(statusCode) {
  const normalized = normalizeText(statusCode)
  if (!normalized) return false
  return (
    normalized.includes('fault') ||
    normalized.includes('error') ||
    normalized.includes('out') ||
    normalized.includes('inoperative')
  )
}

function buildRow(listItem, detailItem) {
  const address = extractAddress(detailItem) || extractAddress(listItem)
  const known = resolveKnownStation(address)

  // Ignoramos estaciones fuera del listado oficial conocido para evitar ruido/duplicados.
  if (!known) return null

  const cuprId = extractCuprId(detailItem) || extractCuprId(listItem)
  const cpId = extractCpId(detailItem) || extractCpId(listItem)

  const logicalSockets = Array.isArray(detailItem?.logicalSocket)
    ? detailItem.logicalSocket
    : []

  const totalConnectors =
    numeric(detailItem?.socketNum, null) ??
    (logicalSockets.length > 0 ? logicalSockets.length : null)

  const availableConnectors = logicalSockets.reduce((sum, socket) => {
    const statusCode = socket?.status?.statusCode
    return sum + (socketIsAvailable(statusCode) ? 1 : 0)
  }, 0)

  const outOfServiceConnectors = logicalSockets.reduce((sum, socket) => {
    const statusCode = socket?.status?.statusCode
    return sum + (socketIsOutOfService(statusCode) ? 1 : 0)
  }, 0)

  const updateCandidates = [
    detailItem?.cpStatus?.updateDate,
    ...logicalSockets.map((s) => s?.status?.updateDate),
  ]

  const availabilityUpdatedAt = toIso(
    updateCandidates.filter(Boolean).sort().at(-1) || null,
  )

  const maxPowers = logicalSockets
    .flatMap((socket) =>
      Array.isArray(socket?.physicalSocket)
        ? socket.physicalSocket.map((p) => numeric(p?.maxPower, null))
        : [],
    )
    .filter((v) => v !== null)

  const powerKw = maxPowers.length ? Math.max(...maxPowers) : 22

  const totalSafe = totalConnectors ?? logicalSockets.length
  const availableSafe =
    totalSafe > 0
      ? Math.max(0, Math.min(totalSafe, availableConnectors))
      : null

  const stationId = known.station_id

  return {
    station_id: stationId,
    location_name: known.location_name,
    is_available: (availableSafe ?? 0) > 0,
    power_kw: powerKw ?? 22,
    available_connectors: availableSafe,
    total_connectors: totalSafe || null,
    out_of_service_connectors: outOfServiceConnectors,
    availability_updated_at: availabilityUpdatedAt,
    source: 'iberdrola-web',
    data_quality: 'observed',
  }
}

function dedupeRowsByStation(rows) {
  const deduped = new Map()

  for (const row of rows) {
    const previous = deduped.get(row.station_id)
    if (!previous) {
      deduped.set(row.station_id, row)
      continue
    }

    const prevTs = previous.availability_updated_at
      ? new Date(previous.availability_updated_at).getTime()
      : 0
    const currTs = row.availability_updated_at
      ? new Date(row.availability_updated_at).getTime()
      : 0

    if (currTs >= prevTs) {
      deduped.set(row.station_id, row)
    }
  }

  return Array.from(deduped.values())
}

async function insertRows(rows) {
  if (!rows.length) return

  const response = await fetch(`${SUPABASE_URL}/rest/v1/charging_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Supabase insert HTTP ${response.status}: ${errorText}`)
  }
}

async function main() {
  const bbox = SCRAPER_MODE === 'full' ? BBOX_DAILY_FULL : BBOX_INCREMENTAL

  console.log(`Modo scraper: ${SCRAPER_MODE}`)
  console.log(`Proxy activo: ${SCRAPER_PROXY_URL ? 'si' : 'no'}`)
  console.log('BBOX:', bbox)

  const list = await fetchStationsList(bbox)
  console.log(`Estaciones detectadas por Iberdrola: ${list.length}`)

  if (SCRAPER_DEBUG_RESPONSES) {
    console.log('[debug] Candidatas detectadas:')
    for (const item of list) {
      const address = extractAddress(item)
      const known = resolveKnownStation(address)
      const lat = extractLat(item)
      const lon = extractLon(item)
      console.log(
        `  - cuprId=${extractCuprId(item) || 'NA'} cpId=${extractCpId(item) || 'NA'} ` +
          `match=${known?.station_id || 'none'} lat=${lat ?? 'NA'} lon=${lon ?? 'NA'} ` +
          `address="${address}"`,
      )
    }
  }

  const detailRows = []

  for (const item of list) {
    try {
      const listAddress = extractAddress(item)
      const knownFromList = resolveKnownStation(listAddress)
      if (!knownFromList) {
        if (SCRAPER_DEBUG_RESPONSES) {
          console.log(
            `  - skip (no conocida) cuprId=${extractCuprId(item) || 'NA'} cpId=${extractCpId(item) || 'NA'} address="${listAddress}"`,
          )
        }
        continue
      }

      const cuprId = extractCuprId(item)
      const cpId = extractCpId(item)

      if (!cuprId && !cpId) continue

      const detail = await fetchStationDetail(cuprId || cpId)
      if (!detail) continue

      const row = buildRow(item, detail)
      if (!row) continue
      if (!KNOWN_STATION_IDS.has(row.station_id)) continue

      // Persistimos solo cuando hay datos mínimos de conectores para evitar ruido.
      if (
        row.available_connectors !== null &&
        row.total_connectors !== null &&
        row.total_connectors > 0
      ) {
        detailRows.push(row)
      }
    } catch (error) {
      console.error('Error procesando estación:', error instanceof Error ? error.message : error)
    }
  }

  if (!detailRows.length) {
    console.log('No hay filas válidas para insertar')
    return
  }

  const dedupedRows = dedupeRowsByStation(detailRows).filter((row) =>
    KNOWN_STATION_IDS.has(row.station_id),
  )

  if (!dedupedRows.length) {
    console.log('No hay filas conocidas para insertar')
    return
  }

  await insertRows(dedupedRows)
  console.log(`Filas insertadas: ${dedupedRows.length} (deduplicadas desde ${detailRows.length})`)
}

main().catch((error) => {
  console.error('Fallo del scraper:', error instanceof Error ? error.message : error)
  process.exit(1)
})
