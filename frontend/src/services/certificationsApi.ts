import { logger } from "@/lib/logger"
import { api } from "./api"

export interface Certification {
  id: string
  name: string
  workspaceId: string
  createdAt: string
  updatedAt: string
  _count?: {
    productCertifications: number
  }
}

export interface CreateCertificationData {
  name: string
}

export interface UpdateCertificationData {
  name: string
}

/**
 * Get all certifications for a workspace (with product counts)
 */
export const getAllForWorkspace = async (
  workspaceId: string
): Promise<Certification[]> => {
  try {
    logger.info("Fetching certifications for workspace:", workspaceId)
    const response = await api.get(`/workspaces/${workspaceId}/certifications`)
    logger.info("Certifications response:", response.data)
    return response.data || []
  } catch (error) {
    logger.error("Error fetching certifications:", error)
    return []
  }
}

/**
 * Get a certification by ID
 */
export const getById = async (
  workspaceId: string,
  id: string
): Promise<Certification | null> => {
  try {
    logger.info("Fetching certification:", id)
    const response = await api.get(
      `/workspaces/${workspaceId}/certifications/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error fetching certification:", error)
    return null
  }
}

/**
 * Create a new certification
 */
export const create = async (
  workspaceId: string,
  data: CreateCertificationData
): Promise<Certification> => {
  try {
    logger.info("Creating certification:", data)
    const response = await api.post(
      `/workspaces/${workspaceId}/certifications`,
      data
    )
    logger.info("Certification created:", response.data)
    return response.data
  } catch (error) {
    logger.error("Error creating certification:", error)
    throw error
  }
}

/**
 * Update a certification
 */
export const update = async (
  workspaceId: string,
  id: string,
  data: UpdateCertificationData
): Promise<Certification> => {
  try {
    logger.info("Updating certification:", id, data)
    const response = await api.put(
      `/workspaces/${workspaceId}/certifications/${id}`,
      data
    )
    logger.info("Certification updated:", response.data)
    return response.data
  } catch (error) {
    logger.error("Error updating certification:", error)
    throw error
  }
}

/**
 * Delete a certification
 */
export const remove = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    logger.info("Deleting certification:", id)
    await api.delete(`/workspaces/${workspaceId}/certifications/${id}`)
    logger.info("Certification deleted")
  } catch (error) {
    logger.error("Error deleting certification:", error)
    throw error
  }
}
