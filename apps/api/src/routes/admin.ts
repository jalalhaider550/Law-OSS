import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

function getSupabaseAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Middleware: admin only
async function requireAdmin(req: AuthRequest, res: any, next: any) {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.auth.admin.getUserById(req.user!.id)
  const meta = data?.user?.user_metadata || {}
  if (!meta.isAdmin) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}

// GET /api/admin/users
router.get('/users', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 })
    if (error) throw error
    const users = (data?.users || []).map(u => ({
      id: u.id,
      email: u.email,
      fullName:     u.user_metadata?.full_name || u.user_metadata?.name || '',
      lawFirm:      u.user_metadata?.law_firm || '',
      role:         u.user_metadata?.role || '',
      country:      u.user_metadata?.country || '',
      hasApiKey:    !!u.user_metadata?.apiKey,
      apiProvider:  u.user_metadata?.apiProvider || '',
      isAdmin:      !!u.user_metadata?.isAdmin,
      createdAt:    u.created_at,
      lastSignIn:   u.last_sign_in_at,
    }))
    res.json({ users, total: users.length })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/users/:id/make-admin
router.post('/users/:id/make-admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.auth.admin.updateUserById(req.params.id, {
      user_metadata: { isAdmin: true },
    })
    if (error) throw error
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id === req.user!.id) {
      res.status(400).json({ error: 'Cannot delete yourself' }); return
    }
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.auth.admin.deleteUser(req.params.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
