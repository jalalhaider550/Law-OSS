'use client'
import { useRef, useMemo, Suspense, useState } from 'react'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

// US Commercial Contract Negotiation — SaaS MSA redline battle
const CLAUSES = [
  { label: 'Limitation of Liability', yPos: 1.6, partyA: 0.82, partyB: 0.18,
    descA: 'Vendor (Party A): Cap at 12 months of fees paid in prior 12 months. Mutual exclusion of indirect, special, consequential, punitive damages. Carve-outs: indemnification obligations, IP infringement, gross negligence, willful misconduct. Standard SaaS position.',
    descB: 'Customer (Party B): Seeks uncapped liability for data breaches (CCPA/GDPR exposure), IP infringement, and death/personal injury. Proposes separate $10M sublimit for data security incidents. Rejects mutual consequential damages waiver for lost profits arising from service outage.' },
  { label: 'Data Processing / DPA', yPos: 0.8, partyA: 0.45, partyB: 0.55,
    descA: 'Vendor: Standard DPA with SCCs for EU transfers. Sub-processor list notification with 30-day objection window. Security obligations per ISO 27001. Breach notification: 72 hours to customer after confirmation.',
    descB: 'Customer (regulated financial institution): Requires vendor to comply with GLBA § 501(b) Safeguards Rule, CCPA service provider obligations, NYDFS Part 500, and SOC 2 Type II certification within 90 days. 24-hour breach notification. Audit rights 2x/year with 5 days notice.' },
  { label: 'IP Ownership / Work Product', yPos: 0.0, partyA: 0.28, partyB: 0.72,
    descA: 'Vendor: All underlying technology, platform, and improvements remain vendor IP. Work-for-hire doctrine: deliverables are licensed, not assigned. Customer data is customer\'s property. Vendor retains right to use aggregated, anonymized usage data for product improvement.',
    descB: 'Customer: All custom developments, integrations, and derivatives built on customer data must be assigned per written SOW. 17 U.S.C. § 101 work-for-hire: requires employee or written agreement for independent contractor — vendor must execute IP assignment. Rejects aggregated data carve-out as potential IP exfiltration.' },
  { label: 'Termination / SLAs', yPos: -0.8, partyA: 0.55, partyB: 0.45,
    descA: 'Vendor: 30-day cure period for any breach. Termination for convenience: 90-day notice, fees non-refundable. SLA: 99.5% uptime; service credits as sole remedy (max 30% of monthly fee). Force majeure: AWS/GCP outages are covered events.',
    descB: 'Customer: Termination for cause effective immediately upon uncured material breach or data breach. Termination for convenience: 30-day notice with pro-rata refund. SLA: 99.9% uptime; service credits up to 100% of monthly fee; persistent failures enable termination for cause. Force majeure carve-out rejected for cloud outages — vendor must maintain BCP.' },
  { label: 'Governing Law / Dispute', yPos: -1.6, partyA: 0.65, partyB: 0.35,
    descA: 'Vendor (DE Corp): Delaware law, JAMS arbitration in San Francisco, confidential, expedited rules for disputes <$500k. Loser pays fees provision. Class action waiver. Prevailing party attorneys\' fees.',
    descB: 'Customer (NY financial institution): New York law (SDNY exclusive jurisdiction), jury trial waived. Escalating dispute resolution: 30-day exec negotiation → mediation (JAMS) → litigation. No mandatory arbitration — public policy concerns for regulated entities. No class action waiver for employees.' },
]

interface NodeInfo { label: string; desc: string; x: number; y: number }

function ClausePlane({ clause, index, hovered, onHover, onClick }: {
  clause: typeof CLAUSES[0], index: number, hovered: boolean,
  onHover: (h: boolean) => void, onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const bias = clause.partyA - 0.5
  const xTarget = bias * 2.8

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    const floatY = clause.yPos + Math.sin(t * 0.8 + index * 0.9) * 0.06
    groupRef.current.position.set(xTarget, floatY, 0)
    if (hovered) {
      groupRef.current.scale.z = 1 + Math.sin(t * 6) * 0.05
    }
  })

  const color = hovered ? '#ffffff' : (clause.partyA > 0.6 ? '#999999' : clause.partyB > 0.6 ? '#666666' : '#888888')
  const opacity = hovered ? 0.9 : 0.55

  return (
    <group ref={groupRef} position={[xTarget, clause.yPos, 0]}>
      <mesh
        onPointerOver={e => { e.stopPropagation(); onHover(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { onHover(false); document.body.style.cursor = '' }}
        onClick={onClick}>
        <planeGeometry args={[3.8, 0.42]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={opacity} roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  )
}

function Scene({ onClauseClick }: { onClauseClick: (n: NodeInfo) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const { mouse } = useThree()
  const [hovered, setHovered] = useState<number | null>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = Math.sin(t * 0.12) * 0.18 + mouse.x * 0.15
    groupRef.current.rotation.x = mouse.y * 0.08
  })

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.7} />
      <pointLight position={[-5, 2, 3]} intensity={1.0} color="#ffffff" />
      <pointLight position={[5, -2, -3]} intensity={0.6} color="#aaaaff" />
      {/* Vendor sphere */}
      <mesh position={[-3.2, 0, 0]}>
        <sphereGeometry args={[0.28, 28, 28]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.8} emissive="#ffffff" emissiveIntensity={0.1} />
      </mesh>
      {/* Customer sphere */}
      <mesh position={[3.2, 0, 0]}>
        <sphereGeometry args={[0.28, 28, 28]} />
        <meshStandardMaterial color="#888888" roughness={0.2} metalness={0.7} />
      </mesh>
      {/* Center axis line */}
      <primitive object={(() => {
        const g = new THREE.BufferGeometry()
        g.setFromPoints([new THREE.Vector3(-2.9, 0, 0), new THREE.Vector3(2.9, 0, 0)])
        return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#444444', transparent: true, opacity: 0.3 }))
      })()} />
      {/* Clause planes */}
      {CLAUSES.map((cl, i) => (
        <ClausePlane key={i} clause={cl} index={i} hovered={hovered === i}
          onHover={h => setHovered(h ? i : null)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation(); e.nativeEvent.stopPropagation()
            const desc = cl.partyA > cl.partyB ? cl.descA : cl.descB
            onClauseClick({ label: cl.label, desc, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
          }} />
      ))}
    </group>
  )
}

export default function ContractNegotiation() {
  const [tooltip, setTooltip] = useState<NodeInfo | null>(null)
  const clickedRef = useRef(false)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={() => { if (clickedRef.current) { clickedRef.current = false; return }; setTooltip(null) }}>
      <Canvas camera={{ position: [0, 0, 7.5], fov: 45 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Scene onClauseClick={n => { clickedRef.current = true; setTooltip(n) }} />
        </Suspense>
      </Canvas>
      <div style={{ position: 'absolute', top: '50%', left: '3%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1.5, pointerEvents: 'none' }}>Vendor</div>
      <div style={{ position: 'absolute', top: '50%', right: '3%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1.5, pointerEvents: 'none' }}>Customer</div>
      {tooltip && (
        <div style={{ position: 'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 330), top: Math.max(8, tooltip.y - 8), zIndex: 1000, background: '#0a0a0a', color: '#fff', borderRadius: 10, padding: '14px 18px', maxWidth: 330, pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#888', marginBottom: 4, textTransform: 'uppercase' }}>CONTRACT CLAUSE</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tooltip.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>{tooltip.desc}</div>
        </div>
      )}
    </div>
  )
}
