import { api } from './api'
import { logger } from "@/lib/logger"

export interface Category {
  id: string
  name: string
  description?: string
  workspaceId: string
  slug: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCategoryData {
  name: string
  description: string
  isActive?: boolean
}

export interface UpdateCategoryData {
  name?: string
  description?: string
  isActive?: boolean
}

/**
 * Get all categories for a workspace
 */
export const getAllForWorkspace = async (workspaceId: string): Promise<Category[]> => {
  try {
    logger.info('Fetching categories for workspace:', workspaceId);
    const response = await api.get(`/workspaces/${workspaceId}/categories`);
    logger.info('Categories response:', response.data);
    return response.data || [];
  } catch (error) {
    logger.error('Error fetching categories:', error);
    return [];
  }
}

/**
 * Get a category by ID
 */
export const getById = async (id: string, workspaceId: string): Promise<Category | null> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/categories/${id}`);
    return response.data;
  } catch (error) {
    logger.error('Error fetching category:', error);
    return null;
  }
}

/**
 * Check if a category has associated products
 */
export const hasProducts = async (id: string, workspaceId: string): Promise<boolean> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/categories/${id}/products`);
    return Array.isArray(response.data) && response.data.length > 0;
  } catch (error) {
    logger.error('Error checking if category has products:', error);
    // In case of error, we assume that the category has products to prevent deletion
    return true;
  }
}

/**
 * Create a new category
 */
export const create = async (workspaceId: string, data: { name: string; description?: string }): Promise<Category> => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/categories`, data);
    return response.data;
  } catch (error) {
    logger.error('Error creating category:', error);
    throw error;
  }
}

/**
 * Update an existing category
 */
export const update = async (id: string, workspaceId: string, data: UpdateCategoryData): Promise<Category> => {
  logger.info(`API Call - update: PUT /workspaces/${workspaceId}/categories/${id}`, data);
  try {
    const response = await api.put(`/workspaces/${workspaceId}/categories/${id}`, data);
    logger.info("API Response (update):", response.status, response.data);
    return response.data;
  } catch (error: any) {
    logger.error("API Error (update):", error);
    if (error.response) {
      logger.error(`Error status: ${error.response.status}`);
      logger.error("Error data:", error.response.data);
    }
    throw error;
  }
}

/**
 * Delete a category
 */
export const delete_ = async (id: string, workspaceId: string): Promise<void> => {
  logger.info(`API Call - delete: DELETE /workspaces/${workspaceId}/categories/${id}`);
  try {
    const response = await api.delete(`/workspaces/${workspaceId}/categories/${id}`);
    logger.info("API Response (delete):", response.status, response.data);
  } catch (error: any) {
    logger.error("API Error (delete):", error);
    if (error.response) {
      logger.error(`Error status: ${error.response.status}`);
      logger.error("Error data:", error.response.data);
    }
    throw error;
  }
}

export const categoriesApi = {
  getAllForWorkspace,
  getById,
  hasProducts,
  create,
  update,
  delete: delete_
} 