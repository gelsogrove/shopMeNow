import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristHotel {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  stars?: number | null
  location?: string | null
  phone?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristHotelData {
  name: string
  description?: string | null
  stars?: number | null
  location?: string | null
  phone?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristHotelData {
  name?: string
  description?: string | null
  stars?: number | null
  location?: string | null
  phone?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristHotels = async (
  workspaceId: string
): Promise<TouristHotel[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-hotels`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist hotels:", error)
    throw error
  }
}

export const getTouristHotelById = async (
  workspaceId: string,
  id: string
): Promise<TouristHotel> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-hotels/${id}`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist hotel:", error)
    throw error
  }
}

export const createTouristHotel = async (
  workspaceId: string,
  data: CreateTouristHotelData
): Promise<TouristHotel> => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/tourist-hotels`, data)
    return response.data
  } catch (error) {
    logger.error("Error creating tourist hotel:", error)
    throw error
  }
}

export const updateTouristHotel = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristHotelData
): Promise<TouristHotel> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-hotels/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist hotel:", error)
    throw error
  }
}

export const deleteTouristHotel = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-hotels/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist hotel:", error)
    throw error
  }
}

export const touristHotelApi = {
  getTouristHotels,
  getTouristHotelById,
  createTouristHotel,
  updateTouristHotel,
  deleteTouristHotel,
}
