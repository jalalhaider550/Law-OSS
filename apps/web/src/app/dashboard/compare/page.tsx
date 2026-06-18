'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

let _uid = ''
const _tabId = Math.random().toString(36).slice(2)
function userKey(base: string) { return `${base}_${_uid || _tabId}` }

const CATEGORIES = [
  'Parties',
  'Governing Law',
  'Contract Duration / Term',
  'Liability Cap',
  'Indemnification',
  'Termination Rights',
  'IP Ownership',
  'Dispute Resolution',
  'Confidentiality',
  'Key Risks',
]

const SYSTEM_PROMPT = `You are Law OSS AI, an expert contract analyst performing a structured comparative review. You will be given a contract and a list of categories. For each category, respond with a JSON object where each key is a category name and the value is an object with two fields: "finding" (1-2 sentence summary) and "quote" (the most relevant verbatim excerpt from the contract, under 40 words, or "Not found" if absent). Return only valid JSON, no markdown fences, no other text.`

type CategoryResult = { finding: string; quote: string }
type ContractResult = Record<string, CategoryResult>

type ContractFile = {
  id: string
  file: File
  status: 'idle' | 'extracting' | 'analysing' | 'done' | 'error'
  error?: string
  result?: ContractResult
}

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (file.type === 'text/plain' || name.endsWith('.txt') || name.endsWith('.md')) {
    return file.text()
  }
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth')
    const buffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    return result.value
  }
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item: any) => item.str).join(' ') + '\n'
  }
  return text // no truncation — full document
}

async function analyseWithClaude(apiKey: string, text: string): Promise<ContractResult> {
  const userMsg = `Analyse this contract for the following categories and return JSON only:\nCategories: ${CATEGORIES.join(', ')}\n\n${text}`
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
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })
  if (!res.ok) throw new Error(`Claude error ${res.status}`)
  const data = await res.json()
  const raw = data.content?.[0]?.text ?? ''
  return JSON.parse(raw)
}

async function analyseWithGemini(apiKey: string, text: string): Promise<ContractResult> {
  const userMsg = `Analyse this contract for the following categories and return JSON only:\nCategories: ${CATEGORIES.join(', ')}\n\n${text}`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { maxOutputTokens: 2000 },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return JSON.parse(raw)
}

function safeGet(result: ContractResult | undefined, cat: string, field: 'finding' | 'quote'): string {
  try {
    return result?.[cat]?.[field] ?? ''
  } catch {
    return 'Parse error'
  }
}

