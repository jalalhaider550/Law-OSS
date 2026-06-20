'use client'
import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { saveToCloud } from '../../../lib/sync'
import LogoLoader from '../../../components/LogoLoader'
import MarkdownRenderer from '../../../components/MarkdownRenderer'

const API = ''  // use Next.js API routes (same origin)

// ── Word export ──────────────────────────────────────────────────────────────
async function downloadAsWord(content: string, filename = 'research.docx') {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const children: any[] = []
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t) { children.push(new Paragraph({ text: '' })); continue }
    if (t.startsWith('### ')) { children.push(new Paragraph({ text: t.slice(4), heading: HeadingLevel.HEADING_3 })); continue }
    if (t.startsWith('## '))  { children.push(new Paragraph({ text: t.slice(3), heading: HeadingLevel.HEADING_2 })); continue }
    if (t.startsWith('# '))   { children.push(new Paragraph({ text: t.slice(2), heading: HeadingLevel.HEADING_1 })); continue }
    const parts: any[] = []
    const boldRe = /\*\*(.+?)\*\*/g; let last = 0; let m: RegExpExecArray | null
    while ((m = boldRe.exec(t)) !== null) {
      if (m.index > last) parts.push(new TextRun(t.slice(last, m.index)))
      parts.push(new TextRun({ text: m[1], bold: true }))
      last = m.index + m[0].length
    }
    if (last < t.length) parts.push(new TextRun(t.slice(last)))
    children.push(new Paragraph({ children: parts.length ? parts : [new TextRun(t)] }))
  }
  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Add to Matter ─────────────────────────────────────────────────────────────
