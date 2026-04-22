import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Station = {
  station_id: string
  location_name: string
  google_place_id?: string
}

type EvAvailabilityStatus = 'DISPONIBLE' | 'OCUPADO' | 'SIN_DATOS_DINAMICOS'

type StationResult = {
  station_id: string
  location_name: string
  google_name: string | null
  status: EvAvailabilityStatus
  is_available: boolean
  available_connectors: number | null
  total_connectors: number | null
  out_of_service_connectors: number | null
  availability_updated_at: string | null
  power_kw: number | null
  connector_type: string | null
  connectors: ConnectorDetail[]
  source: string
}

type ConnectorAggregation = {
  availableCount?: number
  count?: number
  type?: string
  maxChargeRateKw?: number
  outOfServiceCount?: number
  availabilityLastUpdateTime?: string
}

type GooglePlace = {
  id?: string
  displayName?: { text?: string }
  evChargeOptions?: {
    connectorAggregation?: ConnectorAggregation[]
  }
}

type GooglePlacesResponse = {
  places?: GooglePlace[]
}

type ConnectorDetail = {
  type: string
  power_kw: number | null
  total: number
  available: number
}

type ConnectorSnapshot = {
  available_connectors: number | null
  total_connectors: number | null
  out_of_service_connectors: number | null
  availability_updated_at: string | null
  power_kw: number | null
  connector_type: string | null
  connectors: ConnectorDetail[]
}

// ─── Estaciones ───────────────────────────────────────────────────────────────

const STATIONS: Station[] = [
  {
    station_id: 'ESIBE22E0001001',
    location_name: 'Av. Carlos Soria, 11, Aspe',
    google_place_id: 'ChIJfc4rIMrHYw0RkvWSsMGDHxc',
  },
  {
    station_id: 'ESIBE22E0001002',
    location_name: 'Av. Constitución 42, Aspe',
    google_place_id: 'ChIJW5B0N8jHYw0RFVSeTep4lIY',
  },
  {
    station_id: 'ESIBE22E0001003',
    location_name: 'Av. Padre Ismael 34, Aspe',
    google_place_id: 'ChIJN8ITYc7HYw0RkmZUbD0UJbc',
  },
  {
    station_id: 'ESIBE22E0001004',
    location_name: 'Av. Juan Carlos I 36, Aspe',
    google_place_id: 'ChIJsykrHdvHYw0RsU1DWaSqEjE',
  },
  {
    station_id: 'ESIBE22E0001005',
    location_name: 'Calle Orihuela 100, Aspe',
    google_place_id: 'ChIJEfcRm77HYw0RFwDVmJba3E8',
  },
]

// ─── Google Places API (New) ──────────────────────────────────────────────────

function parseEvChargeStatus(
  connectorAggregation: ConnectorAggregation[] | undefined,
): { status: EvAvailabilityStatus; snapshot: ConnectorSnapshot } {
  const CONNECTOR_TYPE_LABELS: Record<string, string> = {
    EV_CONNECTOR_TYPE_TYPE_2: 'Tipo 2',
    EV_CONNECTOR_TYPE_CCS_COMBO_2: 'CCS Combo 2',
    EV_CONNECTOR_TYPE_CHADEMO: 'CHAdeMO',
    EV_CONNECTOR_TYPE_J1772: 'J1772',
    EV_CONNECTOR_TYPE_TESLA: 'Tesla',
    EV_CONNECTOR_TYPE_UNSPECIFIED: 'No especificado',
  }

  if (!connectorAggregation?.length) {
    return {
      status: 'SIN_DATOS_DINAMICOS',
      snapshot: {
        available_connectors: null,
        total_connectors: null,
        out_of_service_connectors: null,
        availability_updated_at: null,
        power_kw: null,
        connector_type: null,
        connectors: [],
      },
    }
  }

  const hasData = connectorAggregation.some((c) => c.availableCount !== undefined && c.availableCount !== null)
  const totalAvailable = connectorAggregation.reduce((sum, c) => sum + (c.availableCount ?? 0), 0)
  const totalOutOfService = connectorAggregation.reduce((sum, c) => sum + (c.outOfServiceCount ?? 0), 0)
  const totalConnectors = connectorAggregation.reduce((sum, c) => {
    if (c.count !== undefined && c.count !== null) return sum + c.count
    if (c.availableCount !== undefined && c.availableCount !== null) return sum + c.availableCount
    return sum
  }, 0)
  const rawType = connectorAggregation[0]?.type ?? null
  const connector_type = rawType ? (CONNECTOR_TYPE_LABELS[rawType] ?? rawType) : null
  const availabilityUpdatedAt = connectorAggregation
    .map((c) => c.availabilityLastUpdateTime)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null

  const connectors: ConnectorDetail[] = connectorAggregation.map((c) => ({
    type: c.type ? (CONNECTOR_TYPE_LABELS[c.type] ?? c.type) : 'Desconocido',
    power_kw:
      typeof c.maxChargeRateKw === 'number' && typeof c.count === 'number' && c.count > 0
        ? Math.round((c.maxChargeRateKw / c.count) * 100) / 100
        : c.maxChargeRateKw ?? null,
    total: c.count ?? 0,
    available: c.availableCount ?? 0,
  }))

  const powerPerConnector = connectors.reduce((max, c) => {
    if (typeof c.power_kw === 'number' && c.power_kw > 0) return Math.max(max, c.power_kw)
    return max
  }, 0)

  const snapshot: ConnectorSnapshot = {
    available_connectors: hasData ? totalAvailable : null,
    total_connectors: totalConnectors > 0 ? totalConnectors : null,
    out_of_service_connectors: totalOutOfService,
    availability_updated_at: availabilityUpdatedAt,
    power_kw: powerPerConnector > 0 ? powerPerConnector : null,
    connector_type,
    connectors,
  }

  if (!hasData) return { status: 'SIN_DATOS_DINAMICOS', snapshot }
  return { status: totalAvailable > 0 ? 'DISPONIBLE' : 'OCUPADO', snapshot }
}

