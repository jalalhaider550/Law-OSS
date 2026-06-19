'use client'
import { useRef, useMemo, Suspense, useState } from 'react'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

// US Regulatory Compliance Hub
const CENTER = {
  label: 'US Regulatory Stack',
  desc: 'Federal regulatory framework governing US businesses. Law OSS maps your entity\'s exposure across SEC, FTC, DOJ, CFPB, OSHA, EPA, and sector-specific regulators. AI-powered compliance gap analysis identifies violations before they become enforcement actions.',
}

const NODES = [
  { label: 'SEC / SOX', angle: 0, r: 1.7, y: 0.3, isRisk: false,
    desc: 'Sarbanes-Oxley Act (2002): CEO/CFO certifications (§ 302, § 906), internal controls (§ 404), audit committee independence, real-time disclosure. SEC Reg FD (17 CFR § 243): prohibits selective disclosure to analysts. Rule 10b-5: anti-fraud. Form 8-K: 4 business days to disclose material events. Penalty: up to $5M + 20 years.' },
  { label: 'FTC / Antitrust', angle: 0.75, r: 2.0, y: -0.2, isRisk: false,
    desc: 'Clayton Act § 7 (mergers), Sherman Act §§ 1-2 (per se vs. rule of reason), FTC Act § 5 (unfair methods). HSR Act: pre-merger notification if >$119.5M (2024 threshold). FTC AI Guidance (2023): algorithmic decision-making must comply with FTC Act § 5. DOJ/FTC Merger Guidelines 2023: new "ecosystem" theories of harm.' },
  { label: 'HIPAA / Health', angle: 1.5, r: 1.8, y: 0.4, isRisk: false,
    desc: 'HIPAA Privacy Rule (45 CFR § 164): PHI use and disclosure. Security Rule: administrative, physical, technical safeguards. Breach Notification Rule: 60-day notification to HHS and affected individuals. HITECH Act: enhanced penalties up to $1.9M per violation category/year. 21st Century Cures Act: information blocking prohibition.' },
  { label: 'CCPA / Privacy', angle: 2.25, r: 2.1, y: 0.1, isRisk: true,
    desc: 'California Consumer Privacy Act (amended by CPRA, effective 2023): right to know, delete, opt-out of sale/sharing, correct. Applies to businesses with >$25M revenue OR >100k consumers/year OR >50% revenue from selling data. $7,500 per intentional violation. CPPA enforcement. Virginia VCDPA, Texas TDPSA, Colorado CPA also active.' },
  { label: 'FCPA / AML', angle: 3.0, r: 1.9, y: -0.3, isRisk: true,
    desc: 'Foreign Corrupt Practices Act (15 U.S.C. § 78dd-1): prohibits bribery of foreign officials. DOJ/SEC joint enforcement. BSA/AML: Bank Secrecy Act SARs, FinCEN CDD Rule — beneficial ownership >25%. Corporate Transparency Act (2024): UBO disclosure to FinCEN. OFAC sanctions: SDN list screening. Penalty: $2M+/violation.' },
  { label: 'NLRA / Labor', angle: 3.75, r: 1.7, y: 0.2, isRisk: false,
    desc: 'National Labor Relations Act: § 7 rights to organize, § 8 unfair labor practices. NLRB General Counsel Memoranda 2023: expanded protected concerted activity includes social media posts. WARN Act (29 U.S.C. § 2101): 60-day notice for plant closings >50 workers. FLSA: overtime exemption classification (DOL 2024 rule: salary threshold $43,888/yr).' },
  { label: 'SEC Reg AI / IA', angle: 4.5, r: 2.0, y: -0.1, isRisk: true,
    desc: 'SEC Staff Guidance on AI (2024): RIAs using AI must disclose in ADV Part 2A. Investment Advisers Act § 206 fiduciary applies to AI-driven advice. Predictive Data Analytics Rule (proposed): conflicts of interest in AI-driven recommendations. FINRA Rule 3110: supervisory systems must cover AI tools. Enforcement: GreenFirst Capital (2023).' },
  { label: 'CFPB / Lending', angle: 5.25, r: 1.8, y: 0.3, isRisk: false,
    desc: 'Dodd-Frank § 1031: CFPB jurisdiction over UDAAPs — unfair, deceptive, abusive acts. ECOA / Reg B: adverse action notices required; AI model explanations required. FCRA: credit report accuracy and dispute rights. HMDA: mortgage lending data reporting. Fair Housing Act: § 3605 prohibits discriminatory AI underwriting. CFPB Circular 2023-3: ECOA applies to AI.' },
  { label: 'OSHA / EPA', angle: 6.0, r: 1.6, y: -0.2, isRisk: false,
    desc: 'OSHA General Duty Clause (29 U.S.C. § 654): employer must provide workplace free from recognized hazards. EPA Clean Air Act: Title V operating permits; GHG reporting threshold: 25,000 MT CO2e/year. SEC Climate Disclosure Rule (2024): Scope 1 & 2 emissions required for large accelerated filers. CERCLA: successor liability on asset acquisitions.' },
]

