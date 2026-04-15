import { logger } from "@/lib/logger"
import { api } from "./api"

export interface FlowConfig {
  id: string
  workspaceId: string
  flowKey: string
  flowLabel: string
  systemPrompt?: string | null
  model?: string | null
  temperature?: number | null
  maxTokens?: number | null
  availableFunctions?: any
  flows?: any
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateFlowConfigData {
  flowKey: string
  flowLabel: string
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  availableFunctions?: string[]
  flows?: any
  isActive?: boolean
}

export interface UpdateFlowConfigData {
  flowLabel?: string
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  availableFunctions?: string[]
  flows?: any
  isActive?: boolean
}

/**
 * Get all flow configs for a workspace
 */
export const getAllForWorkspace = async (
  workspaceId: string
): Promise<FlowConfig[]> => {
  try {
    logger.info("Fetching flow configs for workspace:", workspaceId)
    const response = await api.get(`/workspaces/${workspaceId}/flow-configs`)
    return response.data || []
  } catch (error) {
    logger.error("Error fetching flow configs:", error)
    return []
  }
}

/**
 * Get a flow config by ID
 */
export const getById = async (
  workspaceId: string,
  id: string
): Promise<FlowConfig | null> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/flow-configs/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error fetching flow config:", error)
    return null
  }
}

/**
 * Create a new flow config
 */
export const create = async (
  workspaceId: string,
  data: CreateFlowConfigData
): Promise<FlowConfig> => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/flow-configs`,
      data
    )
    return response.data
  } catch (error: any) {
    logger.error("Error creating flow config:", error)
    const message =
      error.response?.data?.error || "Failed to create flow config"
    throw new Error(message)
  }
}

/**
 * Update an existing flow config
 */
export const update = async (
  workspaceId: string,
  id: string,
  data: UpdateFlowConfigData
): Promise<FlowConfig> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/flow-configs/${id}`,
      data
    )
    return response.data
  } catch (error: any) {
    logger.error("Error updating flow config:", error)
    const message =
      error.response?.data?.error || "Failed to update flow config"
    throw new Error(message)
  }
}

/**
 * Delete a flow config
 */
export const remove = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/flow-configs/${id}`)
  } catch (error: any) {
    logger.error("Error deleting flow config:", error)
    const message =
      error.response?.data?.error || "Failed to delete flow config"
    throw new Error(message)
  }
}

export const flowConfigApi = {
  getAllForWorkspace,
  getById,
  create,
  update,
  remove,
}
