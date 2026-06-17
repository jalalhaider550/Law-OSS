'use client'
import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type User = {
  id: string; email: string; fullName: string; lawFirm: string
  role: string; country: string; hasApiKey: boolean; apiProvider: string
  isAdmin: boolean; createdAt: string; lastSignIn: string
}

export default function AdminPage() {
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [token, setToken]       = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const router  = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const meta = session.user.user_metadata || {}
      if (!meta.isAdmin) { router.replace('/dashboard'); return }
      setToken(session.access_token)
      loadUsers(session.access_token)
    })
  }, [])

  async function loadUsers(t: string) {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/admin/users`, { headers: { Authorization: `Bearer ${t}` } })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to load users'); return }
      const d = await res.json()
      setUsers(d.users)
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  async function deleteUser(id: string, email: string) {
    if (!token) return
    if (!window.confirm(`Delete user ${email}? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await fetch(`${API}/api/admin/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch {}
    finally { setDeleting(null) }
  }

  async function makeAdmin(id: string) {
    if (!token) return
    if (!window.confirm('Grant admin access to this user?')) return
    await fetch(`${API}/api/admin/users/${id}/make-admin`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    setUsers(prev => prev.map(u => u.id === id ? { ...u, isAdmin: true } : u))
  }

  const filtered = users.filter(u =>
    [u.email, u.fullName, u.lawFirm, u.country].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  )

  const stats = {
    total:     users.length,
    withKey:   users.filter(u => u.hasApiKey).length,
    admins:    users.filter(u => u.isAdmin).length,
    active7d:  users.filter(u => u.lastSignIn && (Date.now() - new Date(u.lastSignIn).getTime()) < 7 * 86400000).length,
  }

  function fmt(d: string) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Admin Panel</h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>Manage users, API keys, and access.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total users',    value: stats.total },
          { label: 'With API key',   value: stats.withKey },
          { label: 'Active (7 days)',value: stats.active7d },
          { label: 'Admins',         value: stats.admins },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f0f0f' }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by email, name, firm, country..."
          style={{ flex: 1, padding: '9px 14px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 14, outline: 'none' }}
        />
        <button onClick={() => token && loadUsers(token)} style={{ padding: '9px 16px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: '#fff', fontSize: 13.5, cursor: 'pointer', fontWeight: 600 }}>
          Refresh
        </button>
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, color: '#b91c1c', marginBottom: 16 }}>{error}</div>}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa', fontSize: 14 }}>Loading users...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#fafafa' }}>
                {['User', 'Firm / Role', 'Country', 'API Key', 'Joined', 'Last Active', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#0f0f0f' }}>{u.fullName || '—'}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{u.email}</div>
                    {u.isAdmin && <span style={{ display: 'inline-block', marginTop: 3, padding: '1px 7px', borderRadius: 10, background: '#0f0f0f', color: '#fff', fontSize: 10, fontWeight: 700 }}>ADMIN</span>}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#444' }}>
                    <div>{u.lawFirm || '—'}</div>
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 1 }}>{u.role || ''}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#555' }}>{u.country || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {u.hasApiKey
                      ? <span style={{ padding: '2px 8px', borderRadius: 10, background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{u.apiProvider}</span>
                      : <span style={{ padding: '2px 8px', borderRadius: 10, background: '#f5f5f5', color: '#aaa', fontSize: 12 }}>None</span>
                    }
                  </td>
                  <td style={{ padding: '12px 14px', color: '#888', whiteSpace: 'nowrap' }}>{fmt(u.createdAt)}</td>
                  <td style={{ padding: '12px 14px', color: '#888', whiteSpace: 'nowrap' }}>{fmt(u.lastSignIn)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!u.isAdmin && (
                        <button onClick={() => makeAdmin(u.id)} style={{ padding: '4px 10px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                          Make admin
                        </button>
                      )}
                      <button onClick={() => deleteUser(u.id, u.email)} disabled={deleting === u.id} style={{ padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#b91c1c', fontWeight: 600 }}>
                        {deleting === u.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
