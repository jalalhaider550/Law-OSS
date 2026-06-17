import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const CLIO_CLIENT_ID = process.env.CLIO_CLIENT_ID!
const CLIO_CLIENT_SECRET = process.env.CLIO_CLIENT_SECRET!
const CLIO_REDIRECT_URI = process.env.CLIO_REDIRECT_URI!
const CLIO_AUTH_URL = 'https://app.clio.com/oauth/authorize'
const CLIO_TOKEN_URL = 'https://app.clio.com/oauth/token'
const CLIO_API = 'https://app.clio.com/api/v4'

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function refreshClioToken(userId: string, refreshToken: string): Promise<string | null> {
  const res = await fetch(CLIO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIO_CLIENT_ID,
      client_secret: CLIO_CLIENT_SECRET,
    }),
  })
  if (!res.ok) return null
  const data = await res.json() as any
  const expiry = Date.now() + data.expires_in * 1000
  await adminSupabase().auth.admin.updateUserById(userId, {
    user_metadata: {
      clioAccessToken: data.access_token,
      clioRefreshToken: data.refresh_token || refreshToken,
      clioTokenExpiry: expiry,
    },
  })
  return data.access_token
}

async function getValidToken(userId: string, meta: any): Promise<string | null> {
  const { clioAccessToken, clioRefreshToken, clioTokenExpiry } = meta
  if (!clioAccessToken) return null
  if (clioTokenExpiry && Date.now() < clioTokenExpiry - 60000) return clioAccessToken
  if (!clioRefreshToken) return null
  return refreshClioToken(userId, clioRefreshToken)
}

async function clioFetch(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
}

// GET /api/clio/auth — redirect to Clio OAuth
router.get('/auth', async (req: any, res: any) => {
  try {
    const token = req.query.token as string
    if (!token) return res.status(400).json({ error: 'Missing token' })

    const supabase = adminSupabase()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid token' })

    const state = Buffer.from(user.id).toString('base64')
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIO_CLIENT_ID,
      redirect_uri: CLIO_REDIRECT_URI,
      scope: 'matters contacts documents time_entries',
      state,
    })
    res.redirect(`${CLIO_AUTH_URL}?${params.toString()}`)
  } catch (err) {
    res.status(500).json({ error: 'OAuth initiation failed' })
  }
})

// GET /api/clio/callback — exchange code for tokens
router.get('/callback', async (req: any, res: any) => {
  try {
    const { code, state, error: oauthError } = req.query
    if (oauthError) return res.redirect(`/dashboard/settings?clio=error&reason=${oauthError}`)
    if (!code || !state) return res.status(400).json({ error: 'Missing code or state' })

    const userId = Buffer.from(state as string, 'base64').toString('utf8')

    const tokenRes = await fetch(CLIO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: CLIO_REDIRECT_URI,
        client_id: CLIO_CLIENT_ID,
        client_secret: CLIO_CLIENT_SECRET,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('Clio token exchange failed:', err)
      return res.redirect('/dashboard/settings?clio=error&reason=token_exchange')
    }

    const tokens = await tokenRes.json() as any
    const expiry = Date.now() + tokens.expires_in * 1000

    // Fetch firm info
    let firmName = ''
    try {
      const meRes = await clioFetch(`${CLIO_API}/users/who_am_i.json?fields=name,firm_name`, tokens.access_token)
      if (meRes.ok) {
        const me = await meRes.json() as any
        firmName = me.data?.firm_name || me.data?.name || ''
      }
    } catch {}

    await adminSupabase().auth.admin.updateUserById(userId, {
      user_metadata: {
        clioAccessToken: tokens.access_token,
        clioRefreshToken: tokens.refresh_token,
        clioTokenExpiry: expiry,
        clioFirmName: firmName,
      },
    })

    res.redirect('/dashboard/settings?clio=connected')
  } catch (err) {
    console.error('Clio callback error:', err)
    res.redirect('/dashboard/settings?clio=error&reason=server')
  }
})

// GET /api/clio/status
router.get('/status', requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const supabase = adminSupabase()
    const { data: { user } } = await supabase.auth.admin.getUserById(req.user!.id)
    const meta = user?.user_metadata || {}
    if (!meta.clioAccessToken) return res.json({ connected: false })
    res.json({ connected: true, firmName: meta.clioFirmName || '' })
  } catch {
    res.status(500).json({ error: 'Failed to get status' })
  }
})

