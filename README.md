# Law OSS

The open source legal AI platform. A free alternative to Harvey and Legora.

> Bring your own Claude or Gemini API key. You pay the provider directly — we make nothing from your usage. Free forever. Self-host it or use it hosted at lawoss.com.

## What is Law OSS?

Law OSS is a free, open-source alternative to Harvey and Legora. Sign up, add your own Claude or Gemini API key in Settings, and every feature is immediately available. Your key is encrypted and stored securely, used server-side to call the AI provider on your behalf.

## Six Specialist Agents

| Agent | What it does |
|-------|--------------|
| Research | Finds case law and statutes with citations verified against CourtListener, BAILII and The National Archives |
| Drafting | Drafts letters, agreements, motions and clauses — outputs a formatted Word document |
| Contract | Reviews contracts clause by clause, flags risk, suggests redlines |
| Litigation | Builds case strategy and litigation chronology |
| Compliance | Identifies applicable regulations and compliance gaps |
| Due Diligence | Structures DD findings across corporate, financial, legal, IP, employment and property |

## Verified Legal Research

Every citation is checked against real databases before it reaches you — CourtListener for US case law, and The National Archives for UK case law and legislation. If a source cannot be verified, Law OSS says so.

## Tech Stack

- Frontend: Next.js 14 (App Router), deployed on Vercel
- Backend: Express + TypeScript, deployed on Railway
- Database: Supabase (Postgres, Auth, Storage)
- ORM: Prisma
- AI: Claude (Anthropic) and Gemini (Google), user-supplied key

## Quick Start — Use it hosted

1. Go to https://lawoss.com
2. Sign up
3. Add your Claude or Gemini API key in Settings
4. Start using any of the 6 agents, contract review, or research

## Self-Hosting

Requirements: Node.js 20+, a free Supabase account, a Claude or Gemini API key.

```bash
git clone https://github.com/jalalhaider550/Law-OSS.git
cd Law-OSS
npm install
```

Create a Supabase project. Create storage buckets named `contracts` and `documents`. Copy your project URL, anon key, and service role key.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in your Supabase values, then:

```bash
npm run db:push
npm run dev
```

Open http://localhost:3000

### Deploying to production

- Frontend (`apps/web`) → Vercel
- Backend (`apps/api`) → Railway

## How API Keys Work

1. You add your Claude or Gemini API key in Settings
2. Law OSS verifies the key works with the provider
3. The key is encrypted (AES-256) and stored in your database
4. Every AI request uses your key to call Anthropic or Google directly — you pay the provider, not us

Get a key: console.anthropic.com (Claude) or aistudio.google.com (Gemini). Typical cost: a few cents per task.

## License

Certain Law OSS software is made available under open-source licences. Your use of that software is governed by the applicable open-source licence terms.

Commercial licensing available on request.

## Disclaimer

Law OSS is not a substitute for professional legal advice. Currently in beta. See full Terms at https://lawoss.com/terms
