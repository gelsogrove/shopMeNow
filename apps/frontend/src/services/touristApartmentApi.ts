import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristApartment {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  category?: string | null
  location?: string | null
  streetNumber?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  rooms?: number | null
  beds?: number | null
  bathrooms?: number | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristApartmentData {
  name: string
  description?: string | null
  category?: string | null
  location?: string | null
  streetNumber?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  rooms?: number | null
  beds?: number | null
  bathrooms?: number | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristApartmentData {
  name?: string
  description?: string | null
  category?: string | null
  location?: string | null
  streetNumber?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  rooms?: number | null
  beds?: number | null
  bathrooms?: number | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristApartments = async (
  workspaceId: string
): Promise<TouristApartment[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-apartments`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist apartments:", error)
    throw error
  }
}

export const getTouristApartmentById = async (
  workspaceId: string,
  id: string
): Promise<TouristApartment> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-apartments/${id}`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist apartment:", error)
    throw error
  }
}

export const createTouristApartment = async (
  workspaceId: string,
  data: CreateTouristApartmentData
): Promise<TouristApartment> => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/tourist-apartments`, data)
    return response.data
  } catch (error) {
    logger.error("Error creating tourist apartment:", error)
    throw error
  }
}

export const updateTouristApartment = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristApartmentData
): Promise<TouristApartment> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-apartments/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist apartment:", error)
    throw error
  }
}

export const deleteTouristApartment = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-apartments/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist apartment:", error)
    throw error
  }
}

export const touristApartmentApi = {
  getTouristApartments,
  getTouristApartmentById,
  createTouristApartment,
  updateTouristApartment,
  deleteTouristApartment,
}