interface NodeInfo { label: string; desc: string; x: number; y: number }

function RegNode({ node, index, hovered, onHover, onClick }: {
  node: typeof NODES[0], index: number, hovered: boolean,
  onHover: (h: boolean) => void, onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    const orbitSpeed = 0.1 + index * 0.008
    const angle = node.angle + t * orbitSpeed
    meshRef.current.position.set(
      Math.cos(angle) * node.r,
      node.y + Math.sin(t * 0.5 + index * 0.8) * 0.08,
      Math.sin(angle) * node.r,
    )
    meshRef.current.scale.setScalar(hovered ? 1.6 : (1 + Math.sin(t * 2.5 + index) * 0.05))
  })
  return (
    <mesh ref={meshRef}
      position={[Math.cos(node.angle) * node.r, node.y, Math.sin(node.angle) * node.r]}
      onPointerOver={e => { e.stopPropagation(); onHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { onHover(false); document.body.style.cursor = '' }}
      onClick={onClick}>
      <sphereGeometry args={[0.11, 20, 20]} />
      <meshStandardMaterial
        color={node.isRisk ? '#ff7777' : '#cccccc'}
        emissive={node.isRisk ? '#ff4444' : '#aaaaaa'}
        emissiveIntensity={hovered ? 0.7 : (node.isRisk ? 0.4 : 0.12)}
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

  const initPositions = useMemo(() => NODES.map(n => new THREE.Vector3(Math.cos(n.angle) * n.r, n.y, Math.sin(n.angle) * n.r)), [])
  const lineGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (const p of initPositions) pts.push(new THREE.Vector3(0, 0, 0), p)
    const g = new THREE.BufferGeometry(); g.setFromPoints(pts); return g
  }, [initPositions])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.1 + mouse.x * 0.32
    groupRef.current.rotation.x = Math.sin(t * 0.06) * 0.08 + mouse.y * 0.1
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.5
      coreRef.current.rotation.z = t * 0.3
    }
  })

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 4]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-4, -3, -4]} intensity={0.4} color="#ff8866" />
      {/* Central regulatory globe */}
      <mesh ref={coreRef}
        onPointerOver={e => { e.stopPropagation(); setHovered(-1); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(null); document.body.style.cursor = '' }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation(); e.nativeEvent.stopPropagation()
          onNodeClick({ label: CENTER.label, desc: CENTER.desc, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
        }}>
        <octahedronGeometry args={[hovered === -1 ? 0.44 : 0.36, 0]} />
        <meshStandardMaterial color={hovered === -1 ? '#ffffff' : '#dddddd'} wireframe={hovered !== -1} emissive="#ffffff" emissiveIntensity={0.2} roughness={0.1} metalness={0.9} />
      </mesh>
      {/* Static spokes */}
      <primitive object={new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#555555', transparent: true, opacity: 0.28 }))} />
      {/* Orbiting regulatory nodes */}
      {NODES.map((n, i) => (
        <RegNode key={i} node={n} index={i} hovered={hovered === i}
          onHover={h => setHovered(h ? i : null)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation(); e.nativeEvent.stopPropagation()
            onNodeClick({ label: n.label, desc: n.desc, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
          }} />
      ))}
    </group>
  )
}

export default function RegulatoryImpact() {
  const [tooltip, setTooltip] = useState<NodeInfo | null>(null)
  const clickedRef = useRef(false)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={() => { if (clickedRef.current) { clickedRef.current = false; return }; setTooltip(null) }}>
      <Canvas camera={{ position: [0, 0.5, 6.5], fov: 45 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Scene onNodeClick={n => { clickedRef.current = true; setTooltip(n) }} />
        </Suspense>
      </Canvas>
      {tooltip && (
        <div style={{ position: 'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 330), top: Math.max(8, tooltip.y - 8), zIndex: 1000, background: '#0a0a0a', color: '#fff', borderRadius: 10, padding: '14px 18px', maxWidth: 330, pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#888', marginBottom: 4, textTransform: 'uppercase' }}>US REGULATORY</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tooltip.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>{tooltip.desc}</div>
        </div>
      )}
    </div>
  )
}
