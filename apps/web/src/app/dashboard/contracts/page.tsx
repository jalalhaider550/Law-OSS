'use client'
import { useState, useRef, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { loadAllFromCloud, saveToCloud } from '../../../lib/sync'

// ── Add to Matter ─────────────────────────────────────────────────────────────
function AddToMatterButton({ content, title, uid, token }: { content: string; title: string; uid: string; token: string }) {
  const [open, setOpen] = useState(false)
  const [matters, setMatters] = useState<any[]>([])
  const [saved, setSaved] = useState(false)

  function loadMatters() {
    try { return JSON.parse(localStorage.getItem(`law_oss_matters_${uid}`) || '[]') } catch { return [] }
  }
  function saveMatters(m: any[]) {
    localStorage.setItem(`law_oss_matters_${uid}`, JSON.stringify(m))
    if (token) saveToCloud(token, 'matters', m)
  }

  function handleOpen() { setMatters(loadMatters()); setOpen(true); setSaved(false) }

  function addToMatter(matterId: string) {
    const all = loadMatters()
    const chat = {
      id: Date.now().toString(),
      agentId: 'contracts',
      agentName: 'Contract Review',
      title,
      messages: [{ role: 'assistant', content }],
      savedAt: new Date().toISOString(),
    }
    const updated = all.map((m: any) => m.id === matterId ? { ...m, savedChats: [chat, ...(m.savedChats || [])] } : m)
    saveMatters(updated)
    setSaved(true)
    setTimeout(() => setOpen(false), 900)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 7, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Add to Matter
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 200, background: '#fff', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.13)', minWidth: 220, overflow: 'hidden' }}>
          {saved ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>Saved to matter</div>
          ) : matters.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#888' }}>No matters yet. <a href="/dashboard/matters" style={{ color: '#0f0f0f', fontWeight: 600 }}>Create one</a>.</div>
          ) : (
            <>
              <div style={{ padding: '9px 14px 6px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Select matter</div>
              {matters.map((m: any) => (
                <div key={m.id} onClick={() => addToMatter(m.id)} style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.06)', color: '#0f0f0f' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{m.type} · {m.status}</div>
                </div>
              ))}
            </>
          )}
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={() => setOpen(false)} style={{ fontSize: 12, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Save updated contract doc to matter ───────────────────────────────────────
// Uploads the .docx Blob to the PRIVATE matter-documents bucket in Supabase Storage.
// We store the storage PATH (not a public URL) — a signed URL is generated at
// download time and expires after 1 hour, so the file is never publicly accessible.
// Requires the matter-documents bucket to be set to PRIVATE in Supabase dashboard.
type SavedDocFile = { name: string; path: string; size: number; savedAt: string }

function SaveDocToMatter({ blob, docFilename, uid, token, supabase }: {
  blob: Blob; docFilename: string; uid: string; token: string; supabase: ReturnType<typeof import('@supabase/auth-helpers-nextjs').createClientComponentClient>
}) {
  const [open, setOpen] = useState(false)
  const [matters, setMatters] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  function loadMatters() {
    try { return JSON.parse(localStorage.getItem(`law_oss_matters_${uid}`) || '[]') } catch { return [] }
  }
  function saveMatters(m: any[]) {
    localStorage.setItem(`law_oss_matters_${uid}`, JSON.stringify(m))
    if (token) saveToCloud(token, 'matters', m)
  }

  function handleOpen() { setMatters(loadMatters()); setOpen(true); setSaved(false); setErr('') }

  async function saveToMatter(matterId: string, matterName: string) {
    setSaving(true); setErr('')
    try {
      const path = `${uid}/${matterId}/${Date.now()}-${docFilename}`
      const { error: upErr } = await supabase.storage.from('matter-documents').upload(path, blob, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: false,
      })
      if (upErr) throw new Error(upErr.message)
      // Store path only — signed URL is generated at download time (expires 1 hr)
      const savedDocFile: SavedDocFile = { name: docFilename, path, size: blob.size, savedAt: new Date().toISOString() }
      const chat = {
        id: Date.now().toString(),
        agentId: 'contracts',
        agentName: 'Contract Review',
        title: `Updated contract: ${docFilename}`,
        messages: [{ role: 'assistant', content: `✅ Updated contract saved.\n\n**File:** ${docFilename}` }],
        savedAt: new Date().toISOString(),
        savedDocFile,
      }
      const all = loadMatters()
      const updated = all.map((m: any) => m.id === matterId ? { ...m, savedChats: [chat, ...(m.savedChats || [])] } : m)
      saveMatters(updated)
      setSaved(true)
      setTimeout(() => setOpen(false), 900)
    } catch (e: any) {
      setErr(e.message || 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 7, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Save to matter
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 200, background: '#fff', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.13)', minWidth: 220, overflow: 'hidden' }}>
          {saved ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>✓ Saved to matter</div>
          ) : matters.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#888' }}>No matters yet. <a href="/dashboard/matters" style={{ color: '#0f0f0f', fontWeight: 600 }}>Create one</a>.</div>
          ) : (
            <>
              <div style={{ padding: '9px 14px 6px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Select matter</div>
              {err && <div style={{ padding: '6px 14px', fontSize: 12, color: '#b91c1c' }}>{err}</div>}
              {matters.map((m: any) => (
                <div key={m.id} onClick={() => !saving && saveToMatter(m.id, m.name)}
                  style={{ padding: '9px 14px', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', borderTop: '1px solid rgba(0,0,0,0.06)', color: saving ? '#aaa' : '#0f0f0f', opacity: saving ? 0.6 : 1 }}
                  onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#f5f5f5' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{m.type} · {m.status}</div>
                </div>
              ))}
            </>
          )}
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={() => setOpen(false)} style={{ fontSize: 12, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

type Risk = {
  title: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  clause: string
  risk: string
  fix: string
  accepted?: boolean
  rejected?: boolean
}

type StoredReview = {
  id: string
  filename: string
  createdAt: string
  risks: Risk[]
  docText?: string
}

let _uid = ''
const _tabId = Math.random().toString(36).slice(2)
function setUid(id: string) { _uid = id; localStorage.setItem('law_oss_uid', id) }
function userKey(base: string) { return `${base}_${_uid || _tabId}` }

function loadReviews(): StoredReview[] {
  try { return JSON.parse(localStorage.getItem(userKey('law_oss_contracts_v2')) || '[]') } catch { return [] }
}
function saveReviews(list: StoredReview[]) {
  localStorage.setItem(userKey('law_oss_contracts_v2'), JSON.stringify(list))
}

// Fuzzy match: normalise whitespace so PDF-extracted text (which collapses spaces) still matches
// BOUNDARY_RE — determines where one segment ends and the next begins.
// Matches: numbered sections (1. / 1) / 3.2 / 9.4.1 / 21.9)), lettered
// sub-clauses (a. / (a) / (i)), and all-caps headers of ≥ 10 chars (excludes
// short table cells like SELLER/BUYER/DATE). Intentionally broader than
// NUMBERED_ITEM_RE below.
// \d+(?:\.\d+)* matches flat (9.) AND decimal multi-level (9.4 / 9.4.1).
// NOTE: if you change this regex, check NUMBERED_ITEM_RE for consistency —
// they serve different purposes and must stay aligned.
const BOUNDARY_RE = /^(?:\*{1,2})?(\d+(?:\.\d+)*[\.\)]\s|[a-z][\.\)]\s|\([a-z]\)\s|\([ivxlc]+\)\s|[A-Z][A-Z ]{9,})/

// NUMBERED_ITEM_RE — detects strictly numeric/alphabetic section starts that
// mark the transition from pre-body (preamble/recitals) into the document body.
// Intentionally excludes all-caps headers (e.g. RECITALS, WHEREAS) because those
// can appear before the first numbered clause and are still pre-body content.
// \d+(?:\.\d+)* matches flat (9.) AND decimal multi-level (9.4 / 9.4.1).
// NOTE: if you change this regex, check BOUNDARY_RE for consistency —
// they serve different purposes and must stay aligned.
const NUMBERED_ITEM_RE = /^(?:\*{1,2})?(\d+(?:\.\d+)*[\.\)]\s|[a-z][\.\)]\s|\([a-z]\)\s|\([ivxlc]+\)\s)/

// Segments whose content starts with these phrases are never replaced, regardless
// of match score — protects signature blocks and schedule/exhibit headers.
const NON_REPLACEABLE_RE = /^(?:\*{1,2})?(in witness whereof|signature[s]?\s*[:\-]|signed by|executed by|schedule\s+\d|exhibit\s+[a-z\d])/i

function splitIntoSegments(text: string): Array<{ start: number; end: number; content: string; preBody: boolean }> {
  const lines = text.split('\n')
  const segments: Array<{ start: number; end: number; content: string; preBody: boolean }> = []
  let segStart = 0
  let segLines: string[] = []
  // preBody starts true and flips to false permanently once a strictly-numbered
  // item is seen — correctly handles preamble + RECITALS + WHEREAS as pre-body
  // even if RECITALS triggers a BOUNDARY_RE split of its own.
  let preBody = true

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    const isBoundary = BOUNDARY_RE.test(trimmed) && trimmed.length > 0
    if (isBoundary && segLines.length > 0) {
      segments.push({ start: segStart, end: i - 1, content: segLines.join('\n'), preBody })
      segStart = i
      segLines = []
    }
    // Flip preBody off as soon as we see a strictly-numbered line; never flips back
    if (NUMBERED_ITEM_RE.test(trimmed)) preBody = false
    segLines.push(lines[i])
  }
  if (segLines.length > 0) {
    segments.push({ start: segStart, end: lines.length - 1, content: segLines.join('\n'), preBody })
  }
  return segments
}

// Groups a numeric section header (e.g. "4. REPRESENTATIONS.") with all immediately
// following lettered/roman sub-clause segments into one super-segment. This lets
// fuzzyReplace replace a full section atomically when the AI's clause spans the whole
// section, while individual sub-clause segments still win for partial-clause matches.
// Bidirectional IDF scoring in fuzzyReplace determines which candidate wins.
function buildMergedSegments(
  segs: Array<{ start: number; end: number; content: string; preBody: boolean }>
): Array<{ start: number; end: number; content: string; preBody: boolean }> {
  const result: typeof segs = []
  let i = 0
  while (i < segs.length) {
    const seg = segs[i]
    if (/^(?:\*{1,2})?\d+[\.\)]\s+/.test(seg.content.trimStart())) {
      let j = i + 1
      while (j < segs.length && /^(\([a-z]\)|\([ivxlc]+\)|[a-z][\.\)]\s)/i.test(segs[j].content.trimStart())) {
        j++
      }
      if (j > i + 1) {
        result.push({ start: segs[i].start, end: segs[j - 1].end, content: segs.slice(i, j).map(s => s.content).join('\n'), preBody: segs[i].preBody })
        i = j; continue
      }
    }
    result.push(seg); i++
  }
  return result
}

function buildIDF(segments: Array<{ content: string }>): Map<string, number> {
  const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase().trim()
  const docFreq = new Map<string, number>()
  for (const seg of segments) {
    const words = new Set(norm(seg.content).split(' ').filter(w => w.length > 3))
    for (const w of words) docFreq.set(w, (docFreq.get(w) ?? 0) + 1)
  }
  const idf = new Map<string, number>()
  // log(N/freq): words appearing in every segment → 0; rare words → high weight
  for (const [word, freq] of docFreq) idf.set(word, Math.log(segments.length / freq))
  return idf
}

function scoreMatchIDF(
  segContent: string, clause: string,
  idf: Map<string, number>, totalSegs: number
): number {
  const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase().trim()
  const normSeg = norm(segContent)
  const normClause = norm(clause)
  if (normSeg.includes(normClause)) return 1.0
  const clauseWords = normClause.split(' ').filter(w => w.length > 3)
  if (clauseWords.length === 0) return 0
  const maxIdf = Math.log(totalSegs + 1)  // fallback weight for unseen words
  let weightedHits = 0, totalWeight = 0
  for (const w of clauseWords) {
    const weight = idf.get(w) ?? maxIdf
    totalWeight += weight
    if (normSeg.includes(w)) weightedHits += weight
  }
  return totalWeight > 0 ? weightedHits / totalWeight : 0
}

function fuzzyReplace(text: string, clause: string, fix: string): { result: string; matched: boolean } {
  // Option B: if the winning segment starts with a numeric section header (e.g. "4. "),
  // strip any leading number the AI may have included in the fix (per CASE 3 prompt) and
  // re-prepend the ORIGINAL section number — preserving the document's numbering scheme.
  const preserveNumPrefix = (segFirstLine: string, fixText: string): string => {
    // Captures flat (9. ) AND decimal (9.4 / 9.4.1 ) prefixes
    const m = /^(?:\*{1,2})?(\d+(?:\.\d+)*[\.\)]\s+)/.exec(segFirstLine.trim())
    if (!m) return fixText
    // Strip any leading number the AI put on the fix, then prepend the original
    return m[1] + fixText.trimStart().replace(/^\d+(?:\.\d+)*[\.\)]\s+/, '')
  }

  // Strategy 1: exact substring match — skipped for numeric-section-header clauses so
  // merged-segment scoring replaces the full section (header + sub-clauses atomically),
  // not just the header line. All other clauses still get the fast exact-match path.
  const clauseIsNumericSection = /^\d+(?:\.\d+)*[\.\)]\s+/.test(clause.trim())
  if (!clauseIsNumericSection && text.includes(clause)) {
    return { result: text.replace(clause, fix), matched: true }
  }

  // Strategy 2: bidirectional IDF harmonic-mean scoring over merged super-segments AND
  // individual segments together. Bidirectional prevents partial-match over-replacement:
  // clause covering only (a)+(b) of a 4-sub-clause section → merged scores 0.575 (rejected),
  // individual 4b scores 0.658 (wins). Full-section clause → merged ~1.0 vs individual ~0.35.
  // Paraphrased full-section ("carry out" not "perform") → merged 0.943, individual 0.344.
  // Combined partial+paraphrased → merged 0.575 (rejected), individual 4b 0.658 (wins).
  const segs = splitIntoSegments(text)
  const idf = buildIDF(segs)
  const N = segs.length
  const candidates = buildMergedSegments(segs)

  const bidirScore = (segContent: string): number => {
    const fwd = scoreMatchIDF(segContent, clause, idf, N)   // clause words found in seg
    const rev = scoreMatchIDF(clause, segContent, idf, N)   // seg words found in clause
    return (fwd + rev) > 0 ? 2 * fwd * rev / (fwd + rev) : 0
  }

  let bestScore = 0
  let bestSeg: typeof candidates[0] | null = null
  for (const seg of candidates) {
    if (NON_REPLACEABLE_RE.test(seg.content.trimStart())) continue
    if (seg.preBody) continue
    const score = bidirScore(seg.content)
    if (score > bestScore) { bestScore = score; bestSeg = seg }
  }

  if (!bestSeg || bestScore < 0.6) return { result: text, matched: false }

  const lines = text.split('\n')
  const effectiveFix = preserveNumPrefix(lines[bestSeg.start], fix)
  return {
    result: [...lines.slice(0, bestSeg.start), effectiveFix, ...lines.slice(bestSeg.end + 1)].join('\n'),
    matched: true,
  }
}

