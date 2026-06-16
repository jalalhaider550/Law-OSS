import { Router } from 'express'
import { prisma } from '@law-oss/db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { status } = req.query
    const matters = await prisma.matter.findMany({
      where: {
        userId: req.user!.id,
        ...(status ? { status: status as string } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(matters)
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { name, type, court, attorney, value, currency, dueDate, notes } = req.body
    if (!name || !type) {
      res.status(400).json({ error: 'name and type are required' })
      return
    }
    const matter = await prisma.matter.create({
      data: {
        userId: req.user!.id,
        name,
        type,
        court: court || undefined,
        attorney: attorney || undefined,
        value: value ? parseFloat(value) : undefined,
        currency: currency || 'USD',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes: notes || undefined,
      },
    })
    res.status(201).json(matter)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const matter = await prisma.matter.findUnique({
      where: { id: req.params.id },
      include: { contracts: true, timeEntries: true, documents: true },
    })
    if (!matter) throw new Error('NOT_FOUND')
    if (matter.userId !== req.user!.id) throw new Error('FORBIDDEN')
    res.json(matter)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.matter.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.userId !== req.user!.id) throw new Error('FORBIDDEN')
    const { name, type, status, court, attorney, value, currency, dueDate, notes } = req.body
    const matter = await prisma.matter.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(status && { status }),
        ...(court !== undefined && { court }),
        ...(attorney !== undefined && { attorney }),
        ...(value !== undefined && { value: value ? parseFloat(value) : null }),
        ...(currency && { currency }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    })
    res.json(matter)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.matter.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.userId !== req.user!.id) throw new Error('FORBIDDEN')
    await prisma.matter.update({
      where: { id: req.params.id },
      data: { status: 'archived' },
    })
    res.json({ archived: true })
  } catch (err) {
    next(err)
  }
})

export default router
