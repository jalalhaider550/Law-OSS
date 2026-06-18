'use client'
import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import MarkdownRenderer from '../../components/MarkdownRenderer'

type Msg = { role: 'user' | 'assistant'; content: string }
type AttachedDoc = { name: string; text: string }
type SavedChat = { id: string; agentId: string; agentName: string; title: string; messages: Msg[]; savedAt: string }
type Matter = { id: string; name: string; type: string; status: string; savedChats: SavedChat[] }

function userKey(base: string) { return `${base}_${localStorage.getItem('law_oss_uid') || 'default'}` }

function getMatters(): Matter[] { try { return JSON.parse(localStorage.getItem(userKey('law_oss_matters')) || '[]') } catch { return [] } }
function persistMatters(m: Matter[]) { localStorage.setItem(userKey('law_oss_matters'), JSON.stringify(m)) }

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || name.endsWith('.json')) {
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
      text += (extracted.items as any[]).map((item: any) => item.str ?? '').join(' ') + '\n'
    }
    return text
  }
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth')
    const ab = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: ab })
    return result.value
  }
  throw new Error('Unsupported file type. Please upload PDF, DOCX, TXT, MD, CSV, or JSON.')
}

function SaveToMatter({ messages, agentId, agentName }: { messages: Msg[]; agentId: string; agentName: string }) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  const matters = getMatters()
  function save(matter: Matter) {
    const firstUser = messages.find(m => m.role === 'user')?.content || 'Untitled'
    const chat: SavedChat = { id: Date.now().toString(), agentId, agentName, title: firstUser.slice(0, 60), messages, savedAt: new Date().toISOString() }
    const updated = matters.map(m => m.id === matter.id ? { ...m, savedChats: [...(m.savedChats || []), chat] } : m)
    persistMatters(updated)
    setOpen(false); setToast(`Saved to ${matter.name}`)
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

const TABS = [
  { id: 'general',    label: 'General' },
  { id: 'research',   label: 'Research' },
  { id: 'drafting',   label: 'Drafting' },
  { id: 'contract',   label: 'Contract' },
  { id: 'litigation', label: 'Litigation' },
]

const NO_DISCLAIMER = `\n\nNO DISCLAIMERS: Never include any disclaimer, caveat, warning, or note of any kind — including "this is not legal advice", "consult a lawyer", "I am an AI", or any similar language. Respond as a qualified legal professional. Output only the answer.`

const SYSTEM_PROMPTS: Record<string, string> = {
  general:    `You are Law OSS AI, an expert legal assistant. Apply the governing law relevant to the user's matter. If the user specifies a jurisdiction, apply that law; otherwise apply general common law principles. Be precise, professional and cite real legal authorities. Do not use emojis, decorative symbols, or coloured text. Use plain professional text. Always produce complete responses without truncating.${NO_DISCLAIMER}`,
  research:   `You are Law OSS AI, an expert legal research assistant. Find relevant cases, statutes, and regulations. Always cite specific authorities with proper citation format. Never fabricate citations. Apply governing law as specified. Do not use emojis, decorative symbols, or coloured text. Use plain professional text. Always produce complete responses without truncating.${NO_DISCLAIMER}`,
  drafting:   `You are a senior commercial lawyer. Draft complete, legally enforceable documents using professional UK legal language (unless another jurisdiction is specified). Mark gaps as [PLACEHOLDER]. Do not use emojis, decorative symbols, or coloured text. Use plain professional text with numbered clauses.

LENGTH: Minimum 1 page, maximum 40 pages. Simple documents (NDAs, letters) 1–5 pages. Standard agreements 5–15 pages. Complex agreements (shareholders, JV, finance) up to 40 pages. Use as many pages as the document requires — never truncate to save space.

COMPLETION: You MUST produce the entire document in one continuous output. Include every clause the document type requires. The final thing you write must be a fully drafted signature/execution block with date lines, party name lines, and signature lines. The document is incomplete until the signature block appears. Never stop mid-clause or mid-sentence.${NO_DISCLAIMER}`,
  contract:   `You are Law OSS AI, an expert contract analyst. Identify risks [CRITICAL/HIGH/MEDIUM/LOW], unusual clauses, and missing provisions. Compare against market standard terms. Do not use emojis, decorative symbols, or coloured text. Use plain professional text. Always produce complete responses without truncating.${NO_DISCLAIMER}`,
  litigation: `You are Law OSS AI, an expert litigation assistant. Analyse merits, identify key issues, suggest case strategy, and assess litigation risk with probability estimates. Do not use emojis, decorative symbols, or coloured text. Use plain professional text. Always produce complete responses without truncating.${NO_DISCLAIMER}`,
}

const SUGGESTIONS = [
  'Explain force majeure',
  'What makes a contract void?',
  'Summarise GDPR Article 17',
  'Draft a confidentiality clause',
  'Key elements of a valid contract',
]

const DONE_RE = /IN WITNESS WHEREOF|EXECUTED AS A DEED|SIGNATURE PAGE|EXECUTION BLOCK|\bSIGNED BY\b|\bSIGNATURE BLOCK\b|\bDuly (Authorised|Executed)\b|Date:\s*[_\[.]{2,}|___+\s*(Signature|Name|Date|Title)|\/s\/\s*[A-Z]|\bFOR AND ON BEHALF\b|\bDuly authorised signatory\b|\bend of (this )?(agreement|contract|deed|document|schedule)\b/i

async function streamAI(
  apiKey: string, provider: string, messages: Msg[], sys: string,
  onToken: (t: string) => void, onDone: () => void, onError: (e: string) => void,
  maxTokens = 8000,
) {
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 } }),
      })
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim(); if (!raw || raw === '[DONE]') continue
          try { const p = JSON.parse(raw); const t = p.candidates?.[0]?.content?.parts?.[0]?.text; if (t) onToken(t) } catch {}
        }
      }
    } else {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, stream: true, system: sys, messages }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})) as any; onError(e.error?.message || `Error ${res.status}`); return }
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim(); if (!raw || raw === '[DONE]') continue
          try { const p = JSON.parse(raw); if (p.type === 'content_block_delta' && p.delta?.text) onToken(p.delta.text) } catch {}
        }
      }
    }
    onDone()
  } catch (e: any) { onError(e.message || 'Network error') }
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
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function looksLikeDocument(content: string): boolean {
  if (content.length < 200) return false
  const hasHeadings = /^#{1,3} .+/m.test(content)
  const hasSections = (content.match(/\n\n/g) || []).length >= 3
  const hasDocKeywords = /\b(AGREEMENT|CONTRACT|DEED|LETTER|CLAUSE|WHEREAS|RECITAL|PARTIES|SIGNED|dated this|THIS AGREEMENT|BETWEEN|hereinafter|IN WITNESS|Schedule|Annexure|TERMS AND CONDITIONS)\b/i.test(content)
  return hasHeadings || (hasSections && hasDocKeywords)
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', color: copied ? '#166534' : '#374151', fontSize: 12.5, cursor: 'pointer' }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function DocEditorModal({ content, onClose }: { content: string; onClose: () => void }) {
  const [text, setText] = useState(content)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'relative', background: '#fff', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 860, height: '90vh', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e5e5', background: '#fafafa', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f' }}>Document Editor</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Edit your draft — download as Word when ready</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => downloadAsWord(text, 'draft.docx')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 7, background: '#0f0f0f', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Download Word
            </button>
            <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e5e5e5', borderRadius: 7, background: '#fff', color: '#666', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
        <div style={{ padding: '6px 20px', background: '#f0f7ff', borderBottom: '1px solid #dbeafe', fontSize: 11.5, color: '#1d4ed8' }}>
          Use # for title, ## for sections, **bold** — all convert to Word styles on download
        </div>
        <textarea ref={ref} value={text} onChange={e => setText(e.target.value)}
          style={{ flex: 1, padding: '20px 24px', border: 'none', outline: 'none', resize: 'none', fontSize: 14, lineHeight: 1.8, color: '#1a1a1a', fontFamily: 'Georgia, "Times New Roman", serif', background: '#fff', minHeight: 0 }} spellCheck />
        <div style={{ padding: '8px 20px', borderTop: '1px solid #e5e5e5', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: '#aaa' }}>{text.length.toLocaleString()} chars · {text.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
          <button onClick={() => downloadAsWord(text, 'draft.docx')} style={{ padding: '6px 16px', border: '1px solid #e5e5e5', borderRadius: 6, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Save as Word (.docx)</button>
        </div>
      </div>
    </div>
  )
}

function DocActions({ content }: { content: string }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid #0f0f0f', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          Open &amp; Edit
        </button>
        <button onClick={() => downloadAsWord(content, 'draft.docx')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 6, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          Download Word (.docx)
        </button>
      </div>
      {editing && <DocEditorModal content={content} onClose={() => setEditing(false)} />}
    </>
  )
}

export default function DashboardPage() {
  const [userName, setUserName]       = useState('')
  const [hasKey, setHasKey]           = useState<boolean | null>(null)
  const [agentId, setAgentId]         = useState('general')
  const [messages, setMessages]       = useState<Msg[]>([])
  const [input, setInput]             = useState('')
  const [streaming, setStreaming]     = useState(false)
  const [contRound, setContRound]     = useState(0)
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null)
  const [dragOver, setDragOver]       = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const bottomRef  = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase   = createClientComponentClient()

  async function handleFile(file: File) {
    setUploading(true); setUploadError('')
    try {
      const text = await extractTextFromFile(file)
      setAttachedDoc({ name: file.name, text })
    } catch (e: any) {
      setUploadError(e.message || 'Failed to read file')
    } finally { setUploading(false) }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const meta = session.user.user_metadata || {}
      setUserName(meta.full_name || meta.name || session.user.email?.split('@')[0] || '')
      setHasKey(!!localStorage.getItem(userKey('law_oss_api_key')))
    })
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(text: string) {
    if (!text.trim() || streaming) return
    const apiKey   = localStorage.getItem(userKey('law_oss_api_key')) || ''
    const provider = localStorage.getItem(userKey('law_oss_provider')) || 'claude'
    if (!apiKey) { setHasKey(false); return }

    const maxTok = agentId === 'drafting' ? 16000 : 8000
    const sys    = SYSTEM_PROMPTS[agentId] || SYSTEM_PROMPTS.general

    const userContent = attachedDoc
      ? `${text.trim()}\n\n---\n**Attached document: ${attachedDoc.name}**\n\n${attachedDoc.text}`
      : text.trim()

    setInput(''); setAttachedDoc(null)
    const newHistory: Msg[] = [...messages, { role: 'user', content: userContent }]
    setMessages([...newHistory, { role: 'assistant', content: '' }])
    setStreaming(true); setContRound(0)

    const appendToken = (t: string) => setMessages(prev => {
      const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: n[n.length - 1].content + t }; return n
    })
    const onError = (e: string) => {
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: `Error: ${e}` }; return n })
      setStreaming(false)
    }

    let history     = newHistory
    let rounds      = 0
    let keepGoing   = true

    while (keepGoing && rounds < 12) {
      keepGoing = false; rounds++
      let chunk = ''; let errored = false
      await new Promise<void>((resolve) => {
        streamAI(apiKey, provider, history, sys,
          t => { chunk += t; appendToken(t) },
          () => resolve(),
          e => { errored = true; onError(e); resolve() },
          maxTok,
        )
      })
      if (errored) break
      if (agentId === 'drafting' && !DONE_RE.test(chunk) && chunk.trim().length > 300) {
        keepGoing = true
        setContRound(rounds)
        history = [...history, { role: 'assistant', content: chunk }, { role: 'user', content: 'Continue drafting exactly from where you left off. Do not repeat any previously written text. Continue seamlessly from the last word written.' }]
        appendToken('\n')
      }
    }

    setContRound(0); setStreaming(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {hasKey === false && (
        <div style={{ padding: '10px 24px', background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13.5, color: '#555' }}>No API key configured. Add your Claude or Gemini key to use AI features.</span>
          <Link href="/onboarding" style={{ padding: '0 14px', height: 30, display: 'inline-flex', alignItems: 'center', background: '#0f0f0f', borderRadius: 6, fontSize: 12.5, color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Add Key</Link>
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#fff', flexShrink: 0 }}>
        {userName && <div style={{ fontSize: 12.5, color: '#aaa', paddingTop: 12, marginBottom: 8 }}>Good day, {userName}</div>}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setAgentId(t.id); setMessages([]) }} style={{
              padding: '10px 18px', border: 'none', background: 'transparent',
              borderBottom: agentId === t.id ? '2px solid #0f0f0f' : '2px solid transparent',
              color: agentId === t.id ? '#0f0f0f' : '#999',
              fontWeight: agentId === t.id ? 600 : 400,
              fontSize: 13.5, cursor: 'pointer', transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f0f0f', marginBottom: 8 }}>
              {TABS.find(t => t.id === agentId)?.label} Agent
            </div>
            <div style={{ fontSize: 14, color: '#999', maxWidth: 360, lineHeight: 1.65, marginBottom: 28 }}>
              Ask a legal question, draft a document, or research case law. AI output is not legal advice.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 520 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding: '8px 16px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 20, background: '#fff', color: '#333', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseOver={e => { e.currentTarget.style.background = '#f5f5f5' }}
                  onMouseOut={e => { e.currentTarget.style.background = '#fff' }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const isLastAssistant = m.role === 'assistant' && i === messages.length - 1
          const isDoc = m.role === 'assistant' && m.content && looksLikeDocument(m.content)
          const isDone = !streaming || !isLastAssistant
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '72%', padding: '11px 16px', fontSize: 14, lineHeight: 1.7,
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.role === 'user' ? '#0f0f0f' : '#f5f5f5',
                  color: m.role === 'user' ? '#fff' : '#0f0f0f',
                }}>
                  {m.content ? (
                    m.role === 'user'
                      ? <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                      : <MarkdownRenderer content={m.content} />
                  ) : (streaming && isLastAssistant ? (
                    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block', animation: 'pulse 1s 0.2s infinite' }} />
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block', animation: 'pulse 1s 0.4s infinite' }} />
                    </span>
                  ) : '')}
                </div>
              </div>
                      {m.role === 'assistant' && m.content && isDone && (
                <div style={{ paddingLeft: 4, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {isDoc && <DocActions content={m.content} />}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <CopyButton content={m.content} />
                    <SaveToMatter messages={messages.slice(0, i + 1)} agentId={agentId} agentName={TABS.find(t => t.id === agentId)?.label || agentId} />
                  </div>
                </div>
              )}
              {isLastAssistant && streaming && contRound > 0 && (
                <div style={{ paddingLeft: 4, marginTop: 4, fontSize: 11.5, color: '#888' }}>
                  Completing document... (part {contRound + 1})
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px 20px', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

        {attachedDoc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '5px 10px', background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 8, width: 'fit-content', maxWidth: '100%' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span style={{ fontSize: 12.5, color: '#1d4ed8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{attachedDoc.name}</span>
            <button onClick={() => setAttachedDoc(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#60a5fa', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
          </div>
        )}

        {uploadError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 6 }}>{uploadError}</div>}

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
          style={{ display: 'flex', gap: 10, background: dragOver ? '#f0f7ff' : '#fff', border: `1.5px ${dragOver ? 'dashed #3b82f6' : 'solid rgba(0,0,0,0.15)'}`, borderRadius: 12, padding: '10px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading || streaming} title="Attach document" style={{ width: 28, height: 28, border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 7, background: '#f5f5f5', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end' }}>
            {uploading ? <span style={{ fontSize: 12 }}>…</span> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}
          </button>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(0,0,0,0.35)' }}
            onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = dragOver ? '#3b82f6' : 'rgba(0,0,0,0.15)' }}
            placeholder={attachedDoc ? `Ask about ${attachedDoc.name}…` : 'Ask a legal question or drop a document here… (Enter to send)'}
            disabled={streaming} rows={1}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 14, color: '#0f0f0f', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
          />
          <button onClick={() => send(input)} disabled={streaming || (!input.trim() && !attachedDoc)} style={{
            width: 34, height: 34, borderRadius: 8, border: 'none', alignSelf: 'flex-end', flexShrink: 0,
            background: streaming || (!input.trim() && !attachedDoc) ? 'rgba(0,0,0,0.07)' : '#0f0f0f',
            color: streaming || (!input.trim() && !attachedDoc) ? '#bbb' : '#fff',
            cursor: streaming || (!input.trim() && !attachedDoc) ? 'not-allowed' : 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          }}>↑</button>
        </div>
        <div style={{ fontSize: 11, color: '#ccc', marginTop: 6, textAlign: 'center' }}>
          Not legal advice. Verify all AI output with a qualified lawyer.
        </div>
      </div>
    </div>
  )
}
