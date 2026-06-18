'use client'
import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import MarkdownRenderer from '../../../components/MarkdownRenderer'

// ── Word export ──────────────────────────────────────────────────────────────
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
  function copy() { navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }
  return (
    <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', color: copied ? '#166534' : '#374151', fontSize: 12.5, cursor: 'pointer' }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function DocEditorModal({ content, onClose, agentName }: { content: string; onClose: () => void; agentName: string }) {
  const [text, setText] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const filename = `${agentName.toLowerCase().replace(/\s+/g, '-')}-draft.docx`
  useEffect(() => { textareaRef.current?.focus() }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
      <div style={{ position: 'relative', background: '#fff', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 860, margin: '20px', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e5e5', background: '#fafafa', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f' }}>Document Editor</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Edit your draft — download as Word when ready</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => downloadAsWord(text, filename)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 7, background: '#0f0f0f', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Download Word
            </button>
            <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e5e5e5', borderRadius: 7, background: '#fff', color: '#666', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
        <div style={{ padding: '7px 20px', background: '#f0f7ff', borderBottom: '1px solid #dbeafe', fontSize: 11.5, color: '#1d4ed8' }}>
          Use # for title, ## for sections, **bold** — all convert to Word styles on download
        </div>
        <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} style={{ flex: 1, padding: '20px 24px', border: 'none', outline: 'none', resize: 'none', fontSize: 14, lineHeight: 1.8, color: '#1a1a1a', fontFamily: 'Georgia, "Times New Roman", serif', background: '#fff', minHeight: 0 }} spellCheck />
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
          Open &amp; Edit
        </button>
        <button onClick={() => downloadAsWord(content, filename)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 6, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          Download Word (.docx)
        </button>
      </div>
      {editing && <DocEditorModal content={content} agentName={agentName} onClose={() => setEditing(false)} />}
    </>
  )
}

const MATTER_TYPES = ['litigation', 'contract', 'corporate', 'ip', 'employment', 'real-estate', 'criminal', 'family', 'other']

function userKey(base: string) { return `${base}_${localStorage.getItem('law_oss_uid') || 'default'}` }

const LS_KEY = 'law_oss_matters'

type Msg = { role: 'user' | 'assistant'; content: string }
type SavedChat = { id: string; agentId: string; agentName: string; title: string; messages: Msg[]; savedAt: string }
type Matter = { id: string; matterNumber?: number; name: string; type: string; status: 'active' | 'pending' | 'closed'; court?: string; attorney?: string; dueDate?: string; notes?: string; savedChats: SavedChat[] }

function loadMatters(): Matter[] {
  try { return JSON.parse(localStorage.getItem(userKey(LS_KEY)) || '[]') } catch { return [] }
}
function saveMatters(m: Matter[]) { localStorage.setItem(userKey(LS_KEY), JSON.stringify(m)) }

const SC: Record<string, { bg: string; color: string }> = {
  active: { bg: '#dcfce7', color: '#166534' },
  pending: { bg: '#fef9c3', color: '#854d0e' },
  closed: { bg: '#f3f4f6', color: '#6b7280' },
}

async function streamAI(apiKey: string, provider: string, messages: Msg[], sys: string, onToken: (t: string) => void, onDone: () => void, onError: (e: string) => void) {
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: 8000, temperature: 0.3 } }) })
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || ''; for (const line of lines) { if (!line.startsWith('data: ')) continue; const raw = line.slice(6).trim(); if (!raw || raw === '[DONE]') continue; try { const p = JSON.parse(raw); const t = p.candidates?.[0]?.content?.parts?.[0]?.text; if (t) onToken(t) } catch {} } }
      onDone()
    } else {
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, stream: true, system: sys, messages }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})) as any; onError(e.error?.message || `Error ${res.status}`); return }
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || ''; for (const line of lines) { if (!line.startsWith('data: ')) continue; const raw = line.slice(6).trim(); if (!raw || raw === '[DONE]') continue; try { const p = JSON.parse(raw); if (p.type === 'content_block_delta' && p.delta?.text) onToken(p.delta.text) } catch {} } }
      onDone()
    }
  } catch (e: any) { onError(e.message || 'Network error') }
}

