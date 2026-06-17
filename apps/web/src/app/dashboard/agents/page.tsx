'use client'
import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import LogoLoader from '../../../components/LogoLoader'

type Msg = { role: 'user' | 'assistant'; content: string }
type AttachedDoc = { name: string; text: string }
type SavedChat = { id: string; agentId: string; agentName: string; title: string; messages: Msg[]; savedAt: string }
type Matter = { id: string; name: string; type: string; status: string; court?: string; attorney?: string; dueDate?: string; notes?: string; savedChats: SavedChat[] }

function getMatters(): Matter[] { try { return JSON.parse(localStorage.getItem('law_oss_matters') || '[]') } catch { return [] } }
function persistMatters(m: Matter[]) { localStorage.setItem('law_oss_matters', JSON.stringify(m)) }

function SaveToMatter({ messages, agentId, agentName }: { messages: Msg[]; agentId: string; agentName: string }) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  const matters = getMatters()
  function save(matter: Matter) {
    const firstUser = messages.find(m => m.role === 'user')?.content || 'Untitled'
    const chat: SavedChat = { id: Date.now().toString(), agentId, agentName, title: firstUser.slice(0, 60), messages, savedAt: new Date().toISOString() }
    const updated = matters.map(m => m.id === matter.id ? { ...m, savedChats: [...m.savedChats, chat] } : m)
    persistMatters(updated)
    setOpen(false)
    setToast(`Saved to ${matter.name}`)
    setTimeout(() => setToast(''), 2500)
  }
  if (matters.length === 0) return null
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 6, background: '#fff', color: '#374151', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save to Matter
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: '110%', left: 0, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, zIndex: 100, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f3f4f6' }}>Choose a matter</div>
          {matters.map(m => (
            <button key={m.id} onClick={() => save(m)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#0f0f0f' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              {m.name} <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4, textTransform: 'capitalize' }}>{m.status}</span>
            </button>
          ))}
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0f0f0f', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>{toast}</div>}
    </div>
  )
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  function copy() { navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }
  return (
    <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', color: copied ? '#166534' : '#374151', fontSize: 12.5, cursor: 'pointer' }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (
    file.type.startsWith('text/') ||
    name.endsWith('.txt') || name.endsWith('.md') ||
    name.endsWith('.csv') || name.endsWith('.json')
  ) {
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
      const pageItems = (extracted.items || []) as any[]
      text += pageItems.map((item: any) => (item.str ?? '')).join(' ') + '\n'
    }
    return text.slice(0, 30000)
  }
  throw new Error(`Unsupported file type. Please upload PDF, TXT, MD, CSV, or JSON.`)
}

async function downloadAsWord(content: string, filename = 'document.docx') {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const lines = content.split('\n')
  const children: any[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { children.push(new Paragraph({ text: '' })); continue }
    if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({ text: trimmed.slice(4), heading: HeadingLevel.HEADING_3 }))
    } else if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2 }))
    } else if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({ text: trimmed.slice(2), heading: HeadingLevel.HEADING_1 }))
    } else {
      const parts: any[] = []
      const boldRegex = /\*\*(.+?)\*\*/g
      let last = 0, match
      while ((match = boldRegex.exec(trimmed)) !== null) {
        if (match.index > last) parts.push(new TextRun(trimmed.slice(last, match.index)))
        parts.push(new TextRun({ text: match[1], bold: true }))
        last = match.index + match[0].length
      }
      if (last < trimmed.length) parts.push(new TextRun(trimmed.slice(last)))
      children.push(new Paragraph({ children: parts.length ? parts : [new TextRun(trimmed)] }))
    }
  }
  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function looksLikeDocument(content: string): boolean {
  if (content.length < 200) return false
  const hasHeadings = /^#{1,3} .+/m.test(content)
  const hasSections = (content.match(/\n\n/g) || []).length >= 3
  const hasDocKeywords = /\b(AGREEMENT|CONTRACT|DEED|LETTER|CLAUSE|WHEREAS|RECITAL|PARTIES|SIGNED|dated this|THIS AGREEMENT|BETWEEN|hereinafter|IN WITNESS|Schedule|Annexure|TERMS AND CONDITIONS)\b/i.test(content)
  return hasHeadings || (hasSections && hasDocKeywords)
}

