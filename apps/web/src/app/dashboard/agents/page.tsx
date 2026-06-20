'use client'
import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { saveToCloud } from '../../../lib/sync'
import LogoLoader from '../../../components/LogoLoader'
import MarkdownRenderer from '../../../components/MarkdownRenderer'

type Msg = { role: 'user' | 'assistant'; content: string }
type AttachedDoc = { name: string; text: string }
type Risk = { title: string; severity: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'; clause: string; risk: string; fix: string; accepted?: boolean; rejected?: boolean }

const SEV: Record<string, { bg: string; border: string; badge: string; text: string; dot: string }> = {
  CRITICAL: { bg: '#fff1f2', border: '#fecdd3', badge: '#fda4af', text: '#be123c', dot: '#f43f5e' },
  HIGH:     { bg: '#fff7ed', border: '#fed7aa', badge: '#fdba74', text: '#c2410c', dot: '#f97316' },
  MEDIUM:   { bg: '#fefce8', border: '#fde68a', badge: '#fde047', text: '#854d0e', dot: '#eab308' },
  LOW:      { bg: '#f0fdf4', border: '#bbf7d0', badge: '#86efac', text: '#15803d', dot: '#22c55e' },
}

function AgentRiskCard({ risk, onAccept, onReject }: { risk: Risk; onAccept: () => void; onReject: () => void }) {
  const [open, setOpen] = useState(true)
  const s = SEV[risk.severity] || SEV.LOW
  return (
    <div style={{ border: `1.5px solid ${risk.accepted ? '#86efac' : risk.rejected ? '#fca5a5' : s.border}`, borderRadius: 10, background: risk.accepted ? '#f0fdf4' : risk.rejected ? '#fff1f2' : '#fff', marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: risk.accepted ? '#22c55e' : risk.rejected ? '#ef4444' : s.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 12, background: risk.accepted ? '#dcfce7' : risk.rejected ? '#fee2e2' : s.badge + '66', color: risk.accepted ? '#15803d' : risk.rejected ? '#b91c1c' : s.text, letterSpacing: '0.05em', flexShrink: 0 }}>
          {risk.accepted ? 'ACCEPTED' : risk.rejected ? 'REJECTED' : risk.severity}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f0f0f', flex: 1 }}>{risk.title}</span>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={onAccept} style={{ padding: '4px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: risk.accepted ? '#16a34a' : '#fff', color: risk.accepted ? '#fff' : '#16a34a', border: `1.5px solid ${risk.accepted ? '#16a34a' : '#86efac'}` }}>
            {risk.accepted ? '✓ Accepted' : 'Accept'}
          </button>
          <button onClick={onReject} style={{ padding: '4px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: risk.rejected ? '#dc2626' : '#fff', color: risk.rejected ? '#fff' : '#dc2626', border: `1.5px solid ${risk.rejected ? '#dc2626' : '#fca5a5'}` }}>
            {risk.rejected ? '✕ Rejected' : 'Reject'}
          </button>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
      </div>
      {open && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ padding: '8px 10px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 7 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: s.text, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠ Why risky</div>
            <div style={{ fontSize: 12.5, color: '#333', lineHeight: 1.5 }}>{risk.risk}</div>
          </div>
          {risk.clause && risk.clause.toLowerCase() !== 'not present' && (
            <div style={{ padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current clause</div>
              <div style={{ fontSize: 12, color: '#555', fontStyle: 'italic', lineHeight: 1.5 }}>{risk.clause}</div>
            </div>
          )}
          {risk.fix && (
            <div style={{ padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>✓ Suggested fix</div>
              <div style={{ fontSize: 12, color: '#1a1a1a', lineHeight: 1.5 }}>{risk.fix}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// BOUNDARY_RE — segment splitting. See contracts/page.tsx for full commentary.
// NOTE: if you change this, check NUMBERED_ITEM_RE below for consistency.
const BOUNDARY_RE_A = /^(\d+[\.\)]\s|[a-z][\.\)]\s|\([a-z]\)\s|\([ivxlc]+\)\s|[A-Z][A-Z ]{9,})/
// NUMBERED_ITEM_RE — pre-body detection only (not segment splitting).
// NOTE: if you change this, check BOUNDARY_RE_A above for consistency.
const NUMBERED_ITEM_RE_A = /^(\d+[\.\)]\s|[a-z][\.\)]\s|\([a-z]\)\s|\([ivxlc]+\)\s)/
const NON_REPLACEABLE_RE_A = /^(in witness whereof|signature[s]?\s*[:\-]|signed by|executed by|schedule\s+\d|exhibit\s+[a-z\d])/i

function splitSegments(text: string): Array<{ start: number; end: number; content: string; preBody: boolean }> {
  const lines = text.split('\n')
  const segs: Array<{ start: number; end: number; content: string; preBody: boolean }> = []
  let segStart = 0; let segLines: string[] = []; let preBody = true
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (BOUNDARY_RE_A.test(t) && t.length > 0 && segLines.length > 0) {
      segs.push({ start: segStart, end: i - 1, content: segLines.join('\n'), preBody })
      segStart = i; segLines = []
    }
    if (NUMBERED_ITEM_RE_A.test(t)) preBody = false
    segLines.push(lines[i])
  }
  if (segLines.length > 0) segs.push({ start: segStart, end: lines.length - 1, content: segLines.join('\n'), preBody })
  return segs
}

function buildSegmentIDF(segs: Array<{ content: string }>): Map<string, number> {
  const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase().trim()
  const df = new Map<string, number>()
  for (const s of segs) {
    const words = new Set(norm(s.content).split(' ').filter(w => w.length > 3))
    for (const w of words) df.set(w, (df.get(w) ?? 0) + 1)
  }
  const idf = new Map<string, number>()
  for (const [w, freq] of df) idf.set(w, Math.log(segs.length / freq))
  return idf
}

function scoreIDF(segContent: string, clause: string, idf: Map<string, number>, N: number): number {
  const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase().trim()
  const normSeg = norm(segContent); const normClause = norm(clause)
  if (normSeg.includes(normClause)) return 1.0
  const words = normClause.split(' ').filter(w => w.length > 3)
  if (words.length === 0) return 0
  const maxIdf = Math.log(N + 1)
  let hits = 0, total = 0
  for (const w of words) {
    const wt = idf.get(w) ?? maxIdf
    total += wt
    if (normSeg.includes(w)) hits += wt
  }
  return total > 0 ? hits / total : 0
}

type AgentDownloadResult = { applied: number; appended: number; failed: Risk[]; renumberWarning: boolean }

function fuzzyReplace(text: string, clause: string, fix: string): { result: string; matched: boolean } {
  if (text.includes(clause)) return { result: text.replace(clause, fix), matched: true }
  const segs = splitSegments(text)
  const idf = buildSegmentIDF(segs)
  let bestScore = 0; let bestIdx = -1
  for (let i = 0; i < segs.length; i++) {
    if (NON_REPLACEABLE_RE_A.test(segs[i].content.trimStart())) continue
    if (segs[i].preBody) continue
    const score = scoreIDF(segs[i].content, clause, idf, segs.length)
    if (score > bestScore) { bestScore = score; bestIdx = i }
  }
  if (bestIdx === -1 || bestScore < 0.6) return { result: text, matched: false }
  const lines = text.split('\n'); const seg = segs[bestIdx]
  return { result: [...lines.slice(0, seg.start), fix, ...lines.slice(seg.end + 1)].join('\n'), matched: true }
}

async function downloadUpdatedContract(docText: string, risks: Risk[], filename: string): Promise<AgentDownloadResult> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  let updated = docText
  const appended: Risk[] = []; const notFound: Risk[] = []
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
      if (matched) { updated = result; appliedCount++ } else notFound.push(r)
    }
  }

  // Insert new/missing clauses before signature block
  let renumberWarning = false
  if (appended.length > 0) {
    const lines = updated.split('\n')
    const hasNumeric = lines.some(l => /^\d+[\.\)]\s+[A-Z]/.test(l.trim()))
    let maxSection = 0
    if (hasNumeric) {
      for (const l of lines) { const m = /^(\d+)[\.\)]\s+[A-Z]/.exec(l.trim()); if (m) maxSection = Math.max(maxSection, parseInt(m[1])) }
    }
    const sigRe = /^(in witness whereof|signatures?\s*:|signed by|executed by)/i
    let insertIdx = lines.length
    for (let i = 0; i < lines.length; i++) { if (sigRe.test(lines[i].trim())) { insertIdx = i; break } }
    const newLines: string[] = ['']
    for (const r of appended) {
      if (hasNumeric) {
        maxSection++
        const ft = r.fix.trimStart()
        newLines.push(/^\d+[\.\)]\s/.test(ft) ? ft : `${maxSection}. ${ft}`)
      } else { newLines.push('[NEW CLAUSE — RENUMBER MANUALLY]'); newLines.push(r.fix.trimStart()); renumberWarning = true }
      newLines.push('')
    }
    updated = [...lines.slice(0, insertIdx), ...newLines, ...lines.slice(insertIdx)].join('\n')
  }

  const TIGHT = { before: 0, after: 0 }; const GAP = { before: 0, after: 100 }
  function textLine(raw: string): any {
    const t = raw.trimStart()
    if (t.startsWith('### ')) return new Paragraph({ text: t.slice(4), heading: HeadingLevel.HEADING_3, spacing: TIGHT })
    if (t.startsWith('## '))  return new Paragraph({ text: t.slice(3),  heading: HeadingLevel.HEADING_2, spacing: TIGHT })
    if (t.startsWith('# '))   return new Paragraph({ text: t.slice(2),  heading: HeadingLevel.HEADING_1, spacing: TIGHT })
    const parts: any[] = []; const boldRe = /\*\*(.+?)\*\*/g; let last = 0; let m: RegExpExecArray | null
    while ((m = boldRe.exec(raw)) !== null) {
      if (m.index > last) parts.push(new TextRun(raw.slice(last, m.index)))
      parts.push(new TextRun({ text: m[1], bold: true })); last = m.index + m[0].length
    }
    if (last < raw.length) parts.push(new TextRun(raw.slice(last)))
    return new Paragraph({ children: parts.length ? parts : [new TextRun(raw)], spacing: TIGHT })
  }
  const children: any[] = []
  for (const line of updated.split('\n')) {
    if (!line.trim()) { children.push(new Paragraph({ text: '', spacing: GAP })); continue }
    children.push(textLine(line))
  }
  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const base = filename.replace(/\.[^.]+$/, '')
  a.href = url; a.download = `${base}-updated.docx`; a.click()
  URL.revokeObjectURL(url)
  return { applied: appliedCount, appended: appended.length, failed: notFound, renumberWarning }
}

