'use client'
import { useState, useRef, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

type Risk = {
  title: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  clause: string
  risk: string
  fix: string
  accepted?: boolean
  rejected?: boolean
}

type StoredReview = {
  id: string
  filename: string
  createdAt: string
  risks: Risk[]
  docText?: string
}

function userKey(base: string) { return `${base}_${localStorage.getItem('law_oss_uid') || 'default'}` }

function loadReviews(): StoredReview[] {
  try { return JSON.parse(localStorage.getItem(userKey('law_oss_contracts_v2')) || '[]') } catch { return [] }
}
function saveReviews(list: StoredReview[]) {
  localStorage.setItem(userKey('law_oss_contracts_v2'), JSON.stringify(list))
}

// Fuzzy match: normalise whitespace so PDF-extracted text (which collapses spaces) still matches
function fuzzyReplace(text: string, clause: string, fix: string): { result: string; matched: boolean } {
  // 1. Try exact match first
  if (text.includes(clause)) {
    return { result: text.replace(clause, fix), matched: true }
  }
  // 2. Normalise internal whitespace on both sides and try again
  const normalise = (s: string) => s.replace(/\s+/g, ' ').trim()
  const normClause = normalise(clause)
  const normText   = normalise(text)
  if (normText.includes(normClause)) {
    // Rebuild by finding the run in the original that normalises to normClause
    // Use regex that allows any whitespace between words
    const words   = normClause.split(' ').map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = words.join('[\\s\\n\\r]+')
    try {
      const re = new RegExp(pattern)
      if (re.test(text)) {
        return { result: text.replace(re, fix), matched: true }
      }
    } catch {}
  }
  return { result: text, matched: false }
}

async function downloadUpdatedContract(docText: string, risks: Risk[], filename: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

  // Apply accepted fixes — preserve every character of the original; only swap the clause text
  let updated = docText
  const appended: Risk[] = []
  const notFound: Risk[] = []

  for (const r of risks) {
    if (!r.accepted) continue
    if (!r.clause || r.clause.toLowerCase() === 'not present') {
      appended.push(r)
    } else {
      const { result, matched } = fuzzyReplace(updated, r.clause, r.fix)
      if (matched) {
        updated = result
      } else {
        notFound.push(r)
      }
    }
  }

  // Zero-spacing paragraphs — blank lines get a small gap, content lines get none
  const TIGHT = { before: 0, after: 0 }
  const GAP   = { before: 0, after: 100 }

  function textLine(raw: string): any {
    // detect headings
    const t = raw.trimStart()
    if (t.startsWith('### ')) return new Paragraph({ text: t.slice(4), heading: HeadingLevel.HEADING_3, spacing: TIGHT })
    if (t.startsWith('## '))  return new Paragraph({ text: t.slice(3),  heading: HeadingLevel.HEADING_2, spacing: TIGHT })
    if (t.startsWith('# '))   return new Paragraph({ text: t.slice(2),  heading: HeadingLevel.HEADING_1, spacing: TIGHT })
    // detect bold **...**
    const parts: any[] = []
    const boldRe = /\*\*(.+?)\*\*/g
    let last = 0; let m: RegExpExecArray | null
    while ((m = boldRe.exec(raw)) !== null) {
      if (m.index > last) parts.push(new TextRun(raw.slice(last, m.index)))
      parts.push(new TextRun({ text: m[1], bold: true }))
      last = m.index + m[0].length
    }
    if (last < raw.length) parts.push(new TextRun(raw.slice(last)))
    return new Paragraph({ children: parts.length ? parts : [new TextRun(raw)], spacing: TIGHT })
  }

  const children: any[] = []
  for (const line of updated.split('\n')) {
    if (!line.trim()) { children.push(new Paragraph({ text: '', spacing: GAP })); continue }
    children.push(textLine(line))
  }

  if (appended.length > 0) {
    children.push(new Paragraph({ text: '', spacing: GAP }))
    children.push(new Paragraph({ text: 'ADDITIONAL CLAUSES (RECOMMENDED)', heading: HeadingLevel.HEADING_2, spacing: TIGHT }))
    for (const r of appended) {
      children.push(new Paragraph({ text: r.title, heading: HeadingLevel.HEADING_3, spacing: TIGHT }))
      children.push(new Paragraph({ children: [new TextRun(r.fix)], spacing: TIGHT }))
    }
  }

  if (notFound.length > 0) {
    children.push(new Paragraph({ text: '', spacing: GAP }))
    children.push(new Paragraph({ text: 'MANUAL REVIEW REQUIRED', heading: HeadingLevel.HEADING_2, spacing: TIGHT }))
    children.push(new Paragraph({ children: [new TextRun('These accepted fixes could not be located automatically — please apply manually:')], spacing: TIGHT }))
    for (const r of notFound) {
      children.push(new Paragraph({ text: r.title, heading: HeadingLevel.HEADING_3, spacing: TIGHT }))
      children.push(new Paragraph({ children: [new TextRun({ text: 'Current: ', bold: true }), new TextRun(r.clause)], spacing: TIGHT }))
      children.push(new Paragraph({ children: [new TextRun({ text: 'Replace with: ', bold: true }), new TextRun(r.fix)], spacing: TIGHT }))
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const base = filename.replace(/\.[^.]+$/, '')
  a.href = url; a.download = `${base}-updated.docx`; a.click()
  URL.revokeObjectURL(url)
}

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
      const items = ((await page.getTextContent()).items || []) as any[]
      text += items.map((x: any) => x.str ?? '').join(' ') + '\n'
    }
    return text
  }
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    const mammoth = await import('mammoth')
    const ab = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: ab })
    return result.value
  }
  throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT.')
}

