'use client'
import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

const EVENTS = [
  'Contract\nSigned',
  'Breach',
  'Letter Before\nAction',
  'Claim\nIssued',
  'Defence\nFiled',
  'Trial',
  'Judgment',
]

const SPACING = 1.6

function Spine() {
  const groupRef = useRef<THREE.Group>(null)

  const eventPositions = useMemo(() =>
    EVENTS.map((_, i) => new THREE.Vector3(i * SPACING - (EVENTS.length - 1) * SPACING / 2, 0, 0)),
  [])

  const spineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setFromPoints([
      new THREE.Vector3(-(EVENTS.length) * SPACING / 2, 0, 0),
      new THREE.Vector3((EVENTS.length) * SPACING / 2, 0, 0),
    ])
    return g
  }, [])

  // Thin document plane geometry (reused)
  const planeGeo = useMemo(() => new THREE.PlaneGeometry(0.55, 0.75), [])
  const planeMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: 0.08,
  }), [])
  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({
    color: '#1a2e6e', transparent: true, opacity: 0.5,
  }), [])

  useFrame((s) => {
    if (!groupRef.current) return
    const t = s.clock.getElapsedTime()
    // Slow camera-style travel along X
    groupRef.current.position.x = -((t * 0.25) % (EVENTS.length * SPACING)) + EVENTS.length * SPACING / 2 - SPACING
    groupRef.current.rotation.y = Math.sin(t * 0.08) * 0.06
  })

  return (
    <group ref={groupRef}>
      {/* Spine line */}
      <primitive object={new THREE.Line(
        spineGeo,
        new THREE.LineBasicMaterial({ color: '#1a2e6e', transparent: true, opacity: 0.35 })
      )} />

      {eventPositions.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Node */}
          <mesh>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial color="#1a2e6e" />
          </mesh>
          {/* Connector to document */}
          <primitive object={(() => {
            const g = new THREE.BufferGeometry()
            g.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.65, 0)])
            return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#1a2e6e', transparent: true, opacity: 0.3 }))
          })()} />
          {/* Floating document plane */}
          <mesh geometry={planeGeo} material={planeMat} position={[0, 1.05, 0]} />
          <primitive object={(() => {
            const g = new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.55, 0.75))
            return new THREE.LineSegments(g, edgeMat)
          })()} position={[0, 1.05, 0]} />
          {/* Label */}
          <Billboard>
            <Text
              position={[0, -0.32, 0]}
              fontSize={0.12}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              textAlign="center"
              maxWidth={1.4}
            >
              {EVENTS[i]}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  )
}

export default function TimelineTunnel() {
  return (
    <Canvas
      camera={{ position: [0, 1.2, 6], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <Spine />
      </Suspense>
    </Canvas>
  )
}
