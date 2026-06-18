'use client'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const Hero3D = dynamic(() => import('../components/Hero3D'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(circle, rgba(0,0,0,0.06) 0%, transparent 70%)',
      borderRadius: '50%',
    }} />
  ),
})

function useVisible(ref: React.RefObject<HTMLElement>) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return visible
}

const FEATURES = [
  {
    badge: 'Core feature',
    title: '6 AI Agents',
    desc: 'Research, Drafting, Contract, Litigation, Compliance, and Due Diligence agents. All powered by your own Claude or Gemini key.',
    highlight: true,
  },
  {
    badge: 'Any jurisdiction',
    title: 'Contract Review',
    desc: 'Upload any contract. Claude detects governing law automatically. Risk flags with redline language in 30 seconds.',
  },
  {
    badge: 'Verified only',
    title: 'Legal Research',
    desc: 'Verified case law from Casetext and BAILII. The only legal AI that cannot hallucinate a citation.',
  },
  {
    badge: 'Unique feature',
    title: 'Tabular Review',
    desc: 'Compare dozens of contracts side by side. Every finding cited to an exact page and quote.',
  },
  {
    badge: 'Not in competitors',
    title: 'Litigation Chronology',
    desc: 'Upload case documents. Get a full AI timeline with evidence tags, key event flags and win probability.',
  },
  {
    badge: 'Free forever',
    title: 'Bring Your Own Key',
    desc: 'Claude or Gemini. You pay the AI provider directly at approx $0.003 per task. We charge nothing.',
  },
]

const REASONS = [
  {
    title: 'The code is public',
    desc: 'Every line is on GitHub. Read exactly how prompts are built and how your data flows. No black boxes. Ever.',
  },
  {
    title: 'You pay AI directly',
    desc: 'Your API key connects your browser to Anthropic or Google. We never see your usage or charge you anything.',
  },
  {
    title: 'Any jurisdiction',
    desc: 'Works for US, UK, Australia, Canada, Singapore, UAE and anywhere else. Claude detects governing law automatically.',
  },
  {
    title: 'Your data stays yours',
    desc: 'Your API key is encrypted. Your documents are in your Supabase instance. We never train on your data.',
  },
]

