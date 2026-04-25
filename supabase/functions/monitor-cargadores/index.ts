import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Station = {
  station_id: string
  location_name: string
  google_place_id: string
  // Ajuste sobre la disponibilidad media de red cuando Google no devuelve availableCount.
  // Ejemplo: +0.15 = asumimos 15 puntos porcentuales más de disponibilidad.
  availability_bias?: number
}

type EvAvailabilityStatus = 'DISPONIBLE' | 'OCUPADO' | 'SIN_DATOS_DINAMICOS'

type DataQuality = 'observed' | 'estimated'

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
  data_quality: DataQuality
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
    google_place_id: 'ChIJ-U-KcMTHYw0RwyBsIKokiyQ',
  },
  {
    station_id: 'ESIBE22E0001002',
    location_name: 'Av. Constitución 42, Aspe',
    google_place_id: 'ChIJW5B0N8jHYw0RFVSeTep4lIY',
    // Zona comercial: menor presión residencial en ciertas franjas.
    availability_bias: 0.15,
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

  // Para ESIBE22E0001001: tomar SOLO conectores Tipo 2 de Google
  const tipo2Connector = snapshot.connectors.find((c) => c.type === 'Tipo 2')
  
  if (!tipo2Connector) {
    return { status: 'SIN_DATOS_DINAMICOS', snapshot }
  }

  const total = tipo2Connector.total
  const available = Math.max(0, tipo2Connector.available)

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

  if (!detailsResponse.ok) {
    throw new Error(`Google Place Details HTTP ${detailsResponse.status} (${station.station_id})`)
  }

  place = (await detailsResponse.json()) as GooglePlace

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
  const rawResults = await Promise.all(
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
          data_quality: 'observed',
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
          data_quality: 'observed',
        }
      }
    }),
  )

  const stationById = new Map(stations.map((s) => [s.station_id, s]))

  const dynamicWithAvailability = rawResults.filter((r) => (
    r.status !== 'SIN_DATOS_DINAMICOS' &&
    typeof r.available_connectors === 'number' &&
    typeof r.total_connectors === 'number' &&
    r.total_connectors > 0
  ))

  const networkAvailabilityRatio = dynamicWithAvailability.length
    ? dynamicWithAvailability.reduce((sum, r) => sum + ((r.available_connectors as number) / (r.total_connectors as number)), 0) / dynamicWithAvailability.length
    : null

  const estimatedResults = rawResults.map((r) => {
    if (r.status !== 'SIN_DATOS_DINAMICOS') return r
    if (typeof r.total_connectors !== 'number' || r.total_connectors <= 0) return r
    if (networkAvailabilityRatio === null) return r

    const stationConfig = stationById.get(r.station_id)
    const bias = stationConfig?.availability_bias ?? 0
    const adjustedRatio = Math.max(0, Math.min(1, networkAvailabilityRatio + bias))
    const estimatedAvailable = Math.max(0, Math.min(r.total_connectors, Math.round(r.total_connectors * adjustedRatio)))
    const estimatedStatus: EvAvailabilityStatus = estimatedAvailable > 0 ? 'DISPONIBLE' : 'OCUPADO'

    return {
      ...r,
      status: estimatedStatus,
      is_available: estimatedStatus === 'DISPONIBLE',
      available_connectors: estimatedAvailable,
      source: `estimated-network-ratio:${networkAvailabilityRatio.toFixed(3)}:bias:${bias.toFixed(2)}`,
      data_quality: 'estimated' as DataQuality,
    }
  })

  return estimatedResults
}

// ─── Edge Function ────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
  const minMinutesBetweenPolls = Number(Deno.env.get('MIN_MINUTES_BETWEEN_POLLS') ?? '15')

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
    const { data: latestSample, error: latestSampleError } = await supabase
      .from('charging_logs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestSampleError) {
      throw new Error(`Error leyendo última muestra: ${latestSampleError.message}`)
    }

    if (latestSample?.created_at) {
      const latestTs = new Date(latestSample.created_at).getTime()
      const nowTs = Date.now()
      const elapsedMinutes = (nowTs - latestTs) / 60000

      if (elapsedMinutes < minMinutesBetweenPolls) {
        return new Response(
          JSON.stringify({
            ok: true,
            inserted: 0,
            skipped: true,
            reason: `Ventana anti-coste activa (${elapsedMinutes.toFixed(1)} min < ${minMinutesBetweenPolls} min)`,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    const results = await checkAspeStationsStatus(STATIONS, googleApiKey)

    // Solo persistimos muestras con datos dinámicos válidos.
    // Si Google falla (ej. billing deshabilitado) evitamos ensuciar el histórico con nulls.
    const validResults = results.filter((r) => (
      r.status !== 'SIN_DATOS_DINAMICOS' &&
      r.available_connectors !== null &&
      r.total_connectors !== null
    ))

    if (!validResults.length) {
      const sourceSummary = results.reduce<Record<string, number>>((acc, r) => {
        acc[r.source] = (acc[r.source] ?? 0) + 1
        return acc
      }, {})

      const statusSummary = results.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1
        return acc
      }, {})

      return new Response(
        JSON.stringify({
          ok: true,
          inserted: 0,
          skipped: true,
          reason: 'Sin datos dinámicos válidos desde Google Places',
          sourceSummary,
          statusSummary,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const rowsToInsert = validResults.map(({ station_id, location_name, is_available, available_connectors, total_connectors, out_of_service_connectors, availability_updated_at, power_kw, source, data_quality }) => ({
      station_id,
      location_name,
      is_available,
      power_kw: power_kw ?? 22,
      available_connectors,
      total_connectors,
      out_of_service_connectors,
      availability_updated_at,
      source,
      data_quality,
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

    const chargers = validResults.map((r) => ({
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