function DocEditorModal({ content, onClose, agentName }: { content: string; onClose: () => void; agentName: string }) {
  const [text, setText] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const filename = `${agentName.toLowerCase().replace(/\s+/g, '-')}-draft.docx`
  useEffect(() => { textareaRef.current?.focus() }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
      <div style={{ position: 'relative', background: '#fff', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 860, margin: '20px', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e5e5', background: '#fafafa', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f' }}>Document Editor</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Edit your draft — download as Word when ready</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => downloadAsWord(text, filename)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 7, background: '#0f0f0f', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Word
            </button>
            <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e5e5e5', borderRadius: 7, background: '#fff', color: '#666', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>x</button>
          </div>
        </div>
        <div style={{ padding: '7px 20px', background: '#f0f7ff', borderBottom: '1px solid #dbeafe', fontSize: 11.5, color: '#1d4ed8' }}>
          Use # for title, ## for sections, **bold** — all convert to Word styles on download
        </div>
        <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} style={{ flex: 1, padding: '20px 24px', border: 'none', outline: 'none', resize: 'none', fontSize: 14, lineHeight: 1.8, color: '#1a1a1a', fontFamily: 'Georgia, "Times New Roman", serif', background: '#fff', minHeight: 0 }} spellCheck={true} />
        <div style={{ padding: '8px 20px', borderTop: '1px solid #e5e5e5', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: '#aaa' }}>{text.length.toLocaleString()} chars · {text.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
          <button onClick={() => downloadAsWord(text, filename)} style={{ padding: '6px 16px', border: '1px solid #e5e5e5', borderRadius: 6, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Save as Word (.docx)</button>
        </div>
      </div>
    </div>
  )
}

function DocActions({ content, agentName }: { content: string; agentName: string }) {
  const [editing, setEditing] = useState(false)
  const filename = `${agentName.toLowerCase().replace(/\s+/g, '-')}-draft.docx`
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid #0f0f0f', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Open &amp; Edit
        </button>
        <button onClick={() => downloadAsWord(content, filename)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 6, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download Word (.docx)
        </button>
      </div>
      {editing && <DocEditorModal content={content} agentName={agentName} onClose={() => setEditing(false)} />}
    </>
  )
}

const AGENTS = [
  { id: 'research', name: 'Legal Researcher', desc: 'Case law, statutes & regulations', icon: 'R', chips: ['Find relevant cases', 'Summarise statute', 'Cite authority'], sys: `You are Law OSS AI, an expert legal research assistant. Find relevant cases, statutes, and regulations. Always cite specific authorities with proper citation format (e.g. [2024] EWHC 1234, 42 U.S.C. § 1983). Never fabricate citations. Apply the governing law of the jurisdiction specified; if none, use general common law principles. Be precise and professional.` },
  { id: 'drafting', name: 'Document Drafter', desc: 'Draft legal documents & clauses', icon: 'D', chips: ['Draft NDA clause', 'Write demand letter', 'Create settlement agreement'], sys: `You are a senior commercial lawyer. Draft complete, legally enforceable documents using professional UK legal language (unless another jurisdiction is specified). Mark gaps as [PLACEHOLDER].

CRITICAL — DO NOT TRUNCATE: You must complete the entire document. If you reach your output limit before finishing, end the response with exactly: [CONTINUE FROM CLAUSE X] — then the system will automatically prompt you to continue. Resume precisely where you stopped. Never summarise, skip, or abbreviate clauses. Every clause must be fully drafted.` },
  { id: 'contract', name: 'Contract Analyst', desc: 'Contract review & risk analysis', icon: 'C', chips: ['Review this contract', 'Flag risky clauses', 'Compare to standard terms'], sys: `You are Law OSS AI, an expert contract analyst. Identify risks [CRITICAL/HIGH/MEDIUM/LOW], unusual clauses, and missing provisions. Compare against market standard terms. Apply the governing law of the jurisdiction specified; if none, use general common law principles. Be precise and structured.` },
  { id: 'litigation', name: 'Litigation Assistant', desc: 'Strategy, procedure & pleadings', icon: 'L', chips: ['Assess case merits', 'Draft skeleton argument', 'Litigation risk estimate'], sys: `You are Law OSS AI, an expert litigation assistant. Analyse merits, identify key issues, suggest case strategy, and assess litigation risk with probability estimates. Apply the governing law of the jurisdiction specified; if none, use general common law principles. Be precise and strategic.` },
  { id: 'compliance', name: 'Compliance Officer', desc: 'Regulatory compliance guidance', icon: 'Co', chips: ['Check GDPR compliance', 'AML obligations', 'Data breach response'], sys: `You are Law OSS AI, an expert compliance advisor. Identify applicable regulations by name and provision, analyse compliance gaps, and recommend remediation steps. Apply the governing law of the jurisdiction specified; if none, use general principles. Be thorough and practical.` },
  { id: 'dd', name: 'Due Diligence', desc: 'M&A and transaction analysis', icon: 'DD', chips: ['M&A red flags', 'Corporate structure review', 'IP ownership check'], sys: `You are Law OSS AI, an expert due diligence specialist. Systematically analyse corporate, financial, and legal risks in transactions. Format findings with priority levels [CRITICAL/HIGH/MEDIUM/LOW]. Apply the governing law of the jurisdiction specified; if none, use general principles.` },
  { id: 'client', name: 'Client Comms', desc: 'Client letters & plain English', icon: 'Cl', chips: ['Explain in plain English', 'Draft client update', 'Write advice letter'], sys: `You are Law OSS AI, an expert in legal client communication. Draft clear, professional letters explaining legal concepts in plain language. Always include appropriate disclaimers. Apply the governing law of the jurisdiction specified; if none, use general principles. Use # for letter heading, ## for sections.` },
  { id: 'billing', name: 'Billing & Narratives', desc: 'Time entries & billing narratives', icon: 'B', chips: ['Write billing narrative', 'Review time entry', 'Draft fee agreement'], sys: `You are Law OSS AI, an expert in legal billing. Review time entries, draft clear and defensible billing narratives, and identify potential write-offs. Apply law firm billing best practices. Be concise and professional.` },
]

function getSystemPrompt(agentId: string): string {
  return AGENTS.find(a => a.id === agentId)?.sys || AGENTS[0].sys
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function streamFromBackend(
  token: string, agentId: string, messages: Msg[], sys: string,
  onToken: (t: string) => void, onDone: () => void, onError: (e: string) => void,
) {
  try {
    const res = await fetch(`${API}/api/agents/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ agentId, message: messages[messages.length - 1].content, history: messages.slice(0, -1), systemPrompt: sys }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any
      onError(err.error || `Server error ${res.status}`)
      return
    }
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim(); if (!raw) continue
        try {
          const p = JSON.parse(raw)
          if (p.token) onToken(p.token)
          if (p.done) onDone()
          if (p.error) onError(p.error)
        } catch {}
      }
    }
  } catch (e: any) { onError(e.message || 'Network error') }
}

export default function AgentsPage() {
  const [agentId, setAgentId] = useState(AGENTS[0].id)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [noKey, setNoKey] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setAuthToken(session.access_token)
      // Check if API key is configured on backend
      fetch(`${API}/api/api-keys/status`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json()).then(d => setNoKey(!d.hasKey)).catch(() => setNoKey(true))
    })
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setUploadError('')
    try { const text = await extractTextFromFile(file); setAttachedDoc({ name: file.name, text }) }
    catch (err: any) { setUploadError(err.message || 'Failed to read file') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  async function send(text: string) {
    if (!text.trim() || streaming) return
    if (!authToken) { window.location.href = '/login'; return }
    if (noKey) return
    const msg = attachedDoc ? `${text.trim()}\n\n[Attached: ${attachedDoc.name}]\n${attachedDoc.text}` : text.trim()
    setInput(''); setAttachedDoc(null)
    const sys = getSystemPrompt(agentId)
    setStreaming(true)

    // Build history and add assistant placeholder
    let history: Msg[] = [...messages, { role: 'user', content: msg }]
    setMessages([...history, { role: 'assistant', content: '' }])

    const appendToken = (t: string) => setMessages(prev => {
      const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: n[n.length - 1].content + t }; return n
    })
    const onError = (e: string) => {
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: `Error: ${e}` }; return n })
      setStreaming(false)
    }

    // Auto-continuation loop: if response ends with [CONTINUE FROM CLAUSE X], keep going
    let continueLoop = true
    while (continueLoop) {
      continueLoop = false
      let fullResponse = ''
      let resolved = false
      await new Promise<void>((resolve) => {
        const onToken = (t: string) => { fullResponse += t; appendToken(t) }
        const onDone = () => { if (!resolved) { resolved = true; resolve() } }
        const onErr = (e: string) => { onError(e); if (!resolved) { resolved = true; resolve() } }
        streamFromBackend(authToken!, agentId, history, sys, onToken, onDone, onErr)
      })

      // Check if AI signalled continuation
      if (/\[CONTINUE FROM CLAUSE/i.test(fullResponse)) {
        continueLoop = true
        history = [...history, { role: 'assistant', content: fullResponse }, { role: 'user', content: 'Continue.' }]
        appendToken('\n\n')
      }
    }

    setStreaming(false)
  }

  const activeAgent = AGENTS.find(a => a.id === agentId)!

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 220, borderRight: '1px solid rgba(0,0,0,0.08)', overflowY: 'auto', flexShrink: 0, background: '#fafafa' }}>
        <div style={{ padding: '14px 16px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999' }}>Agents</div>
        {AGENTS.map(a => (
          <button key={a.id} onClick={() => { setAgentId(a.id); setMessages([]) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: agentId === a.id ? '#fff' : 'transparent', borderLeft: agentId === a.id ? '3px solid #0f0f0f' : '3px solid transparent', cursor: 'pointer' }}>
            <div style={{ fontSize: 13.5, fontWeight: agentId === a.id ? 600 : 400, color: agentId === a.id ? '#0f0f0f' : '#333' }}>{a.name}</div>
            <div style={{ fontSize: 11.5, color: '#888', marginTop: 2, lineHeight: 1.4 }}>{a.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#fff', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f0f0f' }}>{activeAgent.name}</div>
          <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>{activeAgent.desc}</div>
        </div>

        {noKey && (
          <div style={{ padding: '10px 20px', background: '#fefce8', borderBottom: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
            No API key configured. <a href="/onboarding" style={{ color: '#0f0f0f', fontWeight: 600 }}>Add your key</a>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
              <div style={{ width: 44, height: 44, background: '#0f0f0f', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 0.5, marginBottom: 14 }}>{activeAgent.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f0f0f', marginBottom: 6 }}>{activeAgent.name}</div>
              <div style={{ fontSize: 13.5, color: '#999', marginBottom: 24, textAlign: 'center', maxWidth: 320 }}>{activeAgent.desc}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {activeAgent.chips.map(c => (
                  <button key={c} onClick={() => send(c)} style={{ padding: '8px 16px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 20, background: '#fff', color: '#333', fontSize: 13, cursor: 'pointer' }}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isLastAssistant = m.role === 'assistant' && i === messages.length - 1
            const isDone = !streaming || !isLastAssistant
            const showDocActions = m.role === 'assistant' && isDone && looksLikeDocument(m.content)
            const showMsgActions = m.role === 'assistant' && isDone && m.content
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '72%', padding: '10px 14px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? '#0f0f0f' : '#fff', color: m.role === 'user' ? '#fff' : '#0f0f0f', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    {m.content || (streaming && isLastAssistant ? (
                      <LogoLoader label="Thinking..." />
                    ) : '')}
                  </div>
                </div>
                {showDocActions && (
                  <div style={{ paddingLeft: 4 }}>
                    <DocActions content={m.content} agentName={activeAgent.name} />
                  </div>
                )}
                {showMsgActions && (
                  <div style={{ paddingLeft: 4, display: 'flex', gap: 6, marginTop: showDocActions ? 4 : 6, flexWrap: 'wrap' }}>
                    <CopyButton content={m.content} />
                    <SaveToMatter messages={messages.slice(0, i + 1)} agentId={agentId} agentName={activeAgent.name} />
                  </div>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '10px 20px 14px', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
          {attachedDoc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12.5 }}>
              <span style={{ color: '#166534' }}>Attached: {attachedDoc.name}</span>
              <button onClick={() => setAttachedDoc(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 16 }}>x</button>
            </div>
          )}
          {uploadError && (
            <div style={{ padding: '6px 10px', marginBottom: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5, color: '#dc2626' }}>{uploadError}</div>
          )}
          <div style={{ display: 'flex', gap: 8, background: '#f8f8f8', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '6px 10px' }}>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.json" onChange={handleFileSelect} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach document" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18, padding: '0 2px', alignSelf: 'flex-end', marginBottom: 2 }}>{uploading ? '...' : 'P'}</button>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder={`Ask ${activeAgent.name}... (Enter to send)`}
              disabled={streaming} rows={1}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 14, color: '#0f0f0f', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }}
            />
            <button onClick={() => send(input)} disabled={streaming || !input.trim()} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', alignSelf: 'flex-end', flexShrink: 0, background: streaming || !input.trim() ? 'rgba(0,0,0,0.1)' : '#0f0f0f', color: streaming || !input.trim() ? '#bbb' : '#fff', cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>^</button>
          </div>
          <div style={{ fontSize: 11, color: '#ccc', marginTop: 5, textAlign: 'center' }}>Not legal advice. Verify with a qualified lawyer. Supports PDF, TXT, MD, CSV, JSON.</div>
        </div>
      </div>
    </div>
  )
}
