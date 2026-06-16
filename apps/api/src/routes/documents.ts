import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import { prisma } from '@law-oss/db'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { uploadFile, getSignedUrl } from '../services/fileStorage'
import type { DraftedDocument } from '@law-oss/types'
// @ts-ignore
import pdfParse from 'pdf-parse'
// @ts-ignore
import mammoth from 'mammoth'

const router = Router()

const extractUpload = multer({
  storage: multer.memoryStorage(),
})

router.post('/extract', requireAuth, extractUpload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }
    const { mimetype, buffer, originalname } = req.file
    let text = ''
    if (mimetype === 'application/pdf') {
      const data = await pdfParse(buffer)
      text = data.text || ''
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value || ''
    } else {
      res.status(400).json({ error: 'Only PDF and DOCX files are supported' }); return
    }
    res.json({ text: text.slice(0, 15000), filename: originalname })
  } catch (err) {
    next(err)
  }
})

router.post('/generate', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { documentJson } = req.body as { documentJson: DraftedDocument }
    if (!documentJson) {
      res.status(400).json({ error: 'documentJson is required' })
      return
    }

    const docId = uuidv4()
    const filename = `${(documentJson.title || 'document').replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`
    const storagePath = `documents/${req.user!.id}/${docId}/${filename}`
    const buffer = Buffer.from(JSON.stringify(documentJson))
    await uploadFile('documents', storagePath, buffer, 'application/json')

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const doc = await prisma.generatedDocument.create({
      data: {
        userId: req.user!.id,
        storagePath,
        filename,
        documentType: documentJson.type,
        documentJson: documentJson as any,
        expiresAt,
      },
    })

    const signedUrl = await getSignedUrl('documents', storagePath)
    res.status(201).json({ documentId: doc.id, signedUrl, filename })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const doc = await prisma.generatedDocument.findUnique({ where: { id: req.params.id } })
    if (!doc) throw new Error('NOT_FOUND')
    if (doc.userId !== req.user!.id) throw new Error('FORBIDDEN')
    const signedUrl = await getSignedUrl('documents', doc.storagePath)
    res.json({ ...doc, signedUrl })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const doc = await prisma.generatedDocument.findUnique({ where: { id: req.params.id } })
    if (!doc) throw new Error('NOT_FOUND')
    if (doc.userId !== req.user!.id) throw new Error('FORBIDDEN')
    const { documentJson } = req.body
    const buffer = Buffer.from(JSON.stringify(documentJson))
    await uploadFile('documents', doc.storagePath, buffer, 'application/json')
    await prisma.generatedDocument.update({
      where: { id: req.params.id },
      data: { documentJson },
    })
    res.json({ updated: true })
  } catch (err) {
    next(err)
  }
})

router.get('/:id/download', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const doc = await prisma.generatedDocument.findUnique({ where: { id: req.params.id } })
    if (!doc) throw new Error('NOT_FOUND')
    if (doc.userId !== req.user!.id) throw new Error('FORBIDDEN')
    const url = await getSignedUrl('documents', doc.storagePath)
    res.json({ url })
  } catch (err) {
    next(err)
  }
})

export default router
