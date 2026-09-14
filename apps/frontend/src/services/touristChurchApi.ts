import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristChurch {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  century?: string | null
  style?: string | null
  phone?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristChurchData {
  name: string
  description?: string | null
  century?: string | null
  style?: string | null
  phone?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristChurchData {
  name?: string
  description?: string | null
  century?: string | null
  style?: string | null
  phone?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristChurches = async (
  workspaceId: string
): Promise<TouristChurch[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-churches`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist-churches:", error)
    throw error
  }
}

export const getTouristChurchById = async (
  workspaceId: string,
  id: string
): Promise<TouristChurch> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-churches/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist-churches by id:", error)
    throw error
  }
}

export const createTouristChurch = async (
  workspaceId: string,
  data: CreateTouristChurchData
): Promise<TouristChurch> => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/tourist-churches`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error creating tourist-churches:", error)
    throw error
  }
}

export const updateTouristChurch = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristChurchData
): Promise<TouristChurch> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-churches/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist-churches:", error)
    throw error
  }
}

export const deleteTouristChurch = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-churches/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist-churches:", error)
    throw error
  }
}

export const touristChurchApi = {
  getTouristChurches,
  getTouristChurchById,
  createTouristChurch,
  updateTouristChurch,
  deleteTouristChurch,
}
