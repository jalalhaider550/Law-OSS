'use client'
import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

// Precedent cascade — parent → children citation chain
// Overruled = grey/dim. Good law = navy.
const CHAIN = [
  { label: 'Anns v Merton [1978]',            good: false, tier: 0, xOff: 0 },
  { label: 'Murphy v Brentwood [1991]',        good: true,  tier: 1, xOff: -0.6 },
  { label: 'Caparo v Dickman [1990]',          good: true,  tier: 1, xOff: 0.6 },
  { label: 'Marc Rich & Co v Bishop Rock',     good: true,  tier: 2, xOff: -1.1 },
  { label: 'Robinson v CC West Yorks [2018]',  good: true,  tier: 2, xOff: 0.0 },
  { label: 'James-Bowen v Met Police [2018]',  good: true,  tier: 2, xOff: 1.1 },
  { label: 'N v Poole BC [2019]',              good: true,  tier: 3, xOff: -0.5 },
  { label: 'CN v Poole BC [2019]',             good: true,  tier: 3, xOff: 0.5 },
]

const EDGES = [[0,1],[0,2],[1,3],[2,4],[2,5],[4,6],[5,7]]

const Y_PER_TIER = 1.5
const BASE_Y = 2.5

function Cascade() {
  const groupRef = useRef<THREE.Group>(null)

  const positions = useMemo(() =>
    CHAIN.map(n => new THREE.Vector3(n.xOff * 1.4, BASE_Y - n.tier * Y_PER_TIER, 0)),
  [])

  const lineGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (const [a, b] of EDGES) pts.push(positions[a], positions[b])
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [positions])

  useFrame((s) => {
    if (!groupRef.current) return
    const t = s.clock.getElapsedTime()
    // Slow downward drift — resets
    groupRef.current.position.y = -((t * 0.18) % 2.5)
    groupRef.current.rotation.y = Math.sin(t * 0.1) * 0.08
  })

  return (
    <group ref={groupRef}>
      <primitive object={new THREE.LineSegments(
        lineGeo,
        new THREE.LineBasicMaterial({ color: '#1a2e6e', transparent: true, opacity: 0.55 })
      )} />
      {CHAIN.map((n, i) => (
        <group key={i} position={positions[i]}>
          <mesh>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshBasicMaterial color={n.good ? '#1a2e6e' : '#555555'} />
          </mesh>
          <Billboard>
            <Text
              position={[0, 0.22, 0]}
              fontSize={0.13}
              color={n.good ? '#ffffff' : '#888888'}
              anchorX="center"
              anchorY="middle"
              maxWidth={2.8}
            >
              {n.label}
            </Text>
          </Billboard>
          {!n.good && (
            <Billboard>
              <Text
                position={[0, 0.42, 0]}
                fontSize={0.09}
                color="#666666"
                anchorX="center"
                anchorY="middle"
              >
                overruled
              </Text>
            </Billboard>
          )}
        </group>
      ))}
    </group>
  )
}

export default function CitationConstellation() {
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <Cascade />
      </Suspense>
    </Canvas>
  )
}
