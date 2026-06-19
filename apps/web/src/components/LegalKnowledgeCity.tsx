'use client'
import { useRef, useMemo, Suspense, useState } from 'react'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

// Buildings = cases, Roads = statutes, Infrastructure = regulations
const BUILDINGS = [
  { x: 0, z: 0, h: 1.8, w: 0.5, label: 'Donoghue v Stevenson', desc: '[1932] AC 562. The neighbour principle. Foundation of modern negligence. Every building in this city stands on this case.' },
  { x: 1.2, z: 0.3, h: 1.1, w: 0.4, label: 'Caparo v Dickman', desc: '[1990] 2 AC 605. Three-part test: foreseeability, proximity, fair/just/reasonable. The planning code of negligence law.' },
  { x: -1.1, z: 0.5, h: 0.8, w: 0.35, label: 'Hedley Byrne v Heller', desc: '[1964] AC 465. Negligent misstatement. Assumption of responsibility. The financial district of tortious liability.' },
  { x: 2.2, z: 1.0, h: 1.4, w: 0.45, label: 'Salomon v Salomon', desc: '[1897] AC 22. The corporate veil. Separate legal personality. Every company building rests on this foundation.' },
  { x: -2.0, z: 0.8, h: 0.9, w: 0.4, label: 'Carlill v Carbolic', desc: '[1893] 1 QB 256. Offer to the world. Acceptance by performance. The contract law commercial district.' },
  { x: 0.6, z: -1.5, h: 1.2, w: 0.4, label: 'R (Miller) v SOSS', desc: '[2017] UKSC 5. Parliamentary sovereignty. The constitution building — government cannot use prerogative to frustrate Parliament.' },
  { x: -0.8, z: -1.6, h: 0.7, w: 0.35, label: 'Wednesbury', desc: '[1948] 1 KB 223. Unreasonableness in administrative decisions. The judicial review courthouse — every public law challenge starts here.' },
  { x: 1.8, z: -1.0, h: 0.6, w: 0.3, label: 'High Trees', desc: '[1947] KB 130. Promissory estoppel. The equity bridge — a clear promise not to enforce strict rights can bind.' },
  { x: -1.8, z: -0.8, h: 0.5, w: 0.3, label: 'Entick v Carrington', desc: '(1765) 19 St Tr 1029. No entry without authority. The oldest building — foundation of the rule of law itself.' },
  { x: 2.8, z: 0.2, h: 0.7, w: 0.3, label: 'Rylands v Fletcher', desc: '(1868) LR 3 HL 330. Strict liability. Non-natural use of land. The industrial quarter of tort law.' },
  { x: -2.8, z: -0.2, h: 0.6, w: 0.3, label: 'Balfour v Balfour', desc: '[1919] 2 KB 571. Intention to create legal relations. The domestic law district — social agreements are not contracts.' },
  { x: 0.3, z: 2.0, h: 1.0, w: 0.4, label: 'Hunter v Canary Wharf', desc: '[1997] AC 655. Only those with proprietary interest can sue in nuisance. The planning and property district.' },
]

interface NodeInfo { label: string; desc: string; x: number; y: number }

function City({ onBuildingClick }: { onBuildingClick: (n: NodeInfo) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const { mouse } = useThree()
  const [hovered, setHovered] = useState<number | null>(null)

  // Road grid geometry
  const roadGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let x = -3.5; x <= 3.5; x += 1.0) { pts.push(new THREE.Vector3(x, -0.01, -3.5)); pts.push(new THREE.Vector3(x, -0.01, 3.5)) }
    for (let z = -3.5; z <= 3.5; z += 1.0) { pts.push(new THREE.Vector3(-3.5, -0.01, z)); pts.push(new THREE.Vector3(3.5, -0.01, z)) }
    const g = new THREE.BufferGeometry(); g.setFromPoints(pts); return g
  }, [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.06 + mouse.x * 0.25
    groupRef.current.rotation.x = 0.3 + mouse.y * 0.08
  })

  return (
    <group ref={groupRef}>
      {/* Road grid = statutes */}
      <primitive object={new THREE.LineSegments(roadGeo, new THREE.LineBasicMaterial({ color: '#1a2e6e', transparent: true, opacity: 0.18 }))} />
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[7, 7]} />
        <meshBasicMaterial color="#0a0f1e" transparent opacity={0.3} />
      </mesh>
      {/* Buildings = cases */}
      {BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]}
          onPointerOver={e => { e.stopPropagation(); setHovered(i); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { setHovered(null); document.body.style.cursor = '' }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation(); e.nativeEvent.stopPropagation()
            onBuildingClick({ label: b.label, desc: b.desc, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
          }}>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshBasicMaterial color={hovered === i ? '#ffffff' : (i === 0 ? '#f8faff' : '#1a2e6e')} transparent opacity={hovered === i ? 0.95 : 0.75} />
        </mesh>
      ))}
      {/* Building wireframes */}
      {BUILDINGS.map((b, i) => (
        <mesh key={`e${i}`} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshBasicMaterial color="#4a6ee0" wireframe transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  )
}

export default function LegalKnowledgeCity() {
  const [tooltip, setTooltip] = useState<NodeInfo | null>(null)
  const clickedRef = useRef(false)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={() => { if (clickedRef.current) { clickedRef.current = false; return }; setTooltip(null) }}>
      <Canvas camera={{ position: [0, 3, 7], fov: 50 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <City onBuildingClick={n => { clickedRef.current = true; setTooltip(n) }} />
        </Suspense>
      </Canvas>
      {tooltip && (
        <div style={{ position: 'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 300), top: tooltip.y - 8, zIndex: 1000, background: '#0a0a0a', color: '#fff', borderRadius: 8, padding: '14px 18px', maxWidth: 300, pointerEvents: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, fontStyle: 'italic' }}>{tooltip.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{tooltip.desc}</div>
        </div>
      )}
    </div>
  )
}
