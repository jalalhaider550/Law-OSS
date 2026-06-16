import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Law OSS — Open Source Legal AI',
  description: 'Free open source legal AI. Bring your own Claude or Gemini key.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
