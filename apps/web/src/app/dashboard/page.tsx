'use client'
import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

type Msg = { role: 'user' | 'assistant'; content: string }

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'research', label: 'Research' },
  { id: 'drafting', label: 'Drafting' },
  { id: 'contract', label: 'Contract' },
  { id: 'litigation', label: 'Litigation' },
]

const SYSTEM_PROMPTS: Record<string, string> = {
  general: `You are Law OSS AI, an expert legal assistant. Apply the governing law relevant to the user's matter. If the user specifies a jurisdiction, apply that law; otherwise apply general common law principles. Be precise, professional and cite real legal authorities. Do not use emojis, decorative symbols, or coloured text. Use plain professional text. Always produce complete responses without truncating.`,
  research: `You are Law OSS AI, an expert legal research assistant. Find relevant cases, statutes, and regulations. Always cite specific authorities with proper citation format. Never fabricate citations. Apply governing law as specified. Do not use emojis, decorative symbols, or coloured text. Use plain professional text. Always produce complete responses without truncating.`,
  drafting: `You are a senior commercial lawyer generating legally enforceable contracts and legal documents. CRITICAL — NEVER TRUNCATE: If a contract exceeds your output limit, split into sequential parts. End each part with [CONTINUE FROM CLAUSE X] and wait for the user to prompt continuation. Resume exactly where stopped. Never omit, summarise, or abbreviate clauses. Never stop mid-sentence or mid-clause. Every clause must contain complete legal drafting. Number all clauses sequentially. Use professional UK legal drafting standards unless another jurisdiction is specified. Do not use emojis, decorative symbols, or coloured text. Use plain professional text.`,
  contract: `You are Law OSS AI, an expert contract analyst. Identify risks [CRITICAL/HIGH/MEDIUM/LOW], unusual clauses, and missing provisions. Compare against market standard terms. Do not use emojis, decorative symbols, or coloured text. Use plain professional text. Always produce complete responses without truncating.`,
  litigation: `You are Law OSS AI, an expert litigation assistant. Analyse merits, identify key issues, suggest case strategy, and assess litigation risk with probability estimates. Do not use emojis, decorative symbols, or coloured text. Use plain professional text. Always produce complete responses without truncating.`,
}

const SUGGESTIONS = [
  'Explain force majeure',
  'What makes a contract void?',
  'Summarise GDPR Article 17',
  'Draft a confidentiality clause',
  'Key elements of a valid contract',
]

async function streamClaude(
  apiKey: string,
  messages: Msg[],
  sys: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  try {
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
        system: sys,
        messages,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any
      onError(err.error?.message || `Claude error ${res.status}`); return
    }
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
          if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta' && p.delta?.text) {
            onToken(p.delta.text)
          }
        } catch {}
      }
    }
    onDone()
  } catch (e: any) {
    onError(e.message || 'Network error')
  }
}

