import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getUserApiKey } from './apiKeys'
import { searchCourtListener } from '../services/courtlistener'
import { searchNationalArchives } from '../services/nationalarchives'

const router = Router()

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  const { q, jurisdiction = 'global' } = req.query as { q: string; jurisdiction?: string }
  if (!q) {
    res.status(400).json({ error: 'q is required' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (d: object) => {
    try { res.write(`data: ${JSON.stringify(d)}\n\n`) } catch {}
  }

  try {
    const jur      = jurisdiction.toLowerCase()
    const isUK     = jur.includes('uk') || jur.includes('england') || jur.includes('wales') || jur.includes('scotland')
    const isUS     = jur.includes('us') || jur.includes('federal') || jur.includes('california') || jur.includes('new york') || jur.includes('delaware')
    const isGlobal = jur === 'global' || jur === 'all' || (!isUK && !isUS)

    send({ type: 'progress', message: 'Searching verified case databases...' })

    const [usCases, ukCases] = await Promise.all([
      (isUS || isGlobal)
        ? searchCourtListener(q, jur, process.env.COURTLISTENER_API_TOKEN).catch(() => [])
        : Promise.resolve([]),
      (isUK || isGlobal)
        ? searchNationalArchives(q, jur).catch(() => [])
        : Promise.resolve([]),
    ])

    send({ type: 'verified_results', usCases, ukCases, total: usCases.length + ukCases.length })

    if (usCases.length === 0 && ukCases.length === 0) {
      send({ type: 'progress', message: 'No results from databases. Using AI knowledge...' })
    }

    let verifiedContext = ''
    if (usCases.length > 0) {
      verifiedContext += '\n\nVERIFIED US CASES FROM COURTLISTENER (v4 API):\n'
      usCases.forEach((c: any) => {
        verifiedContext += `- ${c.caseName} ${c.citation} (${c.court}, ${c.dateFiled})\n`
        verifiedContext += `  URL: ${c.url}\n`
        if (c.snippet) verifiedContext += `  Excerpt: ${c.snippet}\n`
      })
    }
    if (ukCases.length > 0) {
      verifiedContext += '\n\nVERIFIED UK CASES FROM THE NATIONAL ARCHIVES FIND CASE LAW:\n'
      ukCases.forEach((c: any) => {
        verifiedContext += `- ${c.title} ${c.citation} (${c.court}, ${c.year})\n`
        verifiedContext += `  URL: ${c.url}\n`
        if (c.pdfUrl) verifiedContext += `  PDF: ${c.pdfUrl}\n`
      })
    }

    const apiKeyH = (req.headers["x-api-key"] as string) || ""; const providerH = (req.headers["x-api-provider"] as string) || "claude"; const aiCfg = apiKeyH ? { key: apiKeyH, provider: providerH } : await getUserApiKey(req.user!.id)
    if (!aiCfg) {
      send({ error: 'No API key configured. Add one in Settings.' })
      res.end()
      return
    }

    const system = `You are an expert legal research agent.

CRITICAL RULES:
1. You may ONLY cite cases from the VERIFIED SOURCES provided below
2. If the verified sources do not fully answer the question, say so explicitly
3. Never cite a case that is not in the verified sources list
4. Always include the full citation and URL for every case you mention
5. If no verified sources are available for a jurisdiction, say so and recommend the user search courtlistener.com (US) or caselaw.nationalarchives.gov.uk (UK) directly

Structure: Key Legal Principle → Verified Authorities → Analysis → Practical Points`

    const userMsg = `Research question: ${q}
Jurisdiction: ${jurisdiction}
${verifiedContext || '\n\nNo verified cases found for this query. Provide general legal analysis and note the user should verify any cases mentioned.'}

Provide a comprehensive legal analysis. For every case you mention, cite it exactly as it appears in the verified sources above and include its URL.`

    send({ type: 'progress', message: 'Generating analysis from verified sources...' })

    if (aiCfg.provider === 'anthropic' || aiCfg.provider === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiCfg.key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          stream: true,
          system,
          messages: [{ role: 'user', content: userMsg }],
        }),
      })

      const reader = r.body!.getReader()
      const dec    = new TextDecoder()
      let buf      = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const p = JSON.parse(raw)
            if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta' && p.delta?.text) {
              send({ type: 'token', token: p.delta.text })
            }
          } catch {}
        }
      }
    } else {
      // Gemini fallback
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${aiCfg.key}`
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: { maxOutputTokens: 3000 },
        }),
      })
      const d = await r.json() as any
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
      send({ type: 'token', token: text })
    }

    send({ done: true })
    res.end()
  } catch (err: any) {
    send({ error: err.message || 'Research failed' })
    res.end()
  }
})

export default router