function exportCSV(contracts: ContractFile[]) {
  const done = contracts.filter((c) => c.status === 'done')
  const headers = ['Category', ...done.flatMap((c) => [`${c.file.name} - Finding`, `${c.file.name} - Quote`])]
  const rows = CATEGORIES.map((cat) => [
    cat,
    ...done.flatMap((c) => [
      safeGet(c.result, cat, 'finding') || '-',
      safeGet(c.result, cat, 'quote') || '-',
    ]),
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contract-comparison-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ComparePage() {
  const [contracts, setContracts] = useState<ContractFile[]>([])
  const [analysing, setAnalysing] = useState(false)
  const [done, setDone] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        _uid = session.user.id
        localStorage.setItem('law_oss_uid', session.user.id)
        setHasKey(!!localStorage.getItem(userKey('law_oss_api_key')))
      }
    })
  }, [])
  const dragRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.type === 'text/plain' || f.name.endsWith('.txt') || f.name.endsWith('.docx') || f.name.endsWith('.md') || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    setContracts((prev) => {
      const next = [...prev]
      for (const f of arr) {
        if (next.length >= 10) break
        if (!next.find((c) => c.file.name === f.name && c.file.size === f.size)) {
          next.push({ id: Math.random().toString(36).slice(2), file: f, status: 'idle' })
        }
      }
      return next
    })
  }, [])

  const removeContract = (id: string) => {
    setContracts((prev) => prev.filter((c) => c.id !== id))
    setDone(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  const updateContract = (id: string, patch: Partial<ContractFile>) => {
    setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const handleAnalyse = async () => {
    const apiKey = localStorage.getItem(userKey('law_oss_api_key')) ?? ''
    const provider = localStorage.getItem(userKey('law_oss_provider')) ?? 'claude'
    if (!apiKey) return
    setAnalysing(true)
    setDone(false)
    for (const contract of contracts) {
      updateContract(contract.id, { status: 'extracting', error: undefined, result: undefined })
      let text = ''
      try {
        text = await extractText(contract.file)
      } catch (err: any) {
        updateContract(contract.id, { status: 'error', error: 'Extraction failed: ' + err.message })
        continue
      }
      updateContract(contract.id, { status: 'analysing' })
      try {
        const result =
          provider === 'gemini'
            ? await analyseWithGemini(apiKey, text)
            : await analyseWithClaude(apiKey, text)
        updateContract(contract.id, { status: 'done', result })
      } catch (err: any) {
        updateContract(contract.id, { status: 'error', error: 'Analysis failed: ' + err.message })
      }
    }
    setAnalysing(false)
    setDone(true)
  }

  const handleClear = () => {
    setContracts([])
    setDone(false)
    setAnalysing(false)
  }

  const canAnalyse = contracts.length >= 2 && hasKey && !analysing

  const statusLabel: Record<ContractFile['status'], string> = {
    idle: '',
    extracting: 'Extracting...',
    analysing: 'Analysing...',
    done: 'Done',
    error: 'Error',
  }

  const statusColor: Record<ContractFile['status'], string> = {
    idle: '#888',
    extracting: '#555',
    analysing: '#555',
    done: '#1a7a1a',
    error: '#b91c1c',
  }

  const doneContracts = contracts.filter((c) => c.status === 'done')

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f0f0f', marginBottom: 4 }}>
        Tabular Contract Review
      </h1>
      <p style={{ color: '#555', fontSize: 14, marginBottom: 32 }}>
        Upload 2 to 10 contracts to compare them side-by-side across standard legal categories.
      </p>

      {/* Upload zone */}
      <div
        ref={dragRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        style={{
          border: '1.5px dashed #ccc',
          borderRadius: 8,
          padding: '36px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: '#fafafa',
          marginBottom: 20,
          userSelect: 'none',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,text/plain,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <p style={{ margin: 0, color: '#555', fontSize: 14 }}>
          Drag and drop PDF or TXT files here, or click to select
        </p>
        <p style={{ margin: '6px 0 0', color: '#aaa', fontSize: 12 }}>
          2 to 10 files, PDF or plain text
        </p>
      </div>

      {/* File chips */}
      {contracts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {contracts.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                border: '1px solid #ddd',
                borderRadius: 20,
                background: '#fff',
                fontSize: 13,
              }}
            >
              <span style={{ color: '#0f0f0f', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.file.name}
              </span>
              {c.status !== 'idle' && (
                <span style={{ fontSize: 11, color: statusColor[c.status] }}>
                  {c.status === 'error' ? c.error ?? 'Error' : statusLabel[c.status]}
                </span>
              )}
              {!analysing && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeContract(c.id) }}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#aaa',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 0,
                  }}
                  aria-label="Remove"
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 36 }}>
        <button
          onClick={handleAnalyse}
          disabled={!canAnalyse}
          style={{
            padding: '10px 24px',
            background: canAnalyse ? '#0f0f0f' : '#ddd',
            color: canAnalyse ? '#fff' : '#aaa',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: canAnalyse ? 'pointer' : 'not-allowed',
          }}
        >
          {analysing ? 'Analysing...' : 'Analyse'}
        </button>
        {done && doneContracts.length >= 2 && (
          <button
            onClick={() => exportCSV(contracts)}
            style={{
              padding: '10px 24px',
              background: '#fff',
              color: '#0f0f0f',
              border: '1px solid #ccc',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Export CSV
          </button>
        )}
        {contracts.length > 0 && !analysing && (
          <button
            onClick={handleClear}
            style={{
              padding: '10px 24px',
              background: '#fff',
              color: '#888',
              border: '1px solid #eee',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* No API key warning */}
      {!apiKey && (
        <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 24 }}>
          No API key found. Add your API key in Settings to use this feature.
        </p>
      )}

      {/* Comparison table */}
      {doneContracts.length >= 1 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e5e5', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 600, width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th
                  style={{
                    position: 'sticky',
                    left: 0,
                    background: '#f5f5f5',
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#0f0f0f',
                    borderBottom: '1px solid #e5e5e5',
                    borderRight: '1px solid #e5e5e5',
                    minWidth: 180,
                    zIndex: 1,
                  }}
                >
                  Category
                </th>
                {doneContracts.map((c) => (
                  <th
                    key={c.id}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#0f0f0f',
                      borderBottom: '1px solid #e5e5e5',
                      borderRight: '1px solid #e5e5e5',
                      minWidth: 260,
                    }}
                  >
                    <span style={{ display: 'block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.file.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat, i) => (
                <tr key={cat} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: i % 2 === 0 ? '#fff' : '#fafafa',
                      padding: '12px 16px',
                      fontWeight: 500,
                      color: '#0f0f0f',
                      borderBottom: '1px solid #eee',
                      borderRight: '1px solid #e5e5e5',
                      verticalAlign: 'top',
                      zIndex: 1,
                    }}
                  >
                    {cat}
                  </td>
                  {doneContracts.map((c) => {
                    const finding = safeGet(c.result, cat, 'finding')
                    const quote = safeGet(c.result, cat, 'quote')
                    const empty = !finding && !quote
                    return (
                      <td
                        key={c.id}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #eee',
                          borderRight: '1px solid #eee',
                          verticalAlign: 'top',
                        }}
                      >
                        {empty ? (
                          <span style={{ color: '#ccc' }}>-</span>
                        ) : (
                          <>
                            <p style={{ margin: '0 0 6px', color: '#0f0f0f', lineHeight: 1.5 }}>
                              {finding || <span style={{ color: '#ccc' }}>-</span>}
                            </p>
                            {quote && quote !== 'Not found' ? (
                              <p style={{ margin: 0, fontSize: 11, color: '#888', fontStyle: 'italic', lineHeight: 1.5 }}>
                                {quote}
                              </p>
                            ) : (
                              <p style={{ margin: 0, fontSize: 11, color: '#ccc', fontStyle: 'italic' }}>
                                Not found
                              </p>
                            )}
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
