import { api } from "@/services/api"
import { logger } from "../lib/logger"

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
  supplierId: string | null
  region: string | null //  region in English
  imageUrl: string[] | null
  certifications?: string[] // Array of certifications: "bio", "vegan", "gluten-free", "halal", "whole-grain", "DOP"
  productCertifications?: Array<{
    certificationId: string
    certification: {
      id: string
      name: string
    }
  }>
  type: string
  productTypes?: Array<{
    typeId: string
    type: {
      id: string
      name: string
    }
  }>
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
  status: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK"
  createdAt: string
  updatedAt: string
  // Sales performance data (last 30 days)
  salesScore?: number // 0-100 normalized score
  salesCount?: number // Actual number of units sold
}

export interface CreateProductData {
  name: string
  code?: string
  description?: string
  formato?: string
  price: number
  stock?: number
  sku?: string
  categoryId?: string
  supplierId?: string
  region?: string
  isActive?: boolean
  certifications?: string[] // Array: ["bio", "vegan", "gluten-free", "halal", "whole-grain", "DOP"]
  type?: string
}

export interface UpdateProductData {
  name?: string
  code?: string
  description?: string
  formato?: string
  price?: number
  stock?: number
  sku?: string
  categoryId?: string
  supplierId?: string
  region?: string
  isActive?: boolean
  certifications?: string[] // Array: ["bio", "vegan", "gluten-free", "halal", "whole-grain", "DOP"]
  type?: string
}

// Helper to process product data
const processProductData = (product: any) => {
  // Handle image data transformation to ensure compatibility with multiple images
  logger.info("Processing product data:", product)

  if (product) {
    // Cleanup any image fields that might come from the form
    delete product.image

    // Handle backward compatibility: if we have images array but no imageUrl
    if (
      product.images &&
      Array.isArray(product.images) &&
      product.images.length > 0 &&
      !product.imageUrl
    ) {
      product.imageUrl = product.images
      delete product.images
    }

    // Ensure imageUrl is always an array
    if (product.imageUrl && !Array.isArray(product.imageUrl)) {
      product.imageUrl = [product.imageUrl]
    }
  }

  return product
}

const processProductsArray = (products: any[]) => {
  return products.map(processProductData)
}

/**
 * Get all products for a workspace
 */
export const getAllForWorkspace = async (
  workspaceId: string,
  options?: {
    page?: number
    limit?: number
    search?: string
    categoryId?: string
  }
): Promise<{
  products: Product[]
  total: number
  page: number
  totalPages: number
}> => {
  try {
    logger.info("Getting all products for workspace:", workspaceId, options)

    const queryParams = new URLSearchParams()

    if (options?.page) {
      queryParams.append("page", options.page.toString())
    }

    if (options?.limit) {
      queryParams.append("limit", options.limit.toString())
    }

    if (options?.search) {
      queryParams.append("search", options.search)
    }

    if (options?.categoryId) {
      queryParams.append("categoryId", options.categoryId)
    }

    const queryString = queryParams.toString()
    const requestUrl = `/workspaces/${workspaceId}/products${
      queryString ? `?${queryString}` : ""
    }`
    logger.info("API request URL:", requestUrl)

    const response = await api.get(requestUrl)
    logger.info("Products API response status:", response.status)
    logger.info("Products API response data:", response.data)

    if (!response.data) {
      logger.error("Empty API response")
      return {
        products: [],
        total: 0,
        page: 1,
        totalPages: 0,
      }
    }

    // Response is directly the array of products
    if (Array.isArray(response.data)) {
      const products = response.data
      return {
        products: processProductsArray(products),
        total: products.length,
        page: options?.page || 1,
        totalPages: Math.ceil(products.length / (options?.limit || 10)),
      }
    }

    // Response is paginated object
    if (response.data.products) {
      const { products, total, page, totalPages } = response.data
      return {
        products: processProductsArray(products),
        total,
        page,
        totalPages,
      }
    }

    logger.error("Invalid API response format:", response.data)
    return {
      products: [],
      total: 0,
      page: 1,
      totalPages: 0,
    }
  } catch (error) {
    logger.error("Failed to get products:", error)
    throw error
  }
}

/**
 * Get a product by ID
 */
export const getById = async (
  id: string,
  workspaceId: string
): Promise<Product> => {
  try {
    logger.info(`Getting product by ID: ${id} in workspace ${workspaceId}`)
    const response = await api.get(`/workspaces/${workspaceId}/products/${id}`)
    return processProductData(response.data)
  } catch (error) {
    logger.error("Failed to get product by ID:", error)
    throw error
  }
}

