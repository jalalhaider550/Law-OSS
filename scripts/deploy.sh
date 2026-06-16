#!/bin/bash
set -e
echo "🚀 Deploying Law OSS to production..."

echo "Building all packages..."
npm run build
echo "✅ Build passed"

echo "Running database migrations..."
npm run db:migrate:prod
echo "✅ Database migrated"

echo "Deploying API to Railway..."
if command -v railway &>/dev/null; then
  cd apps/api && railway up --service api && cd ../..
  echo "✅ API deployed to Railway"
else
  echo "⚠️  Railway CLI not found. Install: npm install -g @railway/cli"
  echo "    Then login: railway login"
  echo "    Then deploy: cd apps/api && railway up --service api"
fi

echo "Deploying frontend to Vercel..."
if command -v vercel &>/dev/null; then
  cd apps/web && vercel --prod && cd ../..
  echo "✅ Frontend deployed to Vercel"
else
  echo "⚠️  Vercel CLI not found. Install: npm install -g vercel"
  echo "    Then login: vercel login"
  echo "    Then deploy: cd apps/web && vercel --prod"
fi

echo ""
echo "✅ Deployment complete!"
