import { Prisma, PrismaClient, ProductStatus } from "@prisma/client"
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
    this.prisma = new PrismaClient()
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

      // Iniziamo con un filtro vuoto
      const where: Prisma.ProductsWhereInput = {}

      // Aggiungiamo il workspaceId come filtro obbligatorio
      if (workspaceId) {
        where.workspaceId = workspaceId
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
        include: {
          category: true,
        },
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
        },
      })

      if (!product) return null
      return this.mapToDomainEntity(product)
    } catch (error) {
      logger.error(`Error in findById for product ${id}:`, error)
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
        include: {
          category: true,
        },
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
          ProductCode: product.ProductCode,
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
        ProductCode: product.ProductCode,
        description: product.description,
        formato: product.formato,
        price: product.price,
        stock: product.stock,
        status: product.status as ProductStatus,
        isActive: product.isActive,
        slug: product.slug,
        categoryId: product.categoryId,
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
        include: {
          category: true,
        },
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

  private mapToDomainEntity(data: any): Product {
    return new Product({
      id: data.id,
      name: data.name,
      ProductCode: data.ProductCode,
      description: data.description,
      formato: data.formato,
      price: data.price,
      stock: data.stock,
      status: data.status,
      isActive: data.isActive,
      slug: data.slug,
      categoryId: data.categoryId,
      workspaceId: data.workspaceId,
      imageUrl: data.imageUrl || [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      category: data.category,
    })
  }
}
