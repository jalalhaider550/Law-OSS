import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Only create the Prisma client if DATABASE_URL is set — avoids connection errors on startup
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  (process.env.DATABASE_URL
    ? new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
    : (new Proxy({} as PrismaClient, {
        get: () => () => Promise.reject(new Error('DATABASE_URL not configured')),
      }) as unknown as PrismaClient))

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export * from '@prisma/client'
