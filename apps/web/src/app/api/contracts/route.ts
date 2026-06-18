import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SYSTEM = `You are a contract risk analyst. Review the contract and identify every risky, unusual, one-sided, or missing clause. Never include any disclaimer, caveat, or note — including "this is not legal advice", "consult a lawyer", or "I am an AI".

Output ONLY a JSON array. No prose. No markdown. No explanation outside the JSON. Start your response with [ and end with ].

Each item in the array must be:
{
  "title": "Short clause title",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "clause": "The exact problematic text from the contract, or 'Not present' if missing",
  "risk": "One sentence explaining why this is risky",
  "fix": "Suggested replacement or addition"
}

Be thorough. Flag every risk. Output 5–20 items depending on how many genuine risks exist.`

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const supabase = getSupabase()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 })

  const { docText, filename, apiKey, apiProvider } = await req.json()
  if (!docText) return new Response(JSON.stringify({ error: 'No document text' }), { status: 400 })
  if (!apiKey) return new Response(JSON.stringify({ error: 'No API key. Add one in Settings.' }), { status: 400 })

  const userMsg = `CONTRACT: ${filename || 'contract'}\n\n${docText.slice(0, 50000)}`
  const provider = apiProvider || 'claude'

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`)) } catch {}
      }

      try {
        let fullText = ''

        if (provider === 'anthropic' || provider === 'claude') {
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-opus-4-5',
              max_tokens: 4096,
              stream: true,
              system: SYSTEM,
              messages: [{ role: 'user', content: userMsg }],
            }),
          })

          if (!r.ok) {
            const err = await r.json().catch(() => ({})) as any
            send({ error: err.error?.message || `AI error ${r.status}` })
            controller.close(); return
          }

          const reader = r.body!.getReader()
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
                  fullText += p.delta.text
                }
              } catch {}
            }
          }
        } else {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: SYSTEM }] },
              contents: [{ role: 'user', parts: [{ text: userMsg }] }],
              generationConfig: { maxOutputTokens: 4096 },
            }),
          })
          const d = await r.json() as any
          fullText = d.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
        }

        // Parse JSON array from response
        let risks: any[] = []
        try {
          // Extract JSON array even if there's surrounding text
          const match = fullText.match(/\[[\s\S]*\]/)
          if (match) risks = JSON.parse(match[0])
        } catch {
          risks = []
        }

        send({ risks })
        send({ done: true })
      } catch (err: any) {
        send({ error: err.message || 'Analysis failed' })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
