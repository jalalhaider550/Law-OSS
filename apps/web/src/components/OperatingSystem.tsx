'use client'
import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const WORLDS = [
  { label: 'Research', color: '#4a6ee0', startPos: [-4.5, 1.5, -1] as [number,number,number], nodes: 8 },
  { label: 'Contracts', color: '#1a2e6e', startPos: [4.5, 1.5, -1] as [number,number,number], nodes: 6 },
  { label: 'Matters', color: '#2d4db0', startPos: [-4.5, -1.5, 1] as [number,number,number], nodes: 7 },
  { label: 'Compliance', color: '#8fa8ef', startPos: [4.5, -1.5, 1] as [number,number,number], nodes: 5 },
  { label: 'Due Diligence', color: '#c7d4f8', startPos: [0, 3, -2] as [number,number,number], nodes: 9 },
  { label: 'Litigation', color: '#0f1e5c', startPos: [0, -3, 2] as [number,number,number], nodes: 7 },
]

function World({ color, startPos, nodes, phase }: { color: string; startPos: [number,number,number]; nodes: number; phase: number }) {
  const groupRef = useRef<THREE.Group>(null)

  const nodePositions = useMemo(() => {
    const arr: [number,number,number][] = []
    for (let i = 0; i < nodes; i++) {
      const phi = Math.acos(-1 + (2 * i) / nodes)
      const theta = Math.sqrt(nodes * Math.PI) * phi
      arr.push([0.7 * Math.cos(theta) * Math.sin(phi), 0.7 * Math.sin(theta) * Math.sin(phi), 0.7 * Math.cos(phi)])
    }
    return arr
  }, [nodes])

  const lineGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < nodePositions.length; i++)
      for (let j = i + 1; j < nodePositions.length; j++) {
        const a = new THREE.Vector3(...nodePositions[i])
        const b = new THREE.Vector3(...nodePositions[j])
        if (a.distanceTo(b) < 1.0) { pts.push(a); pts.push(b) }
      }
    const g = new THREE.BufferGeometry(); g.setFromPoints(pts); return g
  }, [nodePositions])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    // Merge: worlds converge to center over the cycle
    const cycle = (t * 0.18) % 1  // 0→1 cycle
    const mergeFactor = Math.max(0, (cycle - 0.3) / 0.7)  // starts merging at 30% of cycle
    const eased = mergeFactor < 0.5 ? 2 * mergeFactor * mergeFactor : 1 - Math.pow(-2 * mergeFactor + 2, 2) / 2

    groupRef.current.position.set(
      startPos[0] * (1 - eased),
      startPos[1] * (1 - eased),
      startPos[2] * (1 - eased),
    )
    groupRef.current.rotation.y = t * 0.3 + phase
    groupRef.current.rotation.x = t * 0.15 + phase * 0.5
  })

  return (
    <group ref={groupRef} position={startPos}>
      <primitive object={new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 }))} />
      {nodePositions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[i === 0 ? 0.09 : 0.055, 12, 12]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

function CoreSphere() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    const cycle = (t * 0.18) % 1
    const show = Math.max(0, (cycle - 0.6) / 0.4)
    ref.current.scale.setScalar(show * 0.5)
  })
  return (
    <mesh ref={ref} scale={0}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  )
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.04
  })
  return (
    <group ref={groupRef}>
      {WORLDS.map((w, i) => (
        <World key={i} color={w.color} startPos={w.startPos} nodes={w.nodes} phase={i * 1.05} />
      ))}
      <CoreSphere />
    </group>
  )
}

export default function OperatingSystem() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}
