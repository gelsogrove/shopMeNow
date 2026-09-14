import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristCastle {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  century?: string | null
  visitInfo?: string | null
  phone?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristCastleData {
  name: string
  description?: string | null
  century?: string | null
  visitInfo?: string | null
  phone?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristCastleData {
  name?: string
  description?: string | null
  century?: string | null
  visitInfo?: string | null
  phone?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristCastles = async (
  workspaceId: string
): Promise<TouristCastle[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-castles`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist-castles:", error)
    throw error
  }
}

export const getTouristCastleById = async (
  workspaceId: string,
  id: string
): Promise<TouristCastle> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-castles/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist-castles by id:", error)
    throw error
  }
}

export const createTouristCastle = async (
  workspaceId: string,
  data: CreateTouristCastleData
): Promise<TouristCastle> => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/tourist-castles`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error creating tourist-castles:", error)
    throw error
  }
}

export const updateTouristCastle = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristCastleData
): Promise<TouristCastle> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-castles/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist-castles:", error)
    throw error
  }
}

export const deleteTouristCastle = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-castles/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist-castles:", error)
    throw error
  }
}

export const touristCastleApi = {
  getTouristCastles,
  getTouristCastleById,
  createTouristCastle,
  updateTouristCastle,
  deleteTouristCastle,
}
