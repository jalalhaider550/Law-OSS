'use client'
import { useState, useRef, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import MarkdownRenderer from '../../../components/MarkdownRenderer'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Contract = { filename: string; createdAt: string; analysis: string }

const CONTRACT_SYS = `You are Law OSS AI, an expert contract analyst. When given a contract document, provide a thorough analysis including:
1. CONTRACT SUMMARY — parties, purpose, key dates, governing law
2. KEY RISKS — rated [CRITICAL/HIGH/MEDIUM/LOW] with explanation
3. UNUSUAL OR MISSING CLAUSES — flag anything non-standard or absent
4. OBLIGATIONS — main duties of each party
5. RECOMMENDATIONS — specific suggestions to improve or negotiate

Be precise, structured, and professional. Use clear numbered headings.

Do not use emojis, decorative symbols, or coloured text. Use plain professional text with clear numbered headings. Always produce the complete analysis without truncating.`

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    return await file.text()
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
    const ab = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const extracted = await page.getTextContent()
      const items = (extracted.items || []) as any[]
      text += items.map((item: any) => (item.str ?? '')).join(' ') + '\n'
    }
    return text.slice(0, 40000)
  }
  throw new Error('Unsupported file type. Please upload PDF or TXT.')
}

async function streamContractAnalysis(
  token: string, docText: string, filename: string,
  onToken: (t: string) => void, onDone: () => void, onError: (e: string) => void,
) {
  const message = `Please analyse this contract:\n\n[FILE: ${filename}]\n\n${docText}`
  try {
    const res = await fetch(`${API}/api/agents/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ agentId: 'contract', message, history: [], systemPrompt: CONTRACT_SYS }),
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})) as any; onError(e.error || `Error ${res.status}`); return }
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim(); if (!raw) continue
        try { const p = JSON.parse(raw); if (p.token) onToken(p.token); if (p.done) onDone(); if (p.error) onError(p.error) } catch { /* ignore */ }
      }
    }
  } catch (e: any) { onError(e.message || 'Network error') }
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [selectedFilename, setSelectedFilename] = useState('')
  const [error, setError] = useState('')
  const [authToken, setAuthToken] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setAuthToken(session.access_token)
    })
  }, [])

  async function handleUpload(file: File) {
    if (!authToken) { setError('Please log in first.'); return }

    setError(''); setBusy(true); setAnalysis(''); setSelectedFilename(file.name)
    setProgress('Reading document...')

    let docText = ''
    try {
      docText = await extractText(file)
    } catch (e: any) {
      setError(e.message); setBusy(false); setProgress(''); return
    }

    setProgress('Analysing contract with AI...')

    const onToken = (t: string) => setAnalysis(prev => prev + t)
    const onDone = () => { setBusy(false); setProgress(''); setContracts(prev => [{ filename: file.name, createdAt: new Date().toISOString(), analysis: '' }, ...prev]) }
    const onError = (e: string) => { setError(e); setBusy(false); setProgress('') }

    await streamContractAnalysis(authToken!, docText, file.name, onToken, onDone, onError)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Contract Review</h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>Upload a contract for AI-powered risk analysis. Runs directly in your browser — your document is never stored.</p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop} onDragOver={e => e.preventDefault()}
        onClick={() => !busy && fileRef.current?.click()}
        style={{
          border: '2px dashed rgba(0,0,0,0.18)', borderRadius: 12, padding: '40px 24px',
          textAlign: 'center', cursor: busy ? 'not-allowed' : 'pointer',
          background: busy ? '#f5f5f5' : 'rgba(0,0,0,0.01)', marginBottom: 20,
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
        {busy ? (
          <div>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>{progress}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>This may take a moment for large documents</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>Drag a contract here, or click to select</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Supports PDF, TXT, MD</div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, color: '#b91c1c', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Streaming analysis */}
      {(analysis || (busy && progress.includes('Analysing'))) && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
          {selectedFilename && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{selectedFilename}</span>
            </div>
          )}
          <div style={{ fontSize: 14 }}>
            <MarkdownRenderer content={analysis} />
            {busy && <span style={{ display: 'inline-block', width: 8, height: 14, background: '#0f0f0f', marginLeft: 2, animation: 'pulse 1s infinite', verticalAlign: 'middle' }} />}
          </div>
        </div>
      )}

      {/* Session history */}
      {contracts.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: 10 }}>Analysed this session</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {contracts.map((c, i) => (
              <div key={i} style={{ padding: '10px 14px', background: '#f8f8f8', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, color: '#0f0f0f' }}>📋 {c.filename}</span>
                <span style={{ fontSize: 12, color: '#aaa' }}>{new Date(c.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
