import { logger } from "@/lib/logger"
import { api } from "./api"

export interface TouristEvent {
  id: string
  workspaceId: string
  title: string
  description?: string | null
  location?: string | null
  startDate?: string | null
  endDate?: string | null
  price?: string | null
  ticketInfo?: string | null
  link?: string | null
  ticketLink?: string | null
  videoUrl?: string | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTouristEventData {
  title: string
  description?: string | null
  location?: string | null
  startDate?: string | null
  endDate?: string | null
  price?: string | null
  ticketInfo?: string | null
  link?: string | null
  ticketLink?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export interface UpdateTouristEventData {
  title?: string
  description?: string | null
  location?: string | null
  startDate?: string | null
  endDate?: string | null
  price?: string | null
  ticketInfo?: string | null
  link?: string | null
  ticketLink?: string | null
  videoUrl?: string | null
  isActive?: boolean
}

export const getTouristEvents = async (
  workspaceId: string
): Promise<TouristEvent[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-events`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist events:", error)
    throw error
  }
}

export const getTouristEventById = async (
  workspaceId: string,
  id: string
): Promise<TouristEvent> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-events/${id}`)
    return response.data
  } catch (error) {
    logger.error("Error getting tourist event:", error)
    throw error
  }
}

export const createTouristEvent = async (
  workspaceId: string,
  data: CreateTouristEventData
): Promise<TouristEvent> => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/tourist-events`, data)
    return response.data
  } catch (error) {
    logger.error("Error creating tourist event:", error)
    throw error
  }
}

export const updateTouristEvent = async (
  workspaceId: string,
  id: string,
  data: UpdateTouristEventData
): Promise<TouristEvent> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/tourist-events/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating tourist event:", error)
    throw error
  }
}

export const deleteTouristEvent = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-events/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist event:", error)
    throw error
  }
}

export const touristEventApi = {
  getTouristEvents,
  getTouristEventById,
  createTouristEvent,
  updateTouristEvent,
  deleteTouristEvent,
}
