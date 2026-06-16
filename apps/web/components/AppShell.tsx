'use client'
import { useEffect, useRef, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AppShellProps {
  token: string
}

export default function AppShell({ token }: AppShellProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [edition, setEdition] = useState<'us' | 'uk'>('us')
  const supabase = createClientComponentClient()

  async function signOut() {
    await supabase.auth.signOut()
  }

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    function postAuth() {
      try {
        iframe?.contentWindow?.postMessage(
          {
            type: 'LAW_OSS_AUTH',
            token,
            apiBase: API_BASE,
          },
          '*'
        )
      } catch { /* cross-origin — handled in HTML */ }
    }

    iframe.addEventListener('load', postAuth)
    return () => iframe.removeEventListener('load', postAuth)
  }, [token])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 12,
          zIndex: 100,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => setEdition(edition === 'us' ? 'uk' : 'us')}
          style={{
            background: 'rgba(26,46,110,0.08)',
            border: '1px solid rgba(26,46,110,0.2)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: '#1a2e6e',
            cursor: 'pointer',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
        >
          {edition === 'us' ? '🇺🇸 US' : '🇬🇧 UK'}
        </button>
        <button
          onClick={signOut}
          style={{
            background: 'rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            color: '#555',
            cursor: 'pointer',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
        >
          Sign out
        </button>
      </div>

      <iframe
        ref={iframeRef}
        src={`/app/law-oss-${edition}.html`}
        style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
        title="Law OSS Application"
        allow="clipboard-write"
      />
    </div>
  )
}
