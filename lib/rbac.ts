export type Role = "admin" | "fleet_manager" | "technician" | "viewer"

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  fleet_manager: "Manager (Fleet manager)",
  technician: "Empleado (Técnico)",
  viewer: "Viewer (Solo lectura)",
}

// Matriz de acceso por feature (frontend — menú lateral).
export type Feature =
  | "usuarios"
  | "cibernetica"
  | "alertas"
  | "tickets"
  | "telemetria"
  | "flota"
  | "reportes_ejecutivos"
  | "reportes_operativos"
  | "pipeline"
  | "twins"
  | "digital_twin"
  | "optimizacion"
  | "configuracion"

/**
 * admin: todo.
 * fleet_manager: todo menos usuarios; reportes **ejecutivos** (KPI/salud), no export crudo de anomalías.
 * technician: operación + lab + reportes **operativos** (detalle anomalías); sin GA ni ejecutivos.
 * viewer: observabilidad + ejecutivos de alto nivel.
 */
const ACCESS: Record<Role, Feature[]> = {
  admin: [
    "usuarios",
    "cibernetica",
    "alertas",
    "tickets",
    "telemetria",
    "flota",
    "reportes_ejecutivos",
    "reportes_operativos",
    "pipeline",
    "twins",
    "digital_twin",
    "optimizacion",
    "configuracion",
  ],
  fleet_manager: [
    "cibernetica",
    "alertas",
    "tickets",
    "telemetria",
    "flota",
    "reportes_ejecutivos",
    "pipeline",
    "twins",
    "digital_twin",
    "optimizacion",
    "configuracion",
  ],
  technician: [
    "cibernetica",
    "alertas",
    "tickets",
    "telemetria",
    "flota",
    "reportes_operativos",
    "pipeline",
    "twins",
    "digital_twin",
    "configuracion",
  ],
  viewer: [
    "alertas",
    "tickets",
    "telemetria",
    "flota",
    "reportes_ejecutivos",
    "pipeline",
    "configuracion",
  ],
}

/** Entrar a `/reportes` si puede al menos un tipo de exportación. */
export function canAccessReportes(role: string | null | undefined): boolean {
  return can(role, "reportes_ejecutivos") || can(role, "reportes_operativos")
}

export function can(role: string | null | undefined, feature: Feature): boolean {
  const r = ((role || "viewer").toLowerCase() as Role) || "viewer"
  return (ACCESS[r] ?? ACCESS.viewer).includes(feature)
}

/** Solo lectura en alertas (sin ejecutar detección ni crear tickets). */
export function isAlertasReadOnly(role: string | null | undefined): boolean {
  return (role || "viewer").toLowerCase() === "viewer"
}

/** Solo lectura en tickets (sin cambiar estado ni prioridad). */
export function isTicketsReadOnly(role: string | null | undefined): boolean {
  return (role || "viewer").toLowerCase() === "viewer"
}
