'use client'
import { useRef, useMemo, Suspense, useState } from 'react'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

// US Federal Court Hierarchy
const COURTS = [
  { id: 0, label: 'U.S. Supreme Court', tier: 0, color: '#ffffff', size: 0.30, pos: [0, 2.8, 0] as [number,number,number],
    desc: 'Highest court in the United States. Nine Justices appointed for life. Certiorari granted in ~1% of petitions (~70–80 cases/year). Decisions are binding on all federal and state courts. Key doctrines: judicial review (Marbury v. Madison, 1803), substantive due process (14th Amendment), and strict scrutiny.' },
  { id: 1, label: '1st–5th Circuits', tier: 1, color: '#d4d4d4', size: 0.20, pos: [-1.4, 1.4, 0.2] as [number,number,number],
    desc: '1st Cir (ME, MA, NH, RI, PR) · 2nd Cir (NY, CT, VT) · 3rd Cir (PA, NJ, DE) · 4th Cir (MD, VA, NC, SC, WV) · 5th Cir (TX, LA, MS). Each circuit binds district courts within it. Inter-circuit splits are the primary driver of Supreme Court cert grants.' },
  { id: 2, label: '6th–11th + DC Circuits', tier: 1, color: '#d4d4d4', size: 0.20, pos: [1.4, 1.4, -0.2] as [number,number,number],
    desc: '6th Cir (OH, MI, KY, TN) · 7th Cir (IL, IN, WI) · 8th Cir (MN, IA, MO, ND, SD, NE, AR) · 9th Cir (CA, AK, AZ, HI, ID, MT, NV, OR, WA, GU, CNMI) · 10th Cir · 11th Cir · DC Cir (federal agency review hub). The 9th Circuit is the largest and most frequently overturned.' },
  { id: 3, label: 'Federal District Courts', tier: 2, color: '#888888', size: 0.14, pos: [-2.4, 0.1, 0.4] as [number,number,number],
    desc: '94 district courts across the 50 states, D.C., and territories. Trial courts of the federal system. Jurisdiction: federal questions (28 U.S.C. § 1331), diversity jurisdiction >$75k (28 U.S.C. § 1332), and subject-matter jurisdiction conferred by statute (patent, bankruptcy, ERISA, civil rights).' },
  { id: 4, label: 'SDNY / NDCA', tier: 2, color: '#888888', size: 0.14, pos: [-0.8, 0.1, 0.4] as [number,number,number],
    desc: 'S.D.N.Y. (Manhattan) — global financial litigation hub. N.D. Cal. (San Jose/San Francisco) — dominant IP and tech court. D. Del. — corporate law disputes (most Fortune 500 incorporate in Delaware). These three districts produce a disproportionate share of landmark commercial decisions.' },
  { id: 5, label: 'Bankruptcy Courts', tier: 2, color: '#888888', size: 0.14, pos: [0.8, 0.1, -0.4] as [number,number,number],
    desc: 'Article I courts under 28 U.S.C. § 151. Chapters 7 (liquidation), 11 (reorganization), 13 (wage-earner plan), 15 (cross-border insolvency). D. Del. and S.D.N.Y. handle ~70% of large Chapter 11 filings. Appeals go to Bankruptcy Appellate Panel or district court.' },
  { id: 6, label: 'Specialized Courts', tier: 2, color: '#888888', size: 0.14, pos: [2.4, 0.1, -0.4] as [number,number,number],
    desc: 'Court of Federal Claims (monetary claims vs. USA) · Court of International Trade · Tax Court (26 U.S.C. § 7441) · FISC (Foreign Intelligence Surveillance Court) · Court of Appeals for Veterans Claims · International Trade Commission (ITC) — Section 337 exclusion orders.' },
  { id: 7, label: 'State Supreme Courts', tier: 3, color: '#555555', size: 0.11, pos: [-2.8, -1.3, 0.6] as [number,number,number],
    desc: '50 state supreme courts. Final authority on state law questions. Federal courts apply state law in diversity cases under Erie R.R. v. Tompkins (1938). Certiorari to SCOTUS available only on federal constitutional grounds. Delaware Supreme Court dominates US corporate law.' },
  { id: 8, label: 'State Trial Courts', tier: 3, color: '#555555', size: 0.11, pos: [-1.2, -1.3, 0.5] as [number,number,number],
    desc: 'Handle the vast majority of US litigation (~95%). Jurisdiction: contract, tort, property, family, criminal. Delaware Court of Chancery is the preeminent corporate law court (no jury, specialist judges). California Superior Courts handle massive class action dockets.' },
  { id: 9, label: 'ALJ / Admin Tribunals', tier: 3, color: '#555555', size: 0.11, pos: [0.2, -1.3, 0] as [number,number,number],
    desc: 'Administrative Law Judges (ALJs) adjudicate disputes before federal agencies: SEC, NLRB, FTC, SSA, EPA, CFTC. ALJ decisions appealable to agency heads, then to courts of appeals. SEC ALJ docket became controversial after Lucia v. SEC (2018) Appointments Clause ruling.' },
  { id: 10, label: 'PTAB / TTAB', tier: 3, color: '#555555', size: 0.11, pos: [1.4, -1.3, -0.5] as [number,number,number],
    desc: 'Patent Trial and Appeal Board (USPTO) — Inter Partes Review (IPR) and Post-Grant Review (PGR) under AIA. ~60% of challenged patent claims cancelled. Trademark Trial and Appeal Board (TTAB) — opposition and cancellation proceedings. Appeals to Federal Circuit.' },
  { id: 11, label: 'Int\'l Arbitration', tier: 3, color: '#555555', size: 0.11, pos: [2.8, -1.3, -0.6] as [number,number,number],
    desc: 'AAA/ICDR, JAMS, ICC, ICSID, UNCITRAL. New York Convention (1958) enables enforcement in 170+ countries. FAA governs domestic arbitration. Second Circuit (SDNY) is the primary seat for international commercial arbitration in the US. Discovery under 28 U.S.C. § 1782 enables US discovery for foreign proceedings.' },
]

