/**
 * OpenAI Agents SDK - Product Tools
 * 
 * Tools for product search, filtering, and details.
 * Uses Fuse.js for fuzzy matching (typo-tolerant search).
 * 
 * @architecture Clean Architecture - Tools layer
 * @security ALL queries filtered by workspaceId
 * @critical NO hardcoded data - all from database
 */

import { tool } from "@openai/agents"
import { z } from "zod"
import Fuse from "fuse.js"
import { AgentContext, ProductSearchResult, CategoryResult, OfferResult, ToolResult } from "../types"
import logger from "../../../utils/logger"

/**
 * Search products with fuzzy matching
 * Supports typo-tolerance, partial matches, and multilingual queries
 */
export const searchProductsTool = tool({
  name: "search_products",
  description: `Search for products by name, description, or category. 
    Supports typo-tolerance (e.g., "bufalo mozarela" matches "Mozzarella di Bufala").
    Use this when the customer asks about products, wants to find something, or mentions a product name.`,
  parameters: z.object({
    query: z.string().describe("Search query - product name, description keyword, or category"),
    categorySlug: z.string().optional().describe("Optional: filter by category slug"),
    maxResults: z.number().default(10).describe("Maximum number of results to return"),
    priceMin: z.number().optional().describe("Optional: minimum price filter"),
    priceMax: z.number().optional().describe("Optional: maximum price filter"),
  }),
  execute: async ({ query, categorySlug, maxResults, priceMin, priceMax }, { context }) => {
    const ctx = context as AgentContext
    const startTime = Date.now()
    
    try {
      logger.info(`🔍 [searchProducts] Query: "${query}", workspace: ${ctx.workspaceId}`)
      
      // Build where clause with workspace isolation
      const whereClause: any = {
        workspaceId: ctx.workspaceId,
        isActive: true,
        status: "ACTIVE",
      }
      
      // Category filter
      if (categorySlug) {
        const category = await ctx.prisma.categories.findFirst({
          where: { slug: categorySlug, workspaceId: ctx.workspaceId },
        })
        if (category) {
          whereClause.productCategories = {
            some: { categoryId: category.id },
          }
        }
      }
      
      // Price filters
      if (priceMin !== undefined) {
        whereClause.price = { ...whereClause.price, gte: priceMin }
      }
      if (priceMax !== undefined) {
        whereClause.price = { ...whereClause.price, lte: priceMax }
      }
      
      // Fetch products from database
      const products = await ctx.prisma.products.findMany({
        where: whereClause,
        include: {
          productCategories: {
            include: { category: true },
          },
        },
        take: 100, // Get more for fuzzy search, then filter
      })
      
      if (products.length === 0) {
        return {
          success: true,
          data: [],
          message: "Nessun prodotto trovato con i filtri specificati",
        } as ToolResult<ProductSearchResult[]>
      }
      
      // Fuzzy search with Fuse.js
      const fuse = new Fuse(products, {
        keys: [
          { name: "name", weight: 0.5 },
          { name: "description", weight: 0.3 },
          { name: "productCategories.category.name", weight: 0.2 },
        ],
        threshold: 0.4, // 0 = exact match, 1 = match anything
        ignoreLocation: true,
        includeScore: true,
      })
      
      const searchResults = fuse.search(query)
      
      // Map results
      const results: ProductSearchResult[] = searchResults
        .slice(0, maxResults)
        .map(({ item: p }) => {
          const customerDiscount = ctx.customerDiscount || 0
          const discountedPrice = customerDiscount > 0 
            ? p.price * (1 - customerDiscount / 100) 
            : undefined
          
          return {
            id: p.id,
            name: p.name,
            sku: p.sku || undefined,
            description: p.description || undefined,
            price: p.price,
            discountedPrice,
            stock: p.stock,
            categoryName: p.productCategories?.[0]?.category?.name,
            imageUrl: p.imageUrl,
            isAvailable: p.stock > 0,
          }
        })
      
      logger.info(`✅ [searchProducts] Found ${results.length} products in ${Date.now() - startTime}ms`)
      
      return {
        success: true,
        data: results,
        message: results.length > 0 
          ? `Trovati ${results.length} prodotti` 
          : "Nessun prodotto corrisponde alla ricerca",
      } as ToolResult<ProductSearchResult[]>
      
    } catch (error) {
      logger.error(`❌ [searchProducts] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore durante la ricerca prodotti",
      } as ToolResult<ProductSearchResult[]>
    }
  },
})

/**
 * Get product details by ID or SKU
 */
export const getProductDetailsTool = tool({
  name: "get_product_details",
  description: `Get detailed information about a specific product by ID or SKU.
    Use this when the customer wants more details about a specific product.`,
  parameters: z.object({
    productId: z.string().optional().describe("Product ID"),
    sku: z.string().optional().describe("Product SKU code"),
  }),
  execute: async ({ productId, sku }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      if (!productId && !sku) {
        return {
          success: false,
          error: "Product ID or SKU required",
          message: "Specifica l'ID o il codice SKU del prodotto",
        } as ToolResult<ProductSearchResult>
      }
      
      const whereClause: any = {
        workspaceId: ctx.workspaceId,
        isActive: true,
      }
      
      if (productId) {
        whereClause.id = productId
      } else if (sku) {
        whereClause.sku = sku
      }
      
      const product = await ctx.prisma.products.findFirst({
        where: whereClause,
        include: {
          productCategories: {
            include: { category: true },
          },
          productCertifications: {
            include: { certification: true },
          },
          productTransportTypes: {
            include: { transportType: true },
          },
        },
      })
      
      if (!product) {
        return {
          success: false,
          error: "Product not found",
          message: "Prodotto non trovato",
        } as ToolResult<ProductSearchResult>
      }
      
      const customerDiscount = ctx.customerDiscount || 0
      const discountedPrice = customerDiscount > 0 
        ? product.price * (1 - customerDiscount / 100) 
        : undefined
      
      return {
        success: true,
        data: {
          id: product.id,
          name: product.name,
          sku: product.sku || undefined,
          description: product.description || undefined,
          price: product.price,
          discountedPrice,
          stock: product.stock,
          categoryName: product.productCategories[0]?.category?.name,
          imageUrl: product.imageUrl,
          isAvailable: product.stock > 0,
        },
        message: "Dettagli prodotto recuperati",
      } as ToolResult<ProductSearchResult>
      
    } catch (error) {
      logger.error(`❌ [getProductDetails] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero dettagli prodotto",
      } as ToolResult<ProductSearchResult>
    }
  },
})

