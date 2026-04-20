import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Station = {
  station_id: string
  location_name: string
  ocm_id: number
}

type EvAvailabilityStatus = 'DISPONIBLE' | 'OCUPADO' | 'SIN_DATOS_DINAMICOS'

type StationResult = {
  station_id: string
  location_name: string
  google_name: string | null
  status: EvAvailabilityStatus
  is_available: boolean
  source: string
}

type ConnectorAggregation = {
  availableCount?: number
  count?: number
  type?: string
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

type OcmPoint = {
  Connections?: Array<{ StatusType?: { ID?: number; Title?: string; IsOperational?: boolean } }>
}

// ─── Estaciones ───────────────────────────────────────────────────────────────

const STATIONS: Station[] = [
  { station_id: 'ESIBE22E0001001', location_name: 'Av. Navarra 67, Aspe', ocm_id: 216923 },
  { station_id: 'ESIBE22E0001002', location_name: 'Av. Constitución 42, Aspe', ocm_id: 204184 },
  { station_id: 'ESIBE22E0001003', location_name: 'Av. Padre Ismael 34, Aspe', ocm_id: 204183 },
  { station_id: 'ESIBE22E0001004', location_name: 'Av. Juan Carlos I 36, Aspe', ocm_id: 204185 },
  { station_id: 'ESIBE22E0001005', location_name: 'Calle Orihuela 100, Aspe', ocm_id: 204186 },
]

// ─── Google Places API (New) ──────────────────────────────────────────────────

function parseEvChargeStatus(connectorAggregation: ConnectorAggregation[] | undefined): EvAvailabilityStatus {
  if (!connectorAggregation?.length) return 'SIN_DATOS_DINAMICOS'

  const hasData = connectorAggregation.some((c) => c.availableCount !== undefined && c.availableCount !== null)
  if (!hasData) return 'SIN_DATOS_DINAMICOS'

  const totalAvailable = connectorAggregation.reduce((sum, c) => sum + (c.availableCount ?? 0), 0)
  return totalAvailable > 0 ? 'DISPONIBLE' : 'OCUPADO'
}

async function fetchGooglePlacesStatus(
  station: Station,
  apiKey: string,
): Promise<{ googleName: string | null; status: EvAvailabilityStatus }> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.evChargeOptions,places.displayName,places.id',
    },
    body: JSON.stringify({
      textQuery: `${station.location_name}, Aspe, Alicante, España`,
      maxResultCount: 1,
    }),
  })

  if (!response.ok) {
    throw new Error(`Google Places HTTP ${response.status}`)
  }

  const data = (await response.json()) as GooglePlacesResponse
  const place = data.places?.[0]

  if (!place) {
    throw new Error(`Google Places: sin resultados para "${station.location_name}"`)
  }

  const googleName = place.displayName?.text ?? null
  const status = parseEvChargeStatus(place.evChargeOptions?.connectorAggregation)

  return { googleName, status }
}

// ─── OpenChargeMap (fallback) ─────────────────────────────────────────────────

function getAvailabilityFromConnections(connections: OcmPoint['Connections'] = []): boolean {
  if (!connections.length) return false

  const hasAvailable = connections.some((c) => {
    const title = String(c?.StatusType?.Title ?? '').toLowerCase()
    return c?.StatusType?.ID === 50 || title.includes('available') || title.includes('disponible') || title.includes('libre')
  })
  if (hasAvailable) return true

  const hasOccupied = connections.some((c) => {
    const title = String(c?.StatusType?.Title ?? '').toLowerCase()
    return c?.StatusType?.ID === 60 || title.includes('occupied') || title.includes('in use') || title.includes('ocupado')
  })
  if (hasOccupied) return false

  return connections.some((c) => c?.StatusType?.IsOperational === true)
}

async function fetchOcmStatus(ocmId: number, ocmApiKey: string): Promise<boolean> {
  const params = new URLSearchParams({
    output: 'json',
    compact: 'false',
    verbose: 'false',
    chargepointid: String(ocmId),
    key: ocmApiKey,
  })

  const response = await fetch(`https://api.openchargemap.io/v3/poi/?${params}`, {
    headers: {
      Accept: 'application/json',
      'x-api-key': ocmApiKey,
      'user-agent': 'estado-cargadores-aspe-edge/1.0',
    },
  })

  if (!response.ok) throw new Error(`OCM HTTP ${response.status}`)

  const points = (await response.json()) as OcmPoint[]
  if (!points.length) throw new Error(`Sin resultados OCM para chargepointid=${ocmId}`)

  return getAvailabilityFromConnections(points[0].Connections ?? [])
}

// ─── Orquestador principal ────────────────────────────────────────────────────

async function checkAspeStationsStatus(
  stations: Station[],
  googleApiKey: string | undefined,
  ocmApiKey: string,
): Promise<StationResult[]> {
  return Promise.all(
    stations.map(async (station): Promise<StationResult> => {
      // Fuente 1: Google Places API (New) — datos en tiempo real
      if (googleApiKey) {
        try {
          const { googleName, status } = await fetchGooglePlacesStatus(station, googleApiKey)
          if (status !== 'SIN_DATOS_DINAMICOS') {
            return {
              station_id: station.station_id,
              location_name: station.location_name,
              google_name: googleName,
              status,
              is_available: status === 'DISPONIBLE',
              source: 'google-places',
            }
          }
        } catch (_err) {
          // Continúa con fallback
        }
      }

      // Fuente 2: OpenChargeMap (fallback)
      try {
        const isAvailable = await fetchOcmStatus(station.ocm_id, ocmApiKey)
        return {
          station_id: station.station_id,
          location_name: station.location_name,
          google_name: null,
          status: isAvailable ? 'DISPONIBLE' : 'OCUPADO',
          is_available: isAvailable,
          source: 'openchargemap',
        }
      } catch (_err) {
        return {
          station_id: station.station_id,
          location_name: station.location_name,
          google_name: null,
          status: 'SIN_DATOS_DINAMICOS',
          is_available: false,
          source: 'sin-datos',
        }
      }
    }),
  )
}

// ─── Edge Function ────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const ocmApiKey = Deno.env.get('OCM_API_KEY')
  const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!ocmApiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Falta OCM_API_KEY (requerido como fallback)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const results = await checkAspeStationsStatus(STATIONS, googleApiKey, ocmApiKey)

    const rowsToInsert = results.map(({ station_id, location_name, is_available }) => ({
      station_id,
      location_name,
      is_available,
      power_kw: 22,
    }))

    const { error } = await supabase.from('charging_logs').insert(rowsToInsert)
    if (error) throw new Error(`Error al insertar en Supabase: ${error.message}`)

    const sourceSummary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.source] = (acc[r.source] ?? 0) + 1
      return acc
    }, {})

    const statusSummary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    }, {})

    return new Response(
      JSON.stringify({ ok: true, inserted: rowsToInsert.length, sourceSummary, statusSummary }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Error inesperado' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})