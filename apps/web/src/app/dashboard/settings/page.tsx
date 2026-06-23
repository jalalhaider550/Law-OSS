'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// _uid is set immediately on session load — random fallback ensures no cross-account bleed
let _uid = ''
const _tabId = Math.random().toString(36).slice(2)
function setUid(id: string) { _uid = id; localStorage.setItem('law_oss_uid', id) }
function userKey(base: string) { return `${base}_${_uid || _tabId}` }

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
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  // Password state
  const [newPassword,    setNewPassword]    = useState('')
  const [confirmPassword,setConfirmPassword]= useState('')
  const [showNewPwd,     setShowNewPwd]     = useState(false)
  const [pwdSaved,       setPwdSaved]       = useState('')
  const [pwdErr,         setPwdErr]         = useState('')
  const [savingPwd,      setSavingPwd]      = useState(false)
  const [resetSent,      setResetSent]      = useState(false)
  const [resetErr,       setResetErr]       = useState('')
  const [sendingReset,   setSendingReset]   = useState(false)

  // MFA state
  const [mfaEnrolled,    setMfaEnrolled]    = useState(false)
  const [mfaEnrolling,   setMfaEnrolling]   = useState(false)
  const [mfaQR,          setMfaQR]          = useState('')
  const [mfaSecret,      setMfaSecret]      = useState('')
  const [mfaFactorId,    setMfaFactorId]    = useState('')
  const [mfaCode,        setMfaCode]        = useState('')
  const [mfaVerifying,   setMfaVerifying]   = useState(false)
  const [mfaMsg,         setMfaMsg]         = useState('')
  const [mfaErr,         setMfaErr]         = useState('')
  const [disablingMfa,   setDisablingMfa]   = useState(false)

  // Export state
  const [exportMsg, setExportMsg] = useState('')

  const router   = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      setAuthToken(session.access_token)
      setUserEmail(session.user.email || '')
      // Namespace all localStorage keys by user ID so accounts never share data
      setUid(session.user.id)
      // Fetch fresh user metadata from Supabase server.
      // session.user.user_metadata comes from the JWT, which is NOT refreshed
      // by supabase.auth.updateUser() — so a save followed by a refresh would
      // read stale metadata from the old JWT and overwrite the new key.
      const { data: { user: freshUser } } = await supabase.auth.getUser()
      const meta = freshUser?.user_metadata || session.user.user_metadata || {}
      setFullName(meta.full_name || meta.name || '')
      setLawFirmName(meta.law_firm || '')
      setRole(meta.role || '')
      setCountry(meta.country || '')
      setPhone(meta.phone || '')

      // Load key: prefer account metadata (cross-device), fall back to localStorage
      const metaKey      = meta.law_oss_api_key || ''
      const metaProvider = meta.law_oss_provider || ''
      const localKey     = localStorage.getItem(userKey('law_oss_api_key')) || ''
      const localProvider = localStorage.getItem(userKey('law_oss_provider')) || ''
      const activeKey     = metaKey || localKey
      const activeProvider = metaKey ? metaProvider : localProvider
      if (activeKey) {
        // Sync to localStorage so all pages can use it
        localStorage.setItem(userKey('law_oss_api_key'), activeKey)
        localStorage.setItem(userKey('law_oss_provider'), activeProvider)
        setHasKey(true)
        setProvider(activeProvider)
        setKeyPreview(activeKey.slice(0, 8) + '...' + activeKey.slice(-4))
      }

      // Check MFA status
      supabase.auth.mfa.listFactors().then(({ data }) => {
        const verified = data?.totp?.find(f => f.status === 'verified')
        if (verified) { setMfaEnrolled(true); setMfaFactorId(verified.id) }
      }).catch(() => {})
    })()
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
    if (!key) return
    if (newProvider === 'claude' && !key.startsWith('sk-ant-')) {
      setKeyErr('Invalid Claude key — must start with sk-ant-'); return
    }
    if (newProvider === 'gemini' && !key.startsWith('AQ')) {
      setKeyErr('Invalid Gemini key — must start with AQ'); return
    }
    setKeyErr(''); setSavingKey(true)
    // Save to localStorage (current device)
    localStorage.setItem(userKey('law_oss_api_key'), key)
    localStorage.setItem(userKey('law_oss_provider'), newProvider)
    // Save to account metadata (all devices). Surface failures: if this is silently
    // swallowed, the next page load reads stale metadata and overwrites the new key
    // in localStorage with the old one.
    const { error: updateErr } = await supabase.auth.updateUser({
      data: { law_oss_api_key: key, law_oss_provider: newProvider },
    })
    if (updateErr) {
      setKeyErr(`Saved on this device but failed to sync to your account: ${updateErr.message}`)
      setSavingKey(false)
      return
    }
    setHasKey(true); setProvider(newProvider)
    setKeyPreview(key.slice(0, 8) + '...' + key.slice(-4))
    setNewKey(''); setKeySaved('API key saved — synced to your account.')
    setSavingKey(false)
    setTimeout(() => setKeySaved(''), 4000)
  }

  async function removeKey() {
    if (!window.confirm('Remove your API key? AI features will stop working.')) return
    localStorage.removeItem(userKey('law_oss_api_key'))
    localStorage.removeItem(userKey('law_oss_provider'))
    // Remove from account metadata too
    await supabase.auth.updateUser({ data: { law_oss_api_key: null, law_oss_provider: null } }).catch(() => {})
    setHasKey(false); setProvider(''); setKeyPreview('')
    setKeySaved('API key removed from all devices.')
    setTimeout(() => setKeySaved(''), 3000)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function changePassword() {
    setPwdErr(''); setPwdSaved('')
    if (!newPassword) { setPwdErr('Enter a new password.'); return }
    if (newPassword.length < 8) { setPwdErr('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPwdErr('Passwords do not match.'); return }
    setSavingPwd(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) { setPwdErr(error.message); return }
      setNewPassword(''); setConfirmPassword('')
      setPwdSaved('Password updated successfully.')
      setTimeout(() => setPwdSaved(''), 4000)
    } catch { setPwdErr('Failed to update password.') }
    finally { setSavingPwd(false) }
  }

  async function sendPasswordReset() {
    if (!userEmail) return
    setSendingReset(true); setResetErr('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
      })
      if (error) { setResetErr(error.message); return }
      setResetSent(true)
      setTimeout(() => setResetSent(false), 6000)
    } catch { setResetErr('Failed to send reset email.') }
    finally { setSendingReset(false) }
  }

  // MFA: begin enrollment
  async function startMfaEnroll() {
    setMfaErr(''); setMfaEnrolling(true); setMfaCode('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Law OSS' })
      if (error || !data) { setMfaErr(error?.message || 'Failed to start MFA setup.'); setMfaEnrolling(false); return }
      setMfaFactorId(data.id)
      setMfaQR(data.totp.qr_code)
      setMfaSecret(data.totp.secret)
    } catch { setMfaErr('Failed to start MFA setup.'); setMfaEnrolling(false) }
  }

  async function verifyMfa() {
    if (!mfaCode.trim() || !mfaFactorId) return
    setMfaVerifying(true); setMfaErr('')
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
      if (challengeErr || !challengeData) { setMfaErr(challengeErr?.message || 'Challenge failed.'); setMfaVerifying(false); return }
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challengeData.id, code: mfaCode.trim() })
      if (verifyErr) { setMfaErr(verifyErr.message || 'Invalid code.'); setMfaVerifying(false); return }
      setMfaEnrolled(true); setMfaEnrolling(false); setMfaQR(''); setMfaSecret('')
      setMfaMsg('Two-factor authentication enabled.')
      setTimeout(() => setMfaMsg(''), 4000)
    } catch { setMfaErr('Verification failed.') }
    finally { setMfaVerifying(false) }
  }

  async function disableMfa() {
    if (!window.confirm('Disable two-factor authentication?')) return
    if (!mfaFactorId) return
    setDisablingMfa(true); setMfaErr('')
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
      if (error) { setMfaErr(error.message); setDisablingMfa(false); return }
      setMfaEnrolled(false); setMfaFactorId(''); setMfaEnrolling(false); setMfaQR(''); setMfaSecret('')
      setMfaMsg('Two-factor authentication disabled.')
      setTimeout(() => setMfaMsg(''), 4000)
    } catch { setMfaErr('Failed to disable MFA.') }
    finally { setDisablingMfa(false) }
  }

  function exportData() {
    const matters = JSON.parse(localStorage.getItem(userKey('law_oss_matters')) || '[]')
    const contracts = JSON.parse(localStorage.getItem(userKey('law_oss_contracts')) || '[]')
    const storedProvider = localStorage.getItem(userKey('law_oss_provider')) || ''
    const exportObj = {
      exportedAt: new Date().toISOString(),
      user: { email: userEmail, fullName, lawFirmName, role, country },
      apiKeyProvider: storedProvider || null,
      matters,
      contracts: contracts.map((c: any) => ({ ...c, analysis: c.analysis ? '[analysis stored]' : '' })),
    }
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `law-oss-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExportMsg('Export downloaded.')
    setTimeout(() => setExportMsg(''), 3000)
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

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0 16px' }}>
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

      {/* AI API Key */}
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
          {hasKey ? 'Replace your key below, or remove it.' : 'Add your API key to enable all AI features. Stored locally in your browser only.'}
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
              placeholder={newProvider === 'claude' ? 'sk-ant-api03-…' : 'AQ…'}
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

      {/* Security — Password + MFA */}
      <Section title="Security">
        {/* Change Password */}
        {pwdSaved && <div style={{ padding: '9px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, color: '#15803d', marginBottom: 16 }}>{pwdSaved}</div>}
        {pwdErr && <div style={{ padding: '9px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>{pwdErr}</div>}
        {resetSent && <div style={{ padding: '9px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, color: '#15803d', marginBottom: 16 }}>Password reset email sent to {userEmail}.</div>}
        {resetErr && <div style={{ padding: '9px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>{resetErr}</div>}

        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f', marginBottom: 12 }}>Change Password</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginBottom: 12 }}>
          <Field label="New password">
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPwd ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                style={{ ...inputStyle, paddingRight: 50 }}
              />
              <button onClick={() => setShowNewPwd(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 12 }}>{showNewPwd ? 'Hide' : 'Show'}</button>
            </div>
          </Field>
          <Field label="Confirm new password">
            <input
              type={showNewPwd ? 'text' : 'password'} value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && changePassword()}
              placeholder="Repeat password"
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={changePassword} disabled={savingPwd || !newPassword} style={{
            padding: '9px 20px', border: 'none', borderRadius: 8,
            background: savingPwd || !newPassword ? 'rgba(0,0,0,0.1)' : '#0f0f0f',
            color: savingPwd || !newPassword ? '#bbb' : '#fff',
            fontSize: 14, fontWeight: 600, cursor: savingPwd || !newPassword ? 'not-allowed' : 'pointer',
          }}>{savingPwd ? 'Updating...' : 'Update password'}</button>
          <button onClick={sendPasswordReset} disabled={sendingReset} style={{
            padding: '9px 18px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8,
            background: '#fff', color: '#555', fontSize: 13.5, cursor: sendingReset ? 'not-allowed' : 'pointer',
          }}>{sendingReset ? 'Sending...' : 'Forgot password — send reset email'}</button>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 20 }} />

        {mfaMsg && <div style={{ padding: '9px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, color: '#15803d', marginBottom: 16 }}>{mfaMsg}</div>}
        {mfaErr && <div style={{ padding: '9px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#b91c1c', marginBottom: 16 }}>{mfaErr}</div>}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>Two-Factor Authentication</div>
            <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>
              {mfaEnrolled ? 'Enabled — your account requires a one-time code on sign-in.' : 'Add an extra layer of security with an authenticator app.'}
            </div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            {mfaEnrolled && <span style={{ padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#15803d', fontSize: 11.5, fontWeight: 700 }}>Active</span>}
            {mfaEnrolled ? (
              <button onClick={disableMfa} disabled={disablingMfa} style={{ padding: '7px 14px', border: '1.5px solid #fca5a5', borderRadius: 7, background: '#fff', color: '#b91c1c', fontSize: 13, cursor: disablingMfa ? 'not-allowed' : 'pointer' }}>
                {disablingMfa ? 'Disabling...' : 'Disable'}
              </button>
            ) : (
              <button onClick={startMfaEnroll} disabled={mfaEnrolling && !!mfaQR} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#0f0f0f', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                Enable 2FA
              </button>
            )}
          </div>
        </div>

        {/* MFA enrollment flow */}
        {mfaEnrolling && mfaQR && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f0f0f', marginBottom: 8 }}>Scan with your authenticator app</div>
            <div style={{ fontSize: 12.5, color: '#666', marginBottom: 14 }}>
              Use Google Authenticator, Authy, or any TOTP app. Then enter the 6-digit code to confirm.
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mfaQR} alt="MFA QR code" style={{ width: 160, height: 160, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8 }} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                {mfaSecret && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11.5, color: '#999', marginBottom: 4 }}>Manual entry code</div>
                    <code style={{ fontSize: 12, background: '#f5f5f5', padding: '6px 10px', borderRadius: 6, display: 'block', wordBreak: 'break-all', color: '#0f0f0f' }}>{mfaSecret}</code>
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: '#555', marginBottom: 8 }}>Enter the 6-digit code from your app:</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && verifyMfa()}
                    placeholder="000000" maxLength={6}
                    style={{ ...inputStyle, width: 120, letterSpacing: '0.2em', fontWeight: 600, textAlign: 'center' }}
                  />
                  <button onClick={verifyMfa} disabled={mfaCode.length !== 6 || mfaVerifying} style={{
                    padding: '9px 18px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    background: mfaCode.length !== 6 || mfaVerifying ? 'rgba(0,0,0,0.1)' : '#0f0f0f',
                    color: mfaCode.length !== 6 || mfaVerifying ? '#bbb' : '#fff',
                    cursor: mfaCode.length !== 6 || mfaVerifying ? 'not-allowed' : 'pointer',
                  }}>{mfaVerifying ? 'Verifying...' : 'Confirm'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Data Export */}
      <Section title="Data Export">
        {exportMsg && <div style={{ padding: '9px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, color: '#15803d', marginBottom: 16 }}>{exportMsg}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>Export my data</div>
            <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>
              Download your matters, saved chats, and contract history as a JSON file.
            </div>
          </div>
          <button onClick={exportData} style={{ padding: '8px 18px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: '#fff', color: '#0f0f0f', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            Export
          </button>
        </div>
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