const NO_DISCLAIMER = ` Never include any disclaimer, caveat, or note — including "this is not legal advice", "consult a lawyer", or "I am an AI". Respond as a qualified legal professional.`

const SYS_MAP: Record<string, string> = {
  general: `You are Law OSS AI, an expert legal assistant. Be precise, professional and cite real legal authorities. Do not use emojis, decorative symbols, or coloured text. Use plain professional text.${NO_DISCLAIMER}`,
  research: `You are Law OSS AI, an expert legal research assistant. Find relevant cases, statutes, and regulations. Always cite specific authorities. Do not use emojis, decorative symbols, or coloured text.${NO_DISCLAIMER}`,
  drafting: `You are a senior commercial lawyer. Draft legally enforceable contracts and legal documents. Do not use emojis, decorative symbols, or coloured text. Use plain professional text.${NO_DISCLAIMER}`,
  contract: `You are Law OSS AI, an expert contract analyst. Identify risks, unusual clauses, and missing provisions. Do not use emojis, decorative symbols, or coloured text.${NO_DISCLAIMER}`,
  litigation: `You are Law OSS AI, an expert litigation assistant. Analyse merits, strategy, and risk. Do not use emojis, decorative symbols, or coloured text.${NO_DISCLAIMER}`,
  compliance: `You are Law OSS AI, an expert compliance advisor. Identify regulations and compliance gaps. Do not use emojis, decorative symbols, or coloured text.${NO_DISCLAIMER}`,
  dd: `You are Law OSS AI, an expert due diligence specialist. Analyse corporate, financial, and legal risks in transactions. Do not use emojis, decorative symbols, or coloured text.${NO_DISCLAIMER}`,
}

