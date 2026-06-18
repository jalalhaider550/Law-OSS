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

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  navy: '#1A2E6E',
  navyDark: '#2A3F8F',
  text: '#0F0F0F',
  muted: '#555555',
  bg: '#FFFFFF',
  bgAlt: '#F8F8F8',
  border: 'rgba(0,0,0,0.08)',
  cardBorder: 'rgba(0,0,0,0.08)',
}

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
      <circle cx="21" cy="21" r="13" stroke={C.navy} strokeWidth="2.5"/>
      <path d="M31 31L42 42" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M15 21h12M21 15v12" stroke={C.navy} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Drafting: (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="6" width="28" height="36" rx="3" stroke={C.navy} strokeWidth="2.5"/>
      <path d="M14 16h20M14 22h20M14 28h14" stroke={C.navy} strokeWidth="2" strokeLinecap="round"/>
      <path d="M34 34l6-6-3-3-6 6v3h3z" fill={C.navy}/>
    </svg>
  ),
  'Contract Review': (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="6" width="28" height="36" rx="3" stroke={C.navy} strokeWidth="2.5"/>
      <path d="M14 16h20M14 22h20M14 28h10" stroke={C.navy} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="35" cy="35" r="7" fill="#fff" stroke={C.navy} strokeWidth="2"/>
      <path d="M32 35l2 2 4-4" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Litigation: (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <path d="M24 6L8 16v4h32v-4L24 6z" stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round"/>
      <rect x="14" y="20" width="5" height="16" rx="1" fill={C.navy} opacity=".15" stroke={C.navy} strokeWidth="2"/>
      <rect x="21.5" y="20" width="5" height="16" rx="1" fill={C.navy} opacity=".15" stroke={C.navy} strokeWidth="2"/>
      <rect x="29" y="20" width="5" height="16" rx="1" fill={C.navy} opacity=".15" stroke={C.navy} strokeWidth="2"/>
      <path d="M8 36h32M5 40h38" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  Compliance: (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <path d="M24 4L6 12v10c0 12 7.5 21 18 24 10.5-3 18-12 18-24V12L24 4z" stroke={C.navy} strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M16 24l5 5 11-11" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'Due Diligence': (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="6" width="36" height="36" rx="4" stroke={C.navy} strokeWidth="2.5"/>
      <path d="M14 18h20M14 24h20M14 30h12" stroke={C.navy} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="35" cy="13" r="5" fill={C.navy}/>
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

// ── Shared style helpers ──────────────────────────────────────────────────────
const label = (color = C.muted): React.CSSProperties => ({
  fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const,
  color, marginBottom: 18,
})
const sectionPad = (mobile: boolean) => mobile ? '64px 24px' : '120px 48px'
const h2Style = (mobile: boolean, light = false): React.CSSProperties => ({
  fontSize: mobile ? 28 : 40, fontWeight: 600, letterSpacing: -1.2,
  lineHeight: 1.1, color: light ? '#fff' : C.text, marginBottom: 20,
})
const bodyStyle = (light = false): React.CSSProperties => ({
  fontSize: 17, lineHeight: 1.65, color: light ? 'rgba(255,255,255,0.6)' : C.muted,
})
const navyBtn: React.CSSProperties = {
  padding: '0 28px', height: 50, display: 'inline-flex', alignItems: 'center',
  background: C.navy, borderRadius: 8, fontSize: 15, color: '#fff',
  fontWeight: 600, textDecoration: 'none', border: 'none', cursor: 'pointer',
}
const outlineBtn = (light = false): React.CSSProperties => ({
  padding: '0 24px', height: 50, display: 'inline-flex', alignItems: 'center',
  border: `1.5px solid ${light ? 'rgba(255,255,255,0.4)' : C.navy}`,
  borderRadius: 8, fontSize: 15, color: light ? '#fff' : C.navy,
  fontWeight: 500, textDecoration: 'none', background: 'none',
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
    background: '#fff', color: C.text, outline: 'none', boxSizing: 'border-box',
  }

  const twoCol = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 40 : 80, alignItems: 'center' as const }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, -apple-system, sans-serif', overflowX: 'hidden' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 20px' : '0 48px', height: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/logo.png" alt="Law OSS" width={28} height={28} style={{ objectFit: 'contain' }} unoptimized />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.4, color: C.text }}>Law OSS</span>
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {NAV_LINKS.map(item => (
              <a key={item.label} href={item.href} style={{ fontSize: 13.5, color: C.muted, textDecoration: 'none', fontWeight: 500 }}
                onMouseOver={e => (e.currentTarget.style.color = C.text)}
                onMouseOut={e => (e.currentTarget.style.color = C.muted)}>
                {item.label}
              </a>
            ))}
          </div>
        )}

        {isMobile ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/signup" style={{ ...navyBtn, padding: '0 14px', height: 36, fontSize: 13 }}>Get Started</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/login" style={{ padding: '0 16px', height: 38, display: 'inline-flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13.5, textDecoration: 'none', color: '#333', fontWeight: 500 }}>
              Sign In
            </Link>
            <Link href="/signup" style={{ ...navyBtn, padding: '0 20px', height: 38, fontSize: 13.5 }}>Get Started</Link>
          </div>
        )}
      </nav>

      {/* MOBILE MENU */}
      {isMobile && menuOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99, background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[...NAV_LINKS, { label: 'Sign In', href: '/login' }].map((item, i) => (
            <a key={i} href={item.href} onClick={() => setMenuOpen(false)}
              style={{ padding: '14px 0', fontSize: 16, fontWeight: 500, color: C.text, textDecoration: 'none', borderBottom: `1px solid ${C.border}` }}>
              {item.label}
            </a>
          ))}
        </div>
      )}

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <div ref={hero.ref} style={{
        ...hero.style,
        minHeight: isMobile ? 'auto' : '90vh',
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        alignItems: 'center', maxWidth: 1200, margin: '0 auto',
        padding: isMobile ? '60px 24px 40px' : '0 48px', gap: isMobile ? 32 : 64,
      }}>
        <div>
          <p style={label()}>Legal AI Platform</p>
          <h1 style={{ fontSize: isMobile ? 38 : 58, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05, color: C.text, marginBottom: 24 }}>
            Legal AI that works<br />the way lawyers do.
          </h1>
          <p style={{ ...bodyStyle(), marginBottom: 36, maxWidth: 460 }}>
            Research cases, review contracts, draft documents and run due diligence — all in one platform. Powered by Claude or Gemini. Your keys, your data.
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
            <Link href="/signup" style={navyBtn}>Get Started Free</Link>
            <a href={GH} target="_blank" rel="noopener noreferrer" style={outlineBtn()}>View on GitHub</a>
          </div>
          <p style={{ fontSize: 13, color: '#aaa' }}>No subscription. No per-seat pricing. You pay only API costs.</p>
        </div>

        <div style={{ position: 'relative', height: isMobile ? 320 : 560 }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 420, height: 420,
            background: `radial-gradient(circle, rgba(26,46,110,0.1) 0%, transparent 70%)`,
            borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
          }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
            <LazyCanvas height={isMobile ? 320 : 560}><KnowledgeGraph /></LazyCanvas>
          </div>
        </div>
      </div>

      {/* ── TRUST BAR ───────────────────────────────────────────────────────── */}
      <div ref={trust.ref} style={{
        ...trust.style,
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
        background: C.bgAlt, overflow: 'hidden', padding: '0',
      }}>
        <style>{`@keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
        <div style={{ display: 'flex', animation: 'scroll 22s linear infinite', width: 'max-content', padding: '18px 0' }}>
          {[...TRUST_ITEMS, ...TRUST_ITEMS].map((item, i) => (
            <span key={i} style={{ fontSize: 13, fontWeight: 500, color: C.muted, whiteSpace: 'nowrap', padding: '0 32px' }}>
              <span style={{ color: C.navy, marginRight: 10 }}>·</span>{item}
            </span>
          ))}
        </div>
      </div>

      {/* ── SECTION 1: LEGAL RESEARCH (white) ───────────────────────────────── */}
      <div id="research" ref={research.ref} style={{ ...research.style, background: C.bg, padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', ...twoCol }}>
          <div>
            <p style={label()}>Legal Research</p>
            <h2 style={h2Style(isMobile)}>Real legal research.<br />Real citations.</h2>
            <p style={bodyStyle()}>
              The Research Agent retrieves authoritative legal sources and returns referenced answers supported by verifiable authorities. Every citation links back to the original source so you can review the underlying material yourself.
            </p>
          </div>
          <LazyCanvas height={480}><CitationConstellation /></LazyCanvas>
        </div>
      </div>

      {/* ── SECTION 2: CONTRACT REVIEW (alt bg) ─────────────────────────────── */}
      <div id="contracts" ref={contract.ref} style={{ ...contract.style, background: C.bgAlt, padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', ...twoCol }}>
          <div>
            <p style={label()}>Contract Review</p>
            <h2 style={h2Style(isMobile)}>Upload a contract.<br />Get a risk report in seconds.</h2>
            <p style={bodyStyle()}>
              The Contract Review Agent analyses your entire document and identifies risky clauses, drafting weaknesses, missing protections and negotiation opportunities. Accept or reject each fix with one click.
            </p>
          </div>
          <LazyCanvas height={480}><ExplodedContract /></LazyCanvas>
        </div>
      </div>

      {/* ── SECTION 3: MATTERS (white) ──────────────────────────────────────── */}
      <div id="matters" ref={matters.ref} style={{ ...matters.style, background: C.bg, padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', ...twoCol }}>
          <LazyCanvas height={480}><TimelineTunnel /></LazyCanvas>
          <div>
            <p style={label()}>Matter Management</p>
            <h2 style={h2Style(isMobile)}>Every matter. Every conversation. One place.</h2>
            <p style={bodyStyle()}>
              Create matters, organise documents, save AI conversations and continue work where you left off. Everything stored privately — never on our servers.
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: SIX AGENTS (alt bg) ─────────────────────────────────── */}
      <div id="agents" ref={agents.ref} style={{ ...agents.style, background: C.bgAlt, padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={label()}>Specialist Agents</p>
          <h2 style={h2Style(isMobile)}>Six agents.<br />Every legal task covered.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 48 }}>
            {AGENTS.map((agent, i) => (
              <div key={i} style={{
                background: C.bg, border: `1px solid ${C.cardBorder}`,
                borderRadius: 12, padding: '28px 28px',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                cursor: 'default',
              }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(26,46,110,0.1)' }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 48, height: 48, background: 'rgba(26,46,110,0.06)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {AGENT_ICONS[agent.key]}
                  </div>
                  <span style={{ fontSize: 42, fontWeight: 700, color: 'rgba(26,46,110,0.1)', lineHeight: 1 }}>{agent.num}</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 8 }}>{agent.title}</div>
                <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, margin: 0 }}>{agent.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 5: OPEN SOURCE (white) ──────────────────────────────────── */}
      <div id="open-source" ref={openSource.ref} style={{ ...openSource.style, background: C.bg, padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', ...twoCol }}>
          <LazyCanvas height={480}><TransparentEngine /></LazyCanvas>
          <div>
            <p style={label()}>Open Source</p>
            <h2 style={h2Style(isMobile)}>You own it. We don't.</h2>
            <p style={{ ...bodyStyle(), marginBottom: 36 }}>
              Law OSS is fully open source. Your API key goes directly to the AI provider — we never see it. Your documents never touch our servers. Run it in your browser or self-host it for your firm.
            </p>
            <a href={GH} target="_blank" rel="noopener noreferrer" style={outlineBtn()}>View Source on GitHub</a>
          </div>
        </div>
      </div>

      {/* ── SECTION 6: HOW IT WORKS (alt bg) ───────────────────────────────── */}
      <div ref={howItWorks.ref} style={{ ...howItWorks.style, background: C.bgAlt, padding: sectionPad(isMobile) }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={label()}>Get Started in 3 Steps</p>
          <h2 style={h2Style(isMobile)}>Simple setup. Immediate access.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 0, marginTop: 56, position: 'relative' }}>
            {[
              { num: '1', title: 'Create a free account', desc: 'No credit card. No trial period.' },
              { num: '2', title: 'Add your API key', desc: 'Claude or Gemini. Encrypted locally, never stored.' },
              { num: '3', title: 'Start working', desc: 'Every feature available immediately.' },
            ].map((step, i) => (
              <div key={i} style={{
                padding: isMobile ? '32px 0' : '0 40px',
                borderLeft: !isMobile && i > 0 ? `1px solid ${C.border}` : 'none',
                borderTop: isMobile && i > 0 ? `1px solid ${C.border}` : 'none',
              }}>
                <div style={{ fontSize: 64, fontWeight: 800, color: C.navy, opacity: 0.15, lineHeight: 1, marginBottom: 20 }}>
                  {step.num}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 10 }}>{step.title}</div>
                <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTACT ─────────────────────────────────────────────────────────── */}
      <div id="contact" ref={contactSection.ref} style={{
        ...contactSection.style,
        background: C.bg, padding: sectionPad(isMobile),
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 600 }}>
          <p style={label()}>Get in touch</p>
          <h2 style={{ ...h2Style(isMobile), marginBottom: 40 }}>How can we help?</h2>
          {formStatus === 'sent' ? (
            <div style={{ padding: 24, background: C.bgAlt, borderRadius: 8, fontSize: 15, color: '#333' }}>
              Message sent. We will be in touch shortly.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { id: 'name', label: 'Name', type: 'text', ph: 'Your name' },
                { id: 'email', label: 'Email', type: 'email', ph: 'your@email.com' },
              ].map(f => (
                <div key={f.id}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type} required value={(formData as Record<string, string>)[f.id]}
                    onChange={e => setFormData(p => ({ ...p, [f.id]: e.target.value }))}
                    style={inputStyle} placeholder={f.ph} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 6 }}>Message</label>
                <textarea required value={formData.message}
                  onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }} placeholder="How can we help?" />
              </div>
              {formStatus === 'error' && <p style={{ fontSize: 13, color: '#c00', margin: 0 }}>Could not send. Please try again.</p>}
              <button type="submit" disabled={formStatus === 'sending'}
                style={{ ...navyBtn, width: 'fit-content', fontFamily: 'Inter, -apple-system, sans-serif', opacity: formStatus === 'sending' ? 0.7 : 1 }}>
                {formStatus === 'sending' ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── FINAL CTA (only dark section) ───────────────────────────────────── */}
      <div ref={finalCta.ref} style={{
        ...finalCta.style,
        background: C.navy, padding: sectionPad(isMobile), textAlign: 'center',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 600, letterSpacing: -1.2, color: '#fff', marginBottom: 18, lineHeight: 1.1 }}>
            The legal AI platform that works for you, not against you.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.65)', marginBottom: 40, lineHeight: 1.6 }}>
            Free forever. Open source. No subscriptions.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            <Link href="/signup" style={{ ...navyBtn, background: '#fff', color: C.navy }}>Get Started Free</Link>
            <a href={GH} target="_blank" rel="noopener noreferrer" style={outlineBtn(true)}>View on GitHub</a>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Currently in beta. Do not upload highly sensitive or privileged documents.
          </p>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ background: C.bg, padding: isMobile ? '24px 20px' : '32px 48px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 20 : 0, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/logo.png" alt="Law OSS" width={24} height={24} style={{ objectFit: 'contain' }} unoptimized />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Law OSS</span>
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
        <div style={{ maxWidth: 1200, margin: '0 auto', borderTop: `1px solid ${C.border}`, paddingTop: 18, fontSize: 12, color: '#bbb' }}>
          © 2026 Law OSS. Open source.
        </div>
      </footer>

    </div>
  )
}
