'use client'
import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const MATTER_TYPES = ['litigation', 'contract', 'corporate', 'ip', 'employment', 'real-estate', 'criminal', 'family', 'other']
const LS_KEY = 'law_oss_matters'

type SavedChat = { id: string; agentId: string; agentName: string; title: string; messages: { role: 'user' | 'assistant'; content: string }[]; savedAt: string }
type Matter = { id: string; name: string; type: string; status: 'active' | 'pending' | 'closed'; court?: string; attorney?: string; dueDate?: string; notes?: string; savedChats: SavedChat[] }

function loadMatters(): Matter[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function saveMatters(m: Matter[]) { localStorage.setItem(LS_KEY, JSON.stringify(m)) }

const SC: Record<string, { bg: string; color: string }> = {
  active: { bg: '#dcfce7', color: '#166534' },
  pending: { bg: '#fef9c3', color: '#854d0e' },
  closed: { bg: '#f3f4f6', color: '#6b7280' },
}

function ChatModal({ chat, onClose }: { chat: SavedChat; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f' }}>{chat.title}</div>
            <div style={{ fontSize: 11.5, color: '#888', marginTop: 2 }}>{chat.agentName} · {new Date(chat.savedAt).toLocaleString()}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #e5e5e5', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 18, color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {chat.messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '76%', padding: '9px 13px', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: m.role === 'user' ? '#0f0f0f' : '#f5f5f5', color: m.role === 'user' ? '#fff' : '#0f0f0f' }}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NewMatterForm({ onSave, onCancel }: { onSave: (m: Matter) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: '', type: 'litigation', status: 'active' as Matter['status'], court: '', attorney: '', dueDate: '', notes: '' })
  const [err, setErr] = useState('')
  const iS = { width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13.5, outline: 'none', boxSizing: 'border-box' as const }
  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }))
  function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!f.name.trim()) { setErr('Matter name is required'); return }
    onSave({ id: Date.now().toString(), name: f.name.trim(), type: f.type, status: f.status, court: f.court || undefined, attorney: f.attorney || undefined, dueDate: f.dueDate || undefined, notes: f.notes || undefined, savedChats: [] })
  }
  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#0f0f0f' }}>New Matter</div>
      {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px', fontSize: 12.5, color: '#dc2626', marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Matter Name *</label>
          <input value={f.name} onChange={upd('name')} style={iS} placeholder="e.g. Smith v. Jones" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Type</label>
          <select value={f.type} onChange={upd('type')} style={iS}>{MATTER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Status</label>
          <select value={f.status} onChange={upd('status')} style={iS}>
            <option value="active">Active</option><option value="pending">Pending</option><option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Court</label>
          <input value={f.court} onChange={upd('court')} style={iS} placeholder="e.g. High Court" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Attorney</label>
          <input value={f.attorney} onChange={upd('attorney')} style={iS} placeholder="Assigned attorney" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Due Date</label>
          <input type="date" value={f.dueDate} onChange={upd('dueDate')} style={iS} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Notes</label>
          <textarea value={f.notes} onChange={upd('notes')} rows={2} style={{ ...iS, resize: 'vertical' }} placeholder="Optional notes..." />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" style={{ padding: '7px 18px', background: '#0f0f0f', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save Matter</button>
        <button type="button" onClick={onCancel} style={{ padding: '7px 18px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13.5, cursor: 'pointer' }}>Cancel</button>
      </div>
    </form>
  )
}

function MatterCard({ matter, onDelete, onUpdate }: { matter: Matter; onDelete: () => void; onUpdate: (m: Matter) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [viewChat, setViewChat] = useState<SavedChat | null>(null)
  const sc = SC[matter.status] || SC.closed
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(x => !x)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: '#0f0f0f' }}>{matter.name}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600, textTransform: 'capitalize' }}>{matter.status}</span>
            <span style={{ fontSize: 11.5, color: '#888', textTransform: 'capitalize' }}>{matter.type}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
            {matter.attorney && <span style={{ fontSize: 12, color: '#6b7280' }}>Attorney: {matter.attorney}</span>}
            {matter.court && <span style={{ fontSize: 12, color: '#6b7280' }}>Court: {matter.court}</span>}
            {matter.dueDate && <span style={{ fontSize: 12, color: '#6b7280' }}>Due: {matter.dueDate}</span>}
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{matter.savedChats.length} saved chat{matter.savedChats.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${matter.name}"?`)) onDelete() }} style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>Delete</button>
          <span style={{ fontSize: 14, color: '#9ca3af', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px', background: '#fafafa' }}>
          {matter.notes && <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 12, lineHeight: 1.5 }}>{matter.notes}</div>}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Saved Chats</div>
          {matter.savedChats.length === 0
            ? <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No saved chats yet. Use an AI agent and save the conversation to this matter.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {matter.savedChats.map(chat => (
                  <div key={chat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '9px 12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#0f0f0f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title}</div>
                      <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>{chat.agentName} · {new Date(chat.savedAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setViewChat(chat)} style={{ padding: '4px 12px', background: '#0f0f0f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View</button>
                      <button onClick={() => { if (confirm('Remove this saved chat?')) onUpdate({ ...matter, savedChats: matter.savedChats.filter(c => c.id !== chat.id) }) }} style={{ padding: '4px 10px', background: 'none', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
      {viewChat && <ChatModal chat={viewChat} onClose={() => setViewChat(null)} />}
    </div>
  )
}

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'closed'>('all')
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (!session) window.location.href = '/login' })
    setMatters(loadMatters())
  }, [])

  function addMatter(m: Matter) { const u = [m, ...matters]; setMatters(u); saveMatters(u); setShowForm(false) }
  function deleteMatter(id: string) { const u = matters.filter(m => m.id !== id); setMatters(u); saveMatters(u) }
  function updateMatter(m: Matter) { const u = matters.map(x => x.id === m.id ? m : x); setMatters(u); saveMatters(u) }

  const filtered = filter === 'all' ? matters : matters.filter(m => m.status === filter)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Matters</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>{matters.length} matter{matters.length !== 1 ? 's' : ''} · stored locally</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ padding: '8px 18px', background: '#0f0f0f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{showForm ? 'Cancel' : '+ New Matter'}</button>
      </div>

      {showForm && <NewMatterForm onSave={addMatter} onCancel={() => setShowForm(false)} />}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['all', 'active', 'pending', 'closed'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid', borderColor: filter === s ? '#0f0f0f' : '#d1d5db', background: filter === s ? '#0f0f0f' : '#fff', color: filter === s ? '#fff' : '#374151', fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
        ))}
      </div>

      {filtered.length === 0
        ? <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{filter === 'all' ? 'No matters yet' : `No ${filter} matters`}</div>
            {filter === 'all' && <div style={{ fontSize: 13, marginTop: 5 }}>Click "+ New Matter" to get started</div>}
          </div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(m => <MatterCard key={m.id} matter={m} onDelete={() => deleteMatter(m.id)} onUpdate={updateMatter} />)}
          </div>
      }
    </div>
  )
}
