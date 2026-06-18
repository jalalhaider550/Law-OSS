'use client'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRef, useState, useEffect, useCallback } from 'react'

const KnowledgeGraph = dynamic(() => import('../components/KnowledgeGraph'), { ssr: false, loading: () => null })
const CitationConstellation = dynamic(() => import('../components/CitationConstellation'), { ssr: false, loading: () => null })
const TimelineTunnel = dynamic(() => import('../components/TimelineTunnel'), { ssr: false, loading: () => null })
const ExplodedContract = dynamic(() => import('../components/ExplodedContract'), { ssr: false, loading: () => null })
const TransparentEngine = dynamic(() => import('../components/TransparentEngine'), { ssr: false, loading: () => null })
const LazyCanvas = dynamic(() => import('../components/LazyCanvas'), { ssr: false })

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    opacity: 0, transform: 'translateY(24px)',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
  })
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { setStyle({}); return }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting)
        setStyle({ opacity: 1, transform: 'translateY(0)', transition: 'opacity 0.6s ease, transform 0.6s ease' })
    }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return { ref, style }
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  Research: (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <circle cx="21" cy="21" r="13" stroke="#0F0F0F" strokeWidth="2.5"/>
      <path d="M31 31L42 42" stroke="#0F0F0F" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M15 21h12M21 15v12" stroke="#0F0F0F" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Drafting: (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="6" width="28" height="36" rx="3" stroke="#0F0F0F" strokeWidth="2.5"/>
      <path d="M14 16h20M14 22h20M14 28h14" stroke="#0F0F0F" strokeWidth="2" strokeLinecap="round"/>
      <path d="M34 34l6-6-3-3-6 6v3h3z" fill="#0F0F0F"/>
    </svg>
  ),
  'Contract Review': (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="6" width="28" height="36" rx="3" stroke="#0F0F0F" strokeWidth="2.5"/>
      <path d="M14 16h20M14 22h20M14 28h10" stroke="#0F0F0F" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="35" cy="35" r="7" fill="#fff" stroke="#0F0F0F" strokeWidth="2"/>
      <path d="M32 35l2 2 4-4" stroke="#0F0F0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Litigation: (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <path d="M24 6L8 16v4h32v-4L24 6z" stroke="#0F0F0F" strokeWidth="2.5" strokeLinejoin="round"/>
      <rect x="14" y="20" width="5" height="16" rx="1" fill="#0F0F0F" opacity=".12" stroke="#0F0F0F" strokeWidth="2"/>
      <rect x="21.5" y="20" width="5" height="16" rx="1" fill="#0F0F0F" opacity=".12" stroke="#0F0F0F" strokeWidth="2"/>
      <rect x="29" y="20" width="5" height="16" rx="1" fill="#0F0F0F" opacity=".12" stroke="#0F0F0F" strokeWidth="2"/>
      <path d="M8 36h32M5 40h38" stroke="#0F0F0F" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  Compliance: (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <path d="M24 4L6 12v10c0 12 7.5 21 18 24 10.5-3 18-12 18-24V12L24 4z" stroke="#0F0F0F" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M16 24l5 5 11-11" stroke="#0F0F0F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'Due Diligence': (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="6" width="36" height="36" rx="4" stroke="#0F0F0F" strokeWidth="2.5"/>
      <path d="M14 18h20M14 24h20M14 30h12" stroke="#0F0F0F" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="35" cy="13" r="5" fill="#0F0F0F"/>
      <path d="M33 13l1.5 1.5 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
}

const AGENTS = [
  { num: '01', key: 'Research', title: 'Research', desc: 'Case law, authorities and legal analysis. Every citation verified.' },
  { num: '02', key: 'Drafting', title: 'Drafting', desc: 'Draft letters, agreements, motions and briefs. Professional and complete.' },
  { num: '03', key: 'Contract Review', title: 'Contract Review', desc: 'Clause-by-clause risk analysis. Accept or reject fixes instantly.' },
  { num: '04', key: 'Litigation', title: 'Litigation', desc: 'Case strategy, evidence review and chronologies. Built for disputes.' },
  { num: '05', key: 'Compliance', title: 'Compliance', desc: 'Regulatory analysis and gap identification across jurisdictions.' },
  { num: '06', key: 'Due Diligence', title: 'Due Diligence', desc: 'Transaction review, corporate analysis and risk discovery.' },
]

const NAV_LINKS = [
  { label: 'Research', href: '#research' },
  { label: 'Contracts', href: '#contracts' },
  { label: 'Matters', href: '#matters' },
  { label: 'Agents', href: '#agents' },
  { label: 'Open Source', href: '#open-source' },
  { label: 'Contact', href: '#contact' },
]

const TRUST_ITEMS = ['Works with Claude', 'Works with Gemini', 'Data Stays Private', 'Open Source', 'No Subscription', 'Self-Hostable']

const GH = 'https://github.com/YOUR_USERNAME/law-oss'

const blackBtn: React.CSSProperties = {
  padding: '0 28px', height: 50, display: 'inline-flex', alignItems: 'center',
  background: '#0F0F0F', borderRadius: 8, fontSize: 15, color: '#fff',
  fontWeight: 600, textDecoration: 'none', border: 'none', cursor: 'pointer',
}
const outlineBtn = (light = false): React.CSSProperties => ({
  padding: '0 24px', height: 50, display: 'inline-flex', alignItems: 'center',
  border: `1.5px solid ${light ? 'rgba(255,255,255,0.5)' : '#0F0F0F'}`,
  borderRadius: 8, fontSize: 15, color: light ? '#fff' : '#0F0F0F',
  fontWeight: 500, textDecoration: 'none', background: 'none',
})

const labelStyle = (color = '#666666'): React.CSSProperties => ({
  fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const,
  color, marginBottom: 18,
})
const sectionPad = (mobile: boolean) => mobile ? '64px 24px' : '120px 48px'
const h2Style = (mobile: boolean, light = false): React.CSSProperties => ({
  fontSize: mobile ? 28 : 40, fontWeight: 600, letterSpacing: -1.2,
  lineHeight: 1.1, color: light ? '#fff' : '#0F0F0F', marginBottom: 20,
})
const bodyStyle = (light = false): React.CSSProperties => ({
  fontSize: 17, lineHeight: 1.65, color: light ? 'rgba(255,255,255,0.6)' : '#666666',
})

export default function LandingPage() {
  const hero = useFadeIn()
  const trust = useFadeIn()
  const research = useFadeIn()
  const contract = useFadeIn()
  const matters = useFadeIn()
  const agents = useFadeIn()
  const openSource = useFadeIn()
  const howItWorks = useFadeIn()
  const contactSection = useFadeIn()
  const finalCta = useFadeIn()

  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) { setFormStatus('sent'); setFormData({ name: '', email: '', message: '' }) }
      else setFormStatus('error')
    } catch { setFormStatus('error') }
  }, [formData])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', fontSize: 15,
    border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8,
    fontFamily: 'Inter, -apple-system, sans-serif',
    background: '#fff', color: '#0F0F0F', outline: 'none', boxSizing: 'border-box',
  }

  const twoCol = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 40 : 80, alignItems: 'center' as const }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: 'Inter, -apple-system, sans-serif', overflowX: 'hidden' }}>

      {/* ── GLOBAL KEYFRAME STYLES ─────────────────────────────────────────── */}
      <style>{`
        @keyframes scroll { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        @keyframes pulse { 0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.5 } 50% { transform: translate(-50%,-50%) scale(1.05); opacity: 1 } }
        @keyframes pulse2 { 0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.35 } 50% { transform: translate(-50%,-50%) scale(1.08); opacity: 0.7 } }
        @keyframes pulse3 { 0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.2 } 50% { transform: translate(-50%,-50%) scale(1.1); opacity: 0.45 } }
        @keyframes scan { 0% { top: 0% } 100% { top: 100% } }
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 20px' : '0 48px', height: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/logo.png" alt="Law OSS" width={28} height={28} style={{ objectFit: 'contain' }} unoptimized />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.4, color: '#0F0F0F' }}>Law OSS</span>
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {NAV_LINKS.map(item => (
              <a key={item.label} href={item.href}
                style={{ fontSize: 13.5, color: '#666666', textDecoration: 'none', fontWeight: 500 }}
                onMouseOver={e => (e.currentTarget.style.color = '#0F0F0F')}
                onMouseOut={e => (e.currentTarget.style.color = '#666666')}>
                {item.label}
              </a>
            ))}
          </div>
        )}

        {isMobile ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/signup" style={{ ...blackBtn, padding: '0 14px', height: 36, fontSize: 13 }}>Get Started</Link>
            <button onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 7, width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/login"
              style={{ padding: '0 16px', height: 38, display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 13.5, textDecoration: 'none', color: '#333', fontWeight: 500 }}>
              Sign In
            </Link>
            <Link href="/signup" style={{ ...blackBtn, padding: '0 20px', height: 38, fontSize: 13.5 }}>Get Started</Link>
          </div>
        )}
      </nav>

      {/* MOBILE MENU */}
      {isMobile && menuOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99, background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[...NAV_LINKS, { label: 'Sign In', href: '/login' }].map((item, i) => (
            <a key={i} href={item.href} onClick={() => setMenuOpen(false)}
              style={{ padding: '14px 0', fontSize: 16, fontWeight: 500, color: '#0F0F0F', textDecoration: 'none', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {item.label}
            </a>
          ))}
        </div>
      )}

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <div ref={hero.ref} style={{
        ...hero.style,
        position: 'relative',
        minHeight: isMobile ? 'auto' : '90vh',
        overflow: 'hidden',
      }}>
        {/* Grid overlay behind hero */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div style={{
          position: 'relative', zIndex: 1,
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          alignItems: 'center', maxWidth: 1200, margin: '0 auto',
          padding: isMobile ? '60px 24px 40px' : '0 48px', gap: isMobile ? 32 : 64,
        }}>
          <div>
            <p style={labelStyle()}>Legal AI Platform</p>
            <h1 style={{ fontSize: isMobile ? 38 : 58, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05, color: '#0F0F0F', marginBottom: 24 }}>
              Legal AI that works<br />the way lawyers do.
            </h1>
            <p style={{ ...bodyStyle(), marginBottom: 36, maxWidth: 460 }}>
              Research cases, review contracts, draft documents and run due diligence — all in one platform. Powered by Claude or Gemini. Your keys, your data.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" style={blackBtn}>Get Started Free</Link>
              <a href={GH} target="_blank" rel="noopener noreferrer" style={outlineBtn()}>View on GitHub</a>
            </div>
            <p style={{ fontSize: 13, color: '#aaa' }}>No subscription. No per-seat pricing. You pay only API costs.</p>
          </div>

          <div style={{ position: 'relative', height: isMobile ? 320 : 560 }}>
            {/* Concentric pulsing rings */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 320, height: 320,
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '50%',
              animation: 'pulse 3s ease-in-out infinite',
              pointerEvents: 'none', zIndex: 0,
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 440, height: 440,
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '50%',
              animation: 'pulse2 3.6s ease-in-out infinite',
              pointerEvents: 'none', zIndex: 0,
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 560, height: 560,
              border: '1px solid rgba(0,0,0,0.04)',
              borderRadius: '50%',
              animation: 'pulse3 4.2s ease-in-out infinite',
              pointerEvents: 'none', zIndex: 0,
            }} />
            <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
              <LazyCanvas height={isMobile ? 320 : 560}><KnowledgeGraph /></LazyCanvas>
            </div>
          </div>
        </div>
      </div>

      {/* ── TRUST BAR ───────────────────────────────────────────────────────── */}
      <div ref={trust.ref} style={{
        ...trust.style,
        borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: '#F5F5F5', overflow: 'hidden', padding: '0',
      }}>
        <div style={{ display: 'flex', animation: 'scroll 22s linear infinite', width: 'max-content', padding: '18px 0' }}>
          {[...TRUST_ITEMS, ...TRUST_ITEMS].map((item, i) => (
            <span key={i} style={{ fontSize: 13, fontWeight: 500, color: '#666666', whiteSpace: 'nowrap', padding: '0 32px' }}>
              <span style={{ color: '#0F0F0F', marginRight: 10 }}>·</span>{item}
            </span>
          ))}
        </div>
      </div>

      {/* ── SECTION 1: LEGAL RESEARCH (white) ───────────────────────────────── */}
      <div id="research" ref={research.ref} style={{ ...research.style, background: '#FFFFFF', padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', ...twoCol }}>
          <div>
            <p style={labelStyle()}>Legal Research</p>
            <h2 style={h2Style(isMobile)}>Real legal research.<br />Real citations.</h2>
            <p style={{ ...bodyStyle(), marginBottom: 36 }}>
              The Research Agent retrieves authoritative legal sources and returns referenced answers supported by verifiable authorities. Every citation links back to the original source.
            </p>
            {/* Terminal snippet card */}
            <div style={{
              background: '#0F0F0F', borderRadius: 10, padding: '18px 22px',
              fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 13,
              color: '#fff', maxWidth: 380,
            }}>
              <div style={{ color: '#666', marginBottom: 10, fontSize: 11 }}>research-agent · running</div>
              <div style={{ color: 'rgba(255,255,255,0.5)' }}>{'>'} Searching CourtListener...
                <span style={{ color: '#fff', marginLeft: 6 }}>✓</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{'>'} 247 cases found
                <span style={{ color: '#fff', marginLeft: 6 }}>·</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>12 authorities</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{'>'} Generating cited answer
                <span style={{ display: 'inline-block', width: 8, height: 13, background: '#fff', marginLeft: 6, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
              </div>
            </div>
          </div>
          <LazyCanvas height={480}><CitationConstellation /></LazyCanvas>
        </div>
      </div>

      {/* ── SECTION 2: CONTRACT REVIEW (#F5F5F5) ────────────────────────────── */}
      <div id="contracts" ref={contract.ref} style={{ ...contract.style, background: '#F5F5F5', padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', ...twoCol }}>
          <div>
            <p style={labelStyle()}>Contract Review</p>
            <h2 style={h2Style(isMobile)}>Upload a contract.<br />Get a risk report in seconds.</h2>
            <p style={{ ...bodyStyle(), marginBottom: 36 }}>
              The Contract Review Agent analyses your entire document and identifies risky clauses, drafting weaknesses, missing protections and negotiation opportunities. Accept or reject each fix with one click.
            </p>
            {/* Risk badge grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'CRITICAL', bg: '#0F0F0F', color: '#fff' },
                { label: 'HIGH', bg: 'rgba(0,0,0,0.12)', color: '#0F0F0F' },
                { label: 'MEDIUM', bg: 'rgba(0,0,0,0.06)', color: '#0F0F0F' },
                { label: 'LOW', bg: 'rgba(0,0,0,0.03)', color: '#666666' },
              ].map(badge => (
                <div key={badge.label} style={{
                  padding: '6px 14px', borderRadius: 6,
                  background: badge.bg, color: badge.color,
                  fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                  border: '1px solid rgba(0,0,0,0.08)',
                }}>
                  {badge.label}
                </div>
              ))}
            </div>
          </div>
          <LazyCanvas height={480}><ExplodedContract /></LazyCanvas>
        </div>
      </div>

      {/* ── SECTION 3: MATTERS (white) ──────────────────────────────────────── */}
      <div id="matters" ref={matters.ref} style={{ ...matters.style, background: '#FFFFFF', padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', ...twoCol }}>
          <LazyCanvas height={480}><TimelineTunnel /></LazyCanvas>
          <div>
            <p style={labelStyle()}>Matter Management</p>
            <h2 style={h2Style(isMobile)}>Every matter. Every conversation. One place.</h2>
            <p style={{ ...bodyStyle(), marginBottom: 36 }}>
              Create matters, organise documents, save AI conversations and continue work where you left off. Everything stored privately — never on our servers.
            </p>
            {/* Mini timeline widget */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: 360 }}>
              {[
                { dot: true, label: 'Created' },
                { dot: false, label: '' },
                { dot: true, label: 'In Progress' },
                { dot: false, label: '' },
                { dot: true, label: 'Resolved' },
              ].map((item, i) => (
                item.dot ? (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0F0F0F', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#666666', whiteSpace: 'nowrap' }}>{item.label}</span>
                  </div>
                ) : (
                  <div key={i} style={{ flex: 1, borderTop: '1px solid #0F0F0F', marginBottom: 20, minWidth: 40 }} />
                )
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: SIX AGENTS (#F5F5F5) ────────────────────────────────── */}
      <div id="agents" ref={agents.ref} style={{ ...agents.style, background: '#F5F5F5', padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={labelStyle()}>Specialist Agents</p>
          <h2 style={h2Style(isMobile)}>Six agents.<br />Every legal task covered.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 48 }}>
            {AGENTS.map((agent, i) => (
              <div key={i}
                style={{
                  position: 'relative', overflow: 'hidden',
                  background: i % 2 === 0 ? '#FFFFFF' : '#F5F5F5',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 12, padding: '28px 28px',
                  transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                  cursor: 'default',
                }}
                onMouseOver={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#0F0F0F'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.06)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                }}
              >
                {/* Ghost number behind card */}
                <div style={{
                  position: 'absolute', right: -10, top: -20,
                  fontSize: 120, fontWeight: 900, lineHeight: 1,
                  color: 'rgba(0,0,0,0.04)', pointerEvents: 'none', userSelect: 'none',
                }}>
                  {agent.num}
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, background: 'rgba(0,0,0,0.05)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {AGENT_ICONS[agent.key]}
                    </div>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: '#0F0F0F', marginBottom: 8 }}>{agent.title}</div>
                  <p style={{ fontSize: 14, color: '#666666', lineHeight: 1.6, margin: 0 }}>{agent.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 5: OPEN SOURCE (white) ──────────────────────────────────── */}
      <div id="open-source" ref={openSource.ref} style={{ ...openSource.style, background: '#FFFFFF', padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', ...twoCol }}>
          <LazyCanvas height={480}><TransparentEngine /></LazyCanvas>
          <div>
            <p style={labelStyle()}>Open Source</p>
            <h2 style={h2Style(isMobile)}>You own it. We don&#39;t.</h2>
            <p style={{ ...bodyStyle(), marginBottom: 36 }}>
              Law OSS is fully open source. Your API key goes directly to the AI provider — we never see it. Your documents never touch our servers. Run it in your browser or self-host it for your firm.
            </p>
            <a href={GH} target="_blank" rel="noopener noreferrer" style={outlineBtn()}>View Source on GitHub</a>
          </div>
        </div>
      </div>

      {/* ── SECTION 6: HOW IT WORKS (#F5F5F5) ──────────────────────────────── */}
      <div ref={howItWorks.ref} style={{ ...howItWorks.style, background: '#F5F5F5', padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={labelStyle()}>Get Started in 3 Steps</p>
          <h2 style={h2Style(isMobile)}>Simple setup. Immediate access.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 0, marginTop: 56, position: 'relative' }}>
            {/* Horizontal connector line (desktop only) */}
            {!isMobile && (
              <div style={{ position: 'absolute', top: 44, left: '16.6%', right: '16.6%', borderTop: '1px solid #0F0F0F', zIndex: 0 }} />
            )}
            {[
              { num: '1', title: 'Create free account', desc: 'No credit card. No trial period.' },
              { num: '2', title: 'Add API key', desc: 'Claude or Gemini. Encrypted locally, never stored.' },
              { num: '3', title: 'Start working', desc: 'Every feature available immediately.' },
            ].map((step, i) => (
              <div key={i} style={{
                padding: isMobile ? '32px 0' : '0 40px',
                position: 'relative', zIndex: 1,
                borderTop: isMobile && i > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
              }}>
                <div style={{ fontSize: 80, fontWeight: 900, color: '#0F0F0F', lineHeight: 1, marginBottom: 20 }}>
                  {step.num}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#0F0F0F', marginBottom: 10 }}>{step.title}</div>
                <p style={{ fontSize: 15, color: '#666666', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTACT ─────────────────────────────────────────────────────────── */}
      <div id="contact" ref={contactSection.ref} style={{
        ...contactSection.style,
        background: '#FFFFFF', padding: sectionPad(isMobile),
        borderTop: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 600 }}>
          <p style={labelStyle()}>Get in touch</p>
          <h2 style={{ ...h2Style(isMobile), marginBottom: 40 }}>How can we help?</h2>
          {formStatus === 'sent' ? (
            <div style={{ padding: 24, background: '#F5F5F5', borderRadius: 8, fontSize: 15, color: '#333' }}>
              Message sent. We will be in touch shortly.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { id: 'name', label: 'Name', type: 'text', ph: 'Your name' },
                { id: 'email', label: 'Email', type: 'email', ph: 'your@email.com' },
              ].map(f => (
                <div key={f.id}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#666666', marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type} required value={(formData as Record<string, string>)[f.id]}
                    onChange={e => setFormData(p => ({ ...p, [f.id]: e.target.value }))}
                    style={inputStyle} placeholder={f.ph} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#666666', marginBottom: 6 }}>Message</label>
                <textarea required value={formData.message}
                  onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }} placeholder="How can we help?" />
              </div>
              {formStatus === 'error' && <p style={{ fontSize: 13, color: '#c00', margin: 0 }}>Could not send. Please try again.</p>}
              <button type="submit" disabled={formStatus === 'sending'}
                style={{ ...blackBtn, width: 'fit-content', fontFamily: 'Inter, -apple-system, sans-serif', opacity: formStatus === 'sending' ? 0.7 : 1 }}>
                {formStatus === 'sending' ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── FINAL CTA (#0F0F0F — only dark section) ─────────────────────────── */}
      <div ref={finalCta.ref} style={{
        ...finalCta.style,
        background: '#0F0F0F', padding: sectionPad(isMobile), textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Scan line animation */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 1,
          background: '#fff', opacity: 0.05,
          animation: 'scan 4s linear infinite',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 600, letterSpacing: -1.2, color: '#fff', marginBottom: 18, lineHeight: 1.1 }}>
            The legal AI platform that works for you, not against you.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', marginBottom: 40, lineHeight: 1.6 }}>
            Free forever. Open source. No subscriptions.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            <Link href="/signup" style={{ ...blackBtn, background: '#fff', color: '#0F0F0F' }}>Get Started Free</Link>
            <a href={GH} target="_blank" rel="noopener noreferrer" style={outlineBtn(true)}>View on GitHub</a>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Currently in beta. Do not upload highly sensitive or privileged documents.
          </p>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ background: '#FFFFFF', padding: isMobile ? '24px 20px' : '32px 48px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 20 : 0, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/logo.png" alt="Law OSS" width={24} height={24} style={{ objectFit: 'contain' }} unoptimized />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0F0F0F' }}>Law OSS</span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {['Research', 'Contracts', 'Matters', 'Agents', 'Open Source'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(' ', '-')}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>{l}</a>
            ))}
            <Link href="/terms" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Terms</Link>
            <a href="#contact" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Contact</a>
            <a href={GH} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>GitHub</a>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '0 auto', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 18, fontSize: 12, color: '#bbb' }}>
          © 2026 Law OSS. Open source.
        </div>
      </footer>

    </div>
  )
}
