'use client'
import { useRef, useMemo, Suspense, useState } from 'react'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

// US M&A Due Diligence — corporate structure graph
const NODES = [
  { id: 0, label: 'Apex Holdings Inc.', type: 'holding', pos: [0, 0, 0] as [number,number,number], size: 0.30,
    desc: 'Delaware C-Corp. Ultimate parent. EIN filed. Cap table: 60% founder, 28% Series B preferred (1.5x liquidation preference, participating), 12% option pool. Section 382 NOL limitation triggered — annual tax benefit usage capped at ~$4.2M. Clean SOX 404 attestation for FY2023.' },
  { id: 1, label: 'US OpCo LLC', type: 'subsidiary', pos: [-2.2, 1.2, 0.5] as [number,number,number], size: 0.19,
    desc: 'Delaware LLC wholly-owned by Apex. Disregarded entity for US federal tax (check-the-box election). $48M ARR. Employment agreements with 3 key employees contain double-trigger change-of-control provisions. WARN Act compliance required if RIF >50 in 30 days. IP assignment agreements executed.' },
  { id: 2, label: 'Cayman IP HoldCo', type: 'subsidiary', pos: [2.2, 1.2, -0.5] as [number,number,number], size: 0.19,
    desc: 'Cayman Islands holding entity. Holds core patents and trade secrets licensed back to US OpCo at 7% royalty. IRS Transfer Pricing audit open — arm\'s-length standard under IRC § 482. GILTI exposure: Subpart F income reviewed. CFIUS analysis required for foreign investor >10% equity.' },
  { id: 3, label: 'CEO: J. Martinez', type: 'director', pos: [-3.2, 2.4, 0.8] as [number,number,number], size: 0.13,
    desc: 'Founder & CEO. 5-year non-compete, 2-year non-solicit under Delaware law (enforceable vs. California where CEO resides — choice-of-law issue). $2.1M unvested RSUs subject to double-trigger. Section 16 reporting person. No 10b5-1 plan in place — insider trading compliance gap flagged.' },
  { id: 4, label: 'Board: VC Director', type: 'director', pos: [-1.2, 2.6, 0.3] as [number,number,number], size: 0.13,
    desc: 'Series B lead investor designee. Preferred stock board seat per IRA. Fiduciary duty: Revlon mode triggered on sale transaction — board must maximize shareholder value. Conflict: VC fund portfolio includes competitor (IndigoLegal). Disclosure to full board required. MFW cleansing process recommended.' },
  { id: 5, label: 'IP Portfolio', type: 'risk', pos: [3.0, 2.4, -0.8] as [number,number,number], size: 0.14,
    desc: '43 US patents, 12 pending. 4 patents subject to IPR petitions at PTAB (§ 312 AIA). Freedom-to-operate opinion obtained 2022 — gaps identified in NLP claim space. OpenAI patent cross-license expired Q3 2024. Trade secret protection: DTSA (18 U.S.C. § 1836) protocols and NDA audit required.' },
  { id: 6, label: 'Series B Preferred', type: 'shareholder', pos: [0.8, 2.3, 0.7] as [number,number,number], size: 0.15,
    desc: '$40M Series B at $200M post-money. 1.5x non-participating liquidation preference converts to participating below $320M exit. Pay-to-play provisions activated if bridge needed. Anti-dilution: broad-based weighted average. Drag-along: 65% preferred + majority common required. Qualified IPO definition: $150M+ raise.' },
  { id: 7, label: 'US SubCo (Dormant)', type: 'subsidiary', pos: [-2.8, -0.5, 1.3] as [number,number,number], size: 0.14,
    desc: 'Delaware subsidiary incorporated 2019, dormant since 2021. State franchise tax accrued unpaid: ~$12k. UCC-1 financing statement still active from 2020 lender (since repaid) — release not filed. Registered agent lapsed. Recommend dissolution under DGCL § 275 or administrative termination prior to close.' },
  { id: 8, label: 'Debt Facility', type: 'risk', pos: [2.4, -0.7, -1.2] as [number,number,number], size: 0.14,
    desc: '$15M venture debt, Silicon Valley Bank successor. Change-of-control put: acquirer must repay or obtain lender consent. Material Adverse Change definition: 20%+ ARR decline in any trailing 12 months. DSCR covenant: 1.25x. Pre-payment penalty: 2% if repaid before 18 months from origination. UCC-1 covers all assets.' },
  { id: 9, label: 'Employment / Benefits', type: 'risk', pos: [-0.5, -1.2, -0.5] as [number,number,number], size: 0.13,
    desc: '112 US employees. ERISA 401(k) plan — last Form 5500 audit passed. No defined benefit pension. PTO accrual liability: $880k. Independent contractor classification: 8 contractors in CA — AB5 misclassification risk (penalties up to $25k/worker). Section 409A compliance review on all deferred comp arrangements.' },
]

