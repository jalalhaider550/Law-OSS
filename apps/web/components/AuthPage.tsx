'use client'
import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  background: '#f8f8f8',
  border: '1px solid rgba(0,0,0,0.14)',
  borderRadius: 8,
  padding: '0 12px',
  fontSize: 13,
  color: '#0f0f0f',
  fontFamily: 'Inter, -apple-system, sans-serif',
  boxSizing: 'border-box',
  outline: 'none',
}

const linkBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#1a2e6e',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  padding: 0,
  fontFamily: 'inherit',
}

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const supabase = createClientComponentClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8f8f8',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
      >
        <div style={{ background: '#1a2e6e', padding: '28px 32px 24px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              ⚖️
            </div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Law OSS</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </div>
          <div style={{ fontSize: 14, opacity: 0.75 }}>
            {mode === 'signin'
              ? 'Sign in to your legal AI platform'
              : 'Start using Law OSS for free'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '28px 32px' }}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: '#555',
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
                required
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: '#555',
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@firm.com"
              style={inputStyle}
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: '#555',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              required
              minLength={8}
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(127,29,29,0.07)',
                border: '1px solid rgba(127,29,29,0.2)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#7f1d1d',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                background: 'rgba(22,101,52,0.07)',
                border: '1px solid rgba(22,101,52,0.2)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#166534',
                marginBottom: 16,
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 42,
              background: '#1a2e6e',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {loading ? '…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#999' }}>
            {mode === 'signin' ? (
              <>
                No account?{' '}
                <button type="button" onClick={() => setMode('signup')} style={linkBtnStyle}>
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => setMode('signin')} style={linkBtnStyle}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
