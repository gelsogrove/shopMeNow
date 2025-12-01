#!/usr/bin/env node

/**
 * Update Prompts Script
 *
 * Reads all .md files from docs/prompts/ and updates the database
 * with the content for each agent type.
 *
 * Usage:
 *   npm run update:prompts
 *   npm run update:prompts -- --workspace abc123
 *   npm run update:prompts -- --agent router
 */

const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const prisma = new PrismaClient()

// Mapping from filename to AgentType
const AGENT_TYPE_MAP = {
  "router-agent.md": "ROUTER",
  "product-search-agent.md": "PRODUCT_SEARCH",
  "cart-management-agent.md": "CART_MANAGEMENT",
  "order-tracking-agent.md": "ORDER_TRACKING",
  "customer-support-agent.md": "CUSTOMER_SUPPORT",
  "profile-management-agent.md": "PROFILE_MANAGEMENT",
}

async function loadPromptFromFile(filename) {
  // Path relative to project root (not apps/backend)
  const filePath = path.join(__dirname, "../../../docs/prompts", filename)

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filename}`)
    console.warn(`   Looking in: ${filePath}`)
    return null
  }

  const content = fs.readFileSync(filePath, "utf-8")
  return content.trim()
}

async function updatePrompt(workspaceId, agentType, promptContent) {
  try {
    // Find agent config
    const agentConfig = await prisma.agentConfig.findFirst({
      where: {
        workspaceId,
        type: agentType,
      },
    })

    if (!agentConfig) {
      console.error(
        `❌ Agent config not found: ${agentType} for workspace ${workspaceId}`
      )
      return false
    }

    // Update systemPrompt
    await prisma.agentConfig.update({
      where: { id: agentConfig.id },
      data: {
        systemPrompt: promptContent,
        updatedAt: new Date(),
      },
    })

    console.log(
      `✅ Updated ${agentType} prompt (${promptContent.length} chars)`
    )
    return true
  } catch (error) {
    console.error(`❌ Error updating ${agentType}:`, error.message)
    return false
  }
}

async function main() {
  console.log("🚀 Starting prompts update...\n")

  // Parse command line arguments
  const args = process.argv.slice(2)
  const workspaceIdArg = args.find((arg) => arg.startsWith("--workspace="))
  const specificAgent = args.find((arg) => arg.startsWith("--agent="))

  // Get all workspaces or specific one
  let workspaces
  if (workspaceIdArg) {
    const workspaceId = workspaceIdArg.split("=")[1]
    workspaces = await prisma.workspace.findMany({
      where: { id: workspaceId },
    })
    if (workspaces.length === 0) {
      console.error(`❌ Workspace not found: ${workspaceId}`)
      process.exit(1)
    }
  } else {
    // Update all workspaces
    workspaces = await prisma.workspace.findMany({
      where: { isActive: true },
    })
  }

  console.log(`📊 Found ${workspaces.length} workspace(s) to update\n`)

  // Determine which agents to update
  let agentFilesToProcess = Object.keys(AGENT_TYPE_MAP)
  if (specificAgent) {
    const agentName = specificAgent.split("=")[1]
    const matchingFile = Object.keys(AGENT_TYPE_MAP).find(
      (filename) =>
        AGENT_TYPE_MAP[filename].toLowerCase() === agentName.toLowerCase()
    )
    if (!matchingFile) {
      console.error(`❌ Invalid agent type: ${agentName}`)
      console.log("Valid types:", Object.values(AGENT_TYPE_MAP).join(", "))
      process.exit(1)
    }
    agentFilesToProcess = [matchingFile]
  }

  let totalUpdated = 0
  let totalFailed = 0

  // Process each workspace
  for (const workspace of workspaces) {
    console.log(`\n📦 Workspace: ${workspace.name} (${workspace.id})`)

    // Process each agent prompt file
    for (const filename of agentFilesToProcess) {
      const agentType = AGENT_TYPE_MAP[filename]
      const promptContent = await loadPromptFromFile(filename)

      if (!promptContent) {
        totalFailed++
        continue
      }

      const success = await updatePrompt(workspace.id, agentType, promptContent)
      if (success) {
        totalUpdated++
      } else {
        totalFailed++
      }
    }
  }

  console.log(`\n\n📊 Summary:`)
  console.log(`✅ Updated: ${totalUpdated}`)
  console.log(`❌ Failed: ${totalFailed}`)
  console.log(`\n✨ Done!`)
}

main()
  .catch((error) => {
    console.error("💥 Fatal error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
