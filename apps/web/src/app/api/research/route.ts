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

// ── CourtListener ──────────────────────────────────────────────────────────────

const CL_BASE = 'https://www.courtlistener.com/api/rest/v4'

const COURT_MAP: Record<string, string[]> = {
  federal: ['scotus', 'ca1', 'ca2', 'ca3', 'ca4', 'ca5', 'ca6', 'ca7', 'ca8', 'ca9', 'ca10', 'ca11', 'cafc', 'cadc'],
  us: ['scotus', 'ca1', 'ca2', 'ca3', 'ca4', 'ca5', 'ca6', 'ca7', 'ca8', 'ca9', 'ca10', 'ca11'],
  california: ['ca9', 'cacd', 'caed', 'cand', 'casd'],
  'new york': ['ca2', 'nyed', 'nynd', 'nysd', 'nywd'],
  delaware: ['ca3', 'ded'],
  texas: ['ca5', 'txed', 'txnd', 'txsd', 'txwd'],
}

async function searchCourtListener(query: string, jurisdiction: string, token?: string) {
  const jur = jurisdiction.toLowerCase()
  const courts = Object.entries(COURT_MAP).find(([k]) => jur.includes(k))?.[1] || []

  const params = new URLSearchParams({ q: query, type: 'o', order_by: 'score desc', page_size: '5' })
  if (courts.length) params.set('court', courts.join(','))

  const headers: Record<string, string> = { 'Accept': 'application/json' }
  const t = token || process.env.COURTLISTENER_API_TOKEN
  if (t) headers['Authorization'] = `Token ${t}`

  try {
    const res = await fetch(`${CL_BASE}/search/?${params}`, { headers })
    if (!res.ok) return []
    const data = await res.json() as any
    return (data.results || []).slice(0, 5).map((r: any) => ({
      caseName: r.caseName || r.case_name || 'Unknown',
      citation: r.citation?.[0] || r.neutralCite || '',
      court: r.court || r.court_id || '',
      dateFiled: r.dateFiled || r.date_filed || '',
      url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : '',
      snippet: r.opinions?.[0]?.snippet || r.snippet || '',
    }))
  } catch {
    return []
  }
}

// ── National Archives ──────────────────────────────────────────────────────────

const TNA_BASE = 'https://caselaw.nationalarchives.gov.uk'

const COURT_MAP_UK: Record<string, string> = {
  'supreme court': 'uksc', uksc: 'uksc',
  'court of appeal': 'ewca', ewca: 'ewca',
  'high court': 'ewhc', ewhc: 'ewhc',
  'upper tribunal': 'ukut', ukut: 'ukut',
}

