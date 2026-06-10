"use client"

import type { RefObject } from "react"
import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { TwinTelemetryFrame } from "@/lib/digital-twin-types"

type MotorcycleModelProps = {
  telemetry: TwinTelemetryFrame | null
}

type BikeMats = {
  paint: THREE.MeshStandardMaterial
  paintAccent: THREE.MeshStandardMaterial
  chrome: THREE.MeshStandardMaterial
  rubber: THREE.MeshStandardMaterial
  rim: THREE.MeshStandardMaterial
  seat: THREE.MeshStandardMaterial
  exhaust: THREE.MeshStandardMaterial
  darkMatte: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
}

function WheelAssembly({
  groupRef,
  sideScale,
  mats,
  wheelRadius,
  tireWidth,
  rimRadius,
}: {
  groupRef: RefObject<THREE.Group | null>
  sideScale: number
  mats: BikeMats
  wheelRadius: number
  tireWidth: number
  rimRadius: number
}) {
  return (
    <group ref={groupRef} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow receiveShadow scale={[sideScale, 1, 1]}>
        <cylinderGeometry args={[wheelRadius, wheelRadius, tireWidth, 36]} />
        <primitive object={mats.rubber} attach="material" />
      </mesh>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[rimRadius, rimRadius, tireWidth + 0.02, 28]} />
        <primitive object={mats.rim} attach="material" />
      </mesh>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rimRadius * 0.72, 0.012, 8, 24]} />
        <primitive object={mats.chrome} attach="material" />
      </mesh>
      <mesh castShadow>
        <cylinderGeometry args={[0.045, 0.04, tireWidth + 0.06, 16]} />
        <primitive object={mats.darkMatte} attach="material" />
      </mesh>
    </group>
  )
}

