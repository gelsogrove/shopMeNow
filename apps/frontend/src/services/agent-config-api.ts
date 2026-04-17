import { logger } from "@/lib/logger"
import { api } from "./api"

/**
 * Agent Configuration API - for new AgentConfig system
 * Handles multi-agent LLM system configuration
 */

export interface AgentConfigData {
  id: string
  name: string
  type: string
  description: string
  icon: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  order: number
  availableFunctions: string[] | null
}

/**
 * Get agent configurations with real availableFunctions from database
 */
export async function getAgentConfigs(workspaceId: string): Promise<{
  agents: AgentConfigData[]
}> {
  logger.info(`Fetching agent configs for workspace ${workspaceId}`)

  try {
    const url = `/workspaces/${workspaceId}/agent-config`
    logger.info(`GET request URL: ${url}`)

    const response = await api.get(url, {
      headers: {
        "x-workspace-id": workspaceId,
      },
    })

    logger.info(`Agent configs response:`, response.data)
    return response.data
  } catch (error) {
    logger.error("Error fetching agent configs:", error)
    throw error
  }
}

/**
 * Update an agent configuration
 */
export async function updateAgentConfig(
  workspaceId: string,
  agentId: string,
  data: Partial<AgentConfigData>
): Promise<AgentConfigData> {
  logger.info(`Updating agent config ${agentId} for workspace ${workspaceId}`, data)

  const response = await api.put(
    `/workspaces/${workspaceId}/agent-config/${agentId}`,
    data,
    {
      headers: {
        "x-workspace-id": workspaceId,
      },
    }
  )

  return response.data
}

/**
 * Reset all agent prompts to default values
 * WARNING: This will overwrite all customizations!
 */
export async function resetAgentPromptsToDefaults(
  workspaceId: string,
  useDynamicTemplates: boolean = false
): Promise<{ message: string; resetCount: number; templateSource?: string }> {
  logger.info(
    `Resetting agent prompts to defaults for workspace ${workspaceId} (dynamic: ${useDynamicTemplates})`
  )

  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/agent-config/reset-to-defaults`,
      { useDynamicTemplates },
      {
        headers: {
          "x-workspace-id": workspaceId,
        },
      }
    )

    logger.info(`Reset response:`, response.data)
    return response.data
  } catch (error) {
    logger.error("Error resetting agent prompts:", error)
    throw error
  }
}

/**
 * Export all agent prompts as a ZIP file
 * Downloads a ZIP containing .md files for each agent
 */
export async function exportAgentPrompts(workspaceId: string): Promise<void> {
  logger.info(`Exporting agent prompts for workspace ${workspaceId}`)

  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/agent-config/export`,
      {
        headers: {
          "x-workspace-id": workspaceId,
        },
        responseType: "blob",
      }
    )

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers["content-disposition"]
    let filename = "agent-prompts.zip"
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/)
      if (match) {
        filename = match[1]
      }
    }

    // Create download link and trigger download
    const blob = new Blob([response.data], { type: "application/zip" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    logger.info(`Successfully downloaded ${filename}`)
  } catch (error) {
    logger.error("Error exporting agent prompts:", error)
    throw error
  }
}
