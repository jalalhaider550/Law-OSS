'use client'
import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

const CLAUSES = [
  { label: 'Parties',        risk: false },
  { label: 'Term',           risk: false },
  { label: 'Termination',    risk: true  },
  { label: 'Liability',      risk: true  },
  { label: 'Indemnity',      risk: true  },
  { label: 'Confidentiality', risk: false },
  { label: 'IP Ownership',   risk: false },
  { label: 'Governing Law',  risk: false },
]

const GAP = 0.45

function Exploded() {
  const groupRef = useRef<THREE.Group>(null)
  const planeRefs = useRef<THREE.Mesh[]>([])

  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({
    color: '#1a2e6e', transparent: true, opacity: 0.45,
  }), [])

  useFrame((s) => {
    if (!groupRef.current) return
    const t = s.clock.getElapsedTime()
    // Breathing: 0 = closed, 1 = fully exploded
    const breath = (Math.sin(t * 0.5) + 1) / 2

    groupRef.current.rotation.y = Math.sin(t * 0.12) * 0.22

    planeRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const baseY = (i - (CLAUSES.length - 1) / 2) * GAP
      const cl = CLAUSES[i]
      const extra = cl.risk ? breath * 0.35 : breath * 0.18
      const riskForward = cl.risk ? breath * 0.18 : 0
      mesh.position.y = baseY + (i - (CLAUSES.length - 1) / 2) * extra
      mesh.position.z = riskForward
    })
  })

  return (
    <group ref={groupRef}>
      {CLAUSES.map((cl, i) => {
        const baseY = (i - (CLAUSES.length - 1) / 2) * GAP
        return (
          <group key={i}>
            <mesh
              ref={el => { if (el) planeRefs.current[i] = el }}
              position={[0, baseY, 0]}
            >
              <planeGeometry args={[3.2, 0.32]} />
              <meshBasicMaterial
                color={cl.risk ? '#1a2e6e' : '#ffffff'}
                side={THREE.DoubleSide}
                transparent
                opacity={cl.risk ? 0.7 : 0.12}
              />
            </mesh>
            {/* Edge outline */}
            <primitive
              object={(() => {
                const g = new THREE.EdgesGeometry(new THREE.PlaneGeometry(3.2, 0.32))
                return new THREE.LineSegments(g, edgeMat)
              })()}
              position={[0, baseY, 0]}
            />
            <Billboard position={[2.0, baseY, 0]}>
              <Text
                fontSize={0.13}
                color={cl.risk ? '#1a2e6e' : '#ffffff'}
                anchorX="left"
                anchorY="middle"
              >
                {cl.label}
                {cl.risk ? '  ⚑' : ''}
              </Text>
            </Billboard>
          </group>
        )
      })}
    </group>
  )
}

export default function ExplodedContract() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <Exploded />
      </Suspense>
    </Canvas>
  )
}
