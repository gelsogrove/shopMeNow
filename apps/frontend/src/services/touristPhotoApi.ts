import { logger } from "@/lib/logger"
import { api } from "./api"

export type TouristContentType =
  | "RESTAURANT"
  | "HOTEL"
  | "EXCURSION"
  | "REFUGE"
  | "EVENT"
  | "APARTMENT"
  | "SPORTS_FACILITY"
  | "SKI_FACILITY"

export interface TouristPhoto {
  id: string
  workspaceId: string
  contentType: TouristContentType
  contentId: string
  imageBase64: string
  caption?: string | null
  order: number
  createdAt: string
}

export interface AddTouristPhotoData {
  contentType: TouristContentType
  contentId: string
  imageBase64: string
  caption?: string | null
  order?: number
}

export const getGallery = async (
  workspaceId: string,
  contentType: TouristContentType,
  contentId: string
): Promise<TouristPhoto[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/tourist-photos`, {
      params: { contentType, contentId },
    })
    return response.data
  } catch (error) {
    logger.error("Error getting tourist photo gallery:", error)
    throw error
  }
}

export const addPhoto = async (
  workspaceId: string,
  data: AddTouristPhotoData
): Promise<TouristPhoto> => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/tourist-photos`, data)
    return response.data
  } catch (error) {
    logger.error("Error adding tourist photo:", error)
    throw error
  }
}

export const deletePhoto = async (workspaceId: string, id: string): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/tourist-photos/${id}`)
  } catch (error) {
    logger.error("Error deleting tourist photo:", error)
    throw error
  }
}

export const reorderGallery = async (
  workspaceId: string,
  contentType: TouristContentType,
  contentId: string,
  orderedIds: string[]
): Promise<void> => {
  try {
    await api.put(`/workspaces/${workspaceId}/tourist-photos/reorder`, {
      contentType,
      contentId,
      orderedIds,
    })
  } catch (error) {
    logger.error("Error reordering tourist photo gallery:", error)
    throw error
  }
}

export const touristPhotoApi = {
  getGallery,
  addPhoto,
  deletePhoto,
  reorderGallery,
}
