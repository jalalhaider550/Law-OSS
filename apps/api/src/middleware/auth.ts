import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@law-oss/db'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AuthRequest extends Request {
  user?: { id: string; email: string }
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      res.status(401).json({ error: 'No token provided' })
      return
    }
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }
    req.user = { id: user.id, email: user.email! }
    prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email! },
      update: { email: user.email! },
    }).catch(() => {}) // non-blocking, DB may be unavailable
    next()
  } catch {
    res.status(401).json({ error: 'Authentication failed' })
  }
}
