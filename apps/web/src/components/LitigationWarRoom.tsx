'use client'
import { useRef, useMemo, Suspense, useState } from 'react'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

// US Federal Civil Litigation — evidence orbiting a live dispute
const SATELLITES = [
  { label: 'Deposition Testimony', type: 'witness', strength: 0.92, angle: 0, radius: 2.0, y: 0.3,
    desc: 'Fed. R. Civ. P. 30 deposition. 7-hour limit per deponent. Corporate witness designated under Rule 30(b)(6) must speak for the entity on noticed topics. Transcript admissible at trial under FRE 801(d)(1)(A) for prior inconsistent statements. Impeachment risk flagged.' },
  { label: 'MSA / Agreement', type: 'contract', strength: 1.0, angle: 1.05, radius: 1.8, y: 0.1,
    desc: 'Master Services Agreement dated March 14, 2023. Limitation of liability clause caps damages at 12 months of fees paid. Consequential damages waiver. Indemnification triggers on third-party IP claims. UCC Article 2 vs. common law classification in dispute — outcome affects implied warranty exposure.' },
  { label: 'Email / Slack Chain', type: 'email', strength: 0.74, angle: 2.1, radius: 2.2, y: -0.2,
    desc: 'Pre-contract communications showing actual knowledge of defect. Potentially admissible as party admissions under FRE 801(d)(2). "Without prejudice" label on later emails — disputed. ESI collected under Rule 26(b)(1) proportionality standard. Metadata authentication under FRE 901(b)(9).' },
  { label: 'Expert Report (Daubert)', type: 'expert', strength: 0.88, angle: 3.14, radius: 1.9, y: 0.4,
    desc: 'Engineering expert retained under FRCP 26(a)(2)(B). Daubert v. Merrell Dow (1993): judge as gatekeeper — testimony must rest on sufficient facts, reliable methodology, and fit the facts. Kumho Tire extends Daubert to non-scientific experts. Report confirms causation by preponderance of evidence.' },
  { label: 'Summary Judgment', type: 'filing', strength: 0.95, angle: 4.19, radius: 2.1, y: -0.3,
    desc: 'Rule 56 motion. No genuine dispute of material fact — movant entitled to judgment as a matter of law. Celotex Corp. v. Catrett (1986): burden shifts to non-movant once movant shows absence of evidence. Anderson v. Liberty Lobby: standard is same as directed verdict. Hearing set for 45 days.' },
  { label: 'Document Production', type: 'document', strength: 0.96, angle: 5.24, radius: 1.7, y: 0.2,
    desc: 'Rule 34 production of 2.4M documents. Tagged-image format per ESI Protocol. Predictive coding (TAR) approved by magistrate under proportionality analysis. Clawback agreement under FRE 502(d) protecting inadvertent waiver of privilege. Opposing counsel challenging custodian selection.' },
  { label: 'Site Inspection', type: 'evidence', strength: 0.82, angle: 0.52, radius: 2.3, y: -0.1,
    desc: 'Rule 34(a)(2) inspection of physical premises. Photographs authenticated under FRE 901. Chain of custody documented. Spoliation motion pending — key CCTV footage overwritten 30 days after incident (3 days before litigation hold). Adverse inference instruction sought under Rule 37(e)(2).' },
  { label: 'Class Certification', type: 'filing', strength: 0.78, angle: 1.57, radius: 2.0, y: 0.0,
    desc: 'Rule 23(a): numerosity, commonality, typicality, adequacy. Rule 23(b)(3): predominance and superiority. Wal-Mart v. Dukes (2011) tightened commonality — "common question" must generate common answer. CAFA (28 U.S.C. § 1332(d)) confers federal jurisdiction for class actions >$5M with minimal diversity.' },
]

const STRENGTH_COLORS: Record<string, string> = {
  witness: '#dddddd', contract: '#aaaaaa', email: '#888888',
  expert: '#cccccc', document: '#bbbbbb', evidence: '#999999', filing: '#ffffff',
}

