'use client'
import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
type Matter = { id: string; name: string; type: string; status: string; court?: string; attorney?: string; dueDate?: string }

const MATTER_TYPES = ['litigation', 'contract', 'corporate', 'ip', 'employment', 'real-estate', 'criminal', 'family', 'other']
const STATUS_COLORS: Record<string, string> = { active: '#1a7a4a', pending: '#b45309', closed: '#6b7280', draft: '#0f0f0f' }

export default function MattersPage() {
  const [token, setToken] = useState<string | null>(null)
  const [matters, setMatters] = useState<Matter[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', type: 'litigation', court: '', attorney: '', notes: '', dueDate: '' })
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setToken(session.access_token); load(session.access_token) }
    })
  }, [])

  async function load(t: string) {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/matters`, { headers: { Authorization: `Bearer ${t}`, 'X-Api-Key': localStorage.getItem('law_oss_api_key') || '', 'X-Api-Provider': localStorage.getItem('law_oss_provider') || 'claude' } })
      if (r.ok) setMatters(await r.json())
    } catch {} finally { setLoading(false) }
  }

  async function create() {
    if (!form.name.trim() || !token) return
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/matters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Api-Key': localStorage.getItem('law_oss_api_key') || '', 'X-Api-Provider': localStorage.getItem('law_oss_provider') || 'claude' },
        body: JSON.stringify({ ...form, dueDate: form.dueDate || undefined }),
      })
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `Failed (${r.status})`) }
      const matter = await r.json()
      setMatters(prev => [matter, ...prev])
      setForm({ name: '', type: 'litigation', court: '', attorney: '', notes: '', dueDate: '' })
      setShowForm(false)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  function field(label: string, key: keyof typeof form, type = 'text', opts?: string[]) {
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 4 }}>{label}</label>
        {opts ? (
          <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 7, fontSize: 14, color: '#0f0f0f', background: '#fff' }}>
            {opts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
          </select>
        ) : (
          <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 7, fontSize: 14, color: '#0f0f0f', boxSizing: 'border-box' }} />
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Matters</h1>
          <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>Manage your legal cases and matters.</p>
        </div>
        <button onClick={() => setShowForm(f => !f)} style={{
          padding: '9px 18px', border: 'none', borderRadius: 8, background: '#0f0f0f',
          color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>{showForm ? 'Cancel' : 'New Matter'}</button>
      </div>

      {showForm && (
        <div style={{ background: '#f8f8f8', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '20px 22px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f', marginBottom: 16 }}>New Matter</div>
          {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#b91c1c', marginBottom: 12 }}>{error}</div>}
          {field('Matter Name *', 'name')}
          {field('Type', 'type', 'text', MATTER_TYPES)}
          {field('Court / Tribunal', 'court')}
          {field('Lead Attorney', 'attorney')}
          {field('Due Date', 'dueDate', 'date')}
          {field('Notes', 'notes')}
          <button onClick={create} disabled={saving || !form.name.trim()} style={{
            padding: '9px 20px', border: 'none', borderRadius: 8,
            background: saving || !form.name.trim() ? 'rgba(0,0,0,0.1)' : '#0f0f0f',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
          }}>{saving ? 'Saving...' : 'Create Matter'}</button>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: 14 }}>Loading...</div>}

      {!loading && matters.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#aaa', fontSize: 14 }}>
          No matters yet. Create your first matter above.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matters.map(m => (
          <div key={m.id} style={{ padding: '14px 16px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0f0f0f' }}>{m.name}</div>
              <div style={{ fontSize: 12.5, color: '#888', marginTop: 3 }}>
                {m.type}{m.court ? ` · ${m.court}` : ''}{m.attorney ? ` · ${m.attorney}` : ''}{m.dueDate ? ` · Due ${new Date(m.dueDate).toLocaleDateString()}` : ''}
              </div>
            </div>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: `${STATUS_COLORS[m.status] || '#6b7280'}18`,
              color: STATUS_COLORS[m.status] || '#6b7280',
            }}>{m.status || 'active'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
