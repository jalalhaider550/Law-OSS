'use client'
import { useState, useRef, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import MarkdownRenderer from '../../../components/MarkdownRenderer'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://law-oss-api-production.up.railway.app'

const CONTRACT_SYS = `You are Law OSS AI, an expert contract analyst. Analyse the contract and produce these sections in order:

## 1. CONTRACT SUMMARY
Parties, purpose, key dates, governing law.

## 2. KEY RISKS
List each risk with severity. Use this EXACT format for every single risk:

RISK: [title] | SEVERITY: [CRITICAL or HIGH or MEDIUM or LOW]
Current clause: [exact text from contract, or "Not present"]
Suggested fix: [your safer replacement text]
Why: [brief explanation]

---

## 3. UNUSUAL OR MISSING CLAUSES
Use this EXACT format for each issue:

RISK: [title] | SEVERITY: [HIGH or MEDIUM or LOW]
Current clause: [exact text, or "Not present"]
Suggested fix: [your safer replacement]
Why: [brief explanation]

---

## 4. OBLIGATIONS
Main duties of each party (plain prose, no special format needed).

Always complete the full analysis. Never truncate.`

type StoredContract = {
  id: string
  filename: string
  createdAt: string
  analysis: string
  docText?: string
  parentId: string | null
  versionNumber: number
  acceptedChanges?: number[]
  rejectedChanges?: number[]
}

type ParsedChange = {
  index: number
  title: string
  severity: string
  current: string
  suggested: string
  why: string
}

function loadContracts(): StoredContract[] {
  try { return JSON.parse(localStorage.getItem('law_oss_contracts') || '[]') } catch { return [] }
}
function saveContracts(list: StoredContract[]) {
  localStorage.setItem('law_oss_contracts', JSON.stringify(list))
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
      const extracted = await page.getTextContent()
      const items = (extracted.items || []) as any[]
      text += items.map((item: any) => item.str ?? '').join(' ') + '\n'
    }
    return text
  }
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    const mammoth = await import('mammoth')
    const ab = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: ab })
    return result.value
  }
  throw new Error('Unsupported file type. Please upload PDF, DOCX, TXT, or MD.')
}

async function streamContractAnalysis(
  token: string, docText: string, filename: string,
  onToken: (t: string) => void, onDone: () => void, onError: (e: string) => void,
) {
  try {
    const res = await fetch(`${API_BASE}/api/agents/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Analyse this contract:\n\n[FILE: ${filename}]\n\n${docText}` }],
        systemPrompt: CONTRACT_SYS,
        agentType: 'contract',
      }),
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})) as any; onError(e.error || `Error ${res.status}`); return }
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim(); if (!raw || raw === '[DONE]') { onDone(); continue }
        try { const p = JSON.parse(raw); if (p.token) onToken(p.token); if (p.done) onDone() } catch {}
      }
    }
    onDone()
  } catch (e: any) { onError(e.message || 'Network error') }
}