// GET /api/clio/matters
router.get('/matters', requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const supabase = adminSupabase()
    const { data: { user } } = await supabase.auth.admin.getUserById(req.user!.id)
    const meta = user?.user_metadata || {}
    const token = await getValidToken(req.user!.id, meta)
    if (!token) return res.status(401).json({ error: 'Clio not connected' })

    const r = await clioFetch(`${CLIO_API}/matters.json?fields=id,display_number,description,status,client{name}&limit=50`, token)
    if (!r.ok) return res.status(r.status).json({ error: 'Clio API error' })

    const data = await r.json() as any
    const matters = (data.data || []).map((m: any) => ({
      id: m.id,
      display_number: m.display_number,
      description: m.description,
      status: m.status,
      client_name: m.client?.name || '',
    }))
    res.json({ matters })
  } catch {
    res.status(500).json({ error: 'Failed to fetch matters' })
  }
})

// GET /api/clio/matters/:id/context
router.get('/matters/:id/context', requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const supabase = adminSupabase()
    const { data: { user } } = await supabase.auth.admin.getUserById(req.user!.id)
    const meta = user?.user_metadata || {}
    const token = await getValidToken(req.user!.id, meta)
    if (!token) return res.status(401).json({ error: 'Clio not connected' })

    const matterId = req.params.id

    const [matterRes, contactsRes, timeRes, docsRes] = await Promise.all([
      clioFetch(`${CLIO_API}/matters/${matterId}.json?fields=id,display_number,description,status,client{name,email_addresses},practice_area{name},open_date,close_date,responsible_attorney{name}`, token),
      clioFetch(`${CLIO_API}/contacts.json?matter_id=${matterId}&fields=id,name,type,email_addresses,phone_numbers&limit=20`, token),
      clioFetch(`${CLIO_API}/activities.json?matter_id=${matterId}&type=TimeEntry&fields=id,date,quantity,note,user{name}&limit=20&order=date(desc)`, token),
      clioFetch(`${CLIO_API}/documents.json?matter_id=${matterId}&fields=id,name,created_at&limit=20`, token),
    ])

    const matter = matterRes.ok ? ((await matterRes.json()) as any).data : null
    const contacts = contactsRes.ok ? ((await contactsRes.json()) as any).data || [] : []
    const timeEntries = timeRes.ok ? ((await timeRes.json()) as any).data || [] : []
    const documents = docsRes.ok ? ((await docsRes.json()) as any).data || [] : []

    let context = `MATTER: ${matter?.display_number || matterId}\n`
    if (matter) {
      context += `Description: ${matter.description || 'N/A'}\n`
      context += `Status: ${matter.status || 'N/A'}\n`
      context += `Client: ${matter.client?.name || 'N/A'}\n`
      context += `Practice Area: ${matter.practice_area?.name || 'N/A'}\n`
      context += `Responsible Attorney: ${matter.responsible_attorney?.name || 'N/A'}\n`
      context += `Opened: ${matter.open_date || 'N/A'}\n`
    }

    if (contacts.length) {
      context += `\nCONTACTS:\n`
      contacts.forEach((c: any) => {
        context += `- ${c.name} (${c.type || 'contact'})`
        const email = c.email_addresses?.[0]?.address
        if (email) context += ` — ${email}`
        context += '\n'
      })
    }

    if (timeEntries.length) {
      context += `\nRECENT TIME ENTRIES:\n`
      timeEntries.slice(0, 10).forEach((t: any) => {
        const hrs = t.quantity ? (t.quantity / 3600).toFixed(1) : '?'
        context += `- ${t.date} | ${t.user?.name || 'Unknown'} | ${hrs}h | ${t.note || ''}\n`
      })
    }

    if (documents.length) {
      context += `\nDOCUMENTS:\n`
      documents.forEach((d: any) => {
        context += `- ${d.name} (${d.created_at?.slice(0, 10) || ''})\n`
      })
    }

    res.json({ context })
  } catch {
    res.status(500).json({ error: 'Failed to fetch matter context' })
  }
})

// DELETE /api/clio/disconnect
router.delete('/disconnect', requireAuth, async (req: AuthRequest, res: any) => {
  try {
    await adminSupabase().auth.admin.updateUserById(req.user!.id, {
      user_metadata: {
        clioAccessToken: null,
        clioRefreshToken: null,
        clioTokenExpiry: null,
        clioFirmName: null,
      },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to disconnect' })
  }
})

export default router
