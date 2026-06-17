'use client'
import { useState, useRef, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import MarkdownRenderer from '../../../components/MarkdownRenderer'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://law-oss-api-production.up.railway.app'

const CONTRACT_SYS = `You are Law OSS AI, an expert contract analyst. When given a contract document, provide a thorough analysis including:
1. CONTRACT SUMMARY — parties, purpose, key dates, governing law
2. KEY RISKS — rated [CRITICAL/HIGH/MEDIUM/LOW] with explanation
3. UNUSUAL OR MISSING CLAUSES — flag anything non-standard or absent
4. OBLIGATIONS — main duties of each party
5. RECOMMENDED CHANGES — for each recommendation, format it EXACTLY as:

**CHANGE [N]: [Short title]**
- **Current text:** "[exact quote from contract, or 'Not present' if missing]"
- **Suggested text:** "[your replacement text]"
- **Reason:** [brief explanation]

This format is required for the accept/reject feature. Number changes sequentially.

Be precise, structured, and professional. Use plain professional text with clear numbered headings. Always produce the complete analysis without truncating.`

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
  current: string
  suggested: string
  reason: string
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
      text += items.map((item: any) => (item.str ?? '')).join(' ') + '\n'
    }
    return text
  }
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
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
  const message = `Please analyse this contract:\n\n[FILE: ${filename}]\n\n${docText}`
  try {
    const res = await fetch(`${API_BASE}/api/agents/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        systemPrompt: CONTRACT_SYS,
        agentType: 'contract',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any
      onError(err.error || `Error ${res.status}`); return
    }
    const reader = res.body!.getReader()
    const dec = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw || raw === '[DONE]') { onDone(); continue }
        try { const p = JSON.parse(raw); if (p.token) onToken(p.token); if (p.done) onDone() } catch {}
      }
    }
    onDone()
  } catch (e: any) { onError(e.message || 'Network error') }
}

function parseChanges(analysis: string): ParsedChange[] {
  const changes: ParsedChange[] = []
  const blockRe = /\*\*CHANGE (\d+):\s*([^\n*]+)\*\*\s*\n([\s\S]*?)(?=\*\*CHANGE \d+:|$)/gi
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(analysis)) !== null) {
    const index = parseInt(m[1]); const title = m[2].trim(); const body = m[3]
    const currentMatch = /\*\*Current text:\*\*\s*[""]?([^"\n]+)[""]?/i.exec(body)
    const suggestedMatch = /\*\*Suggested text:\*\*\s*[""]?([^"\n]+)[""]?/i.exec(body)
    const reasonMatch = /\*\*Reason:\*\*\s*([^\n]+)/i.exec(body)
    changes.push({ index, title, current: currentMatch?.[1]?.trim() || '', suggested: suggestedMatch?.[1]?.trim() || '', reason: reasonMatch?.[1]?.trim() || '' })
  }
  return changes
}

// Apply accepted changes to doc text
function applyChangesToDoc(docText: string, changes: ParsedChange[], acceptedSet: Set<number>): string {
  let result = docText
  for (const change of changes) {
    if (!acceptedSet.has(change.index)) continue
    if (change.current && change.suggested && change.current !== 'Not present' && change.current !== '') {
      result = result.replace(change.current, change.suggested)
    } else if (change.suggested && (!change.current || change.current === 'Not present')) {
      // Append at end
      result = result + '\n\n' + change.suggested
    }
  }
  return result
}

function findRelated(filename: string, stored: StoredContract[]): StoredContract | null {
  const base = filename.replace(/[-_\s]v\d+(\.\w+)?$/, '').replace(/\.\w+$/, '').toLowerCase().trim()
  const match = stored.find(c => {
    const b = c.filename.replace(/[-_\s]v\d+(\.\w+)?$/, '').replace(/\.\w+$/, '').toLowerCase().trim()
    return b === base && !c.parentId
  })
  return match || null
}

// Word doc viewer/editor panel
function DocPanel({ contract, changes, accepted, onClose }: {
  contract: StoredContract
  changes: ParsedChange[]
  accepted: Set<number>
  onClose: () => void
}) {
  const storedAcc = new Set<number>(contract.acceptedChanges || [])
  const effectiveAcc = accepted.size > 0 ? accepted : storedAcc
  const baseText = contract.docText || '(Original document text not available — please re-upload to enable editing.)'
  const [content, setContent] = useState(() => applyChangesToDoc(baseText, changes, effectiveAcc))
  const [saved, setSaved] = useState(false)

  // Re-apply when accepted changes update
  useEffect(() => {
    setContent(applyChangesToDoc(baseText, changes, effectiveAcc))
  }, [accepted.size, storedAcc.size])

  function handleSave() {
    const all = loadContracts()
    const updated = all.map(c => c.id === contract.id ? { ...c, docText: content } : c)
    saveContracts(updated)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#e8e8e8' }}>
      {/* Toolbar */}
      <div style={{ background: '#2b2b2b', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{contract.filename}</span>
          {effectiveAcc.size > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(134,239,172,0.2)', color: '#86efac' }}>
              {effectiveAcc.size} change{effectiveAcc.size !== 1 ? 's' : ''} applied
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} style={{
            padding: '5px 14px', background: saved ? '#16a34a' : '#fff', color: saved ? '#fff' : '#0f0f0f',
            border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>
            {saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={onClose} style={{
            padding: '5px 12px', background: 'rgba(255,255,255,0.1)', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
          }}>
            Close
          </button>
        </div>
      </div>

      {/* Page area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
        <div style={{
          background: '#fff',
          boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
          borderRadius: 2,
          minHeight: '100%',
          padding: '72px 80px',
          maxWidth: 820,
          margin: '0 auto',
        }}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: 900,
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: '"Times New Roman", Times, serif',
              fontSize: 14,
              lineHeight: 1.8,
              color: '#1a1a1a',
              background: 'transparent',
            }}
            spellCheck
          />
        </div>
      </div>
    </div>
  )
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
  // Split-pane doc viewer
  const [docPanelContract, setDocPanelContract] = useState<StoredContract | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

  useEffect(() => { setStored(loadContracts()) }, [])

  // Sync doc panel when stored updates (e.g. after accept/reject saves)
  useEffect(() => {
    if (docPanelContract) {
      const fresh = stored.find(c => c.id === docPanelContract.id)
      if (fresh) setDocPanelContract(fresh)
    }
  }, [stored])

  async function handleUpload(file: File, parentId: string | null = null) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Please sign in first.'); return }

    setError(''); setBusy(true); setAnalysis(''); setSelectedFilename(file.name)
    setAccepted(new Set()); setRejected(new Set()); setCurrentContractId(null)
    setDocPanelContract(null)
    setProgress('Reading document...')

    let docText = ''
    try { docText = await extractText(file) }
    catch (e: any) { setError(e.message); setBusy(false); setProgress(''); return }

    setProgress(`Analysing contract (${Math.round(docText.length / 1000)}k chars) with AI...`)

    let fullAnalysis = ''; let doneCalled = false
    const onToken = (t: string) => { fullAnalysis += t; setAnalysis(prev => prev + t) }
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
      const newContract: StoredContract = {
        id, filename: file.name, createdAt: new Date().toISOString(),
        analysis: fullAnalysis, docText,
        parentId, versionNumber, acceptedChanges: [], rejectedChanges: [],
      }
      setCurrentContractId(id)
      const updated = [newContract, ...current]
      saveContracts(updated); setStored(updated)
    }
    const onError = (e: string) => { setError(e); setBusy(false); setProgress('') }
    await streamContractAnalysis(session.access_token, docText, file.name, onToken, onDone, onError)
  }

  async function initiateUpload(file: File) {
    const current = loadContracts()
    const related = findRelated(file.name, current)
    if (related) setVersionPrompt({ file, parent: related })
    else await handleUpload(file, null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]; if (file) initiateUpload(file)
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function deleteContract(id: string) {
    if (!window.confirm('Delete this contract analysis?')) return
    const current = loadContracts()
    const updated = current.filter(c => c.id !== id && c.parentId !== id)
    saveContracts(updated); setStored(updated)
    if (docPanelContract?.id === id) setDocPanelContract(null)
  }

  function persistDecision(accSet: Set<number>, rejSet: Set<number>) {
    if (!currentContractId) return
    const current = loadContracts()
    const updated = current.map(c => c.id === currentContractId
      ? { ...c, acceptedChanges: [...accSet], rejectedChanges: [...rejSet] } : c)
    saveContracts(updated); setStored(updated)
  }

  function handleAccept(changeIndex: number) {
    const newAcc = new Set(accepted); newAcc.add(changeIndex)
    const newRej = new Set(rejected); newRej.delete(changeIndex)
    setAccepted(newAcc); setRejected(newRej)
    persistDecision(newAcc, newRej)
  }

  function handleReject(changeIndex: number) {
    const newRej = new Set(rejected); newRej.add(changeIndex)
    const newAcc = new Set(accepted); newAcc.delete(changeIndex)
    setRejected(newRej); setAccepted(newAcc)
    persistDecision(newAcc, newRej)
  }

  function openDocPanel(contract: StoredContract) {
    setDocPanelContract(contract)
  }

  const topLevel = stored.filter(c => !c.parentId)
  const changes = analysis ? parseChanges(analysis) : []
  const pendingCount = changes.filter(c => !accepted.has(c.index) && !rejected.has(c.index)).length
  const currentContract = currentContractId ? stored.find(c => c.id === currentContractId) : null

  // Full-screen split when doc panel is open
  if (docPanelContract) {
    const docChanges = parseChanges(docPanelContract.analysis || '')
    const docAccepted = new Set<number>(docPanelContract.acceptedChanges || [])
    return (
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* Left: analysis */}
        <div style={{ width: '42%', borderRight: '1px solid rgba(0,0,0,0.1)', overflow: 'auto', background: '#fff' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setDocPanelContract(null)} style={{ padding: '5px 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', fontSize: 12.5, cursor: 'pointer', color: '#555' }}>
              ← Back
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>AI Analysis</span>
          </div>
          <div style={{ padding: '20px' }}>
            <MarkdownRenderer content={docPanelContract.analysis} />

            {/* Accept/Reject in left panel */}
            {docChanges.length > 0 && (
              <div style={{ marginTop: 24, borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: 14 }}>Recommended Changes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {docChanges.map(change => {
                    const isAcc = docAccepted.has(change.index)
                    const storedRej = new Set<number>(docPanelContract.rejectedChanges || [])
                    const isRej = storedRej.has(change.index)
                    return (
                      <div key={change.index} style={{ border: `1.5px solid ${isAcc ? '#86efac' : isRej ? '#fca5a5' : 'rgba(0,0,0,0.1)'}`, borderRadius: 8, padding: '10px 12px', background: isAcc ? '#f0fdf4' : isRej ? '#fff1f2' : '#fafafa' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f0f0f', marginBottom: 6 }}>Change {change.index}: {change.title}</div>
                        {change.reason && <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{change.reason}</div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => {
                            const newAcc = new Set(docAccepted); newAcc.add(change.index)
                            const storedRejSet = new Set<number>(docPanelContract.rejectedChanges || []); storedRejSet.delete(change.index)
                            const all = loadContracts()
                            const updated = all.map(c => c.id === docPanelContract.id ? { ...c, acceptedChanges: [...newAcc], rejectedChanges: [...storedRejSet] } : c)
                            saveContracts(updated); setStored(updated)
                          }} style={{ padding: '4px 12px', border: `1.5px solid ${isAcc ? '#16a34a' : '#86efac'}`, borderRadius: 6, background: isAcc ? '#16a34a' : '#f0fdf4', color: isAcc ? '#fff' : '#16a34a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {isAcc ? 'Accepted' : 'Accept'}
                          </button>
                          <button onClick={() => {
                            const storedRejSet = new Set<number>(docPanelContract.rejectedChanges || []); storedRejSet.add(change.index)
                            const newAcc = new Set(docAccepted); newAcc.delete(change.index)
                            const all = loadContracts()
                            const updated = all.map(c => c.id === docPanelContract.id ? { ...c, acceptedChanges: [...newAcc], rejectedChanges: [...storedRejSet] } : c)
                            saveContracts(updated); setStored(updated)
                          }} style={{ padding: '4px 12px', border: `1.5px solid ${isRej ? '#dc2626' : '#fca5a5'}`, borderRadius: 6, background: isRej ? '#dc2626' : '#fff1f2', color: isRej ? '#fff' : '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {isRej ? 'Rejected' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Word-style doc editor */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <DocPanel
            contract={docPanelContract}
            changes={docChanges}
            accepted={docAccepted}
            onClose={() => setDocPanelContract(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Contract Review</h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>Upload a contract for AI-powered risk analysis. Supports PDF and Word (.docx) — full document, no length limit.</p>
      </div>

      {/* Version prompt modal */}
      {versionPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px', maxWidth: 420, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f0f0f', marginBottom: 10 }}>New version?</div>
            <div style={{ fontSize: 13.5, color: '#555', marginBottom: 22 }}>
              A similar contract <strong>{versionPrompt.parent.filename}</strong> already exists. Is this a new version?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={async () => { const { file, parent } = versionPrompt; setVersionPrompt(null); await handleUpload(file, parent.id) }}
                style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: '#0f0f0f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Yes, new version
              </button>
              <button onClick={async () => { const file = versionPrompt.file; setVersionPrompt(null); await handleUpload(file, null) }}
                style={{ flex: 1, padding: '10px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: '#fff', color: '#0f0f0f', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                No, separate contract
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div onDrop={onDrop} onDragOver={e => e.preventDefault()}
        onClick={() => !busy && fileRef.current?.click()}
        style={{ border: '2px dashed rgba(0,0,0,0.18)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: busy ? 'not-allowed' : 'pointer', background: busy ? '#f5f5f5' : 'rgba(0,0,0,0.01)', marginBottom: 20 }}>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) initiateUpload(f); e.target.value = '' }} />
        {busy ? (
          <div>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>{progress}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>This may take a moment for large documents</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>Drag a contract here, or click to select</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Supports PDF, Word (.docx), TXT — full document, no size limit</div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, color: '#b91c1c', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Live analysis after upload */}
      {(analysis || (busy && progress.includes('Analysing'))) && (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{selectedFilename}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!busy && changes.length > 0 && (
                <span style={{ fontSize: 12, color: '#888' }}>
                  {accepted.size + rejected.size}/{changes.length} changes reviewed
                  {pendingCount > 0 && <span style={{ color: '#d97706', marginLeft: 6 }}>{pendingCount} pending</span>}
                </span>
              )}
              {!busy && currentContract && (
                <button onClick={() => openDocPanel(currentContract)} style={{
                  padding: '6px 14px', border: 'none', borderRadius: 7,
                  background: '#0f0f0f', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}>
                  Open Document
                </button>
              )}
            </div>
          </div>
          <div style={{ padding: '20px 24px', fontSize: 14 }}>
            <MarkdownRenderer content={analysis} />
            {busy && <span style={{ display: 'inline-block', width: 8, height: 14, background: '#0f0f0f', marginLeft: 2, animation: 'pulse 1s infinite', verticalAlign: 'middle' }} />}
          </div>

          {/* Accept/Reject panel */}
          {!busy && changes.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '20px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: 14 }}>
                Recommended Changes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {changes.map(change => {
                  const isAccepted = accepted.has(change.index)
                  const isRejected = rejected.has(change.index)
                  return (
                    <div key={change.index} style={{
                      border: `1.5px solid ${isAccepted ? '#86efac' : isRejected ? '#fca5a5' : 'rgba(0,0,0,0.1)'}`,
                      borderRadius: 10, background: isAccepted ? '#f0fdf4' : isRejected ? '#fff1f2' : '#fafafa', overflow: 'hidden',
                    }}>
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f0f0f', marginBottom: 6 }}>Change {change.index}: {change.title}</div>
                          {change.current && <div style={{ marginBottom: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600, color: '#b91c1c', marginRight: 6 }}>Current:</span><span style={{ fontSize: 12.5, color: '#555', fontStyle: 'italic' }}>{change.current}</span></div>}
                          {change.suggested && <div style={{ marginBottom: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600, color: '#15803d', marginRight: 6 }}>Suggested:</span><span style={{ fontSize: 12.5, color: '#333' }}>{change.suggested}</span></div>}
                          {change.reason && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{change.reason}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button onClick={() => handleAccept(change.index)} style={{ padding: '6px 14px', borderRadius: 7, background: isAccepted ? '#16a34a' : '#f0fdf4', color: isAccepted ? '#fff' : '#16a34a', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${isAccepted ? '#16a34a' : '#86efac'}` }}>
                            {isAccepted ? 'Accepted' : 'Accept'}
                          </button>
                          <button onClick={() => handleReject(change.index)} style={{ padding: '6px 14px', borderRadius: 7, background: isRejected ? '#dc2626' : '#fff1f2', color: isRejected ? '#fff' : '#dc2626', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${isRejected ? '#dc2626' : '#fca5a5'}` }}>
                            {isRejected ? 'Rejected' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {changes.length > 0 && accepted.size + rejected.size === changes.length && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', fontSize: 13.5, color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>All {changes.length} changes reviewed — {accepted.size} accepted, {rejected.size} rejected.</span>
                  {currentContract && (
                    <button onClick={() => openDocPanel(currentContract)} style={{ padding: '6px 16px', border: 'none', borderRadius: 7, background: '#0f0f0f', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      Open Document
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Contract history */}
      {topLevel.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: 10 }}>Contract History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topLevel.map(c => {
              const versions = stored.filter(s => s.parentId === c.id)
              const hasVersions = versions.length > 0
              const isExpanded = expandedIds.has(c.id)
              const analysisExpanded = expandedIds.has('analysis_' + c.id)
              const accLen = c.acceptedChanges?.length ?? 0
              const rejLen = c.rejectedChanges?.length ?? 0

              return (
                <div key={c.id} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: '#f8f8f8', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0f0f0f' }}>{c.filename}</span>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,0,0,0.07)', color: '#555' }}>v{c.versionNumber}</span>
                        {hasVersions && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#e0f2fe', color: '#0369a1' }}>{versions.length + 1} versions</span>}
                        {(accLen > 0 || rejLen > 0) && <span style={{ fontSize: 11, color: '#888' }}>{accLen} accepted · {rejLen} rejected</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{new Date(c.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openDocPanel(c)} style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                        Open Doc
                      </button>
                      {c.analysis && (
                        <button onClick={() => toggleExpand('analysis_' + c.id)} style={{ padding: '5px 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#555' }}>
                          {analysisExpanded ? 'Hide' : 'Analysis'}
                        </button>
                      )}
                      {hasVersions && (
                        <button onClick={() => toggleExpand(c.id)} style={{ padding: '5px 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#555' }}>
                          {isExpanded ? 'Hide versions' : 'Versions'}
                        </button>
                      )}
                      <button onClick={() => deleteContract(c.id)} style={{ padding: '5px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#b91c1c' }}>Delete</button>
                    </div>
                  </div>

                  {analysisExpanded && c.analysis && (
                    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', background: '#fff', fontSize: 13.5 }}>
                      <MarkdownRenderer content={c.analysis} />
                    </div>
                  )}

                  {isExpanded && versions.map(v => {
                    const vKey = 'analysis_v_' + v.id
                    const vExpanded = expandedIds.has(vKey)
                    return (
                      <div key={v.id} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '10px 16px 10px 32px', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, color: '#333' }}>{v.filename}</span>
                              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,0,0,0.07)', color: '#555' }}>v{v.versionNumber}</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: '#bbb', marginTop: 1 }}>{new Date(v.createdAt).toLocaleString()}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openDocPanel(v)} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}>Open Doc</button>
                            {v.analysis && <button onClick={() => toggleExpand(vKey)} style={{ padding: '4px 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', fontSize: 11.5, cursor: 'pointer', color: '#555' }}>{vExpanded ? 'Hide' : 'Analysis'}</button>}
                            <button onClick={() => deleteContract(v.id)} style={{ padding: '4px 8px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', fontSize: 11.5, cursor: 'pointer', color: '#b91c1c' }}>Delete</button>
                          </div>
                        </div>
                        {vExpanded && v.analysis && (
                          <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(0,0,0,0.05)', background: '#fff', fontSize: 13.5 }}>
                            <MarkdownRenderer content={v.analysis} />
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
