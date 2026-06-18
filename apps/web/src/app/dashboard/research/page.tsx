'use client'
import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import LogoLoader from '../../../components/LogoLoader'
import MarkdownRenderer from '../../../components/MarkdownRenderer'

const API = ''  // use Next.js API routes (same origin)

const JURISDICTIONS = [
  { value: 'global',    label: 'All jurisdictions' },
  { value: 'us',        label: 'United States' },
  { value: 'uk',        label: 'England & Wales' },
  { value: 'scotland',  label: 'Scotland' },
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
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        _uid = session.user.id
        localStorage.setItem('law_oss_uid', session.user.id)
        setToken(session.access_token)
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
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#999', marginBottom: 12 }}>
            AI Analysis — Verified sources only
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
