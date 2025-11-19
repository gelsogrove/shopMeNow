import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TransportType {
  id: string
  name: string
  workspaceId: string
  createdAt: string
  updatedAt: string
  _count?: {
    productTransportTypes: number
  }
}

export interface CreateTransportTypeData {
  name: string
}

export interface UpdateTransportTypeData {
  name: string
}

/**
 * Get all transport types for a workspace (with product counts)
 */
export const getAllForWorkspace = async (
  workspaceId: string
): Promise<TransportType[]> => {
  try {
    logger.info("Fetching transport types for workspace:", workspaceId)
    const response = await api.get(`/workspaces/${workspaceId}/transport-types`)
    logger.info("Transport types response:", response.data)
    return response.data || []
  } catch (error) {
    logger.error("Error fetching transport types:", error)
    return []
  }
}

/**
 * Get a transport type by ID
 */
export const getById = async (
  workspaceId: string,
  id: string
): Promise<TransportType | null> => {
  try {
    logger.info("Fetching transport type:", id)
    const response = await api.get(
      `/workspaces/${workspaceId}/transport-types/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error fetching transport type:", error)
    return null
  }
}

/**
 * Create a new transport type
 */
export const create = async (
  workspaceId: string,
  data: CreateTransportTypeData
): Promise<TransportType> => {
  try {
    logger.info("Creating transport type:", data)
    const response = await api.post(
      `/workspaces/${workspaceId}/transport-types`,
      data
    )
    return response.data
  } catch (error: any) {
    logger.error("Error creating transport type:", error)
    const message =
      error.response?.data?.error || "Failed to create transport type"
    throw new Error(message)
  }
}

/**
 * Update an existing transport type
 */
export const update = async (
  workspaceId: string,
  id: string,
  data: UpdateTransportTypeData
): Promise<TransportType> => {
  try {
    logger.info("Updating transport type:", id, data)
    const response = await api.put(
      `/workspaces/${workspaceId}/transport-types/${id}`,
      data
    )
    return response.data
  } catch (error: any) {
    logger.error("Error updating transport type:", error)
    const message =
      error.response?.data?.error || "Failed to update transport type"
    throw new Error(message)
  }
}

/**
 * Delete a transport type
 */
export const remove = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    logger.info("Deleting transport type:", id)
    await api.delete(`/workspaces/${workspaceId}/transport-types/${id}`)
  } catch (error: any) {
    logger.error("Error deleting transport type:", error)
    const message =
      error.response?.data?.error || "Failed to delete transport type"
    throw new Error(message)
  }
}

export const transportTypesApi = {
  getAllForWorkspace,
  getById,
  create,
  update,
  remove,
}
