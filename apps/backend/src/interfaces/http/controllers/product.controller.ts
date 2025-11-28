import { ProductStatus } from "@prisma/client"
import { Request, Response } from "express"
import { ProductService } from "../../../application/services/product.service"
import { prisma } from "../../../lib/prisma"
import { cleanupRemovedImages } from "../../../utils/fileManager"
import logger from "../../../utils/logger"

export class ProductController {
  private productService: ProductService

  constructor(productService?: ProductService) {
    this.productService = productService || new ProductService()
  }

  getAllProducts = async (req: Request, res: Response): Promise<Response> => {
    try {
      const workspaceIdParam = req.params.workspaceId
      const workspaceIdQuery = req.query.workspaceId as string
      const effectiveWorkspaceId = workspaceIdParam || workspaceIdQuery

      if (!effectiveWorkspaceId) {
        logger.error("WorkspaceId mancante nella richiesta")
        return res.status(400).json({
          message: "WorkspaceId is required",
          error: "Missing workspaceId parameter",
        })
      }

      const { search, categoryId, status, page, limit, active, inStock } =
        req.query

      const pageNumber = page ? parseInt(page as string) : undefined
      const limitNumber = limit ? parseInt(limit as string) : undefined

      const result = await this.productService.getAllProducts(
        effectiveWorkspaceId,
        {
          search: search as string,
          categoryId: categoryId as string,
          status: status as string,
          page: pageNumber,
          limit: limitNumber,
          active: active === "true",
          inStock: inStock === "true",
        }
      )

      logger.info(
        `🔍 Products found in database: ${result.products.length} (total: ${result.total})`
      )

      // Map backend 'ProductCode' field to frontend 'code' field for all products
      const productsWithCode = result.products.map((product) => ({
        ...product,
        code: product.productCode,
        formato: product.formato,
      }))

      return res.json({
        products: productsWithCode,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      })
    } catch (error) {
      logger.error("Error fetching products:", error)
      return res.status(500).json({
        message: "An error occurred while fetching products",
        error: (error as Error).message,
      })
    }
  }

