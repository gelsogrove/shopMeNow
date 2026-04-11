import { ProductStatus } from "@echatbot/database"
import { Product } from "../../domain/entities/product.entity"
import {
  IProductRepository,
  ProductFilters,
} from "../../domain/repositories/product.repository.interface"
import { ProductRepository } from "../../repositories/product.repository"
import { CertificationService } from "../../services/certification.service"
import { TypeService } from "../services/type.service"
import { prisma } from "../../lib/prisma"
import logger from "../../utils/logger"

// Definizione dell'interfaccia Offer
interface Offer {
  id: string
  name: string
  description: string | null
  discountPercent: number
  startDate: Date
  endDate: Date
  isActive: boolean
  categoryId: string | null
  workspaceId: string
  createdAt: Date
  updatedAt: Date
  categoryName?: string
}

export class ProductService {
  private productRepository: IProductRepository
  private certificationService: CertificationService
  private typeService: TypeService

  constructor(
    productRepository?: IProductRepository,
    certificationService?: CertificationService,
    typeService?: TypeService
  ) {
    this.productRepository = productRepository || new ProductRepository()
    this.certificationService =
      certificationService || new CertificationService(prisma)
    this.typeService =
      typeService || new TypeService(prisma)
  }

  async getAllProducts(workspaceId: string, filters?: ProductFilters) {
    try {
      logger.info("ProductService.getAllProducts chiamato con:", {
        workspaceId,
        filters,
      })

      // Get products
      const result = await this.productRepository.findAll(workspaceId, filters)

      // Sales performance calculation removed - no longer needed

      return result
    } catch (error) {
      logger.error("Error in product service getAllProducts:", error)
      throw new Error(`Failed to get products: ${(error as Error).message}`)
    }
  }

  async getProductById(
    id: string,
    workspaceId: string
  ): Promise<Product | null> {
    try {
      return await this.productRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(
        `Error in product service getProductById for product ${id}:`,
        error
      )
      throw new Error(`Failed to get product: ${(error as Error).message}`)
    }
  }

  async getProductsByCategory(
    categoryId: string,
    workspaceId: string
  ): Promise<Product[]> {
    try {
      return await this.productRepository.findByCategory(
        categoryId,
        workspaceId
      )
    } catch (error) {
      logger.error(
        `Error in product service getProductsByCategory for category ${categoryId}:`,
        error
      )
      throw new Error(
        `Failed to get products by category: ${(error as Error).message}`
      )
    }
  }

  async createProduct(
    productData: Partial<Product>,
    certificationIds?: string[],
    typeIds?: string[],
    categoryIds?: string[],
    characteristics?: Array<{ name: string; value: string }>
  ): Promise<Product> {
    try {
      if (!productData.name) {
        throw new Error("Product name is required")
      }

      // Price is optional during creation, but must be non-negative if provided
      if (productData.price !== undefined && productData.price < 0) {
        throw new Error("Product price must be a non-negative number")
      }

      // Validate link field (max 120 chars)
      if (productData.link && productData.link.length > 120) {
        throw new Error("Product link must not exceed 120 characters")
      }

      if (!productData.workspaceId) {
        throw new Error("WorkspaceId is required")
      }

      // Validate certificationIds if provided
      if (certificationIds && certificationIds.length > 0) {
        await this.certificationService.validateCertificationIds(
          certificationIds,
          productData.workspaceId
        )
      }

      // Validate typeIds if provided
      if (typeIds && typeIds.length > 0) {
        await this.typeService.validateTypeIds(
          typeIds,
          productData.workspaceId
        )
      }

      // Generate slug if not provided
      if (!productData.slug && productData.name) {
        productData.slug =
          productData.name
            .toLowerCase()
            .replace(/[^\w\s]/gi, "")
            .replace(/\s+/g, "-") +
          "-" +
          Date.now()
      }

      // Default values
      productData.status = productData.status || ProductStatus.ACTIVE
      productData.isActive = productData.isActive ?? true
      productData.stock = productData.stock ?? 0
      productData.price = productData.price ?? 0 // Default to 0 if not provided

      // Create a proper domain entity
      const product = new Product(productData)

      const createdProduct = await this.productRepository.create(product)

      // Sync certifications if provided
      if (certificationIds && certificationIds.length > 0) {
        await this.productRepository.syncProductCertifications(
          createdProduct.id,
          certificationIds
        )
      }

      // Sync transport types if provided
      if (typeIds && typeIds.length > 0) {
        await this.productRepository.syncProductTypes(
          createdProduct.id,
          typeIds
        )
      }

      // Sync categories if provided (many-to-many)
      if (categoryIds && categoryIds.length > 0) {
        await this.productRepository.syncProductCategories(
          createdProduct.id,
          categoryIds
        )
      }

      // ========================================
      // 🔑 SYNC CHARACTERISTICS (NEW FEATURE)
      // ========================================
      // Sync characteristics if provided
      if (characteristics && characteristics.length > 0) {
        await this.productRepository.syncProductCharacteristics(
          createdProduct.id,
          characteristics
        )
      }

      // Re-fetch product with certifications
      return (
        (await this.productRepository.findById(
          createdProduct.id,
          productData.workspaceId
        )) || createdProduct
      )
    } catch (error) {
      logger.error("Error in product service createProduct:", error)
      throw new Error(`Failed to create product: ${(error as Error).message}`)
    }
  }

