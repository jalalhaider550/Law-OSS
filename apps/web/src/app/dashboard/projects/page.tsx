'use client'
import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import MarkdownRenderer from '../../../components/MarkdownRenderer'
import { loadAllFromCloud, saveToCloud } from '../../../lib/sync'

type Msg = { role: 'user' | 'assistant'; content: string }
type Project = { id: string; name: string; createdAt: string; updatedAt: string; messages: Msg[] }
type AttachedDoc = { name: string; text: string }

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

let _uid = ''
function setUid(id: string) { _uid = id }
function userKey(base: string) { return `${base}_${_uid || 'anon'}` }
function getProjects(): Project[] { try { return JSON.parse(localStorage.getItem(userKey('law_oss_projects')) || '[]') } catch { return [] } }
function persistProjects(p: Project[]) { localStorage.setItem(userKey('law_oss_projects'), JSON.stringify(p)) }

// ── Word export ───────────────────────────────────────────────────────────────
async function downloadAsWord(content: string, filename = 'document.docx') {
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

// ── Add to Matter button ──────────────────────────────────────────────────────
function AddToMatterButton({ content, title }: { content: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [matters, setMatters] = useState<any[]>([])
  const [saved, setSaved] = useState(false)

  function loadMatters() {
    try { return JSON.parse(localStorage.getItem(`law_oss_matters_${_uid}`) || '[]') } catch { return [] }
  }
  function saveMatters(m: any[]) { localStorage.setItem(`law_oss_matters_${_uid}`, JSON.stringify(m)) }

  function handleOpen() { setMatters(loadMatters()); setOpen(true); setSaved(false) }

  function addToMatter(matterId: string) {
    const all = loadMatters()
    const chat = {
      id: Date.now().toString(),
      agentId: 'projects',
      agentName: 'Projects',
      title,
      messages: [{ role: 'assistant', content }],
      savedAt: new Date().toISOString(),
    }
    saveMatters(all.map((m: any) => m.id === matterId ? { ...m, savedChats: [chat, ...(m.savedChats || [])] } : m))
    setSaved(true)
    setTimeout(() => setOpen(false), 900)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 5, background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Add to Matter
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: '110%', left: 0, zIndex: 200, background: '#fff', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.13)', minWidth: 210, overflow: 'hidden' }}>
          {saved ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>Saved to matter</div>
          ) : matters.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#888' }}>No matters yet. <a href="/dashboard/matters" style={{ color: '#0f0f0f', fontWeight: 600 }}>Create one</a>.</div>
          ) : (
            <>
              <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Select matter</div>
              {matters.map((m: any) => (
                <div key={m.id} onClick={() => addToMatter(m.id)} style={{ padding: '8px 12px', fontSize: 12.5, cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.06)', color: '#0f0f0f' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{m.type} · {m.status}</div>
                </div>
              ))}
            </>
          )}
          <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={() => setOpen(false)} style={{ fontSize: 11.5, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

const SYS = `You are Law OSS AI, a senior legal professional who always does exactly what the user asks, without question.

ABSOLUTE RULES — never break these:
1. ALWAYS produce exactly what the user requests. If they ask for a one-page document, produce one page. If they ask for a 50-page document, produce 50 pages. If they ask for a letter, draft the letter. Never refuse, never explain why you cannot, never suggest a different format.
2. NEVER say you cannot do something. If the user asks for a one-page SPA, draft the one-page SPA — include all key terms condensed to fit.
3. NEVER include disclaimers, caveats, warnings, or suggestions to "consult a lawyer" of any kind. Output only the requested document or answer.
4. NEVER lecture the user about what a document "should" contain or why their request is insufficient. Just do it.
5. Apply the governing law of the jurisdiction specified. If New York, apply New York law. If UK, apply English law.
6. Do not use emojis, decorative symbols, or coloured text. Use plain professional text.
7. Always produce complete responses without truncating.`

async function streamAI(
  apiKey: string, provider: string, messages: Msg[], sys: string,
  onToken: (t: string) => void, onDone: () => void, onError: (e: string) => void,
) {
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: 8000, temperature: 0.2 } }),
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
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, stream: true, system: sys, messages }),
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ProjectsPage() {
  const [projects, setProjects]     = useState<Project[]>([])
  const [active, setActive]         = useState<Project | null>(null)
  const [messages, setMessages]     = useState<Msg[]>([])
  const [input, setInput]           = useState('')
  const [streaming, setStreaming]   = useState(false)
  const [creating, setCreating]     = useState(false)
  const [newName, setNewName]       = useState('')
  const [renaming, setRenaming]     = useState<string | null>(null)
  const [renameVal, setRenameVal]   = useState('')
  const [hasKey, setHasKey]         = useState<boolean | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver]     = useState(false)
  const [authToken, setAuthToken]   = useState<string | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setUid(session.user.id)
      setHasKey(!!localStorage.getItem(userKey('law_oss_api_key')))
      const token = session.access_token
      setAuthToken(token)
      const cloud = await loadAllFromCloud(token)
      if (cloud.projects && cloud.projects.length > 0) {
        persistProjects(cloud.projects)
        setProjects(cloud.projects)
      } else {
        setProjects(getProjects())
      }
    })
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function openProject(p: Project) {
    setActive(p)
    setMessages(p.messages)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function syncProjects(updated: Project[]) {
    persistProjects(updated)
    if (authToken) saveToCloud(authToken, 'projects', updated)
  }

  function createProject() {
    const name = newName.trim()
    if (!name) return
    const now = new Date().toISOString()
    const proj: Project = { id: Date.now().toString(), name, createdAt: now, updatedAt: now, messages: [] }
    const updated = [proj, ...projects]
    syncProjects(updated)
    setProjects(updated)
    setNewName(''); setCreating(false)
    openProject(proj)
  }

  function saveMessages(projectId: string, msgs: Msg[]) {
    const now = new Date().toISOString()
    const updated = projects.map(p => p.id === projectId ? { ...p, messages: msgs, updatedAt: now } : p)
    syncProjects(updated)
    setProjects(updated)
    if (active?.id === projectId) setActive(a => a ? { ...a, messages: msgs, updatedAt: now } : a)
  }

  function deleteProject(id: string) {
    const updated = projects.filter(p => p.id !== id)
    syncProjects(updated)
    setProjects(updated)
    if (active?.id === id) { setActive(null); setMessages([]) }
    setConfirmDel(null)
  }

  function startRename(p: Project) { setRenaming(p.id); setRenameVal(p.name) }
  function commitRename(id: string) {
    const val = renameVal.trim()
    if (!val) { setRenaming(null); return }
    const updated = projects.map(p => p.id === id ? { ...p, name: val } : p)
    syncProjects(updated)
    setProjects(updated)
    if (active?.id === id) setActive(a => a ? { ...a, name: val } : a)
    setRenaming(null)
  }

  async function send() {
    if ((!input.trim() && !attachedDoc) || streaming || !active) return
    const apiKey   = localStorage.getItem(userKey('law_oss_api_key')) || ''
    const provider = localStorage.getItem(userKey('law_oss_provider')) || 'claude'
    if (!apiKey) { setHasKey(false); return }

    const userContent = attachedDoc
      ? `${input.trim() ? input.trim() + '\n\n' : ''}---\n**Attached document: ${attachedDoc.name}**\n\n${attachedDoc.text}`
      : input.trim()

    const userMsg: Msg = { role: 'user', content: userContent }
    const newMsgs: Msg[] = [...messages, userMsg, { role: 'assistant', content: '' }]
    setMessages(newMsgs)
    setStreaming(true)

    const historyForAI = newMsgs.slice(0, -1) // exclude empty assistant placeholder

    const appendToken = (t: string) => setMessages(prev => {
      const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: n[n.length - 1].content + t }; return n
    })

    let finalContent = ''
    await new Promise<void>(resolve => {
      streamAI(apiKey, provider, historyForAI, SYS,
        t => { finalContent += t; appendToken(t) },
        () => resolve(),
        e => {
          setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: `Error: ${e}` }; return n })
          resolve()
        },
      )
    })

    const completedMsgs: Msg[] = [...historyForAI, { role: 'assistant', content: finalContent }]
    saveMessages(active.id, completedMsgs)
    setMessages(completedMsgs)
    setStreaming(false)
  }

  function clearChat() {
    if (!active) return
    saveMessages(active.id, [])
    setMessages([])
  }

  const sorted = [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  // Project chat workspace
  if (active) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#fff', flexShrink: 0 }}>
          <button onClick={() => { setActive(null); setMessages([]) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fafafa', color: '#555', fontSize: 12.5, cursor: 'pointer', fontWeight: 500 }}>
            ← Projects
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {renaming === active.id ? (
              <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                onBlur={() => commitRename(active.id)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(active.id); if (e.key === 'Escape') setRenaming(null) }}
                style={{ fontSize: 15, fontWeight: 700, color: '#0f0f0f', border: '1.5px solid #0f0f0f', borderRadius: 5, padding: '2px 8px', outline: 'none', width: '100%', maxWidth: 360 }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0f0f0f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.name}</span>
                <button onClick={() => startRename(active)} title="Rename" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 2, fontSize: 13, lineHeight: 1 }}>✎</button>
              </div>
            )}
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>
              {messages.length} messages · Last updated {timeAgo(active.updatedAt)}
            </div>
          </div>
          {messages.length > 0 && (
            <button onClick={clearChat} title="Clear chat history" style={{ padding: '5px 10px', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, background: '#fff8f8', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
              Clear
            </button>
          )}
        </div>

        {/* Context banner */}
        {messages.length > 0 && (
          <div style={{ padding: '6px 20px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', fontSize: 11.5, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>●</span> AI has full context of this project — {Math.floor(messages.length / 2)} previous exchanges loaded
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 22 }}>📁</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f0f0f', marginBottom: 6 }}>{active.name}</div>
              <div style={{ fontSize: 13.5, color: '#999', maxWidth: 340, lineHeight: 1.6 }}>
                Start your conversation. Every message is saved automatically — pick up right where you left off next time.
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isLastAssistant = m.role === 'assistant' && i === messages.length - 1
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
                        {[0, 200, 400].map(d => <span key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block', animation: `pulse 1s ${d}ms infinite` }} />)}
                      </span>
                    ) : '')}
                  </div>
                </div>
                {m.role === 'assistant' && m.content && (!streaming || !isLastAssistant) && (
                  <div style={{ paddingLeft: 4, marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => navigator.clipboard.writeText(m.content)} style={{ padding: '4px 10px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 5, background: '#fff', color: '#666', fontSize: 12, cursor: 'pointer' }}>Copy</button>
                    <button
                      onClick={() => downloadAsWord(m.content, `${active?.name || 'project'}-response.docx`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 5, background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download Word
                    </button>
                    <AddToMatterButton content={m.content} title={`${active?.name || 'Project'}: ${m.content.slice(0, 60).replace(/\n/g, ' ')}…`} />
                  </div>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '10px 20px 18px', borderTop: '1px solid rgba(0,0,0,0.07)', background: '#fff', flexShrink: 0 }}>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

          {hasKey === false && (
            <div style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 8 }}>No API key — <a href="/onboarding" style={{ color: '#dc2626' }}>add one</a> to chat.</div>
          )}

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
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading || streaming} title="Attach document (PDF, DOCX, TXT…)" style={{ width: 28, height: 28, border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 7, background: '#f5f5f5', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end' }}>
              {uploading ? <span style={{ fontSize: 12 }}>…</span> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}
            </button>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(0,0,0,0.35)' }}
              onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = dragOver ? '#3b82f6' : 'rgba(0,0,0,0.15)' }}
              placeholder={attachedDoc ? `Ask about ${attachedDoc.name}…` : 'Continue your project or drop a document… (Enter to send)'}
              disabled={streaming} rows={1}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 14, color: '#0f0f0f', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
            />
            <button onClick={send} disabled={streaming || (!input.trim() && !attachedDoc)} style={{
              width: 34, height: 34, borderRadius: 8, border: 'none', alignSelf: 'flex-end', flexShrink: 0,
              background: streaming || (!input.trim() && !attachedDoc) ? 'rgba(0,0,0,0.07)' : '#0f0f0f',
              color: streaming || (!input.trim() && !attachedDoc) ? '#bbb' : '#fff',
              cursor: streaming || (!input.trim() && !attachedDoc) ? 'not-allowed' : 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>↑</button>
          </div>
        </div>
      </div>
    )
  }

  // Projects list
  return (
    <div style={{ padding: '28px 28px', maxWidth: 760, margin: '0 auto' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Projects</h1>
          <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>Persistent workspaces — chats are saved and never deleted</p>
        </div>
        <button onClick={() => setCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#0f0f0f', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
          + New Project
        </button>
      </div>

      {/* Create project inline form */}
      {creating && (
        <div style={{ marginBottom: 20, padding: '16px', border: '1.5px solid #0f0f0f', borderRadius: 10, background: '#fafafa' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f', marginBottom: 10 }}>New project name</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
              placeholder="e.g. Smith v Jones litigation"
              style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 7, fontSize: 14, outline: 'none' }}
            />
            <button onClick={createProject} disabled={!newName.trim()} style={{ padding: '8px 16px', border: 'none', borderRadius: 7, background: newName.trim() ? '#0f0f0f' : '#e5e5e5', color: newName.trim() ? '#fff' : '#aaa', fontSize: 13.5, fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'not-allowed' }}>
              Create
            </button>
            <button onClick={() => { setCreating(false); setNewName('') }} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', color: '#555', fontSize: 13.5, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Projects grid */}
      {sorted.length === 0 && !creating ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#bbb' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#888', marginBottom: 6 }}>No projects yet</div>
          <div style={{ fontSize: 13.5, color: '#bbb', marginBottom: 20 }}>Create a project to start a persistent workspace</div>
          <button onClick={() => setCreating(true)} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#0f0f0f', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            + New Project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sorted.map(p => {
            const msgCount = Math.floor(p.messages.length / 2)
            const lastMsg = p.messages.filter(m => m.role === 'user').slice(-1)[0]?.content
            return (
              <div key={p.id} style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, background: '#fff', overflow: 'hidden', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📁</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {renaming === p.id ? (
                      <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                        onBlur={() => commitRename(p.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(p.id); if (e.key === 'Escape') setRenaming(null) }}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 14, fontWeight: 600, border: '1.5px solid #0f0f0f', borderRadius: 5, padding: '2px 8px', outline: 'none', width: '100%' }}
                      />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    )}
                    <div style={{ fontSize: 12, color: '#aaa' }}>
                      {msgCount} exchange{msgCount !== 1 ? 's' : ''} · updated {timeAgo(p.updatedAt)}
                    </div>
                    {lastMsg && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lastMsg.slice(0, 80)}{lastMsg.length > 80 ? '…' : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startRename(p)} title="Rename" style={{ width: 30, height: 30, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, background: '#fff', color: '#666', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✎</button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDel(p.id) }} title="Delete" style={{ width: 30, height: 30, border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, background: '#fff8f8', color: '#dc2626', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    <button onClick={() => openProject(p)} style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      Open
                    </button>
                  </div>
                </div>

                {/* Delete confirmation */}
                {confirmDel === p.id && (
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #fee2e2', background: '#fff8f8', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: '#dc2626', flex: 1 }}>Delete "{p.name}" and all its chat history?</span>
                    <button onClick={() => deleteProject(p.id)} style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                    <button onClick={() => setConfirmDel(null)} style={{ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#555', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
