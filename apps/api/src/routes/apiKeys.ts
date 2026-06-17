import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { verifyApiKey } from '@law-oss/ai'
import { authLimiter } from '../middleware/rateLimit'

const router = Router()

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /status — check if user has a key configured
router.get('/status', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await getUserApiKey(req.user!.id)
    if (!result) { res.json({ hasKey: false }); return }
    const preview = result.key.slice(0, 8) + '...' + result.key.slice(-4)
    res.json({ hasKey: true, provider: result.provider, keyPreview: preview })
  } catch (err) {
    next(err)
  }
})

// POST / — save API key into Supabase user metadata (no DB needed)
router.post('/', requireAuth, authLimiter, async (req: AuthRequest, res, next) => {
  try {
    const { provider, apiKey } = req.body as { provider: string; apiKey: string }
    if (!apiKey || !provider) {
      res.status(400).json({ error: 'provider and apiKey are required' })
      return
    }

    const valid = await verifyApiKey(provider, apiKey).catch(() => false)
    if (!valid) {
      res.status(401).json({ error: 'API key verification failed. Please check your key.' })
      return
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.auth.admin.updateUserById(req.user!.id, {
      user_metadata: { apiKey, apiProvider: provider },
    })
    if (error) throw new Error(error.message)

    const keyPreview = apiKey.slice(0, 8) + '...' + apiKey.slice(-4)
    res.json({ hasKey: true, provider, keyPreview })
  } catch (err) {
    next(err)
  }
})

// DELETE / — remove API key from Supabase user metadata
router.delete('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.auth.admin.updateUserById(req.user!.id, {
      user_metadata: { apiKey: null, apiProvider: null },
    })
    res.json({ removed: true })
  } catch (err) {
    next(err)
  }
})

// GET key for internal use by AI routes
export async function getUserApiKey(
  userId: string
): Promise<{ key: string; provider: string } | null> {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.auth.admin.getUserById(userId)
    const meta = data?.user?.user_metadata
    if (meta?.apiKey) {
      return { key: meta.apiKey, provider: meta.apiProvider || 'claude' }
    }
    return null
  } catch {
    return null
  }
}

export default router