async function downloadAcceptedFixes(risks: Risk[]) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const accepted = risks.filter(r => r.accepted)
  const children: any[] = [
    new Paragraph({ text: 'Accepted Contract Fixes', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `${accepted.length} fix${accepted.length !== 1 ? 'es' : ''} accepted — apply these changes to your contract`, children: [new TextRun({ text: `${accepted.length} fix${accepted.length !== 1 ? 'es' : ''} accepted — apply these changes to your contract`, color: '555555' })] }),
    new Paragraph({ text: '' }),
  ]
  for (const r of accepted) {
    children.push(new Paragraph({ text: r.title, heading: HeadingLevel.HEADING_2 }))
    if (r.clause && r.clause.toLowerCase() !== 'not present') {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Current clause: ', bold: true }), new TextRun({ text: r.clause, italics: true })] }))
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Status: ', bold: true }), new TextRun('Missing — add new clause')] }))
    }
    children.push(new Paragraph({ children: [new TextRun({ text: 'Replace with: ', bold: true }), new TextRun(r.fix)] }))
    children.push(new Paragraph({ text: '' }))
  }
  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'accepted-contract-fixes.docx'; a.click()
  URL.revokeObjectURL(url)
}

function tryParseRisks(text: string): Risk[] | null {
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return null
    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr) || arr.length === 0) return null
    if (!arr[0]?.title || !arr[0]?.severity) return null
    return arr.map((r: any) => ({
      title: r.title || 'Untitled', severity: ['CRITICAL','HIGH','MEDIUM','LOW'].includes(r.severity) ? r.severity : 'MEDIUM',
      clause: r.clause || '', risk: r.risk || '', fix: r.fix || '', accepted: false, rejected: false,
    }))
  } catch { return null }
}
type ClioMatter = { id: string; display_number: string; description: string; status: string; client_name: string }
type SavedChat = { id: string; agentId: string; agentName: string; title: string; messages: Msg[]; savedAt: string }
type Matter = { id: string; matterNumber?: number; name: string; type: string; status: string; court?: string; attorney?: string; dueDate?: string; notes?: string; savedChats: SavedChat[] }