export default function LandingPage() {
  const featuresRef = useRef<HTMLElement>(null)
  const howRef = useRef<HTMLElement>(null)
  const whyRef = useRef<HTMLElement>(null)
  const featuresVisible = useVisible(featuresRef)
  const howVisible = useVisible(howRef)
  const whyVisible = useVisible(whyRef)

  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
  }, [])

  const logo = '/logo.png'

  return (
    <div style={{
      minHeight: '100vh', background: '#ffffff',
      fontFamily: 'Inter, -apple-system, sans-serif', overflowX: 'hidden',
    }}>

      {/* Beta banner */}
      <div style={{
        background: '#f5f5f5', borderBottom: '1px solid #e5e5e5',
        padding: '9px 24px', textAlign: 'center',
        fontSize: '13px', color: '#555', zIndex: 100, position: 'relative',
      }}>
        Beta: Law OSS is in early access — do not upload sensitive or privileged documents.{' '}
        <Link href="/terms" style={{ color: '#000', fontWeight: 700, textDecoration: 'underline' }}>
          Read Terms
        </Link>
      </div>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: '64px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src={logo} alt="Law OSS" width={32} height={32} style={{ objectFit: 'contain' }} unoptimized />
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.5, color: '#0f0f0f' }}>
            Law OSS
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {[
            { label: 'Features', href: '#features' },
            { label: 'How it works', href: '#how' },
            { label: 'Why free', href: '#why' },
            { label: 'GitHub', href: 'https://github.com/YOUR_USERNAME/law-oss', external: true },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              style={{ fontSize: 14, color: '#666', textDecoration: 'none', fontWeight: 500 }}
              onMouseOver={e => (e.currentTarget.style.color = '#000')}
              onMouseOut={e => (e.currentTarget.style.color = '#666')}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/login" style={{
            padding: '0 18px', height: 38, display: 'inline-flex', alignItems: 'center',
            border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 13.5,
            textDecoration: 'none', color: '#333', fontWeight: 500,
          }}>Log in</Link>
          <Link href="/signup" style={{
            padding: '0 20px', height: 38, display: 'inline-flex', alignItems: 'center',
            background: '#0f0f0f', borderRadius: 8, fontSize: 13.5,
            textDecoration: 'none', color: '#fff', fontWeight: 600,
          }}>Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '92vh', display: 'grid', gridTemplateColumns: '1fr 1fr',
        alignItems: 'center', maxWidth: 1200, margin: '0 auto', padding: '0 48px', gap: 48,
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 24, padding: '5px 16px', fontSize: 12.5,
            color: '#444', fontWeight: 600, marginBottom: 28, letterSpacing: 0.2,
          }}>
            <Image src={logo} alt="" width={15} height={15} style={{ objectFit: 'contain' }} unoptimized />
            Open Source Legal AI · Beta
          </div>

          <h1 style={{
            fontSize: 58, fontWeight: 900, letterSpacing: -2,
            lineHeight: 1.05, color: '#0f0f0f', marginBottom: 22,
          }}>
            Legal AI you
            <br />
            <span style={{ color: '#0f0f0f', position: 'relative', display: 'inline-block' }}>
              actually own.
              <span style={{
                position: 'absolute', bottom: -4, left: 0, right: 0,
                height: 3, borderRadius: 2,
                background: '#0f0f0f',
              }} />
            </span>
          </h1>

          <p style={{ fontSize: 18, color: '#555', lineHeight: 1.7, marginBottom: 36, maxWidth: 460 }}>
            Free forever. Open source. Bring your own Claude or Gemini key.
            No subscriptions, no vendor lock-in, no data leaving your control.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
            <Link
              href="/signup"
              style={{
                padding: '0 28px', height: 50, display: 'inline-flex', alignItems: 'center',
                background: '#0f0f0f', borderRadius: 10, fontSize: 16,
                color: '#fff', fontWeight: 700, textDecoration: 'none',
              }}
            >
              Get started free
            </Link>
            <a
              href="https://github.com/YOUR_USERNAME/law-oss"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0 24px', height: 50, display: 'inline-flex', alignItems: 'center',
                border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 10, fontSize: 15,
                textDecoration: 'none', color: '#333', fontWeight: 500,
              }}
            >
              View on GitHub
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 12.5, color: '#aaa' }}>
            <span>Free forever</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ddd', display: 'inline-block' }} />
            <span>MIT Licensed</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#ddd', display: 'inline-block' }} />
            <span>Any jurisdiction</span>
          </div>
        </div>

        {/* 3D canvas */}
        <div style={{ height: '520px', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '380px', height: '380px',
            background: 'radial-gradient(circle, rgba(0,0,0,0.05) 0%, transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none',
          }} />
          {!reduced ? (
            <Hero3D />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image src={logo} alt="Law OSS" width={200} height={200} style={{ objectFit: 'contain', opacity: 0.6 }} unoptimized />
            </div>
          )}
        </div>
      </section>

      {/* Press bar */}
      <div style={{
        borderTop: '1px solid rgba(0,0,0,0.07)', borderBottom: '1px solid rgba(0,0,0,0.07)',
        padding: '18px 48px', display: 'flex', alignItems: 'center',
        gap: 48, justifyContent: 'center', background: '#fafafa',
      }}>
        <span style={{ fontSize: 11.5, color: '#bbb', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>
          Featured in
        </span>
        {['LawNext', 'Law.com', 'Law360', 'Legal IT Insider', 'AFR'].map(pub => (
          <span key={pub} style={{ fontSize: 14, color: '#bbb', fontWeight: 700, letterSpacing: -0.3, flexShrink: 0 }}>
            {pub}
          </span>
        ))}
      </div>

      {/* Features */}
      <section id="features" ref={featuresRef} style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, color: '#0f0f0f', marginBottom: 14 }}>
            Everything a lawyer needs.
            <br />
            <span style={{ color: '#0f0f0f' }}>Actually working.</span>
          </h2>
          <p style={{ fontSize: 17, color: '#666', maxWidth: 480, margin: '0 auto' }}>
            Eight specialist AI agents plus contract review, research and litigation tools — all in one place.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                background: f.highlight ? '#0f0f0f' : '#fff',
                border: `1px solid ${f.highlight ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 16, padding: '28px 24px', transition: 'all 0.2s',
                opacity: featuresVisible ? 1 : 0,
                transform: featuresVisible ? 'translateY(0)' : 'translateY(24px)',
                transitionDelay: `${i * 60}ms`,
              }}
              onMouseOver={e => {
                if (!f.highlight) {
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseOut={e => {
                if (!f.highlight) {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                background: f.highlight ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                color: f.highlight ? '#fff' : '#333',
                letterSpacing: 0.3, marginBottom: 16, textTransform: 'uppercase',
              }}>
                {f.badge}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: f.highlight ? '#fff' : '#0f0f0f' }}>
                {f.title}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: f.highlight ? 'rgba(255,255,255,0.65)' : '#666' }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" ref={howRef} style={{ background: '#fafafa', padding: '96px 48px', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, marginBottom: 14, color: '#0f0f0f' }}>
            Up and running in 3 minutes.
          </h2>
          <p style={{ fontSize: 16, color: '#666', marginBottom: 64 }}>
            No infrastructure. No setup. Just sign up and connect your API key.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 40, position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 28, left: '18%', right: '18%', height: 1,
              background: 'rgba(0,0,0,0.1)',
              zIndex: 0,
            }} />
            {[
              { num: '1', title: 'Create account', desc: 'Sign up free in 30 seconds. No credit card. No trial period. Free forever.' },
              { num: '2', title: 'Connect API key', desc: 'Add your Anthropic or Google key once. We encrypt it. You pay them directly.' },
              { num: '3', title: 'Use every feature', desc: '8 agents, contract review, research, litigation tools. All immediately.' },
            ].map((s, i) => (
              <div key={i} style={{
                position: 'relative', zIndex: 1,
                opacity: howVisible ? 1 : 0,
                transform: howVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: `all 0.4s ease ${i * 120}ms`,
              }}>
                <div style={{
                  width: 56, height: 56, background: '#0f0f0f', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 auto 18px',
                }}>{s.num}</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#0f0f0f' }}>{s.title}</div>
                <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why free */}
      <section id="why" ref={whyRef} style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, marginBottom: 20, color: '#0f0f0f' }}>
              Why is this free?
            </h2>
            <p style={{ fontSize: 16, color: '#555', lineHeight: 1.7, marginBottom: 28 }}>
              Enterprise legal AI platforms charge law firms tens of thousands per year.
              The core technology is Claude or Gemini plus a well-designed interface.
              That should not cost $50,000.
            </p>
            <p style={{ fontSize: 16, color: '#555', lineHeight: 1.7, marginBottom: 36 }}>
              A sole practitioner in Rawalpindi deserves the same AI tools as a partner at Clifford Chance.
              So we built this and made it free.
            </p>
            <Link href="/signup" style={{
              padding: '0 24px', height: 44, display: 'inline-flex', alignItems: 'center',
              background: '#0f0f0f', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
              color: '#fff', textDecoration: 'none',
            }}>Get started free</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {REASONS.map((r, i) => (
              <div key={i} style={{
                padding: '20px 22px', background: '#fff',
                border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
                opacity: whyVisible ? 1 : 0,
                transform: whyVisible ? 'translateX(0)' : 'translateX(20px)',
                transition: `all 0.4s ease ${i * 80}ms`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5, color: '#0f0f0f' }}>{r.title}</div>
                <div style={{ fontSize: 13.5, color: '#666', lineHeight: 1.55 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{
        background: '#0f0f0f', padding: '96px 48px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
          <Image
            src={logo} alt="Law OSS" width={48} height={48}
            style={{ objectFit: 'contain', marginBottom: 20, filter: 'brightness(0) invert(1)' }}
            unoptimized
          />
          <h2 style={{ fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: -1, marginBottom: 14 }}>
            Start using Law OSS today.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', marginBottom: 36, lineHeight: 1.6 }}>
            Free forever. Open source. No credit card. Works for any jurisdiction worldwide.
          </p>
          <Link href="/signup" style={{
            padding: '0 36px', height: 52, display: 'inline-flex', alignItems: 'center',
            background: '#fff', borderRadius: 10, fontSize: 16, fontWeight: 700,
            color: '#0f0f0f', textDecoration: 'none',
          }}>Get started free</Link>
          <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Currently in beta — use with caution for sensitive documents.
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#0a0a0a', padding: '32px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 13, color: '#555', borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image
            src={logo} alt="Law OSS" width={22} height={22}
            style={{ objectFit: 'contain', filter: 'brightness(0) invert(0.4)' }}
            unoptimized
          />
          <span style={{ color: '#555' }}>Law OSS — MIT Licensed — Open Source</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/terms" style={{ color: '#555', textDecoration: 'none' }}>Terms</Link>
          <a href="https://github.com/YOUR_USERNAME/law-oss" target="_blank" rel="noopener noreferrer" style={{ color: '#555', textDecoration: 'none' }}>GitHub</a>
        </div>
        <span style={{ color: '#444' }}>2025 Law OSS. Not legal advice.</span>
      </footer>
    </div>
  )
}