function normalizeAspeStationSnapshot(
  stationId: string,
  snapshot: ConnectorSnapshot,
): { status: EvAvailabilityStatus; snapshot: ConnectorSnapshot } {
  if (stationId !== 'ESIBE22E0001001') {
    const available = snapshot.available_connectors ?? 0
    if (snapshot.available_connectors === null) return { status: 'SIN_DATOS_DINAMICOS', snapshot }
    return { status: available > 0 ? 'DISPONIBLE' : 'OCUPADO', snapshot }
  }

  // Para ESIBE22E0001001: usa el TOTAL GENERAL, no solo Tipo 2
  const rawTotal = snapshot.total_connectors ?? 0
  const rawAvailable = snapshot.available_connectors ?? 0

  // Si Google reporta 4 o más totales, significa que hay 2 phantom (probablemente 50kW)
  // Restamos 2 tanto del total como de los disponibles
  const total = rawTotal >= 4 ? 2 : rawTotal
  const adjustedAvailable = rawTotal >= 4 ? rawAvailable - 2 : rawAvailable
  const available = Math.max(0, Math.min(total, adjustedAvailable))

  const normalizedSnapshot: ConnectorSnapshot = {
    available_connectors: available,
    total_connectors: total,
    out_of_service_connectors: snapshot.out_of_service_connectors,
    availability_updated_at: snapshot.availability_updated_at,
    power_kw: 11,
    connector_type: 'Tipo 2',
    connectors: [
      {
        type: 'Tipo 2',
        power_kw: 11,
        total,
        available,
      },
    ],
  }

  return { status: available > 0 ? 'DISPONIBLE' : 'OCUPADO', snapshot: normalizedSnapshot }
}

