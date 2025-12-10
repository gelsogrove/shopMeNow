/**
 * UPDATE PROMPTS ONLY
 *
 * This script updates ONLY the agent prompts from docs/prompts/templates/ folder
 * WITHOUT touching other seed data (products, categories, customers, etc.)
 *
 * ⚠️  Updates prompts for the SEED workspace user only
 *
 * Usage: npm run update:prompts
 */

import { config } from "dotenv"
import * as path from "path"

// Load .env from root
config({ path: path.join(__dirname, "../../../.env") })

import { PrismaClient, AgentType } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import * as fs from "fs"

// Initialize the PostgreSQL adapter for Prisma 7
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({ adapter })

// Mapping: prompt filename → AgentType
const PROMPT_TO_AGENT_TYPE: Record<string, AgentType> = {
  "01-router.template.md": "ROUTER",
  "02-product-search.template.md": "PRODUCT_SEARCH",
  "03-cart-management.template.md": "CART_MANAGEMENT",
  "03-order-tracking.template.md": "ORDER_TRACKING",
  "04-customer-support.template.md": "CUSTOMER_SUPPORT",
  "08-summary.template.md": "SUMMARY_AGENT",
  "05-profile-management.template.md": "PROFILE_MANAGEMENT",
  "07-translation.template.md": "TRANSLATION",
  // 🔒 SECURITY agent (06-security.template.md) is HARDCODED in code for safety - NOT configurable via UI/database
  // See: apps/backend/src/application/agents/SecurityAgent.ts
}

/**
 * Load prompt from markdown file in templates folder
 */
function loadPrompt(filename: string): string {
  const promptPath = path.join(__dirname, "../../../docs/prompts/templates", filename)
  try {
    return fs.readFileSync(promptPath, "utf-8")
  } catch (error) {
    console.error(`❌ Failed to load prompt: ${filename}`, error)
    throw new Error(`Failed to load prompt file: ${filename}`)
  }
}

async function main() {
  console.log("🔄 Updating agent prompts...")
  console.log("")

  // Find the seed workspace (admin user's workspace)
  const adminEmail = process.env.ADMIN_EMAIL || "andrea_gelsomino@hotmail.com"
  
  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
    },
  })

  if (!adminUser) {
    console.error(`❌ Admin user not found: ${adminEmail}`)
    console.error("   Run 'npm run prisma:seed' first to create the seed data.")
    process.exit(1)
  }

  const workspace = adminUser.workspaces[0]?.workspace
  if (!workspace) {
    console.error(`❌ No workspace found for admin user: ${adminEmail}`)
    process.exit(1)
  }

  console.log(`📦 Workspace: ${workspace.name} (${workspace.id})`)
  console.log(`👤 Admin: ${adminEmail}`)
  console.log("")

  // Update each prompt
  let updated = 0
  let skipped = 0

  for (const [filename, agentType] of Object.entries(PROMPT_TO_AGENT_TYPE)) {
    try {
      const promptContent = loadPrompt(filename)
      
      // Find existing agent config
      const existingAgent = await prisma.agentConfig.findFirst({
        where: {
          workspaceId: workspace.id,
          type: agentType,
        },
      })

      if (!existingAgent) {
        console.log(`⏭️  ${agentType}: Agent not found, skipping`)
        skipped++
        continue
      }

      // Update only the systemPrompt
      await prisma.agentConfig.update({
        where: { id: existingAgent.id },
        data: {
          systemPrompt: promptContent,
          updatedAt: new Date(),
        },
      })

      console.log(`✅ ${agentType}: Updated from ${filename}`)
      updated++
    } catch (error) {
      console.error(`❌ ${agentType}: Failed to update - ${error}`)
    }
  }

  console.log("")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`✅ Updated: ${updated} agents`)
  if (skipped > 0) {
    console.log(`⏭️  Skipped: ${skipped} agents (not found)`)
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

main()
  .catch((e) => {
    console.error("❌ Error updating prompts:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