  async updateProduct(
    id: string,
    productData: Partial<Product>,
    workspaceId: string,
    certificationIds?: string[],
    typeIds?: string[],
    categoryIds?: string[],
    characteristics?: Array<{ name: string; value: string }>
  ): Promise<Product | null> {
    try {
      // Check if price is valid when provided
      if (productData.price !== undefined && productData.price < 0) {
        throw new Error("Product price must be a non-negative number")
      }

      // Validate link field (max 120 chars)
      if (productData.link && productData.link.length > 120) {
        throw new Error("Product link must not exceed 120 characters")
      }

      // Validate certificationIds if provided
      if (certificationIds && certificationIds.length > 0) {
        await this.certificationService.validateCertificationIds(
          certificationIds,
          workspaceId
        )
      }

      // Validate typeIds if provided
      if (typeIds && typeIds.length > 0) {
        await this.typeService.validateTypeIds(
          typeIds,
          workspaceId
        )
      }

      // Update the product
      const updatedProduct = await this.productRepository.update(
        id,
        productData,
        workspaceId
      )

      // Sync certifications (even if empty array to clear all)
      if (certificationIds !== undefined) {
        await this.productRepository.syncProductCertifications(
          id,
          certificationIds
        )
      }

      // Sync transport types (even if empty array to clear all)
      if (typeIds !== undefined) {
        await this.productRepository.syncProductTypes(
          id,
          typeIds
        )
      }

      // Sync categories (even if empty array to clear all)
      if (categoryIds !== undefined) {
        await this.productRepository.syncProductCategories(
          id,
          categoryIds
        )
      }

      // Sync characteristics (even if empty array to clear all)
      if (characteristics !== undefined) {
        await this.productRepository.syncProductCharacteristics(
          id,
          characteristics
        )
      }

      // Re-fetch product with certifications and transport types
      return await this.productRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(
        `Error in product service updateProduct for product ${id}:`,
        error
      )
      throw new Error(`Failed to update product: ${(error as Error).message}`)
    }
  }

  async deleteProduct(id: string, workspaceId: string): Promise<void> {
    try {
      await this.productRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(
        `Error in product service deleteProduct for product ${id}:`,
        error
      )
      throw new Error(`Failed to delete product: ${(error as Error).message}`)
    }
  }

  async updateProductStock(
    id: string,
    stock: number,
    workspaceId: string
  ): Promise<Product | null> {
    try {
      if (stock < 0) {
        throw new Error("Stock cannot be negative")
      }

      return await this.productRepository.updateStock(id, stock, workspaceId)
    } catch (error) {
      logger.error(
        `Error in product service updateProductStock for product ${id}:`,
        error
      )
      throw new Error(
        `Failed to update product stock: ${(error as Error).message}`
      )
    }
  }

  async updateProductStatus(
    id: string,
    status: ProductStatus,
    workspaceId: string
  ): Promise<Product | null> {
    try {
      return await this.productRepository.updateStatus(id, status, workspaceId)
    } catch (error) {
      logger.error(
        `Error in product service updateProductStatus for product ${id}:`,
        error
      )
      throw new Error(
        `Failed to update product status: ${(error as Error).message}`
      )
    }
  }

  async getProductsWithDiscounts(
    workspaceId: string,
    customerDiscount?: number
  ): Promise<Product[]> {
    try {
      return await this.productRepository.getProductsWithDiscounts(
        workspaceId,
        customerDiscount
      )
    } catch (error) {
      logger.error("Error in product service getProductsWithDiscounts:", error)
      throw new Error(
        `Failed to get products with discounts: ${(error as Error).message}`
      )
    }
  }

  /**
   * Recupera i prodotti con gli sconti applicati secondo la logica di Andrea
   * NON-CUMULATIVO: lo sconto più alto vince
   * @param workspaceId ID del workspace
   * @param customer Cliente per cui calcolare gli sconti (opzionale)
   * @returns Prodotti con lo sconto migliore applicato
   */
  async getProductsWithOffersApplied(workspaceId: string, customer?: any) {
    try {
      const { PriceCalculationService } = await import(
        "./price-calculation.service"
      )
      const { prisma } = await import("../../lib/prisma")
      const priceService = new PriceCalculationService(prisma)

      const customerDiscount = customer?.discount || 0
      const result = await priceService.calculatePricesWithDiscounts(
        workspaceId,
        undefined,
        customerDiscount
      )

      // Map result to expected format
      return result.products.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.finalPrice || product.price,
        originalPrice: product.originalPrice,
        hasDiscount: (product.appliedDiscount || 0) > 0,
        discountPercent: product.appliedDiscount || 0,
        discountSource: product.discountSource || undefined,
        discountName: product.discountName || undefined,
      }))
    } catch (error) {
      logger.error("Error in getProductsWithOffersApplied service:", error)
      throw error
    }
  }
}
