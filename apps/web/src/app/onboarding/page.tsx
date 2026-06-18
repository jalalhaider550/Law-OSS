'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function OnboardingPage() {
  const [token, setToken] = useState<string | null>(null)
  const [provider, setProvider] = useState<'anthropic' | 'gemini'>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setToken(session.access_token)
      setChecking(false)
    })
  }, [])

  async function handleSave() {
    const key = apiKey.trim()
    if (!key || !token) return
    const p = provider === 'anthropic' ? 'claude' : provider
    if (p === 'claude' && !key.startsWith('sk-ant-')) {
      setError('Invalid Claude key — must start with sk-ant-'); return
    }
    if (p === 'gemini' && !key.startsWith('AQ')) {
      setError('Invalid Gemini key — must start with AQ'); return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: p, apiKey: key }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save key'); return }
      router.push('/dashboard')
    } catch { setError('Network error — could not save key.') }
    finally { setLoading(false) }
  }

  if (checking) return null

  const placeholder = provider === 'anthropic' ? 'sk-ant-api03-…' : 'AQ…'
  const providerLabel = provider === 'anthropic' ? 'Anthropic (Claude)' : 'Google (Gemini)'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f8f8', padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
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
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Add your AI key</div>
          <div style={{ fontSize: 13.5, opacity: 0.7 }}>
            You pay the AI provider directly. Law OSS charges you nothing.
          </div>
        </div>

        <div style={{ padding: '28px 32px 32px' }}>
          <p style={{ fontSize: 13.5, color: '#555', lineHeight: 1.6, marginBottom: 24 }}>
            Law OSS uses your own API key to power all AI features.
            The key is encrypted and stored securely — it never leaves our servers unencrypted.
          </p>

          {/* Provider selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 10 }}>Choose provider</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { id: 'anthropic' as const, name: 'Claude', company: 'Anthropic', icon: '🤖', note: 'claude-sonnet-4-6' },
                { id: 'gemini' as const, name: 'Gemini', company: 'Google', icon: '✨', note: 'gemini-2.5-flash' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => { setProvider(p.id); setApiKey('') }}
                  style={{
                    padding: '14px 16px', border: `2px solid ${provider === p.id ? '#1a2e6e' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: 10, background: provider === p.id ? 'rgba(26,46,110,0.06)' : '#fff',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{p.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{p.company}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{p.note}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Key input */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>
              {providerLabel} API Key
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%', height: 42, border: '1.5px solid rgba(0,0,0,0.14)', borderRadius: 8,
                  padding: '0 44px 0 12px', fontSize: 13.5, outline: 'none', background: '#f8f8f8',
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999',
                }}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#aaa', marginBottom: 24, lineHeight: 1.5 }}>
            Get your key from{' '}
            {provider === 'anthropic'
              ? <a href="https://console.anthropic.com/keys" target="_blank" style={{ color: '#1a2e6e' }}>console.anthropic.com</a>
              : <a href="https://aistudio.google.com/app/apikey" target="_blank" style={{ color: '#1a2e6e' }}>aistudio.google.com</a>
            }
          </p>

          {error && (
            <div style={{
              background: 'rgba(127,29,29,0.07)', border: '1px solid rgba(127,29,29,0.18)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#7f1d1d', marginBottom: 16,
            }}>{error}</div>
          )}

          <button
            onClick={handleSave}
            disabled={loading || !apiKey.trim()}
            style={{
              width: '100%', height: 42,
              background: loading || !apiKey.trim() ? '#94a3b8' : '#1a2e6e',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
              cursor: loading || !apiKey.trim() ? 'not-allowed' : 'pointer', marginBottom: 12,
            }}
          >
            {loading ? 'Saving…' : 'Save API Key & Continue'}
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            style={{
              width: '100%', height: 38, background: 'transparent',
              border: 'none', color: '#aaa', fontSize: 13, cursor: 'pointer',
            }}
          >
            Skip for now →
          </button>
        </div>
      </div>
    </div>
  )
}
