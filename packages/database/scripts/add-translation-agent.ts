/**
 * Production Migration: Add TRANSLATION AgentConfig
 * 
 * This script adds the TRANSLATION agent to all existing workspaces.
 * Safe to run multiple times (idempotent).
 * 
 * Usage:
 *   heroku run "cd packages/database && npx tsx scripts/add-translation-agent.ts" --app echatbot-app
 */

import { config } from "dotenv"
config() // Load .env file

import { PrismaClient } from "@echatbot/database"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { TRANSLATION_PROMPT } from "../prisma/data/agent-templates/translation"

// 🔧 HEROKU FIX: Use adapter like seed.ts does
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('heroku') || process.env.DATABASE_URL?.includes('amazonaws')
    ? { rejectUnauthorized: false }
    : false
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🚀 Starting TRANSLATION agent migration...")

  // Get all workspaces
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true },
  })

  console.log(`📊 Found ${workspaces.length} workspaces`)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const workspace of workspaces) {
    try {
      // Check if TRANSLATION agent already exists
      const existing = await prisma.agentConfig.findFirst({
        where: {
          workspaceId: workspace.id,
          type: "TRANSLATION",
        },
      })

      if (existing) {
        console.log(`⏭️  Skipped workspace "${workspace.name}" - TRANSLATION agent already exists`)
        skipped++
        continue
      }

      // Create TRANSLATION agent
      await prisma.agentConfig.create({
        data: {
          workspaceId: workspace.id,
          name: "Safety + Translation",
          type: "TRANSLATION",
          description: "Final layer: translates response to customer's language (IT/EN/ES/PT), blocks profanity and spam, validates external links",
          icon: "Globe",
          systemPrompt: TRANSLATION_PROMPT,
          model: "openai/gpt-4o-mini",
          temperature: 0.3,
          maxTokens: 1000,
          order: 7,
          isActive: true,
          availableFunctions: null,
        },
      })

      console.log(`✅ Created TRANSLATION agent for workspace "${workspace.name}"`)
      created++
    } catch (error) {
      console.error(`❌ Error for workspace "${workspace.name}":`, error)
      errors++
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("📊 Migration Summary:")
  console.log(`   ✅ Created: ${created}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  console.log(`   ❌ Errors:  ${errors}`)
  console.log("=".repeat(60))

  if (errors > 0) {
    throw new Error(`Migration completed with ${errors} errors`)
  }

  console.log("✅ Migration completed successfully!")
}

main()
  .catch((error) => {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
