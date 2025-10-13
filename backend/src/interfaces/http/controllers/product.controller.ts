import { ProductStatus } from "@prisma/client"
import { Request, Response } from "express"
import { ProductService } from "../../../application/services/product.service"
import { prisma } from "../../../lib/prisma"
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

      // Map backend 'ProductCode' field to frontend 'code' field for all products
      const productsWithCode = result.products.map(product => ({
        ...product,
        code: product.ProductCode
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
        code: product.ProductCode
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

      // Map frontend 'code' field to backend 'ProductCode' field
      if (productData.code && !productData.ProductCode) {
        productData.ProductCode = productData.code
        delete productData.code
      }

      const product = await this.productService.createProduct(productData)

      // Map backend 'ProductCode' field to frontend 'code' field
      const responseProduct = {
        ...product,
        code: product.ProductCode
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

      // Map frontend 'code' field to backend 'ProductCode' field
      if (productData.code && !productData.ProductCode) {
        productData.ProductCode = productData.code
        delete productData.code
      }

      const updatedProduct = await this.productService.updateProduct(
        id,
        productData,
        workspaceId
      )
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" })
      }

      // Map backend 'ProductCode' field to frontend 'code' field
      const responseProduct = {
        ...updatedProduct,
        code: updatedProduct.ProductCode
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