export function MotorcycleModel({ telemetry }: MotorcycleModelProps) {
  const root = useRef<THREE.Group>(null)
  const wheelFront = useRef<THREE.Group>(null)
  const wheelRear = useRef<THREE.Group>(null)
  const engineBlock = useRef<THREE.Group>(null)

  const speed = telemetry?.speedKmh ?? 0
  const temp = telemetry?.engineTempC ?? 78
  const rpm = telemetry?.rpm ?? 0
  const minPsi = telemetry
    ? Math.min(telemetry.tirePsi.fl, telemetry.tirePsi.fr, telemetry.tirePsi.rl, telemetry.tirePsi.rr)
    : 32
  const anomaly = telemetry?.anomalyActive ?? false

  const engineColor = useMemo(() => {
    const t = THREE.MathUtils.clamp((temp - 76) / 20, 0, 1)
    return new THREE.Color().setHSL(0.36 - t * 0.32, 0.82, 0.42)
  }, [temp])

  const mats = useMemo(
    () => ({
      paint: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1c2d4a"),
        metalness: 0.55,
        roughness: 0.38,
        envMapIntensity: 0.9,
      }),
      paintAccent: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0ea5e9"),
        metalness: 0.35,
        roughness: 0.45,
        envMapIntensity: 0.85,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#e2e8f0"),
        metalness: 0.92,
        roughness: 0.18,
        envMapIntensity: 1.1,
      }),
      rubber: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0c0f18"),
        metalness: 0.08,
        roughness: 0.94,
      }),
      rim: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#334155"),
        metalness: 0.78,
        roughness: 0.28,
      }),
      seat: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#141008"),
        metalness: 0.12,
        roughness: 0.88,
      }),
      exhaust: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#64748b"),
        metalness: 0.82,
        roughness: 0.32,
      }),
      darkMatte: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0f172a"),
        metalness: 0.2,
        roughness: 0.78,
      }),
      glass: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#bae6fd"),
        metalness: 0.15,
        roughness: 0.08,
        transparent: true,
        opacity: 0.55,
        emissive: new THREE.Color("#38bdf8"),
        emissiveIntensity: 0.15,
      }),
    }),
    [],
  )

  const pulse = useRef(0)
  const rpmPhase = useRef(0)

  useFrame((_, delta) => {
    const spin = Math.max(0.05, speed) * delta * 0.14
    wheelFront.current?.rotateY(spin)
    wheelRear.current?.rotateY(spin)

    pulse.current += delta * (anomaly ? 7 : 0.8)
    rpmPhase.current += delta * (rpm / 1200) * Math.PI * 2

    if (root.current) {
      const wobble = anomaly ? Math.sin(pulse.current) * 0.028 : 0
      root.current.rotation.z = wobble
    }

    if (engineBlock.current && rpm > 400) {
      const v = Math.sin(rpmPhase.current) * THREE.MathUtils.clamp(rpm / 9000, 0, 1) * 0.0022
      engineBlock.current.position.x = v
      engineBlock.current.position.y = v * 0.35
    } else if (engineBlock.current) {
      engineBlock.current.position.set(0, 0, 0)
    }
  })

  const tireSquash = minPsi < 28.5 ? 0.88 : minPsi < 30 ? 0.95 : 1
  const emissiveBoost = THREE.MathUtils.clamp((temp - 78) / 22, 0, 1)

  const engineMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: engineColor,
        emissive: engineColor,
        emissiveIntensity: 0.22 + emissiveBoost * 0.95,
        metalness: 0.62,
        roughness: 0.3,
      }),
    [engineColor, emissiveBoost],
  )

  const wheelRadius = 0.24
  const tireWidth = 0.1
  const rimRadius = 0.155

  return (
    <group ref={root} position={[0, 0.42, 0]} rotation={[0, Math.PI * 0.04, 0]}>
      {/* Ruedas */}
      <group position={[0, wheelRadius, 0.78]}>
        <WheelAssembly
          groupRef={wheelFront}
          sideScale={tireSquash}
          mats={mats}
          wheelRadius={wheelRadius}
          tireWidth={tireWidth}
          rimRadius={rimRadius}
        />
      </group>
      <group position={[0, wheelRadius, -0.72]}>
        <WheelAssembly
          groupRef={wheelRear}
          sideScale={tireSquash}
          mats={mats}
          wheelRadius={wheelRadius}
          tireWidth={tireWidth}
          rimRadius={rimRadius}
        />
      </group>

      {/* Guardabarros */}
      <mesh position={[0, 0.52, 0.78]} rotation={[0.22, 0, 0]} castShadow>
        <boxGeometry args={[0.22, 0.04, 0.26]} />
        <primitive object={mats.paint} attach="material" />
      </mesh>
      <mesh position={[0, 0.5, -0.72]} rotation={[-0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.24, 0.04, 0.28]} />
        <primitive object={mats.paint} attach="material" />
      </mesh>

      {/* Basculante */}
      <mesh position={[0, 0.38, -0.38]} rotation={[0.52, 0, 0]} castShadow>
        <boxGeometry args={[0.1, 0.06, 0.52]} />
        <primitive object={mats.chrome} attach="material" />
      </mesh>

      {/* Motor + cárter (grupo interno para vibración RPM sin perder offset del padre) */}
      <group position={[0, 0.46, 0.06]}>
        <group ref={engineBlock}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.34, 0.28, 0.38]} />
            <primitive object={engineMat} attach="material" />
          </mesh>
          <mesh position={[0, -0.2, 0.02]} castShadow receiveShadow>
            <boxGeometry args={[0.3, 0.12, 0.42]} />
            <primitive object={mats.darkMatte} attach="material" />
          </mesh>
          {[0, 1].map((i) => (
            <mesh key={i} position={[-0.07 + i * 0.14, 0.06, 0.22]} castShadow>
              <cylinderGeometry args={[0.055, 0.055, 0.12, 14]} />
              <primitive object={mats.chrome} attach="material" />
            </mesh>
          ))}
        </group>
      </group>

      {/* Chasis / tubo principal */}
      <mesh position={[0, 0.62, -0.02]} rotation={[0.95, 0, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.95, 10]} />
        <primitive object={mats.chrome} attach="material" />
      </mesh>
      <mesh position={[0, 0.58, 0.28]} rotation={[1.25, 0, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.55, 10]} />
        <primitive object={mats.chrome} attach="material" />
      </mesh>

      {/* Depósito */}
      <mesh position={[0, 0.78, 0.22]} castShadow receiveShadow scale={[0.48, 0.32, 0.62]}>
        <sphereGeometry args={[0.42, 28, 22]} />
        <primitive object={mats.paint} attach="material" />
      </mesh>
      <mesh position={[0.22, 0.76, 0.18]} rotation={[0, 0, 0.35]} castShadow>
        <boxGeometry args={[0.06, 0.18, 0.14]} />
        <primitive object={mats.paintAccent} attach="material" />
      </mesh>

      {/* Asiento */}
      <mesh position={[0, 0.72, -0.28]} rotation={[-0.12, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.26, 0.1, 0.42]} />
        <primitive object={mats.seat} attach="material" />
      </mesh>

      {/* Horquilla doble */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.52, 0.72]} rotation={[0.08, 0, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.022, 0.62, 10]} />
          <primitive object={mats.chrome} attach="material" />
        </mesh>
      ))}

      {/* Manillar */}
      <group position={[0, 0.88, 0.38]}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.62, 10]} />
          <primitive object={mats.darkMatte} attach="material" />
        </mesh>
        <mesh position={[-0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.06, 0.05, 0.05]} />
          <primitive object={mats.rubber} attach="material" />
        </mesh>
        <mesh position={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.06, 0.05, 0.05]} />
          <primitive object={mats.rubber} attach="material" />
        </mesh>
      </group>

      {/* Faro */}
      <mesh position={[0, 0.68, 0.62]} castShadow>
        <sphereGeometry args={[0.11, 20, 16]} />
        <primitive object={mats.glass} attach="material" />
      </mesh>
      <mesh position={[0, 0.68, 0.58]} castShadow>
        <torusGeometry args={[0.1, 0.018, 10, 28]} />
        <primitive object={mats.chrome} attach="material" />
      </mesh>

      {/* Escape */}
      <mesh position={[0.16, 0.42, -0.12]} rotation={[0, 0, -0.35]} castShadow>
        <cylinderGeometry args={[0.04, 0.048, 0.72, 14]} />
        <primitive object={mats.exhaust} attach="material" />
      </mesh>
      <mesh position={[0.2, 0.38, -0.52]} castShadow>
        <sphereGeometry args={[0.055, 14, 14]} />
        <primitive object={mats.exhaust} attach="material" />
      </mesh>

      {/* Cubre-cadena / lateral */}
      <mesh position={[-0.2, 0.4, -0.15]} rotation={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.05, 0.22, 0.38]} />
        <primitive object={mats.paint} attach="material" />
      </mesh>

      {anomaly ? (
        <mesh position={[0, 0.62, 0.02]}>
          <sphereGeometry args={[0.62, 20, 20]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.1} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}
