/**
 * Evaluación orientativa según ISO 10816-1 (grupo 2, soporte flexible).
 * La telemetría del laboratorio guarda RMS de aceleración; se estima velocidad RMS (mm/s)
 * con frecuencia nominal del régimen de motor para comparar con zonas A–D.
 */

export type Iso10816Zone = "A" | "B" | "C" | "D"

/** Límites superiores de velocidad RMS (mm/s), grupo 2 flexible — ISO 10816-1 */
export const ISO10816_GROUP2_MM_S = {
  aMax: 2.8,
  bMax: 7.1,
  cMax: 18,
} as const

export type Iso10816Evaluation = {
  zone: Iso10816Zone
  zoneLabel: string
  velocityMmS: number
  accelRmsInput: number
  inCompliance: boolean
  description: string
}

const ZONE_META: Record<
  Iso10816Zone,
  { label: string; description: string; color: string; compliance: boolean }
> = {
  A: {
    label: "Zona A — Bueno",
    description: "Vibración baja; máquina en buenas condiciones.",
    color: "var(--tm-success)",
    compliance: true,
  },
  B: {
    label: "Zona B — Aceptable",
    description: "Aceptable para operación continua; planificar mantenimiento.",
    color: "var(--tm-info)",
    compliance: true,
  },
  C: {
    label: "Zona C — Insatisfactorio",
    description: "Insatisfactorio; intervenir y analizar causa.",
    color: "var(--tm-warning)",
    compliance: false,
  },
  D: {
    label: "Zona D — Inaceptable",
    description: "Inaceptable; riesgo de daño; detener o limitar operación.",
    color: "var(--tm-danger)",
    compliance: false,
  },
}

/** Convierte RMS de aceleración a velocidad RMS (mm/s) con f nominal (Hz). */
export function accelRmsToVelocityMmS(
  accelRms: number,
  opts?: { unit?: "g" | "ms2"; nominalHz?: number },
): number {
  const unit = opts?.unit ?? "g"
  const hz = opts?.nominalHz ?? 50
  const ms2 = unit === "g" ? accelRms * 9.80665 : accelRms
  if (hz <= 0) return 0
  return (ms2 * 1000) / (2 * Math.PI * hz)
}

export function evaluateIso10816Velocity(velocityMmS: number): Iso10816Evaluation {
  const v = Math.max(0, velocityMmS)
  let zone: Iso10816Zone
  if (v <= ISO10816_GROUP2_MM_S.aMax) zone = "A"
  else if (v <= ISO10816_GROUP2_MM_S.bMax) zone = "B"
  else if (v <= ISO10816_GROUP2_MM_S.cMax) zone = "C"
  else zone = "D"

  const meta = ZONE_META[zone]
  return {
    zone,
    zoneLabel: meta.label,
    velocityMmS: v,
    accelRmsInput: 0,
    inCompliance: meta.compliance,
    description: meta.description,
  }
}

export function evaluateIso10816FromAccelRms(
  accelRms: number,
  opts?: { unit?: "g" | "ms2"; nominalHz?: number },
): Iso10816Evaluation {
  const velocityMmS = accelRmsToVelocityMmS(accelRms, opts)
  const ev = evaluateIso10816Velocity(velocityMmS)
  return { ...ev, accelRmsInput: accelRms }
}

export function iso10816ZoneColor(zone: Iso10816Zone): string {
  return ZONE_META[zone].color
}

/** Puntos para gráfica de bandas (mm/s). */
export const ISO10816_BANDS_CHART = [
  { zone: "A" as const, from: 0, to: ISO10816_GROUP2_MM_S.aMax, label: "A" },
  { zone: "B" as const, from: ISO10816_GROUP2_MM_S.aMax, to: ISO10816_GROUP2_MM_S.bMax, label: "B" },
  { zone: "C" as const, from: ISO10816_GROUP2_MM_S.bMax, to: ISO10816_GROUP2_MM_S.cMax, label: "C" },
  { zone: "D" as const, from: ISO10816_GROUP2_MM_S.cMax, to: 22, label: "D" },
]
