import { prisma, Prisma, PrismaClient, ProductStatus } from "@echatbot/database"
import { Product } from "../domain/entities/product.entity"
import {
  IProductRepository,
  PaginatedProducts,
  ProductFilters,
} from "../domain/repositories/product.repository.interface"
import logger from "../utils/logger"

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

export class ProductRepository implements IProductRepository {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  async findAll(
    workspaceId: string,
    filters?: ProductFilters
  ): Promise<PaginatedProducts> {
    try {
      logger.info("ProductRepository.findAll chiamato con:", {
        workspaceId,
        filters,
      })

      // 🔐 SECURITY: workspaceId is MANDATORY
      if (!workspaceId) {
        logger.error("ProductRepository.findAll: workspaceId is required")
        throw new Error("workspaceId is mandatory for product retrieval")
      }

      // Iniziamo con il filtro workspaceId obbligatorio
      const where: Prisma.ProductsWhereInput = {
        workspaceId: workspaceId,
      }

      // Aggiungiamo la ricerca per nome, se presente
      if (filters?.search) {
        where.name = {
          contains: filters.search,
          mode: "insensitive",
        }
      }

      // Aggiungiamo il filtro per categoria, se presente
      if (filters?.categoryId) {
        where.categoryId = filters.categoryId
      }

      // Gestiamo lo status in maniera semplificata
      if (filters?.status) {
        switch (filters.status) {
          case "IN_STOCK":
            where.stock = { gt: 0 }
            break
          case "OUT_OF_STOCK":
            where.stock = { lte: 0 }
            break
          case "ACTIVE":
            where.status = "ACTIVE"
            break
          case "INACTIVE":
            where.status = "INACTIVE"
            break
        }
      }

      // Filtro per prodotti in stock
      if (filters?.inStock === true) {
        where.stock = { gt: 0 }
      }

      // Filtro per prodotti attivi
      if (filters?.active === true) {
        where.isActive = true
      }

      // Filtro per certificazioni (many-to-many)
      if (filters?.certificationIds && filters.certificationIds.length > 0) {
        where.productCertifications = {
          some: {
            certificationId: {
              in: filters.certificationIds,
            },
          },
        }
      }

      const page = filters?.page || 1
      const limit = filters?.limit || 1000 // No limit - show all products
      const skip = (page - 1) * limit

      logger.info("Query Prisma products con:", { where, skip, take: limit })

      // Contiamo i prodotti che soddisfano il filtro
      const total = await this.prisma.products.count({ where })
      const totalPages = Math.ceil(total / limit)

      if (total === 0) {
        return {
          products: [],
          total: 0,
          page,
          totalPages: 0,
        }
      }

      // Otteniamo i prodotti filtrati e paginati
      const productsData = await this.prisma.products.findMany({
        where,
        include: this.getIncludeWithCertifications(),
        orderBy: {
          updatedAt: "desc",
        },
        skip,
        take: limit,
      })

      // Convertiamo i dati dal database nelle nostre entità di dominio
      const products = productsData.map((data) => this.mapToDomainEntity(data))

      return {
        products,
        total,
        page,
        totalPages,
      }
    } catch (error) {
      logger.error("Error in findAll:", error)
      return {
        products: [],
        total: 0,
        page: filters?.page || 1,
        totalPages: 0,
      }
    }
  }

  async findById(id: string, workspaceId: string): Promise<Product | null> {
    try {
      const product = await this.prisma.products.findFirst({
        where: {
          id,
          workspaceId,
        },
        include: {
          category: true,
          characteristics: true,
        },
      })

      if (!product) return null
      return this.mapToDomainEntity(product)
    } catch (error) {
      logger.error(`Error in findById for product ${id}:`, error)
      return null
    }
  }

  /**
   * Find product by sku (e.g., "SALUMI-006")
   * Used by CartManagementAgent to add products to cart
   */
  async findBySku(
    sku: string,
    workspaceId: string
  ): Promise<Product | null> {
    try {
      const product = await this.prisma.products.findFirst({
        where: {
          sku,
          workspaceId,
          isActive: true, // Only active products can be added to cart
        },
        include: {
          category: true,
        },
      })

      if (!product) {
        logger.warn(
          `Product not found: ${sku} in workspace ${workspaceId}`
        )
        return null
      }

      return this.mapToDomainEntity(product)
    } catch (error) {
      logger.error(`Error in findBySku for ${sku}:`, error)
      return null
    }
  }

