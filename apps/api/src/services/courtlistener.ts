// CourtListener REST API v4 — https://www.courtlistener.com/api/rest/v4/
const CL_BASE = 'https://www.courtlistener.com/api/rest/v4'

// Map jurisdiction keywords → CourtListener court codes
const COURT_MAP: Record<string, string> = {
  scotus:        'scotus',
  'supreme court': 'scotus',
  '1st circuit': 'ca1',
  '2nd circuit': 'ca2',
  '3rd circuit': 'ca3',
  '4th circuit': 'ca4',
  '5th circuit': 'ca5',
  '6th circuit': 'ca6',
  '7th circuit': 'ca7',
  '8th circuit': 'ca8',
  '9th circuit': 'ca9',
  '10th circuit': 'ca10',
  '11th circuit': 'ca11',
  dc:            'cadc',
  delaware:      'deld',
  california:    'cal',
  'new york':    'ny',
  texas:         'tex',
  florida:       'fla',
  illinois:      'ill',
}

export interface CourtListenerCase {
  id: string
  caseName: string
  citation: string
  court: string
  dateFiled: string
  url: string
  snippet: string
  precedentialStatus: string
}

export async function searchCourtListener(
  query: string,
  jurisdiction?: string,
  token?: string
): Promise<CourtListenerCase[]> {
  const apiToken = token || process.env.COURTLISTENER_API_TOKEN

  const jur = (jurisdiction || '').toLowerCase()
  const court = Object.entries(COURT_MAP).find(([k]) => jur.includes(k))?.[1] || ''

  const params = new URLSearchParams({
    q:        query,
    type:     'o',       // opinions
    order_by: 'score desc',
  })
  if (court) params.set('stat_Precedential', 'on')
  if (court) params.set('court', court)

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  }
  if (apiToken) {
    headers['Authorization'] = `Token ${apiToken}`
  }

  try {
    const res = await fetch(`${CL_BASE}/search/?${params}`, { headers })
    if (!res.ok) {
      console.error(`CourtListener ${res.status}: ${await res.text().catch(() => '')}`)
      return []
    }
    const data = await res.json() as any
    const results: any[] = data.results || []

    return results.slice(0, 5).map((r) => {
      const citations: string[] = r.citation || r.citations || []
      return {
        id:                 String(r.id || r.cluster_id || ''),
        caseName:           r.caseName || r.case_name || 'Unknown',
        citation:           citations[0] || '',
        court:              r.court_citation_string || r.court || r.court_id || '',
        dateFiled:          r.dateFiled || r.date_filed || '',
        url:                r.absolute_url
                              ? `https://www.courtlistener.com${r.absolute_url}`
                              : `https://www.courtlistener.com/opinion/${r.cluster_id}/`,
        snippet:            r.snippet || r.opinions?.[0]?.snippet?.slice(0, 300) || '',
        precedentialStatus: r.status || 'Published',
      }
    })
  } catch (e) {
    console.error('CourtListener fetch error:', e)
    return []
  }
}
