export function getApiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, "")
}

/** Base WS del gemelo: `NEXT_PUBLIC_TWIN_WS_URL` o derivado de `NEXT_PUBLIC_API_URL`. */
export function getTwinWsBaseUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_TWIN_WS_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const api = getApiBaseUrl()
  if (!api) return null
  if (api.startsWith("https://")) return api.replace(/^https:/, "wss:")
  if (api.startsWith("http://")) return api.replace(/^http:/, "ws:")
  return null
}

async function apiFetch(baseUrl: string, path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    // Para auth por cookie (HttpOnly) entre front y API.
    credentials: "include",
    cache: "no-store",
  })
}

export type ApiVehicle = {
  id: string
  plate: string
  vin: string | null
  model: string | null
  brand: string | null
  year: number | null
  fleet_id: string
  fleet_name: string
  firmware_version: string | null
  created_at: string
  updated_at: string
  overall_health: number | null
  open_critical_anomalies: number
  open_tickets: number
}

export async function fetchVehicles(baseUrl: string): Promise<ApiVehicle[]> {
  const res = await apiFetch(baseUrl, `/vehicles`)
  if (!res.ok) {
    throw new Error(`vehicles ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export type ApiTelemetryPoint = {
  time: string
  device_time: string
  speed: number | null
  engine_temp: number | null
  battery_voltage: number | null
  rpm: number | null
  vibration_rms: number | null
  latitude: number | null
  longitude: number | null
  odometer: number | null
}

export async function fetchVehicleTelemetry(
  baseUrl: string,
  vehicleId: string,
  limit = 500,
): Promise<ApiTelemetryPoint[]> {
  const q = new URLSearchParams({ limit: String(limit) })
  const res = await apiFetch(baseUrl, `/vehicles/${vehicleId}/telemetry?${q}`)
  if (!res.ok) {
    throw new Error(`telemetry ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export type CyberStepResponse = {
  time: number[]
  temperature: number[]
  G_s: string
  M_s: string
  steady_state_degC: number
  settling_time_s: number
}

export async function postCyberneticsStepResponse(
  baseUrl: string,
  body: { K: number; tau: number; H?: number; t_end?: number; setpoint?: number },
): Promise<CyberStepResponse> {
  const res = await apiFetch(baseUrl, `/cybernetics/step-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`cybernetics step-response ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export type CyberSfgJson = Record<string, unknown>

export async function fetchCyberneticsSfg(baseUrl: string): Promise<CyberSfgJson> {
  const res = await apiFetch(baseUrl, `/cybernetics/sfg`)
  if (!res.ok) {
    throw new Error(`cybernetics sfg ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export type ApiAnomaly = {
  id: string
  time: string
  vehicle_id: string
  plate: string
  anomaly_score: number
  severity: string
  sensor_affected: string | null
  model_version: string | null
  description: string | null
  ticket_id: string | null
  resolved_at: string | null
}

export async function fetchAnomalies(baseUrl: string, limit = 200): Promise<ApiAnomaly[]> {
  const q = new URLSearchParams({ limit: String(limit) })
  const res = await apiFetch(baseUrl, `/anomalies/?${q}`)
  if (!res.ok) {
    throw new Error(`anomalies ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export type AnomalyRunResult = { vehicles_scanned: number; rows_inserted: number }

export async function postAnomalyRun(
  baseUrl: string,
  body?: { vehicle_ids?: string[]; window?: number; contamination?: number },
): Promise<AnomalyRunResult> {
  const res = await apiFetch(baseUrl, `/anomalies/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    throw new Error(`anomalies run ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export type ApiUser = {
  id: string
  email: string
  full_name: string | null
  role: string | null
  client_id: string | null
  is_active: boolean
  created_at: string | null
}

export async function login(
  baseUrl: string,
  body: { email: string; password: string },
): Promise<{ access_token: string; refresh_token: string; token_type: string }> {
  const form = new URLSearchParams()
  form.set("username", body.email)
  form.set("password", body.password)
  const res = await apiFetch(baseUrl, `/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })
  if (!res.ok) {
    throw new Error(`login ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

/** Renueva access + refresh; actualiza cookie HttpOnly del access en la respuesta. */
export async function refreshSession(
  baseUrl: string,
  refresh_token: string,
): Promise<{ access_token: string; refresh_token: string; token_type: string }> {
  const res = await apiFetch(baseUrl, `/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  })
  if (!res.ok) {
    throw new Error(`refresh ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function logout(baseUrl: string): Promise<void> {
  const res = await apiFetch(baseUrl, `/auth/logout`, { method: "POST" })
  if (!res.ok) {
    throw new Error(`logout ${res.status}: ${await res.text()}`)
  }
}

export async function fetchMe(baseUrl: string): Promise<ApiUser> {
  const res = await apiFetch(baseUrl, `/auth/me`)
  if (!res.ok) {
    throw new Error(`me ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function fetchUsers(baseUrl: string): Promise<ApiUser[]> {
  const res = await apiFetch(baseUrl, `/users`)
  if (!res.ok) {
    throw new Error(`users ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function createUser(
  baseUrl: string,
  body: {
    email: string
    password: string
    full_name?: string
    role?: string
    client_id?: string
    is_active?: boolean
  },
): Promise<ApiUser> {
  const res = await apiFetch(baseUrl, `/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`create user ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function patchUser(
  baseUrl: string,
  userId: string,
  body: {
    email?: string | null
    full_name?: string | null
    role?: string | null
    client_id?: string | null
    is_active?: boolean | null
    password?: string | null
  },
): Promise<ApiUser> {
  const res = await apiFetch(baseUrl, `/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`patch user ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function deleteUser(baseUrl: string, userId: string): Promise<void> {
  const res = await apiFetch(baseUrl, `/users/${userId}`, { method: "DELETE" })
  if (!res.ok) {
    throw new Error(`delete user ${res.status}: ${await res.text()}`)
  }
}

/** UUID flota demo del seed (`seed_demo.py`). */
export const DEMO_FLEET_ID_DEFAULT = "00000000-0000-4000-8000-000000000002"

export function getDemoFleetIdForReports(): string {
  const v = process.env.NEXT_PUBLIC_DEMO_FLEET_ID?.trim()
  return v || DEMO_FLEET_ID_DEFAULT
}

/** Respuesta JSON de `GET /reports/maintenance-kpi?format=json`. */
export type MaintenanceKpiJson = {
  generated_at: string
  scope_fleet_id: string | null
  total_tickets: number
  by_status: {
    open: number
    in_progress: number
    resolved: number
    cancelled: number
  }
  by_priority: {
    low: number
    medium: number
    high: number
    critical: number
  }
}

/** Fila JSON de `GET /reports/fleet-health/{fleet_id}?format=json`. */
export type FleetHealthRowJson = {
  vehicle_id: string
  plate: string
  model: string
  fleet_name: string
  overall_health: string
  divergence_score: string
  failure_probability: string
  last_updated: string
  open_critical_anomalies: string
  open_tickets: string
}

export async function fetchReportMaintenanceKpiJson(
  baseUrl: string,
  fleetId: string,
): Promise<MaintenanceKpiJson> {
  const q = new URLSearchParams({
    fleet_id: fleetId,
    format: "json",
  })
  const res = await apiFetch(baseUrl, `/reports/maintenance-kpi?${q}`)
  if (!res.ok) {
    throw new Error(`maintenance-kpi ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function fetchReportFleetHealthJson(
  baseUrl: string,
  fleetId: string,
): Promise<FleetHealthRowJson[]> {
  const q = new URLSearchParams({ format: "json" })
  const res = await apiFetch(baseUrl, `/reports/fleet-health/${fleetId}?${q}`)
  if (!res.ok) {
    throw new Error(`fleet-health ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

/** Descarga archivos desde `/reports/*` (requiere sesión / cookie HttpOnly). */
export type MaintenanceTicketCreated = {
  id: string
  vehicle_id: string
  status: string
  priority: string
  title: string
  description: string | null
  anomaly_event_id: string | null
  created_at: string | null
}

/** Crea ticket de mantenimiento y enlaza `anomaly_events.ticket_id` (roles admin | technician | fleet_manager). */
export async function postTicketFromAnomaly(
  baseUrl: string,
  body: { anomaly_id: string; anomaly_time: string; title?: string; description?: string },
): Promise<MaintenanceTicketCreated> {
  const res = await apiFetch(baseUrl, `/tickets/from-anomaly`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anomaly_id: body.anomaly_id,
      anomaly_time: body.anomaly_time,
      title: body.title,
      description: body.description,
    }),
  })
  if (!res.ok) {
    throw new Error(`ticket ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export type ApiMaintenanceTicket = {
  id: string
  vehicle_id: string
  plate: string
  fleet_id: string
  fleet_name: string | null
  status: string
  priority: string
  title: string
  description: string | null
  anomaly_event_id: string | null
  assigned_to: string | null
  created_at: string | null
  updated_at: string | null
  resolved_date: string | null
  estimated_cost: number | null
  actual_cost: number | null
}

export async function fetchTickets(
  baseUrl: string,
  opts?: { status?: string; vehicleId?: string; limit?: number },
): Promise<ApiMaintenanceTicket[]> {
  const q = new URLSearchParams()
  if (opts?.status) q.set("status", opts.status)
  if (opts?.vehicleId) q.set("vehicle_id", opts.vehicleId)
  if (opts?.limit != null) q.set("limit", String(opts.limit))
  const qs = q.toString()
  const path = qs ? `/tickets?${qs}` : `/tickets`
  const res = await apiFetch(baseUrl, path)
  if (!res.ok) {
    throw new Error(`tickets ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function patchTicket(
  baseUrl: string,
  ticketId: string,
  body: { status?: string; priority?: string },
): Promise<ApiMaintenanceTicket> {
  const res = await apiFetch(baseUrl, `/tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`ticket patch ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function downloadReport(baseUrl: string, pathWithQuery: string): Promise<void> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}${pathWithQuery}`, {
    credentials: "include",
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`report ${res.status}: ${await res.text()}`)
  }
  const blob = await res.blob()
  const cd = res.headers.get("Content-Disposition")
  let fname = "telema_report.bin"
  const m = cd?.match(/filename="([^"]+)"/)
  if (m) fname = m[1]
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fname
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
