'use client'
import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

const AUTHORITIES = [
  // UK
  'Donoghue v Stevenson',
  'Caparo v Dickman',
  'Hadley v Baxendale',
  'Rylands v Fletcher',
  'Carlill v Carbolic',
  'Salomon v Salomon',
  'Pepper v Hart',
  'Prest v Petrodel',
  // US
  'Marbury v Madison',
  'Brown v Board',
  'Miranda v Arizona',
  'Erie v Tompkins',
  'Palsgraf v LIRR',
  "Int'l Shoe v Washington",
  'Chevron v NRDC',
  'Roe v Wade',
]

function Graph() {
  const groupRef = useRef<THREE.Group>(null)
  const { mouse } = useThree()

  const nodes = useMemo(() => {
    const count = AUTHORITIES.length
    return AUTHORITIES.map((label, i) => {
      const phi = Math.acos(-1 + (2 * i) / count)
      const theta = Math.sqrt(count * Math.PI) * phi
      const r = 2.6
      return {
        pos: new THREE.Vector3(
          r * Math.cos(theta) * Math.sin(phi),
          r * Math.sin(theta) * Math.sin(phi),
          r * Math.cos(phi)
        ),
        label,
        uk: i < 8,
      }
    })
  }, [])

  const lineGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        if (nodes[i].pos.distanceTo(nodes[j].pos) < 2.3)
          pts.push(nodes[i].pos, nodes[j].pos)
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [nodes])

  useFrame((s) => {
    if (!groupRef.current) return
    const t = s.clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.06 + mouse.x * 0.4
    groupRef.current.rotation.x = mouse.y * 0.2
  })

  return (
    <group ref={groupRef}>
      <primitive object={new THREE.LineSegments(
        lineGeo,
        new THREE.LineBasicMaterial({ color: '#1a2e6e', transparent: true, opacity: 0.28 })
      )} />
      {nodes.map((n, i) => (
        <group key={i} position={n.pos}>
          <mesh>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshBasicMaterial color="#1a2e6e" />
          </mesh>
          <Billboard>
            <Text
              position={[0, 0.2, 0]}
              fontSize={0.12}
              color="#0a0a0a"
              anchorX="center"
              anchorY="middle"
              maxWidth={2.2}
              font="/fonts/Inter-Regular.woff"
            >
              {n.label}
            </Text>
          </Billboard>
        </group>
      ))}
      {/* Central node */}
      <mesh>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
    </group>
  )
}

export default function KnowledgeGraph() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <Graph />
      </Suspense>
    </Canvas>
  )
}
