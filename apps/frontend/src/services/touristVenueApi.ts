import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristVenue {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  venueType?: string | null
  openingHours?: string | null
  phone?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristVenueData {
  name: string
  description?: string | null
  venueType?: string | null
  openingHours?: string | null
  phone?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristVenueData {
  name?: string
  description?: string | null
  venueType?: string | null
  openingHours?: string | null
  phone?: string | null
  location?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristVenues = async (
  workspaceId: string
): Promise<TouristVenue[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-venues`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist-venues:", error)
    throw error
  }
}

export const getTouristVenueById = async (
  workspaceId: string,
  id: string
): Promise<TouristVenue> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-venues/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist-venues by id:", error)
    throw error
  }
}

export const createTouristVenue = async (
  workspaceId: string,
  data: CreateTouristVenueData
): Promise<TouristVenue> => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/tourist-venues`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error creating tourist-venues:", error)
    throw error
  }
}

export const updateTouristVenue = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristVenueData
): Promise<TouristVenue> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-venues/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist-venues:", error)
    throw error
  }
}

export const deleteTouristVenue = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-venues/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist-venues:", error)
    throw error
  }
}

export const touristVenueApi = {
  getTouristVenues,
  getTouristVenueById,
  createTouristVenue,
  updateTouristVenue,
  deleteTouristVenue,
}
