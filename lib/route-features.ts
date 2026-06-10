import { can, canAccessReportes, type Feature } from "@/lib/rbac"

const SEG_MAP: Record<string, Feature> = {
  flota: "flota",
  telemetria: "telemetria",
  cibernetica: "cibernetica",
  twins: "twins",
  "digital-twin": "digital_twin",
  optimizacion: "optimizacion",
  alertas: "alertas",
  tickets: "tickets",
  usuarios: "usuarios",
  pipeline: "pipeline",
  configuracion: "configuracion",
}

/**
 * ¿Puede el rol abrir esta ruta? (`/` sin restricción extra).
 * `/reportes` admite quien tenga ejecutivos **o** operativos.
 */
export function canAccessPathname(role: string | null, pathname: string | null): boolean {
  if (!pathname || pathname === "/") return true
  const seg = pathname.split("/").filter(Boolean)[0]
  if (seg === "reportes") {
    return canAccessReportes(role)
  }
  const f = SEG_MAP[seg]
  return f ? can(role, f) : true
}
