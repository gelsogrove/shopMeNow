import { logger } from "@/lib/logger"
import { api } from "@/services/api"

// Enums aligned with backend
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
export type PaymentMethod =
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "BANK_TRANSFER"
  | "PAYPAL"
  | "CASH_ON_DELIVERY"
  | "CRYPTO"
export type ItemType = "PRODUCT" | "SERVICE"

// Address interfaces
export interface ShippingAddress {
  name?: string
  firstName?: string
  lastName?: string
  street?: string
  address?: string
  city: string
  zipCode?: string
  postalCode?: string
  country: string
  phone?: string
}

export interface BillingAddress {
  name?: string
  firstName?: string
  lastName?: string
  street?: string
  address?: string
  city: string
  zipCode?: string
  postalCode?: string
  country: string
  phone?: string
  company?: string
  vatNumber?: string
}

// Order item interface
export interface OrderItem {
  id: string
  orderId: string
  itemType: ItemType
  productId?: string // Optional for services
  serviceId?: string // Optional for products
  quantity: number
  unitPrice: number
  totalPrice: number
  productVariant?: any
  product?: {
    id: string
    name: string
    description: string
    price: number
  }
  service?: Service
  createdAt: string
  updatedAt: string
}

// Customer interface (simplified)
export interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  invoiceAddress?: {
    firstName?: string
    lastName?: string
    company?: string
    address?: string
    city?: string
    postalCode?: string
    country?: string
    vatNumber?: string
    phone?: string
  }
}

// Main Order interface aligned with backend
export interface Order {
  id: string
  orderCode: string
  customerId: string
  workspaceId: string
  status: OrderStatus
  paymentMethod: PaymentMethod | null
  totalAmount: number
  shippingAmount: number
  taxAmount: number
  shippingAddress: ShippingAddress | null
  billingAddress: BillingAddress | null
  notes: string | null
  discountCode: string | null
  discountAmount: number
  createdAt: string
  updatedAt: string
  customer?: Customer
  items?: OrderItem[]
  trackingNumber?: string | null
}

export interface Service {
  id: string
  name: string
  description: string
  code: string
  price: number
  currency: string
  duration: number
  isActive: boolean
  workspaceId: string
  createdAt: string
  updatedAt: string
}

// Create order data interface
export interface CreateOrderData {
  customerId: string
  items: {
    itemType: ItemType
    productId?: string
    serviceId?: string
    quantity: number
    unitPrice: number
    totalPrice: number
    productVariant?: any
  }[]
  totalAmount: number
  shippingAmount?: number
  taxAmount?: number
  shippingAddress?: ShippingAddress
  billingAddress?: BillingAddress
  notes?: string
  discountCode?: string
  discountAmount?: number
  paymentMethod?: PaymentMethod
  trackingNumber?: string | null
}

// Update order data interface
export interface UpdateOrderData {
  status?: OrderStatus
  paymentMethod?: PaymentMethod
  totalAmount?: number
  shippingAmount?: number
  taxAmount?: number
  shippingAddress?: ShippingAddress
  billingAddress?: BillingAddress
  notes?: string
  discountCode?: string
  discountAmount?: number
  items?: {
    itemType: ItemType
    productId?: string
    serviceId?: string
    quantity: number
    unitPrice: number
    totalPrice: number
    productVariant?: any
  }[]
  trackingNumber?: string | null
}

