'use client'
import { useRef, Suspense, useState } from 'react'
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

const INFO_POINTS = [
  { pos: [0, 2.8, 1.2] as [number,number,number], label: 'U.S. Supreme Court', desc: 'One First Street NE, Washington D.C. Nine Justices. Est. 1790. Hears ~70 cases/year. Judicial review power established in Marbury v. Madison (1803). The court\'s decisions are binding on all federal and state courts in the United States.' },
  { pos: [-2.2, 0.5, 1.0] as [number,number,number], label: 'West Entrance (Public)', desc: 'Public access since 1935. Visitors may observe oral arguments (October–June Term). Arguments limited to 30 minutes per side. Over 7,000 cert petitions filed annually — fewer than 1% granted. The "Rule of Four": four Justices must vote to grant certiorari.' },
  { pos: [2.2, 0.5, 1.0] as [number,number,number], label: 'East Conference Wing', desc: 'Weekly conference room where Justices vote on cert petitions and pending cases in complete secrecy — no law clerks, no staff. Majority, concurring, and dissenting opinions drafted here. Average ~9 months from argument to decision. "Equal Justice Under Law" — main inscription.' },
  { pos: [0, -0.5, 1.2] as [number,number,number], label: 'Great Hall / Steps', desc: 'Iconic marble steps — 36 columns representing the 36 states at time of Chief Justice Taft\'s tenure. "Equal Justice Under Law" inscribed above entrance. The steps are a constitutional forum: First Amendment assembly and petition rights guaranteed even on courthouse steps.' },
]

function Building({ onPointClick }: { onPointClick: (info: { label: string; desc: string; x: number; y: number }) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = Math.sin(t * 0.15) * 0.4
  })

  const stoneMat = new THREE.MeshStandardMaterial({ color: '#e8e4d8', roughness: 0.7, metalness: 0.05 })
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#c8c4b4', roughness: 0.8, metalness: 0.02 })
  const roofMat = new THREE.MeshStandardMaterial({ color: '#d0ccc0', roughness: 0.6, metalness: 0.1 })
  const doorMat = new THREE.MeshStandardMaterial({ color: '#1a1408', roughness: 0.4, metalness: 0.3 })
  const windowMat = new THREE.MeshStandardMaterial({ color: '#8ab0c8', roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.7 })

  // Column positions (front row)
  const columnX = [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8]

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={1.8} castShadow color="#fff8f0" />
      <directionalLight position={[-5, 4, -5]} intensity={0.4} color="#c8d8ff" />
      <pointLight position={[0, 5, 8]} intensity={0.8} color="#fff5e0" />

      {/* Foundation / Steps */}
      <mesh position={[0, -2.2, 0]} material={darkStoneMat}>
        <boxGeometry args={[5.8, 0.2, 3.0]} />
      </mesh>
      <mesh position={[0, -2.0, 0.15]} material={darkStoneMat}>
        <boxGeometry args={[5.2, 0.18, 2.8]} />
      </mesh>
      <mesh position={[0, -1.82, 0.25]} material={stoneMat}>
        <boxGeometry args={[4.8, 0.16, 2.6]} />
      </mesh>
      <mesh position={[0, -1.67, 0.32]} material={stoneMat}>
        <boxGeometry args={[4.5, 0.14, 2.4]} />
      </mesh>

      {/* Main body */}
      <mesh position={[0, -0.2, -0.3]} material={stoneMat}>
        <boxGeometry args={[4.4, 3.0, 1.8]} />
      </mesh>

      {/* Front face detail strip */}
      <mesh position={[0, 1.1, 0.6]} material={stoneMat}>
        <boxGeometry args={[4.4, 0.22, 0.08]} />
      </mesh>

      {/* Columns */}
      {columnX.map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.1, 0.7]} material={stoneMat}>
            <cylinderGeometry args={[0.1, 0.11, 3.2, 16]} />
          </mesh>
          {/* Column capital */}
          <mesh position={[x, 1.7, 0.7]} material={stoneMat}>
            <boxGeometry args={[0.26, 0.16, 0.26]} />
          </mesh>
          {/* Column base */}
          <mesh position={[x, -1.5, 0.7]} material={stoneMat}>
            <boxGeometry args={[0.24, 0.14, 0.24]} />
          </mesh>
        </group>
      ))}

      {/* Entablature (frieze) */}
      <mesh position={[0, 1.85, 0.5]} material={stoneMat}>
        <boxGeometry args={[4.6, 0.3, 0.4]} />
      </mesh>

      {/* Pediment (triangular roof front) */}
      <mesh position={[0, 2.35, 0.55]} material={roofMat} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0, 2.5, 1.0, 4, 1]} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, 1.92, -0.3]} material={roofMat}>
        <boxGeometry args={[4.7, 0.1, 2.2]} />
      </mesh>

      {/* Main door */}
      <mesh position={[0, -0.9, 0.61]} material={doorMat}>
        <boxGeometry args={[0.55, 1.1, 0.04]} />
      </mesh>

      {/* Windows */}
      {[-1.5, -0.8, 0.8, 1.5].map((x, i) => (
        <mesh key={i} position={[x, -0.6, 0.61]} material={windowMat}>
          <boxGeometry args={[0.28, 0.72, 0.03]} />
        </mesh>
      ))}

      {/* Side windows upper */}
      {[-1.5, -0.8, 0.8, 1.5].map((x, i) => (
        <mesh key={i} position={[x, 0.3, 0.61]} material={windowMat}>
          <boxGeometry args={[0.28, 0.5, 0.03]} />
        </mesh>
      ))}

      {/* Info hotspot spheres */}
      {INFO_POINTS.map((pt, i) => (
        <mesh key={i} position={pt.pos}
          onPointerOver={e => { e.stopPropagation(); setHovered(i); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { setHovered(null); document.body.style.cursor = '' }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation(); e.nativeEvent.stopPropagation()
            onPointClick({ label: pt.label, desc: pt.desc, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
          }}>
          <sphereGeometry args={[hovered === i ? 0.14 : 0.1, 16, 16]} />
          <meshStandardMaterial color={hovered === i ? '#ffffff' : '#d4a843'} emissive={hovered === i ? '#ffffff' : '#d4a843'} emissiveIntensity={0.5} roughness={0.1} metalness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

export default function Courthouse({ height = 520 }: { height?: number }) {
  const [tooltip, setTooltip] = useState<{ label: string; desc: string; x: number; y: number } | null>(null)
  const clickedRef = useRef(false)
  return (
    <div style={{ position: 'relative', width: '100%', height }} onClick={() => { if (clickedRef.current) { clickedRef.current = false; return }; setTooltip(null) }}>
      <Canvas camera={{ position: [0, 1, 7.5], fov: 42 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Building onPointClick={info => { clickedRef.current = true; setTooltip(info) }} />
        </Suspense>
      </Canvas>
      {tooltip && (
        <div style={{ position: 'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 330), top: Math.max(8, tooltip.y - 8), zIndex: 1000, background: '#0a0a0a', color: '#fff', borderRadius: 10, padding: '14px 18px', maxWidth: 330, pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#d4a843', marginBottom: 4, textTransform: 'uppercase' }}>US SUPREME COURT</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tooltip.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>{tooltip.desc}</div>
        </div>
      )}
    </div>
  )
}
