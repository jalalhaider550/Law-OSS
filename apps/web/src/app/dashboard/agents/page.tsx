'use client'
import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

type Msg = { role: 'user' | 'assistant'; content: string }

const AGENTS = [
  {
    id: 'research',
    name: 'Legal Researcher',
    desc: 'Case law, statutes & regulations',
    icon: '🔍',
    chips: ['Find relevant cases', 'Summarise statute', 'Cite authority'],
    sys: `You are Law OSS AI, an expert legal research assistant. Find relevant cases, statutes, and regulations. Always cite specific authorities with proper citation format (e.g. [2024] EWHC 1234, 42 U.S.C. § 1983). Never fabricate citations. Apply the governing law of the jurisdiction specified; if none, use general common law principles. Be precise and professional.`,
  },
  {
    id: 'drafting',
    name: 'Document Drafter',
    desc: 'Draft legal documents & clauses',
    icon: '✍️',
    chips: ['Draft NDA clause', 'Write demand letter', 'Create settlement agreement'],
    sys: `You are Law OSS AI, an expert legal document drafter. Create precise, enforceable legal language. Mark client-specific gaps as [PLACEHOLDER]. Flag ambiguities and suggest improvements. Apply the governing law of the jurisdiction specified; if none, use general common law principles.`,
  },
  {
    id: 'contract',
    name: 'Contract Analyst',
    desc: 'Contract review & risk analysis',
    icon: '📋',
    chips: ['Review this contract', 'Flag risky clauses', 'Compare to standard terms'],
    sys: `You are Law OSS AI, an expert contract analyst. Identify risks [CRITICAL/HIGH/MEDIUM/LOW], unusual clauses, and missing provisions. Compare against market standard terms. Apply the governing law of the jurisdiction specified; if none, use general common law principles. Be precise and structured.`,
  },
  {
    id: 'litigation',
    name: 'Litigation Assistant',
    desc: 'Strategy, procedure & pleadings',
    icon: '⚖️',
    chips: ['Assess case merits', 'Draft skeleton argument', 'Litigation risk estimate'],
    sys: `You are Law OSS AI, an expert litigation assistant. Analyse merits, identify key issues, suggest case strategy, and assess litigation risk with probability estimates. Apply the governing law of the jurisdiction specified; if none, use general common law principles. Be precise and strategic.`,
  },
  {
    id: 'compliance',
    name: 'Compliance Officer',
    desc: 'Regulatory compliance guidance',
    icon: '🏛️',
    chips: ['Check GDPR compliance', 'AML obligations', 'Data breach response'],
    sys: `You are Law OSS AI, an expert compliance advisor. Identify applicable regulations by name and provision, analyse compliance gaps, and recommend remediation steps. Apply the governing law of the jurisdiction specified; if none, use general principles. Be thorough and practical.`,
  },
  {
    id: 'dd',
    name: 'Due Diligence',
    desc: 'M&A and transaction analysis',
    icon: '🔎',
    chips: ['M&A red flags', 'Corporate structure review', 'IP ownership check'],
    sys: `You are Law OSS AI, an expert due diligence specialist. Systematically analyse corporate, financial, and legal risks in transactions. Format findings with priority levels [CRITICAL/HIGH/MEDIUM/LOW]. Apply the governing law of the jurisdiction specified; if none, use general principles.`,
  },
  {
    id: 'client',
    name: 'Client Comms',
    desc: 'Client letters & plain English',
    icon: '✉️',
    chips: ['Explain in plain English', 'Draft client update', 'Write advice letter'],
    sys: `You are Law OSS AI, an expert in legal client communication. Draft clear, professional letters explaining legal concepts in plain language. Always include appropriate disclaimers. Apply the governing law of the jurisdiction specified; if none, use general principles.`,
  },
  {
    id: 'billing',
    name: 'Billing & Narratives',
    desc: 'Time entries & billing narratives',
    icon: '💼',
    chips: ['Write billing narrative', 'Review time entry', 'Draft fee agreement'],
    sys: `You are Law OSS AI, an expert in legal billing. Review time entries, draft clear and defensible billing narratives, and identify potential write-offs. Apply law firm billing best practices. Be concise and professional.`,
  },
]

function getSystemPrompt(agentId: string): string {
  return AGENTS.find(a => a.id === agentId)?.sys || AGENTS[0].sys
}

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
        max_tokens: 2200,
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
        generationConfig: { maxOutputTokens: 2200, temperature: 0.3 },
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