// Filters interface
export interface OrderFilters {
  search?: string
  customerId?: string
  status?: OrderStatus
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

// Analytics interface
export interface OrderAnalytics {
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
  completedOrders: number
  averageOrderValue: number
}

/**
 * Get all orders for a workspace with optional filters and pagination
 */
export const getAllForWorkspace = async (
  workspaceId: string,
  filters?: OrderFilters
): Promise<{
  orders: Order[]
  total: number
  page: number
  totalPages: number
}> => {
  try {
    logger.info("Getting orders for workspace:", workspaceId)
    if (!workspaceId) {
      logger.error("WorkspaceId missing in getAllForWorkspace")
      return {
        orders: [],
        total: 0,
        page: 1,
        totalPages: 0,
      }
    }

    // Construct query parameters
    const queryParams = new URLSearchParams()

    // Always include customer data in the response
    queryParams.append("include", "customer")

    if (filters?.search) {
      queryParams.append("search", filters.search)
    }

    if (filters?.customerId) {
      queryParams.append("customerId", filters.customerId)
    }

    if (filters?.status) {
      queryParams.append("status", filters.status)
    }

    if (filters?.dateFrom) {
      queryParams.append("dateFrom", filters.dateFrom)
    }

    if (filters?.dateTo) {
      queryParams.append("dateTo", filters.dateTo)
    }

    if (filters?.page) {
      queryParams.append("page", filters.page.toString())
    }

    if (filters?.limit) {
      queryParams.append("limit", filters.limit.toString())
    }

    const queryString = queryParams.toString()
    const requestUrl = `/workspaces/${workspaceId}/orders${
      queryString ? `?${queryString}` : ""
    }`
    logger.info("Orders API request URL:", requestUrl)

    const response = await api.get(requestUrl)
    logger.info("Orders API response:", response.data)

    return response.data
  } catch (error) {
    logger.error("Error getting orders:", error)
    return {
      orders: [],
      total: 0,
      page: 1,
      totalPages: 0,
    }
  }
}

/**
 * Get a specific order by ID
 */
export const getById = async (
  id: string,
  workspaceId: string
): Promise<Order> => {
  try {
    const response = await api.get(`/orders/${id}`)
    return response.data
  } catch (error) {
    logger.error("Error getting order:", error)
    throw error
  }
}

/**
 * Get order by order code
 */
export const getByCode = async (
  orderCode: string,
  workspaceId: string
): Promise<Order> => {
  try {
    const response = await api.get(`/orders/code/${orderCode}`)
    return response.data
  } catch (error) {
    logger.error("Error getting order by code:", error)
    throw error
  }
}

/**
 * Get orders by customer ID
 */
export const getByCustomer = async (
  customerId: string,
  workspaceId: string
): Promise<Order[]> => {
  try {
    const response = await api.get(`/orders/customer/${customerId}`)
    return response.data
  } catch (error) {
    logger.error("Error getting orders by customer:", error)
    throw error
  }
}

/**
 * Create a new order
 */
export const create = async (
  workspaceId: string,
  data: CreateOrderData
): Promise<Order> => {
  try {
    logger.info("Creating order with data:", data)
    logger.info("Workspace ID:", workspaceId)

    const response = await api.post(`/orders`, data)
    logger.info("Order creation response:", response.data)
    return response.data
  } catch (error) {
    logger.error("Error creating order:", error)
    throw error
  }
}

/**
 * Update an existing order
 */
export const update = async (
  id: string,
  workspaceId: string,
  data: UpdateOrderData
): Promise<Order> => {
  try {
    logger.info("Updating order with data:", data)

    const response = await api.put(`/orders/${id}`, data)
    return response.data
  } catch (error) {
    logger.error("Error updating order:", error)
    throw error
  }
}

/**
 * Delete an order
 */
export const delete_ = async (
  id: string,
  workspaceId: string
): Promise<void> => {
  try {
    logger.info(`[ORDERS API] DELETE request:`, {
      url: `/workspaces/${workspaceId}/orders/${id}`,
      orderId: id,
      workspaceId: workspaceId
    })
    await api.delete(`/workspaces/${workspaceId}/orders/${id}`)
    logger.info(`[ORDERS API] DELETE successful for order: ${id}`)
  } catch (error) {
    logger.error("Error deleting order:", error)
    throw error
  }
}

/**
 * Update order status
 */
export const updateStatus = async (
  id: string,
  workspaceId: string,
  status: OrderStatus
): Promise<Order> => {
  try {
    const response = await api.patch(`/orders/${id}/status`, { status })
    return response.data
  } catch (error) {
    logger.error("Error updating order status:", error)
    throw error
  }
}

/**
 * Get order analytics
 */
export const getAnalytics = async (
  workspaceId: string,
  filters?: Omit<OrderFilters, "page" | "limit">
): Promise<OrderAnalytics> => {
  try {
    const queryParams = new URLSearchParams()

    if (filters?.status) {
      queryParams.append("status", filters.status)
    }

    if (filters?.dateFrom) {
      queryParams.append("dateFrom", filters.dateFrom)
    }

    if (filters?.dateTo) {
      queryParams.append("dateTo", filters.dateTo)
    }

    const queryString = queryParams.toString()
    const requestUrl = `/orders/analytics${
      queryString ? `?${queryString}` : ""
    }`

    const response = await api.get(requestUrl)
    return response.data
  } catch (error) {
    logger.error("Error getting order analytics:", error)
    throw error
  }
}

/**
 * Get orders by date range
 */
export const getByDateRange = async (
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<Order[]> => {
  try {
    const response = await api.get(
      `/orders/date-range?startDate=${startDate}&endDate=${endDate}`
    )
    return response.data
  } catch (error) {
    logger.error("Error getting orders by date range:", error)
    throw error
  }
}

export const ordersApi = {
  getAllForWorkspace,
  getById,
  getByCode,
  getByCustomer,
  create,
  update,
  delete: delete_,
  updateStatus,
  getAnalytics,
  getByDateRange,
}
