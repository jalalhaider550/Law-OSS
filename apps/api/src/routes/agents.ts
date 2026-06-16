import { Router } from 'express'
import { prisma } from '@law-oss/db'
import { callAI } from '@law-oss/ai'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getUserApiKey } from './apiKeys'
import { decrypt } from '../services/encryption'
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

// Extract storage path from public URL
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
      } catch (docErr) {
        // skip this doc, continue
      }
    }
    return added > 0 ? context : ''
  } catch {
    return ''
  }
}

// Non-streaming chat (fallback)
router.post('/chat', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { agentId, message, history = [], systemPrompt, matterId } = req.body
    const apiKeyH = (req.headers['x-api-key'] as string) || ''
    const providerH = (req.headers['x-api-provider'] as string) || 'claude'
    const aiCfg = apiKeyH ? { key: apiKeyH, provider: providerH } : await getUserApiKey(req.user!.id)
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

// Streaming chat — direct fetch for reliable SSE through Railway/nginx
router.post('/chat/stream', requireAuth, async (req: AuthRequest, res) => {
  const send = (data: object) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch {}
  }
  const end = () => { try { res.end() } catch {} }

  // Read API key from request header (sent by frontend from localStorage)
  const apiKey = (req.headers['x-api-key'] as string) || ''
  const provider = (req.headers['x-api-provider'] as string) || 'claude'
  if (!apiKey) {
    res.status(400).json({ error: 'NO_API_KEY' })
    return
  }

  // Now commit to SSE — flush headers immediately
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  try {
    const { agentId = 'general', message, history = [], matterId = null } = req.body

    // Build system prompt with optional matter document context
    let sys = buildSystemPrompt(agentId)
    if (matterId) {
      const docCtx = await getMatterDocumentContext(matterId as string)
      if (docCtx) sys += docCtx
    }

    const messages = [
      ...(Array.isArray(history) ? history : []).map((h: any) => ({
        role: h.role as 'user' | 'assistant',
        content: String(h.content),
      })),
      { role: 'user' as const, content: String(message) },
    ]

    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          stream: true,
          system: sys,
          messages,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as any
        send({ error: err.error?.message || `Claude error ${response.status}` })
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
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
              send({ token: parsed.delta.text })
            }
          } catch {}
        }
      }
      send({ done: true })
      end()

    } else if (provider === 'google') {
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
          generationConfig: { maxOutputTokens: 2000, temperature: 0.3 },
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
            if (token) send({ token })
          } catch {}
        }
      }
      send({ done: true })
      end()
    }

  } catch (error: any) {
    console.error('Agent stream error:', error)
    send({ error: error.message || 'Server error' })
    end()
  }
})

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

function buildSystemPrompt(agentId: string): string {
  const base = `You are Law OSS AI, an expert legal assistant. Apply the governing law relevant to the user's matter. If the user specifies a jurisdiction, apply that law; otherwise apply general common law principles. Be precise, professional and cite real legal authorities.`
  const prompts: Record<string, string> = {
    research: `${base} Specialise in legal research. Find relevant cases, statutes, and regulations. Always cite specific authorities with proper citation format. Never fabricate citations.`,
    drafting: `${base} Specialise in legal document drafting. Create precise, enforceable legal language. Mark client-specific gaps as [PLACEHOLDER]. Flag ambiguities and suggest improvements.`,
    contract: `${base} Specialise in contract analysis. Identify risks [CRITICAL/HIGH/MEDIUM], unusual clauses, and missing provisions. Compare against market standard terms.`,
    litigation: `${base} Specialise in litigation strategy. Analyse merits, identify key issues, suggest case strategy, and assess litigation risk with probability estimates.`,
    compliance: `${base} Specialise in regulatory compliance. Identify applicable regulations by name and provision, analyse compliance gaps, and recommend remediation steps.`,
    dd: `${base} Specialise in due diligence. Systematically analyse corporate, financial, and legal risks in transactions. Format as actionable findings with priority levels.`,
    client: `${base} Specialise in client communication. Draft clear, professional letters explaining legal concepts in plain language.`,
    billing: `${base} Specialise in legal billing. Review time entries, draft billing narratives, and identify potential write-offs.`,
    general: base,
  }
  return prompts[agentId] || base
}

export default router
