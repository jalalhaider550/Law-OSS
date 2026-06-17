'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  content: string
  dimmed?: boolean // for assistant bubble vs white background
}

export default function MarkdownRenderer({ content, dimmed = false }: Props) {
  const color = dimmed ? '#e5e5e5' : '#0f0f0f'
  const mutedColor = dimmed ? '#aaa' : '#555'
  const borderColor = dimmed ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
  const codeBackground = dimmed ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p style={{ margin: '0 0 10px', lineHeight: 1.7, color }}>{children}</p>
        ),
        h1: ({ children }) => (
          <h1 style={{ fontSize: 17, fontWeight: 700, margin: '18px 0 8px', color, lineHeight: 1.3 }}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 6px', color, lineHeight: 1.3 }}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '12px 0 5px', color, lineHeight: 1.3 }}>{children}</h3>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: '6px 0 10px', paddingLeft: 22, color }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: '6px 0 10px', paddingLeft: 22, color }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ marginBottom: 4, lineHeight: 1.65, color }}>{children}</li>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 700, color }}>{children}</strong>
        ),
        em: ({ children }) => (
          <em style={{ fontStyle: 'italic', color: mutedColor }}>{children}</em>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code style={{
                display: 'block', background: codeBackground, borderRadius: 7,
                padding: '12px 14px', fontSize: 13, fontFamily: 'ui-monospace, monospace',
                color, lineHeight: 1.6, overflowX: 'auto', margin: '8px 0',
              }}>{children}</code>
            )
          }
          return (
            <code style={{
              background: codeBackground, borderRadius: 4,
              padding: '1px 5px', fontSize: 13,
              fontFamily: 'ui-monospace, monospace', color,
            }}>{children}</code>
          )
        },
        pre: ({ children }) => (
          <pre style={{ margin: '8px 0', borderRadius: 7, overflow: 'hidden' }}>{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote style={{
            borderLeft: `3px solid ${borderColor}`, paddingLeft: 12,
            margin: '8px 0', color: mutedColor, fontStyle: 'italic',
          }}>{children}</blockquote>
        ),
        hr: () => (
          <hr style={{ border: 'none', borderTop: `1px solid ${borderColor}`, margin: '14px 0' }} />
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: dimmed ? '#93c5fd' : '#1d4ed8', textDecoration: 'underline' }}>{children}</a>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '10px 0' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13.5 }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700, color, borderBottom: `2px solid ${borderColor}`, whiteSpace: 'nowrap' }}>{children}</th>
        ),
        td: ({ children }) => (
          <td style={{ padding: '7px 12px', color, borderBottom: `1px solid ${borderColor}` }}>{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
