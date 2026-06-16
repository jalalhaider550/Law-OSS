'use client'
import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

function ScalesOfJustice() {
  const groupRef = useRef<THREE.Group>(null)
  const leftPanRef = useRef<THREE.Mesh>(null)
  const rightPanRef = useRef<THREE.Mesh>(null)
  const { mouse } = useThree()

  const navyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a2e6e',
    metalness: 0.6,
    roughness: 0.2,
  }), [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = Math.sin(t * 0.2) * 0.3 + mouse.x * 0.2
    groupRef.current.rotation.x = mouse.y * 0.1
    if (leftPanRef.current && rightPanRef.current) {
      leftPanRef.current.position.y = Math.sin(t * 0.8) * 0.12 - 0.8
      rightPanRef.current.position.y = Math.cos(t * 0.8) * 0.12 - 0.8
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={1.2}>
      <mesh position={[0, -1.4, 0]} material={navyMat}>
        <cylinderGeometry args={[0.12, 0.18, 0.08, 16]} />
      </mesh>
      <mesh position={[0, -0.5, 0]} material={navyMat}>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 12]} />
      </mesh>
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} material={navyMat}>
        <cylinderGeometry args={[0.03, 0.03, 2.2, 12]} />
      </mesh>
      <mesh position={[0, 0.55, 0]} material={navyMat}>
        <sphereGeometry args={[0.09, 16, 16]} />
      </mesh>
      <mesh position={[-1.0, -0.15, 0]} material={navyMat}>
        <cylinderGeometry args={[0.02, 0.02, 0.62, 8]} />
      </mesh>
      <mesh position={[1.0, -0.15, 0]} material={navyMat}>
        <cylinderGeometry args={[0.02, 0.02, 0.62, 8]} />
      </mesh>
      <mesh ref={leftPanRef} position={[-1.0, -0.8, 0]} material={navyMat}>
        <cylinderGeometry args={[0.38, 0.38, 0.05, 24]} />
      </mesh>
      <mesh ref={rightPanRef} position={[1.0, -0.8, 0]} material={navyMat}>
        <cylinderGeometry args={[0.38, 0.38, 0.05, 24]} />
      </mesh>

      {([
        [1.4, 0.8, 0.3],
        [1.7, 0.2, -0.2],
        [1.5, -0.3, 0.4],
        [-1.3, 0.6, -0.3],
      ] as [number, number, number][]).map((pos, i) => (
        <Float key={i} speed={1.5 + i * 0.3} rotationIntensity={0.2} floatIntensity={0.4}>
          <mesh position={pos}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color="#3b5bdb" emissive="#1a2e6e" emissiveIntensity={0.5} />
          </mesh>
        </Float>
      ))}

      <mesh position={[1.25, 0.5, 0.1]}>
        <boxGeometry args={[0.35, 0.025, 0.025]} />
        <meshStandardMaterial color="#3b5bdb" emissive="#3b5bdb" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[1.5, 0.35, 0.1]}>
        <boxGeometry args={[0.025, 0.32, 0.025]} />
        <meshStandardMaterial color="#3b5bdb" emissive="#3b5bdb" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function Particles() {
  const ref = useRef<THREE.Points>(null)
  const count = 60

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2
    }
    return pos
  }, [])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.getElapsedTime() * 0.03
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#1a2e6e" transparent opacity={0.4} />
    </points>
  )
}

function OrbitRing() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = state.clock.getElapsedTime() * 0.15
      ref.current.rotation.x = 0.4
    }
  })
  return (
    <mesh ref={ref}>
      <torusGeometry args={[2.4, 0.02, 8, 80]} />
      <meshStandardMaterial color="#1a2e6e" transparent opacity={0.25} />
    </mesh>
  )
}

export default function Hero3D() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#3b5bdb" />
        <pointLight position={[0, 3, 2]} intensity={0.8} color="#1a2e6e" />
        <Suspense fallback={null}>
          <Float speed={1} rotationIntensity={0.1} floatIntensity={0.3}>
            <ScalesOfJustice />
          </Float>
          <Particles />
          <OrbitRing />
        </Suspense>
      </Canvas>
    </div>
  )
}