type DownloadResult = { applied: number; appended: number; failed: Risk[]; renumberWarning: boolean; blob: Blob; updatedFilename: string }
async function buildUpdatedContract(docText: string, risks: Risk[], filename: string): Promise<DownloadResult> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

  // Apply accepted fixes — preserve every character of the original; only swap the clause text
  let updated = docText
  const appended: Risk[] = []
  const notFound: Risk[] = []

  const isPlaceholderClause = (clause: string) => {
    const brackets = (clause.match(/\[[^\]]+\]/g) || []).join('').length
    return brackets / clause.length > 0.4
  }
  let appliedCount = 0
  for (const r of risks) {
    if (!r.accepted) continue
    if (!r.clause || r.clause.toLowerCase() === 'not present' || isPlaceholderClause(r.clause)) {
      appended.push(r)
    } else {
      const { result, matched } = fuzzyReplace(updated, r.clause, r.fix)
      if (matched) {
        updated = result
        appliedCount++
      } else {
        notFound.push(r)
      }
    }
  }

  // ── Fix A: insert new/missing accepted clauses before signature block ────────
  let renumberWarning = false
  if (appended.length > 0) {
    const lines = updated.split('\n')
    // Matches flat (9. TITLE) AND decimal (9.4 TITLE / 21.9 TITLE) section starts
    const numericSectionRe = /^(?:\*{1,2})?\d+(?:\.\d+)*[\.\)]\s+[A-Z]/
    const hasNumericSections = lines.some(l => numericSectionRe.test(l.trim()))

    // Detect whether the document uses decimal multi-level numbering (e.g. "9.4 Foo").
    // If so, auto-incrementing a flat integer is ambiguous — fall back to the manual marker.
    const hasDecimalNumbering = lines.some(l => /^(?:\*{1,2})?\d+\.\d+[\.\)]\s+[A-Z]/i.test(l.trim()))

    let maxSection = 0
    if (hasNumericSections && !hasDecimalNumbering) {
      // Only scan for maxSection when numbering is flat (9.) — safe to auto-increment
      for (const line of lines) {
        const m = /^(?:\*{1,2})?(\d+)[\.\)]\s+[A-Z]/.exec(line.trim())
        if (m) maxSection = Math.max(maxSection, parseInt(m[1]))
      }
    }

    // Find insertion point: first line matching a signature block header.
    // Covers: "IN WITNESS WHEREOF", "SIGNATURE PAGE", "SIGNATURES", "SIGNATURE BLOCK",
    // "SIGNED BY", "EXECUTED BY", "EXECUTION", "EXECUTION PAGE", "ATTESTATION",
    // "[SIGNATURE PAGE FOLLOWS]", and standalone lines of 3+ underscores (blank sig lines).
    const sigRe = /^(?:\*{1,2})?(in witness whereof|signature[s]?(\s+(page|block))?|signed by|executed by|execution(\s+page)?|attestation|\[signature[^\]]*\]|_{3,})/i
    let insertIdx = lines.length
    for (let i = 0; i < lines.length; i++) {
      if (sigRe.test(lines[i].trim())) { insertIdx = i; break }
    }

    const newLines: string[] = ['']
    for (const r of appended) {
      if (hasNumericSections && !hasDecimalNumbering) {
        // Flat numbering (9.) — safe to auto-increment
        maxSection++
        const fixTrimmed = r.fix.trimStart()
        // If the AI already prefixed a section number, use it; otherwise prepend ours
        const alreadyNumbered = /^\d+(?:\.\d+)*[\.\)]\s/.test(fixTrimmed)
        newLines.push(alreadyNumbered ? fixTrimmed : `${maxSection}. ${fixTrimmed}`)
      } else {
        // Decimal numbering (9.4) or non-numeric — auto-increment is ambiguous, use marker
        newLines.push('[NEW CLAUSE — RENUMBER MANUALLY]')
        newLines.push(r.fix.trimStart())
        renumberWarning = true
      }
      newLines.push('')
    }

    updated = [
      ...lines.slice(0, insertIdx),
      ...newLines,
      ...lines.slice(insertIdx),
    ].join('\n')
  }

  // ── Intermediate formatting fix (Bug 3 partial) ────────────────────────────
  // docx@9 is write-only — it cannot read existing files. True surgical
  // preservation of original paragraph spacing, fonts, and table structure
  // requires JSZip raw XML editing or server-side processing (future work).
  // This rebuild reapplies the most common contract formatting patterns so
  // the output looks close to the original.
  const TIGHT  = { before: 0, after: 0   }
  const BODY   = { before: 0, after: 120 }  // 6pt after each paragraph (blank-line paragraphs removed)
  const INDENT = { left: 720 }              // 0.5 inch for sub-clauses

  const SECTION_HDR_RE = /^(?:\*{1,2})?(\d+(?:\.\d+)*[\.\)]\s)(.+)/
  const SUBCLAUSE_RE   = /^(\([a-z]\)|\([ivxlc]+\)|[a-z][\.\)]\s)/i
  const ALLCAPS_HDR_RE = /^(?:\*{1,2})?[A-Z][A-Z ;]{9,}(?:\*{1,2})?$/
  // Tightened to known party/role words only — avoids bolding arbitrary short
  // all-caps text like "AND", "OR", "WHEREAS" from poorly-converted table cells.
  const TABLE_HDR_RE   = /^(?:\*{1,2})?(SELLER|BUYER|PARTY|PARTIES|DATE|NAME|SIGNATURE|WITNESS|GRANTOR|GRANTEE|VENDOR|PURCHASER|LESSOR|LESSEE|LICENSOR|LICENSEE|BORROWER|LENDER)(?:\*{1,2})?$/

  function buildRuns(raw: string, forceBold = false): any[] {
    // Normalize nested bold markers produced by mammoth's overlapping <strong> tags.
    // **"**Word**"** → **"Word"**: strip close+reopen ** around boundary punctuation.
    const normalized = raw
      .replace(/\*\*([\W_]{1,3})\*\*(\w)/g, '**$1$2')   // **"**W → **"W
      .replace(/(\w)\*\*([\W_]{1,3})\*\*/g, '$1$2**')    // s**"** → s"**
    const parts: any[] = []; const boldRe = /\*\*(.+?)\*\*/g
    let last = 0; let bm: RegExpExecArray | null
    while ((bm = boldRe.exec(normalized)) !== null) {
      if (bm.index > last) parts.push(new TextRun({ text: normalized.slice(last, bm.index), bold: forceBold }))
      parts.push(new TextRun({ text: bm[1], bold: true }))
      last = bm.index + bm[0].length
    }
    if (last < normalized.length) parts.push(new TextRun({ text: normalized.slice(last), bold: forceBold }))
    return parts.length ? parts : [new TextRun({ text: normalized, bold: forceBold })]
  }

  function textLine(raw: string): any {
    const t = raw.trimStart()
    if (t.startsWith('### ')) return new Paragraph({ text: t.slice(4), heading: HeadingLevel.HEADING_3, spacing: TIGHT })
    if (t.startsWith('## '))  return new Paragraph({ text: t.slice(3),  heading: HeadingLevel.HEADING_2, spacing: TIGHT })
    if (t.startsWith('# '))   return new Paragraph({ text: t.slice(2),  heading: HeadingLevel.HEADING_1, spacing: TIGHT })
    if (ALLCAPS_HDR_RE.test(t))
      return new Paragraph({ children: [new TextRun({ text: t.replace(/^\*{1,2}|\*{1,2}$/g, ''), bold: true })], heading: HeadingLevel.HEADING_2, spacing: TIGHT })
    if (TABLE_HDR_RE.test(t))
      return new Paragraph({ children: [new TextRun({ text: t.replace(/^\*{1,2}|\*{1,2}$/g, ''), bold: true })], spacing: BODY })
    if (SECTION_HDR_RE.test(t)) {
      // Strip ** to get plain text, find title boundary (number + ALL-CAPS/Title-Case phrase ending in "."),
      // then walk t (with ** markers) to the same split point, skipping marker chars.
      const plain = t.replace(/\*{1,2}/g, '')
      const hm = /^(\d+(?:\.\d+)*[\.\)]\s+[A-Z][^\n.]{2,60}?\.\s+)(\S.*)$/.exec(plain)
      if (hm) {
        const tl = hm[1].length
        let pc = 0, si = 0
        for (let i = 0; i < t.length; i++) { if (t[i] !== '*') { pc++; if (pc === tl) { si = i + 1; break } } }
        while (si < t.length && t[si] === '*') si++
        let bodySlice = t.slice(si)
        // Orphan guard: whole-clause bold (** closes at end of line, not after title) leaves
        // an unpaired closing ** in bodySlice. Strip it so no literal ** appears in output.
        if ((bodySlice.match(/\*\*/g) || []).length % 2 !== 0) bodySlice = bodySlice.replace(/\*\*(?=[^*]*$)/, '')
        // Space TextRun separates bold title from normal body (the \s+ in the title regex
        // consumed the separating space into group 1, so we re-add it explicitly).
        return new Paragraph({ children: [new TextRun({ text: plain.slice(0, tl).trimEnd(), bold: true }), new TextRun({ text: ' ' }), ...buildRuns(bodySlice, false)], spacing: BODY })
      }
      // No title found: force-bold for PDF (no **) or inline ** handling for DOCX
      return new Paragraph({ children: buildRuns(t, !t.includes('**')), spacing: BODY })
    }
    if (SUBCLAUSE_RE.test(t)) {
      // Detect sub-clause mini-header: "(a) Title Phrase. Body text" → bold label+title, normal body
      const plain = t.replace(/\*{1,2}/g, '')
      const sm = /^((?:\([a-z]+\)|[a-z][\.\)])\s+[A-Z][^\n.]{2,50}?\.\s+)(\S.*)$/i.exec(plain)
      if (sm) {
        const tl = sm[1].length
        let pc = 0, si = 0
        for (let i = 0; i < t.length; i++) { if (t[i] !== '*') { pc++; if (pc === tl) { si = i + 1; break } } }
        while (si < t.length && t[si] === '*') si++
        let bodySlice = t.slice(si)
        if ((bodySlice.match(/\*\*/g) || []).length % 2 !== 0) bodySlice = bodySlice.replace(/\*\*(?=[^*]*$)/, '')
        return new Paragraph({ children: [new TextRun({ text: plain.slice(0, tl).trimEnd(), bold: true }), new TextRun({ text: ' ' }), ...buildRuns(bodySlice, false)], indent: INDENT, spacing: BODY })
      }
      return new Paragraph({ children: buildRuns(raw), indent: INDENT, spacing: BODY })
    }
    if (/:\s*$/.test(t) && t.length < 60)
      return new Paragraph({ children: [new TextRun({ text: t, bold: true })], spacing: BODY })
    return new Paragraph({ children: buildRuns(raw), spacing: BODY })
  }

  const children: any[] = []
  for (const line of updated.split('\n')) {
    if (!line.trim()) continue  // skip blank lines — BODY paragraph spacing provides separation
    // Split mid-line sub-clause markers into separate lines so each (a)/(b)/(i)/(ii)/etc.
    // gets its own indented paragraph regardless of whether the source had a line break there.
    // Pattern covers single-letter (a)-(z) and roman-numeral sub-clauses (i)-(viii) etc.
    for (const sub of line.split(/\s+(?=(?:\([a-z]\)|\([ivxlcdm]{1,6}\))\s)/i)) {
      if (sub.trim()) children.push(textLine(sub))
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  const base = filename.replace(/\.[^.]+$/, '')
  const updatedFilename = `${base}-updated.docx`
  return { applied: appliedCount, appended: appended.length, failed: notFound, renumberWarning, blob, updatedFilename }
}

// Extracts text from a single pdf.js page with line/paragraph detection.
// transform[5] = y-coordinate (PDF points, increasing upward on page).
// dy < 1          → same line       → space-join (always add space to handle
//                                     PDFs without embedded trailing spaces)
// dy < 1.5×lh     → new line        → \n
// dy ≥ 1.5×lh     → paragraph gap   → \n\n
// lineHeight is estimated from the median non-zero item.height for this page;
// falls back to 12pt for scanned/image PDFs that have no text items.
function extractPageText(items: any[]): string {
  if (items.length === 0) return ''
  const heights = items.map((it: any) => it.height ?? 0).filter((h: number) => h > 0).sort((a: number, b: number) => a - b)
  const lineHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 12
  let out = ''
  let prevY: number | null = null
  for (const item of items) {
    const str: string = item.str ?? ''
    if (!str) continue
    const y: number = item.transform[5]
    if (prevY === null) {
      out += str
    } else {
      const dy = prevY - y
      if (dy < 1) {
        out += ' ' + str            // same line — always space for safety
      } else if (dy < lineHeight * 1.5) {
        out += '\n' + str           // normal line break
      } else {
        out += '\n\n' + str         // paragraph / section break
      }
    }
    prevY = y
  }
  return out
}

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    return await file.text()
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist')
    // Derive worker URL from the actual bundled version to prevent API/Worker mismatch
    const pdfjsVersion = pdfjsLib.version ?? '4.10.38'
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`
    const ab = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const items = ((await page.getTextContent()).items || []) as any[]
      text += extractPageText(items) + '\n\n'
    }
    return text
  }
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    const mammoth = await import('mammoth')
    const ab = await file.arrayBuffer()
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: ab })
    // Convert HTML to markdown-style text preserving bold and headings
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, (_, t) => `# ${t.replace(/<[^>]+>/g, '')}\n`)
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, (_, t) => `## ${t.replace(/<[^>]+>/g, '')}\n`)
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, (_, t) => `### ${t.replace(/<[^>]+>/g, '')}\n`)
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, (_, t) => `**${t}**`)
      .replace(/<b[^>]*>(.*?)<\/b>/gi, (_, t) => `**${t}**`)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT.')
}

