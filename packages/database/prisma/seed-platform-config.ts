/**
 * SEED ONLY PLATFORM CONFIG
 * 
 * Safe to run in production - only UPSERTs platform_config table
 * Does NOT delete or modify any other data
 * 
 * Usage: npx ts-node prisma/seed-platform-config.ts
 */

import { config } from "dotenv"
config() // Load environment variables

import { PrismaClient } from "@echatbot/database"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { platformConfigData } from "./data/platformConfig"

// 🔧 HEROKU FIX: Always use adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('heroku') || process.env.DATABASE_URL?.includes('amazonaws') || process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 Seeding platform configuration...")

  let created = 0
  let updated = 0

  for (const config of platformConfigData) {
    const existing = await prisma.platformConfig.findUnique({
      where: { key: config.key }
    })

    const result = await prisma.platformConfig.upsert({
      where: { key: config.key },
      update: {
        type: config.type,
        value: config.value,
        originalValue: config.originalValue,
        description: config.description,
        isActive: config.isActive,
      },
      create: {
        type: config.type,
        key: config.key,
        value: config.value,
        originalValue: config.originalValue,
        description: config.description,
        isActive: config.isActive,
      },
    })

    if (existing) {
      updated++
      console.log(`  ✏️  Updated: ${config.key}`)
    } else {
      created++
      console.log(`  ➕ Created: ${config.key}`)
    }
  }

  console.log(`\n✅ Completed:`)
  console.log(`   - Created: ${created}`)
  console.log(`   - Updated: ${updated}`)
  console.log(`   - Total: ${platformConfigData.length}`)
  console.log(`   - Prices: ${platformConfigData.filter((p) => p.type === "PRICE").length}`)
  console.log(`   - Flags: ${platformConfigData.filter((p) => p.type === "FLAG").length}`)
  console.log(`   - Limits: ${platformConfigData.filter((p) => p.type === "LIMIT").length}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error("❌ Error:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