function decodeXml(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

async function searchNationalArchives(query: string, jurisdiction: string) {
  const jur = jurisdiction.toLowerCase()
  const court = Object.entries(COURT_MAP_UK).find(([k]) => jur.includes(k))?.[1] || ''
  const params = new URLSearchParams({ query, order: '-date', per_page: '10' })
  if (court) params.set('court', court)

  try {
    const res = await fetch(`${TNA_BASE}/atom.xml?${params}`, {
      headers: { Accept: 'application/xml', 'User-Agent': 'Law OSS Legal Research' },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const results = []
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g
    for (const m of [...xml.matchAll(entryRe)].slice(0, 5)) {
      const b = m[1]
      const title = decodeXml((b.match(/<title[^>]*>([^<]+)<\/title>/) || [])[1]?.trim() || '')
      if (!title) continue
      const year = ((b.match(/<published>([^<]+)<\/published>/) || [])[1] || '').slice(0, 4)
      const authorB = (b.match(/<author>([\s\S]*?)<\/author>/) || [])[1] || ''
      const court2 = decodeXml((authorB.match(/<name>([^<]+)<\/name>/) || [])[1]?.trim() || '')
      const links = b.match(/<link[^>]*\/>/g) || []
      const htmlLink = links.find((t: string) => t.includes('rel="alternate"') && !t.includes('type='))
      const url = htmlLink ? (htmlLink.match(/href="([^"]+)"/) || [])[1] || '' : ''
      const pdfLink = links.find((t: string) => t.includes('type="application/pdf"'))
      const pdfUrl = pdfLink ? (pdfLink.match(/href="([^"]+)"/) || [])[1] || '' : ''
      const ncn = (b.match(/tna:identifier[^>]*type="ukncn"[^>]*>([^<]+)<\/tna:identifier>/) || [])[1]
      if (!url) continue
      results.push({ title, citation: ncn ? decodeXml(ncn.trim()) : '', court: court2, year, url, pdfUrl, snippet: `${court2}${year ? `, ${year}` : ''}. Full judgment at The National Archives.`, jurisdiction: 'England & Wales' })
    }
    return results
  } catch {
    return []
  }
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')
  const jurisdiction = searchParams.get('jurisdiction') || 'global'
  const apiKey = searchParams.get('apiKey') || req.headers.get('x-api-key') || ''
  const apiProvider = searchParams.get('apiProvider') || req.headers.get('x-api-provider') || 'claude'

  if (!q) return new Response(JSON.stringify({ error: 'q is required' }), { status: 400 })

  // Verify auth token
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const supabase = getSupabase()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 })

  if (!apiKey) return new Response(JSON.stringify({ error: 'No API key. Add one in Settings.' }), { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`)) } catch {}
      }

      try {
        const jur = jurisdiction.toLowerCase()
        const isUK = jur.includes('uk') || jur.includes('england') || jur.includes('wales') || jur.includes('scotland')
        const isUS = jur.includes('us') || jur.includes('federal') || jur.includes('california') || jur.includes('new york') || jur.includes('delaware')
        const isGlobal = jur === 'global' || jur === 'all' || (!isUK && !isUS)

        send({ type: 'progress', message: 'Searching verified case databases...' })

        const [usCases, ukCases] = await Promise.all([
          (isUS || isGlobal) ? searchCourtListener(q, jur).catch(() => []) : Promise.resolve([]),
          (isUK || isGlobal) ? searchNationalArchives(q, jur).catch(() => []) : Promise.resolve([]),
        ])

        send({ type: 'verified_results', usCases, ukCases, total: (usCases as any[]).length + (ukCases as any[]).length })

        let verifiedContext = ''
        if ((usCases as any[]).length > 0) {
          verifiedContext += '\n\nVERIFIED US CASES FROM COURTLISTENER:\n'
          ;(usCases as any[]).forEach((c: any) => {
            verifiedContext += `- ${c.caseName} ${c.citation} (${c.court}, ${c.dateFiled})\n  URL: ${c.url}\n`
            if (c.snippet) verifiedContext += `  Excerpt: ${c.snippet}\n`
          })
        }
        if ((ukCases as any[]).length > 0) {
          verifiedContext += '\n\nVERIFIED UK CASES FROM THE NATIONAL ARCHIVES:\n'
          ;(ukCases as any[]).forEach((c: any) => {
            verifiedContext += `- ${c.title} ${c.citation} (${c.court}, ${c.year})\n  URL: ${c.url}\n`
          })
        }

        const systemPrompt = `You are an expert legal research agent.
CRITICAL RULES:
1. Only cite cases from the VERIFIED SOURCES provided
2. If verified sources don't fully answer the question, say so
3. Never cite a case not in the verified sources list
4. Always include full citation and URL for every case mentioned
Structure: Key Legal Principle → Verified Authorities → Analysis → Practical Points`

        const userMsg = `Research question: ${q}
Jurisdiction: ${jurisdiction}
${verifiedContext || '\n\nNo verified cases found. Provide general legal analysis and note the user should verify any cases.'}
Provide comprehensive legal analysis. For every case mentioned, cite it exactly as in verified sources above and include its URL.`

        send({ type: 'progress', message: 'Generating analysis from verified sources...' })

        if (apiProvider === 'anthropic' || apiProvider === 'claude') {
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 3000, stream: true, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] }),
          })
          const reader = r.body!.getReader()
          const dec = new TextDecoder()
          let buf = ''
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
                if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta' && p.delta?.text)
                  send({ type: 'token', token: p.delta.text })
              } catch {}
            }
          }
        } else {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: 'user', parts: [{ text: userMsg }] }], generationConfig: { maxOutputTokens: 3000 } }),
          })
          const d = await r.json() as any
          send({ type: 'token', token: d.candidates?.[0]?.content?.parts?.[0]?.text || '' })
        }

        send({ done: true })
      } catch (err: any) {
        send({ error: err.message || 'Research failed' })
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
