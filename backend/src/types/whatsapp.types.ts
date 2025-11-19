export interface LLMRequest {
  chatInput: string
  workspaceId: string
  customerid: string
  phone: string
  language: string
  sessionId: string
  temperature?: number // 🔧 OPTIONAL: Use database temperature if not specified
  maxTokens: number
  model: string
  messages: any[]
  prompt: string
  welcomeBackMessage?: string // 🎯 TASK: Welcome back message for returning customers
}

export interface LLMResponse {
  output: string
  success: boolean
  functionCalls?: any[]
  translatedQuery?: string
  processedPrompt?: string
  debugInfo?: any // 🔧 NEW: Debug information
}

export interface FunctionCall {
  functionName: string
  arguments: any
  result: any
}

// Interfaces aggiuntive per compatibilità
export interface GetServicesResponse {
  success: boolean
  services: any[]
}

export interface GetShipmentTrackingLinkRequest {
  workspaceId: string
  customerId: string
}

export interface GetCartLinkRequest {
  customerId: string
  workspaceId: string
  step?: number // FR-13: Optional step parameter (1 or 2)
}

export interface GetShipmentTrackingLinkResponse extends StandardResponse {
  linkUrl: string
}

export interface RagSearchRequest {
  query: string
  workspaceId: string
  customerId: string
  messages: any[]
  useCartData?: boolean
  // optional tuning params for short queries
  top_k?: number
  similarityThreshold?: number
}

export interface RagSearchResponse extends StandardResponse {
  results: {
    products?: any[]
    faqs?: any[]
    services?: any[]
    total?: number
  }
  query?: string
  translatedQuery?: string
}

export interface TokenResponse extends StandardResponse {
  token?: string
  expiresAt: string
  linkUrl: string
  action: string
  trackingNumber?: string
  orderCode?: string
}

export interface WhatsAppRequest {
  messageContent: string
  workspaceId: string
  customerid: string
}

export interface WhatsAppResponse extends StandardResponse {
  message: string
}

// Standardized Error Handling Interfaces
export interface StandardResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  details?: string
  timestamp?: string
  // Summary Agent debug information
  summaryAgentExecuted?: boolean
  summaryEmailSent?: boolean
  ticketId?: string
}

export interface ErrorResponse {
  success: false
  error: string
  message: string
  details?: string
  timestamp: string
}

export interface SuccessResponse<T = any> {
  success: true
  data: T
  timestamp: string
}

// Standardized Function Response Types
export interface ProductsResponse extends StandardResponse {
  products?: any[]
  totalCount?: number
}

export interface ServicesResponse extends StandardResponse {
  services?: any[]
  totalCount?: number
}

export interface CategoriesResponse extends StandardResponse {
  categories?: any[]
  totalCount?: number
}

export interface OffersResponse extends StandardResponse {
  offers?: any[]
  totalCount?: number
}