let _uid = ''
const _tabId = Math.random().toString(36).slice(2)
function setUid(id: string) { _uid = id; localStorage.setItem('law_oss_uid', id) }
function userKey(base: string) { return `${base}_${_uid || _tabId}` }

function getMatters(): Matter[] { try { return JSON.parse(localStorage.getItem(userKey('law_oss_matters')) || '[]') } catch { return [] } }
function persistMatters(m: Matter[]) { localStorage.setItem(userKey('law_oss_matters'), JSON.stringify(m)) }

function SaveToMatter({ messages, agentId, agentName, token }: { messages: Msg[]; agentId: string; agentName: string; token: string }) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [matters, setMatters] = useState<Matter[]>([])

  useEffect(() => { setMatters(getMatters()) }, [open])

  function persistAndSync(m: Matter[]) {
    persistMatters(m)
    if (token) saveToCloud(token, 'matters', m)
  }

  function saveToMatter(matter: Matter) {
    const all = getMatters()
    const firstUser = messages.find(m => m.role === 'user')?.content || 'Untitled'
    const chat: SavedChat = { id: Date.now().toString(), agentId, agentName, title: firstUser.slice(0, 60), messages, savedAt: new Date().toISOString() }
    const updated = all.map(m => m.id === matter.id ? { ...m, savedChats: [...m.savedChats, chat] } : m)
    persistAndSync(updated)
    setOpen(false); setCreating(false); setNewName('')
    setToast(`Saved to "${matter.name}"`)
    setTimeout(() => setToast(''), 2500)
  }

  function createAndSave() {
    const name = newName.trim()
    if (!name) return
    const all = getMatters()
    const nextNum = all.length > 0 ? Math.max(...all.map(x => x.matterNumber ?? 0)) + 1 : 1
    const newMatter: Matter = { id: Date.now().toString(), matterNumber: nextNum, name, type: 'general', status: 'active', savedChats: [] }
    persistAndSync([newMatter, ...all])
    saveToMatter(newMatter)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => { setOpen(o => !o); setCreating(false); setNewName('') }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 6, background: '#fff', color: '#374151', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save to Matter
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: '110%', left: 0, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 100, overflow: 'hidden' }}>
          {matters.length > 0 && !creating && (
            <>
              <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f3f4f6' }}>Choose a matter</div>
              {matters.map(m => (
                <button key={m.id} onClick={() => saveToMatter(m)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#0f0f0f' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  {m.matterNumber ? <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 5 }}>#{String(m.matterNumber).padStart(3,'0')}</span> : null}
                  {m.name} <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4, textTransform: 'capitalize' }}>{m.status}</span>
                </button>
              ))}
              <div style={{ borderTop: '1px solid #f3f4f6' }}>
                <button onClick={() => setCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Create new matter
                </button>
              </div>
            </>
          )}
          {(creating || matters.length === 0) && (
            <div style={{ padding: '12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                {matters.length === 0 ? 'No matters yet — create one to save this chat' : 'New matter name'}
              </div>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createAndSave(); if (e.key === 'Escape') { setCreating(false); if (matters.length === 0) setOpen(false) } }}
                placeholder="e.g. Smith v Jones"
                style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={createAndSave} disabled={!newName.trim()} style={{ flex: 1, padding: '6px 0', background: newName.trim() ? '#0f0f0f' : '#e5e5e5', color: newName.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'not-allowed' }}>
                  Create &amp; Save
                </button>
                {matters.length > 0 && (
                  <button onClick={() => setCreating(false)} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12.5, color: '#555', cursor: 'pointer' }}>
                    Back
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0f0f0f', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>{toast}</div>}
    </div>
  )
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  function copy() { navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }
  return (
    <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 6, background: '#fff', color: copied ? '#166534' : '#374151', fontSize: 12.5, cursor: 'pointer' }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (
    file.type.startsWith('text/') ||
    name.endsWith('.txt') || name.endsWith('.md') ||
    name.endsWith('.csv') || name.endsWith('.json')
  ) {
    return await file.text()
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
    const ab = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const extracted = await page.getTextContent()
      const pageItems = (extracted.items || []) as any[]
      text += pageItems.map((item: any) => (item.str ?? '')).join(' ') + '\n'
    }
    return text // no truncation — full document
  }
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth')
    const ab = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: ab })
    return result.value // no truncation — full document
  }
  throw new Error(`Unsupported file type. Please upload PDF, DOCX, TXT, MD, CSV, or JSON.`)
}

