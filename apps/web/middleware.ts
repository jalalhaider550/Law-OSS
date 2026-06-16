import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  const path = req.nextUrl.pathname
  const loggedIn = !!session

  if (!loggedIn && (path.startsWith('/dashboard') || path.startsWith('/onboarding'))) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (loggedIn && (path === '/login' || path === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