export default function AgentsPage() {
  const [agentId, setAgentId] = useState(AGENTS[0].id)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [noKey, setNoKey] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login' }
    })
    setNoKey(!localStorage.getItem('law_oss_api_key'))
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(text: string) {
    if (!text.trim() || streaming) return
    const apiKey = localStorage.getItem('law_oss_api_key') || ''
    const provider = localStorage.getItem('law_oss_provider') || 'claude'
    if (!apiKey) { setNoKey(true); return }

    const msg = text.trim()
    setInput('')
    const newHistory: Msg[] = [...messages, { role: 'user', content: msg }]
    setMessages([...newHistory, { role: 'assistant', content: '' }])
    setStreaming(true)

    const sys = getSystemPrompt(agentId)

    const onToken = (t: string) => setMessages(prev => {
      const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: n[n.length - 1].content + t }; return n
    })
    const onDone = () => setStreaming(false)
    const onError = (e: string) => {
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: `Error: ${e}` }; return n })
      setStreaming(false)
    }

    if (provider === 'gemini') {
      await streamGemini(apiKey, newHistory, sys, onToken, onDone, onError)
    } else {
      await streamClaude(apiKey, newHistory, sys, onToken, onDone, onError)
    }
  }

  const activeAgent = AGENTS.find(a => a.id === agentId)!

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Agent sidebar */}
      <div style={{ width: 220, borderRight: '1px solid rgba(0,0,0,0.08)', overflowY: 'auto', flexShrink: 0, background: '#fafafa' }}>
        <div style={{ padding: '14px 16px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999' }}>Agents</div>
        {AGENTS.map(a => (
          <button key={a.id} onClick={() => { setAgentId(a.id); setMessages([]) }} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '10px 16px', border: 'none',
            background: agentId === a.id ? '#fff' : 'transparent',
            borderLeft: agentId === a.id ? '3px solid #0f0f0f' : '3px solid transparent',
            cursor: 'pointer',
          }}>
            <div style={{ fontSize: 13.5, fontWeight: agentId === a.id ? 600 : 400, color: agentId === a.id ? '#0f0f0f' : '#333' }}>
              {a.icon} {a.name}
            </div>
            <div style={{ fontSize: 11.5, color: '#888', marginTop: 2, lineHeight: 1.4 }}>{a.desc}</div>
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#fff', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f0f0f' }}>{activeAgent.icon} {activeAgent.name}</div>
          <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>{activeAgent.desc}</div>
        </div>

        {noKey && (
          <div style={{ padding: '10px 20px', background: '#fefce8', borderBottom: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
            No API key configured. <a href="/onboarding" style={{ color: '#1a2e6e', fontWeight: 600 }}>Add your key →</a>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{activeAgent.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f0f0f', marginBottom: 6 }}>{activeAgent.name}</div>
              <div style={{ fontSize: 13.5, color: '#999', marginBottom: 24, textAlign: 'center', maxWidth: 320 }}>{activeAgent.desc}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {activeAgent.chips.map(c => (
                  <button key={c} onClick={() => send(c)} style={{
                    padding: '8px 16px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 20,
                    background: '#fff', color: '#333', fontSize: 13, cursor: 'pointer',
                  }}>{c}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%', padding: '10px 14px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user' ? '#0f0f0f' : '#fff',
                color: m.role === 'user' ? '#fff' : '#0f0f0f',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                {m.content || (streaming && i === messages.length - 1 ? (
                  <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block' }} />
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block' }} />
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', display: 'inline-block' }} />
                  </span>
                ) : '')}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '10px 20px 14px', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, background: '#f8f8f8', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '6px 10px' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder={`Ask ${activeAgent.name}... (Enter to send)`}
              disabled={streaming} rows={1}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 14, color: '#0f0f0f', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }}
            />
            <button onClick={() => send(input)} disabled={streaming || !input.trim()} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', alignSelf: 'flex-end', flexShrink: 0,
              background: streaming || !input.trim() ? 'rgba(0,0,0,0.1)' : '#0f0f0f',
              color: streaming || !input.trim() ? '#bbb' : '#fff',
              cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>↑</button>
          </div>
          <div style={{ fontSize: 11, color: '#ccc', marginTop: 5, textAlign: 'center' }}>Not legal advice. Verify with a qualified lawyer.</div>
        </div>
      </div>
    </div>
  )
}
