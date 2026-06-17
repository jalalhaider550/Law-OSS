import { Router } from 'express'
import { prisma } from '@law-oss/db'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { encrypt, decrypt } from '../services/encryption'
import { verifyApiKey } from '@law-oss/ai'
import { authLimiter } from '../middleware/rateLimit'

const router = Router()

router.get('/status', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await getUserApiKey(req.user!.id)
    if (!result) { res.json({ hasKey: false }); return }
    res.json({ hasKey: true, provider: result.provider })
  } catch (err) {
    next(err)
  }
})

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

    // Ensure a User row exists (Supabase users don't auto-create Prisma records)
    const userId = req.user!.id
    const userEmail = req.user!.email || `${userId}@unknown.local`
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: userEmail },
      update: {},
    })

    const encryptedKey = encrypt(apiKey)
    const keyPreview = apiKey.slice(0, 8) + '...' + apiKey.slice(-4)

    await prisma.apiKey.upsert({
      where: { userId },
      create: { userId, provider, encryptedKey, keyPreview, verifiedAt: new Date() },
      update: { provider, encryptedKey, keyPreview, verifiedAt: new Date() },
    })

    res.json({ hasKey: true, provider, keyPreview, verifiedAt: new Date() })
  } catch (err) {
    next(err)
  }
})

// Sync key from client without re-verification (key already verified client-side)
router.post('/sync', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { provider, apiKey } = req.body as { provider: string; apiKey: string }
    if (!apiKey || !provider) { res.status(400).json({ error: 'provider and apiKey are required' }); return }
    const encryptedKey = encrypt(apiKey)
    const keyPreview = apiKey.slice(0, 8) + '...' + apiKey.slice(-4)
    await prisma.apiKey.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, provider, encryptedKey, keyPreview, verifiedAt: new Date() },
      update: { provider, encryptedKey, keyPreview, verifiedAt: new Date() },
    })
    res.json({ synced: true })
  } catch (err) { next(err) }
})

router.delete('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await prisma.apiKey.deleteMany({ where: { userId: req.user!.id } })
    res.json({ removed: true })
  } catch (err) {
    next(err)
  }
})

export async function getUserApiKey(
  userId: string
): Promise<{ key: string; provider: string } | null> {
  // First try Supabase user metadata (new approach)
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase.auth.admin.getUserById(userId)
    const meta = data?.user?.user_metadata
    if (meta?.apiKey) {
      return { key: meta.apiKey, provider: meta.apiProvider || 'claude' }
    }
  } catch {}
  // Fallback: DB record
  try {
    const record = await prisma.apiKey.findUnique({ where: { userId } })
    if (!record) return null
    return { key: decrypt(record.encryptedKey), provider: record.provider }
  } catch {
    return null
  }
}

export default router
