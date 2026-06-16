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

app.use(errorHandler)

const server = app.listen(PORT, () => {
  console.log(`
  ⚖️  Law OSS API
  ─────────────────────
  Local:   http://localhost:${PORT}
  Health:  http://localhost:${PORT}/health
  Env:     ${process.env.NODE_ENV || 'development'}
  `)
})
server.timeout = 300000
server.keepAliveTimeout = 300000

export default app