/**
 * Get all categories
 */
export const getCategoriesList = tool({
  name: "get_categories",
  description: `Get list of all product categories.
    Use this when the customer asks what categories are available or wants to browse by category.`,
  parameters: z.object({}),
  execute: async (_, { context }) => {
    const ctx = context as AgentContext
    
    try {
      const categories = await ctx.prisma.categories.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              productCategories: true,
            },
          },
        },
        orderBy: { name: "asc" },
      })
      
      const results: CategoryResult[] = categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description || undefined,
        productCount: c._count.productCategories,
      }))
      
      return {
        success: true,
        data: results,
        message: `${results.length} categorie disponibili`,
      } as ToolResult<CategoryResult[]>
      
    } catch (error) {
      logger.error(`❌ [getCategories] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero categorie",
      } as ToolResult<CategoryResult[]>
    }
  },
})

/**
 * Get active offers
 */
export const getActiveOffersTool = tool({
  name: "get_offers",
  description: `Get list of active promotional offers.
    Use this when the customer asks about discounts, promotions, or special offers.`,
  parameters: z.object({}),
  execute: async (_, { context }) => {
    const ctx = context as AgentContext
    
    try {
      const now = new Date()
      
      const offers = await ctx.prisma.offers.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          category: true,
        },
        orderBy: { discountPercent: "desc" },
      })
      
      const results: OfferResult[] = offers.map((o) => ({
        id: o.id,
        name: o.name,
        description: o.description || undefined,
        discountPercent: o.discountPercent,
        startDate: o.startDate,
        endDate: o.endDate,
        categoryName: o.category?.name,
      }))
      
      return {
        success: true,
        data: results,
        message: results.length > 0 
          ? `${results.length} offerte attive` 
          : "Nessuna offerta attiva al momento",
      } as ToolResult<OfferResult[]>
      
    } catch (error) {
      logger.error(`❌ [getOffers] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero offerte",
      } as ToolResult<OfferResult[]>
    }
  },
})

/**
 * Get products by category
 */
export const getProductsByCategoryTool = tool({
  name: "get_products_by_category",
  description: `Get all products in a specific category.
    Use this when the customer wants to see products in a particular category.`,
  parameters: z.object({
    categorySlug: z.string().describe("Category slug identifier"),
    maxResults: z.number().default(20).describe("Maximum number of results"),
  }),
  execute: async ({ categorySlug, maxResults }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      const category = await ctx.prisma.categories.findFirst({
        where: {
          slug: categorySlug,
          workspaceId: ctx.workspaceId,
          isActive: true,
        },
      })
      
      if (!category) {
        return {
          success: false,
          error: "Category not found",
          message: "Categoria non trovata",
        } as ToolResult<ProductSearchResult[]>
      }
      
      const products = await ctx.prisma.products.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          status: "ACTIVE",
          productCategories: {
            some: { categoryId: category.id },
          },
        },
        include: {
          category: true,
        },
        take: maxResults,
        orderBy: { name: "asc" },
      })
      
      const customerDiscount = ctx.customerDiscount || 0
      
      const results: ProductSearchResult[] = products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || undefined,
        description: p.description || undefined,
        price: p.price,
        discountedPrice: customerDiscount > 0 
          ? p.price * (1 - customerDiscount / 100) 
          : undefined,
        stock: p.stock,
        categoryName: category.name,
        imageUrl: p.imageUrl,
        isAvailable: p.stock > 0,
      }))
      
      return {
        success: true,
        data: results,
        message: `${results.length} prodotti nella categoria "${category.name}"`,
      } as ToolResult<ProductSearchResult[]>
      
    } catch (error) {
      logger.error(`❌ [getProductsByCategory] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero prodotti per categoria",
      } as ToolResult<ProductSearchResult[]>
    }
  },
})

// Export all product tools
export const productTools = [
  searchProductsTool,
  getProductDetailsTool,
  getCategoriesList,
  getActiveOffersTool,
  getProductsByCategoryTool,
]
