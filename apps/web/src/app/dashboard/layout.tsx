'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

// Clean SVG icons — no emojis
const Icons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".85"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".85"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".85"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".85"/>
    </svg>
  ),
  agents: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 13.5c0-2.485 2.686-4.5 6-4.5s6 2.015 6 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  contracts: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5.5h6M5 8h6M5 10.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  research: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  matters: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L2 5v2c0 3.5 2.5 6.3 6 7 3.5-.7 6-3.5 6-7V5L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06M12.95 12.95l-1.06-1.06M4.11 4.11L3.05 3.05" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
}

const NAV = [
  { href: '/dashboard',            label: 'Dashboard', icon: 'dashboard' },
  { href: '/dashboard/agents',     label: 'AI Agents', icon: 'agents' },
  { href: '/dashboard/contracts',  label: 'Contracts', icon: 'contracts' },
  { href: '/dashboard/research',   label: 'Research',  icon: 'research' },
  { href: '/dashboard/matters',    label: 'Matters',   icon: 'matters' },
  { href: '/dashboard/settings',   label: 'Settings',  icon: 'settings' },
] as const

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const meta = session.user.user_metadata
      setUser({
        name:  meta.full_name || meta.name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
      })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#fafafa' }}>
      {/* Sidebar */}
      <div style={{
        width: 220, height: '100%', background: '#fff',
        borderRight: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <img src="/logo.png" alt="Law OSS" width={26} height={26} style={{ objectFit: 'contain', borderRadius: 6 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f0f0f', letterSpacing: -0.3 }}>Law OSS</span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 7,
                textDecoration: 'none', marginBottom: 1,
                background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
                color: active ? '#0f0f0f' : '#666',
                fontWeight: active ? 600 : 400, fontSize: 13.5,
                transition: 'background 0.12s, color 0.12s',
              }}>
                <span style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>
                  {Icons[item.icon]}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '10px 12px 14px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
            <div style={{
              width: 30, height: 30, background: '#0f0f0f', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, letterSpacing: 0.5,
            }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f0f0f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', height: 30, background: 'transparent',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 6, fontSize: 12.5, color: '#777', cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >Sign out</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