const EDGES = [[0,1],[0,2],[0,6],[1,3],[1,4],[1,7],[2,5],[2,8],[0,9]]

const TYPE_COLOR: Record<string, string> = {
  holding: '#ffffff', subsidiary: '#aaaaaa', director: '#dddddd',
  shareholder: '#bbbbbb', risk: '#ff6666',
}

interface NodeInfo { label: string; desc: string; x: number; y: number }

function CorpNode({ node, hovered, onHover, onClick }: {
  node: typeof NODES[0], hovered: boolean,
  onHover: (h: boolean) => void, onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    const pulse = 1 + Math.sin(t * 1.8 + node.id * 0.7) * 0.04
    meshRef.current.scale.setScalar(hovered ? 1.45 : pulse)
  })
  return (
    <mesh ref={meshRef} position={node.pos}
      onPointerOver={e => { e.stopPropagation(); onHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { onHover(false); document.body.style.cursor = '' }}
      onClick={onClick}>
      <sphereGeometry args={[node.size, 28, 28]} />
      <meshStandardMaterial
        color={hovered ? '#ffffff' : TYPE_COLOR[node.type]}
        emissive={TYPE_COLOR[node.type]}
        emissiveIntensity={node.type === 'risk' ? (hovered ? 0.8 : 0.35) : (hovered ? 0.3 : 0.08)}
        roughness={0.25} metalness={0.65}
      />
    </mesh>
  )
}

function Scene({ onNodeClick }: { onNodeClick: (n: NodeInfo) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const { mouse } = useThree()
  const [hovered, setHovered] = useState<number | null>(null)

  const positions = useMemo(() => NODES.map(n => new THREE.Vector3(...n.pos)), [])
  const lineGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (const [a, b] of EDGES) pts.push(positions[a], positions[b])
    const g = new THREE.BufferGeometry(); g.setFromPoints(pts); return g
  }, [positions])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.06 + mouse.x * 0.32
    groupRef.current.rotation.x = Math.sin(t * 0.04) * 0.06 + mouse.y * 0.12
  })

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.55} />
      <pointLight position={[5, 5, 5]} intensity={1.4} color="#ffffff" />
      <pointLight position={[-4, -4, -4]} intensity={0.35} color="#ff9966" />
      <primitive object={new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#666666', transparent: true, opacity: 0.4 }))} />
      {NODES.map((n, i) => (
        <CorpNode key={i} node={n} hovered={hovered === i}
          onHover={h => setHovered(h ? i : null)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation(); e.nativeEvent.stopPropagation()
            onNodeClick({ label: n.label, desc: n.desc, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
          }} />
      ))}
    </group>
  )
}

export default function CorporateUniverse() {
  const [tooltip, setTooltip] = useState<NodeInfo | null>(null)
  const clickedRef = useRef(false)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={() => { if (clickedRef.current) { clickedRef.current = false; return }; setTooltip(null) }}>
      <Canvas camera={{ position: [0, 0, 8.5], fov: 45 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Scene onNodeClick={n => { clickedRef.current = true; setTooltip(n) }} />
        </Suspense>
      </Canvas>
      {tooltip && (
        <div style={{ position: 'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 330), top: Math.max(8, tooltip.y - 8), zIndex: 1000, background: '#0a0a0a', color: '#fff', borderRadius: 10, padding: '14px 18px', maxWidth: 330, pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#888', marginBottom: 4, textTransform: 'uppercase' }}>M&A DUE DILIGENCE</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tooltip.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>{tooltip.desc}</div>
        </div>
      )}
    </div>
  )
}
