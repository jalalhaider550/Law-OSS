// National Archives Find Case Law API
// Spec: https://caselaw.nationalarchives.gov.uk — Open Justice Licence
// Rate limit: 1,000 requests per rolling 5 minutes — no auth required

const TNA_BASE = 'https://caselaw.nationalarchives.gov.uk'

const COURT_MAP: Record<string, string> = {
  'supreme court':    'uksc',
  uksc:               'uksc',
  'privy council':    'ukpc',
  ukpc:               'ukpc',
  'court of appeal':  'ewca',
  ewca:               'ewca',
  'high court':       'ewhc',
  ewhc:               'ewhc',
  'commercial court': 'ewhc/comm',
  chancery:           'ewhc/ch',
  family:             'ewhc/fam',
  admin:              'ewhc/admin',
  employment:         'eat',
  eat:                'eat',
  'upper tribunal':   'ukut',
  ukut:               'ukut',
  scotland:           'csih',
}

export interface NationalArchivesCase {
  title: string
  citation: string
  court: string
  year: string
  url: string
  pdfUrl: string
  snippet: string
  jurisdiction: string
}

export async function searchNationalArchives(
  query: string,
  jurisdiction?: string
): Promise<NationalArchivesCase[]> {
  const jur = (jurisdiction || '').toLowerCase()
  const court = Object.entries(COURT_MAP).find(([k]) => jur.includes(k))?.[1] || ''

  const params = new URLSearchParams({ query, order: '-date', per_page: '10' })
  if (court) params.set('court', court)

  try {
    const res = await fetch(`${TNA_BASE}/atom.xml?${params}`, {
      headers: {
        Accept: 'application/xml, text/xml',
        'User-Agent': 'Law OSS Legal Research Tool',
      },
    })
    if (!res.ok) {
      console.error(`National Archives ${res.status}`)
      return []
    }
    const xml = await res.text()
    return parseAtomFeed(xml)
  } catch (e) {
    console.error('National Archives fetch error:', e)
    return []
  }
}

function parseAtomFeed(xml: string): NationalArchivesCase[] {
  const results: NationalArchivesCase[] = []

  // Split into individual <entry> blocks
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  const entries = [...xml.matchAll(entryRe)]

  for (const entry of entries.slice(0, 5)) {
    const block = entry[1]

    // Title — decode XML entities
    const rawTitle = (block.match(/<title[^>]*>([^<]+)<\/title>/) || [])[1] || ''
    const title = decodeXmlEntities(rawTitle.trim())
    if (!title) continue

    // Published date
    const published = (block.match(/<published>([^<]+)<\/published>/) || [])[1] || ''
    const year = published ? published.slice(0, 4) : ''

    // Court name from <author><name>...</name></author>
    const authorBlock = (block.match(/<author>([\s\S]*?)<\/author>/) || [])[1] || ''
    const court = decodeXmlEntities(
      (authorBlock.match(/<name>([^<]+)<\/name>/) || [])[1]?.trim() || ''
    )

    // Extract all <link .../> self-closing tags from this entry
    const linkTags = block.match(/<link[^>]*\/>/g) || []

    // HTML page URL: rel="alternate" with NO type attribute
    const htmlLink = linkTags.find(t => t.includes('rel="alternate"') && !t.includes('type='))
    const url = htmlLink ? (htmlLink.match(/href="([^"]+)"/) || [])[1] || '' : ''

    // PDF link
    const pdfLink = linkTags.find(t => t.includes('type="application/pdf"'))
    const pdfUrl = pdfLink ? (pdfLink.match(/href="([^"]+)"/) || [])[1] || '' : ''

    // Neutral Citation Number from <tna:identifier type="ukncn">
    const ncnMatch = block.match(/tna:identifier[^>]*type="ukncn"[^>]*>([^<]+)<\/tna:identifier>/)
    const citation = ncnMatch ? decodeXmlEntities(ncnMatch[1].trim()) : ''

    if (!url) continue

    results.push({
      title,
      citation,
      court,
      year,
      url,
      pdfUrl,
      snippet: `${court}${year ? `, ${year}` : ''}. Full judgment available at The National Archives.`,
      jurisdiction: courtToJurisdiction(court),
    })
  }

  return results
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function courtToJurisdiction(court: string): string {
  const c = court.toLowerCase()
  if (c.includes('scotland') || c.includes('scottish') || c.includes('csih') || c.includes('csoh')) return 'Scotland'
  if (c.includes('northern ireland') || c.includes('nica')) return 'Northern Ireland'
  if (c.includes('privy council') || c.includes('ukpc')) return 'Privy Council (Commonwealth)'
  return 'England & Wales'
}