const EDGES = [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6],[3,7],[4,8],[5,9],[5,10],[6,11]]

interface NodeInfo { label: string; desc: string; x: number; y: number }

function CourtNode({ court, hovered, onHover, onClick }: {
  court: typeof COURTS[0], hovered: boolean,
  onHover: (h: boolean) => void, onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    if (hovered) {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.05)
    } else {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 1.5 + court.id) * 0.03)
    }
  })
  return (
    <mesh ref={meshRef} position={court.pos}
      onPointerOver={e => { e.stopPropagation(); onHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { onHover(false); document.body.style.cursor = '' }}
      onClick={onClick}>
      <sphereGeometry args={[court.size, 32, 32]} />
      <meshStandardMaterial
        color={hovered ? '#ffffff' : court.color}
        emissive={hovered ? '#ffffff' : court.color}
        emissiveIntensity={hovered ? 0.4 : 0.1}
        roughness={0.3} metalness={0.6}
      />
    </mesh>
  )
}

function Scene({ onNodeClick }: { onNodeClick: (n: NodeInfo) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const { mouse } = useThree()
  const [hovered, setHovered] = useState<number | null>(null)

  const positions = useMemo(() => COURTS.map(c => new THREE.Vector3(...c.pos)), [])
  const lineGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (const [a, b] of EDGES) pts.push(positions[a], positions[b])
    const g = new THREE.BufferGeometry(); g.setFromPoints(pts); return g
  }, [positions])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.09 + mouse.x * 0.35
    groupRef.current.rotation.x = Math.sin(t * 0.05) * 0.08 + mouse.y * 0.12
  })

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-5, -3, -5]} intensity={0.4} color="#aaaaff" />
      <primitive object={new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#555555', transparent: true, opacity: 0.35 }))} />
      {COURTS.map((c, i) => (
        <CourtNode key={i} court={c} hovered={hovered === i}
          onHover={h => setHovered(h ? i : null)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation(); e.nativeEvent.stopPropagation()
            onNodeClick({ label: c.label, desc: c.desc, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
          }} />
      ))}
    </group>
  )
}

export default function PrecedentEngine() {
  const [tooltip, setTooltip] = useState<NodeInfo | null>(null)
  const clickedRef = useRef(false)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={() => { if (clickedRef.current) { clickedRef.current = false; return }; setTooltip(null) }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Scene onNodeClick={n => { clickedRef.current = true; setTooltip(n) }} />
        </Suspense>
      </Canvas>
      {tooltip && (
        <div style={{ position: 'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 320), top: Math.max(8, tooltip.y - 8), zIndex: 1000, background: '#0a0a0a', color: '#fff', borderRadius: 10, padding: '14px 18px', maxWidth: 320, pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#888', marginBottom: 4, textTransform: 'uppercase' }}>US COURTS</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tooltip.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>{tooltip.desc}</div>
        </div>
      )}
    </div>
  )
}