const SEV: Record<string, { bg: string; border: string; badge: string; text: string; dot: string }> = {
  CRITICAL: { bg: '#fff1f2', border: '#fecdd3', badge: '#fda4af', text: '#be123c', dot: '#f43f5e' },
  HIGH:     { bg: '#fff7ed', border: '#fed7aa', badge: '#fdba74', text: '#c2410c', dot: '#f97316' },
  MEDIUM:   { bg: '#fefce8', border: '#fde68a', badge: '#fde047', text: '#854d0e', dot: '#eab308' },
  LOW:      { bg: '#f0fdf4', border: '#bbf7d0', badge: '#86efac', text: '#15803d', dot: '#22c55e' },
}

function RiskCard({
  risk, index, onAccept, onReject,
}: {
  risk: Risk; index: number
  onAccept: () => void; onReject: () => void
}) {
  const [open, setOpen] = useState(true)
  const s = SEV[risk.severity] || SEV.LOW
  const accepted = !!risk.accepted
  const rejected = !!risk.rejected

  return (
    <div style={{
      border: `1.5px solid ${accepted ? '#86efac' : rejected ? '#fca5a5' : s.border}`,
      borderRadius: 12,
      background: accepted ? '#f0fdf4' : rejected ? '#fff1f2' : '#fff',
      marginBottom: 10,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header row */}
      <div
        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        {/* Severity dot */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accepted ? '#22c55e' : rejected ? '#ef4444' : s.dot, flexShrink: 0 }} />

        {/* Severity badge */}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
          background: accepted ? '#dcfce7' : rejected ? '#fee2e2' : s.badge + '66',
          color: accepted ? '#15803d' : rejected ? '#b91c1c' : s.text,
          letterSpacing: '0.05em', flexShrink: 0,
        }}>
          {accepted ? 'ACCEPTED' : rejected ? 'REJECTED' : risk.severity}
        </span>

        {/* Title */}
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f0f0f', flex: 1 }}>{risk.title}</span>

        {/* Accept / Reject */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={onAccept}
            style={{
              padding: '5px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: accepted ? '#16a34a' : '#fff',
              color: accepted ? '#fff' : '#16a34a',
              border: `1.5px solid ${accepted ? '#16a34a' : '#86efac'}`,
              transition: 'all 0.15s',
            }}
          >
            {accepted ? '✓ Accepted' : 'Accept fix'}
          </button>
          <button
            onClick={onReject}
            style={{
              padding: '5px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: rejected ? '#dc2626' : '#fff',
              color: rejected ? '#fff' : '#dc2626',
              border: `1.5px solid ${rejected ? '#dc2626' : '#fca5a5'}`,
              transition: 'all 0.15s',
            }}
          >
            {rejected ? '✕ Rejected' : 'Reject'}
          </button>
        </div>

        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Why it's risky */}
          <div style={{ padding: '9px 12px', background: `${s.bg}`, border: `1px solid ${s.border}`, borderRadius: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: s.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚠ Why this is risky
            </div>
            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.55 }}>{risk.risk}</div>
          </div>

          {/* Current clause */}
          {risk.clause && risk.clause.toLowerCase() !== 'not present' && (
            <div style={{ padding: '9px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#b91c1c', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Current clause
              </div>
              <div style={{ fontSize: 12.5, color: '#555', fontStyle: 'italic', lineHeight: 1.6 }}>{risk.clause}</div>
            </div>
          )}
          {risk.clause && risk.clause.toLowerCase() === 'not present' && (
            <div style={{ fontSize: 12.5, color: '#aaa', fontStyle: 'italic' }}>This clause is missing from the contract.</div>
          )}

          {/* Suggested fix */}
          {risk.fix && (
            <div style={{ padding: '9px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803d', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ✓ Suggested fix
              </div>
              <div style={{ fontSize: 12.5, color: '#1a1a1a', lineHeight: 1.6 }}>{risk.fix}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ContractsPage() {
  const [stored, setStored] = useState<StoredReview[]>([])
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')  // 'reading' | 'reviewing' | ''
  const [risks, setRisks] = useState<Risk[]>([])
  const [filename, setFilename] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [docText, setDocText] = useState('')
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [generating, setGenerating] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    // Set uid FIRST so userKey() returns the correct namespaced key
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) localStorage.setItem('law_oss_uid', session.user.id)
      setStored(loadReviews())
    })
  }, [])

  function persistRisks(id: string, updated: Risk[]) {
    const all = loadReviews()
    const next = all.map(r => r.id === id ? { ...r, risks: updated } : r)
    saveReviews(next)
    setStored(next)
  }

  function handleAccept(idx: number) {
    const updated = risks.map((r, i) => i === idx ? { ...r, accepted: !r.accepted, rejected: false } : r)
    setRisks(updated)
    if (currentId) persistRisks(currentId, updated)
  }

  function handleReject(idx: number) {
    const updated = risks.map((r, i) => i === idx ? { ...r, rejected: !r.rejected, accepted: false } : r)
    setRisks(updated)
    if (currentId) persistRisks(currentId, updated)
  }

  async function handleFile(file: File) {
    const apiKey = localStorage.getItem(userKey('law_oss_api_key')) || ''
    const apiProvider = localStorage.getItem(userKey('law_oss_provider')) || 'claude'
    if (!apiKey) { setError('No API key configured. Add one in Settings.'); return }

    setError(''); setBusy(true); setRisks([]); setCurrentId(null); setFilename(file.name); setDocText('')
    setStage('reading')

    let extracted = ''
    try { extracted = await extractText(file) }
    catch (e: any) { setError(e.message); setBusy(false); setStage(''); return }

    setDocText(extracted)
    setStage('reviewing')

    const SYSTEM = `You are a contract risk analyst. Review the contract and identify every risky, unusual, one-sided, or missing clause.

Output ONLY a valid JSON array. No prose, no markdown fences, no explanation. Start with [ and end with ].

Each item must be:
{
  "title": "Short clause title",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "clause": "The exact verbatim text from the contract, or 'Not present' if missing",
  "risk": "One sentence explaining why this is risky",
  "fix": "Suggested replacement or addition text"
}

Flag 5–20 genuine risks.`

    const userMsg = `CONTRACT: ${file.name}\n\n${extracted}`

    try {
      let fullText = ''

      if (apiProvider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: userMsg }] }],
            generationConfig: { maxOutputTokens: 8000, temperature: 0.1 },
          }),
        })
        const d = await res.json() as any
        if (d.error) { setError(d.error.message || 'Gemini error'); setBusy(false); setStage(''); return }
        fullText = d.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
      } else {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            stream: true,
            system: SYSTEM,
            messages: [{ role: 'user', content: userMsg }],
          }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({})) as any
          setError(e.error?.message || `Error ${res.status}`)
          setBusy(false); setStage(''); return
        }
        const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
        while (true) {
          const { done, value } = await reader.read(); if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim(); if (!raw || raw === '[DONE]') continue
            try {
              const p = JSON.parse(raw)
              if (p.type === 'content_block_delta' && p.delta?.text) fullText += p.delta.text
            } catch {}
          }
        }
      }

      // Parse JSON array
      let parsed: Risk[] = []
      try {
        const match = fullText.match(/\[[\s\S]*\]/)
        if (match) {
          parsed = (JSON.parse(match[0]) as any[]).map(r => ({
            title: r.title || 'Untitled risk',
            severity: (['CRITICAL','HIGH','MEDIUM','LOW'] as const).includes(r.severity) ? r.severity : 'MEDIUM',
            clause: r.clause || '',
            risk: r.risk || '',
            fix: r.fix || '',
            accepted: false,
            rejected: false,
          }))
        }
      } catch { parsed = [] }

      if (parsed.length === 0) {
        setError('Could not parse risk analysis. Please try again.')
        setBusy(false); setStage(''); return
      }

      setRisks(parsed)
      const id = Math.random().toString(36).slice(2)
      setCurrentId(id)
      const review: StoredReview = { id, filename: file.name, createdAt: new Date().toISOString(), risks: parsed, docText: extracted }
      const all = loadReviews()
      const next = [review, ...all]; saveReviews(next); setStored(next)
      setBusy(false); setStage('')
    } catch (e: any) {
      setError(e.message || 'Review failed')
      setBusy(false); setStage('')
    }
  }

  function loadReview(review: StoredReview) {
    setRisks(review.risks || [])
    setFilename(review.filename)
    setCurrentId(review.id)
    setDocText(review.docText || '')
    setShowHistory(false)
    setError('')
  }

  function deleteReview(id: string) {
    const next = loadReviews().filter(r => r.id !== id)
    saveReviews(next); setStored(next)
    if (currentId === id) { setRisks([]); setCurrentId(null) }
  }

  const accepted = risks.filter(r => r.accepted).length
  const rejected = risks.filter(r => r.rejected).length
  const reviewed = accepted + rejected
  const criticalCount = risks.filter(r => r.severity === 'CRITICAL').length
  const highCount = risks.filter(r => r.severity === 'HIGH').length

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Contract Review</h1>
          <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>
            Upload a contract — AI flags every risky clause, you accept or reject each fix.
          </p>
        </div>
        {stored.length > 0 && (
          <button
            onClick={() => setShowHistory(h => !h)}
            style={{ padding: '7px 14px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, background: '#fff', fontSize: 13, color: '#555', cursor: 'pointer', fontWeight: 500 }}
          >
            {showHistory ? 'Hide history' : `History (${stored.length})`}
          </button>
        )}
      </div>

      {/* History panel */}
      {showHistory && stored.length > 0 && (
        <div style={{ marginBottom: 20, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, overflow: 'hidden' }}>
          {stored.map(r => (
            <div key={r.id} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f0f0f' }}>{r.filename}</div>
                <div style={{ fontSize: 11.5, color: '#aaa' }}>{new Date(r.createdAt).toLocaleString()} · {r.risks.length} risks</div>
              </div>
              <button onClick={() => loadReview(r)} style={{ padding: '4px 12px', border: 'none', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Load</button>
              <button onClick={() => deleteReview(r.id)} style={{ padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#b91c1c' }}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !busy) handleFile(f) }}
        onDragOver={e => e.preventDefault()}
        onClick={() => !busy && fileRef.current?.click()}
        style={{
          border: `2px dashed ${busy ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.18)'}`,
          borderRadius: 12, padding: '32px 24px', textAlign: 'center',
          cursor: busy ? 'not-allowed' : 'pointer',
          background: busy ? '#f5f5f5' : '#fafafa',
          marginBottom: 20, transition: 'all 0.2s',
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

        {busy ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"
                style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>
                {stage === 'reading' ? 'Reading document...' : 'Reviewing contract for risks...'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#aaa' }}>
              {stage === 'reviewing' ? 'Analysing every clause — this takes 15–30 seconds' : ''}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 600 }}>Drop your contract here, or click to upload</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>PDF, Word (.docx), TXT</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, color: '#b91c1c', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {risks.length > 0 && (
        <div>
          {/* Summary bar */}
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fff', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f0f0f' }}>{filename}</div>
            <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
              {criticalCount > 0 && <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 12, background: '#fda4af66', color: '#be123c', fontWeight: 700 }}>{criticalCount} CRITICAL</span>}
              {highCount > 0 && <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 12, background: '#fdba7466', color: '#c2410c', fontWeight: 700 }}>{highCount} HIGH</span>}
              <span style={{ fontSize: 12, color: '#888' }}>{risks.length} total risks</span>
            </div>
            <div style={{ fontSize: 12.5, color: reviewed === risks.length ? '#15803d' : '#888', fontWeight: reviewed === risks.length ? 700 : 400 }}>
              {reviewed}/{risks.length} reviewed
            </div>
            {accepted > 0 && docText && (
              <button
                onClick={async () => { setGenerating(true); await downloadUpdatedContract(docText, risks, filename); setGenerating(false) }}
                disabled={generating}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: 'none', borderRadius: 8, background: generating ? '#e5e5e5' : '#0f0f0f', color: generating ? '#999' : '#fff', fontSize: 12.5, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}
              >
                {generating ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                )}
                {generating ? 'Generating...' : `Download updated contract (${accepted} fix${accepted > 1 ? 'es' : ''})`}
              </button>
            )}
          </div>

          {/* Risk cards */}
          {risks.map((r, i) => (
            <RiskCard
              key={i}
              risk={r}
              index={i}
              onAccept={() => handleAccept(i)}
              onReject={() => handleReject(i)}
            />
          ))}

          {/* All done banner */}
          {reviewed === risks.length && risks.length > 0 && (
            <div style={{ marginTop: 16, padding: '14px 20px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>Review complete</div>
                <div style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>{accepted} fixes accepted · {rejected} rejected</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {accepted > 0 && docText && (
                  <button
                    onClick={async () => { setGenerating(true); await downloadUpdatedContract(docText, risks, filename); setGenerating(false) }}
                    disabled={generating}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {generating ? 'Generating...' : 'Download updated contract'}
                  </button>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ padding: '8px 18px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: '#fff', color: '#0f0f0f', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Upload another
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
