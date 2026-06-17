'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const COUNTRIES = [
  'United Kingdom', 'United States', 'Australia', 'Canada', 'Ireland',
  'Singapore', 'UAE', 'India', 'South Africa', 'New Zealand', 'Other',
]

const ROLES = [
  'Partner', 'Senior Associate', 'Associate', 'Trainee Solicitor',
  'Paralegal', 'Legal Executive', 'In-House Counsel', 'Barrister', 'Other',
]

export default function SettingsPage() {
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')

  // Profile fields
  const [fullName,     setFullName]     = useState('')
  const [lawFirmName,  setLawFirmName]  = useState('')
  const [role,         setRole]         = useState('')
  const [country,      setCountry]      = useState('')
  const [phone,        setPhone]        = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileErr,   setProfileErr]   = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // API key fields
  const [hasKey,       setHasKey]       = useState(false)
  const [provider,     setProvider]     = useState('')
  const [keyPreview,   setKeyPreview]   = useState('')
  const [newProvider,  setNewProvider]  = useState<'claude' | 'gemini'>('claude')
  const [newKey,       setNewKey]       = useState('')
  const [showKey,      setShowKey]      = useState(false)
  const [keySaved,     setKeySaved]     = useState('')
  const [keyErr,       setKeyErr]       = useState('')
  const [savingKey,    setSavingKey]    = useState(false)

  const router  = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setAuthToken(session.access_token)
      setUserEmail(session.user.email || '')
      const meta = session.user.user_metadata || {}
      setFullName(meta.full_name || meta.name || '')
      setLawFirmName(meta.law_firm || '')
      setRole(meta.role || '')
      setCountry(meta.country || '')
      setPhone(meta.phone || '')
      // Load key status from backend
      fetch(`${API}/api/api-keys/status`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json()).then(d => {
          if (d.hasKey) { setHasKey(true); setProvider(d.provider || ''); setKeyPreview(d.keyPreview || '') }
        }).catch(() => {})
    })
  }, [])

  async function saveProfile() {
    if (!authToken) return
    setSavingProfile(true); setProfileErr(''); setProfileSaved(false)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, law_firm: lawFirmName, role, country, phone },
      })
      if (error) { setProfileErr(error.message); return }
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } catch { setProfileErr('Failed to save profile.') }
    finally { setSavingProfile(false) }
  }

  async function saveKey() {
    const key = newKey.trim()
    if (!key || !authToken) return
    if (newProvider === 'claude' && !key.startsWith('sk-ant-')) {
      setKeyErr('Invalid Claude key — must start with sk-ant-'); return
    }
    if (newProvider === 'gemini' && !key.startsWith('AIza')) {
      setKeyErr('Invalid Gemini key — must start with AIza'); return
    }
    setKeyErr(''); setSavingKey(true)
    try {
      const res = await fetch(`${API}/api/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ provider: newProvider, apiKey: key }),
      })
      const data = await res.json()
      if (!res.ok) { setKeyErr(data.error || 'Failed to save key'); return }
      setHasKey(true); setProvider(newProvider)
      setKeyPreview(data.keyPreview || key.slice(0, 8) + '...' + key.slice(-4))
      setNewKey(''); setKeySaved('API key saved — active across all sessions.')
      setTimeout(() => setKeySaved(''), 4000)
    } catch { setKeyErr('Network error — could not save key.') }
    finally { setSavingKey(false) }
  }

  async function removeKey() {
    if (!window.confirm('Remove your API key? AI features will stop working.')) return
    if (!authToken) return
    await fetch(`${API}/api/api-keys`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } }).catch(() => {})
    setHasKey(false); setProvider(''); setKeyPreview('')
    setKeySaved('API key removed.')
    setTimeout(() => setKeySaved(''), 3000)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: 12 }}>{title}</div>
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '20px 22px' }}>{children}</div>
      </div>
    )
  }

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#555', marginBottom: 5 }}>{label}</label>
        {children}
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid rgba(0,0,0,0.15)',
    borderRadius: 8, fontSize: 14, color: '#0f0f0f', boxSizing: 'border-box',
    background: '#fff', outline: 'none',
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>Manage your profile, firm details, and API key.</p>
      </div>

      {/* Profile */}
      <Section title="Profile">
        {profileSaved && <div style={{ padding: '9px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, color: '#15803d', marginBottom: 16 }}>Profile saved.</div>}
        {profileErr && <div style={{ padding: '9px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>{profileErr}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Full name">
            <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
          </Field>
          <Field label="Email">
            <input style={{ ...inputStyle, background: '#f8f8f8', color: '#888' }} value={userEmail} disabled />
          </Field>
          <Field label="Law firm / organisation">
            <input style={inputStyle} value={lawFirmName} onChange={e => setLawFirmName(e.target.value)} placeholder="Smith & Partners LLP" />
          </Field>
          <Field label="Role">
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={role} onChange={e => setRole(e.target.value)}>
              <option value="">Select role...</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Country / jurisdiction">
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">Select country...</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Phone (optional)">
            <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 900000" />
          </Field>
        </div>

        <button onClick={saveProfile} disabled={savingProfile} style={{
          marginTop: 4, padding: '9px 22px', border: 'none', borderRadius: 8,
          background: savingProfile ? 'rgba(0,0,0,0.1)' : '#0f0f0f',
          color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: savingProfile ? 'not-allowed' : 'pointer',
        }}>{savingProfile ? 'Saving...' : 'Save profile'}</button>
      </Section>

      {/* API Key */}
      <Section title="AI API Key">
        {keySaved && <div style={{ padding: '9px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, color: '#15803d', marginBottom: 16 }}>{keySaved}</div>}
        {keyErr && <div style={{ padding: '9px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>{keyErr}</div>}

        {hasKey && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8f8f8', borderRadius: 8, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f0f0f', textTransform: 'capitalize' }}>{provider} — active</div>
              <div style={{ fontSize: 12.5, color: '#888', marginTop: 1 }}>{keyPreview}</div>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#15803d', fontSize: 11.5, fontWeight: 700 }}>Active</span>
          </div>
        )}

        <div style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
          {hasKey ? 'Replace your key below, or remove it.' : 'Add your API key to enable all AI features. Stored securely — never exposed in the browser.'}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['claude', 'gemini'] as const).map(p => (
            <button key={p} onClick={() => setNewProvider(p)} style={{
              padding: '7px 16px', borderRadius: 7,
              border: '1.5px solid ' + (newProvider === p ? '#0f0f0f' : 'rgba(0,0,0,0.15)'),
              background: newProvider === p ? 'rgba(0,0,0,0.05)' : '#fff',
              color: newProvider === p ? '#0f0f0f' : '#555',
              fontSize: 13.5, fontWeight: newProvider === p ? 600 : 400,
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{p}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'} value={newKey}
              onChange={e => setNewKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              placeholder={newProvider === 'claude' ? 'sk-ant-api03-…' : 'AIza…'}
              style={{ ...inputStyle, paddingRight: 50 }}
            />
            <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 12 }}>{showKey ? 'Hide' : 'Show'}</button>
          </div>
          <button onClick={saveKey} disabled={!newKey.trim() || savingKey} style={{
            padding: '9px 18px', border: 'none', borderRadius: 8,
            background: !newKey.trim() || savingKey ? 'rgba(0,0,0,0.1)' : '#0f0f0f',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: !newKey.trim() || savingKey ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}>{savingKey ? 'Saving...' : 'Save'}</button>
        </div>

        {hasKey && (
          <button onClick={removeKey} style={{ marginTop: 10, padding: '7px 14px', border: '1.5px solid #fca5a5', borderRadius: 7, background: '#fff', color: '#b91c1c', fontSize: 13, cursor: 'pointer' }}>
            Remove key
          </button>
        )}
      </Section>

      {/* Account */}
      <Section title="Account">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{userEmail}</div>
            <div style={{ fontSize: 12.5, color: '#aaa', marginTop: 2 }}>Authenticated via Supabase</div>
          </div>
          <button onClick={signOut} style={{
            padding: '8px 16px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8,
            background: '#fff', color: '#555', fontSize: 13.5, cursor: 'pointer',
          }}>Sign out</button>
        </div>
      </Section>
    </div>
  )
}
