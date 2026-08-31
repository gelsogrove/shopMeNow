import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristRestaurant {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  cuisineType?: string | null
  celiacFriendly: boolean
  needsReservation: boolean
  location?: string | null
  phone?: string | null
  link?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristRestaurantData {
  name: string
  description?: string | null
  cuisineType?: string | null
  celiacFriendly?: boolean
  needsReservation?: boolean
  location?: string | null
  phone?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristRestaurantData {
  name?: string
  description?: string | null
  cuisineType?: string | null
  celiacFriendly?: boolean
  needsReservation?: boolean
  location?: string | null
  phone?: string | null
  link?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristRestaurants = async (
  workspaceId: string
): Promise<TouristRestaurant[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-restaurants`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist restaurants:", error)
    throw error
  }
}

export const getTouristRestaurantById = async (
  workspaceId: string,
  id: string
): Promise<TouristRestaurant> => {
  try {
    const response = await api.get(
      `/workspaces/${workspaceId}/tourist-restaurants/${id}`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting tourist restaurant:", error)
    throw error
  }
}

export const createTouristRestaurant = async (
  workspaceId: string,
  data: CreateTouristRestaurantData
): Promise<TouristRestaurant> => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/tourist-restaurants`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error creating tourist restaurant:", error)
    throw error
  }
}

export const updateTouristRestaurant = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristRestaurantData
): Promise<TouristRestaurant> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-restaurants/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist restaurant:", error)
    throw error
  }
}

export const deleteTouristRestaurant = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-restaurants/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist restaurant:", error)
    throw error
  }
}

export const touristRestaurantApi = {
  getTouristRestaurants,
  getTouristRestaurantById,
  createTouristRestaurant,
  updateTouristRestaurant,
  deleteTouristRestaurant,
}
