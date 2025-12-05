import { ProductStatus } from "@echatbot/database"
import { Product } from "../entities/product.entity"

export type ProductFilters = {
  search?: string
  categoryId?: string
  supplierIds?: string[] // Array of supplier IDs for QueryAnalyzerAgent
  certificationIds?: string[] // Array of certification IDs for filtering
  status?: string
  page?: number
  limit?: number
  inStock?: boolean
  active?: boolean
}

export type PaginatedProducts = {
  products: Product[]
  total: number
  page: number
  totalPages: number
}

export interface IProductRepository {
  findAll(
    workspaceId: string,
    filters?: ProductFilters
  ): Promise<PaginatedProducts>
  findById(id: string, workspaceId: string): Promise<Product | null>
  findByCategory(categoryId: string, workspaceId: string): Promise<Product[]>
  create(product: Product): Promise<Product>
  update(
    id: string,
    product: Partial<Product>,
    workspaceId: string
  ): Promise<Product | null>
  delete(id: string, workspaceId: string): Promise<void>
  updateStock(
    id: string,
    stock: number,
    workspaceId: string
  ): Promise<Product | null>
  updateStatus(
    id: string,
    status: ProductStatus,
    workspaceId: string
  ): Promise<Product | null>
  getProductsWithDiscounts(
    workspaceId: string,
    customerDiscount?: number
  ): Promise<Product[]>
  syncProductCertifications(
    productId: string,
    certificationIds: string[]
  ): Promise<void>
  syncProductTransportTypes(
    productId: string,
    transportTypeIds: string[]
  ): Promise<void>
  syncProductCategories(
    productId: string,
    categoryIds: string[]
  ): Promise<void>
}