async function fetchGooglePlacesStatus(
  station: Station,
  apiKey: string,
): Promise<{ googleName: string | null; status: EvAvailabilityStatus; snapshot: ConnectorSnapshot }> {
  let place: GooglePlace | undefined

  if (station.google_place_id) {
    const detailsResponse = await fetch(
      `https://places.googleapis.com/v1/places/${station.google_place_id}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,evChargeOptions',
        },
      },
    )

    if (detailsResponse.ok) {
      place = (await detailsResponse.json()) as GooglePlace
    }
  }

  if (!place) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.evChargeOptions,places.displayName,places.id',
      },
      body: JSON.stringify({
        textQuery: `punto de carga eléctrico ${station.location_name}, Aspe, Alicante, España`,
        includedType: 'electric_vehicle_charging_station',
        maxResultCount: 1,
      }),
    })

    if (!response.ok) {
      throw new Error(`Google Places HTTP ${response.status}`)
    }

    const data = (await response.json()) as GooglePlacesResponse
    place = data.places?.[0]
  }

  // Si Google no devuelve el lugar (posiblemente todos ocupados), devolvemos OCUPADO
  if (!place) {
    const snapshot: ConnectorSnapshot = {
      available_connectors: 0,
      total_connectors: null,
      out_of_service_connectors: 0,
      availability_updated_at: null,
      power_kw: null,
      connector_type: null,
      connectors: [],
    }

    return {
      googleName: null,
      status: 'OCUPADO',
      snapshot,
    }
  }

  const googleName = place.displayName?.text ?? null
  const parsed = parseEvChargeStatus(place.evChargeOptions?.connectorAggregation)
  const normalized = normalizeAspeStationSnapshot(station.station_id, parsed.snapshot)

  return { googleName, status: normalized.status, snapshot: normalized.snapshot }
}

// ─── Orquestador principal ────────────────────────────────────────────────────

async function checkAspeStationsStatus(
  stations: Station[],
  googleApiKey: string,
): Promise<StationResult[]> {
  return Promise.all(
    stations.map(async (station): Promise<StationResult> => {
      try {
        const { googleName, status, snapshot } = await fetchGooglePlacesStatus(station, googleApiKey)
        return {
          station_id: station.station_id,
          location_name: station.location_name,
          google_name: googleName,
          status,
          is_available: status === 'DISPONIBLE',
          available_connectors: snapshot.available_connectors,
          total_connectors: snapshot.total_connectors,
          out_of_service_connectors: snapshot.out_of_service_connectors,
          availability_updated_at: snapshot.availability_updated_at,
          power_kw: snapshot.power_kw,
          connector_type: snapshot.connector_type,
          connectors: snapshot.connectors,
          source: 'google-places',
        }
      } catch (error) {
        return {
          station_id: station.station_id,
          location_name: station.location_name,
          google_name: null,
          status: 'SIN_DATOS_DINAMICOS',
          is_available: false,
          available_connectors: null,
          total_connectors: null,
          out_of_service_connectors: null,
          availability_updated_at: null,
          power_kw: null,
          connector_type: null,
          connectors: [],
          source: `google-places-error:${error instanceof Error ? error.message : 'unknown'}`,
        }
      }
    }),
  )
}

// ─── Edge Function ────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!googleApiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Falta GOOGLE_PLACES_API_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const results = await checkAspeStationsStatus(STATIONS, googleApiKey)

    const rowsToInsert = results.map(({ station_id, location_name, is_available, available_connectors, total_connectors, out_of_service_connectors, availability_updated_at, power_kw }) => ({
      station_id,
      location_name,
      is_available,
      power_kw: power_kw ?? 22,
      available_connectors,
      total_connectors,
      out_of_service_connectors,
      availability_updated_at,
    }))

    const { error: insertError } = await supabase.from('charging_logs').insert(rowsToInsert)
    if (insertError) {
      const isOldSchema =
        insertError.message.includes('available_connectors') ||
        insertError.message.includes('total_connectors') ||
        insertError.message.includes('out_of_service_connectors') ||
        insertError.message.includes('availability_updated_at')

      if (!isOldSchema) throw new Error(`Error al insertar en Supabase: ${insertError.message}`)

      const fallbackRows = rowsToInsert.map(({ station_id, location_name, is_available, power_kw }) => ({
        station_id,
        location_name,
        is_available,
        power_kw,
      }))

      const { error: fallbackError } = await supabase.from('charging_logs').insert(fallbackRows)
      if (fallbackError) throw new Error(`Error al insertar en Supabase: ${fallbackError.message}`)
    }

    const sourceSummary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.source] = (acc[r.source] ?? 0) + 1
      return acc
    }, {})

    const statusSummary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    }, {})

    const chargers = results.map((r) => ({
      station_id: r.station_id,
      location_name: r.location_name,
      google_name: r.google_name,
      status: r.status,
      is_available: r.is_available,
      available_connectors: r.available_connectors,
      total_connectors: r.total_connectors,
      out_of_service_connectors: r.out_of_service_connectors,
      availability_updated_at: r.availability_updated_at,
      power_kw: r.power_kw,
      connector_type: r.connector_type,
      connectors: r.connectors,
      source: r.source,
    }))

    return new Response(
      JSON.stringify({
        ok: true,
        inserted: rowsToInsert.length,
        sourceSummary,
        statusSummary,
        chargers,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Error inesperado' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})