function AddToMatterButton({ content, title, uid, token }: { content: string; title: string; uid: string; token: string }) {
  const [open, setOpen] = useState(false)
  const [matters, setMatters] = useState<any[]>([])
  const [saved, setSaved] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  function loadMatters() {
    const key = `law_oss_matters_${uid}`
    try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
  }
  function saveMatters(m: any[]) {
    localStorage.setItem(`law_oss_matters_${uid}`, JSON.stringify(m))
    if (token) saveToCloud(token, 'matters', m)
  }

  function handleOpen() {
    setMatters(loadMatters())
    setOpen(true)
    setSaved(false)
  }

  function addToMatter(matterId: string) {
    const all = loadMatters()
    const chat = {
      id: Date.now().toString(),
      agentId: 'research',
      agentName: 'Research',
      title,
      messages: [{ role: 'assistant', content }],
      savedAt: new Date().toISOString(),
    }
    const updated = all.map((m: any) =>
      m.id === matterId ? { ...m, savedChats: [chat, ...(m.savedChats || [])] } : m
    )
    saveMatters(updated)
    setSaved(true)
    setTimeout(() => setOpen(false), 900)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 6, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Add to Matter
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: '#fff', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.13)', minWidth: 220, overflow: 'hidden' }}>
          {saved ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>Saved to matter</div>
          ) : matters.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#888' }}>No matters yet. <a href="/dashboard/matters" style={{ color: '#0f0f0f', fontWeight: 600 }}>Create one</a>.</div>
          ) : (
            <>
              <div style={{ padding: '9px 14px 6px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Select matter</div>
              {matters.map((m: any) => (
                <div key={m.id} onClick={() => addToMatter(m.id)} style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.06)', color: '#0f0f0f' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{m.type} · {m.status}</div>
                </div>
              ))}
            </>
          )}
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={() => setOpen(false)} style={{ fontSize: 12, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

const JURISDICTIONS = [
  { value: 'global',          label: 'All jurisdictions' },
  // United States — Federal
  { value: 'us',              label: '🇺🇸 United States (All Federal)' },
  { value: 'scotus',          label: '   ↳ Supreme Court (SCOTUS)' },
  { value: 'federal',         label: '   ↳ All Circuit Courts' },
  { value: '1st circuit',     label: '   ↳ 1st Circuit' },
  { value: '2nd circuit',     label: '   ↳ 2nd Circuit (NY)' },
  { value: '3rd circuit',     label: '   ↳ 3rd Circuit (DE/NJ/PA)' },
  { value: '4th circuit',     label: '   ↳ 4th Circuit (VA/NC)' },
  { value: '5th circuit',     label: '   ↳ 5th Circuit (TX/LA/MS)' },
  { value: '6th circuit',     label: '   ↳ 6th Circuit (OH/MI/KY/TN)' },
  { value: '7th circuit',     label: '   ↳ 7th Circuit (IL/IN/WI)' },
  { value: '8th circuit',     label: '   ↳ 8th Circuit (MN/MO/IA)' },
  { value: '9th circuit',     label: '   ↳ 9th Circuit (CA/WA/OR/AZ/NV)' },
  { value: '10th circuit',    label: '   ↳ 10th Circuit (CO)' },
  { value: '11th circuit',    label: '   ↳ 11th Circuit (FL/GA)' },
  { value: 'dc circuit',      label: '   ↳ DC Circuit' },
  // United States — Key State Courts
  { value: 'new york',        label: '   ↳ New York' },
  { value: 'california',      label: '   ↳ California' },
  { value: 'delaware',        label: '   ↳ Delaware' },
  { value: 'texas',           label: '   ↳ Texas' },
  { value: 'florida',         label: '   ↳ Florida' },
  { value: 'illinois',        label: '   ↳ Illinois' },
  { value: 'virginia',        label: '   ↳ Virginia' },
  { value: 'pennsylvania',    label: '   ↳ Pennsylvania' },
  { value: 'georgia',         label: '   ↳ Georgia' },
  { value: 'massachusetts',   label: '   ↳ Massachusetts' },
  { value: 'washington',      label: '   ↳ Washington' },
  { value: 'colorado',        label: '   ↳ Colorado' },
  { value: 'nevada',          label: '   ↳ Nevada' },
  { value: 'arizona',         label: '   ↳ Arizona' },
  { value: 'oregon',          label: '   ↳ Oregon' },
  { value: 'minnesota',       label: '   ↳ Minnesota' },
  { value: 'missouri',        label: '   ↳ Missouri' },
  // United Kingdom
  { value: 'uk',              label: '🇬🇧 United Kingdom (All)' },
  { value: 'england',         label: '   ↳ England & Wales' },
  { value: 'uksc',            label: '   ↳ UK Supreme Court' },
  { value: 'court of appeal', label: '   ↳ Court of Appeal' },
  { value: 'high court',      label: '   ↳ High Court' },
  { value: 'upper tribunal',  label: '   ↳ Upper Tribunal' },
  { value: 'scotland',        label: '   ↳ Scotland' },
  { value: 'northern ireland',label: '   ↳ Northern Ireland' },
]

let _uid = ''
const _tabId = Math.random().toString(36).slice(2)
function userKey(base: string) { return `${base}_${_uid || _tabId}` }

export default function ResearchPage() {
  const [token,         setToken]         = useState<string | null>(null)
  const [hasApiKey,     setHasApiKey]     = useState(false)
  const [query,         setQuery]         = useState('')
  const [jurisdiction,  setJurisdiction]  = useState('global')
  const [loading,       setLoading]       = useState(false)
  const [verifiedCases, setVerifiedCases] = useState<{ usCases: any[]; ukCases: any[] }>({ usCases: [], ukCases: [] })
  const [aiAnalysis,    setAiAnalysis]    = useState('')
  const [progress,      setProgress]      = useState('')
  const [error,         setError]         = useState('')
  const [uid,           setUid]           = useState('')
  const [dlBusy,        setDlBusy]        = useState(false)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        _uid = session.user.id
        localStorage.setItem('law_oss_uid', session.user.id)
        setToken(session.access_token)
        setUid(session.user.id)
        setHasApiKey(!!localStorage.getItem(userKey('law_oss_api_key')))
      }
    })
  }, [])

  async function search() {
    if (!query.trim() || loading) return
    if (!token) { setError('Please log in to search.'); return }
    if (!hasApiKey) { setError('Add your API key in Settings before searching.'); return }

    setLoading(true)
    setError('')
    setVerifiedCases({ usCases: [], ukCases: [] })
    setAiAnalysis('')
    setProgress('Searching verified case databases...')

    try {
      const apiKey      = localStorage.getItem(userKey('law_oss_api_key')) || ''
      const apiProvider = localStorage.getItem(userKey('law_oss_provider')) || 'claude'
      const url = `/api/research?q=${encodeURIComponent(query)}&jurisdiction=${encodeURIComponent(jurisdiction)}&apiKey=${encodeURIComponent(apiKey)}&apiProvider=${encodeURIComponent(apiProvider)}`
      const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!res.ok || !res.body) {
        const msg = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
        setError(msg.error || 'Search failed')
        setLoading(false)
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const p = JSON.parse(raw)
            if (p.type === 'progress')         setProgress(p.message)
            if (p.type === 'verified_results') setVerifiedCases({ usCases: p.usCases || [], ukCases: p.ukCases || [] })
            if (p.type === 'token')            setAiAnalysis(prev => prev + p.token)
            if (p.done)                        { setLoading(false); setProgress('') }
            if (p.error)                       { setError(p.error); setLoading(false); setProgress('') }
          } catch {}
        }
      }
    } catch (e: any) {
      setError(e.message || 'Search failed')
    }
    setLoading(false)
  }

  const noResults = !loading && !aiAnalysis && verifiedCases.usCases.length === 0 && verifiedCases.ukCases.length === 0

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Legal Research</h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>
          Verified case law from CourtListener (US) and The National Archives (UK). No hallucinated citations.
        </p>
      </div>

      {/* No API key warning */}
      {!hasApiKey && (
        <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 13.5, color: '#92400e', marginBottom: 16 }}>
          No API key found. <a href="/dashboard/settings" style={{ color: '#92400e', fontWeight: 600 }}>Add one in Settings</a> to enable AI analysis.
        </div>
      )}

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search() }}
          placeholder="e.g. breach of contract damages foreseeability"
          style={{
            flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8,
            border: '1.5px solid rgba(0,0,0,0.15)', fontSize: 14, outline: 'none', color: '#0f0f0f',
          }}
        />
        <select
          value={jurisdiction}
          onChange={e => setJurisdiction(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.15)', fontSize: 14, color: '#0f0f0f', background: '#fff', cursor: 'pointer' }}
        >
          {JURISDICTIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
        </select>
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          style={{
            padding: '10px 22px', borderRadius: 8, border: 'none',
            background: loading || !query.trim() ? 'rgba(0,0,0,0.1)' : '#0f0f0f',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Search
        </button>
      </div>

      {/* Error — always visible */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, color: '#b91c1c', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
          <LogoLoader label={progress || 'Searching case law...'} />
        </div>
      )}

      {/* Verified US cases */}
      {verifiedCases.usCases.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#999', marginBottom: 10 }}>
            Verified US Cases — CourtListener
          </div>
          {verifiedCases.usCases.map((c: any, i: number) => (
            <div key={i} style={{ background: '#f8f8f8', border: '1px solid #e8e8e8', borderRadius: 10, padding: 16, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
                <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0f0f0f', textDecoration: 'none' }}>
                  {c.caseName}
                </a>
              </div>
              <div style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>
                {[c.citation, c.court, c.dateFiled].filter(Boolean).join(' — ')}
              </div>
              {c.snippet && <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{c.snippet}</div>}
              <div style={{ marginTop: 8, fontSize: 11, color: '#555', fontWeight: 600 }}>✓ Verified — CourtListener</div>
            </div>
          ))}
        </div>
      )}

      {/* Verified UK cases */}
      {verifiedCases.ukCases.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#999', marginBottom: 10 }}>
            Verified UK Cases — The National Archives
          </div>
          {verifiedCases.ukCases.map((c: any, i: number) => (
            <div key={i} style={{ background: '#f8f8f8', border: '1px solid #e8e8e8', borderRadius: 10, padding: 16, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
                <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0f0f0f', textDecoration: 'none' }}>
                  {c.title}
                </a>
              </div>
              <div style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>
                {[c.citation, c.court, c.jurisdiction].filter(Boolean).join(' — ')}
              </div>
              <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{c.snippet}</div>
              {c.pdfUrl && (
                <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#555' }}>
                  PDF judgment
                </a>
              )}
              <div style={{ marginTop: 8, fontSize: 11, color: '#555', fontWeight: 600 }}>✓ Verified — National Archives</div>
            </div>
          ))}
        </div>
      )}

      {/* AI analysis */}
      {aiAnalysis && (
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#999' }}>
              AI Analysis — Verified sources only
            </div>
            {!loading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={async () => {
                    setDlBusy(true)
                    const fname = `research-${query.slice(0, 30).replace(/[^a-z0-9]/gi, '-')}.docx`
                    await downloadAsWord(aiAnalysis, fname)
                    setDlBusy(false)
                  }}
                  disabled={dlBusy}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: 'none', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: dlBusy ? 'not-allowed' : 'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {dlBusy ? 'Downloading...' : 'Download Word'}
                </button>
                {uid && <AddToMatterButton content={aiAnalysis} title={`Research: ${query.slice(0, 60)}`} uid={uid} token={token ?? ''} />}
              </div>
            )}
          </div>
          <div style={{ fontSize: 14 }}>
            <MarkdownRenderer content={aiAnalysis} />
            {loading && <span style={{ opacity: 0.4 }}>▌</span>}
          </div>
        </div>
      )}

      {/* Empty state */}
      {noResults && !error && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Enter a legal question to begin</div>
          <div style={{ fontSize: 13 }}>e.g. "remoteness of damage in contract" or "piercing the corporate veil Delaware"</div>
        </div>
      )}
    </div>
  )
}