interface NodeInfo { label: string; desc: string; x: number; y: number }

function SatelliteNode({ sat, index, hovered, onHover, onClick }: {
  sat: typeof SATELLITES[0], index: number, hovered: boolean,
  onHover: (h: boolean) => void, onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    const angle = sat.angle + t * (0.18 + sat.strength * 0.08)
    meshRef.current.position.set(
      Math.cos(angle) * sat.radius,
      sat.y + Math.sin(t * 0.4 + index) * 0.12,
      Math.sin(angle) * sat.radius,
    )
    if (hovered) meshRef.current.scale.setScalar(1.5)
    else meshRef.current.scale.setScalar(1 + Math.sin(t * 2 + index) * 0.06)
  })
  return (
    <mesh ref={meshRef}
      position={[Math.cos(sat.angle) * sat.radius, sat.y, Math.sin(sat.angle) * sat.radius]}
      onPointerOver={e => { e.stopPropagation(); onHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { onHover(false); document.body.style.cursor = '' }}
      onClick={onClick}>
      <sphereGeometry args={[sat.strength > 0.75 ? 0.13 : 0.09, 20, 20]} />
      <meshStandardMaterial
        color={STRENGTH_COLORS[sat.type]}
        emissive={STRENGTH_COLORS[sat.type]}
        emissiveIntensity={hovered ? 0.6 : 0.15}
        roughness={0.2} metalness={0.7}
      />
    </mesh>
  )
}

function Scene({ onNodeClick }: { onNodeClick: (n: NodeInfo) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const { mouse } = useThree()
  const [hovered, setHovered] = useState<number | null>(null)

  const lineGeos = useMemo(() => SATELLITES.map(s => {
    const g = new THREE.BufferGeometry()
    g.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(s.angle) * s.radius, s.y, Math.sin(s.angle) * s.radius)])
    return g
  }), [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.07 + mouse.x * 0.28
    groupRef.current.rotation.x = mouse.y * 0.1
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.3
      coreRef.current.rotation.x = t * 0.2
    }
  })

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 4]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-4, -4, -4]} intensity={0.3} color="#6688ff" />
      {/* Central dispute — wireframe icosahedron */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.38, 1]} />
        <meshStandardMaterial color="#ffffff" wireframe emissive="#ffffff" emissiveIntensity={0.2} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.25, 0]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.9} />
      </mesh>
      {/* Connection lines */}
      {lineGeos.map((g, i) => (
        <primitive key={i} object={new THREE.Line(g, new THREE.LineBasicMaterial({
          color: SATELLITES[i].strength > 0.8 ? '#aaaaaa' : '#555555',
          transparent: true, opacity: SATELLITES[i].strength * 0.45
        }))} />
      ))}
      {/* Orbiting evidence nodes */}
      {SATELLITES.map((sat, i) => (
        <SatelliteNode key={i} sat={sat} index={i} hovered={hovered === i}
          onHover={h => setHovered(h ? i : null)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation(); e.nativeEvent.stopPropagation()
            onNodeClick({ label: sat.label, desc: sat.desc, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
          }} />
      ))}
    </group>
  )
}

export default function LitigationWarRoom() {
  const [tooltip, setTooltip] = useState<NodeInfo | null>(null)
  const clickedRef = useRef(false)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={() => { if (clickedRef.current) { clickedRef.current = false; return }; setTooltip(null) }}>
      <Canvas camera={{ position: [0, 1, 6], fov: 45 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Scene onNodeClick={n => { clickedRef.current = true; setTooltip(n) }} />
        </Suspense>
      </Canvas>
      {tooltip && (
        <div style={{ position: 'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 320), top: Math.max(8, tooltip.y - 8), zIndex: 1000, background: '#0a0a0a', color: '#fff', borderRadius: 10, padding: '14px 18px', maxWidth: 320, pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#888', marginBottom: 4, textTransform: 'uppercase' }}>FEDERAL LITIGATION</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tooltip.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>{tooltip.desc}</div>
        </div>
      )}
    </div>
  )
}
