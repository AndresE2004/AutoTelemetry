"use client"

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { TwinTelemetryFrame } from "@/lib/digital-twin-types"

type MotorcycleModelProps = {
  telemetry: TwinTelemetryFrame | null
}

/** Representación abstracta tipo moto (sin .glb): lista para sustituir por `useGLTF('/models/moto.glb')`. */
export function MotorcycleModel({ telemetry }: MotorcycleModelProps) {
  const root = useRef<THREE.Group>(null)
  const wheelFront = useRef<THREE.Mesh>(null)
  const wheelRear = useRef<THREE.Mesh>(null)

  const speed = telemetry?.speedKmh ?? 0
  const temp = telemetry?.engineTempC ?? 78
  const minPsi = telemetry
    ? Math.min(telemetry.tirePsi.fl, telemetry.tirePsi.fr, telemetry.tirePsi.rl, telemetry.tirePsi.rr)
    : 32
  const anomaly = telemetry?.anomalyActive ?? false

  const engineColor = useMemo(() => {
    const t = THREE.MathUtils.clamp((temp - 76) / 20, 0, 1)
    return new THREE.Color().setHSL(0.36 - t * 0.32, 0.82, 0.42)
  }, [temp])

  const pulse = useRef(0)
  useFrame((_, delta) => {
    const spin = Math.max(0.05, speed) * delta * 0.14
    wheelFront.current?.rotateX(spin)
    wheelRear.current?.rotateX(spin)
    pulse.current += delta * (anomaly ? 7 : 0.8)
    if (root.current) {
      const wobble = anomaly ? Math.sin(pulse.current) * 0.025 : 0
      root.current.rotation.z = wobble
    }
  })

  const tireSquash = minPsi < 28.5 ? 0.9 : minPsi < 30 ? 0.96 : 1
  const emissiveBoost = THREE.MathUtils.clamp((temp - 78) / 22, 0, 1)

  return (
    <group ref={root} position={[0, 0.4, 0]}>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.52, 0.32, 1.28]} />
        <meshStandardMaterial color="#283548" metalness={0.4} roughness={0.42} />
      </mesh>

      <mesh position={[0, 0.44, 0.32]} castShadow>
        <boxGeometry args={[0.36, 0.26, 0.4]} />
        <meshStandardMaterial
          color={engineColor}
          emissive={engineColor}
          emissiveIntensity={0.28 + emissiveBoost * 0.85}
          metalness={0.55}
          roughness={0.32}
        />
      </mesh>

      <mesh position={[0, 0.58, -0.12]} castShadow>
        <boxGeometry args={[0.38, 0.11, 0.52]} />
        <meshStandardMaterial color="#0f172a" roughness={0.92} />
      </mesh>

      <mesh position={[0, 0.4, 0.68]} castShadow>
        <boxGeometry args={[0.07, 0.42, 0.07]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.65} roughness={0.28} />
      </mesh>

      <mesh
        ref={wheelFront}
        position={[0, 0.22, 0.82]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        scale={[1, tireSquash, 1]}
      >
        <cylinderGeometry args={[0.21, 0.21, 0.11, 28]} />
        <meshStandardMaterial color="#0b1020" metalness={0.15} roughness={0.88} />
      </mesh>

      <mesh
        ref={wheelRear}
        position={[0, 0.22, -0.68]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        scale={[1, tireSquash, 1]}
      >
        <cylinderGeometry args={[0.21, 0.21, 0.11, 28]} />
        <meshStandardMaterial color="#0b1020" metalness={0.15} roughness={0.88} />
      </mesh>

      {anomaly ? (
        <mesh position={[0, 0.55, 0.05]}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.12} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}
