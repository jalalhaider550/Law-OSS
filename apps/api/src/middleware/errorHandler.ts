import { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message)

  if (err.message === 'NO_API_KEY') {
    res.status(402).json({
      error: 'No API key configured. Please add your key in Settings.',
      code: 'NO_API_KEY',
    })
    return
  }
  if (err.message.includes('authentication_error')) {
    res.status(401).json({
      error: 'Your API key was rejected. Please update it in Settings.',
      code: 'INVALID_API_KEY',
    })
    return
  }
  if (err.message.includes('GEMINI_ERROR:400') || err.message.includes('GEMINI_ERROR:401')) {
    res.status(401).json({
      error: 'Your Gemini API key was rejected. Please update it in Settings.',
      code: 'INVALID_API_KEY',
    })
    return
  }
  if (err.message.includes('rate_limit') || err.message.includes('429')) {
    res.status(429).json({
      error: 'AI rate limit reached. Please wait 60 seconds and try again.',
      code: 'RATE_LIMITED',
    })
    return
  }
  if (err.message === 'NOT_FOUND') {
    res.status(404).json({ error: 'Not found' })
    return
  }
  if (err.message === 'FORBIDDEN') {
    res.status(403).json({ error: 'Access denied' })
    return
  }
  if (err.message === 'FILE_TOO_LARGE') {
    res.status(413).json({ error: 'File too large. Maximum size is 50MB.' })
    return
  }
  if (err.message === 'INVALID_FILE_TYPE') {
    res.status(400).json({ error: 'Invalid file type. Please upload a PDF or DOCX.' })
    return
  }

  res.status(500).json({
    error: 'Something went wrong. Please try again.',
    ...(process.env.NODE_ENV === 'development' && { detail: err.message }),
  })
}
