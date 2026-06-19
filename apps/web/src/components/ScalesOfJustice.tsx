'use client'
import { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Scales() {
  const groupRef = useRef<THREE.Group>(null)
  const leftPanRef = useRef<THREE.Group>(null)
  const rightPanRef = useRef<THREE.Group>(null)
  const leftArmRef = useRef<THREE.Group>(null)
  const rightArmRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    // Slow gentle rotation of whole scene
    groupRef.current.rotation.y = Math.sin(t * 0.25) * 0.35

    // Tipping animation — scales gently tip back and forth
    const tilt = Math.sin(t * 0.6) * 0.22

    if (leftArmRef.current) leftArmRef.current.rotation.z = tilt
    if (rightArmRef.current) rightArmRef.current.rotation.z = tilt

    if (leftPanRef.current) {
      leftPanRef.current.position.y = -0.65 + Math.sin(t * 0.6) * 0.28
      leftPanRef.current.rotation.z = -tilt * 0.4
    }
    if (rightPanRef.current) {
      rightPanRef.current.position.y = -0.65 - Math.sin(t * 0.6) * 0.28
      rightPanRef.current.rotation.z = -tilt * 0.4
    }
  })

  const metalMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', roughness: 0.15, metalness: 0.95 })
  const goldMat = new THREE.MeshStandardMaterial({ color: '#d4a843', roughness: 0.1, metalness: 0.9 })
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.3, metalness: 0.7 })

  const chainPoints = (top: [number,number,number], bottom: [number,number,number]) => {
    const pts = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      pts.push(new THREE.Vector3(
        top[0] + (bottom[0] - top[0]) * t,
        top[1] + (bottom[1] - top[1]) * t + Math.sin(t * Math.PI) * -0.05,
        top[2],
      ))
    }
    return pts
  }

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 6, 4]} intensity={2.0} color="#ffffff" />
      <pointLight position={[-4, 2, -4]} intensity={0.5} color="#c8d8ff" />
      <spotLight position={[0, 8, 2]} intensity={1.5} angle={0.4} penumbra={0.5} color="#ffffff" />

      {/* Base */}
      <mesh position={[0, -2.6, 0]} material={darkMat}>
        <boxGeometry args={[1.2, 0.12, 0.5]} />
      </mesh>
      <mesh position={[0, -2.52, 0]} material={darkMat}>
        <boxGeometry args={[0.9, 0.1, 0.35]} />
      </mesh>

      {/* Pillar */}
      <mesh position={[0, -1.3, 0]} material={goldMat}>
        <cylinderGeometry args={[0.04, 0.055, 2.6, 16]} />
      </mesh>

      {/* Ornamental ring at top of pillar */}
      <mesh position={[0, 0.0, 0]} material={goldMat}>
        <torusGeometry args={[0.09, 0.025, 8, 24]} />
      </mesh>

      {/* Central pivot/top piece */}
      <mesh position={[0, 0.18, 0]} material={goldMat}>
        <sphereGeometry args={[0.1, 16, 16]} />
      </mesh>

      {/* Left arm */}
      <group ref={leftArmRef} position={[0, 0.18, 0]}>
        <mesh position={[-0.9, 0, 0]} material={goldMat}>
          <boxGeometry args={[1.8, 0.03, 0.03]} />
        </mesh>
        {/* Left arm tip */}
        <mesh position={[-1.8, 0, 0]} material={goldMat}>
          <sphereGeometry args={[0.04, 12, 12]} />
        </mesh>

        {/* Left chain (straight line approximation) */}
        <primitive object={(() => {
          const g = new THREE.BufferGeometry().setFromPoints(chainPoints([-1.8, 0, 0], [-1.8, -0.65, 0]))
          return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#c0c0c0' }))
        })()} />

        {/* Left pan */}
        <group ref={leftPanRef} position={[-1.8, -0.65, 0]}>
          <mesh material={metalMat}>
            <cylinderGeometry args={[0.42, 0.38, 0.05, 32]} />
          </mesh>
          <mesh position={[0, 0.025, 0]} material={metalMat}>
            <torusGeometry args={[0.39, 0.018, 8, 32]} />
          </mesh>
          {/* Left pan item — law book */}
          <mesh position={[0.05, 0.1, 0.05]} rotation={[0, 0.3, 0]} material={new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6, metalness: 0.1 })}>
            <boxGeometry args={[0.28, 0.14, 0.22]} />
          </mesh>
          <mesh position={[0.05, 0.175, 0.05]} rotation={[0, 0.3, 0]} material={new THREE.MeshStandardMaterial({ color: '#d4a843', roughness: 0.2, metalness: 0.6 })}>
            <boxGeometry args={[0.285, 0.01, 0.225]} />
          </mesh>
        </group>
      </group>

      {/* Right arm */}
      <group ref={rightArmRef} position={[0, 0.18, 0]}>
        <mesh position={[0.9, 0, 0]} material={goldMat}>
          <boxGeometry args={[1.8, 0.03, 0.03]} />
        </mesh>
        <mesh position={[1.8, 0, 0]} material={goldMat}>
          <sphereGeometry args={[0.04, 12, 12]} />
        </mesh>

        <primitive object={(() => {
          const g = new THREE.BufferGeometry().setFromPoints(chainPoints([1.8, 0, 0], [1.8, -0.65, 0]))
          return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#c0c0c0' }))
        })()} />

        {/* Right pan */}
        <group ref={rightPanRef} position={[1.8, -0.65, 0]}>
          <mesh material={metalMat}>
            <cylinderGeometry args={[0.42, 0.38, 0.05, 32]} />
          </mesh>
          <mesh position={[0, 0.025, 0]} material={metalMat}>
            <torusGeometry args={[0.39, 0.018, 8, 32]} />
          </mesh>
          {/* Right pan item — document */}
          <mesh position={[0, 0.08, 0]} material={new THREE.MeshStandardMaterial({ color: '#f5f0e8', roughness: 0.9, metalness: 0 })}>
            <boxGeometry args={[0.24, 0.01, 0.3]} />
          </mesh>
          <mesh position={[0.02, 0.095, 0.02]} material={new THREE.MeshStandardMaterial({ color: '#f5f0e8', roughness: 0.9, metalness: 0 })}>
            <boxGeometry args={[0.22, 0.01, 0.28]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export default function ScalesOfJustice() {
  return (
    <Canvas camera={{ position: [0, 0.5, 6], fov: 40 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
      <Suspense fallback={null}>
        <Scales />
      </Suspense>
    </Canvas>
  )
}
