import fs from "fs"
import path from "path"

/**
 * Load agent prompts from .md files in docs/prompts/
 *
 * This is used by:
 * - seed.ts (initial DB population)
 * - update-prompts.js (runtime updates)
 */

type AgentType =
  | "ROUTER"
  | "PRODUCT_SEARCH"
  | "CART_MANAGEMENT"
  | "ORDER_TRACKING"
  | "CUSTOMER_SUPPORT"
  | "INFO_AGENT"
  | "PROFILE_MANAGEMENT"
  | "NOTIFICATIONS"
  | "TRANSLATION"
  | "SECURITY"
  | "CUSTOM"

// Mapping from filename to AgentType
const AGENT_TYPE_MAP: Record<string, AgentType> = {
  "router-agent.md": "ROUTER",
  "product-search-agent.md": "PRODUCT_SEARCH",
  "cart-management-agent.md": "CART_MANAGEMENT",
  "order-tracking-agent.md": "ORDER_TRACKING",
  "customer-support-agent.md": "CUSTOMER_SUPPORT",
}

export interface AgentPromptData {
  type: AgentType
  content: string
  filename: string
}

/**
 * Load a single prompt file
 */
export function loadPromptFile(filename: string): string | null {
  // Path from backend/prisma/utils to workspace root docs/prompts
  // backend/prisma/utils -> backend/prisma -> backend -> workspace root
  const projectRoot = path.join(__dirname, "../../..")
  const filePath = path.join(projectRoot, "docs/prompts", filename)

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Prompt file not found: ${filename} at ${filePath}`)
    return null
  }

  const content = fs.readFileSync(filePath, "utf-8")
  return content.trim()
}

/**
 * Load all available agent prompts from .md files
 */
export function loadAllPrompts(): AgentPromptData[] {
  const prompts: AgentPromptData[] = []

  for (const [filename, agentType] of Object.entries(AGENT_TYPE_MAP)) {
    const content = loadPromptFile(filename)

    if (content) {
      prompts.push({
        type: agentType,
        content,
        filename,
      })
    } else {
      console.warn(`⚠️  Skipping ${agentType} - file not found`)
    }
  }

  return prompts
}

/**
 * Load prompt for specific agent type
 */
export function loadPromptForAgent(agentType: AgentType): string | null {
  const filename = Object.keys(AGENT_TYPE_MAP).find(
    (key) => AGENT_TYPE_MAP[key] === agentType
  )

  if (!filename) {
    console.error(`❌ No prompt file mapped for agent type: ${agentType}`)
    return null
  }

  return loadPromptFile(filename)
}

/**
 * Get all available agent types with prompts
 */
export function getAvailableAgentTypes(): AgentType[] {
  return Object.values(AGENT_TYPE_MAP)
}
