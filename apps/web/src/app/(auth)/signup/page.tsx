'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

const inp: React.CSSProperties = {
  width: '100%', height: 40, border: '1.5px solid rgba(0,0,0,0.14)',
  borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none',
  background: '#f8f8f8', color: '#0f0f0f',
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
      else setChecking(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    })
    if (error) { setError(error.message); setLoading(false) }
    else setDone(true)
  }

  if (checking) return null

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8f8f8', padding: '24px',
      }}>
        <div style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420,
          padding: '48px 40px', textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#1a2e6e' }}>Check your email</h2>
          <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 24 }}>
            We sent a confirmation link to <strong>{email}</strong>.<br />
            Click it to activate your account, then sign in.
          </p>
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', padding: '0 24px', height: 40,
            background: '#1a2e6e', color: '#fff', borderRadius: 8, textDecoration: 'none',
            fontSize: 14, fontWeight: 600,
          }}>Go to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f8f8', padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden',
      }}>
        <div style={{ background: '#1a2e6e', padding: '28px 32px 24px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, background: 'rgba(255,255,255,0.15)', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>⚖</div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Law OSS</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Create account</div>
          <div style={{ fontSize: 13.5, opacity: 0.7 }}>Free forever. Bring your own AI key.</div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 32px 32px' }}>
          <div style={{
            background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8,
            padding: '10px 14px', fontSize: 12.5, color: '#92400e', marginBottom: 20,
          }}>
            ⚠️ Beta: do not upload sensitive or privileged documents.
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#555' }}>Full name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={inp} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#555' }}>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@firm.com" style={inp} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#555' }}>Password (8+ chars)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} required minLength={8} />
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#1a2e6e', width: 16, height: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
              I have read and agree to the{' '}
              <Link href="/terms" target="_blank" style={{ color: '#1a2e6e', fontWeight: 600 }}>Terms of Service</Link>
              {' '}and understand this is beta software.
            </span>
          </label>

          {error && (
            <div style={{
              background: 'rgba(127,29,29,0.07)', border: '1px solid rgba(127,29,29,0.18)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#7f1d1d', marginBottom: 16,
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading || !agreed} style={{
            width: '100%', height: 42,
            background: loading || !agreed ? '#94a3b8' : '#1a2e6e',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
            cursor: loading || !agreed ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#999' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#1a2e6e', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
