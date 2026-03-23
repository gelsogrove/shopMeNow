import { logger } from "@/lib/logger"
import { api } from "./api"

export interface Service {
  id: string
  name: string
  description: string
  code: string
  price: number
  currency: string
  duration: number
  isActive: boolean
  workspaceId: string
  imageUrl: string[]
  createdAt: string
  updatedAt: string
}

export interface SearchResult {
  id: string
  content: string
  similarity: number
  sourceName: string
  sourceType: string
}

export interface CreateServiceData {
  name: string
  description: string
  code: string
  price: number
  currency?: string
  isActive?: boolean
}

export interface UpdateServiceData {
  name?: string
  description?: string
  code?: string
  price?: number
  currency?: string
  isActive?: boolean
}

// Mock data for services when API fails
const mockServices: Service[] = [
  {
    id: "mock-service-1",
    name: "Base Website Design",
    description:
      "Professional website design with responsive layout, optimized for mobile and desktop. Includes up to 5 pages and basic SEO optimization.",
    code: "WEB001",
    price: 999,
    currency: "EUR",
    duration: 0,
    isActive: true,
    workspaceId: "mock-workspace",
    imageUrl: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-service-2",
    name: "E-commerce Setup",
    description:
      "Complete e-commerce solution with product catalog, shopping cart, and payment gateway integration. Includes product setup for up to 20 items.",
    code: "ECM001",
    price: 1499,
    currency: "EUR",
    duration: 0,
    isActive: true,
    workspaceId: "mock-workspace",
    imageUrl: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-service-3",
    name: "SEO Optimization",
    description:
      "Comprehensive SEO service to improve search engine rankings. Includes keyword research, on-page optimization, and monthly reporting.",
    code: "SEO001",
    price: 699,
    currency: "EUR",
    duration: 0,
    isActive: true,
    workspaceId: "mock-workspace",
    imageUrl: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

/**
 * Get all services for a workspace
 */
export const getServices = async (workspaceId: string): Promise<Service[]> => {
  try {
    logger.info(`Fetching services from: /workspaces/${workspaceId}/services`)
    const response = await api.get(`/workspaces/${workspaceId}/services`)
    return response.data
  } catch (error) {
    logger.error("Error getting services:", error)
    throw error
  }
}

/**
 * Get a specific service by ID
 */
export const getServiceById = async (
  workspaceId: string,
  id: string
): Promise<Service> => {
  try {
    logger.info(
      `Fetching service from: /workspaces/${workspaceId}/services/${id}`
    )
    const response = await api.get(`/workspaces/${workspaceId}/services/${id}`)
    return response.data
  } catch (error) {
    logger.error("Error getting service:", error)
    throw error
  }
}

/**
 * Create a new service
 */
export const createService = async (
  workspaceId: string,
  data: CreateServiceData | FormData
): Promise<Service> => {
  try {
    // Check if data is FormData (contains image)
    const isFormData = data instanceof FormData
    const headers = isFormData
      ? { "Content-Type": "multipart/form-data" }
      : undefined

    logger.info(`Creating service at: /workspaces/${workspaceId}/services`)

    const response = await api.post(
      `/workspaces/${workspaceId}/services`,
      data,
      { headers }
    )
    return response.data
  } catch (error) {
    logger.error("Error creating service:", error)
    throw error
  }
}

/**
 * Update an existing service
 */
export const updateService = async (
  workspaceId: string,
  id: string,
  data: UpdateServiceData | FormData
): Promise<Service> => {
  try {
    // Check if data is FormData (contains image)
    const isFormData = data instanceof FormData
    const headers = isFormData
      ? { "Content-Type": "multipart/form-data" }
      : undefined

    // Debug log per tracciare l'URL della richiesta
    logger.info(
      `Updating service at: /workspaces/${workspaceId}/services/${id}`
    )

    const response = await api.put(
      `/workspaces/${workspaceId}/services/${id}`,
      data,
      { headers }
    )
    return response.data
  } catch (error) {
    logger.error("Error updating service:", error)
    throw error
  }
}

/**
 * Delete a service
 */
export const deleteService = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    logger.info(
      `Deleting service at: /workspaces/${workspaceId}/services/${id}`
    )
    await api.delete(`/workspaces/${workspaceId}/services/${id}`)
  } catch (error) {
    logger.error("Error deleting service:", error)
    throw error
  }
}

/**
 * Search services using semantic search
 */
export const search = async (
  workspaceId: string,
  query: string
): Promise<SearchResult[]> => {
  logger.info(
    `Searching services at: /workspaces/${workspaceId}/services/search`
  )
  const response = await api.post(
    `/workspaces/${workspaceId}/services/search`,
    {
      query,
      workspaceId,
    }
  )
  return response.data.data?.results || response.data
}

export const servicesApi = {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  search,
}
