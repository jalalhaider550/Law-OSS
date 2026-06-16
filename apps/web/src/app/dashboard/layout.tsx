'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/dashboard/agents', label: 'AI Agents', icon: '🤖' },
  { href: '/dashboard/contracts', label: 'Contracts', icon: '📄' },
  { href: '/dashboard/research', label: 'Research', icon: '🔍' },
  { href: '/dashboard/matters', label: 'Matters', icon: '⚖️' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const meta = session.user.user_metadata
      setUser({
        name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
      })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

  const sidebar = (
    <div style={{
      width: 220, height: '100%', background: '#fff', borderRight: '1px solid rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <img src="/logo.png" alt="Law OSS" width={28} height={28} style={{ objectFit: 'contain', borderRadius: 7 }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0f0f0f' }}>Law <span style={{ color: '#0f0f0f' }}>OSS</span></span>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
              textDecoration: 'none', marginBottom: 2,
              background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
              color: active ? '#0f0f0f' : '#555',
              fontWeight: active ? 600 : 400, fontSize: 14,
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 14px 16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, background: '#0f0f0f', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', height: 32, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 7, fontSize: 13, color: '#666', cursor: 'pointer',
        }}>Sign out</button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8f8f8' }}>
      {/* Desktop sidebar */}
      <div style={{ display: 'none' }} className="desktop-sidebar">
        {sidebar}
      </div>
      <div style={{ width: 220, height: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid rgba(0,0,0,0.08)' }}>
        {sidebar}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
