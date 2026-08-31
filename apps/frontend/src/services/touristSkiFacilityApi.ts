import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristSkiFacility {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  slopeType?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristSkiFacilityData {
  name: string
  description?: string | null
  slopeType?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristSkiFacilityData {
  name?: string
  description?: string | null
  slopeType?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristSkiFacilities = async (
  workspaceId: string
): Promise<TouristSkiFacility[]> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-ski-facilities`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist ski facilities:", error)
    throw error
  }
}

export const getTouristSkiFacilityById = async (
  workspaceId: string,
  id: string
): Promise<TouristSkiFacility> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-ski-facilities/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist ski facility:", error)
    throw error
  }
}

export const createTouristSkiFacility = async (
  workspaceId: string,
  data: CreateTouristSkiFacilityData
): Promise<TouristSkiFacility> => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/tourist-ski-facilities`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error creating tourist ski facility:", error)
    throw error
  }
}

export const updateTouristSkiFacility = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristSkiFacilityData
): Promise<TouristSkiFacility> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-ski-facilities/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist ski facility:", error)
    throw error
  }
}

export const deleteTouristSkiFacility = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-ski-facilities/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist ski facility:", error)
    throw error
  }
}

export const touristSkiFacilityApi = {
  getTouristSkiFacilities,
  getTouristSkiFacilityById,
  createTouristSkiFacility,
  updateTouristSkiFacility,
  deleteTouristSkiFacility,
}
