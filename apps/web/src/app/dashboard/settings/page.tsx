'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SettingsPage() {
  const [userEmail, setUserEmail] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [provider, setProvider] = useState('')
  const [keyPreview, setKeyPreview] = useState('')
  const [newProvider, setNewProvider] = useState<'claude' | 'gemini'>('claude')
  const [newKey, setNewKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setUserEmail(session.user.email || '')
    })
    const stored = localStorage.getItem('law_oss_api_key')
    const storedProvider = localStorage.getItem('law_oss_provider') || 'claude'
    if (stored) {
      setHasKey(true)
      setProvider(storedProvider)
      setKeyPreview(stored.slice(0, 8) + '...' + stored.slice(-4))
    }
  }, [])

  function saveKey() {
    const key = newKey.trim()
    if (!key) return
    if (newProvider === 'claude' && !key.startsWith('sk-ant-')) {
      setErr('Invalid Claude key — must start with sk-ant-'); return
    }
    if (newProvider === 'gemini' && !key.startsWith('AIza')) {
      setErr('Invalid Gemini key — must start with AIza'); return
    }
    setErr('')
    localStorage.setItem('law_oss_api_key', key)
    localStorage.setItem('law_oss_provider', newProvider)
    setHasKey(true)
    setProvider(newProvider)
    setKeyPreview(key.slice(0, 8) + '...' + key.slice(-4))
    setNewKey('')
    setMsg('API key saved successfully.')
  }

  function removeKey() {
    if (!window.confirm('Remove your API key? AI features will stop working.')) return
    localStorage.removeItem('law_oss_api_key')
    localStorage.removeItem('law_oss_provider')
    setHasKey(false); setProvider(''); setKeyPreview(''); setMsg('API key removed.')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: 12 }}>{title}</div>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '18px 20px' }}>{children}</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Settings</h1>
      </div>

      {msg && <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 13.5, color: '#15803d', marginBottom: 16 }}>{msg}</div>}
      {err && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, color: '#b91c1c', marginBottom: 16 }}>{err}</div>}

      <Section title="API Key">
        {hasKey ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f', textTransform: 'capitalize' }}>{provider}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{keyPreview}</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 600 }}>Active</span>
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Replace your key below, or remove it.</div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#888', marginBottom: 14 }}>No API key configured. Add one to enable AI features.</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['claude', 'gemini'] as const).map(p => (
            <button key={p} onClick={() => setNewProvider(p)} style={{
              padding: '7px 16px', borderRadius: 7, border: '1.5px solid ' + (newProvider === p ? '#0f0f0f' : 'rgba(0,0,0,0.15)'),
              background: newProvider === p ? 'rgba(0,0,0,0.05)' : '#fff',
              color: newProvider === p ? '#0f0f0f' : '#555', fontSize: 13.5, fontWeight: newProvider === p ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize',
            }}>{p}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'} value={newKey} onChange={e => setNewKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              placeholder={hasKey ? 'Enter new API key to replace...' : 'Enter API key...'}
              style={{ width: '100%', padding: '9px 40px 9px 12px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 14, color: '#0f0f0f', boxSizing: 'border-box' }}
            />
            <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 12 }}>{showKey ? 'Hide' : 'Show'}</button>
          </div>
          <button onClick={saveKey} disabled={!newKey.trim()} style={{
            padding: '9px 18px', border: 'none', borderRadius: 8,
            background: !newKey.trim() ? 'rgba(0,0,0,0.1)' : '#0f0f0f',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: !newKey.trim() ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}>Save</button>
        </div>

        {hasKey && (
          <button onClick={removeKey} style={{ marginTop: 10, padding: '7px 14px', border: '1.5px solid #fca5a5', borderRadius: 7, background: '#fff', color: '#b91c1c', fontSize: 13, cursor: 'pointer' }}>
            Remove key
          </button>
        )}
      </Section>

      <Section title="Account">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>Email</div>
            <div style={{ fontSize: 13.5, color: '#888', marginTop: 2 }}>{userEmail || 'Loading...'}</div>
          </div>
        </div>
      </Section>

      <Section title="Session">
        <button onClick={signOut} style={{
          padding: '9px 18px', border: '1.5px solid rgba(0,0,0,0.2)', borderRadius: 8,
          background: '#fff', color: '#555', fontSize: 14, cursor: 'pointer',
        }}>Sign out</button>
      </Section>
    </div>
  )
}