  async findByCategory(
    categoryId: string,
    workspaceId: string
  ): Promise<Product[]> {
    try {
      const products = await this.prisma.products.findMany({
        where: {
          categoryId,
          workspaceId,
        },
        include: this.getIncludeWithCertifications(),
        orderBy: {
          updatedAt: "desc",
        },
      })

      return products.map((product) => this.mapToDomainEntity(product))
    } catch (error) {
      logger.error(`Error in findByCategory for category ${categoryId}:`, error)
      return []
    }
  }

  async create(product: Product): Promise<Product> {
    try {
      const createdProduct = await this.prisma.products.create({
        data: {
          name: product.name,
          sku: product.sku,
          description: product.description,
          formato: product.formato,
          price: product.price,
          stock: product.stock,
          status: product.status as ProductStatus,
          isActive: product.isActive,
          slug: product.slug,
          categoryId: product.categoryId,
          workspaceId: product.workspaceId,
        },
        include: {
          category: true,
        },
      })

      return this.mapToDomainEntity(createdProduct)
    } catch (error) {
      logger.error("Error creating product:", error)
      throw new Error(`Failed to create product: ${(error as Error).message}`)
    }
  }

  async update(
    id: string,
    product: Partial<Product>,
    workspaceId: string
  ): Promise<Product | null> {
    try {
      const updateData: any = {
        name: product.name,
        sku: product.sku,
        description: product.description,
        formato: product.formato,
        price: product.price,
        stock: product.stock,
        status: product.status as ProductStatus,
        isActive: product.isActive,
        slug: product.slug,
        categoryId: product.categoryId,
        supplierId: product.supplierId,
        certifications: product.certifications, // ✅ Use certifications array instead of boolean fields
        type: product.type,
        region: product.region,
      }

      // Add imageUrl if provided
      if (product.imageUrl !== undefined) {
        updateData.imageUrl = product.imageUrl
        logger.info(
          `Repository - Setting imageUrl in updateData:`,
          JSON.stringify(product.imageUrl)
        )
        logger.info(
          `Repository - imageUrl type: isArray=${Array.isArray(product.imageUrl)}, length=${product.imageUrl.length}`
        )
      }

      logger.info(
        `Repository - Full updateData before Prisma:`,
        JSON.stringify(updateData)
      )

      const updatedProduct = await this.prisma.products.update({
        where: {
          id,
          workspaceId,
        },
        data: updateData,
        include: {
          category: true,
        },
      })

      logger.info(
        `Repository - After Prisma update, imageUrl:`,
        JSON.stringify((updatedProduct as any).imageUrl)
      )
      logger.info(
        `Repository - imageUrl type from DB: isArray=${Array.isArray((updatedProduct as any).imageUrl)}, length=${(updatedProduct as any).imageUrl?.length}`
      )

      return this.mapToDomainEntity(updatedProduct)
    } catch (error) {
      logger.error(`Error updating product ${id}:`, error)
      return null
    }
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    try {
      await this.prisma.products.delete({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error deleting product ${id}:`, error)
      throw new Error(`Failed to delete product: ${(error as Error).message}`)
    }
  }

  async updateStock(
    id: string,
    stock: number,
    workspaceId: string
  ): Promise<Product | null> {
    try {
      const updatedProduct = await this.prisma.products.update({
        where: {
          id,
          workspaceId,
        },
        data: {
          stock: Math.max(0, stock), // Ensure stock isn't negative
        },
        include: {
          category: true,
        },
      })

      return this.mapToDomainEntity(updatedProduct)
    } catch (error) {
      logger.error(`Error updating stock for product ${id}:`, error)
      return null
    }
  }

  async updateStatus(
    id: string,
    status: ProductStatus,
    workspaceId: string
  ): Promise<Product | null> {
    try {
      const updatedProduct = await this.prisma.products.update({
        where: {
          id,
          workspaceId,
        },
        data: {
          status,
        },
        include: {
          category: true,
        },
      })

      return this.mapToDomainEntity(updatedProduct)
    } catch (error) {
      logger.error(`Error updating status for product ${id}:`, error)
      return null
    }
  }

  async getProductsWithDiscounts(
    workspaceId: string,
    customerDiscount?: number
  ): Promise<Product[]> {
    try {
      const products = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
          status: "ACTIVE",
        },
        include: this.getIncludeWithCertifications(),
      })

      const domainProducts = products.map((p) => this.mapToDomainEntity(p))

      // Se non c'è sconto cliente, ritorna i prodotti senza modifiche
      if (!customerDiscount || customerDiscount <= 0) {
        return domainProducts
      }

      // Applica lo sconto cliente a tutti i prodotti
      return domainProducts.map((product) =>
        product.applyDiscount(customerDiscount, "customer")
      )
    } catch (error) {
      logger.error("Error getting products with discounts:", error)
      return []
    }
  }

  /**
   * Search products with advanced filters for Agent system
   * Used by ProductSearchAgent for customer queries
   *
   * @param workspaceId - Workspace ID (security filter)
   * @param filters - Search filters
   * @returns Array of matching products with category relations
   */
  async searchProducts(
    workspaceId: string,
    filters: {
      keywords?: string[]
      categoryId?: string
      supplierIds?: string[]
      regions?: string[]
      minPrice?: number
      maxPrice?: number
      allergens?: string[]
      certifications?: string[]
      limit?: number
    }
  ) {
    try {
      const where: Prisma.ProductsWhereInput = {
        workspaceId,
        isActive: true, // Only active products
      }

      // Keywords search (name, sku, type, formato, region)
      // 🔧 CRITICAL: If categoryId is provided, keywords become OPTIONAL (OR)
      // This allows "formaggi?" to match category WITHOUT requiring "formaggi" in product name
      if (filters.keywords && filters.keywords.length > 0) {
        const orConditions: Prisma.ProductsWhereInput[] = []

        filters.keywords.forEach((keyword) => {
          // Search in: name, sku, type, formato, region (case-insensitive)
          orConditions.push(
            { name: { contains: keyword, mode: "insensitive" } },
            { sku: { contains: keyword, mode: "insensitive" } },
            { type: { contains: keyword, mode: "insensitive" } },
            { formato: { contains: keyword, mode: "insensitive" } },
            { region: { contains: keyword, mode: "insensitive" } }
          )
        })

        // 🆕 If categoryId is present, keywords are OPTIONAL (enhance search)
        // Otherwise, keywords are REQUIRED (OR match)
        if (!filters.categoryId) {
          where.OR = orConditions
        }
        // When categoryId exists, don't apply OR - category is the primary filter
      }

      // Category filter (single or multiple)
      // 🎯 Primary filter when user asks "formaggi?" - matches category, not product name
      if (filters.categoryId) {
        where.categoryId = filters.categoryId
      }

      // Regions filter (array of Italian region names)
      if (filters.regions && filters.regions.length > 0) {
        where.region = {
          in: filters.regions,
        }
      }

      // Price range filter
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        where.price = {}
        if (filters.minPrice !== undefined) {
          where.price.gte = filters.minPrice
        }
        if (filters.maxPrice !== undefined) {
          where.price.lte = filters.maxPrice
        }
      }

      // Allergens filter - use dedicated array field
      if (filters.allergens && filters.allergens.length > 0) {
        where.allergens = {
          hasSome: filters.allergens,
        }
      }

      // Certifications filter - search in certification names via relation
      if (filters.certifications && filters.certifications.length > 0) {
        where.productCertifications = {
          some: {
            certification: {
              name: {
                in: filters.certifications.map((cert) => {
                  const certLower = cert.toLowerCase().trim()
                  // Normalize certification names
                  if (
                    certLower === "halal" ||
                    certLower === "ishalal" ||
                    certLower === "hallal" ||
                    certLower === "allal"
                  ) {
                    return "Halal"
                  } else if (
                    certLower === "bio" ||
                    certLower === "isorganic" ||
                    certLower === "organic" ||
                    certLower === "biologico"
                  ) {
                    return "Organic"
                  } else if (
                    certLower === "vegan" ||
                    certLower === "isvegan" ||
                    certLower === "vegano"
                  ) {
                    return "Vegan"
                  } else if (
                    certLower === "gluten-free" ||
                    certLower === "isglutenfree" ||
                    certLower === "senza glutine"
                  ) {
                    return "Gluten-Free"
                  } else if (
                    certLower === "whole-grain" ||
                    certLower === "iswholegrain" ||
                    certLower === "integrali" ||
                    certLower === "integrale"
                  ) {
                    return "Whole-Grain"
                  } else if (certLower === "dop") {
                    return "DOP"
                  } else if (certLower === "igp") {
                    return "IGP"
                  } else if (certLower === "igt") {
                    return "IGT"
                  }
                  return cert // Return original if no mapping
                }),
                mode: "insensitive",
              },
            },
          },
        }
      }

      const products = await this.prisma.products.findMany({
        where,
        include: {
          category: true, // Include category for name/translations
          productCertifications: {
            include: {
              certification: true,
            },
          },
          productTypes: {
            include: {
              type: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc", // Newest first
        },
        take: filters.limit || 20, // Default 20 results
      })

      logger.info(
        `ProductRepository.searchProducts: Found ${products.length} products`
      )
      return products
    } catch (error) {
      logger.error("Error searching products:", error)
      throw error
    }
  }

  /**
   * Helper to get include clause with certifications, transport types and categories
   */
  private getIncludeWithCertifications() {
    return {
      category: true, // DEPRECATED: keep for backward compatibility
      productCertifications: {
        include: {
          certification: true,
        },
      },
      productTypes: {
        include: {
          type: true,
        },
      },
      productCategories: {
        include: {
          category: true,
        },
      },
      characteristics: true,
    }
  }

  /**
   * Sync product certifications (delete old + create new)
   */
  async syncProductCertifications(
    productId: string,
    certificationIds: string[]
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete existing certifications
      await tx.productCertification.deleteMany({
        where: { productId },
      })

      // Create new certifications
      if (certificationIds.length > 0) {
        await tx.productCertification.createMany({
          data: certificationIds.map((certificationId) => ({
            productId,
            certificationId,
          })),
        })
      }
    })
  }

  /**
   * Sync product transport types (delete old + create new)
   */
  async syncProductTypes(
    productId: string,
    typeIds: string[]
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete existing transport types
      await tx.productType.deleteMany({
        where: { productId },
      })

      // Create new transport types
      if (typeIds.length > 0) {
        await tx.productType.createMany({
          data: typeIds.map((typeId) => ({
            productId,
            typeId,
          })),
        })
      }
    })
  }

  /**
   * Sync product categories (delete old + create new)
   */
  async syncProductCategories(
    productId: string,
    categoryIds: string[]
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete existing categories
      await tx.productCategory.deleteMany({
        where: { productId },
      })

      // Create new categories
      if (categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            productId,
            categoryId,
          })),
        })
      }
    })
  }

  async syncProductCharacteristics(
    productId: string,
    characteristics: Array<{ name: string; value: string }>
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete existing characteristics
      await tx.productCharacteristic.deleteMany({
        where: { productId },
      })

      // Create new characteristics
      if (characteristics.length > 0) {
        await tx.productCharacteristic.createMany({
          data: characteristics.map((char) => ({
            productId,
            name: char.name,
            value: char.value,
          })),
        })
      }
    })
  }

  private mapToDomainEntity(data: any): Product {
    // Extract certification names from productCertifications relation
    const certificationNames =
      data.productCertifications?.map(
        (pc: any) => pc.certification.name
      ) || data.certifications || []

    // Extract transport type names from productTypes relation
    const typeNames =
      data.productTypes?.map(
        (pt: any) => pt.type.name
      ) || []

    // Extract category IDs from productCategories relation (many-to-many)
    const categoryIds =
      data.productCategories?.map(
        (pc: any) => pc.categoryId
      ) || (data.categoryId ? [data.categoryId] : [])

    const product = new Product({
      id: data.id,
      name: data.name,
      sku: data.sku,
      description: data.description,
      formato: data.formato,
      price: data.price,
      stock: data.stock,
      status: data.status,
      isActive: data.isActive,
      slug: data.slug,
      categoryId: data.categoryId, // DEPRECATED: keep for backward compatibility
      supplierId: data.supplierId,
      workspaceId: data.workspaceId,
      imageUrl: data.imageUrl || [],
      imageKey: data.imageKey || null, // 💾 Storage key for cleanup
      certifications: certificationNames, // Use relation data or fallback to array
      type: data.type || "Temperatura ambiente",
      region: data.region,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      category: data.category, // DEPRECATED: keep for backward compatibility
    })

    // Add productCertifications relation to the product object (for frontend use)
    ;(product as any).productCertifications = data.productCertifications || []
    
    // Add productTypes relation to the product object (for frontend use)
    ;(product as any).productTypes = data.productTypes || []

    // Add productCategories relation to the product object (for frontend use)
    ;(product as any).productCategories = data.productCategories || []
    ;(product as any).categoryIds = categoryIds

    // Add characteristics relation to the product object (for frontend use)
    ;(product as any).characteristics = data.characteristics || []

    return product
  }

  // Sales performance calculation method removed - no longer needed
}