const SEV: Record<string, { bg: string; border: string; badge: string; text: string; dot: string }> = {
  CRITICAL: { bg: '#fff1f2', border: '#fecdd3', badge: '#fda4af', text: '#be123c', dot: '#f43f5e' },
  HIGH:     { bg: '#fff7ed', border: '#fed7aa', badge: '#fdba74', text: '#c2410c', dot: '#f97316' },
  MEDIUM:   { bg: '#fefce8', border: '#fde68a', badge: '#fde047', text: '#854d0e', dot: '#eab308' },
  LOW:      { bg: '#f0fdf4', border: '#bbf7d0', badge: '#86efac', text: '#15803d', dot: '#22c55e' },
}

function RiskCard({
  risk, index, onAccept, onReject,
}: {
  risk: Risk; index: number
  onAccept: () => void; onReject: () => void
}) {
  const [open, setOpen] = useState(true)
  const s = SEV[risk.severity] || SEV.LOW
  const accepted = !!risk.accepted
  const rejected = !!risk.rejected

  return (
    <div style={{
      border: `1.5px solid ${accepted ? '#86efac' : rejected ? '#fca5a5' : s.border}`,
      borderRadius: 12,
      background: accepted ? '#f0fdf4' : rejected ? '#fff1f2' : '#fff',
      marginBottom: 10,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header row */}
      <div
        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        {/* Severity dot */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accepted ? '#22c55e' : rejected ? '#ef4444' : s.dot, flexShrink: 0 }} />

        {/* Severity badge */}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
          background: accepted ? '#dcfce7' : rejected ? '#fee2e2' : s.badge + '66',
          color: accepted ? '#15803d' : rejected ? '#b91c1c' : s.text,
          letterSpacing: '0.05em', flexShrink: 0,
        }}>
          {accepted ? 'ACCEPTED' : rejected ? 'REJECTED' : risk.severity}
        </span>

        {/* Title */}
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f0f0f', flex: 1 }}>{risk.title}</span>

        {/* Accept / Reject */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={onAccept}
            style={{
              padding: '5px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: accepted ? '#16a34a' : '#fff',
              color: accepted ? '#fff' : '#16a34a',
              border: `1.5px solid ${accepted ? '#16a34a' : '#86efac'}`,
              transition: 'all 0.15s',
            }}
          >
            {accepted ? '✓ Accepted' : 'Accept fix'}
          </button>
          <button
            onClick={onReject}
            style={{
              padding: '5px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: rejected ? '#dc2626' : '#fff',
              color: rejected ? '#fff' : '#dc2626',
              border: `1.5px solid ${rejected ? '#dc2626' : '#fca5a5'}`,
              transition: 'all 0.15s',
            }}
          >
            {rejected ? '✕ Rejected' : 'Reject'}
          </button>
        </div>

        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Why it's risky */}
          <div style={{ padding: '9px 12px', background: `${s.bg}`, border: `1px solid ${s.border}`, borderRadius: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: s.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚠ Why this is risky
            </div>
            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.55 }}>{risk.risk}</div>
          </div>

          {/* Current clause */}
          {risk.clause && risk.clause.toLowerCase() !== 'not present' && (
            <div style={{ padding: '9px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#b91c1c', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Current clause
              </div>
              <div style={{ fontSize: 12.5, color: '#555', fontStyle: 'italic', lineHeight: 1.6 }}>{risk.clause}</div>
            </div>
          )}
          {risk.clause && risk.clause.toLowerCase() === 'not present' && (
            <div style={{ fontSize: 12.5, color: '#aaa', fontStyle: 'italic' }}>This clause is missing from the contract.</div>
          )}

          {/* Suggested fix */}
          {risk.fix && (
            <div style={{ padding: '9px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803d', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ✓ Suggested fix
              </div>
              <div style={{ fontSize: 12.5, color: '#1a1a1a', lineHeight: 1.6 }}>{risk.fix}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ContractsPage() {
  const [stored, setStored] = useState<StoredReview[]>([])
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')  // 'reading' | 'reviewing' | ''
  const [risks, setRisks] = useState<Risk[]>([])
  const [filename, setFilename] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [docText, setDocText] = useState('')
  const [pdfDebugText, setPdfDebugText] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [lastBlobFilename, setLastBlobFilename] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uid, setUidState] = useState('')
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    // Set uid FIRST so userKey() returns the correct namespaced key
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUid(session.user.id)
        setUidState(session.user.id)
        const token = session.access_token
        setAuthToken(token)
        const cloud = await loadAllFromCloud(token)
        if (cloud.contracts && cloud.contracts.length > 0) {
          saveReviews(cloud.contracts)
          setStored(cloud.contracts)
        } else {
          setStored(loadReviews())
        }
      } else {
        setStored(loadReviews())
      }
    })
  }, [])

  function persistReviewsToCloud(next: StoredReview[]) {
    saveReviews(next)
    if (authToken) saveToCloud(authToken, 'contracts', next)
  }

  function persistRisks(id: string, updated: Risk[]) {
    const all = loadReviews()
    const next = all.map(r => r.id === id ? { ...r, risks: updated } : r)
    persistReviewsToCloud(next)
    setStored(next)
  }

  function handleAccept(idx: number) {
    const updated = risks.map((r, i) => i === idx ? { ...r, accepted: !r.accepted, rejected: false } : r)
    setRisks(updated)
    if (currentId) persistRisks(currentId, updated)
  }

  function handleReject(idx: number) {
    const updated = risks.map((r, i) => i === idx ? { ...r, rejected: !r.rejected, accepted: false } : r)
    setRisks(updated)
    if (currentId) persistRisks(currentId, updated)
  }

  async function handleFile(file: File) {
    const apiKey = localStorage.getItem(userKey('law_oss_api_key')) || ''
    const apiProvider = localStorage.getItem(userKey('law_oss_provider')) || 'claude'
    if (!apiKey) { setError('No API key configured. Add one in Settings.'); return }

    setError(''); setBusy(true); setRisks([]); setCurrentId(null); setFilename(file.name); setDocText('')
    setStage('reading')

    let extracted = ''
    try { extracted = await extractText(file) }
    catch (e: any) { setError(e.message); setBusy(false); setStage(''); return }

    // ?pdfDebug=1 — show raw extracted text with visible line markers before AI sees it
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pdfDebug') === '1') {
      setPdfDebugText(extracted)
      setBusy(false); setStage(''); return
    }

    setDocText(extracted)
    setStage('reviewing')

    const SYSTEM = `You are a contract risk analyst with expertise in both US and UK/English law. Review the contract and identify every risky, unusual, one-sided, or missing clause.

Apply the following legal frameworks as appropriate:
- US contracts: UCC Article 2 (goods), Restatement (Second) of Contracts, federal law, and relevant state law (NY, CA, DE, TX, FL common defaults)
- UK/English contracts: Sale of Goods Act, Consumer Rights Act, Unfair Contract Terms Act (UCTA), common law
- International: CISG where applicable, choice-of-law provisions
- Flag jurisdiction-specific risks (e.g. non-compete enforceability varies by US state; penalty clauses void in England & Wales)

Output ONLY a valid JSON array. No prose, no markdown fences, no explanation. Start with [ and end with ].

Each item must be:
{
  "title": "Short clause title",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "clause": "Copy the clause CHARACTER-FOR-CHARACTER, exactly as it appears in the contract text provided. Do NOT paraphrase, summarise, shorten, or reconstruct. If the clause does not exist in the document, use 'Not present'.",
  "risk": "One sentence explaining why this is risky (cite applicable statute or common law doctrine if relevant)",
  "fix": "Write the COMPLETE, FINAL text ready to be inserted verbatim into the contract. Two cases apply — choose the right one:\n\nCASE 1 — Clauses you can fully draft (indemnification, governing law, reps and warranties, boilerplate): write finished, binding legal language with numbered/lettered subsections, defined terms, and operative words exactly as they would appear in a signed agreement. NEVER write a description or instruction about what the clause should say. BAD EXAMPLE: 'Add an indemnification clause covering direct losses and third-party claims.' GOOD EXAMPLE: '9. INDEMNIFICATION. (a) Each party (the Indemnifying Party) shall defend, indemnify, and hold harmless the other party and its officers, directors, employees, and agents from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys fees) arising out of or relating to: (i) any breach of this Agreement; (ii) the negligence or willful misconduct of the Indemnifying Party; or (iii) infringement of third-party intellectual property rights by the Indemnifying Party. (b) The Indemnified Party shall promptly notify the Indemnifying Party in writing of any claim and grant sole control of its defense.'\n\nCASE 2 — Blanks requiring party-specific facts you cannot know (closing location, dollar amounts, named individuals, specific dates): do NOT describe what should go there. Instead, insert a blank using the same placeholder convention already used elsewhere in this document (typically underscores, e.g. __________). Write the surrounding clause language in full, leaving only the unknown fact as a blank. BAD EXAMPLE: 'Insert the agreed closing location here.' GOOD EXAMPLE: 'Closing shall occur at __________, on __________, 20__.'\n\nSECTION NUMBER RULE (applies to all fixes): NEVER start the fix text with a numeric section number (e.g. do NOT write '4.' or '9.' at the beginning). Start from the section TITLE directly (e.g. 'INDEMNIFICATION.' or 'REPRESENTATIONS AND WARRANTIES.'). The system automatically preserves the original section number for replacements and assigns the next available number for new clauses. BAD: '9. INDEMNIFICATION. (a) Each party...' GOOD: 'INDEMNIFICATION. (a) Each party...'"
}

CRITICAL: The "clause" field must be a verbatim copy-paste from the contract. The system will search for this exact string to perform replacements — any deviation will cause the replacement to fail.

Flag 5–20 genuine risks.`

    const userMsg = `CONTRACT: ${file.name}\n\n${extracted}`

    try {
      let fullText = ''

      if (apiProvider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: userMsg }] }],
            generationConfig: { maxOutputTokens: 16000, temperature: 0.1 },
          }),
        })
        const d = await res.json() as any
        if (d.error) { setError(d.error.message || 'Gemini error'); setBusy(false); setStage(''); return }
        fullText = d.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
      } else {
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
            max_tokens: 16000,
            stream: true,
            system: SYSTEM,
            messages: [{ role: 'user', content: userMsg }],
          }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({})) as any
          setError(e.error?.message || `Error ${res.status}`)
          setBusy(false); setStage(''); return
        }
        const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
        while (true) {
          const { done, value } = await reader.read(); if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim(); if (!raw || raw === '[DONE]') continue
            try {
              const p = JSON.parse(raw)
              if (p.type === 'content_block_delta' && p.delta?.text) fullText += p.delta.text
            } catch {}
          }
        }
      }

      // Parse JSON array
      let parsed: Risk[] = []
      try {
        // Strip markdown code fences the model sometimes wraps JSON in
        const stripped = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
        // Bracket-depth extraction — finds the outermost [ ... ] by counting depth,
        // immune to stray ] characters inside fix-field text or trailing prose.
        const arrStart = stripped.indexOf('[')
        if (arrStart !== -1) {
          let depth = 0, arrEnd = -1
          for (let ci = arrStart; ci < stripped.length; ci++) {
            if (stripped[ci] === '[') depth++
            else if (stripped[ci] === ']') { depth--; if (depth === 0) { arrEnd = ci; break } }
          }
          if (arrEnd !== -1) {
            parsed = (JSON.parse(stripped.slice(arrStart, arrEnd + 1)) as any[]).map(r => ({
              title: r.title || 'Untitled risk',
              severity: (['CRITICAL','HIGH','MEDIUM','LOW'] as const).includes(r.severity) ? r.severity : 'MEDIUM',
              clause: r.clause || '',
              risk: r.risk || '',
              fix: r.fix || '',
              accepted: false,
              rejected: false,
            }))
          }
        }
      } catch { parsed = [] }

      if (parsed.length === 0) {
        setError('Could not parse risk analysis. Please try again.')
        setBusy(false); setStage(''); return
      }

      setRisks(parsed)
      const id = Math.random().toString(36).slice(2)
      setCurrentId(id)
      const review: StoredReview = { id, filename: file.name, createdAt: new Date().toISOString(), risks: parsed, docText: extracted }
      const all = loadReviews()
      const next = [review, ...all]; persistReviewsToCloud(next); setStored(next)
      setBusy(false); setStage('')
    } catch (e: any) {
      setError(e.message || 'Review failed')
      setBusy(false); setStage('')
    }
  }

  function loadReview(review: StoredReview) {
    setRisks(review.risks || [])
    setFilename(review.filename)
    setCurrentId(review.id)
    setDocText(review.docText || '')
    setShowHistory(false)
    setError('')
  }

  function deleteReview(id: string) {
    const next = loadReviews().filter(r => r.id !== id)
    persistReviewsToCloud(next); setStored(next)
    if (currentId === id) { setRisks([]); setCurrentId(null) }
  }

  const accepted = risks.filter(r => r.accepted).length
  const rejected = risks.filter(r => r.rejected).length
  const reviewed = accepted + rejected
  const criticalCount = risks.filter(r => r.severity === 'CRITICAL').length
  const highCount = risks.filter(r => r.severity === 'HIGH').length

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>

      {/* ?pdfDebug=1 overlay — remove after verifying line/paragraph extraction */}
      {pdfDebugText !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', overflow: 'auto', padding: 24 }} onClick={() => setPdfDebugText(null)}>
          <div style={{ background: '#0f0f0f', borderRadius: 10, padding: 24, maxWidth: 900, margin: '0 auto', color: '#e0e0e0', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 12, color: '#d4a843', fontWeight: 700, fontSize: 13 }}>
              PDF DEBUG — raw extracted text (click anywhere to dismiss)
              <span style={{ marginLeft: 16, color: '#888', fontWeight: 400 }}>↵ = \n  ¶ = \n\n</span>
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {pdfDebugText.replace(/\n\n/g, ' ¶\n\n').replace(/\n/g, ' ↵\n')}
            </pre>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0f0f', margin: 0 }}>Contract Review</h1>
          <p style={{ fontSize: 13.5, color: '#888', margin: '4px 0 0' }}>
            Upload a contract — AI flags every risky clause, you accept or reject each fix.
          </p>
        </div>
        {stored.length > 0 && (
          <button
            onClick={() => setShowHistory(h => !h)}
            style={{ padding: '7px 14px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, background: '#fff', fontSize: 13, color: '#555', cursor: 'pointer', fontWeight: 500 }}
          >
            {showHistory ? 'Hide history' : `History (${stored.length})`}
          </button>
        )}
      </div>

      {/* History panel */}
      {showHistory && stored.length > 0 && (
        <div style={{ marginBottom: 20, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, overflow: 'hidden' }}>
          {stored.map(r => (
            <div key={r.id} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f0f0f' }}>{r.filename}</div>
                <div style={{ fontSize: 11.5, color: '#aaa' }}>{new Date(r.createdAt).toLocaleString()} · {r.risks.length} risks</div>
              </div>
              <button onClick={() => loadReview(r)} style={{ padding: '4px 12px', border: 'none', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Load</button>
              <button onClick={() => deleteReview(r.id)} style={{ padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#b91c1c' }}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !busy) handleFile(f) }}
        onDragOver={e => e.preventDefault()}
        onClick={() => !busy && fileRef.current?.click()}
        style={{
          border: `2px dashed ${busy ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.18)'}`,
          borderRadius: 12, padding: '32px 24px', textAlign: 'center',
          cursor: busy ? 'not-allowed' : 'pointer',
          background: busy ? '#f5f5f5' : '#fafafa',
          marginBottom: 20, transition: 'all 0.2s',
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

        {busy ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"
                style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>
                {stage === 'reading' ? 'Reading document...' : 'Reviewing contract for risks...'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#aaa' }}>
              {stage === 'reviewing' ? 'Analysing every clause — this takes 15–30 seconds' : ''}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, color: '#555', fontWeight: 600 }}>Drop your contract here, or click to upload</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>PDF, Word (.docx), TXT</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13.5, color: '#b91c1c', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {risks.length > 0 && (
        <div>
          {/* Summary bar */}
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fff', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f0f0f' }}>{filename}</div>
            <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
              {criticalCount > 0 && <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 12, background: '#fda4af66', color: '#be123c', fontWeight: 700 }}>{criticalCount} CRITICAL</span>}
              {highCount > 0 && <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 12, background: '#fdba7466', color: '#c2410c', fontWeight: 700 }}>{highCount} HIGH</span>}
              <span style={{ fontSize: 12, color: '#888' }}>{risks.length} total risks</span>
            </div>
            <div style={{ fontSize: 12.5, color: reviewed === risks.length ? '#15803d' : '#888', fontWeight: reviewed === risks.length ? 700 : 400 }}>
              {reviewed}/{risks.length} reviewed
            </div>
            {accepted > 0 && docText && (
              <button
                onClick={async () => { setGenerating(true); const r = await buildUpdatedContract(docText, risks, filename); const u = URL.createObjectURL(r.blob); const a = document.createElement('a'); a.href = u; a.download = r.updatedFilename; a.click(); URL.revokeObjectURL(u); setLastBlob(r.blob); setLastBlobFilename(r.updatedFilename); setDownloadResult(r); setGenerating(false) }}
                disabled={generating}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: 'none', borderRadius: 8, background: generating ? '#e5e5e5' : '#0f0f0f', color: generating ? '#999' : '#fff', fontSize: 12.5, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}
              >
                {generating ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                )}
                {generating ? 'Generating...' : `Download updated contract (${accepted} fix${accepted > 1 ? 'es' : ''})`}
              </button>
            )}
            {lastBlob && uid && (
              <SaveDocToMatter blob={lastBlob} docFilename={lastBlobFilename} uid={uid} token={authToken ?? ''} supabase={supabase} />
            )}
            {downloadResult && !generating && (
              <div style={{ fontSize: 12, lineHeight: 1.7, marginTop: 2 }}>
                <span style={{ color: '#15803d' }}>✓ {downloadResult.applied} replaced · {downloadResult.appended} inserted</span>
                {downloadResult.failed.length > 0 && (
                  <span style={{ color: '#dc2626', marginLeft: 10 }}>✗ {downloadResult.failed.length} could not be applied: {downloadResult.failed.map(f => f.title).join(', ')} — edit manually</span>
                )}
                {downloadResult.renumberWarning && (
                  <span style={{ color: '#d97706', marginLeft: 10 }}>⚠ Non-standard numbering — new clauses marked [NEW CLAUSE — RENUMBER MANUALLY]</span>
                )}
              </div>
            )}
          </div>

          {/* Risk cards */}
          {risks.map((r, i) => (
            <RiskCard
              key={i}
              risk={r}
              index={i}
              onAccept={() => handleAccept(i)}
              onReject={() => handleReject(i)}
            />
          ))}

          {/* All done banner */}
          {reviewed === risks.length && risks.length > 0 && (
            <div style={{ marginTop: 16, padding: '14px 20px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>Review complete</div>
                <div style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>{accepted} fixes accepted · {rejected} rejected</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {accepted > 0 && docText && (
                  <button
                    onClick={async () => { setGenerating(true); const r = await buildUpdatedContract(docText, risks, filename); const u = URL.createObjectURL(r.blob); const a = document.createElement('a'); a.href = u; a.download = r.updatedFilename; a.click(); URL.revokeObjectURL(u); setLastBlob(r.blob); setLastBlobFilename(r.updatedFilename); setDownloadResult(r); setGenerating(false) }}
                    disabled={generating}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {generating ? 'Generating...' : 'Download updated contract'}
                  </button>
                )}
                {lastBlob && uid && (
                  <SaveDocToMatter blob={lastBlob} docFilename={lastBlobFilename} uid={uid} token={authToken ?? ''} supabase={supabase} />
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ padding: '8px 18px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: '#fff', color: '#0f0f0f', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Upload another
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
