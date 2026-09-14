import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristViewpoint {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  altitude?: number | null
  access?: string | null
  difficulty?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristViewpointData {
  name: string
  description?: string | null
  altitude?: number | null
  access?: string | null
  difficulty?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristViewpointData {
  name?: string
  description?: string | null
  altitude?: number | null
  access?: string | null
  difficulty?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristViewpoints = async (
  workspaceId: string
): Promise<TouristViewpoint[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-viewpoints`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist-viewpoints:", error)
    throw error
  }
}

export const getTouristViewpointById = async (
  workspaceId: string,
  id: string
): Promise<TouristViewpoint> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-viewpoints/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist-viewpoints by id:", error)
    throw error
  }
}

export const createTouristViewpoint = async (
  workspaceId: string,
  data: CreateTouristViewpointData
): Promise<TouristViewpoint> => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/tourist-viewpoints`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error creating tourist-viewpoints:", error)
    throw error
  }
}

export const updateTouristViewpoint = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristViewpointData
): Promise<TouristViewpoint> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-viewpoints/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist-viewpoints:", error)
    throw error
  }
}

export const deleteTouristViewpoint = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-viewpoints/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist-viewpoints:", error)
    throw error
  }
}

export const touristViewpointApi = {
  getTouristViewpoints,
  getTouristViewpointById,
  createTouristViewpoint,
  updateTouristViewpoint,
  deleteTouristViewpoint,
}
