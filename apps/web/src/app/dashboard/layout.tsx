'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

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
  compare: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="6" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="2" width="6" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3.5 5.5h3M3.5 8h3M3.5 10.5h3M9.5 5.5h3M9.5 8h3M9.5 10.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".7"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06M12.95 12.95l-1.06-1.06M4.11 4.11L3.05 3.05" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  admin: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M12 9v5.5M9.5 11.75H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  menu: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
}

const NAV = [
  { href: '/dashboard',            label: 'Dashboard', icon: 'dashboard' },
  { href: '/dashboard/agents',     label: 'AI Agents', icon: 'agents' },
  { href: '/dashboard/contracts',  label: 'Contracts', icon: 'contracts' },
  { href: '/dashboard/compare',    label: 'Compare',   icon: 'compare' },
  { href: '/dashboard/research',   label: 'Research',  icon: 'research' },
  { href: '/dashboard/matters',    label: 'Matters',   icon: 'matters' },
  { href: '/dashboard/settings',   label: 'Settings',  icon: 'settings' },
] as const

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]           = useState<{ name: string; email: string } | null>(null)
  const [isAdmin, setIsAdmin]     = useState(false)
  const [isMobile, setIsMobile]   = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient()

  // Detect mobile on mount and resize
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, sidebarOpen])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const meta = session.user.user_metadata || {}
      setUser({
        name:  meta.full_name || meta.name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
      })
      setIsAdmin(!!meta.isAdmin)

      // Scope all data to this user — clear another user's data if present
      const uid = session.user.id
      const prevUid = localStorage.getItem('law_oss_uid')
      if (prevUid && prevUid !== uid) {
        // Different user logged in on this browser — wipe their scoped data
        ;['law_oss_matters', 'law_oss_contracts_v2', 'law_oss_api_key', 'law_oss_provider'].forEach(k => localStorage.removeItem(k))
      }
      localStorage.setItem('law_oss_uid', uid)

      // Sync API key from account metadata → namespaced localStorage key
      const scopedKeyName = `law_oss_api_key_${uid}`
      const scopedProviderName = `law_oss_provider_${uid}`
      if (meta.law_oss_api_key && !localStorage.getItem(scopedKeyName)) {
        localStorage.setItem(scopedKeyName, meta.law_oss_api_key)
        localStorage.setItem(scopedProviderName, meta.law_oss_provider || 'claude')
      }
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }} onClick={() => setSidebarOpen(false)}>
          <img src="/logo.png" alt="Law OSS" width={26} height={26} style={{ objectFit: 'contain', borderRadius: 6 }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0f0f0f', letterSpacing: -0.3 }}>Law OSS</span>
        </Link>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 4 }}>
            {Icons.close}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 7,
              textDecoration: 'none', marginBottom: 1,
              background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
              color: active ? '#0f0f0f' : '#666',
              fontWeight: active ? 600 : 400, fontSize: 14,
              transition: 'background 0.12s, color 0.12s',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <span style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>
                {Icons[item.icon as keyof typeof Icons]}
              </span>
              {item.label}
            </Link>
          )
        })}
        {isAdmin && (() => {
          const active = pathname.startsWith('/dashboard/admin')
          return (
            <Link href="/dashboard/admin" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 7,
              textDecoration: 'none', marginTop: 8,
              borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 12,
              background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
              color: active ? '#0f0f0f' : '#666',
              fontWeight: active ? 600 : 400, fontSize: 14,
              WebkitTapHighlightColor: 'transparent',
            }}>
              <span style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>{Icons.admin}</span>
              Admin
            </Link>
          )
        })()}
      </nav>

      {/* User */}
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
          <div style={{
            width: 32, height: 32, background: '#0f0f0f', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, letterSpacing: 0.5,
          }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f0f0f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', height: 32, background: 'transparent',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 6, fontSize: 13, color: '#777', cursor: 'pointer',
        }}>Sign out</button>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fafafa', overflow: 'hidden' }}>
        {/* Mobile top bar */}
        <div style={{
          height: 52, background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0,
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f0f0f', padding: '4px', display: 'flex', alignItems: 'center' }}>
            {Icons.menu}
          </button>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flex: 1 }}>
            <img src="/logo.png" alt="Law OSS" width={24} height={24} style={{ objectFit: 'contain', borderRadius: 5 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f0f0f', letterSpacing: -0.3 }}>Law OSS</span>
          </Link>
          <div style={{
            width: 30, height: 30, background: '#0f0f0f', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0,
          }}>{initials}</div>
        </div>

        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(1px)' }}
          />
        )}
        <div style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 300,
          width: 260, background: '#fff',
          display: 'flex', flexDirection: 'column',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.15)' : 'none',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          {sidebarContent}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#fafafa' }}>
      <div style={{
        width: 220, height: '100%', background: '#fff',
        borderRight: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {sidebarContent}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
