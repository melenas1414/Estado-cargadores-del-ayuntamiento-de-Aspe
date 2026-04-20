import { createClient } from 'npm:@supabase/supabase-js@2'

type Station = {
  station_id: string
  location_name: string
  ocm_id: number
}

const STATIONS: Station[] = [
  {
    station_id: 'ESIBE22E0001001',
    location_name: 'Av. Navarra 67, Aspe',
    ocm_id: 216923,
  },
  {
    station_id: 'ESIBE22E0001002',
    location_name: 'Av. Constitución 42, Aspe',
    ocm_id: 204184,
  },
  {
    station_id: 'ESIBE22E0001003',
    location_name: 'Av. Padre Ismael 34, Aspe',
    ocm_id: 204183,
  },
  {
    station_id: 'ESIBE22E0001004',
    location_name: 'Av. Juan Carlos I 36, Aspe',
    ocm_id: 204185,
  },
  {
    station_id: 'ESIBE22E0001005',
    location_name: 'Calle Orihuela 100, Aspe',
    ocm_id: 204186,
  },
]

type OcmPoint = {
  Connections?: Array<{ StatusType?: { IsOperational?: boolean } }>
}

async function fetchOcmStatus(ocmId: number, ocmApiKey: string): Promise<boolean> {
  const params = new URLSearchParams({
    output: 'json',
    compact: 'false',
    verbose: 'false',
    chargepointid: String(ocmId),
    key: ocmApiKey,
  })

  const url = `https://api.openchargemap.io/v3/poi/?${params}`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-api-key': ocmApiKey,
      'user-agent': 'estado-cargadores-aspe-edge/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`OCM HTTP ${response.status}`)
  }

  const points = (await response.json()) as OcmPoint[]
  if (!points.length) {
    throw new Error(`Sin resultados OCM para chargepointid=${ocmId}`)
  }

  const connections = points[0].Connections ?? []
  return connections.some((connection) => connection.StatusType?.IsOperational === true)
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const ocmApiKey = Deno.env.get('OCM_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!ocmApiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Falta OCM_API_KEY en los secretos de Supabase' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const rows = await Promise.all(
      STATIONS.map(async (station) => {
        const isAvailable = await fetchOcmStatus(station.ocm_id, ocmApiKey)
        return {
          station_id: station.station_id,
          location_name: station.location_name,
          is_available: isAvailable,
          power_kw: 22,
        }
      }),
    )

    const { error } = await supabase.from('charging_logs').insert(rows)
    if (error) {
      throw new Error(`Error al insertar en Supabase: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ ok: true, inserted: rows.length, source: 'openchargemap' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Error inesperado',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})