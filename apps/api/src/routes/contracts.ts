import { Router } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@law-oss/db'
import { callAI } from '@law-oss/ai'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { uploadLimiter } from '../middleware/rateLimit'
import { uploadFile, deleteFile } from '../services/fileStorage'
import { getUserApiKey } from './apiKeys'
// @ts-ignore
import pdfParse from 'pdf-parse'
// @ts-ignore
import mammoth from 'mammoth'

async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer)
    return data.text || ''
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  }
  return ''
}

const router = Router()

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_TYPES.includes(file.mimetype))
  },
})

router.post(
  '/upload',
  requireAuth,
  uploadLimiter,
  upload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Invalid file type. Please upload a PDF or DOCX.' })
        return
      }
      const { matterId } = req.body
      const fileId = uuidv4()
      const storagePath = `contracts/${req.user!.id}/${fileId}-${req.file.originalname}`
      const storageUrl = await uploadFile(
        'contracts',
        storagePath,
        req.file.buffer,
        req.file.mimetype
      )
      const extractedText = await extractText(req.file.buffer, req.file.mimetype).catch(() => '')
      const contract = await prisma.contract.create({
        data: {
          userId: req.user!.id,
          matterId: matterId || undefined,
          filename: req.file.originalname,
          storageUrl,
          fileSize: req.file.size,
          status: 'pending',
        },
      })
      res.status(201).json({ id: contract.id, filename: contract.filename, storageUrl, extractedText })
    } catch (err) {
      next(err)
    }
  }
)

router.post('/:id/analyse', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const contract = await prisma.contract.findUnique({ where: { id: req.params.id } })
    if (!contract) { next(new Error('NOT_FOUND')); return }
    if (contract.userId !== req.user!.id) { next(new Error('FORBIDDEN')); return }

    const apiKeyH = (req.headers["x-api-key"] as string) || ""; const providerH = (req.headers["x-api-provider"] as string) || "claude"; const aiCfg = apiKeyH ? { key: apiKeyH, provider: providerH } : await getUserApiKey(req.user!.id)
    if (!aiCfg) { next(new Error('NO_API_KEY')); return }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`)

    const { extractedText } = req.body as { extractedText?: string }

    send({ type: 'progress', message: 'Extracting text from document...' })
    await prisma.contract.update({ where: { id: contract.id }, data: { status: 'analysing' } })

    send({ type: 'progress', message: 'Detecting governing law and contract type...' })
    send({ type: 'progress', message: 'Analysing contract clauses...' })

    const systemPrompt = `You are a senior legal analyst. Analyse this contract and return JSON with this exact structure:
{
  "summary": "paragraph summary",
  "governingLaw": "jurisdiction",
  "contractType": "type",
  "parties": {"party1": "name", "party2": "name"},
  "riskScore": 65,
  "flags": [{"id":"f1","severity":"critical","title":"title","body":"desc","suggestion":"fix","citation":"ref"}],
  "missingSections": ["section1"],
  "executiveSummary": "summary",
  "citations": [{"type":"c","label":"Case Law","title":"name","citation":"ref","excerpt":"text","confidence":90,"status":"Good law","jurisdiction":"Federal"}]
}
Return ONLY valid JSON, no markdown fences.`

    const contractContent = extractedText
      ? `Contract filename: ${contract.filename}\n\nContract text:\n${extractedText.slice(0, 12000)}`
      : `Contract filename: ${contract.filename}\n\nNote: Text extraction unavailable. Analyse based on filename only.`
    const userMsg = `${contractContent}\n\nAnalyse this contract thoroughly.`

    send({ type: 'progress', message: 'Calculating risk score...' })

    const analysisText = await callAI(
      aiCfg.key,
      aiCfg.provider,
      [{ role: 'user', content: userMsg }],
      systemPrompt,
      3000
    )

    let analysisJson: Record<string, unknown>
    try {
      const cleaned = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysisJson = JSON.parse(cleaned)
    } catch {
      analysisJson = { summary: analysisText, riskScore: 50, flags: [], citations: [] }
    }

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        analysisJson: analysisJson as any,
        riskScore: (analysisJson.riskScore as number) || 50,
        detectedType: analysisJson.contractType as string,
        detectedGoverningLaw: analysisJson.governingLaw as string,
        detectedParties: analysisJson.parties as any,
        status: 'analysed',
      },
    })

    send({ type: 'complete', analysis: analysisJson })
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: (err as Error).message })}\n\n`)
    res.end()
  }
})

router.post('/tabular', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { contractIds, name } = req.body as { contractIds: string[]; name?: string }
    if (!contractIds?.length) {
      res.status(400).json({ error: 'contractIds required' })
      return
    }
    const contracts = await prisma.contract.findMany({
      where: { id: { in: contractIds }, userId: req.user!.id },
    })
    const review = await prisma.tabularReview.create({
      data: {
        userId: req.user!.id,
        name: name || `Tabular Review ${new Date().toLocaleDateString()}`,
        contractIds,
        fieldsJson: contracts.map(c => ({
          id: c.id,
          filename: c.filename,
          type: c.detectedType,
          governingLaw: c.detectedGoverningLaw,
          parties: c.detectedParties,
          riskScore: c.riskScore,
          analysis: c.analysisJson,
        })),
      },
    })
    res.status(201).json(review)
  } catch (err) {
    next(err)
  }
})

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const contracts = await prisma.contract.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json(contracts)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const contract = await prisma.contract.findUnique({ where: { id: req.params.id } })
    if (!contract) throw new Error('NOT_FOUND')
    if (contract.userId !== req.user!.id) throw new Error('FORBIDDEN')
    res.json(contract)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const contract = await prisma.contract.findUnique({ where: { id: req.params.id } })
    if (!contract) throw new Error('NOT_FOUND')
    if (contract.userId !== req.user!.id) throw new Error('FORBIDDEN')
    const publicUrlPrefix = '/storage/v1/object/public/'
    const afterPrefix = contract.storageUrl.split(publicUrlPrefix)[1]
    if (afterPrefix) {
      const [bucket, ...rest] = afterPrefix.split('/')
      await deleteFile(bucket, rest.join('/')).catch(() => {})
    }
    await prisma.contract.delete({ where: { id: req.params.id } })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

export default router
