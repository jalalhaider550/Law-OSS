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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/dashboard')
  }

  if (checking) return null

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f8f8', padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>
        <div style={{ background: '#1a2e6e', padding: '28px 32px 24px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, background: 'rgba(255,255,255,0.15)', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>⚖</div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Law OSS</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontSize: 13.5, opacity: 0.7 }}>Sign in to your legal AI workspace</div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#555' }}>
              Email address
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="jane@firm.com" style={inp} required autoFocus />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#555' }}>
              Password
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" style={inp} required minLength={8} />
          </div>

          {error && (
            <div style={{
              background: 'rgba(127,29,29,0.07)', border: '1px solid rgba(127,29,29,0.18)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#7f1d1d', marginBottom: 16,
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', height: 42, background: loading ? '#374a99' : '#1a2e6e',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#999' }}>
            No account?{' '}
            <Link href="/signup" style={{ color: '#1a2e6e', fontWeight: 600, textDecoration: 'none' }}>
              Create one free
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
