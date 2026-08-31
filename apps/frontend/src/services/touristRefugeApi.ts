import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristRefuge {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  climbTime?: string | null
  difficulty?: string | null
  openFrom?: string | null
  openTo?: string | null
  location?: string | null
  phone?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristRefugeData {
  name: string
  description?: string | null
  climbTime?: string | null
  difficulty?: string | null
  openFrom?: string | null
  openTo?: string | null
  location?: string | null
  phone?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristRefugeData {
  name?: string
  description?: string | null
  climbTime?: string | null
  difficulty?: string | null
  openFrom?: string | null
  openTo?: string | null
  location?: string | null
  phone?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristRefuges = async (
  workspaceId: string
): Promise<TouristRefuge[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-refuges`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist refuges:", error)
    throw error
  }
}

export const getTouristRefugeById = async (
  workspaceId: string,
  id: string
): Promise<TouristRefuge> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-refuges/${id}`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist refuge:", error)
    throw error
  }
}

export const createTouristRefuge = async (
  workspaceId: string,
  data: CreateTouristRefugeData
): Promise<TouristRefuge> => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/tourist-refuges`, data)
    return response.data
  } catch (error) {
    logger.error("Error creating tourist refuge:", error)
    throw error
  }
}

export const updateTouristRefuge = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristRefugeData
): Promise<TouristRefuge> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-refuges/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist refuge:", error)
    throw error
  }
}

export const deleteTouristRefuge = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-refuges/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist refuge:", error)
    throw error
  }
}

export const touristRefugeApi = {
  getTouristRefuges,
  getTouristRefugeById,
  createTouristRefuge,
  updateTouristRefuge,
  deleteTouristRefuge,
}
