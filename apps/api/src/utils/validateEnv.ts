export function validateEnv(): void {
  // DATABASE_URL is optional — app works without it (keys stored in Supabase metadata)
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ENCRYPTION_SECRET',
  ]
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(key => console.error(`   - ${key}`))
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not set — DB-backed features disabled, using Supabase metadata only.')
  }
}
