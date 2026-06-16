#!/bin/bash
set -e
echo "⚖️  Setting up Law OSS..."

if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "Node.js $(node --version) ✓"

echo "Installing dependencies..."
npm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "✅ Created .env file"
  echo ""
  echo "⚠️  IMPORTANT: Fill in these values in .env before running:"
  echo "   NEXT_PUBLIC_SUPABASE_URL        — Supabase dashboard → Settings → API"
  echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY   — Supabase dashboard → Settings → API"
  echo "   SUPABASE_SERVICE_ROLE_KEY       — Supabase dashboard → Settings → API"
  echo "   DATABASE_URL                    — Supabase dashboard → Settings → Database"
  echo "   DIRECT_DATABASE_URL             — Same connection, no pgbouncer"
  echo "   ENCRYPTION_SECRET               — Run: openssl rand -hex 32"
  echo ""
  echo "Then run: npm run setup:db"
  exit 0
fi

echo "Generating Prisma client..."
npm run db:generate

echo "Pushing database schema to Supabase..."
npm run db:push

# Copy HTML app files to Next.js public dir
bash apps/web/scripts/copy-html.sh

echo ""
echo "✅ Law OSS is ready!"
echo ""
echo "Start development: npm run dev"
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:3001"