async function downloadAsWord(content: string, filename = 'document.docx') {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const lines = content.split('\n')
  const children: any[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { children.push(new Paragraph({ text: '' })); continue }
    if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({ text: trimmed.slice(4), heading: HeadingLevel.HEADING_3 }))
    } else if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2 }))
    } else if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({ text: trimmed.slice(2), heading: HeadingLevel.HEADING_1 }))
    } else {
      const parts: any[] = []
      const boldRegex = /\*\*(.+?)\*\*/g
      let last = 0, match
      while ((match = boldRegex.exec(trimmed)) !== null) {
        if (match.index > last) parts.push(new TextRun(trimmed.slice(last, match.index)))
        parts.push(new TextRun({ text: match[1], bold: true }))
        last = match.index + match[0].length
      }
      if (last < trimmed.length) parts.push(new TextRun(trimmed.slice(last)))
      children.push(new Paragraph({ children: parts.length ? parts : [new TextRun(trimmed)] }))
    }
  }
  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function looksLikeDocument(content: string): boolean {
  if (content.length < 200) return false
  const hasHeadings = /^#{1,3} .+/m.test(content)
  const hasSections = (content.match(/\n\n/g) || []).length >= 3
  const hasDocKeywords = /\b(AGREEMENT|CONTRACT|DEED|LETTER|CLAUSE|WHEREAS|RECITAL|PARTIES|SIGNED|dated this|THIS AGREEMENT|BETWEEN|hereinafter|IN WITNESS|Schedule|Annexure|TERMS AND CONDITIONS)\b/i.test(content)
  return hasHeadings || (hasSections && hasDocKeywords)
}

