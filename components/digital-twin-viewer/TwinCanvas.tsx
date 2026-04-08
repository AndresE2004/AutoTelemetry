"use client"

import { Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei"
import type { TwinTelemetryFrame } from "@/lib/digital-twin-types"
import { MotorcycleModel } from "@/components/digital-twin-viewer/MotorcycleModel"

type TwinCanvasProps = {
  telemetry: TwinTelemetryFrame | null
}

export function TwinCanvas({ telemetry }: TwinCanvasProps) {
  return (
    <div className="h-full min-h-[320px] w-full rounded-xl bg-gradient-to-b from-slate-950 to-slate-900">
      <Canvas shadows camera={{ position: [2.1, 1.35, 2.35], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={["#0b1220"]} />
        <ambientLight intensity={0.35} />
        <directionalLight castShadow position={[4, 8, 2]} intensity={1.15} shadow-mapSize={[1024, 1024]} />
        <spotLight position={[-3, 5, 1]} angle={0.35} penumbra={0.4} intensity={0.6} color="#60a5fa" />
        <MotorcycleModel telemetry={telemetry} />
        <ContactShadows opacity={0.45} scale={8} blur={2.2} far={4} position={[0, -0.01, 0]} />
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minPolarAngle={0.55}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={1.8}
          maxDistance={5}
        />
      </Canvas>
    </div>
  )
}
