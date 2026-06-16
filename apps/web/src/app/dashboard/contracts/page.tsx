'use client'
import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
type Contract = { id: string; filename: string; createdAt: string }

export default function ContractsPage() {
  const [token, setToken] = useState<string | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [uploading, setUploading] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [progress, setProgress] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setToken(session.access_token); loadContracts(session.access_token) }
    })
  }, [])

  async function loadContracts(t: string) {
    try {
      const r = await fetch(`${API}/api/contracts`, { headers: { Authorization: `Bearer ${t}`, 'X-Api-Key': localStorage.getItem('law_oss_api_key') || '', 'X-Api-Provider': localStorage.getItem('law_oss_provider') || 'claude' } })
      if (r.ok) setContracts(await r.json())
    } catch {}
  }

  async function handleUpload(file: File) {
    if (!token) return
    setError(''); setUploading(true); setAnalysis(''); setProgress('Uploading file...')
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await fetch(`${API}/api/contracts/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Api-Key': localStorage.getItem('law_oss_api_key') || '', 'X-Api-Provider': localStorage.getItem('law_oss_provider') || 'claude' }, body: form,
      })
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `Upload failed (${r.status})`) }
      const { id, filename, extractedText } = await r.json()
      setContracts(prev => [{ id, filename, createdAt: new Date().toISOString() }, ...prev])
      setSelectedId(id)
      setUploading(false)
      await analyse(id, extractedText)
    } catch (e: any) {
      setError(e.message); setProgress(''); setUploading(false)
    }
  }

  async function analyse(id: string, extractedText: string) {
    if (!token) return
    setAnalysing(true); setProgress('Starting analysis...')
    try {
      const res = await fetch(`${API}/api/contracts/${id}/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Api-Key': localStorage.getItem('law_oss_api_key') || '', 'X-Api-Provider': localStorage.getItem('law_oss_provider') || 'claude' },
        body: JSON.stringify({ extractedText }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Analysis failed (${res.status})`) }
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const p = JSON.parse(raw)
            if (p.type === 'progress') setProgress(p.message || '')
            if (p.type === 'complete') { setAnalysis(typeof p.analysis === 'string' ? p.analysis : JSON.stringify(p.analysis, null, 2)); setProgress('') }
            if (p.type === 'error') throw new Error(p.error)
          } catch (err: any) {
            if (err.message && !err.message.startsWith('JSON')) throw err
          }
        }
      }
    } catch (e: any) {
      setError(e.message); setProgress('')
    } finally { setAnalysing(false) }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const busy = uploading || analysing

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Contract Review</h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>Upload a contract for AI-powered risk analysis and summary.</p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop} onDragOver={e => e.preventDefault()}
        onClick={() => !busy && fileRef.current?.click()}
        style={{
          border: '2px dashed rgba(0,0,0,0.2)', borderRadius: 10, padding: '36px 24px',
          textAlign: 'center', cursor: busy ? 'not-allowed' : 'pointer',
          background: busy ? '#f5f5f5' : 'rgba(0,0,0,0.02)',
          marginBottom: 20, transition: 'background 0.15s',
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
        {busy ? (
          <div>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>{progress || 'Processing...'}</div>
            <div style={{ marginTop: 10, height: 3, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#0f0f0f', width: '60%', borderRadius: 2, animation: 'pulse 1.5s infinite' }} />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, color: '#555' }}>Drag a contract here, or click to select</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>PDF, DOC, DOCX, TXT</div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, color: '#b91c1c', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Analysis result */}
      {analysis && (
        <div style={{ background: '#f8f8f8', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999', marginBottom: 12 }}>Analysis</div>
          <pre style={{ fontSize: 13.5, lineHeight: 1.7, color: '#0f0f0f', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>{analysis}</pre>
        </div>
      )}

      {/* Contract list */}
      {contracts.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999', marginBottom: 10 }}>Previous Contracts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {contracts.map(c => (
              <div key={c.id} style={{
                padding: '10px 14px', background: selectedId === c.id ? 'rgba(0,0,0,0.05)' : '#f8f8f8',
                border: '1px solid ' + (selectedId === c.id ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.08)'),
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13.5, color: '#0f0f0f' }}>{c.filename}</span>
                <span style={{ fontSize: 12, color: '#aaa' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
