#!/bin/bash
echo "⚖️  Starting Law OSS development servers..."
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:3001"
echo "DB Studio: npm run db:studio"
echo ""
npx turbo run dev --parallel