/**
 * Get products by category
 */
export const getByCategory = async (
  categoryId: string,
  workspaceId: string
): Promise<Product[]> => {
  try {
    logger.info(
      `Getting products by category ${categoryId} in workspace ${workspaceId}`
    )
    const response = await api.get(
      `/workspaces/${workspaceId}/products/category/${categoryId}`
    )
    return processProductsArray(response.data)
  } catch (error) {
    logger.error("Failed to get products by category:", error)
    throw error
  }
}

/**
 * Create a new product
 */
export const create = async (
  workspaceId: string,
  data: CreateProductData | FormData
): Promise<Product> => {
  try {
    logger.info("Creating product with data:", data)
    logger.info("Workspace ID:", workspaceId)
    logger.info("API URL will be:", `/workspaces/${workspaceId}/products`)

    // Check if data is FormData (contains image)
    const isFormData = data instanceof FormData
    const headers = isFormData
      ? { "Content-Type": "multipart/form-data" }
      : undefined

    const response = await api.post(
      `/workspaces/${workspaceId}/products`,
      data,
      { headers }
    )
    logger.info("API response:", response)
    return processProductData(response.data)
  } catch (error) {
    logger.error("Error creating product:", error)
    logger.error("Error details:", error.response?.data || error.message)
    throw error
  }
}

/**
 * Update an existing product
 */
export const update = async (
  id: string,
  workspaceId: string,
  data: UpdateProductData | FormData
): Promise<Product> => {
  try {
    // Check if data is FormData (contains image)
    const isFormData = data instanceof FormData
    const headers = isFormData
      ? { "Content-Type": "multipart/form-data" }
      : undefined

    logger.info(
      `Updating product at: /workspaces/${workspaceId}/products/${id}`
    )

    const response = await api.put(
      `/workspaces/${workspaceId}/products/${id}`,
      data,
      { headers }
    )

    logger.info("Product updated successfully:", response.data)
    return processProductData(response.data)
  } catch (error) {
    logger.error("Error updating product:", error)
    logger.error("Error details:", error.response?.data || error.message)
    throw error
  }
}

/**
 * Delete a product
 */
export const deleteProduct = async (
  id: string,
  workspaceId: string
): Promise<void> => {
  try {
    logger.info(
      `Deleting product at: /workspaces/${workspaceId}/products/${id}`
    )
    await api.delete(`/workspaces/${workspaceId}/products/${id}`)
  } catch (error) {
    logger.error("Error deleting product:", error)
    throw error
  }
}

/**
 * Update product stock
 */
export const updateStock = async (
  id: string,
  workspaceId: string,
  stock: number
): Promise<Product> => {
  try {
    logger.info(
      `Updating product stock at: /workspaces/${workspaceId}/products/${id}/stock`
    )
    const response = await api.patch(
      `/workspaces/${workspaceId}/products/${id}/stock`,
      { stock }
    )

    logger.info("Product stock updated successfully:", response.data)
    return processProductData(response.data)
  } catch (error) {
    logger.error("Error updating product stock:", error)
    throw error
  }
}

/**
 * Export products to CSV
 */
export const exportCsv = async (workspaceId: string): Promise<string> => {
  try {
    logger.info(`Exporting products to CSV for workspace: ${workspaceId}`)
    const response = await api.get(`/workspaces/${workspaceId}/products/export`, {
      responseType: "text",
    })
    return response.data
  } catch (error) {
    logger.error("Error exporting products to CSV:", error)
    throw error
  }
}

/**
 * Import products from CSV
 */
export const importCsv = async (
  workspaceId: string,
  file: File
): Promise<{ message: string; results: { created: number; updated: number; errors: Array<{ row: number; sku: string; error: string }> } }> => {
  try {
    logger.info(`Importing products from CSV for workspace: ${workspaceId}`)
    const formData = new FormData()
    formData.append("file", file)
    
    const response = await api.post(
      `/workspaces/${workspaceId}/products/import`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    )
    return response.data
  } catch (error) {
    logger.error("Error importing products from CSV:", error)
    throw error
  }
}

export const productsApi = {
  getAllForWorkspace,
  getAll: getAllForWorkspace, // Alias for convenience
  getById,
  getByCategory,
  create,
  update,
  delete: deleteProduct,
  updateStock,
  exportCsv,
  importCsv,
}
