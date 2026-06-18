'use client'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRef, useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const KnowledgeGraph = dynamic(() => import('../components/KnowledgeGraph'), { ssr: false, loading: () => null })
const CitationConstellation = dynamic(() => import('../components/CitationConstellation'), { ssr: false, loading: () => null })
const TimelineTunnel = dynamic(() => import('../components/TimelineTunnel'), { ssr: false, loading: () => null })
const ExplodedContract = dynamic(() => import('../components/ExplodedContract'), { ssr: false, loading: () => null })
const TransparentEngine = dynamic(() => import('../components/TransparentEngine'), { ssr: false, loading: () => null })
const LazyCanvas = dynamic(() => import('../components/LazyCanvas'), { ssr: false })

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    opacity: 0,
    transform: 'translateY(24px)',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
  })

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setStyle({})
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStyle({ opacity: 1, transform: 'translateY(0)', transition: 'opacity 0.6s ease, transform 0.6s ease' })
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return { ref, style }
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  Research: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="21" cy="21" r="13" stroke="#0a0a0a" strokeWidth="2.5"/>
      <path d="M31 31L42 42" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M15 21h12M21 15v12" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Drafting: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="6" width="28" height="36" rx="3" stroke="#0a0a0a" strokeWidth="2.5"/>
      <path d="M14 16h20M14 22h20M14 28h14" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round"/>
      <path d="M34 34l6-6-3-3-6 6v3h3z" fill="#0a0a0a"/>
    </svg>
  ),
  Contract: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="6" width="28" height="36" rx="3" stroke="#0a0a0a" strokeWidth="2.5"/>
      <path d="M14 16h20M14 22h20M14 28h10" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="35" cy="35" r="7" fill="#fff" stroke="#0a0a0a" strokeWidth="2"/>
      <path d="M32 35l2 2 4-4" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Litigation: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M24 6L8 16v4h32v-4L24 6z" stroke="#0a0a0a" strokeWidth="2.5" strokeLinejoin="round"/>
      <rect x="14" y="20" width="5" height="16" rx="1" fill="#0a0a0a" opacity=".15" stroke="#0a0a0a" strokeWidth="2"/>
      <rect x="21.5" y="20" width="5" height="16" rx="1" fill="#0a0a0a" opacity=".15" stroke="#0a0a0a" strokeWidth="2"/>
      <rect x="29" y="20" width="5" height="16" rx="1" fill="#0a0a0a" opacity=".15" stroke="#0a0a0a" strokeWidth="2"/>
      <path d="M8 36h32" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M5 40h38" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  Compliance: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M24 4L6 12v10c0 12 7.5 21 18 24 10.5-3 18-12 18-24V12L24 4z" stroke="#0a0a0a" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M16 24l5 5 11-11" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'Due Diligence': (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="6" width="36" height="36" rx="4" stroke="#0a0a0a" strokeWidth="2.5"/>
      <path d="M14 18h20M14 24h20M14 30h12" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="35" cy="13" r="5" fill="#0a0a0a"/>
      <path d="M33 13l1.5 1.5 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
}

const AGENTS = [
  { num: '01', title: 'Research', desc: 'Finds and explains real case law from CourtListener, BAILII and The National Archives. Every citation verified.' },
  { num: '02', title: 'Drafting', desc: 'Drafts letters, agreements, motions and briefs. Consistent with jurisdiction and house style.' },
  { num: '03', title: 'Contract', desc: 'Reviews contracts clause by clause. Risk flags, redline language and governing law detected automatically.' },
  { num: '04', title: 'Litigation', desc: 'Analyses disputes, builds chronologies, maps evidence and estimates case strength.' },
  { num: '05', title: 'Compliance', desc: 'Identifies applicable regulations across jurisdictions. Flags gaps between policy and legal obligation.' },
  { num: '06', title: 'Due Diligence', desc: 'Generates structured findings reports from document bundles. Every finding cited to source.' },
]

