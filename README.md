# ⚖️ Law OSS

**The world's most advanced open-source legal AI platform.**

> Bring your own Anthropic API key. Your data never leaves your device. Free forever.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red)](https://github.com/law-oss/law-oss)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20Sonnet-navy)](https://anthropic.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

---

## ✨ What is Law OSS?

Law OSS is the **free, open-source alternative** to Harvey and Legora. It runs entirely in your browser, stores your API key locally on your device, and connects directly to Anthropic's Claude API — no middleman, no subscription, no data leaving your machine.

### 8 Live AI Agents

| Agent | What it does |
|-------|-------------|
| 📚 **Research Agent** | Finds case law & statutes with verified citations |
| ✍️ **Drafting Agent** | Drafts motions, contracts, letters |
| 📋 **Contract Agent** | Reviews contracts for risk & negotiation positions |
| ⚖️ **Litigation Agent** | Builds case strategy & win probability |
| 🛡️ **Compliance Agent** | Analyses regulatory obligations |
| 🔍 **Due Diligence Agent** | Structures transaction DD |
| 👤 **Client Agent** | Drafts plain-English client communications |
| 💰 **Billing Agent** | Reviews time narratives & billing compliance |

---

## 🚀 Quick Start

### Option 1 — Open directly in browser (no install)

1. Download `law-oss-us.html` (US) or `law-oss-uk.html` (UK)
2. Open the file in Chrome, Firefox, or Safari
3. Enter your Anthropic API key when prompted
4. Done — all 8 agents are live

### Option 2 — Host on Netlify (free, 30 seconds)

1. Go to [netlify.com/drop](https://netlify.com/drop)
2. Drag the HTML file onto the page
3. Share the URL with your team

### Option 3 — Self-host the full stack

See the [Self-Hosting](#-self-hosting) section below.

---

## 🔑 How API Keys Work

Law OSS is **BYOK** — Bring Your Own Key.

```
User opens Law OSS
       ↓
First-time onboarding (4 steps)
       ↓
Enters Anthropic or Gemini API key
       ↓
Law OSS verifies key directly with the provider
       ↓
Key stored in browser localStorage (obfuscated)
       ↓
Every AI call goes: Browser → Anthropic/Gemini directly
       ↓
Law OSS servers NEVER see your key or your data
```

**Your key is:**
- ✅ Stored only in your browser's localStorage
- ✅ Obfuscated (not plaintext)
- ✅ Never sent to Law OSS servers
- ✅ Removable any time via Settings
- ✅ Verifiable — Law OSS is open source

**Get your key:** [console.anthropic.com](https://console.anthropic.com/keys)  
**Cost:** ~$0.003 per AI task (Claude Sonnet)

---

## 🌍 Editions

| Edition | Jurisdiction | Matters | Research |
|---------|-------------|---------|---------|
| 🇺🇸 US Edition | Federal, 9th Circuit, Delaware, California, New York, Texas | Chen v. TechCorp, Meridian Pharma, Lakewood Employment | UCC, Title VII, Delaware corporate law |
| 🇬🇧 UK Edition | England & Wales, UKSC, Scotland | Patel v. Hargreaves (TCC), Meridian UK SPA, Thornton ET | JCT, Equality Act, English contract law |

---

## 🏗️ Architecture

```
law-oss/
├── apps/
│   ├── web/          ← Next.js 14 + TypeScript (frontend)
│   └── api/          ← Express + Prisma + Supabase (backend)
├── packages/
│   ├── db/           ← Prisma schema & client
│   ├── ai/           ← AI provider abstraction
│   └── types/        ← Shared TypeScript types
├── setup/
│   └── schema.sql    ← Full database schema (run once)
└── turbo.json        ← Turborepo config
```

---

## 🖥️ Self-Hosting

### Requirements

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **A free Supabase account** — [supabase.com](https://supabase.com) (database + auth + storage)
- **A Claude or Gemini API key** — users bring their own; you don't need one to run the server

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/law-oss.git
cd law-oss
```

---

### Step 2 — Install dependencies

```bash
npm install
```

---

### Step 3 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (choose any region)
3. In **Storage**, create two buckets named `contracts` and `documents` (set both to private)
4. From **Project Settings → API**, copy:
   - **Project URL** → used as `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → used as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → used as `SUPABASE_SERVICE_ROLE_KEY`
5. From **Project Settings → Database**, copy the **Connection string (URI)** → used as `DATABASE_URL`

---

### Step 4 — Set up the database

**Option A — SQL Editor (easiest)**

1. In your Supabase project, go to **SQL Editor**
2. Paste the contents of `setup/schema.sql` and click **Run**

**Option B — Prisma push**

```bash
# Set DATABASE_URL first (see Step 5), then:
npm run db:push
```

---

### Step 5 — Configure environment variables

```bash
# API backend
cp apps/api/.env.example apps/api/.env

# Web frontend
cp apps/web/.env.example apps/web/.env.local
```

Fill in both files with your Supabase values:

**`apps/api/.env`**
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ENCRYPTION_SECRET=<32 random chars — run: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))">
PORT=3001
NODE_ENV=development
```

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

### Step 6 — Run it

```bash
npm run dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001](http://localhost:3001)

---

### Step 7 — Add your API key

1. Sign up at [http://localhost:3000/signup](http://localhost:3000/signup)
2. Go through onboarding
3. Navigate to **Settings** and paste your Claude or Gemini API key
4. Start using all 8 agents

---

### Deploying to production

| Service | Deploy |
|---------|--------|
| **Frontend** (`apps/web`) | [Vercel](https://vercel.com) — import the repo, set root to `apps/web` |
| **Backend** (`apps/api`) | [Railway](https://railway.app) — import the repo, set root to `apps/api` |

Set the same environment variables in each platform's settings panel. For Vercel, add all `NEXT_PUBLIC_*` vars. For Railway, add the API vars and set `NODE_ENV=production`.

After deploying the API, update `NEXT_PUBLIC_API_URL` in Vercel to point to your Railway URL.

---

## 🔒 Security

- **API keys** — stored obfuscated in localStorage, never transmitted to Law OSS servers
- **Data** — all AI calls go browser → Anthropic/Gemini directly
- **Open source** — every line of code is auditable
- **No telemetry** — we collect nothing
- **Self-hostable** — run entirely on your own infrastructure

---

## 🤝 Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md).

**Good first issues:**
- Additional jurisdiction support
- New agent capabilities
- Mobile responsive improvements
- Additional research database entries
- Translations

---

## 📄 License

The Law OSS source code is MIT licensed — free to use, self-host, and build on.

The hosted service, brand, design, and infrastructure are proprietary. See [LICENSE](LICENSE) for the full distinction.

---

## 🙏 Acknowledgements

Built with [Claude](https://anthropic.com) by Anthropic. Inspired by the belief that every lawyer — regardless of firm size — deserves access to world-class AI tools.

---

<div align="center">
  <strong>⚖️ Law OSS</strong> — Open source legal AI for everyone
  <br><br>
  <a href="https://law-oss.dev">Website</a> ·
  <a href="https://docs.law-oss.dev">Docs</a> ·
  <a href="https://github.com/law-oss/law-oss">GitHub</a> ·
  <a href="https://discord.gg/law-oss">Discord</a>
</div>
