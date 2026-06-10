"use client"

import type { RefObject } from "react"
import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { TwinTelemetryFrame } from "@/lib/digital-twin-types"
import { evaluateIso10816FromAccelRms, iso10816ZoneColor } from "@/lib/iso10816"

type Props = {
  telemetry: TwinTelemetryFrame | null
}

/** SUV procedural — Suzuki Grand Vitara LS 2009 (banco de pruebas, sin .glb). */
export function GrandVitaraModel({ telemetry }: Props) {
  const root = useRef<THREE.Group>(null)
  const engine = useRef<THREE.Group>(null)

  const vib = telemetry?.vibrationRms ?? 0
  const rpm = telemetry?.rpm ?? 0
  const anomaly = telemetry?.anomalyActive ?? false

  const iso = useMemo(
    () => (vib > 0 ? evaluateIso10816FromAccelRms(vib, { unit: "g", nominalHz: 50 }) : null),
    [vib],
  )

  const bodyColor = useMemo(() => new THREE.Color("#1e3a5f"), [])
  const accentColor = useMemo(() => new THREE.Color("#94a3b8"), [])

  const engineEmissive = useMemo(() => {
    if (!iso) return new THREE.Color("#334155")
    const c = new THREE.Color(iso10816ZoneColor(iso.zone))
    return c
  }, [iso])

  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({
        color: bodyColor,
        metalness: 0.45,
        roughness: 0.42,
      }),
      glass: new THREE.MeshStandardMaterial({
        color: "#bae6fd",
        metalness: 0.1,
        roughness: 0.05,
        transparent: true,
        opacity: 0.5,
      }),
      tire: new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.92 }),
      rim: new THREE.MeshStandardMaterial({ color: "#64748b", metalness: 0.75, roughness: 0.3 }),
      accent: new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.6, roughness: 0.35 }),
    }),
    [bodyColor, accentColor],
  )

  const engineMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#475569",
        emissive: engineEmissive,
        emissiveIntensity: anomaly ? 0.85 : 0.35 + Math.min(0.5, vib * 0.4),
        metalness: 0.55,
        roughness: 0.35,
      }),
    [engineEmissive, anomaly, vib],
  )

  const pulse = useRef(0)

  useFrame((_, delta) => {
    pulse.current += delta * (anomaly ? 8 : 2)
    const shake =
      vib > 0
        ? Math.sin(pulse.current * (12 + vib * 8)) * Math.min(0.04, vib * 0.025)
        : 0
    if (engine.current) {
      engine.current.position.x = shake
      engine.current.position.y = shake * 0.4
    }
    if (root.current && anomaly) {
      root.current.rotation.z = Math.sin(pulse.current) * 0.012
    } else if (root.current) {
      root.current.rotation.z = 0
    }
  })

  function Wheel({ x, z, refWheel }: { x: number; z: number; refWheel?: RefObject<THREE.Group | null> }) {
    return (
      <group ref={refWheel} position={[x, 0.28, z]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 28]} />
          <primitive object={mats.tire} attach="material" />
        </mesh>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.24, 20]} />
          <primitive object={mats.rim} attach="material" />
        </mesh>
      </group>
    )
  }

  return (
    <group ref={root} position={[0, 0.05, 0]}>
      <Wheel x={-0.72} z={0.95} />
      <Wheel x={0.72} z={0.95} />
      <Wheel x={-0.72} z={-0.88} />
      <Wheel x={0.72} z={-0.88} />

      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.55, 0.55, 3.35]} />
        <primitive object={mats.body} attach="material" />
      </mesh>

      <mesh position={[0, 0.92, 0.35]} castShadow>
        <boxGeometry args={[1.42, 0.42, 1.45]} />
        <primitive object={mats.body} attach="material" />
      </mesh>

      <mesh position={[0, 0.88, 1.05]} castShadow>
        <boxGeometry args={[1.38, 0.38, 0.08]} />
        <primitive object={mats.glass} attach="material" />
      </mesh>
      <mesh position={[0, 0.88, -0.35]} castShadow>
        <boxGeometry args={[1.38, 0.38, 0.08]} />
        <primitive object={mats.glass} attach="material" />
      </mesh>

      <group ref={engine} position={[0, 0.48, 0.55]}>
        <mesh castShadow>
          <boxGeometry args={[0.55, 0.38, 0.62]} />
          <primitive object={engineMat} attach="material" />
        </mesh>
      </group>

      <mesh position={[0, 0.5, -1.45]} castShadow>
        <boxGeometry args={[1.5, 0.12, 0.2]} />
        <primitive object={mats.accent} attach="material" />
      </mesh>

      {anomaly ? (
        <mesh position={[0, 0.7, 0]}>
          <sphereGeometry args={[1.1, 16, 16]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.08} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}