function DocEditorModal({ content, onClose, agentName }: { content: string; onClose: () => void; agentName: string }) {
  const [text, setText] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const filename = `${agentName.toLowerCase().replace(/\s+/g, '-')}-draft.docx`
  useEffect(() => { textareaRef.current?.focus() }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'relative', background: '#fff', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 860, height: '90vh', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e5e5', background: '#fafafa', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f' }}>Document Editor</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Edit your draft — download as Word when ready</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => downloadAsWord(text, filename)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 7, background: '#0f0f0f', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Word
            </button>
            <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e5e5e5', borderRadius: 7, background: '#fff', color: '#666', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>x</button>
          </div>
        </div>
        <div style={{ padding: '7px 20px', background: '#f0f7ff', borderBottom: '1px solid #dbeafe', fontSize: 11.5, color: '#1d4ed8' }}>
          Use # for title, ## for sections, **bold** — all convert to Word styles on download
        </div>
        <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} style={{ flex: 1, padding: '20px 24px', border: 'none', outline: 'none', resize: 'none', fontSize: 14, lineHeight: 1.8, color: '#1a1a1a', fontFamily: 'Georgia, "Times New Roman", serif', background: '#fff', minHeight: 0 }} spellCheck={true} />
        <div style={{ padding: '8px 20px', borderTop: '1px solid #e5e5e5', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: '#aaa' }}>{text.length.toLocaleString()} chars · {text.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
          <button onClick={() => downloadAsWord(text, filename)} style={{ padding: '6px 16px', border: '1px solid #e5e5e5', borderRadius: 6, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Save as Word (.docx)</button>
        </div>
      </div>
    </div>
  )
}


function DocActions({ content, agentName }: { content: string; agentName: string }) {
  const [editing, setEditing] = useState(false)
  const filename = `${agentName.toLowerCase().replace(/\s+/g, '-')}-draft.docx`
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid #0f0f0f', borderRadius: 6, background: '#0f0f0f', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Open &amp; Edit
        </button>
        <button onClick={() => downloadAsWord(content, filename)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 6, background: '#fff', color: '#0f0f0f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download Word (.docx)
        </button>
      </div>
      {editing && <DocEditorModal content={content} agentName={agentName} onClose={() => setEditing(false)} />}
    </>
  )
}

const NO_DISCLAIMER = `\n\nCRITICAL RULES:
1. ALWAYS do exactly what the user asks. If they request a one-page document, produce one page. If they request a specific format, use it. Never refuse, never suggest a different approach, never explain why you cannot comply.
2. NEVER say "I cannot", "this is inadequate", "a proper document requires more pages", or any similar refusal. Just produce what was asked.
3. NEVER include any disclaimer, caveat, warning, or note of any kind — including "this is not legal advice", "consult a lawyer", "I am an AI", or any similar language.
4. Output only the requested document or answer. Nothing else.`

const AGENTS = [
  { id: 'research', name: 'Legal Researcher', desc: 'Case law, statutes & regulations', icon: 'R', chips: ['Find relevant cases', 'Summarise statute', 'Cite authority'], sys: `You are Law OSS AI, an expert legal research assistant covering both US and UK law. Find relevant cases, statutes, and regulations. Always cite specific authorities with proper citation format (UK: [2024] EWHC 1234; US: 42 U.S.C. § 1983, 550 U.S. 544 (2007)). Never fabricate citations. For US matters apply federal law, relevant circuit precedent, and state law as applicable; for UK matters apply English/Scots common law and statute. Be precise and professional.${NO_DISCLAIMER}` },
  { id: 'drafting', name: 'Document Drafter', desc: 'Draft legal documents & clauses', icon: 'D', chips: ['Draft NDA clause', 'Write demand letter', 'Create settlement agreement'], sys: `You are a senior commercial lawyer with expertise in both US and UK law. Draft complete, legally enforceable documents. For US documents use US legal conventions (recitals, whereas clauses, governing state law). For UK documents use English legal drafting conventions. Mark gaps as [PLACEHOLDER]. Do not use emojis, decorative symbols, or coloured text. Use plain professional text with numbered clauses.

LENGTH: Minimum 1 page, maximum 40 pages. Simple documents (NDAs, letters) 1–5 pages. Standard agreements 5–15 pages. Complex agreements (shareholders, JV, finance) up to 40 pages. Use as many pages as the document requires — never truncate to save space.

COMPLETION: You MUST produce the entire document in one continuous output. Include every clause the document type requires. The final thing you write must be a fully drafted signature/execution block with date lines, party name lines, and signature lines. The document is incomplete until the signature block appears. Never stop mid-clause or mid-sentence.${NO_DISCLAIMER}` },
  { id: 'contract', name: 'Contract Analyst', desc: 'Contract review & risk analysis', icon: 'C', chips: ['Review this contract', 'Flag risky clauses', 'Compare to standard terms'], sys: `You are Law OSS AI, an expert contract analyst with expertise in US and UK law. Apply the governing law specified in the contract or by the user; if none, use general common law principles. For US contracts reference UCC, Restatement (Second) of Contracts, and relevant state law. For UK contracts reference UCTA, Consumer Rights Act, Sale of Goods Act.

When asked to review a contract, flag risky clauses, or identify risks: output ONLY a JSON array with no prose, no markdown, no explanation outside the JSON. Start with [ and end with ]. Each item: {"title":"short clause title","severity":"CRITICAL"|"HIGH"|"MEDIUM"|"LOW","clause":"exact problematic text or 'Not present'","risk":"one sentence why risky (cite statute/doctrine)","fix":"<see rules below>"}. Output 5–20 items covering every genuine risk.

RULES FOR THE "fix" FIELD — two cases, choose the right one:
CASE 1 — Clauses you can fully draft (indemnification, governing law, reps and warranties, boilerplate): write finished, binding legal language with numbered/lettered subsections, defined terms, and operative words exactly as they would appear in a signed agreement. NEVER write a description or instruction about what the clause should say. BAD: 'Add an indemnification clause covering direct losses and third-party claims.' GOOD: '9. INDEMNIFICATION. (a) Each party (the Indemnifying Party) shall defend, indemnify, and hold harmless the other party and its officers, directors, employees, and agents from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys fees) arising out of or relating to: (i) any breach of this Agreement; (ii) the negligence or willful misconduct of the Indemnifying Party; or (iii) infringement of third-party intellectual property rights by the Indemnifying Party. (b) The Indemnified Party shall promptly notify the Indemnifying Party in writing of any claim and grant sole control of its defense.'
CASE 2 — Blanks requiring party-specific facts you cannot know (closing location, dollar amounts, named individuals, specific dates): do NOT describe what should go there. Insert a blank using the same placeholder convention already used in this document (typically underscores, e.g. __________). Write the full surrounding clause language, leaving only the unknown fact as a blank. BAD: 'Insert the agreed closing location here.' GOOD: 'Closing shall occur at __________, on __________, 20__.'

For all other questions (explanations, comparisons, strategy): respond normally in clear professional prose.${NO_DISCLAIMER}` },
  { id: 'litigation', name: 'Litigation Assistant', desc: 'Strategy, procedure & pleadings', icon: 'L', chips: ['Assess case merits', 'Draft skeleton argument', 'Litigation risk estimate'], sys: `You are Law OSS AI, an expert litigation assistant covering US federal and state courts as well as UK courts. Analyse merits, identify key issues, suggest case strategy, and assess litigation risk with probability estimates. For US matters reference FRCP, relevant circuit rules, and state procedural rules. For UK matters reference CPR and practice directions. Be precise and strategic.${NO_DISCLAIMER}` },
  { id: 'compliance', name: 'Compliance Officer', desc: 'Regulatory compliance guidance', icon: 'Co', chips: ['Check GDPR compliance', 'AML obligations', 'Data breach response'], sys: `You are Law OSS AI, an expert compliance advisor covering US and UK/EU regulatory frameworks. For US matters: reference SEC, FINRA, CFPB, FTC, HIPAA, CCPA/CPRA, BSA/AML rules. For UK/EU matters: reference FCA, ICO, GDPR/UK GDPR, MLR 2017. Identify applicable regulations by name and provision, analyse compliance gaps, and recommend remediation steps. Be thorough and practical.${NO_DISCLAIMER}` },
  { id: 'dd', name: 'Due Diligence', desc: 'M&A and transaction analysis', icon: 'DD', chips: ['M&A red flags', 'Corporate structure review', 'IP ownership check'], sys: `You are Law OSS AI, an expert due diligence specialist covering US and UK transactions. For US deals: consider Delaware corporate law, federal securities laws, UCC filings (Article 9), CFIUS. For UK deals: consider Companies Act 2006, FCA rules, CMA competition clearance. Systematically analyse corporate, financial, and legal risks in transactions. Format findings with priority levels [CRITICAL/HIGH/MEDIUM/LOW].${NO_DISCLAIMER}` },
]

function getSystemPrompt(agentId: string): string {
  return AGENTS.find(a => a.id === agentId)?.sys || AGENTS[0].sys
}

async function streamAI(
  apiKey: string, provider: string, messages: Msg[], sys: string,
  onToken: (t: string) => void, onDone: () => void, onError: (e: string) => void,
  maxTokens = 8000,
) {
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`
      // Filter out empty messages and ensure no consecutive same-role turns
      const geminiMsgs = messages
        .filter(m => m.content.trim())
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: geminiMsgs, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 } }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any
        onError(err.error?.message || `Gemini error ${res.status}`); return
      }
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim(); if (!raw || raw === '[DONE]') continue
          try { const p = JSON.parse(raw); const t = p.candidates?.[0]?.content?.parts?.[0]?.text; if (t) onToken(t) } catch {}
        }
      }
    } else {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, stream: true, system: sys, messages }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})) as any; onError(e.error?.message || `Error ${res.status}`); return }
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim(); if (!raw || raw === '[DONE]') continue
          try { const p = JSON.parse(raw); if (p.type === 'content_block_delta' && p.delta?.text) onToken(p.delta.text) } catch {}
        }
      }
    }
    onDone()
  } catch (e: any) { onError(e.message || 'Network error') }
}

export default function AgentsPage() {
  const [agentId, setAgentId] = useState(AGENTS[0].id)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [noKey, setNoKey] = useState(false)
  const [jurisdiction, setJurisdiction] = useState('')
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [continuationRound, setContinuationRound] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [msgRisks, setMsgRisks] = useState<Record<number, Risk[]>>({})
  const [agentDocText, setAgentDocText] = useState('')
  const [agentDocName, setAgentDocName] = useState('')
  const [agentDownloadResult, setAgentDownloadResult] = useState<AgentDownloadResult | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      // Set uid FIRST so userKey() returns the correct namespaced key
      setUid(session.user.id)
      setNoKey(!localStorage.getItem(userKey('law_oss_api_key')))
      setAuthToken(session.access_token)
    })
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setUploadError('')
    try { const text = await extractTextFromFile(file); setAttachedDoc({ name: file.name, text }) }
    catch (err: any) { setUploadError(err.message || 'Failed to read file') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  async function send(text: string) {
    if (!text.trim() || streaming) return
    const apiKey = localStorage.getItem(userKey('law_oss_api_key')) || ''
    const provider = localStorage.getItem(userKey('law_oss_provider')) || 'claude'
    if (!apiKey) { setNoKey(true); return }

    const msg = attachedDoc ? `${text.trim()}\n\n[Attached: ${attachedDoc.name}]\n${attachedDoc.text}` : text.trim()
    // Store original doc text for contract agent so we can apply fixes to it later
    if (agentId === 'contract' && attachedDoc) {
      setAgentDocText(attachedDoc.text)
      setAgentDocName(attachedDoc.name)
    }
    setInput(''); setAttachedDoc(null); setUploadError('')
    const basePrompt = getSystemPrompt(agentId)
    const sys = jurisdiction ? `${basePrompt}\n\nJURISDICTION: ${jurisdiction}. Apply the law of this jurisdiction throughout. Cite relevant statutes, cases, and authorities specific to this jurisdiction.` : basePrompt
    setStreaming(true)

    let history: Msg[] = [...messages, { role: 'user', content: msg }]
    setMessages([...history, { role: 'assistant', content: '' }])

    const appendToken = (t: string) => setMessages(prev => {
      const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: n[n.length - 1].content + t }; return n
    })
    const onError = (e: string) => {
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: `Error: ${e}` }; return n })
      setStreaming(false)
    }

    // Detect a fully completed document — signature/execution block is the definitive end
    const DONE_RE = /IN WITNESS WHEREOF|EXECUTED AS A DEED|SIGNATURE PAGE|EXECUTION BLOCK|\bSIGNED BY\b|\bSIGNATURE BLOCK\b|\bDuly (Authorised|Executed)\b|Date:\s*[_\[.]{2,}|___+\s*(Signature|Name|Date|Title)|\/s\/\s*[A-Z]|\bFOR AND ON BEHALF\b|\bDuly authorised signatory\b|\bend of (this )?(agreement|contract|deed|document|schedule)\b/i

    // Drafting agent gets 16000 tokens per call; others get 8000
    const maxTok = agentId === 'drafting' ? 16000 : 8000

    let rounds = 0
    let keepGoing = true
    setContinuationRound(0)
    while (keepGoing && rounds < 12) {
      keepGoing = false
      rounds++
      let chunk = ''
      let errored = false
      await new Promise<void>((resolve) => {
        const onTok = (t: string) => { chunk += t; appendToken(t) }
        const onDone = () => resolve()
        const onErr = (e: string) => { errored = true; onError(e); resolve() }
        streamAI(apiKey, provider, history, sys, onTok, onDone, onErr, maxTok)
      })
      if (errored) break
      // For drafting: continue if no completion marker found AND response was substantial
      // (a short chunk means AI naturally finished; a long chunk means it hit the token limit)
      const isDraftingIncomplete = agentId === 'drafting' && !DONE_RE.test(chunk) && chunk.trim().length > 300
      if (isDraftingIncomplete) {
        keepGoing = true
        setContinuationRound(rounds)
        history = [
          ...history,
          { role: 'assistant', content: chunk },
          { role: 'user', content: 'Continue drafting exactly from where you left off. Do not repeat any previously written text. Continue seamlessly from the last word written.' },
        ]
        appendToken('\n')
      }
    }

    setContinuationRound(0)
    setStreaming(false)

    // For contract agent: parse risk JSON from final response and store per-message
    if (agentId === 'contract') {
      setMessages(prev => {
        const lastIdx = prev.length - 1
        const lastMsg = prev[lastIdx]
        if (lastMsg?.role === 'assistant') {
          const parsed = tryParseRisks(lastMsg.content)
          if (parsed) setMsgRisks(r => ({ ...r, [lastIdx]: parsed }))
        }
        return prev
      })
    }
  }

  const activeAgent = AGENTS.find(a => a.id === agentId)!
  const [isMobile, setIsMobile] = useState(false)
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Agent list — hidden on mobile, visible on desktop */}
      {!isMobile && (
        <div style={{ width: 220, borderRight: '1px solid rgba(0,0,0,0.08)', overflowY: 'auto', flexShrink: 0, background: '#fafafa' }}>
          <div style={{ padding: '14px 16px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999' }}>Agents</div>
          {AGENTS.map(a => (
            <button key={a.id} onClick={() => { setAgentId(a.id); setMessages([]); setMsgRisks({}); setAgentDocText(''); setAgentDocName('') }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: agentId === a.id ? '#fff' : 'transparent', borderLeft: agentId === a.id ? '3px solid #0f0f0f' : '3px solid transparent', cursor: 'pointer' }}>
              <div style={{ fontSize: 13.5, fontWeight: agentId === a.id ? 600 : 400, color: agentId === a.id ? '#0f0f0f' : '#333' }}>{a.name}</div>
              <div style={{ fontSize: 11.5, color: '#888', marginTop: 2, lineHeight: 1.4 }}>{a.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* Mobile agent picker modal */}
      {isMobile && showAgentPicker && (
        <div onClick={() => setShowAgentPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.4)' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '16px 16px 0 0', padding: '16px 0 32px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ padding: '0 16px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999' }}>Choose Agent</div>
            {AGENTS.map(a => (
              <button key={a.id} onClick={() => { setAgentId(a.id); setMessages([]); setMsgRisks({}); setAgentDocText(''); setAgentDocName(''); setShowAgentPicker(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', background: agentId === a.id ? '#f5f5f5' : 'transparent', cursor: 'pointer' }}>
                <div style={{ fontSize: 14, fontWeight: agentId === a.id ? 600 : 400, color: '#0f0f0f' }}>{a.name}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{a.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f0f0f' }}>{activeAgent.name}</div>
            <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>{activeAgent.desc}</div>
          </div>
          {isMobile && (
            <button onClick={() => setShowAgentPicker(true)} style={{ flexShrink: 0, padding: '6px 12px', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 7, background: '#fff', fontSize: 12.5, fontWeight: 600, color: '#555', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Switch ↕
            </button>
          )}
        </div>

        {noKey && (
          <div style={{ padding: '10px 20px', background: '#fefce8', borderBottom: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
            No API key configured. <a href="/onboarding" style={{ color: '#0f0f0f', fontWeight: 600 }}>Add your key</a>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
              <div style={{ width: 44, height: 44, background: '#0f0f0f', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 0.5, marginBottom: 14 }}>{activeAgent.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f0f0f', marginBottom: 6 }}>{activeAgent.name}</div>
              <div style={{ fontSize: 13.5, color: '#999', marginBottom: 24, textAlign: 'center', maxWidth: 320 }}>{activeAgent.desc}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {activeAgent.chips.map(c => (
                  <button key={c} onClick={() => send(c)} style={{ padding: '8px 16px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 20, background: '#fff', color: '#333', fontSize: 13, cursor: 'pointer' }}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isLastAssistant = m.role === 'assistant' && i === messages.length - 1
            const isDone = !streaming || !isLastAssistant
            const risks = msgRisks[i]
            const showRiskCards = m.role === 'assistant' && isDone && !!risks && risks.length > 0
            const showDocActions = m.role === 'assistant' && isDone && !showRiskCards && looksLikeDocument(m.content)
            const showMsgActions = m.role === 'assistant' && isDone && m.content && !showRiskCards
            return (
              <div key={i}>
                {showRiskCards ? (
                  <div style={{ maxWidth: '90%' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      {risks.filter(r => r.severity === 'CRITICAL').length > 0 && <span style={{ color: '#be123c', marginRight: 10 }}>{risks.filter(r => r.severity === 'CRITICAL').length} CRITICAL</span>}
                      {risks.filter(r => r.severity === 'HIGH').length > 0 && <span style={{ color: '#c2410c', marginRight: 10 }}>{risks.filter(r => r.severity === 'HIGH').length} HIGH</span>}
                      {risks.length} risks identified
                    </div>
                    {risks.map((r, ri) => (
                      <AgentRiskCard
                        key={ri}
                        risk={r}
                        onAccept={() => setMsgRisks(prev => {
                          const updated = prev[i].map((x, xi) => xi === ri ? { ...x, accepted: !x.accepted, rejected: false } : x)
                          return { ...prev, [i]: updated }
                        })}
                        onReject={() => setMsgRisks(prev => {
                          const updated = prev[i].map((x, xi) => xi === ri ? { ...x, rejected: !x.rejected, accepted: false } : x)
                          return { ...prev, [i]: updated }
                        })}
                      />
                    ))}
                    {(() => {
                      const acceptedCount = risks.filter(r => r.accepted).length
                      const reviewedCount = risks.filter(r => r.accepted || r.rejected).length
                      return (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {acceptedCount > 0 && (
                            <button
                              onClick={async () => {
                                if (agentDocText) {
                                  const r = await downloadUpdatedContract(agentDocText, risks, agentDocName || 'contract.docx')
                                  setAgentDownloadResult(r)
                                } else {
                                  downloadAcceptedFixes(risks)
                                }
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              {agentDocText ? `Download updated contract (${acceptedCount} fix${acceptedCount > 1 ? 'es' : ''})` : `Download accepted fixes (${acceptedCount})`}
                            </button>
                          )}
                          {agentDownloadResult && (
                            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                              <span style={{ color: '#15803d' }}>✓ {agentDownloadResult.applied} replaced · {agentDownloadResult.appended} inserted</span>
                              {agentDownloadResult.failed.length > 0 && (
                                <span style={{ color: '#dc2626', marginLeft: 10 }}>✗ {agentDownloadResult.failed.length} could not be applied: {agentDownloadResult.failed.map(f => f.title).join(', ')} — edit manually</span>
                              )}
                              {agentDownloadResult.renumberWarning && (
                                <span style={{ color: '#d97706', marginLeft: 10 }}>⚠ Non-standard numbering — new clauses marked [NEW CLAUSE — RENUMBER MANUALLY]</span>
                              )}
                            </div>
                          )}
                          {reviewedCount === risks.length && risks.length > 0 && (
                            <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>✓ All {risks.length} risks reviewed</div>
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <CopyButton content={m.content} />
                            <SaveToMatter messages={messages.slice(0, i + 1)} agentId={agentId} agentName={activeAgent.name} token={authToken ?? ''} />
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '72%', padding: '10px 14px', fontSize: 14, lineHeight: 1.65, borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? '#0f0f0f' : '#fff', color: m.role === 'user' ? '#fff' : '#0f0f0f', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        {m.content ? (
                          m.role === 'user'
                            ? <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                            : <MarkdownRenderer content={m.content} />
                        ) : (streaming && isLastAssistant ? (
                          <LogoLoader label={continuationRound > 0 ? `Completing document... (part ${continuationRound + 1})` : 'Thinking...'} />
                        ) : '')}
                      </div>
                    </div>
                    {showDocActions && (
                      <div style={{ paddingLeft: 4 }}>
                        <DocActions content={m.content} agentName={activeAgent.name} />
                      </div>
                    )}
                    {showMsgActions && (
                      <div style={{ paddingLeft: 4, display: 'flex', gap: 6, marginTop: showDocActions ? 4 : 6, flexWrap: 'wrap' }}>
                        <CopyButton content={m.content} />
                        <SaveToMatter messages={messages.slice(0, i + 1)} agentId={agentId} agentName={activeAgent.name} token={authToken ?? ''} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        <div
          style={{ padding: '10px 20px 14px', background: dragOver ? '#f0fdf4' : '#fff', borderTop: `1px solid ${dragOver ? '#86efac' : 'rgba(0,0,0,0.07)'}`, flexShrink: 0, transition: 'background 0.15s, border-color 0.15s' }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
          onDrop={async e => {
            e.preventDefault(); setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (!file) return
            setUploading(true); setUploadError('')
            try { const text = await extractTextFromFile(file); setAttachedDoc({ name: file.name, text }) }
            catch (err: any) { setUploadError(err.message || 'Failed to read file') }
            finally { setUploading(false) }
          }}
        >
          {attachedDoc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12.5, flexWrap: 'wrap' }}>
              <span style={{ color: '#166534', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {attachedDoc.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <select
                    defaultValue=""
                    onChange={e => {
                      const targetId = e.target.value
                      if (!targetId) return
                      const doc = attachedDoc
                      setAgentId(targetId)
                      setMessages([])
                      setAttachedDoc(doc)
                      e.target.value = ''
                    }}
                    style={{ padding: '2px 6px', fontSize: 11.5, border: '1px solid #86efac', borderRadius: 5, background: '#fff', color: '#166534', cursor: 'pointer' }}
                  >
                    <option value="" disabled>Send to agent...</option>
                    {AGENTS.filter(a => a.id !== agentId).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => setAttachedDoc(null)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            </div>
          )}
          {uploadError && (
            <div style={{ padding: '6px 10px', marginBottom: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5, color: '#dc2626' }}>{uploadError}</div>
          )}
          <div style={{ display: 'flex', gap: 8, background: '#f8f8f8', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '6px 10px' }}>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={handleFileSelect} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach document (PDF, TXT, MD, CSV, JSON)" style={{ background: 'none', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', color: uploading ? '#ccc' : '#666', padding: '0 2px', alignSelf: 'flex-end', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, transition: 'color 0.15s' }}>
              {uploading
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              }
            </button>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder={`Ask ${activeAgent.name}... (Enter to send)`}
              disabled={streaming} rows={1}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 14, color: '#0f0f0f', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }}
            />
            <button onClick={() => send(input)} disabled={streaming || !input.trim()} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', alignSelf: 'flex-end', flexShrink: 0, background: streaming || !input.trim() ? 'rgba(0,0,0,0.1)' : '#0f0f0f', color: streaming || !input.trim() ? '#bbb' : '#fff', cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>^</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>Jurisdiction:</span>
            <select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}
              style={{ fontSize: 11, color: '#555', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, padding: '2px 6px', background: '#fafafa', cursor: 'pointer', flex: 1, maxWidth: 260 }}>
              <option value="">Auto-detect from question</option>
              <optgroup label="🇺🇸 United States">
                <option value="US Federal (All Circuits)">Federal — All Circuits</option>
                <option value="US Supreme Court (SCOTUS)">Supreme Court (SCOTUS)</option>
                <option value="2nd Circuit (New York)">2nd Circuit (New York)</option>
                <option value="3rd Circuit (Delaware/NJ/PA)">3rd Circuit (DE/NJ/PA)</option>
                <option value="5th Circuit (Texas/LA/MS)">5th Circuit (TX/LA/MS)</option>
                <option value="9th Circuit (California/WA/OR)">9th Circuit (CA/WA/OR)</option>
                <option value="11th Circuit (Florida/Georgia)">11th Circuit (FL/GA)</option>
                <option value="New York">New York</option>
                <option value="California">California</option>
                <option value="Delaware">Delaware</option>
                <option value="Texas">Texas</option>
                <option value="Florida">Florida</option>
                <option value="Illinois">Illinois</option>
              </optgroup>
              <optgroup label="🇬🇧 United Kingdom">
                <option value="England and Wales">England &amp; Wales</option>
                <option value="UK Supreme Court">UK Supreme Court</option>
                <option value="England and Wales — Court of Appeal">Court of Appeal</option>
                <option value="England and Wales — High Court">High Court</option>
                <option value="England and Wales — Upper Tribunal">Upper Tribunal</option>
                <option value="Scotland">Scotland</option>
                <option value="Northern Ireland">Northern Ireland</option>
              </optgroup>
            </select>
          </div>
          <div style={{ fontSize: 11, color: dragOver ? '#166534' : '#ccc', marginTop: 5, textAlign: 'center', transition: 'color 0.15s' }}>
            {dragOver ? 'Drop file to attach' : 'Not legal advice. Verify with a qualified lawyer. Drag a file here or use + to attach PDF, DOCX, TXT, MD, CSV, JSON.'}
          </div>
        </div>
      </div>
    </div>
  )
}
