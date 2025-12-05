// Load environment variables from .env file in root
// Prisma 7.x doesn't auto-load .env like v6 did
import * as path from 'path'
import * as fs from 'fs'

// Load .env from root directory
const envPath = path.resolve(__dirname, '../../.env')
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath })
}

import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
    // Shadow database is optional - only required for migrations in development
    ...(process.env.SHADOW_DATABASE_URL && {
      shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
    }),
  },
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
})