// Robust parser — handles "RISK: title | SEVERITY: HIGH" lines
function parseChanges(analysis: string): ParsedChange[] {
  const changes: ParsedChange[] = []
  const lines = analysis.split('\n')
  let i = 0; let idx = 1
  while (i < lines.length) {
    const line = lines[i].trim()
    // Match: RISK: ... | SEVERITY: ...
    const riskMatch = line.match(/^RISK:\s*(.+?)\s*\|\s*SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i)
    if (riskMatch) {
      const title = riskMatch[1].trim()
      const severity = riskMatch[2].toUpperCase()
      let current = ''; let suggested = ''; let why = ''
      // Read following lines for current/suggested/why
      let j = i + 1
      while (j < lines.length && j < i + 8) {
        const l = lines[j].trim()
        if (/^Current clause:/i.test(l)) current = l.replace(/^Current clause:\s*/i, '').replace(/^"(.+)"$/, '$1').trim()
        else if (/^Suggested fix:/i.test(l)) suggested = l.replace(/^Suggested fix:\s*/i, '').replace(/^"(.+)"$/, '$1').trim()
        else if (/^Why:/i.test(l)) why = l.replace(/^Why:\s*/i, '').trim()
        else if (l === '---' || /^RISK:/i.test(l) || /^##/.test(l)) break
        j++
      }
      changes.push({ index: idx++, title, severity, current, suggested, why })
      i = j
      continue
    }
    i++
  }
  return changes
}

// Apply accepted changes to doc
function applyChangesToDoc(docText: string, changes: ParsedChange[], acceptedSet: Set<number>): string {
  let result = docText
  for (const c of changes) {
    if (!acceptedSet.has(c.index)) continue
    if (c.current && c.suggested && c.current.toLowerCase() !== 'not present' && c.current.length > 4) {
      result = result.replace(c.current, c.suggested)
    } else if (c.suggested && (!c.current || c.current.toLowerCase() === 'not present')) {
      result += '\n\n' + c.suggested
    }
  }
  return result
}

const SEV_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  CRITICAL: { bg: '#fff1f2', color: '#be123c', dot: '#fda4af' },
  HIGH:     { bg: '#fff7ed', color: '#c2410c', dot: '#fdba74' },
  MEDIUM:   { bg: '#fefce8', color: '#854d0e', dot: '#fde047' },
  LOW:      { bg: '#f0fdf4', color: '#15803d', dot: '#86efac' },
}

function SeverityBadge({ sev }: { sev: string }) {
  const s = SEV_STYLE[sev] || SEV_STYLE.LOW
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.dot + '55', color: s.color, letterSpacing: '0.04em', flexShrink: 0 }}>
      {sev}
    </span>
  )
}

