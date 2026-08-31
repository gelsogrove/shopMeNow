import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristSportsFacility {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  sport?: string | null
  season?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristSportsFacilityData {
  name: string
  description?: string | null
  sport?: string | null
  season?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristSportsFacilityData {
  name?: string
  description?: string | null
  sport?: string | null
  season?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristSportsFacilities = async (
  workspaceId: string
): Promise<TouristSportsFacility[]> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-sports-facilities`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist sports facilities:", error)
    throw error
  }
}

export const getTouristSportsFacilityById = async (
  workspaceId: string,
  id: string
): Promise<TouristSportsFacility> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-sports-facilities/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist sports facility:", error)
    throw error
  }
}

export const createTouristSportsFacility = async (
  workspaceId: string,
  data: CreateTouristSportsFacilityData
): Promise<TouristSportsFacility> => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/tourist-sports-facilities`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error creating tourist sports facility:", error)
    throw error
  }
}

export const updateTouristSportsFacility = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristSportsFacilityData
): Promise<TouristSportsFacility> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-sports-facilities/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist sports facility:", error)
    throw error
  }
}

export const deleteTouristSportsFacility = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-sports-facilities/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist sports facility:", error)
    throw error
  }
}

export const touristSportsFacilityApi = {
  getTouristSportsFacilities,
  getTouristSportsFacilityById,
  createTouristSportsFacility,
  updateTouristSportsFacility,
  deleteTouristSportsFacility,
}
