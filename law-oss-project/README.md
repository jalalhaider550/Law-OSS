# ⚖️ Law OSS

**The world's most advanced open-source legal AI platform.**

> Bring your own Anthropic API key. Your data never leaves your device. Free forever.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red)](https://github.com/law-oss/law-oss)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20claude-sonnet-4-6-navy)](https://anthropic.com)
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

### Option 3 — Full stack deployment

```bash
git clone https://github.com/law-oss/law-oss
cd law-oss
docker compose up -d
open http://localhost:3000
```

---

## 🔑 How API Keys Work

Law OSS is **BYOK** — Bring Your Own Key.

```
User opens Law OSS
       ↓
First-time onboarding (4 steps)
       ↓
Enters Anthropic API key
       ↓
Law OSS verifies key directly with Anthropic
       ↓
Key stored in browser localStorage (obfuscated)
       ↓
Every AI call goes: Browser → Anthropic directly
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
**Cost:** ~$0.003 per AI task (Claude claude-sonnet-4-6)

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
├── law-oss-us.html          # US Edition (self-contained)
├── law-oss-uk.html          # UK Edition (self-contained)
├── onboarding.js            # API key onboarding system
├── core.css                 # Shared design system
├── core.js                  # Shared JS engine
├── gen.py                   # HTML generator
├── docs/
│   ├── PRD.md               # Product Requirements
│   ├── TECHNICAL_SPEC.md    # Technical Specification
│   └── SECURITY.md          # Security model
├── packages/
│   └── db/schema.prisma     # Full database schema
├── docker-compose.yml       # Full stack deployment
└── CONTRIBUTING.md
```

### For full-stack deployment (Next.js + NestJS)

```
apps/
├── web/     ← Next.js 14 + TypeScript + Tailwind
└── api/     ← NestJS + Prisma + PostgreSQL + pgvector
```

---

## 🔒 Security

- **API keys** — stored obfuscated in localStorage, never transmitted to Law OSS
- **Data** — all AI calls go browser → Anthropic directly
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

MIT License — free to use, modify, and distribute.

See [LICENSE](LICENSE) for details.

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