async function streamGemini(
  apiKey: string,
  messages: Msg[],
  sys: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}&alt=sse`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 8000, temperature: 0.3 },
      }),
    })
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
          const token = p.candidates?.[0]?.content?.parts?.[0]?.text
          if (token) onToken(token)
        } catch {}
      }
    }
    onDone()
  } catch (e: any) {
    onError(e.message || 'Network error')
  }
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('')
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [agentId, setAgentId] = useState('general')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const meta = session.user.user_metadata || {}
      setUserName(meta.full_name || meta.name || session.user.email?.split('@')[0] || '')
      setHasKey(!!localStorage.getItem('law_oss_api_key'))
    })
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(text: string) {
    if (!text.trim() || streaming) return
    const apiKey = localStorage.getItem('law_oss_api_key') || ''
    const provider = localStorage.getItem('law_oss_provider') || 'claude'
    if (!apiKey) { setHasKey(false); return }

    const msg = text.trim()
    setInput('')
    const newHistory: Msg[] = [...messages, { role: 'user', content: msg }]
    setMessages([...newHistory, { role: 'assistant', content: '' }])
    setStreaming(true)

    const sys = SYSTEM_PROMPTS[agentId] || SYSTEM_PROMPTS.general

    const onToken = (t: string) => setMessages(prev => {
      const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: n[n.length - 1].content + t }; return n
    })
    const onDone = () => setStreaming(false)
    const onError = (e: string) => {
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: `Error: ${e}` }; return n })
      setStreaming(false)
    }

    // Auto-continuation: if response ends with [CONTINUE FROM CLAUSE X], keep going
    let history = newHistory
    let continueLoop = true
    while (continueLoop) {
      continueLoop = false
      let fullResponse = ''
      await new Promise<void>((resolve) => {
        const tok = (t: string) => { fullResponse += t; onToken(t) }
        const done = () => resolve()
        const err = (e: string) => { onError(e); resolve() }
        if (provider === 'gemini') streamGemini(apiKey, history, sys, tok, done, err)
        else streamClaude(apiKey, history, sys, tok, done, err)
      })
      if (/\[CONTINUE FROM CLAUSE/i.test(fullResponse)) {
        continueLoop = true
        history = [...history, { role: 'assistant', content: fullResponse }, { role: 'user', content: 'Continue.' }]
        onToken('\n\n')
      }
    }
    setStreaming(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {hasKey === false && (
        <div style={{
          padding: '10px 24px', background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13.5, color: '#555' }}>No API key configured. Add your Claude or Gemini key to use AI features.</span>
          <Link href="/onboarding" style={{
            padding: '0 14px', height: 30, display: 'inline-flex', alignItems: 'center',
            background: '#0f0f0f', borderRadius: 6, fontSize: 12.5, color: '#fff',
            textDecoration: 'none', fontWeight: 600,
          }}>Add Key</Link>
        </div>
      )}

      {/* Agent tabs */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#fff', flexShrink: 0 }}>
        {userName && (
          <div style={{ fontSize: 12.5, color: '#aaa', paddingTop: 12, marginBottom: 8 }}>
            Good day, {userName}
          </div>
        )}
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
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 0',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f0f0f', marginBottom: 8 }}>
              {TABS.find(t => t.id === agentId)?.label} Agent
            </div>
            <div style={{ fontSize: 14, color: '#999', maxWidth: 360, lineHeight: 1.65, marginBottom: 28 }}>
              Ask a legal question, draft a document, or research case law. AI output is not legal advice.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 520 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  padding: '8px 16px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 20,
                  background: '#fff', color: '#333', fontSize: 13, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#f5f5f5' }}
                onMouseOut={e => { e.currentTarget.style.background = '#fff' }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '72%', padding: '11px 16px', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
              borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: m.role === 'user' ? '#0f0f0f' : '#f5f5f5',
              color: m.role === 'user' ? '#fff' : '#0f0f0f',
            }}>
              {m.content || (streaming && i === messages.length - 1 ? (
                <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block', animation: 'pulse 1s 0.2s infinite' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block', animation: 'pulse 1s 0.4s infinite' }} />
                </span>
              ) : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px 20px', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
        <div style={{
          display: 'flex', gap: 10, background: '#fff',
          border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 12, padding: '10px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(0,0,0,0.35)' }}
            onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(0,0,0,0.15)' }}
            placeholder="Ask a legal question... (Enter to send, Shift+Enter for new line)"
            disabled={streaming} rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              resize: 'none', fontSize: 14, color: '#0f0f0f', lineHeight: 1.5,
              maxHeight: 120, overflowY: 'auto',
            }}
          />
          <button onClick={() => send(input)} disabled={streaming || !input.trim()} style={{
            width: 34, height: 34, borderRadius: 8, border: 'none', alignSelf: 'flex-end', flexShrink: 0,
            background: streaming || !input.trim() ? 'rgba(0,0,0,0.07)' : '#0f0f0f',
            color: streaming || !input.trim() ? '#bbb' : '#fff',
            cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>↑</button>
        </div>
        <div style={{ fontSize: 11, color: '#ccc', marginTop: 6, textAlign: 'center' }}>
          Not legal advice. Verify all AI output with a qualified lawyer.
        </div>
      </div>
    </div>
  )
}
