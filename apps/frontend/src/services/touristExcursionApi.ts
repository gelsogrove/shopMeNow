import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristExcursion {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  difficulty?: string | null
  duration?: string | null
  season?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristExcursionData {
  name: string
  description?: string | null
  difficulty?: string | null
  duration?: string | null
  season?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristExcursionData {
  name?: string
  description?: string | null
  difficulty?: string | null
  duration?: string | null
  season?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristExcursions = async (
  workspaceId: string
): Promise<TouristExcursion[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-excursions`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist excursions:", error)
    throw error
  }
}

export const getTouristExcursionById = async (
  workspaceId: string,
  id: string
): Promise<TouristExcursion> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-excursions/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist excursion:", error)
    throw error
  }
}

export const createTouristExcursion = async (
  workspaceId: string,
  data: CreateTouristExcursionData
): Promise<TouristExcursion> => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/tourist-excursions`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error creating tourist excursion:", error)
    throw error
  }
}

export const updateTouristExcursion = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristExcursionData
): Promise<TouristExcursion> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-excursions/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist excursion:", error)
    throw error
  }
}

export const deleteTouristExcursion = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-excursions/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist excursion:", error)
    throw error
  }
}

export const touristExcursionApi = {
  getTouristExcursions,
  getTouristExcursionById,
  createTouristExcursion,
  updateTouristExcursion,
  deleteTouristExcursion,
}
