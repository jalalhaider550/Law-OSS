import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import { errorHandler } from './middleware/errorHandler'
import { validateEnv } from './utils/validateEnv'
import { apiLimiter } from './middleware/rateLimit'
import authRoutes from './routes/auth'
import contractRoutes from './routes/contracts'
import matterRoutes from './routes/matters'
import researchRoutes from './routes/research'
import agentRoutes from './routes/agents'
import documentRoutes from './routes/documents'
import timeEntryRoutes from './routes/timeEntries'
import apiKeyRoutes from './routes/apiKeys'
import adminRoutes from './routes/admin'
import clioRoutes from './routes/clio'

validateEnv()

const app = express()
const PORT = process.env.PORT || 3001

app.set('trust proxy', 1)
app.use(helmet({ crossOriginEmbedderPolicy: false }))

// Open CORS — must be before all routes
app.use((req: any, res: any, next: any) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with, x-api-key, x-api-provider')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})
app.use(express.json({ limit: '500mb' }))
app.use(express.urlencoded({ extended: true, limit: '500mb' }))
app.use('/api', apiLimiter)

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/contracts', contractRoutes)
app.use('/api/matters', matterRoutes)
app.use('/api/research', researchRoutes)
app.use('/api/agents', agentRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/time-entries', timeEntryRoutes)
app.use('/api/api-keys', apiKeyRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/clio', clioRoutes)

app.post('/api/contact', async (req: any, res: any) => {
  const { name, email, message } = req.body
  if (!name || !email || !message) return res.status(400).json({ error: 'All fields required' })
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    await sb.from('contact_messages').insert({ name, email, message })
    res.json({ sent: true })
  } catch {
    res.status(500).json({ error: 'Could not send' })
  }
})

app.use(errorHandler)

const server = app.listen(PORT, () => {
  console.log(`
  ⚖️  Law OSS API
  ─────────────────────
  Local:   http://localhost:${PORT}
  Health:  http://localhost:${PORT}/health
  Env:     ${process.env.NODE_ENV || 'development'}
  Build:   ${new Date().toISOString().slice(0,10)}
  `)
})
server.timeout = 300000
server.keepAliveTimeout = 300000

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason)
})

export default app
