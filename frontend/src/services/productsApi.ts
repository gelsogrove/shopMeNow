import { api } from '@/services/api'
import { logger } from '../lib/logger'

export interface Category {
  id: string
  name: string
  description?: string
  workspaceId: string
  slug: string
}

export interface Product {
  id: string
  name: string
  code: string | null
  description: string
  formato: string | null
  price: number
  stock: number
  sku: string | null
  isActive: boolean
  workspaceId: string
  categoryId: string | null
  category?: {
    id: string
    name: string
    workspaceId: string
    slug: string
    isActive: boolean
    createdAt: string
    updatedAt: string
  } | null

  slug: string
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK'
  createdAt: string
  updatedAt: string
}

export interface CreateProductData {
  name: string
  code?: string
  description?: string
  price: number
  stock?: number
  sku?: string
  categoryId?: string
  isActive?: boolean
}

export interface UpdateProductData {
  name?: string
  code?: string
  description?: string
  price?: number
  stock?: number
  sku?: string
  categoryId?: string
  isActive?: boolean
  status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK'
}

// Helper to process product data
const processProductData = (product: any) => {
  // Log per il debug
  logger.info('Processing product data:', product);
  
  // Remove any image-related properties that might come from the API
  if (product) {
    delete product.image;
    delete product.imageUrl;
  }
  
  return product;
};

// Helper per processare array di prodotti
const processProductsArray = (products: any[]) => {
  return products.map(product => processProductData(product));
};

/**
 * Get all products for a workspace with optional filters and pagination
 */
export const getAllForWorkspace = async (
  workspaceId: string, 
  options?: {
    search?: string;
    categoryId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ 
  products: Product[]; 
  total: number; 
  page: number; 
  totalPages: number 
}> => {
  try {
    logger.info('Chiamata getAllForWorkspace con workspaceId:', workspaceId);
    if (!workspaceId) {
      logger.error('WorkspaceId mancante in getAllForWorkspace');
      return {
        products: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
    
    // Construct query parameters
    const queryParams = new URLSearchParams();
    
    // Rimuoviamo il workspaceId dalla query string, è già nell'URL
    queryParams.append('workspaceId', workspaceId);
    
    if (options?.search) {
      queryParams.append('search', options.search);
    }
    
    if (options?.categoryId) {
      queryParams.append('categoryId', options.categoryId);
    }
    
    if (options?.status) {
      queryParams.append('status', options.status);
    }
    
    if (options?.page) {
      queryParams.append('page', options.page.toString());
    }
    
    if (options?.limit) {
      queryParams.append('limit', options.limit.toString());
    }
    
    const queryString = queryParams.toString();
    const requestUrl = `/workspaces/${workspaceId}/products${queryString ? `?${queryString}` : ''}`;
    logger.info('API request URL:', requestUrl);
    
    const response = await api.get(requestUrl);
    logger.info('Products API response status:', response.status);
    logger.info('Products API response data:', response.data);
    
    if (!response.data) {
      logger.error('Risposta API vuota');
      return {
        products: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
    
    // La risposta ora è direttamente l'array dei prodotti
    if (Array.isArray(response.data)) {
      const products = response.data;
      return {
        products: processProductsArray(products),
        total: products.length,
        page: options?.page || 1,
        totalPages: Math.ceil(products.length / (options?.limit || 10))
      };
    }
    
    // Per retrocompatibilità, supportiamo ancora il formato vecchio
    if (response.data.products) {
      return {
        ...response.data,
        products: processProductsArray(response.data.products)
      };
    }
    
    // Se non è né un array né ha il nodo products, ritorniamo vuoto
    logger.error('Formato risposta API non riconosciuto:', response.data);
    return {
      products: [],
      total: 0,
      page: 1,
      totalPages: 0
    };
  } catch (error) {
    logger.error('Error getting products:', error);
    // In caso di errore, ritorna un oggetto vuoto standard
    return {
      products: [],
      total: 0, 
      page: 1,
      totalPages: 0
    };
  }
}

/**
 * Get a specific product by ID
 */
export const getById = async (id: string, workspaceId: string): Promise<Product> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/products/${id}`)
    return processProductData(response.data)
  } catch (error) {
    logger.error('Error getting product:', error)
    throw error
  }
}

/**
 * Get products by category
 */
export const getByCategory = async (categoryId: string, workspaceId: string): Promise<Product[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/categories/${categoryId}/products`)
    return response.data
  } catch (error) {
    logger.error('Error getting products by category:', error)
    throw error
  }
}

/**
 * Create a new product
 */
export const create = async (workspaceId: string, data: CreateProductData): Promise<Product> => {
  try {
    // Log dei dati che stiamo inviando
    logger.info('Marco - Creating product with data:', data);
    logger.info('Marco - Workspace ID:', workspaceId);
    logger.info('Marco - API URL will be:', `/workspaces/${workspaceId}/products`);
    
    const response = await api.post(`/workspaces/${workspaceId}/products`, data)
    logger.info('Marco - API response:', response);
    return processProductData(response.data)
  } catch (error) {
    logger.error('Marco - Error creating product:', error)
    logger.error('Marco - Error details:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Update an existing product
 */
export const update = async (id: string, workspaceId: string, data: UpdateProductData): Promise<Product> => {
  try {
    // Log dei dati che stiamo inviando
    logger.info('Updating product with data:', data);
    
    const response = await api.put(`/workspaces/${workspaceId}/products/${id}`, data)
    return processProductData(response.data)
  } catch (error) {
    logger.error('Error updating product:', error)
    throw error
  }
}

/**
 * Delete a product
 */
export const delete_ = async (id: string, workspaceId: string): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/products/${id}`)
  } catch (error) {
    logger.error('Error deleting product:', error)
    throw error
  }
}

/**
 * Update product stock
 */
export const updateStock = async (id: string, workspaceId: string, stock: number): Promise<Product> => {
  try {
    const response = await api.patch(`/workspaces/${workspaceId}/products/${id}/stock`, { stock })
    return response.data
  } catch (error) {
    logger.error('Error updating product stock:', error)
    throw error
  }
}

export const productsApi = {
  getAllForWorkspace,
  getById,
  getByCategory,
  create,
  update,
  delete: delete_,
  updateStock,
} 