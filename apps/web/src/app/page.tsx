'use client'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRef, useState, useEffect, useCallback } from 'react'

const OperatingSystem = dynamic(() => import('../components/OperatingSystem'), { ssr: false, loading: () => null })
const LazyCanvas = dynamic(() => import('../components/LazyCanvas'), { ssr: false })

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVis(true); return }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true) }, { threshold: 0.08 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return {
    ref,
    style: {
      opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(20px)',
      transition: 'opacity 0.6s ease, transform 0.6s ease',
    } as React.CSSProperties,
  }
}

const GH = 'https://github.com/jalalhaider550/Law-OSS'

const AGENTS = [
  {
    n: '01', title: 'Research',
    desc: 'Case law, statutes and regulations across any jurisdiction. Pulls from CourtListener for US cases and the National Archives for UK cases. Every citation traced and verified through the full court hierarchy.',
    icon: <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><circle cx="21" cy="21" r="13" stroke="currentColor" strokeWidth="2.5"/><path d="M31 31L42 42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M15 21h12M21 15v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  },
  {
    n: '02', title: 'Contract Review',
    desc: 'Clause-by-clause risk analysis — limitation of liability, IP ownership, data processing, termination rights and governing law. Flags issues, explains the risk, and suggests fixes.',
    icon: <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><rect x="8" y="6" width="28" height="36" rx="3" stroke="currentColor" strokeWidth="2.5"/><path d="M14 16h20M14 22h20M14 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="35" cy="35" r="7" fill="white" stroke="currentColor" strokeWidth="2"/><path d="M32 35l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    n: '03', title: 'Drafting',
    desc: 'Draft agreements, demand letters, motions, briefs and legal memos. Adapts to the procedural rules, court formats and professional standards of the relevant jurisdiction.',
    icon: <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><rect x="8" y="6" width="28" height="36" rx="3" stroke="currentColor" strokeWidth="2.5"/><path d="M14 16h20M14 22h20M14 28h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M34 34l6-6-3-3-6 6v3h3z" fill="currentColor"/></svg>,
  },
  {
    n: '04', title: 'Litigation',
    desc: 'Case strategy, evidence mapping, witness analysis and chronologies. Understands civil procedure rules across jurisdictions — discovery, expert evidence, interlocutory applications and trial preparation.',
    icon: <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><path d="M24 6L8 16v4h32v-4L24 6z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><rect x="14" y="20" width="5" height="16" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="21.5" y="20" width="5" height="16" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="29" y="20" width="5" height="16" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M8 36h32M5 40h38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  },
  {
    n: '05', title: 'Compliance',
    desc: 'Regulatory gap analysis across frameworks — data protection, financial services, employment, environmental and sector-specific rules. Maps obligations, penalties and required policies for your entity.',
    icon: <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><path d="M24 4L6 12v10c0 12 7.5 21 18 24 10.5-3 18-12 18-24V12L24 4z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><path d="M16 24l5 5 11-11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    n: '06', title: 'Due Diligence',
    desc: 'Transaction and corporate review — ownership structures, director obligations, IP chains, employment liabilities and regulatory exposure. Surfaces risk nodes across the entity before you sign.',
    icon: <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" strokeWidth="2.5"/><path d="M14 18h20M14 24h20M14 30h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="35" cy="13" r="5" fill="currentColor"/><path d="M33 13l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]

const TICKER = ['Any Jurisdiction', 'Powered by Claude', 'Powered by Gemini', 'Your API Keys', 'Data Stays Private', 'Open Source', 'No Subscription', 'Self-Hostable']

export default function LandingPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [verified, setVerified] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const s1 = useFadeIn(); const s2 = useFadeIn(); const s3 = useFadeIn()
  const s4 = useFadeIn(); const s5 = useFadeIn()

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    fn(); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn)
  }, [])

  // Detect arrival from Supabase email verification link.
  // Supabase puts tokens in the URL hash (implicit flow) or query string.
  useEffect(() => {
    const q = window.location.search + '&' + window.location.hash.replace(/^#/, '')
    if (/(^|[?&#])(type=signup|access_token=|token_hash=)/.test(q)) {
      setVerified(true)
    }
  }, [])

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); setStatus('sending')
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      setStatus(r.ok ? 'sent' : 'error')
      if (r.ok) setForm({ name: '', email: '', message: '' })
    } catch { setStatus('error') }
  }, [form])

  const P = isMobile ? '64px 24px' : '112px 64px'

  return (
    <div style={{ fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,sans-serif', background: '#fff', color: '#0f0f0f', overflowX: 'hidden' }}>

      {/* Email-verified banner (shown only when arriving from Supabase verify link) */}
      {verified && (
        <div
          role="status"
          style={{
            position: 'sticky', top: 0, zIndex: 101,
            background: '#e8f7ee', color: '#0a5d2a',
            borderBottom: '1px solid #b7e2c5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 16, padding: isMobile ? '10px 16px' : '12px 24px',
            fontSize: isMobile ? 14 : 15, fontWeight: 500,
            flexWrap: 'wrap', textAlign: 'center',
          }}
        >
          <span>✓ Account created and email confirmed. Continue to sign in.</span>
          <Link
            href="/login"
            style={{
              background: '#0a5d2a', color: '#fff',
              padding: '6px 14px', borderRadius: 6,
              textDecoration: 'none', fontWeight: 600, fontSize: 14,
            }}
          >
            Sign in
          </Link>
        </div>
      )}

      <style>{`
        @keyframes tk { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 20px' : '0 64px', height: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/logo.png" alt="Law OSS" width={24} height={24} style={{ objectFit: 'contain' }} unoptimized />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.3 }}>Law OSS</span>
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', gap: 32 }}>
            {[['Agents', '#agents'], ['Pricing', '#pricing'], ['GitHub', GH]].map(([l, h]) => (
              <a key={l} href={h} target={h.startsWith('http') ? '_blank' : undefined} rel={h.startsWith('http') ? 'noopener noreferrer' : undefined}
                style={{ fontSize: 13.5, color: '#888', textDecoration: 'none', fontWeight: 500 }}
                onMouseOver={e => (e.currentTarget.style.color = '#0f0f0f')}
                onMouseOut={e => (e.currentTarget.style.color = '#888')}>{l}</a>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isMobile && (
            <Link href="/login" style={{ fontSize: 13.5, color: '#666', textDecoration: 'none', padding: '0 14px', height: 36, display: 'inline-flex', alignItems: 'center', border: '1px solid #e5e5e5', borderRadius: 7, fontWeight: 500 }}>
              Sign in
            </Link>
          )}
          <Link href="/signup" style={{ fontSize: 13.5, color: '#fff', background: '#0f0f0f', textDecoration: 'none', padding: '0 16px', height: 36, display: 'inline-flex', alignItems: 'center', borderRadius: 7, fontWeight: 600 }}>
            Get started
          </Link>
          {isMobile && (
            <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: '1px solid #eee', borderRadius: 6, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#333' }}>
              {menuOpen ? '✕' : '☰'}
            </button>
          )}
        </div>
      </nav>

      {isMobile && menuOpen && (
        <div style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 90, background: '#fff', borderBottom: '1px solid #eee', padding: '8px 20px' }}>
          {[['Agents', '#agents'], ['Pricing', '#pricing'], ['Sign in', '/login'], ['GitHub', GH]].map(([l, h]) => (
            <a key={l} href={h} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '13px 0', fontSize: 15, color: '#0f0f0f', textDecoration: 'none', borderBottom: '1px solid #f5f5f5', fontWeight: 500 }}>{l}</a>
          ))}
        </div>
      )}

      {/* HERO */}
      <div ref={s1.ref} style={{ ...s1.style, padding: isMobile ? '80px 24px 64px' : '0 64px', minHeight: isMobile ? 'auto' : '90vh', display: 'flex', alignItems: 'center', position: 'relative' }}>
        {/* Grid background */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#f0f0f0 1px,transparent 1px),linear-gradient(90deg,#f0f0f0 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none', opacity: 0.6 }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', border: '1px solid #e5e5e5', borderRadius: 100, fontSize: 12, fontWeight: 600, color: '#666', letterSpacing: 0.5, marginBottom: 32, background: '#fff' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0f0f0f', display: 'inline-block' }} />
            Legal AI Platform · Open Source
          </div>
          <h1 style={{ fontSize: isMobile ? 38 : 72, fontWeight: 800, letterSpacing: isMobile ? -1.5 : -3, lineHeight: 1.0, color: '#0f0f0f', marginBottom: 28 }}>
            Legal AI that works<br />the way lawyers do.
          </h1>
          <p style={{ fontSize: isMobile ? 16 : 20, lineHeight: 1.65, color: '#666', marginBottom: 40, maxWidth: 540, margin: '0 auto 40px' }}>
            Research cases, review contracts, draft documents and run due diligence — powered by Claude or Gemini. Your keys, your data. No subscription.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{ padding: '0 28px', height: 52, display: 'inline-flex', alignItems: 'center', background: '#0f0f0f', borderRadius: 10, fontSize: 15, color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
              Get started free
            </Link>
            <a href={GH} target="_blank" rel="noopener noreferrer" style={{ padding: '0 24px', height: 52, display: 'inline-flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: 10, fontSize: 15, color: '#333', fontWeight: 500, textDecoration: 'none', background: '#fff' }}>
              View on GitHub →
            </a>
          </div>
          <p style={{ fontSize: 13, color: '#bbb', marginTop: 20 }}>No credit card · No per-seat pricing · You pay only your AI provider</p>
        </div>
      </div>

      {/* TICKER */}
      <div style={{ borderTop: '1px solid #eee', borderBottom: '1px solid #eee', background: '#fafafa', overflow: 'hidden' }}>
        <div style={{ display: 'flex', animation: 'tk 30s linear infinite', width: 'max-content', padding: '14px 0' }}>
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} style={{ fontSize: 12.5, fontWeight: 600, color: '#888', whiteSpace: 'nowrap', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#0f0f0f' }}>—</span>{t}
            </span>
          ))}
        </div>
      </div>

      {/* 6 AGENTS */}
      <div id="agents" ref={s2.ref} style={{ ...s2.style, padding: P }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: '#aaa', textTransform: 'uppercase', marginBottom: 14 }}>Specialist Agents</p>
          <h2 style={{ fontSize: isMobile ? 28 : 48, fontWeight: 800, letterSpacing: isMobile ? -1 : -2, color: '#0f0f0f', marginBottom: 12 }}>
            Six agents. Every legal task.
          </h2>
          <p style={{ fontSize: 16, color: '#888', lineHeight: 1.65, maxWidth: 520, marginBottom: 56 }}>
            Each agent is purpose-built for a legal workflow. They use your API key, work across any jurisdiction, and never store your data.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 0, border: '1px solid #eee', borderRadius: 16, overflow: 'hidden' }}>
            {AGENTS.map((a, i) => {
              const borderRight = !isMobile && (i % 3 !== 2) ? '1px solid #eee' : 'none'
              const borderBottom = isMobile ? (i < 5 ? '1px solid #eee' : 'none') : (i < 3 ? '1px solid #eee' : 'none')
              return (
                <div key={i} style={{ padding: '32px 28px', background: '#fff', borderRight, borderBottom, position: 'relative', overflow: 'hidden', transition: 'background 0.15s' }}
                  onMouseOver={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
                  onMouseOut={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
                  {/* Ghost number */}
                  <div style={{ position: 'absolute', right: -4, bottom: -8, fontSize: 96, fontWeight: 900, color: 'rgba(0,0,0,0.03)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>{a.n}</div>
                  <div style={{ color: '#0f0f0f', marginBottom: 16, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 10 }}>{a.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f0f0f', marginBottom: 8 }}>{a.title}</div>
                  <p style={{ fontSize: 13.5, color: '#888', lineHeight: 1.65 }}>{a.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* HOSTED / SELF-HOSTED */}
      <div id="pricing" ref={s3.ref} style={{ ...s3.style, padding: P, background: '#fafafa', borderTop: '1px solid #eee' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: '#aaa', textTransform: 'uppercase', marginBottom: 14 }}>Deployment</p>
          <h2 style={{ fontSize: isMobile ? 28 : 48, fontWeight: 800, letterSpacing: isMobile ? -1 : -2, color: '#0f0f0f', marginBottom: 12 }}>
            Hosted, or self-hosted.
          </h2>
          <p style={{ fontSize: 16, color: '#888', lineHeight: 1.65, maxWidth: 480, marginBottom: 56 }}>
            Start on lawoss.com instantly, or clone the repo and run it on your own infrastructure.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {/* Hosted — black */}
            <div style={{ background: '#0f0f0f', borderRadius: 16, padding: isMobile ? '36px 28px 40px' : '44px 40px 48px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>Recommended</div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 20 }}>Hosted</p>
              <h3 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#fff', letterSpacing: -0.8, marginBottom: 10 }}>lawoss.com</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: 32 }}>
                Sign up and start working immediately. No setup, no infrastructure, no maintenance.
              </p>
              <ul style={{ listStyle: 'none', marginBottom: 36, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Instant access — no setup required', 'Automatic updates', 'Free to use', 'Your keys go directly to the AI provider'].map((t, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2"/><path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 24px', height: 46, background: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#0f0f0f', textDecoration: 'none' }}>
                Get started free →
              </Link>
            </div>

            {/* Self-hosted — white */}
            <div style={{ background: '#fff', borderRadius: 16, padding: isMobile ? '36px 28px 40px' : '44px 40px 48px', border: '1px solid #e5e5e5' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#ccc', textTransform: 'uppercase', marginBottom: 20 }}>Self-Hosted</p>
              <h3 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#0f0f0f', letterSpacing: -0.8, marginBottom: 10 }}>Your infrastructure</h3>
              <p style={{ fontSize: 15, color: '#999', lineHeight: 1.7, marginBottom: 32 }}>
                Clone the repo and deploy on your own servers. Full control over your data, models, and environment.
              </p>
              <ul style={{ listStyle: 'none', marginBottom: 36, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Complete data sovereignty', 'Run air-gapped if needed', 'Customise agents and prompts', 'Open source — clone and self-host'].map((t, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#666' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#ddd" strokeWidth="1.2"/><path d="M5 8l2 2 4-4" stroke="#0f0f0f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {t}
                  </li>
                ))}
              </ul>
              <a href={GH} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 24px', height: 46, border: '1.5px solid #0f0f0f', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#0f0f0f', textDecoration: 'none' }}>
                View on GitHub →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* FINAL CTA — Legal work unified (3D kept here only) */}
      <div ref={s4.ref} style={{ ...s4.style, background: '#0f0f0f', padding: P, textAlign: 'center' as const }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: '#444', textTransform: 'uppercase', marginBottom: 16 }}>The Operating System</p>
          <h2 style={{ fontSize: isMobile ? 30 : 56, fontWeight: 800, letterSpacing: isMobile ? -1 : -2.5, color: '#fff', marginBottom: 16, lineHeight: 1.0 }}>
            Legal work, unified.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', lineHeight: 1.65, marginBottom: 48 }}>
            Research, Contracts, Matters, Compliance, Due Diligence and Litigation — six separate worlds, one operating system.
          </p>
          <LazyCanvas height={isMobile ? 280 : 420}><OperatingSystem /></LazyCanvas>
          <div style={{ marginTop: 48, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{ padding: '0 28px', height: 50, display: 'inline-flex', alignItems: 'center', background: '#fff', borderRadius: 10, fontSize: 15, color: '#0f0f0f', fontWeight: 700, textDecoration: 'none' }}>
              Get started free
            </Link>
            <a href={GH} target="_blank" rel="noopener noreferrer" style={{ padding: '0 24px', height: 50, display: 'inline-flex', alignItems: 'center', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 10, fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 500, textDecoration: 'none' }}>
              View on GitHub →
            </a>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', marginTop: 24 }}>Beta · Do not upload highly sensitive or privileged documents.</p>
        </div>
      </div>

      {/* CONTACT */}
      <div id="contact" ref={s5.ref} style={{ ...s5.style, padding: P, borderTop: '1px solid #eee' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: '#aaa', textTransform: 'uppercase', marginBottom: 14 }}>Contact</p>
          <h2 style={{ fontSize: isMobile ? 26 : 36, fontWeight: 800, letterSpacing: -1, color: '#0f0f0f', marginBottom: 36 }}>How can we help?</h2>
          {status === 'sent' ? (
            <div style={{ padding: '18px 20px', background: '#fafafa', borderRadius: 10, border: '1px solid #eee', fontSize: 15, color: '#333' }}>Message sent — we'll be in touch.</div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[{ id: 'name', label: 'Name', type: 'text', ph: 'Your name' }, { id: 'email', label: 'Email', type: 'email', ph: 'your@email.com' }].map(f => (
                <div key={f.id}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type} required value={(form as Record<string,string>)[f.id]} onChange={e => setForm(p => ({ ...p, [f.id]: e.target.value }))}
                    placeholder={f.ph} style={{ width: '100%', padding: '11px 14px', fontSize: 15, border: '1px solid #e5e5e5', borderRadius: 8, fontFamily: 'inherit', background: '#fff', color: '#0f0f0f', outline: 'none' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Message</label>
                <textarea required value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="How can we help?" style={{ width: '100%', padding: '11px 14px', fontSize: 15, border: '1px solid #e5e5e5', borderRadius: 8, fontFamily: 'inherit', background: '#fff', color: '#0f0f0f', outline: 'none', minHeight: 120, resize: 'vertical' }} />
              </div>
              {status === 'error' && <p style={{ fontSize: 13, color: '#c00' }}>Could not send. Please try again.</p>}
              <button type="submit" disabled={status === 'sending'}
                style={{ padding: '0 24px', height: 48, background: '#0f0f0f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', width: 'fit-content', opacity: status === 'sending' ? 0.6 : 1 }}>
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: '#fafafa', borderTop: '1px solid #eee', padding: isMobile ? '28px 20px' : '32px 64px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image src="/logo.png" alt="Law OSS" width={20} height={20} style={{ objectFit: 'contain' }} unoptimized />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f0f0f' }}>Law OSS</span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['Agents', '#agents'], ['Pricing', '#pricing'], ['Terms', '/terms'], ['Contact', '#contact'], ['GitHub', GH]].map(([l, h]) => (
              <a key={l} href={h} target={h.startsWith('http') ? '_blank' : undefined} rel={h.startsWith('http') ? 'noopener noreferrer' : undefined}
                style={{ fontSize: 13, color: '#aaa', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: '16px auto 0', paddingTop: 16, borderTop: '1px solid #eee', fontSize: 12, color: '#ccc' }}>
          © 2026 Law OSS · Open source · Not legal advice
        </div>
      </footer>

    </div>
  )
}
