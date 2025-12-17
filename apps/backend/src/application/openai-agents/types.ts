/**
 * OpenAI Agents SDK - Type Definitions
 * 
 * Custom context types for all agents in the e-commerce chatbot system.
 * All agents share this context for workspace isolation and customer data.
 * 
 * @architecture Clean Architecture - Types layer
 * @security ALL operations MUST be filtered by workspaceId
 */

import { PrismaClient } from "@echatbot/database"

/**
 * Shared context for all agents
 * Contains workspace, customer, and service references
 */
export interface AgentContext {
  // Required identifiers (workspace isolation)
  workspaceId: string
  customerId: string
  conversationId: string
  
  // Customer data (pre-loaded to avoid DB queries)
  customerName?: string
  customerLanguage?: string
  customerEmail?: string
  customerPhone?: string
  customerDiscount?: number
  
  // Database connection
  prisma: PrismaClient
  
  // Optional: conversation history for context
  conversationHistory?: Array<{
    role: "user" | "assistant" | "system"
    content: string
  }>
  
  // Debug mode
  debugMode?: boolean
}

/**
 * Product search result structure
 */
export interface ProductSearchResult {
  id: string
  name: string
  sku?: string
  description?: string
  price: number
  discountedPrice?: number
  stock: number
  categoryName?: string
  supplierName?: string
  imageUrl?: string[]
  isAvailable: boolean
}

/**
 * Cart item structure
 */
export interface CartItemResult {
  id: string
  productId?: string
  serviceId?: string
  productName?: string
  serviceName?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
}

/**
 * Cart structure
 */
export interface CartResult {
  id: string
  items: CartItemResult[]
  totalItems: number
  subtotal: number
  discount: number
  total: number
}

/**
 * Order structure
 */
export interface OrderResult {
  id: string
  orderCode: string
  status: string
  paymentStatus?: string
  totalAmount: number
  shippingAmount?: number
  taxAmount?: number
  discountAmount?: number
  items: Array<{
    productName?: string
    serviceName?: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  createdAt: Date
  trackingNumber?: string
  notes?: string
}

/**
 * Category structure
 */
export interface CategoryResult {
  id: string
  name: string
  slug: string
  description?: string
  productCount: number
}

/**
 * Offer structure
 */
export interface OfferResult {
  id: string
  name: string
  description?: string
  discountPercent: number
  startDate: Date
  endDate: Date
  categoryName?: string
}

/**
 * FAQ structure
 */
export interface FAQResult {
  id: string
  question: string
  answer: string
  category?: string
}

/**
 * Service structure
 */
export interface ServiceResult {
  id: string
  code: string
  name: string
  description: string
  price: number
  duration: number
  imageUrl?: string[]
}

/**
 * Human support request result
 */
export interface HumanSupportResult {
  success: boolean
  ticketId?: string
  message: string
  estimatedWaitTime?: string
}

/**
 * Tool execution result wrapper
 */
export interface ToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Agent execution metrics
 */
export interface AgentMetrics {
  tokensUsed: number
  executionTimeMs: number
  toolCallsCount: number
  handoffsCount: number
}
