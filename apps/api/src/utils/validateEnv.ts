export function validateEnv(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'ENCRYPTION_SECRET',
  ]
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(key => console.error(`   - ${key}`))
    console.error('\nCopy .env.example to .env and fill in the values.')
    process.exit(1)
  }
}