  getProductById = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params
      const workspaceIdParam = req.params.workspaceId
      const workspaceIdQuery = req.query.workspaceId as string
      const workspaceId = workspaceIdParam || workspaceIdQuery

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
          error: "Missing workspaceId parameter",
        })
      }

      const product = await this.productService.getProductById(id, workspaceId)
      if (!product) {
        return res.status(404).json({ message: "Product not found" })
      }

      // Map backend 'ProductCode' field to frontend 'code' field
      const responseProduct = {
        ...product,
        code: product.productCode,
      }

      return res.json(responseProduct)
    } catch (error) {
      logger.error(`Error getting product by ID:`, error)
      return res.status(500).json({
        message: "An error occurred while fetching the product",
        error: (error as Error).message,
      })
    }
  }

  getProductsByCategory = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { categoryId } = req.params
      const workspaceIdParam = req.params.workspaceId
      const workspaceIdQuery = req.query.workspaceId as string
      const workspaceId = workspaceIdParam || workspaceIdQuery

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
          error: "Missing workspaceId parameter",
        })
      }

      const products = await this.productService.getProductsByCategory(
        categoryId,
        workspaceId
      )
      return res.json(products)
    } catch (error) {
      logger.error(`Error getting products by category:`, error)
      return res.status(500).json({
        message: "An error occurred while fetching products by category",
        error: (error as Error).message,
      })
    }
  }

  createProduct = async (req: Request, res: Response): Promise<Response> => {
    try {
      const workspaceIdParam = req.params.workspaceId
      const workspaceIdQuery = req.query.workspaceId as string
      const workspaceId = workspaceIdParam || workspaceIdQuery

      const productData = req.body

      // DEBUG: Log everything about the request
      logger.info("=== CREATE PRODUCT DEBUG ===")
      logger.info("req.body:", productData)
      logger.info("req.files:", req.files)
      logger.info("workspaceId:", workspaceId)
      logger.info("supplierId in body:", productData.supplierId)
      logger.info("categoryId in body:", productData.categoryId)

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
          error: "Missing workspaceId parameter",
        })
      }

      // Check workspace exists
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      })

      if (!workspace) {
        return res.status(404).json({
          message: "Workspace not found",
          error: "Invalid workspaceId",
        })
      }

      if (!productData.workspaceId) {
        productData.workspaceId = workspaceId
      }

      // Validate ProductCode uniqueness within workspace
      const productCode = productData.code || productData.productCode
      if (productCode) {
        const existingProduct = await prisma.products.findFirst({
          where: {
            productCode: productCode,
            workspaceId: workspaceId,
          },
        })

        if (existingProduct) {
          logger.warn(
            `Duplicate ProductCode attempt: ${productCode} in workspace ${workspaceId}`
          )
          return res.status(400).json({
            message: "Product code already exists",
            error: `A product with code "${productCode}" already exists in this workspace`,
          })
        }
      }

      // Convert string fields to proper types (FormData sends everything as strings)
      if (typeof productData.price === "string") {
        productData.price = parseFloat(productData.price)
      }
      if (typeof productData.stock === "string") {
        productData.stock = parseInt(productData.stock, 10)
      }
      if (typeof productData.isActive === "string") {
        productData.isActive = productData.isActive === "true"
      }

      // Parse certificationIds array from JSON string (sent from frontend)
      let certificationIds: string[] = []
      if (
        productData.certificationIds &&
        typeof productData.certificationIds === "string"
      ) {
        try {
          certificationIds = JSON.parse(productData.certificationIds)
        } catch (error) {
          logger.error("Failed to parse certificationIds JSON:", error)
          certificationIds = []
        }
      } else if (Array.isArray(productData.certificationIds)) {
        certificationIds = productData.certificationIds
      }

      // Remove certificationIds from productData (handled separately)
      delete productData.certificationIds

      // Parse transportTypeIds array from JSON string (sent from frontend)
      let transportTypeIds: string[] = []
      if (
        productData.transportTypeIds &&
        typeof productData.transportTypeIds === "string"
      ) {
        try {
          transportTypeIds = JSON.parse(productData.transportTypeIds)
        } catch (error) {
          logger.error("Failed to parse transportTypeIds JSON:", error)
          transportTypeIds = []
        }
      } else if (Array.isArray(productData.transportTypeIds)) {
        transportTypeIds = productData.transportTypeIds
      }

      // Remove transportTypeIds from productData (handled separately)
      delete productData.transportTypeIds

      // Parse categoryIds array from JSON string (sent from frontend) - many-to-many
      let categoryIds: string[] = []
      if (
        productData.categoryIds &&
        typeof productData.categoryIds === "string"
      ) {
        try {
          categoryIds = JSON.parse(productData.categoryIds)
        } catch (error) {
          logger.error("Failed to parse categoryIds JSON:", error)
          categoryIds = []
        }
      } else if (Array.isArray(productData.categoryIds)) {
        categoryIds = productData.categoryIds
      }

      // Remove categoryIds from productData (handled separately via many-to-many)
      delete productData.categoryIds

      // Handle supplierId: convert empty string to null
      if (productData.supplierId === "" || productData.supplierId === "none") {
        productData.supplierId = null
      }

      // Handle categoryId: convert empty string to null (DEPRECATED - use categoryIds instead)
      if (productData.categoryId === "" || productData.categoryId === "none") {
        productData.categoryId = null
      }

      // Handle transportType: set default if not provided
      if (!productData.transportType) {
        productData.transportType = "Temperatura ambiente"
      }

      logger.info(
        "✅ After conversion - supplierId:",
        productData.supplierId,
        "categoryId:",
        productData.categoryId
      )

      // Map frontend 'code' field to backend 'ProductCode' field
      if (productData.code && !productData.productCode) {
        productData.productCode = productData.code
        delete productData.code
      }

      // Handle multiple image uploads and existing images
      let allImageUrls: string[] = []

      // Add existing images first (if reordered)
      if (req.body.existingImageUrls) {
        try {
          const existingUrls = JSON.parse(req.body.existingImageUrls)
          if (Array.isArray(existingUrls) && existingUrls.length > 0) {
            allImageUrls = [...existingUrls]
            logger.info(`Existing images:`, existingUrls)
          }
        } catch (error) {
          logger.error("Error parsing existingImageUrls JSON", error)
        }
      }

      // Add new uploaded images
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const newImagePaths = (req.files as Express.Multer.File[]).map(
          (file) => `/uploads/products/${file.filename}`
        )
        allImageUrls = [...allImageUrls, ...newImagePaths]
        logger.info(`New images uploaded:`, newImagePaths)
      }

      // Always set imageUrl (even if empty array)
      productData.imageUrl = allImageUrls
      logger.info(`Total images for product:`, allImageUrls)

      const product = await this.productService.createProduct(
        productData,
        certificationIds,
        transportTypeIds,
        categoryIds
      )

      // Map backend 'ProductCode' field to frontend 'code' field
      const responseProduct = {
        ...product,
        code: product.productCode,
      }

      return res.status(201).json(responseProduct)
    } catch (error) {
      logger.error("Error creating product:", error)
      return res.status(error.message?.includes("required") ? 400 : 500).json({
        message: "An error occurred while creating the product",
        error: (error as Error).message,
      })
    }
  }

  updateProduct = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params
      const workspaceIdParam = req.params.workspaceId
      const workspaceIdQuery = req.query.workspaceId as string
      const workspaceId = workspaceIdParam || workspaceIdQuery

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
          error: "Missing workspaceId parameter",
        })
      }

      const productData = req.body

      // Validate required fields for update
      if (!productData.name || productData.name.trim() === "") {
        return res.status(400).json({
          message: "Product name is required",
          error: "Missing required field: name",
        })
      }

      if (
        productData.price === undefined ||
        productData.price === null ||
        isNaN(productData.price) ||
        productData.price < 0
      ) {
        return res.status(400).json({
          message: "Valid product price is required",
          error: "Missing or invalid field: price",
        })
      }

      // Convert string fields to proper types (FormData sends everything as strings)
      if (typeof productData.price === "string") {
        productData.price = parseFloat(productData.price)
      }
      if (typeof productData.stock === "string") {
        productData.stock = parseInt(productData.stock, 10)
      }
      if (typeof productData.isActive === "string") {
        productData.isActive = productData.isActive === "true"
      }

      // Parse certificationIds array from JSON string (sent from frontend)
      let certificationIds: string[] = []
      if (
        productData.certificationIds &&
        typeof productData.certificationIds === "string"
      ) {
        try {
          certificationIds = JSON.parse(productData.certificationIds)
        } catch (error) {
          logger.error("Failed to parse certificationIds JSON:", error)
          certificationIds = []
        }
      } else if (Array.isArray(productData.certificationIds)) {
        certificationIds = productData.certificationIds
      }

      // Remove certificationIds from productData (handled separately)
      delete productData.certificationIds

      // Parse transportTypeIds array from JSON string (sent from frontend)
      let transportTypeIds: string[] = []
      if (
        productData.transportTypeIds &&
        typeof productData.transportTypeIds === "string"
      ) {
        try {
          transportTypeIds = JSON.parse(productData.transportTypeIds)
        } catch (error) {
          logger.error("Failed to parse transportTypeIds JSON:", error)
          transportTypeIds = []
        }
      } else if (Array.isArray(productData.transportTypeIds)) {
        transportTypeIds = productData.transportTypeIds
      }

      // Remove transportTypeIds from productData (handled separately)
      delete productData.transportTypeIds

      // Parse categoryIds array from JSON string (sent from frontend) - many-to-many
      let categoryIds: string[] = []
      if (
        productData.categoryIds &&
        typeof productData.categoryIds === "string"
      ) {
        try {
          categoryIds = JSON.parse(productData.categoryIds)
        } catch (error) {
          logger.error("Failed to parse categoryIds JSON:", error)
          categoryIds = []
        }
      } else if (Array.isArray(productData.categoryIds)) {
        categoryIds = productData.categoryIds
      }

      // Remove categoryIds from productData (handled separately via many-to-many)
      delete productData.categoryIds

      // Handle supplierId: convert empty string to null
      if (productData.supplierId === "" || productData.supplierId === "none") {
        productData.supplierId = null
      }

      // Handle categoryId: convert empty string to null (DEPRECATED - use categoryIds instead)
      if (productData.categoryId === "" || productData.categoryId === "none") {
        productData.categoryId = null
      }

      // Handle transportType: set default if not provided
      if (!productData.transportType) {
        productData.transportType = "Temperatura ambiente"
      }

      logger.info(
        "✅ UPDATE - After conversion - supplierId:",
        productData.supplierId,
        "categoryId:",
        productData.categoryId
      )

      // Map frontend 'code' field to backend 'ProductCode' field
      if (productData.code && !productData.productCode) {
        productData.productCode = productData.code
        delete productData.code
      }

      // Get current product to compare image changes
      const currentProduct = await this.productService.getProductById(
        id,
        workspaceId
      )
      if (!currentProduct) {
        return res.status(404).json({ message: "Product not found" })
      }

      const oldImageUrls = Array.isArray(currentProduct.imageUrl)
        ? currentProduct.imageUrl
        : []

      // Handle multiple image uploads and existing images for update
      let allImageUrls: string[] = []

      // Add existing images first (if provided)
      if (req.body.existingImageUrls) {
        try {
          const existingUrls = JSON.parse(req.body.existingImageUrls)
          if (Array.isArray(existingUrls) && existingUrls.length > 0) {
            allImageUrls = [...existingUrls]
            logger.info(`Existing images for update:`, existingUrls)
          }
        } catch (error) {
          logger.error("Error parsing existingImageUrls JSON", error)
        }
      }

      // Add new uploaded images
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        logger.info(`Received ${req.files.length} files from multer:`)
        req.files.forEach((file, index) => {
          logger.info(`File ${index}:`, {
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
          })
        })

        const newImagePaths = (req.files as Express.Multer.File[]).map(
          (file) => `/uploads/products/${file.filename}`
        )
        allImageUrls = [...allImageUrls, ...newImagePaths]
        logger.info(
          `New images uploaded for update:`,
          JSON.stringify(newImagePaths)
        )
      }

      // Always set imageUrl to reflect current state (even if empty)
      productData.imageUrl = allImageUrls
      logger.info(
        `Total images for product update:`,
        JSON.stringify(allImageUrls)
      )
      logger.info(
        `imageUrl type check: isArray=${Array.isArray(productData.imageUrl)}, length=${productData.imageUrl.length}`
      )

      // Clean up removed images from filesystem
      const deletedCount = cleanupRemovedImages(oldImageUrls, allImageUrls)
      if (deletedCount > 0) {
        logger.info(
          `Cleaned up ${deletedCount} removed image(s) from filesystem`
        )
      }

      const updatedProduct = await this.productService.updateProduct(
        id,
        productData,
        workspaceId,
        certificationIds,
        transportTypeIds,
        categoryIds
      )
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" })
      }

      // Map backend 'productCode' field to frontend 'code' field
      const responseProduct = {
        ...updatedProduct,
        code: updatedProduct.productCode,
      }

      return res.json(responseProduct)
    } catch (error) {
      logger.error("Error updating product:", error)
      return res.status(error.message?.includes("negative") ? 400 : 500).json({
        message: "An error occurred while updating the product",
        error: (error as Error).message,
      })
    }
  }

  deleteProduct = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params
      const workspaceIdParam = req.params.workspaceId
      const workspaceIdQuery = req.query.workspaceId as string
      const workspaceId = workspaceIdParam || workspaceIdQuery

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
          error: "Missing workspaceId parameter",
        })
      }

      // Check if the product exists before deleting it
      const existingProduct = await this.productService.getProductById(
        id,
        workspaceId
      )
      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" })
      }

      // Clean up all product images from filesystem before deleting
      if (
        existingProduct.imageUrl &&
        Array.isArray(existingProduct.imageUrl) &&
        existingProduct.imageUrl.length > 0
      ) {
        const deletedCount = cleanupRemovedImages(existingProduct.imageUrl, [])
        logger.info(
          `Cleaned up ${deletedCount} image(s) from deleted product ${id}`
        )
      }

      await this.productService.deleteProduct(id, workspaceId)

      return res.status(200).json({ message: "Product deleted successfully" })
    } catch (error) {
      logger.error("Error deleting product:", error)
      return res.status(500).json({
        message: "An error occurred while deleting the product",
        error: (error as Error).message,
      })
    }
  }

  updateProductStock = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { id } = req.params
      const { stock } = req.body
      const workspaceIdParam = req.params.workspaceId
      const workspaceIdQuery = req.query.workspaceId as string
      const workspaceId = workspaceIdParam || workspaceIdQuery

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
          error: "Missing workspaceId parameter",
        })
      }

      if (stock === undefined || stock === null) {
        return res.status(400).json({
          message: "Stock value is required",
          error: "Missing stock parameter",
        })
      }

      const updatedProduct = await this.productService.updateProductStock(
        id,
        stock,
        workspaceId
      )

      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" })
      }

      return res.json(updatedProduct)
    } catch (error) {
      logger.error("Error updating product stock:", error)
      return res.status(error.message?.includes("negative") ? 400 : 500).json({
        message: "An error occurred while updating product stock",
        error: (error as Error).message,
      })
    }
  }

  updateProductStatus = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { id } = req.params
      const { status } = req.body
      const workspaceIdParam = req.params.workspaceId
      const workspaceIdQuery = req.query.workspaceId as string
      const workspaceId = workspaceIdParam || workspaceIdQuery

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
          error: "Missing workspaceId parameter",
        })
      }

      if (
        !status ||
        !Object.values(ProductStatus).includes(status as ProductStatus)
      ) {
        return res.status(400).json({
          message: "Valid status is required",
          error: "Missing or invalid status parameter",
          validStatuses: Object.values(ProductStatus),
        })
      }

      const updatedProduct = await this.productService.updateProductStatus(
        id,
        status as ProductStatus,
        workspaceId
      )

      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" })
      }

      return res.json(updatedProduct)
    } catch (error) {
      logger.error("Error updating product status:", error)
      return res.status(500).json({
        message: "An error occurred while updating product status",
        error: (error as Error).message,
      })
    }
  }

  getProductsWithDiscounts = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const workspaceIdParam = req.params.workspaceId
      const workspaceIdQuery = req.query.workspaceId as string
      const workspaceId = workspaceIdParam || workspaceIdQuery

      const { customerDiscount } = req.query
      const discountValue = customerDiscount
        ? parseFloat(customerDiscount as string)
        : undefined

      if (!workspaceId) {
        return res.status(400).json({
          message: "WorkspaceId is required",
          error: "Missing workspaceId parameter",
        })
      }

      const products = await this.productService.getProductsWithDiscounts(
        workspaceId,
        discountValue
      )
      return res.json(products)
    } catch (error) {
      logger.error("Error fetching products with discounts:", error)
      return res.status(500).json({
        message: "An error occurred while fetching products with discounts",
        error: (error as Error).message,
      })
    }
  }
}