export default function LandingPage() {
  const hero = useFadeIn()
  const trust = useFadeIn()
  const research = useFadeIn()
  const litigation = useFadeIn()
  const contract = useFadeIn()
  const agents = useFadeIn()
  const openSource = useFadeIn()
  const howItWorks = useFadeIn()
  const contactSection = useFadeIn()
  const finalCta = useFadeIn()

  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Detect mobile
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setFormStatus('sent')
        setFormData({ name: '', email: '', message: '' })
      } else {
        setFormStatus('error')
      }
    } catch {
      setFormStatus('error')
    }
  }, [formData])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', fontSize: 15,
    border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8,
    fontFamily: 'Inter, -apple-system, sans-serif',
    background: '#fff', color: '#0a0a0a', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: 'Inter, -apple-system, sans-serif', overflowX: 'hidden' }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 20px' : '0 48px', height: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/logo.png" alt="Law OSS" width={28} height={28} style={{ objectFit: 'contain' }} unoptimized />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.4, color: '#0a0a0a' }}>Law OSS</span>
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {[
              { label: 'Research', href: '#research' },
              { label: 'Litigation', href: '#litigation' },
              { label: 'Contracts', href: '#contracts' },
              { label: 'Open Source', href: '#open-source' },
              { label: 'Contact', href: '#contact' },
            ].map(item => (
              <a key={item.label} href={item.href} style={{ fontSize: 14, color: '#555', textDecoration: 'none', fontWeight: 500 }}
                onMouseOver={e => (e.currentTarget.style.color = '#0a0a0a')}
                onMouseOut={e => (e.currentTarget.style.color = '#555')}>
                {item.label}
              </a>
            ))}
          </div>
        )}

        {isMobile ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/signup" style={{ padding: '0 14px', height: 36, display: 'inline-flex', alignItems: 'center', background: '#0a0a0a', borderRadius: 7, fontSize: 13, textDecoration: 'none', color: '#fff', fontWeight: 600 }}>
              Get started
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 7, width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://github.com/YOUR_USERNAME/law-oss" target="_blank" rel="noopener noreferrer"
              style={{ padding: '0 16px', height: 38, display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 13.5, textDecoration: 'none', color: '#333', fontWeight: 500 }}>
              GitHub
            </a>
            <Link href="/login" style={{ padding: '0 16px', height: 38, display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 13.5, textDecoration: 'none', color: '#333', fontWeight: 500 }}>
              Sign in
            </Link>
            <Link href="/signup" style={{ padding: '0 20px', height: 38, display: 'inline-flex', alignItems: 'center', background: '#0a0a0a', borderRadius: 8, fontSize: 13.5, textDecoration: 'none', color: '#fff', fontWeight: 600 }}>
              Get started
            </Link>
          </div>
        )}
      </nav>

      {/* MOBILE MENU */}
      {isMobile && menuOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99, background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.1)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { label: 'Research', href: '#research' },
            { label: 'Litigation', href: '#litigation' },
            { label: 'Contracts', href: '#contracts' },
            { label: 'Open Source', href: '#open-source' },
            { label: 'Contact', href: '#contact' },
            { label: 'Sign in', href: '/login' },
          ].map((item, i) => (
            <a key={i} href={item.href} onClick={() => setMenuOpen(false)}
              style={{ padding: '14px 0', fontSize: 16, fontWeight: 500, color: '#0a0a0a', textDecoration: 'none', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {item.label}
            </a>
          ))}
        </div>
      )}

      {/* HERO */}
      <div ref={hero.ref} style={{
        ...hero.style,
        minHeight: isMobile ? 'auto' : '90vh',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        alignItems: 'center', maxWidth: 1200, margin: '0 auto',
        padding: isMobile ? '60px 24px 40px' : '0 48px', gap: isMobile ? 32 : 64,
      }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: '#888', textTransform: 'uppercase', marginBottom: 24 }}>
            The operating system for legal intelligence
          </p>
          <h1 style={{ fontSize: isMobile ? 38 : 60, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05, color: '#0a0a0a', marginBottom: 24 }}>
            Every authority.<br />Every citation.<br />Connected.
          </h1>
          <p style={{ fontSize: 17, color: '#555', lineHeight: 1.6, marginBottom: 36, maxWidth: 440 }}>
            Open source legal AI grounded in real authority. CourtListener, BAILII and The National Archives. Your data never leaves your control.
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
            <Link href="/signup" style={{ padding: '0 28px', height: 50, display: 'inline-flex', alignItems: 'center', background: '#0a0a0a', borderRadius: 8, fontSize: 15, color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
              Get started
            </Link>
            <a href="https://github.com/YOUR_USERNAME/law-oss" target="_blank" rel="noopener noreferrer"
              style={{ padding: '0 24px', height: 50, display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(0,0,0,0.18)', borderRadius: 8, fontSize: 15, color: '#333', fontWeight: 500, textDecoration: 'none' }}>
              View on GitHub
            </a>
          </div>
          <p style={{ fontSize: 13, color: '#aaa' }}>Open source. MIT licensed. Free forever.</p>
        </div>

        <div style={{ position: 'relative', height: 560 }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 420, height: 420,
            background: 'radial-gradient(circle, rgba(26,46,110,0.08) 0%, transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
          }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
            <LazyCanvas height={560}>
              <KnowledgeGraph />
            </LazyCanvas>
          </div>
        </div>
      </div>

      {/* TRUST LINE */}
      <div ref={trust.ref} style={{
        ...trust.style,
        borderTop: '1px solid rgba(0,0,0,0.08)', borderBottom: '1px solid rgba(0,0,0,0.08)',
        padding: '20px 48px', textAlign: 'center', fontSize: 14, color: '#888',
      }}>
        Verified case law from CourtListener, BAILII and The National Archives. Your data never leaves your control.
      </div>

      {/* RESEARCH */}
      <div id="research" ref={research.ref} style={{
        ...research.style,
        background: '#0a0a0a', padding: isMobile ? '60px 24px' : '120px 48px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 40 : 80, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: '#666', textTransform: 'uppercase', marginBottom: 20 }}>
              Verified legal research
            </p>
            <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 600, letterSpacing: -1, color: '#ffffff', marginBottom: 24, lineHeight: 1.15 }}>
              Research grounded in real authority.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 16 }}>
              Every citation verified against CourtListener and BAILII before it reaches you. No hallucinated cases. No made-up references.
            </p>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              The National Archives provides primary legislation. You get the full chain of authority, verifiable and linked.
            </p>
          </div>
          <div>
            <LazyCanvas height={480}>
              <CitationConstellation />
            </LazyCanvas>
          </div>
        </div>
      </div>

      {/* LITIGATION */}
      <div id="litigation" ref={litigation.ref} style={{
        ...litigation.style,
        background: '#ffffff', padding: isMobile ? '60px 24px' : '120px 48px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 40 : 80, alignItems: 'center' }}>
          <div>
            <LazyCanvas height={480}>
              <TimelineTunnel />
            </LazyCanvas>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: '#888', textTransform: 'uppercase', marginBottom: 20 }}>
              Litigation chronology
            </p>
            <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 600, letterSpacing: -1, color: '#0a0a0a', marginBottom: 24, lineHeight: 1.15 }}>
              Every case has a timeline. We build it.
            </h2>
            <p style={{ fontSize: 17, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
              Upload case documents. The litigation agent extracts every event, maps evidence and constructs a chronology from first contact to judgment.
            </p>
            <p style={{ fontSize: 17, color: '#555', lineHeight: 1.6 }}>
              Contract Signed. Breach. Notice. Claim. Judgment. Every node cited to the document it came from.
            </p>
          </div>
        </div>
      </div>

      {/* CONTRACT */}
      <div id="contracts" ref={contract.ref} style={{
        ...contract.style,
        background: '#0a0a0a', padding: isMobile ? '60px 24px' : '120px 48px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 40 : 80, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: '#666', textTransform: 'uppercase', marginBottom: 20 }}>
              Contract review
            </p>
            <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 600, letterSpacing: -1, color: '#ffffff', marginBottom: 24, lineHeight: 1.15 }}>
              Contracts, taken apart and understood.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 16 }}>
              Every clause reviewed individually. Risk clauses flagged. Governing law detected automatically from the document itself.
            </p>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              Redline language generated for every risk finding. Nothing hidden. Nothing assumed.
            </p>
          </div>
          <div>
            <LazyCanvas height={480}>
              <ExplodedContract />
            </LazyCanvas>
          </div>
        </div>
      </div>

      {/* AGENTS */}
      <div ref={agents.ref} style={{
        ...agents.style,
        background: '#ffffff', padding: isMobile ? '60px 24px' : '120px 48px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: '#888', textTransform: 'uppercase', marginBottom: 20 }}>
            Specialist agents
          </p>
          <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 600, letterSpacing: -1, color: '#0a0a0a', marginBottom: 64, lineHeight: 1.15 }}>
            Six agents. Every legal task covered.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0 }}>
            {AGENTS.map((agent, i) => (
              <div key={i} style={{
                padding: '40px 0',
                borderTop: '1px solid rgba(0,0,0,0.1)',
                borderRight: !isMobile && i % 2 === 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                paddingRight: !isMobile && i % 2 === 0 ? 48 : 0,
                paddingLeft: !isMobile && i % 2 === 1 ? 48 : 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 56, height: 56, background: '#f5f5f5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {AGENT_ICONS[agent.title]}
                  </div>
                  <div style={{ fontSize: 48, fontWeight: 700, color: '#ebebeb', lineHeight: 1 }}>
                    {agent.num}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0a', marginBottom: 12 }}>
                  {agent.title}
                </div>
                <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6, maxWidth: 380 }}>
                  {agent.desc}
                </p>
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.1)' }} />
          </div>
        </div>
      </div>

      {/* OPEN SOURCE */}
      <div id="open-source" ref={openSource.ref} style={{
        ...openSource.style,
        background: '#0a0a0a', padding: '120px 48px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <LazyCanvas height={480}>
              <TransparentEngine />
            </LazyCanvas>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: '#666', textTransform: 'uppercase', marginBottom: 20 }}>
              Open source
            </p>
            <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 600, letterSpacing: -1, color: '#ffffff', marginBottom: 24, lineHeight: 1.15 }}>
              No black boxes. Look inside.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 16 }}>
              Every component visible. Models, Rules, Citations, Agents, Knowledge Graph — all inspectable on GitHub.
            </p>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 36 }}>
              MIT licensed. Fork it. Audit it. Deploy your own instance. The code is yours.
            </p>
            <a href="https://github.com/YOUR_USERNAME/law-oss" target="_blank" rel="noopener noreferrer"
              style={{ padding: '0 24px', height: 46, display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, fontSize: 14, color: '#fff', fontWeight: 500, textDecoration: 'none' }}>
              View source on GitHub
            </a>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div ref={howItWorks.ref} style={{
        ...howItWorks.style,
        background: '#ffffff', padding: isMobile ? '60px 24px' : '120px 48px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: '#888', textTransform: 'uppercase', marginBottom: 20 }}>
            Getting started
          </p>
          <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 600, letterSpacing: -1, color: '#0a0a0a', marginBottom: 64, lineHeight: 1.15 }}>
            Three steps. That is it.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 0 }}>
            {[
              { num: '01', title: 'Create an account', desc: 'Free. No credit card. No trial period.' },
              { num: '02', title: 'Connect your key', desc: 'Add Claude or Gemini. Encrypted. You pay the provider directly.' },
              { num: '03', title: 'Start working', desc: 'Every feature immediately available.' },
            ].map((step, i) => (
              <div key={i} style={{
                padding: '0 48px 0 0',
                borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                paddingLeft: i > 0 ? 48 : 0,
              }}>
                <div style={{ fontSize: 56, fontWeight: 700, color: '#eee', lineHeight: 1, marginBottom: 20 }}>
                  {step.num}
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0a', marginBottom: 12 }}>
                  {step.title}
                </div>
                <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CONTACT */}
      <div id="contact" ref={contactSection.ref} style={{
        ...contactSection.style,
        background: '#ffffff', padding: isMobile ? '60px 24px' : '120px 48px',
        borderTop: '1px solid rgba(0,0,0,0.08)',
      }}>
        <div style={{ maxWidth: 600 }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, color: '#888', textTransform: 'uppercase', marginBottom: 20 }}>
            Contact
          </p>
          <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 600, letterSpacing: -1, color: '#0a0a0a', marginBottom: 40, lineHeight: 1.15 }}>
            Get in touch.
          </h2>

          {formStatus === 'sent' ? (
            <div style={{ padding: '24px', background: '#f5f5f5', borderRadius: 8, fontSize: 15, color: '#333' }}>
              Message sent. We will be in touch shortly.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 }}>Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  style={inputStyle}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 }}>Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  style={inputStyle}
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 }}>Message</label>
                <textarea
                  required
                  value={formData.message}
                  onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
                  placeholder="How can we help?"
                />
              </div>
              {formStatus === 'error' && (
                <p style={{ fontSize: 13, color: '#c00' }}>Could not send. Please try again.</p>
              )}
              <div>
                <button
                  type="submit"
                  disabled={formStatus === 'sending'}
                  style={{
                    padding: '0 28px', height: 46, background: '#0a0a0a', color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: formStatus === 'sending' ? 'wait' : 'pointer',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                  }}
                >
                  {formStatus === 'sending' ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* FINAL CTA */}
      <div ref={finalCta.ref} style={{
        ...finalCta.style,
        background: '#0a0a0a', padding: isMobile ? '60px 24px' : '120px 48px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 600, letterSpacing: -1, color: '#ffffff', marginBottom: 20, lineHeight: 1.15 }}>
            The operating system for legal intelligence.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', marginBottom: 40, lineHeight: 1.6 }}>
            Free forever. Open source. No credit card.
          </p>
          <Link href="/signup" style={{
            padding: '0 36px', height: 52, display: 'inline-flex', alignItems: 'center',
            background: '#ffffff', borderRadius: 8, fontSize: 15, fontWeight: 600,
            color: '#0a0a0a', textDecoration: 'none',
          }}>
            Get started
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{
        background: '#ffffff', padding: isMobile ? '24px 20px' : '32px 48px',
        borderTop: '1px solid rgba(0,0,0,0.1)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 16 : 0, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/logo.png" alt="Law OSS" width={24} height={24} style={{ objectFit: 'contain' }} unoptimized />
            <span style={{ fontSize: 14, color: '#555' }}>Law OSS — MIT Licensed. Open source legal AI.</span>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <a href="#research" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Research</a>
            <a href="#litigation" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Litigation</a>
            <a href="#contracts" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Contracts</a>
            <Link href="/terms" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Terms</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="https://github.com/YOUR_USERNAME/law-oss" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>GitHub</a>
            <span style={{ fontSize: 12, color: '#bbb' }}>Currently in beta</span>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '0 auto', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 20, fontSize: 12, color: '#bbb' }}>
          2025 Law OSS. Not legal advice. Provided as is without warranty.
        </div>
      </footer>

    </div>
  )
}
