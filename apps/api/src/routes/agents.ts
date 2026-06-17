import { Router } from 'express'
import { prisma } from '@law-oss/db'
import { callAI } from '@law-oss/ai'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getUserApiKey } from './apiKeys'
import { createClient } from '@supabase/supabase-js'
import type { Message } from '@law-oss/types'
// @ts-ignore
import pdfParse from 'pdf-parse'
// @ts-ignore
import mammoth from 'mammoth'

const router = Router()

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function pathFromUrl(publicUrl: string): string {
  const marker = '/storage/v1/object/public/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return publicUrl
  const after = publicUrl.slice(idx + marker.length)
  const [, ...rest] = after.split('/')
  return rest.join('/')
}

async function getMatterDocumentContext(matterId: string): Promise<string> {
  try {
    const docs = await prisma.matterDocument.findMany({
      where: { matterId },
      take: 5,
      orderBy: { createdAt: 'desc' },
    })
    if (!docs.length) return ''

    const supabase = getSupabase()
    let context = '\n\nDOCUMENTS IN THIS MATTER:\n'
    let added = 0

    for (const doc of docs) {
      try {
        const storagePath = pathFromUrl(doc.storageUrl)
        const bucket = doc.storageUrl.includes('/contracts/') ? 'contracts' : 'matter-documents'
        const { data, error } = await supabase.storage.from(bucket).download(storagePath)
        if (error || !data) continue

        const buffer = Buffer.from(await data.arrayBuffer())
        let text = ''
        const mime = doc.mimeType || ''
        const name = doc.filename || ''

        if (mime.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
          const parsed = await pdfParse(buffer, { max: 0 })
          text = (parsed.text || '').slice(0, 6000)
        } else if (mime.includes('wordprocessingml') || name.toLowerCase().endsWith('.docx')) {
          const result = await mammoth.extractRawText({ buffer })
          text = (result.value || '').slice(0, 6000)
        }

        if (text.trim().length > 20) {
          context += `\n[${doc.filename}]\n${text}\n---\n`
          added++
        }
      } catch {
        // skip, continue with other docs
      }
    }
    return added > 0 ? context : ''
  } catch {
    return ''
  }
}

// Sanitise error messages — never leak API keys
function sanitiseError(msg: string): string {
  return msg
    .replace(/sk-ant-[A-Za-z0-9\-_]+/g, '[redacted]')
    .replace(/sk-[A-Za-z0-9\-_]+/g, '[redacted]')
    .replace(/AIza[A-Za-z0-9\-_]+/g, '[redacted]')
    .replace(/Bearer [A-Za-z0-9\-_.]+/g, 'Bearer [redacted]')
}

