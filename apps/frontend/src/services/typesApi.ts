import { logger } from "@/lib/logger"
import { api } from "./api"

export interface Type {
  id: string
  name: string
  workspaceId: string
  createdAt: string
  updatedAt: string
  _count?: {
    productTypes: number
  }
}

export interface CreateTypeData {
  name: string
}

export interface UpdateTypeData {
  name: string
}

/**
 * Get all types for a workspace (with product counts)
 */
export const getAllForWorkspace = async (
  workspaceId: string
): Promise<Type[]> => {
  try {
    logger.info("Fetching types for workspace:", workspaceId)
    const response = await api.get(`/workspaces/${workspaceId}/types`)
    logger.info("Types response:", response.data)
    return response.data || []
  } catch (error) {
    logger.error("Error fetching types:", error)
    return []
  }
}

/**
 * Get a type by ID
 */
export const getById = async (
  workspaceId: string,
  id: string
): Promise<Type | null> => {
  try {
    logger.info("Fetching type:", id)
    const response = await api.get(
      `/workspaces/${workspaceId}/types/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error fetching type:", error)
    return null
  }
}

/**
 * Create a new type
 */
export const create = async (
  workspaceId: string,
  data: CreateTypeData
): Promise<Type> => {
  try {
    logger.info("Creating type:", data)
    const response = await api.post(
      `/workspaces/${workspaceId}/types`,
      data
    )
    return response.data
  } catch (error: any) {
    logger.error("Error creating type:", error)
    const message =
      error.response?.data?.error || "Failed to create type"
    throw new Error(message)
  }
}

/**
 * Update an existing type
 */
export const update = async (
  workspaceId: string,
  id: string,
  data: UpdateTypeData
): Promise<Type> => {
  try {
    logger.info("Updating type:", id, data)
    const response = await api.put(
      `/workspaces/${workspaceId}/types/${id}`,
      data
    )
    return response.data
  } catch (error: any) {
    logger.error("Error updating type:", error)
    const message =
      error.response?.data?.error || "Failed to update type"
    throw new Error(message)
  }
}

/**
 * Delete a type
 */
export const remove = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    logger.info("Deleting type:", id)
    await api.delete(`/workspaces/${workspaceId}/types/${id}`)
  } catch (error: any) {
    logger.error("Error deleting type:", error)
    const message =
      error.response?.data?.error || "Failed to delete type"
    throw new Error(message)
  }
}

export const typesApi = {
  getAllForWorkspace,
  getById,
  create,
  update,
  remove,
}
