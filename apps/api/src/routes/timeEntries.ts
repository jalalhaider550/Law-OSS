import { Router } from 'express'
import { prisma } from '@law-oss/db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { matterId, status, from, to } = req.query
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: req.user!.id,
        ...(matterId ? { matterId: matterId as string } : {}),
        ...(status ? { status: status as string } : {}),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from as string) } : {}),
                ...(to ? { lte: new Date(to as string) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
    })
    res.json(entries)
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { description, hours, rate, currency, date, matterId, status } = req.body
    if (!description) { res.status(400).json({ error: 'description is required' }); return }
    if (!hours || Number(hours) <= 0 || Number(hours) > 24) {
      res.status(400).json({ error: 'hours must be between 0 and 24' }); return
    }
    if (!date || isNaN(Date.parse(date))) {
      res.status(400).json({ error: 'valid date is required' }); return
    }
    const entry = await prisma.timeEntry.create({
      data: {
        userId: req.user!.id,
        description,
        hours: parseFloat(hours),
        rate: rate ? parseFloat(rate) : undefined,
        currency: currency || 'USD',
        date: new Date(date),
        matterId: matterId || undefined,
        status: status || 'draft',
      },
    })
    res.status(201).json(entry)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.timeEntry.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.userId !== req.user!.id) throw new Error('FORBIDDEN')
    const { description, hours, rate, currency, date, status } = req.body
    if (hours !== undefined && (Number(hours) <= 0 || Number(hours) > 24)) {
      res.status(400).json({ error: 'hours must be between 0 and 24' }); return
    }
    const entry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        ...(description && { description }),
        ...(hours !== undefined && { hours: parseFloat(hours) }),
        ...(rate !== undefined && { rate: rate ? parseFloat(rate) : null }),
        ...(currency && { currency }),
        ...(date && { date: new Date(date) }),
        ...(status && { status }),
      },
    })
    res.json(entry)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.timeEntry.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.userId !== req.user!.id) throw new Error('FORBIDDEN')
    await prisma.timeEntry.delete({ where: { id: req.params.id } })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

export default router
