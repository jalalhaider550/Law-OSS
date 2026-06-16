import rateLimit from 'express-rate-limit'

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please wait 60 seconds.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Upload limit reached. Please wait an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Rate limit reached. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})