// ─── Streaming chat ───────────────────────────────────────────────────────────
// API key is ALWAYS fetched from the database — never accepted from the client.
router.post('/chat/stream', requireAuth, async (req: AuthRequest, res) => {
  const send = (data: object) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch {}
  }
  const end = () => { try { res.end() } catch {} }

  // Fetch key server-side — client never sends the raw key
  const aiCfg = await getUserApiKey(req.user!.id)
  if (!aiCfg) {
    res.status(400).json({ error: 'NO_API_KEY' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.flushHeaders()

  // Abort handling — save partial response on client disconnect
  let partialResponse = ''
  req.on('close', () => {
    if (partialResponse) {
      // Persist partial to session so it's not lost
      const { agentId = 'general' } = req.body
      const sessionId = `${req.user!.id}-${agentId}`
      prisma.agentSession.upsert({
        where: { id: sessionId },
        create: { id: sessionId, userId: req.user!.id, agentId, messages: [] },
        update: {},
      }).catch(() => {})
    }
  })

  try {
    const { agentId = 'general', message, history = [], matterId = null, systemPrompt } = req.body

    let sys = systemPrompt || buildSystemPrompt(agentId)
    if (matterId) {
      const docCtx = await getMatterDocumentContext(matterId as string)
      if (docCtx) sys += docCtx
    }

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(Array.isArray(history) ? history : []).map((h: any) => ({
        role: h.role as 'user' | 'assistant',
        content: String(h.content),
      })),
      { role: 'user' as const, content: String(message) },
    ]

    const { key: apiKey, provider } = aiCfg

    if (provider === 'claude' || provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          stream: true,
          system: sys,
          messages,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as any
        send({ error: sanitiseError(err.error?.message || `Error ${response.status}`) })
        end(); return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const parsed = JSON.parse(raw)
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              partialResponse += parsed.delta.text
              send({ token: parsed.delta.text })
            }
          } catch {}
        }
      }
      send({ done: true })
      end()

    } else {
      // Gemini
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}&alt=sse`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sys }] },
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: { maxOutputTokens: 4000, temperature: 0.3 },
        }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const parsed = JSON.parse(raw)
            const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text
            if (token) {
              partialResponse += token
              send({ token })
            }
          } catch {}
        }
      }
      send({ done: true })
      end()
    }

  } catch (error: any) {
    console.error('Agent stream error:', sanitiseError(error.message || ''))
    send({ error: sanitiseError(error.message || 'Server error') })
    end()
  }
})

// ─── Non-streaming fallback ───────────────────────────────────────────────────
router.post('/chat', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { agentId, message, history = [], systemPrompt, matterId } = req.body
    const aiCfg = await getUserApiKey(req.user!.id)
    if (!aiCfg) throw new Error('NO_API_KEY')

    let sys = systemPrompt || buildSystemPrompt(agentId)
    if (matterId) {
      const docCtx = await getMatterDocumentContext(matterId)
      if (docCtx) sys += docCtx
    }

    const messages: Message[] = [...(history as Message[]), { role: 'user', content: message }]
    const response = await callAI(aiCfg.key, aiCfg.provider, messages, sys)
    res.json({ response, provider: aiCfg.provider })
  } catch (err) {
    next(err)
  }
})

// ─── Sessions ─────────────────────────────────────────────────────────────────
router.post('/sessions', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { agentId, messages } = req.body
    const sessionId = `${req.user!.id}-${agentId}`
    const session = await prisma.agentSession.upsert({
      where: { id: sessionId },
      create: { id: sessionId, userId: req.user!.id, agentId, messages },
      update: { messages },
    })
    res.json(session)
  } catch (err) {
    next(err)
  }
})

router.get('/sessions/:agentId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const session = await prisma.agentSession.findFirst({
      where: { userId: req.user!.id, agentId: req.params.agentId },
    })
    res.json(session)
  } catch (err) {
    next(err)
  }
})

// ─── System prompts ───────────────────────────────────────────────────────────
function buildSystemPrompt(agentId: string): string {
  const base = `You are Law OSS AI, an expert legal assistant. Apply the governing law relevant to the user's matter. If the user specifies a jurisdiction, apply that law; otherwise apply general common law principles. Be precise, professional and cite real legal authorities. Do not use emojis or decorative symbols.`
  const prompts: Record<string, string> = {
    research:   `${base} Specialise in legal research. Find relevant cases, statutes, and regulations. Always cite specific authorities with proper citation format. Never fabricate citations.`,
    drafting:   `${base} Specialise in legal document drafting. Create precise, enforceable legal language. Mark client-specific gaps as [PLACEHOLDER]. Flag ambiguities.`,
    contract:   `${base} Specialise in contract analysis. Identify risks [CRITICAL/HIGH/MEDIUM/LOW], unusual clauses, and missing provisions. Be structured.`,
    litigation: `${base} Specialise in litigation strategy. Analyse merits, identify key issues, suggest case strategy, and assess risk with probability estimates.`,
    compliance: `${base} Specialise in regulatory compliance. Identify applicable regulations by name and provision, analyse gaps, and recommend remediation.`,
    dd:         `${base} Specialise in due diligence. Systematically analyse corporate, financial, and legal risks. Format findings with priority levels.`,
    client:     `${base} Specialise in client communication. Draft clear, professional letters explaining legal concepts in plain language.`,
    billing:    `${base} Specialise in legal billing. Review time entries, draft billing narratives, identify potential write-offs. Be concise.`,
    general:    base,
  }
  return prompts[agentId] || base
}

export default router
