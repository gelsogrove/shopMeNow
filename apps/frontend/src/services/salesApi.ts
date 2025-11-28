import { logger } from "@/lib/logger"
import { api } from "./api"

export interface Sales {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  workspaceId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateSalesData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  isActive?: boolean
}

export interface UpdateSalesData {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  isActive?: boolean
}

/**
 * Get all sales for a workspace
 */
export const getAllForWorkspace = async (
  workspaceId: string
): Promise<Sales[]> => {
  try {
    logger.info("Fetching sales for workspace:", workspaceId)
    const response = await api.get(`/workspaces/${workspaceId}/sales`)
    logger.info("Sales response:", response.data)
    return response.data || []
  } catch (error) {
    logger.error("Error fetching sales:", error)
    return []
  }
}

/**
 * Get a salesperson by ID
 */
export const getById = async (
  id: string,
  workspaceId: string
): Promise<Sales | null> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/sales/${id}`)
    return response.data
  } catch (error) {
    logger.error("Error fetching salesperson:", error)
    return null
  }
}

/**
 * Check if a salesperson has associated customers
 */
export const hasCustomers = async (
  id: string,
  workspaceId: string
): Promise<boolean> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/sales/${id}/has-customers`
    )
    return response.data?.hasCustomers || false
  } catch (error) {
    logger.error("Error checking if salesperson has customers:", error)
    // In case of error, we assume that the salesperson has customers to prevent deletion
    return true
  }
}

/**
 * Create a new salesperson
 */
export const create = async (
  workspaceId: string,
  data: CreateSalesData
): Promise<Sales> => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/sales`, data)
    return response.data
  } catch (error) {
    logger.error("Error creating salesperson:", error)
    throw error
  }
}

/**
 * Update an existing salesperson
 */
export const update = async (
  id: string,
  workspaceId: string,
  data: UpdateSalesData
): Promise<Sales> => {
  logger.info(
    `API Call - update: PUT /workspaces/${workspaceId}/sales/${id}`,
    data
  )
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/sales/${id}`,
      data
    )
    logger.info("API Response (update):", response.status, response.data)
    return response.data
  } catch (error: any) {
    logger.error("API Error (update):", error)
    if (error.response) {
      logger.error(`Error status: ${error.response.status}`)
      logger.error("Error data:", error.response.data)
    }
    throw error
  }
}

/**
 * Delete a salesperson
 */
export const delete_ = async (
  id: string,
  workspaceId: string
): Promise<void> => {
  logger.info(
    `API Call - delete: DELETE /workspaces/${workspaceId}/sales/${id}`
  )
  try {
    const response = await api.delete(`/workspaces/${workspaceId}/sales/${id}`)
    logger.info("API Response (delete):", response.status, response.data)
  } catch (error: any) {
    logger.error("API Error (delete):", error)
    if (error.response) {
      logger.error(`Error status: ${error.response.status}`)
      logger.error("Error data:", error.response.data)
    }
    throw error
  }
}

export const salesApi = {
  getAllForWorkspace,
  getById,
  hasCustomers,
  create,
  update,
  delete: delete_,
}