function ChangeCard({ change, isAcc, isRej, onAccept, onReject }: {
  change: ParsedChange
  isAcc: boolean; isRej: boolean
  onAccept: () => void; onReject: () => void
}) {
  const sev = SEV_STYLE[change.severity] || SEV_STYLE.LOW
  return (
    <div style={{
      border: `1.5px solid ${isAcc ? '#86efac' : isRej ? '#fca5a5' : sev.dot}`,
      borderRadius: 10,
      background: isAcc ? '#f0fdf4' : isRej ? '#fff1f2' : sev.bg,
      marginBottom: 10, overflow: 'hidden',
    }}>
      <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <SeverityBadge sev={change.severity} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f0f0f', flex: 1 }}>{change.title}</span>
        <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
          <button onClick={onAccept} style={{
            padding: '5px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            background: isAcc ? '#16a34a' : '#fff',
            color: isAcc ? '#fff' : '#16a34a',
            border: `1.5px solid ${isAcc ? '#16a34a' : '#86efac'}`,
          }}>
            {isAcc ? 'Accepted' : 'Accept'}
          </button>
          <button onClick={onReject} style={{
            padding: '5px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            background: isRej ? '#dc2626' : '#fff',
            color: isRej ? '#fff' : '#dc2626',
            border: `1.5px solid ${isRej ? '#dc2626' : '#fca5a5'}`,
          }}>
            {isRej ? 'Rejected' : 'Reject'}
          </button>
        </div>
      </div>
      {(change.current || change.suggested || change.why) && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {change.current && change.current.toLowerCase() !== 'not present' && (
            <div style={{ background: 'rgba(190,18,60,0.05)', border: '1px solid rgba(190,18,60,0.12)', borderRadius: 6, padding: '7px 10px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#be123c', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current clause</div>
              <div style={{ fontSize: 12.5, color: '#555', fontStyle: 'italic', lineHeight: 1.55 }}>{change.current}</div>
            </div>
          )}
          {change.suggested && (
            <div style={{ background: 'rgba(21,128,61,0.05)', border: '1px solid rgba(21,128,61,0.12)', borderRadius: 6, padding: '7px 10px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803d', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suggested fix</div>
              <div style={{ fontSize: 12.5, color: '#1a1a1a', lineHeight: 1.55 }}>{change.suggested}</div>
            </div>
          )}
          {change.why && (
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{change.why}</div>
          )}
        </div>
      )}
    </div>
  )
}

// Centered Word-doc modal overlay
function DocModal({ contract, changes, accepted, onClose, onSave }: {
  contract: StoredContract
  changes: ParsedChange[]
  accepted: Set<number>
  onClose: () => void
  onSave: (text: string) => void
}) {
  const baseText = contract.docText || '(No document text — re-upload to enable editing.)'
  const [content, setContent] = useState(() => applyChangesToDoc(baseText, changes, accepted))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setContent(applyChangesToDoc(baseText, changes, accepted))
  }, [accepted.size])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 24px', overflow: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#f0f0f0', borderRadius: 4, width: '100%', maxWidth: 860, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', minHeight: '80vh' }}>
        {/* Toolbar */}
        <div style={{ background: '#2b2b2b', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 12, borderRadius: '4px 4px 0 0', flexShrink: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', flex: 1 }}>{contract.filename}</span>
          {accepted.size > 0 && (
            <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 10, background: 'rgba(134,239,172,0.2)', color: '#86efac' }}>
              {accepted.size} fix{accepted.size !== 1 ? 'es' : ''} applied
            </span>
          )}
          <button onClick={() => { onSave(content); setSaved(true); setTimeout(() => setSaved(false), 2000) }}
            style={{ padding: '5px 16px', background: saved ? '#16a34a' : '#fff', color: saved ? '#fff' : '#111', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            {saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={onClose} style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.12)', color: '#ccc', border: 'none', borderRadius: 6, fontSize: 12.5, cursor: 'pointer' }}>
            Close
          </button>
        </div>
        {/* Page */}
        <div style={{ flex: 1, padding: '32px', overflow: 'auto' }}>
          <div style={{ background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.2)', margin: '0 auto', padding: '72px 80px', minHeight: 900 }}>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              style={{ width: '100%', minHeight: 800, border: 'none', outline: 'none', resize: 'none', fontFamily: '"Times New Roman", Times, serif', fontSize: 14, lineHeight: 1.9, color: '#111', background: 'transparent' }}
              spellCheck
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function findRelated(filename: string, stored: StoredContract[]): StoredContract | null {
  const base = filename.replace(/[-_\s]v\d+(\.\w+)?$/, '').replace(/\.\w+$/, '').toLowerCase().trim()
  return stored.find(c => {
    const b = c.filename.replace(/[-_\s]v\d+(\.\w+)?$/, '').replace(/\.\w+$/, '').toLowerCase().trim()
    return b === base && !c.parentId
  }) || null
}

export default function ContractsPage() {
  const [stored, setStored] = useState<StoredContract[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [selectedFilename, setSelectedFilename] = useState('')
  const [error, setError] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [versionPrompt, setVersionPrompt] = useState<{ file: File; parent: StoredContract } | null>(null)
  const [accepted, setAccepted] = useState<Set<number>>(new Set())
  const [rejected, setRejected] = useState<Set<number>>(new Set())
  const [currentContractId, setCurrentContractId] = useState<string | null>(null)
  const [docModal, setDocModal] = useState<StoredContract | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

  useEffect(() => { setStored(loadContracts()) }, [])

  async function handleUpload(file: File, parentId: string | null = null) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Please sign in first.'); return }

    setError(''); setBusy(true); setAnalysis(''); setSelectedFilename(file.name)
    setAccepted(new Set()); setRejected(new Set()); setCurrentContractId(null)
    setProgress('Reading document...')

    let docText = ''
    try { docText = await extractText(file) }
    catch (e: any) { setError(e.message); setBusy(false); setProgress(''); return }

    setProgress(`Analysing contract (${Math.round(docText.length / 1000)}k chars)...`)

    let fullAnalysis = ''; let doneCalled = false
    const onToken = (t: string) => { fullAnalysis += t; setAnalysis(p => p + t) }
    const onDone = () => {
      if (doneCalled) return; doneCalled = true
      setBusy(false); setProgress('')
      const current = loadContracts()
      let versionNumber = 1
      if (parentId) {
        const siblings = current.filter(c => c.parentId === parentId || c.id === parentId)
        versionNumber = siblings.length + 1
      }
      const id = Math.random().toString(36).slice(2)
      const newC: StoredContract = { id, filename: file.name, createdAt: new Date().toISOString(), analysis: fullAnalysis, docText, parentId, versionNumber, acceptedChanges: [], rejectedChanges: [] }
      setCurrentContractId(id)
      const updated = [newC, ...current]; saveContracts(updated); setStored(updated)
    }
    const onError = (e: string) => { setError(e); setBusy(false); setProgress('') }
    await streamContractAnalysis(session.access_token, docText, file.name, onToken, onDone, onError)
  }

  async function initiateUpload(file: File) {
    const current = loadContracts(); const related = findRelated(file.name, current)
    if (related) setVersionPrompt({ file, parent: related }); else await handleUpload(file, null)
  }

  function persistDecision(accSet: Set<number>, rejSet: Set<number>, cid = currentContractId) {
    if (!cid) return
    const current = loadContracts()
    const updated = current.map(c => c.id === cid ? { ...c, acceptedChanges: [...accSet], rejectedChanges: [...rejSet] } : c)
    saveContracts(updated); setStored(updated)
    // keep docModal fresh
    if (docModal?.id === cid) {
      const fresh = updated.find(c => c.id === cid); if (fresh) setDocModal(fresh)
    }
  }

  function handleAccept(changeIndex: number, cid?: string) {
    if (cid) {
      const c = stored.find(s => s.id === cid)!
      const na = new Set<number>(c.acceptedChanges || []); na.add(changeIndex)
      const nr = new Set<number>(c.rejectedChanges || []); nr.delete(changeIndex)
      persistDecision(na, nr, cid)
    } else {
      const na = new Set(accepted); na.add(changeIndex)
      const nr = new Set(rejected); nr.delete(changeIndex)
      setAccepted(na); setRejected(nr); persistDecision(na, nr)
    }
  }

  function handleReject(changeIndex: number, cid?: string) {
    if (cid) {
      const c = stored.find(s => s.id === cid)!
      const nr = new Set<number>(c.rejectedChanges || []); nr.add(changeIndex)
      const na = new Set<number>(c.acceptedChanges || []); na.delete(changeIndex)
      persistDecision(na, nr, cid)
    } else {
      const nr = new Set(rejected); nr.add(changeIndex)
      const na = new Set(accepted); na.delete(changeIndex)
      setRejected(nr); setAccepted(na); persistDecision(na, nr)
    }
  }

  function openDoc(contract: StoredContract) { setDocModal(contract) }

  function toggleExpand(id: string) {
    setExpandedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function deleteContract(id: string) {
    if (!window.confirm('Delete this contract analysis?')) return
    const updated = loadContracts().filter(c => c.id !== id && c.parentId !== id)
    saveContracts(updated); setStored(updated)
    if (docModal?.id === id) setDocModal(null)
  }

  const topLevel = stored.filter(c => !c.parentId)
  const changes = analysis ? parseChanges(analysis) : []
  const currentContract = currentContractId ? stored.find(c => c.id === currentContractId) : null

  // Derive doc modal changes & accepted
  const modalChanges = docModal ? parseChanges(docModal.analysis || '') : []
  const modalAccepted = new Set<number>(docModal?.acceptedChanges || [])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px' }}>
      {/* Doc modal */}
      {docModal && (
        <DocModal
          contract={docModal}
          changes={modalChanges}
          accepted={modalAccepted}
          onClose={() => setDocModal(null)}
          onSave={(text) => {
            const all = loadContracts()
            const updated = all.map(c => c.id === docModal.id ? { ...c, docText: text } : c)
            saveContracts(updated); setStored(updated)
          }}
        />
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Contract Review</h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>Upload PDF or Word (.docx) — full document, accept or reject each fix, then open the edited doc.</p>
      </div>

      {versionPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px', maxWidth: 420, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>New version?</div>
            <div style={{ fontSize: 13.5, color: '#555', marginBottom: 22 }}>Similar contract <strong>{versionPrompt.parent.filename}</strong> already exists.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={async () => { const { file, parent } = versionPrompt; setVersionPrompt(null); await handleUpload(file, parent.id) }}
                style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: '#0f0f0f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Yes, new version</button>
              <button onClick={async () => { const file = versionPrompt.file; setVersionPrompt(null); await handleUpload(file, null) }}
                style={{ flex: 1, padding: '10px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: '#fff', color: '#0f0f0f', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>No, separate</button>
            </div>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) initiateUpload(f) }}
        onDragOver={e => e.preventDefault()}
        onClick={() => !busy && fileRef.current?.click()}
        style={{ border: '2px dashed rgba(0,0,0,0.18)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: busy ? 'not-allowed' : 'pointer', background: busy ? '#f5f5f5' : '#fafafa', marginBottom: 20 }}>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) initiateUpload(f); e.target.value = '' }} />
        {busy ? (
          <>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>{progress}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>This may take a moment for large documents</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>Drag a contract here, or click to select</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>PDF, Word (.docx), TXT — full document, no size limit</div>
          </>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, color: '#b91c1c', marginBottom: 16 }}>{error}</div>
      )}

      {/* Live analysis card */}
      {(analysis || (busy && progress.includes('Analysing'))) && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{selectedFilename}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!busy && changes.length > 0 && (
                <span style={{ fontSize: 12, color: '#888' }}>
                  {accepted.size + rejected.size} / {changes.length} reviewed
                </span>
              )}
              {!busy && currentContract && (
                <button onClick={() => openDoc(currentContract)} style={{ padding: '6px 16px', border: 'none', borderRadius: 7, background: '#0f0f0f', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  Open Document
                </button>
              )}
            </div>
          </div>

          {/* Analysis text */}
          <div style={{ padding: '20px 24px', fontSize: 14 }}>
            <MarkdownRenderer content={analysis} />
            {busy && <span style={{ display: 'inline-block', width: 8, height: 14, background: '#0f0f0f', marginLeft: 2, animation: 'pulse 1s infinite', verticalAlign: 'middle' }} />}
          </div>

          {/* Risk / change cards — shown once streaming finishes */}
          {!busy && changes.length > 0 && (
            <div style={{ padding: '0 24px 24px' }}>
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 20, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999' }}>
                  {changes.length} Risk{changes.length !== 1 ? 's' : ''} — Accept or Reject Each Fix
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {accepted.size} accepted · {rejected.size} rejected
                </div>
              </div>
              {changes.map(c => (
                <ChangeCard
                  key={c.index}
                  change={c}
                  isAcc={accepted.has(c.index)}
                  isRej={rejected.has(c.index)}
                  onAccept={() => handleAccept(c.index)}
                  onReject={() => handleReject(c.index)}
                />
              ))}
              {accepted.size + rejected.size === changes.length && (
                <div style={{ marginTop: 14, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', fontSize: 13.5, color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>All done — {accepted.size} accepted, {rejected.size} rejected</span>
                  {currentContract && (
                    <button onClick={() => openDoc(currentContract)} style={{ padding: '6px 16px', border: 'none', borderRadius: 7, background: '#0f0f0f', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      Open Document
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {topLevel.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: 10 }}>Contract History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topLevel.map(c => {
              const versions = stored.filter(s => s.parentId === c.id)
              const cChanges = parseChanges(c.analysis || '')
              const cAcc = new Set<number>(c.acceptedChanges || [])
              const cRej = new Set<number>(c.rejectedChanges || [])
              const analysisExpanded = expandedIds.has('a_' + c.id)
              const versionsExpanded = expandedIds.has('v_' + c.id)

              return (
                <div key={c.id} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: '#f8f8f8', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0f0f0f' }}>{c.filename}</span>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,0,0,0.07)', color: '#555' }}>v{c.versionNumber}</span>
                        {versions.length > 0 && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#e0f2fe', color: '#0369a1' }}>{versions.length + 1} versions</span>}
                        {cChanges.length > 0 && (
                          <span style={{ fontSize: 11, color: cAcc.size + cRej.size === cChanges.length ? '#15803d' : '#aaa' }}>
                            {cAcc.size + cRej.size}/{cChanges.length} reviewed
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{new Date(c.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => openDoc(c)} style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                        Open Doc
                      </button>
                      {c.analysis && <button onClick={() => toggleExpand('a_' + c.id)} style={{ padding: '5px 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#555' }}>
                        {analysisExpanded ? 'Hide' : 'Analysis'}
                      </button>}
                      {versions.length > 0 && <button onClick={() => toggleExpand('v_' + c.id)} style={{ padding: '5px 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#555' }}>
                        {versionsExpanded ? 'Hide' : 'Versions'}
                      </button>}
                      <button onClick={() => deleteContract(c.id)} style={{ padding: '5px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#b91c1c' }}>Delete</button>
                    </div>
                  </div>

                  {analysisExpanded && (
                    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', background: '#fff' }}>
                      <MarkdownRenderer content={c.analysis} />
                      {cChanges.length > 0 && (
                        <div style={{ marginTop: 20, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: 12 }}>
                            {cChanges.length} Risks / Fixes
                          </div>
                          {cChanges.map(ch => (
                            <ChangeCard key={ch.index} change={ch} isAcc={cAcc.has(ch.index)} isRej={cRej.has(ch.index)}
                              onAccept={() => handleAccept(ch.index, c.id)} onReject={() => handleReject(ch.index, c.id)} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {versionsExpanded && versions.map(v => {
                    const vAnalysisExpanded = expandedIds.has('a_' + v.id)
                    const vChanges = parseChanges(v.analysis || '')
                    const vAcc = new Set<number>(v.acceptedChanges || [])
                    const vRej = new Set<number>(v.rejectedChanges || [])
                    return (
                      <div key={v.id} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '10px 16px 10px 32px', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: '#333' }}>{v.filename} <span style={{ fontSize: 11, color: '#aaa' }}>v{v.versionNumber}</span></div>
                            <div style={{ fontSize: 11.5, color: '#bbb', marginTop: 1 }}>{new Date(v.createdAt).toLocaleString()}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openDoc(v)} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}>Open Doc</button>
                            {v.analysis && <button onClick={() => toggleExpand('a_' + v.id)} style={{ padding: '4px 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', fontSize: 11.5, cursor: 'pointer', color: '#555' }}>{vAnalysisExpanded ? 'Hide' : 'Analysis'}</button>}
                            <button onClick={() => deleteContract(v.id)} style={{ padding: '4px 8px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', fontSize: 11.5, cursor: 'pointer', color: '#b91c1c' }}>Delete</button>
                          </div>
                        </div>
                        {vAnalysisExpanded && v.analysis && (
                          <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(0,0,0,0.05)', background: '#fff' }}>
                            <MarkdownRenderer content={v.analysis} />
                            {vChanges.length > 0 && (
                              <div style={{ marginTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
                                {vChanges.map(ch => (
                                  <ChangeCard key={ch.index} change={ch} isAcc={vAcc.has(ch.index)} isRej={vRej.has(ch.index)}
                                    onAccept={() => handleAccept(ch.index, v.id)} onReject={() => handleReject(ch.index, v.id)} />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
