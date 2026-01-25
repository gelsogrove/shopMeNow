import 'dotenv/config'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma 7 Configuration
 * Required for migrations and CLI operations
 */
export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(__dirname, 'prisma', 'migrations'),
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL
      ? `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes('?') ? '&' : '?'}sslmode=disable`
      : '',
  },
})
