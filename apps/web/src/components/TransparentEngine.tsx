'use client'
import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

const INNER_NODES = [
  { label: 'Models',          radius: 1.1, speed: 0.38, phase: 0,    yBand: 0.3  },
  { label: 'Citations',       radius: 1.3, speed: 0.27, phase: 1.05, yBand: -0.2 },
  { label: 'Agents',          radius: 0.95, speed: 0.45, phase: 2.09, yBand: 0.1  },
  { label: 'Rules Engine',    radius: 1.2, speed: 0.31, phase: 3.14, yBand: -0.3 },
  { label: 'Knowledge Graph', radius: 1.0, speed: 0.42, phase: 4.19, yBand: 0.25 },
  { label: 'Verification',    radius: 1.15, speed: 0.35, phase: 5.24, yBand: -0.1 },
]

function Engine() {
  const shellRef = useRef<THREE.Group>(null)
  const nodeRefs = useRef<THREE.Group[]>([])

  const wireframeMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#1a2e6e', wireframe: true, transparent: true, opacity: 0.18,
  }), [])

  useFrame((s) => {
    const t = s.clock.getElapsedTime()

    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.08
      shellRef.current.rotation.x = Math.sin(t * 0.06) * 0.12
    }

    INNER_NODES.forEach((n, i) => {
      const ref = nodeRefs.current[i]
      if (!ref) return
      const angle = t * n.speed + n.phase
      ref.position.set(
        Math.cos(angle) * n.radius,
        n.yBand + Math.sin(t * 0.3 + n.phase) * 0.12,
        Math.sin(angle) * n.radius,
      )
    })
  })

  return (
    <>
      {/* Glass shell */}
      <group ref={shellRef}>
        <mesh material={wireframeMat}>
          <icosahedronGeometry args={[1.9, 1]} />
        </mesh>
        {/* Inner edges for depth */}
        <primitive object={(() => {
          const g = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.9, 1))
          return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#1a2e6e', transparent: true, opacity: 0.35 }))
        })()} />
      </group>

      {/* Orbiting nodes */}
      {INNER_NODES.map((n, i) => (
        <group key={i} ref={el => { if (el) nodeRefs.current[i] = el }}>
          <mesh>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshBasicMaterial color="#1a2e6e" />
          </mesh>
          <Billboard>
            <Text
              position={[0, 0.2, 0]}
              fontSize={0.14}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              {n.label}
            </Text>
          </Billboard>
        </group>
      ))}
    </>
  )
}

export default function TransparentEngine() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <Engine />
      </Suspense>
    </Canvas>
  )
}
