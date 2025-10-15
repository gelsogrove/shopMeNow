import { ProductStatus } from "@prisma/client"
import { Category } from "./category.entity"

export class Product {
  id: string
  name: string
  ProductCode: string | null
  description: string | null
  formato: string | null
  price: number
  stock: number
  status: ProductStatus
  isActive: boolean
  slug: string
  categoryId: string | null
  workspaceId: string
  imageUrl: string[]
  createdAt: Date
  updatedAt: Date
  category?: Category
  originalPrice?: number
  hasDiscount?: boolean
  discountPercent?: number
  discountSource?: string

  constructor(data: Partial<Product>) {
    this.id = data.id || ""
    this.name = data.name || ""
    this.ProductCode = data.ProductCode || null
    this.description = data.description || null
    this.formato = data.formato || null
    this.price = data.price || 0
    this.stock = data.stock || 0
    this.status = data.status || ProductStatus.ACTIVE
    this.isActive = data.isActive ?? true
    this.slug = data.slug || ""
    this.categoryId = data.categoryId || null
    this.workspaceId = data.workspaceId || ""
    this.imageUrl = data.imageUrl || []
    this.createdAt = data.createdAt || new Date()
    this.updatedAt = data.updatedAt || new Date()
    this.category = data.category
    this.originalPrice = data.originalPrice
    this.hasDiscount = data.hasDiscount
    this.discountPercent = data.discountPercent
    this.discountSource = data.discountSource
  }

  isInStock(): boolean {
    return this.stock > 0
  }

  applyDiscount(percentage: number, source: string): Product {
    if (percentage <= 0) return this

    const originalPrice = this.price
    const discountedPrice = originalPrice * (1 - percentage / 100)

    return new Product({
      ...this,
      originalPrice: originalPrice,
      price: discountedPrice,
      hasDiscount: true,
      discountPercent: percentage,
      discountSource: source,
    })
  }

  updateStock(quantity: number): Product {
    return new Product({
      ...this,
      stock: Math.max(0, quantity), // Non permettiamo stock negativo
      updatedAt: new Date(),
    })
  }

  updateStatus(status: ProductStatus): Product {
    return new Product({
      ...this,
      status,
      updatedAt: new Date(),
    })
  }
}
