import { logger } from "@/lib/logger"
import { api } from "./api"

/**
 * ⚠️ LEGACY: Vecchio Agent API (stato di transizione)
 * 
 * Queste funzioni sono ancora usate da AgentConfigurationPage mentre il sistema
 * viene migrato completamente a AgentConfig.
 * 
 * TODO: Migrare AgentConfigurationPage a usare AgentConfig direttamente
 */

export interface Agent {
  id: string
  name: string
  content: string
  systemPrompt?: string
  workspaceId: string
  isRouter?: boolean
  department?: string | null
  temperature?: number
  top_p?: number
  top_k?: number
  model?: string
  maxTokens?: number
  isActive?: boolean
  order?: number
  agentType?: string
  icon?: string
  functions?: readonly string[]
  createdAt: string
  updatedAt: string
}

/**
 * Get all agents for a workspace
 * 
 * ⚠️ LEGACY: Usato da AgentConfigurationPage durante la transizione
 */
export async function getAgents(workspaceId: string): Promise<Agent[]> {
  logger.info(`=== GET AGENTS DEBUG ===`)
  logger.info(`Fetching agents for workspace ${workspaceId}`)

  try {
    const url = `/workspaces/${workspaceId}/agent`
    logger.info(`GET request URL: ${url}`)

    const response = await api.get(url, {
      headers: {
        "x-workspace-id": workspaceId,
      },
    })

    logger.info(`Response status: ${response.status}`)
    logger.info(`Response data:`, response.data)

    const data = response.data
    logger.info(`Agents received:`, data)
    logger.info(`Number of agents: ${data?.length || 0}`)

    return data || []
  } catch (error) {
    logger.error("Error fetching agents:", error)
    return []
  }
}
