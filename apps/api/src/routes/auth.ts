import { Router } from 'express'
import { prisma } from '@law-oss/db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.upsert({
      where: { id: req.user!.id },
      create: { id: req.user!.id, email: req.user!.email },
      update: { email: req.user!.email },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
})

export default router
