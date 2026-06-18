import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'signup', 'recovery', etc.

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  // After email confirmation → go to login with a success banner
  if (type === 'signup' || type === 'email') {
    return NextResponse.redirect(`${origin}/login?confirmed=1`)
  }

  // Password recovery → go to dashboard (they're now logged in)
  return NextResponse.redirect(`${origin}/dashboard`)
}
