'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function useToken(): string | null {
  const [token, setToken] = useState<string | null>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setToken(session?.access_token ?? null)
    )
    return () => subscription.unsubscribe()
  }, [supabase])

  return token
}