function ContinueChatModal({ chat, onClose, onSave }: { chat: SavedChat; onClose: () => void; onSave: (updated: SavedChat) => void }) {
  const [messages, setMessages] = useState<Msg[]>(chat.messages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(chat.title)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(text: string) {
    if (!text.trim() || streaming) return
    const apiKey = localStorage.getItem(userKey('law_oss_api_key')) || ''
    const provider = localStorage.getItem(userKey('law_oss_provider')) || 'claude'
    if (!apiKey) { setError('No API key configured. Add your key in Settings.'); return }
    setError('')
    const newHistory: Msg[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages([...newHistory, { role: 'assistant', content: '' }])
    setInput(''); setStreaming(true)
    const sys = SYS_MAP[chat.agentId] || SYS_MAP.general
    const onToken = (t: string) => setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: n[n.length - 1].content + t }; return n })
    const onDone = () => setStreaming(false)
    const onError = (e: string) => { setError(e); setStreaming(false) }
    await streamAI(apiKey, provider, newHistory, sys, onToken, onDone, onError)
  }

  function saveAndClose() {
    onSave({ ...chat, title, messages, savedAt: new Date().toISOString() })
    onClose()
  }

  const inp: React.CSSProperties = { flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 13.5, color: '#0f0f0f', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720, height: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingTitle ? (
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)} onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
                style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f', border: 'none', borderBottom: '1.5px solid #0f0f0f', outline: 'none', width: '100%', background: 'none', padding: '1px 0' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                <button onClick={() => setEditingTitle(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12, padding: '2px 4px', flexShrink: 0 }}>Edit</button>
              </div>
            )}
            <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1 }}>{chat.agentName} · Continued from {new Date(chat.savedAt).toLocaleString()}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={saveAndClose} style={{ padding: '6px 14px', background: '#0f0f0f', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Save & Close</button>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid #e5e5e5', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 18, color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#b91c1c' }}>{error}</div>}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '78%' }}>
                <div style={{ padding: '9px 13px', fontSize: 13.5, lineHeight: 1.65, borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: m.role === 'user' ? '#0f0f0f' : '#f5f5f5', color: m.role === 'user' ? '#fff' : '#0f0f0f' }}>
                  {m.role === 'assistant' ? <MarkdownRenderer content={m.content || (streaming && i === messages.length - 1 ? '...' : '')} /> : m.content}
                </div>
                {m.role === 'assistant' && m.content && !(streaming && i === messages.length - 1) && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <CopyButton content={m.content} />
                    {looksLikeDocument(m.content) && <DocActions content={m.content} agentName={chat.agentName} />}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: '8px 10px' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={1} disabled={streaming}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder="Continue the conversation... (Enter to send)" style={inp} />
            <button onClick={() => send(input)} disabled={streaming || !input.trim()} style={{ width: 32, height: 32, borderRadius: 7, border: 'none', alignSelf: 'flex-end', flexShrink: 0, background: streaming || !input.trim() ? 'rgba(0,0,0,0.07)' : '#0f0f0f', color: streaming || !input.trim() ? '#bbb' : '#fff', cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MatterWorkflowModal({ matter, onClose, onUpdate }: { matter: Matter; onClose: () => void; onUpdate: (m: Matter) => void }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [continueChat, setContinueChat] = useState<SavedChat | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const mNum = matter.matterNumber ? `#${String(matter.matterNumber).padStart(3, '0')}` : ''

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function buildMatterContext(): string {
    const chats = matter.savedChats
    if (chats.length === 0) return ''
    const sections = chats.map(c => {
      const msgs = c.messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')
      return `--- Saved Work: "${c.title}" (${c.agentName}, ${new Date(c.savedAt).toLocaleDateString()}) ---\n${msgs}`
    })
    return `\n\nMATTER CONTEXT — All previous work saved to this matter:\n${sections.join('\n\n')}`
  }

  function buildSys(): string {
    const base = `You are Law OSS AI, a senior legal assistant working on Matter ${mNum} "${matter.name}" (${matter.type}${matter.court ? ', ' + matter.court : ''}${matter.attorney ? ', Attorney: ' + matter.attorney : ''}).
The user has previously done work on this matter which is summarised below. Use this context to give informed, consistent responses that build on the prior work. Do not repeat what has already been done unless asked. Reference prior work where relevant.
Do not use emojis, decorative symbols, or coloured text. Use plain professional text.${NO_DISCLAIMER}`
    return base + buildMatterContext()
  }

  async function send(text: string) {
    if (!text.trim() || streaming) return
    const apiKey = localStorage.getItem(userKey('law_oss_api_key')) || ''
    const provider = localStorage.getItem(userKey('law_oss_provider')) || 'claude'
    if (!apiKey) { setError('No API key configured. Add your key in Settings.'); return }
    setError('')
    const newHistory: Msg[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages([...newHistory, { role: 'assistant', content: '' }])
    setInput(''); setStreaming(true)
    const sys = buildSys()
    const onToken = (t: string) => setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: n[n.length - 1].content + t }; return n })
    const onDone = () => setStreaming(false)
    const onError = (e: string) => { setError(e); setStreaming(false) }
    await streamAI(apiKey, provider, newHistory, sys, onToken, onDone, onError)
  }

  function updateChat(updated: SavedChat) {
    onUpdate({ ...matter, savedChats: matter.savedChats.map(c => c.id === updated.id ? updated : c) })
  }

  const sc = SC[matter.status] || SC.closed

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, background: '#fafafa' }}>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #e5e5e5', borderRadius: 7, padding: '5px 12px', fontSize: 13, color: '#555', cursor: 'pointer' }}>← Back</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {mNum && <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, letterSpacing: '0.04em' }}>{mNum}</span>}
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f0f0f' }}>{matter.name}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600, textTransform: 'capitalize' }}>{matter.status}</span>
            <span style={{ fontSize: 12, color: '#888', textTransform: 'capitalize' }}>{matter.type}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
            {matter.attorney && <span style={{ fontSize: 11.5, color: '#6b7280' }}>Attorney: {matter.attorney}</span>}
            {matter.court && <span style={{ fontSize: 11.5, color: '#6b7280' }}>Court: {matter.court}</span>}
            {matter.dueDate && <span style={{ fontSize: 11.5, color: '#6b7280' }}>Due: {matter.dueDate}</span>}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', flexShrink: 0 }}>{matter.savedChats.length} saved chat{matter.savedChats.length !== 1 ? 's' : ''}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: saved chats */}
        <div style={{ width: 280, borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', background: '#fafafa', flexShrink: 0 }}>
          <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Saved Work</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
            {matter.savedChats.length === 0
              ? <div style={{ padding: '16px 4px', fontSize: 12.5, color: '#9ca3af', fontStyle: 'italic', lineHeight: 1.55 }}>No saved chats yet. Use an AI agent and save the conversation to this matter.</div>
              : matter.savedChats.map(chat => (
                <div key={chat.id} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                  {editingChatId === chat.id ? (
                    <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => { updateChat({ ...chat, title: editTitle.trim() || chat.title }); setEditingChatId(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') { updateChat({ ...chat, title: editTitle.trim() || chat.title }); setEditingChatId(null) } if (e.key === 'Escape') setEditingChatId(null) }}
                      style={{ fontSize: 12.5, border: 'none', borderBottom: '1.5px solid #0f0f0f', outline: 'none', width: '100%', background: 'none', padding: '1px 0', marginBottom: 4 }} />
                  ) : (
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0f0f0f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{chat.title}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>{chat.agentName} · {new Date(chat.savedAt).toLocaleDateString()}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setContinueChat(chat)} style={{ flex: 1, padding: '3px 0', background: '#0f0f0f', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Continue</button>
                    <button onClick={() => { setEditingChatId(chat.id); setEditTitle(chat.title) }} style={{ padding: '3px 8px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 11.5, color: '#555', cursor: 'pointer' }}>Rename</button>
                    <button onClick={() => { if (confirm('Remove?')) onUpdate({ ...matter, savedChats: matter.savedChats.filter(c => c.id !== chat.id) }) }} style={{ padding: '3px 7px', background: 'none', border: '1px solid #fecaca', borderRadius: 5, fontSize: 11.5, color: '#dc2626', cursor: 'pointer' }}>×</button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Right: matter AI chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 18px', background: '#f0f7ff', borderBottom: '1px solid #dbeafe', fontSize: 12, color: '#1d4ed8' }}>
            AI has full context of this matter — {matter.savedChats.length} saved chat{matter.savedChats.length !== 1 ? 's' : ''} loaded. Ask anything about this matter.
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#b91c1c' }}>{error}</div>}
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Matter {mNum} — AI Workspace</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
                  The AI has read all {matter.savedChats.length} saved chat{matter.savedChats.length !== 1 ? 's' : ''} in this matter. Ask a follow-up, request a summary, draft a new document, or continue any prior work.
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1
              const isDone = !streaming || !isLast
              const isDoc = m.role === 'assistant' && m.content && looksLikeDocument(m.content)
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '76%', padding: '10px 14px', fontSize: 13.5, lineHeight: 1.65, borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: m.role === 'user' ? '#0f0f0f' : '#f5f5f5', color: m.role === 'user' ? '#fff' : '#0f0f0f' }}>
                      {m.role === 'assistant' ? <MarkdownRenderer content={m.content || (streaming && isLast ? '...' : '')} /> : <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>}
                    </div>
                  </div>
                  {m.role === 'assistant' && m.content && isDone && (
                    <div style={{ paddingLeft: 4, marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <CopyButton content={m.content} />
                      {isDoc && <DocActions content={m.content} agentName={matter.name} />}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '10px 18px 16px', borderTop: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: '8px 10px' }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} rows={1} disabled={streaming}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(0,0,0,0.35)' }}
                onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(0,0,0,0.15)' }}
                placeholder={`Ask anything about ${matter.name}… (Enter to send)`}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 13.5, color: '#0f0f0f', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }} />
              <button onClick={() => send(input)} disabled={streaming || !input.trim()} style={{ width: 32, height: 32, borderRadius: 7, border: 'none', alignSelf: 'flex-end', flexShrink: 0, background: streaming || !input.trim() ? 'rgba(0,0,0,0.07)' : '#0f0f0f', color: streaming || !input.trim() ? '#bbb' : '#fff', cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
            </div>
          </div>
        </div>
      </div>

      {continueChat && (
        <ContinueChatModal
          chat={continueChat}
          onClose={() => setContinueChat(null)}
          onSave={updated => { updateChat(updated); setContinueChat(null) }}
        />
      )}
    </div>
  )
}

function MatterCard({ matter, onDelete, onUpdate, matterIndex }: { matter: Matter; onDelete: () => void; onUpdate: (m: Matter) => void; matterIndex: number }) {
  const [expanded, setExpanded] = useState(false)
  const [openWorkflow, setOpenWorkflow] = useState(false)
  const [continueChat, setContinueChat] = useState<SavedChat | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const sc = SC[matter.status] || SC.closed
  const num = matter.matterNumber ?? (matterIndex + 1)
  const mNum = `#${String(num).padStart(3, '0')}`

  function updateChat(updated: SavedChat) {
    onUpdate({ ...matter, savedChats: matter.savedChats.map(c => c.id === updated.id ? updated : c) })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(x => !x)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em', flexShrink: 0 }}>{mNum}</span>
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
          <button onClick={e => { e.stopPropagation(); setOpenWorkflow(true) }} style={{ background: '#0f0f0f', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Open</button>
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
                  <div key={chat.id} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '9px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editingChatId === chat.id ? (
                          <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                            onBlur={() => { updateChat({ ...chat, title: editTitle.trim() || chat.title }); setEditingChatId(null) }}
                            onKeyDown={e => { if (e.key === 'Enter') { updateChat({ ...chat, title: editTitle.trim() || chat.title }); setEditingChatId(null) } if (e.key === 'Escape') setEditingChatId(null) }}
                            style={{ fontSize: 13, fontWeight: 500, border: 'none', borderBottom: '1.5px solid #0f0f0f', outline: 'none', width: '100%', background: 'none', padding: '1px 0' }} />
                        ) : (
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f0f0f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title}</div>
                        )}
                        <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>{chat.agentName} · {new Date(chat.savedAt).toLocaleDateString()} · {chat.messages.length} messages</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setContinueChat(chat)} style={{ padding: '4px 12px', background: '#0f0f0f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Continue</button>
                        <button onClick={() => { setEditingChatId(chat.id); setEditTitle(chat.title) }} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>Rename</button>
                        <button onClick={() => { if (confirm('Remove this saved chat?')) onUpdate({ ...matter, savedChats: matter.savedChats.filter(c => c.id !== chat.id) }) }} style={{ padding: '4px 8px', background: 'none', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>×</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {continueChat && (
        <ContinueChatModal
          chat={continueChat}
          onClose={() => setContinueChat(null)}
          onSave={updated => { updateChat(updated); setContinueChat(null) }}
        />
      )}

      {openWorkflow && (
        <MatterWorkflowModal
          matter={matter}
          onClose={() => setOpenWorkflow(false)}
          onUpdate={onUpdate}
        />
      )}
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
    onSave({ id: Date.now().toString(), name: f.name.trim(), type: f.type, status: f.status, court: f.court || undefined, attorney: f.attorney || undefined, dueDate: f.dueDate || undefined, notes: f.notes || undefined, savedChats: [], matterNumber: undefined })
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

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'closed'>('all')
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (!session) window.location.href = '/login' })
    setMatters(loadMatters())
  }, [])

  function addMatter(m: Matter) {
    const nextNum = matters.length > 0 ? Math.max(...matters.map(x => x.matterNumber ?? 0)) + 1 : 1
    const withNum = { ...m, matterNumber: nextNum }
    const u = [withNum, ...matters]; setMatters(u); saveMatters(u); setShowForm(false)
  }
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
            <div style={{ fontSize: 15, fontWeight: 500 }}>{filter === 'all' ? 'No matters yet' : `No ${filter} matters`}</div>
            {filter === 'all' && <div style={{ fontSize: 13, marginTop: 5 }}>Click "+ New Matter" to get started</div>}
          </div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((m, i) => <MatterCard key={m.id} matter={m} matterIndex={matters.indexOf(m)} onDelete={() => deleteMatter(m.id)} onUpdate={updateMatter} />)}
          </div>
      }
    </div>
  )
}
