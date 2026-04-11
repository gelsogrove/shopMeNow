/**
 * DataLoader Service - Code-First LLM Architecture
 *
 * RESPONSIBILITY: Load data from database based on intent type
 *
 * PRINCIPLES:
 * - ALL data comes from database (NO hardcoded values)
 * - ALL queries filter by workspaceId (multi-tenant isolation)
 * - Returns raw data, no formatting decisions
 * - Deterministic: same intent + params = same data
 */

import { PrismaClient } from "@echatbot/database"
import Fuse from "fuse.js"
import logger from "../../utils/logger"
import {
  Intent,
  isProductSearchIntent,
  isCartIntent,
  isOrderIntent,
  isServiceIntent,
  isSupportIntent,
  isSelectionIntent,
  ShowCategoryIntent,
  ShowProductIntent,
  SearchProductsIntent,
  ShowOffersIntent,
  ShowServiceIntent,
  AddToCartIntent,
  RemoveFromCartIntent,
  UpdateCartQuantityIntent,
  OrderDetailsIntent,
  SelectOptionIntent,
  AskFAQIntent,
} from "../intent/intent.types"
import { OptionsMappingService } from "../chat-engine/options-mapping.service"
import { OrderOptimizationService } from "../services/order-optimization.service"
import { config } from "../../config"

// ================================================================================
// DATA TYPES - What we return from database
// ================================================================================

export interface CategoryData {
  id: string
  name: string
  description?: string
  productCount: number
}

export interface ProductData {
  id: string
  name: string
  sku?: string
  description?: string
  price: number | null // 🔒 Feature 174: null when user is not registered (Rule #4)
  priceWithDiscount?: number | null // 🔒 Feature 174: null when user is not registered (Rule #4)
  stock: number
  imageUrl?: string
  categoryId?: string
  categoryName?: string
  region?: string
  formato?: string
  certifications: string[]
  allergens: string[]
  type?: string
  isAvailable: boolean
}

export interface ServiceData {
  id: string
  name: string
  code: string
  description?: string
  price: number
  priceWithDiscount?: number
  currency: string
  duration?: number
  imageUrl?: string[]
  isAvailable: boolean
}

export interface CartItemData {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  stock: number
  isService?: boolean
}

export interface TransportCostBreakdown {
  byType: Record<string, { itemCount: number; cost: number }>
  totalTransportCost: number
  selectedTypeName?: string | null
  selectedTypeId?: string | null
}

export interface CartData {
  id: string
  items: CartItemData[]
  itemCount: number
  totalAmount: number  // Product subtotal (without transport)
  isEmpty: boolean
  transport?: TransportCostBreakdown  // Transport costs breakdown
}

export interface OrderData {
  id: string
  code: string
  status: string
  totalAmount: number
  itemCount: number
  createdAt: Date
  items?: OrderItemData[]
  hasCreditNotes?: boolean
  creditNotesCount?: number
}

export interface OrderItemData {
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface WorkspaceIdentityData {
  name: string
  description?: string
  botName?: string
  welcomeMessage?: string
}

export interface WorkspaceLocationData {
  address?: string
  phone?: string
  email?: string
}

export interface BusinessInfoData {
  workspaceName: string
  description?: string
  chatbotName?: string
  businessType?: string
  address?: string
}

export interface FAQData {
  id: string
  question: string
  answer: string
  keywords: string[]
  category?: string
}

export interface CustomerProfileData {
  name: string
  email?: string
  phone?: string
  discount: number  // Percentage discount (0-100)
  language?: string
}

export interface OfferData {
  id: string
  name: string
  description?: string
  discountPercent: number
  categoryName?: string
  startDate: Date
  endDate: Date
}

/**
 * Agent info for B2B customers
 * @see Feature 202 - Agent Variables
 */
export interface AgentInfoData {
  hasAgent: boolean
  name?: string
  email?: string
  phone?: string
  reason?: "workspace_no_agents" | "no_agent_assigned"
  message?: string
}

// ================================================================================
// LOADED DATA UNION TYPE
// ================================================================================

export type LoadedData =
  | { type: "CATEGORIES"; categories: CategoryData[] }
  | { type: "PRODUCTS"; products: ProductData[] }
  | { type: "PRODUCT_DETAIL"; product: ProductData | null }
  | { type: "SERVICES"; services: ServiceData[] }
  | { type: "SERVICE_DETAIL"; service: ServiceData | null }
  | { type: "CART"; cart: CartData }
  | { type: "ORDER_LIST"; orders: OrderData[] }
  | { type: "ORDER_DETAIL"; order: OrderData | null }
  | { type: "IDENTITY"; identity: WorkspaceIdentityData }
  | { type: "LOCATION"; location: WorkspaceLocationData }
  | { type: "BUSINESS_INFO"; businessInfo: BusinessInfoData }  // 🆕 "che settore?" / "che tipo di negozio?"
  | { type: "FAQ"; faqs: FAQData[]; query: string }
  | { type: "PROFILE"; profile: CustomerProfileData }
  | { type: "OFFERS"; offers: OfferData[] }
  | { type: "OFFER_WITH_PRODUCTS"; offer: OfferData; products: ProductData[]; categoryName?: string }  // 🆕 Single offer with products
  | { type: "SHOW_SERVICES"; action: "SHOW_SERVICES" }
  | { type: "SHOW_OFFERS"; action: "SHOW_OFFERS" }
  | { type: "ORDER_ACTION"; action: "SEND_INVOICE" | "REPEAT_ORDER" | "SEND_CREDIT_NOTES" | "ADD_ORDER_NOTE"; orderCode?: string }
  | { type: "CART_ACTION"; action: "CONFIRM_ORDER" | "SHOW_PRODUCTS" | "REMOVE_FROM_CART" | "OPTIMIZE_TRANSPORT" }
  | { type: "CART_REMOVAL_OPTIONS"; items: CartRemovalItemData[] }
  | { type: "AGENT_INFO"; agentInfo: AgentInfoData }
  | { type: "NEEDS_LLM_CONTEXT"; label: string; originalListType: string; inferAttempted: string | null }
  | { type: "EMPTY"; reason: string }
  | { type: "ERROR"; error: string }

/**
 * Cart item data for removal selection
 */
export interface CartRemovalItemData {
  id: string
  name: string
  quantity: number
  price: number
  isService: boolean
  number?: number
}

// ================================================================================
// DATA LOADER SERVICE
// ================================================================================

export class DataLoaderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main entry point - load data based on intent
   */
  async loadForIntent(
    intent: Intent,
    workspaceId: string,
    customerId: string,
    customerDiscount: number = 0,
    customerIsActive: boolean = false // 🔒 Feature 174: For price visibility control
  ): Promise<LoadedData> {
    logger.info("📦 [DataLoader] Loading data for intent", {
      intentType: intent.type,
      workspaceId,
      customerId,
    })

    // Product Search Intents
    if (isProductSearchIntent(intent)) {
      switch (intent.type) {
        case "SHOW_CATEGORIES":
        case "SHOW_PRODUCTS":
          // SHOW_PRODUCTS → show categories (user navigates from there)
          return this.loadCategories(workspaceId)
        case "SHOW_CATEGORY":
          return this.loadProductsByCategory(workspaceId, customerDiscount, (intent as ShowCategoryIntent).categoryName)
        case "SHOW_PRODUCT":
          return this.loadProductByName(workspaceId, customerDiscount, (intent as ShowProductIntent).productName, customerIsActive)
        case "SEARCH_PRODUCTS": {
          const query = (intent as SearchProductsIntent).query
          const categoryMatches = await this.matchCategoriesFromQuery(workspaceId, query)
          if (categoryMatches && categoryMatches.length > 0) {
            return { type: "CATEGORIES", categories: categoryMatches }
          }
          return this.loadProductSearch(workspaceId, customerDiscount, query)
        }
        case "SHOW_OFFERS":
          return this.loadOffers(workspaceId, customerDiscount)  // 🆕 Pass discount for single-offer optimization
        default:
          return this.loadProducts(workspaceId, customerDiscount)
      }
    }

    // Cart Intents
    if (isCartIntent(intent)) {
      switch (intent.type) {
        case "VIEW_CART":
          return this.loadCart(workspaceId, customerId, customerDiscount)
        case "ADD_TO_CART":
          return this.handleCartAdd(workspaceId, customerId, customerDiscount, intent as AddToCartIntent)
        case "REMOVE_FROM_CART":
          return this.handleCartRemove(workspaceId, customerId, intent as RemoveFromCartIntent)
        case "UPDATE_CART_QUANTITY":
          return this.handleCartUpdate(workspaceId, customerId, customerDiscount, intent as UpdateCartQuantityIntent)
        case "CLEAR_CART":
          return this.handleCartClear(workspaceId, customerId)
        default:
          return this.loadCart(workspaceId, customerId, customerDiscount)
      }
    }

    // Order Intents
    if (isOrderIntent(intent)) {
      switch (intent.type) {
        case "VIEW_ORDERS":
          return this.loadOrders(workspaceId, customerId)
        case "ORDER_DETAILS":
          return this.loadOrderStatus(workspaceId, customerId, (intent as OrderDetailsIntent).orderCode)
        default:
          return this.loadOrders(workspaceId, customerId)
      }
    }

    // Service Intents
    if (isServiceIntent(intent)) {
      switch (intent.type) {
        case "VIEW_SERVICES":
          return this.loadServices(workspaceId)
        case "SHOW_SERVICE":
          return this.loadServiceByName(workspaceId, (intent as ShowServiceIntent).serviceName)
        default:
          return this.loadServices(workspaceId)
      }
    }

    // Support Intents
    if (isSupportIntent(intent)) {
      switch (intent.type) {
        case "ASK_IDENTITY":
          return this.loadWorkspaceIdentity(workspaceId)
        case "ASK_BUSINESS_INFO":
          return this.loadBusinessInfo(workspaceId)
        case "ASK_LOCATION":
        case "ASK_CONTACT":
          return this.loadWorkspaceLocation(workspaceId)
        case "ASK_FAQ":
          // Load FAQs and pass the user query for context matching
          return this.loadFAQs(workspaceId, (intent as AskFAQIntent).query || "")
        case "VIEW_PROFILE":
          // Load customer profile (includes discount info)
          return this.loadCustomerProfile(workspaceId, customerId)
        case "SHOW_AGENT_INFO":
          // Load agent info for B2B customers
          return this.loadAgentInfo(workspaceId, customerId)
        default:
          return { type: "EMPTY", reason: "support_intent" }
      }
    }

    // Selection Intent - interpret based on listType
    if (isSelectionIntent(intent)) {
      const selectIntent = intent as SelectOptionIntent
      
      // Clean the resolvedValue to remove count suffixes, emojis, etc.
      const cleanedValue = OptionsMappingService.cleanLabel(selectIntent.resolvedValue)
      
      logger.info("📦 [DataLoader] Processing selection", {
        number: selectIntent.number,
        resolvedValue: selectIntent.resolvedValue,
        cleanedValue,
        listType: selectIntent.listType,
        skus: selectIntent.skus,
      })

      switch (selectIntent.listType) {
        case "CATEGORIES":
          // User selected a category → load products in that category
          return this.loadProductsByCategory(workspaceId, customerDiscount, cleanedValue)
        
        case "PRODUCTS":
          // User selected a product → load product detail
          // 🆕 FIX: Use SKU if available (more reliable than name search)
          if (selectIntent.skus && selectIntent.skus.length > 0) {
            logger.info("📦 [DataLoader] Loading product by SKU (reliable)", {
              sku: selectIntent.skus[0],
            })
            return this.loadProductBySku(workspaceId, customerDiscount, selectIntent.skus[0], customerIsActive)
          }
          // Fallback to name search (less reliable)
          return this.loadProductByName(workspaceId, customerDiscount, cleanedValue, customerIsActive)
        
        case "ORDERS":
          // User selected an order → load order details
          // 🆕 CLEAN ARCHITECTURE: Use optionId if available (saved from ResponseBuilder)
          if (selectIntent.optionId) {
            // If optionId is an action (SEND_INVOICE, REPEAT_ORDER), treat as action
            if (["SEND_INVOICE", "REPEAT_ORDER", "SEND_CREDIT_NOTES"].includes(selectIntent.optionId)) {
              logger.info("📦 [DataLoader] ORDERS with action optionId", { optionId: selectIntent.optionId })
              return { type: "ORDER_ACTION", action: selectIntent.optionId as "SEND_INVOICE" | "REPEAT_ORDER" | "SEND_CREDIT_NOTES" }
            }
          }
          return this.loadOrderStatus(workspaceId, customerId, cleanedValue)
        
        case "ORDER_ACTIONS":
          // User selected an action from order detail options
          // 🆕 CLEAN ARCHITECTURE: Use optionId (e.g., "SEND_INVOICE", "REPEAT_ORDER")
          // This is set by ResponseBuilder when building ORDER_DETAIL response
          if (selectIntent.optionId) {
            logger.info("📦 [DataLoader] Using optionId for order action", {
              optionId: selectIntent.optionId,
            })
            if (selectIntent.optionId === "VIEW_ORDERS") {
              return this.loadOrders(workspaceId, customerId)
            }
            const metadataOrderCode = (selectIntent.optionMetadata as any)?.orderCode
            if (selectIntent.optionId === "ADD_ORDER_NOTE") {
              return {
                type: "ORDER_ACTION",
                action: "ADD_ORDER_NOTE",
                orderCode: metadataOrderCode,
              }
            }
            return {
              type: "ORDER_ACTION",
              action: selectIntent.optionId as
                | "SEND_INVOICE"
                | "REPEAT_ORDER"
                | "SEND_CREDIT_NOTES"
                | "ADD_ORDER_NOTE",
              orderCode: metadataOrderCode,
            }
          }
          // 🆕 If no optionId, this is an error - should not happen with clean architecture
          logger.error("📦 [DataLoader] ORDER_ACTIONS without optionId - mapping not saved correctly", {
            cleanedValue,
            selectIntent,
          })
          return { type: "EMPTY", reason: "missing_option_id" }
        
        case "CART_ACTIONS":
          // User selected a cart action from cart view options
          // Options: 1=CONFIRM_ORDER, 2=SHOW_PRODUCTS, 3=REMOVE_FROM_CART
          if (selectIntent.optionId) {
            logger.info("📦 [DataLoader] Processing CART_ACTION", {
              optionId: selectIntent.optionId,
            })
            
            switch (selectIntent.optionId) {
              case "CONFIRM_ORDER":
                // User wants to confirm the order
                return { type: "CART_ACTION", action: "CONFIRM_ORDER" as const }
              
              case "SHOW_PRODUCTS":
              case "SHOW_CATEGORIES":
                // User wants to see more products
                return this.loadCategories(workspaceId)
              
              case "SHOW_SERVICES":
                // User wants to see services
                return this.loadServices(workspaceId)
              
              case "SHOW_OFFERS":
                // User wants to see offers
                return this.loadOffers(workspaceId, customerDiscount)
              
              case "REMOVE_FROM_CART":
                // User wants to remove an item → show cart items with removal options
                return this.loadCartForRemoval(workspaceId, customerId, customerDiscount)
              
              case "CLEAR_CART":
                // User wants to empty the cart completely
                return this.handleCartClear(workspaceId, customerId)
              
              case "OPTIMIZE_TRANSPORT":
                // User wants to optimize transport costs (Premium/Enterprise only)
                logger.info("🚚 [DataLoader] OPTIMIZE_TRANSPORT selected")
                return { type: "CART_ACTION", action: "OPTIMIZE_TRANSPORT" as const }
              
              default:
                logger.warn("📦 [DataLoader] Unknown CART_ACTION", { optionId: selectIntent.optionId })
                return { type: "EMPTY", reason: "unknown_cart_action" }
            }
          }
          logger.error("📦 [DataLoader] CART_ACTIONS without optionId", { selectIntent })
          return { type: "EMPTY", reason: "missing_option_id" }
        
        case "CART_ITEMS":
          // User selected a cart item for removal
          // The optionId contains the cart item ID to remove
          if (selectIntent.optionId) {
            logger.info("🗑️ [DataLoader] CART_ITEMS selection - removing item", {
              cartItemId: selectIntent.optionId,
              itemName: selectIntent.resolvedValue,
            })
            return this.removeCartItem(workspaceId, customerId, selectIntent.optionId, customerDiscount)
          }
          // Fallback: just show cart
          return this.loadCart(workspaceId, customerId, customerDiscount)
        
        case "GROUPS":
          // User selected a product group
          // If SKUs are provided, load products by SKUs directly
          if (selectIntent.skus && selectIntent.skus.length > 0) {
            const products = await this.loadProductsBySkus(workspaceId, selectIntent.skus, customerDiscount)
            return { type: "PRODUCTS", products }
          }
          // Fallback: try by group name (for backward compatibility)
          return this.loadProductsByGroup(workspaceId, customerDiscount, cleanedValue)
        
        case "SERVICES":
          // User selected a service
          // 🔧 FIX: Use code (SKU) if available (more reliable than name search)
          if (selectIntent.skus && selectIntent.skus.length > 0) {
            logger.info("📦 [DataLoader] Loading service by code (reliable)", {
              code: selectIntent.skus[0],
            })
            return this.loadServiceByCode(workspaceId, selectIntent.skus[0])
          }
          // Fallback to name search (less reliable)
          return this.loadServiceByName(workspaceId, cleanedValue)
        
        case "OFFER_CATEGORIES":
          // 🆕 User selected to view products from an offer category
          // The category name is stored in skus[0] (see buildOffersResponse)
          if (selectIntent.skus && selectIntent.skus.length > 0) {
            const categoryName = selectIntent.skus[0]
            logger.info("📦 [DataLoader] Loading products for offer category", {
              categoryName,
            })
            return this.loadProductsByCategory(workspaceId, customerDiscount, categoryName)
          }
          // Fallback to cleanedValue (the option label)
          const categoryMatch = cleanedValue.match(/prodotti\\s+([\\w\\s]+)\\s+in sconto/i)
          if (categoryMatch) {
            return this.loadProductsByCategory(workspaceId, customerDiscount, categoryMatch[1].trim())
          }
          return { type: "EMPTY", reason: "offer_category_not_found" }
        
        case "ORDER_OPTIMIZATION_ACTIONS":
          // 🚚 User selected an option from order optimization menu
          // Options: 1=SHOW_FROZEN_PRODUCTS, 2=SHOW_REFRIGERATED_PRODUCTS, 3=SHOW_AMBIENT_PRODUCTS, 4=SHOW_CART
          if (selectIntent.optionId) {
            logger.info("🚚 [DataLoader] Processing ORDER_OPTIMIZATION_ACTION", {
              optionId: selectIntent.optionId,
            })

            if (selectIntent.optionId === "SHOW_CART") {
              return this.loadCart(workspaceId, customerId, customerDiscount)
            }

            const transportOptionIds = new Set([
              "SHOW_FROZEN_PRODUCTS",
              "SHOW_REFRIGERATED_PRODUCTS",
              "SHOW_AMBIENT_PRODUCTS",
              "SHOW_TRANSPORT_PRODUCTS",
            ])

            if (transportOptionIds.has(selectIntent.optionId)) {
              const targetTransport = this.resolveTypeName(selectIntent)
              if (!targetTransport) {
                logger.warn("🚚 [DataLoader] Transport option missing metadata", {
                  optionId: selectIntent.optionId,
                  resolvedValue: selectIntent.resolvedValue,
                  metadata: selectIntent.optionMetadata,
                })
                return { type: "EMPTY", reason: "missing_transport_type" }
              }
              return this.loadProductsByType(workspaceId, customerDiscount, targetTransport)
            }

            logger.warn("🚚 [DataLoader] Unknown ORDER_OPTIMIZATION_ACTION", { optionId: selectIntent.optionId })
            return { type: "EMPTY", reason: "unknown_optimization_action" }
          }
          logger.error("🚚 [DataLoader] ORDER_OPTIMIZATION_ACTIONS without optionId", { selectIntent })
          return { type: "EMPTY", reason: "missing_option_id" }
        
        case "PRODUCT_DETAIL_ACTIONS":
          if (selectIntent.optionId) {
            logger.info("📦 [DataLoader] Processing PRODUCT_DETAIL_ACTION", {
              optionId: selectIntent.optionId,
            })

            switch (selectIntent.optionId) {
              case "SHOW_CATEGORIES":
              case "SHOW_PRODUCTS":
                return this.loadCategories(workspaceId)
              case "VIEW_CART":
                return this.loadCart(workspaceId, customerId, customerDiscount)
              default:
                logger.warn("📦 [DataLoader] Unknown PRODUCT_DETAIL_ACTION", {
                  optionId: selectIntent.optionId,
                })
                return { type: "EMPTY", reason: "unknown_product_detail_action" }
            }
          }
          logger.error("📦 [DataLoader] PRODUCT_DETAIL_ACTIONS without optionId", { selectIntent })
          return { type: "EMPTY", reason: "missing_option_id" }
        
        default:
          // ========================================================================
          // 🧠 HYBRID FALLBACK: Try inference first, then LLM context
          // This makes the system FLUID - doesn't require explicit IF for every type
          // ========================================================================
          logger.info("🧠 [DataLoader] Unknown listType - attempting inference", { 
            listType: selectIntent.listType,
            label: cleanedValue,
          })
          
          // Step 1: Try to infer action from label text
          const inferredAction = this.inferActionFromLabel(cleanedValue, workspaceId, customerId, customerDiscount)
          if (inferredAction) {
            logger.info("🧠 [DataLoader] ✅ Inference successful", {
              label: cleanedValue,
              inferredType: inferredAction.type,
            })
            return inferredAction
          }
          
          // Step 2: Can't infer - return NEEDS_LLM_CONTEXT for ChatEngine to handle
          logger.info("🧠 [DataLoader] Inference failed - needs LLM context", {
            label: cleanedValue,
            listType: selectIntent.listType,
          })
          return { 
            type: "NEEDS_LLM_CONTEXT", 
            label: cleanedValue,
            originalListType: selectIntent.listType || "unknown",
            inferAttempted: "label_patterns",
          }
      }
    }

    // Default - simple intents
    return { type: "EMPTY", reason: intent.type }
  }

  // ================================================================================
  // 🧠 INFERENCE ENGINE - Try to understand user intent from label text
  // ================================================================================
  
  /**
   * Attempts to infer the user's action from the selected option label
   * This is the FIRST step in the hybrid fallback - fast and deterministic
   * 
   * @returns LoadedData if inference successful, null otherwise
   */
  private inferActionFromLabel(
    label: string,
    workspaceId: string,
    customerId: string,
    customerDiscount: number
  ): LoadedData | null {
    const lowerLabel = label.toLowerCase()
    
    logger.debug("🧠 [Inference] Analyzing label", { label, lowerLabel })
    
    // ========================================================================
    // CART ACTIONS - Confirm, Browse, Remove
    // ========================================================================
    if (lowerLabel.includes("conferma") || lowerLabel.includes("ordine") && lowerLabel.includes("conferma")) {
      logger.info("🧠 [Inference] Matched: CONFIRM_ORDER")
      return { type: "CART_ACTION", action: "CONFIRM_ORDER" }
    }
    
    if (lowerLabel.includes("catalogo") || lowerLabel.includes("esplorare") || 
        lowerLabel.includes("altri prodotti") || lowerLabel.includes("vedere prodotti")) {
      logger.info("🧠 [Inference] Matched: SHOW_PRODUCTS (will load categories)")
      // Return categories so user can browse
      return null // Let it go to LLM to load categories dynamically
    }
    
    if (lowerLabel.includes("rimuov") || lowerLabel.includes("elimina") || lowerLabel.includes("togli")) {
      logger.info("🧠 [Inference] Matched: REMOVE_FROM_CART")
      return { type: "CART_ACTION", action: "REMOVE_FROM_CART" }
    }
    
    // ========================================================================
    // ORDER ACTIONS - Repeat, Credit Note
    // ========================================================================
    // NOTE: "fattura"/"invoice" patterns removed - LLM Intent Parser handles these
    
    if (lowerLabel.includes("ripeti") || lowerLabel.includes("repeat") || lowerLabel.includes("riordina")) {
      logger.info("🧠 [Inference] Matched: REPEAT_ORDER")
      return { type: "ORDER_ACTION", action: "REPEAT_ORDER" }
    }
    
    if (lowerLabel.includes("nota di credito") || lowerLabel.includes("credit")) {
      logger.info("🧠 [Inference] Matched: SEND_CREDIT_NOTES")
      return { type: "ORDER_ACTION", action: "SEND_CREDIT_NOTES" }
    }
    
    // ========================================================================
    // No match found
    // ========================================================================
    logger.debug("🧠 [Inference] No pattern matched", { label })
    return null
  }

  // ================================================================================
  // CATALOG LOADERS
  // ================================================================================

  private async loadCategories(workspaceId: string): Promise<LoadedData> {
    try {
      const categoryData = await this.fetchCategories(workspaceId)
      return { type: "CATEGORIES", categories: categoryData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading categories", { error })
      return { type: "ERROR", error: "Failed to load categories" }
    }
  }

  private async fetchCategories(workspaceId: string): Promise<CategoryData[]> {
    const categories = await this.prisma.categories.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: { productCategories: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      productCount: c._count.productCategories,
    }))
  }

  private async loadServices(workspaceId: string): Promise<LoadedData> {
    try {
      const services = await this.prisma.services.findMany({
        where: { workspaceId, isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          price: true,
          currency: true,
          duration: true,
          imageUrl: true,
        },
        orderBy: { name: "asc" },
      })

      const serviceData: ServiceData[] = services.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        description: s.description || undefined,
        price: Number(s.price),
        currency: s.currency || "EUR",
        duration: s.duration || 60,
        imageUrl: this.normalizeImageArray(s.imageUrl),
        isAvailable: true,  // Services are always available if active
        priceWithDiscount: Number(s.price),  // Services don't have discounts
      }))

      logger.info("📦 [DataLoader] Loaded services", { 
        workspaceId,
        count: serviceData.length 
      })

      return { type: "SERVICES", services: serviceData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading services", { error })
      return { type: "ERROR", error: "Failed to load services" }
    }
  }

  private async loadServiceByName(workspaceId: string, serviceName: string): Promise<LoadedData> {
    try {
      const service = await this.prisma.services.findFirst({
        where: {
          workspaceId,
          isActive: true,
          name: { contains: serviceName, mode: "insensitive" }
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          price: true,
          currency: true,
          duration: true,
          imageUrl: true,
        },
      })

      if (!service) {
        return { type: "ERROR", error: `Service "${serviceName}" not found` }
      }

      const serviceData: ServiceData = {
        id: service.id,
        name: service.name,
        code: service.code,
        description: service.description || undefined,
        price: Number(service.price),
        currency: service.currency || "EUR",
        duration: service.duration || 60,
        imageUrl: this.normalizeImageArray(service.imageUrl),
        isAvailable: true,
        priceWithDiscount: Number(service.price),
      }

      logger.info("📦 [DataLoader] Loaded service detail", {
        workspaceId,
        serviceName,
        code: service.code
      })

      return { type: "SERVICE_DETAIL", service: serviceData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading service by name", { error, serviceName })
      return { type: "ERROR", error: "Failed to load service" }
    }
  }

  private async loadServiceByCode(workspaceId: string, serviceCode: string): Promise<LoadedData> {
    try {
      const service = await this.prisma.services.findFirst({
        where: {
          workspaceId,
          isActive: true,
          code: serviceCode,
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          price: true,
          currency: true,
          duration: true,
          imageUrl: true,
        },
      })

      if (!service) {
        logger.warn("⚠️ [DataLoader] Service code not found", { serviceCode })
        return { type: "ERROR", error: `Service code "${serviceCode}" not found` }
      }

      const serviceData: ServiceData = {
        id: service.id,
        name: service.name,
        code: service.code,
        description: service.description || undefined,
        price: Number(service.price),
        currency: service.currency || "EUR",
        duration: service.duration || 60,
        imageUrl: this.normalizeImageArray(service.imageUrl),
        isAvailable: true,
        priceWithDiscount: Number(service.price),
      }

      logger.info("📦 [DataLoader] Loaded service by code", {
        workspaceId,
        serviceCode,
        serviceName: service.name
      })

      return { type: "SERVICE_DETAIL", service: serviceData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading service by code", { error, serviceCode })
      return { type: "ERROR", error: "Failed to load service" }
    }
  }

  private async loadProducts(
    workspaceId: string,
    customerDiscount: number,
    limit: number = 100
  ): Promise<LoadedData> {
    try {
      const products = await this.prisma.products.findMany({
        where: { workspaceId, isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          type: true,
          allergens: true,
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
      })

      const productData = this.mapProducts(products, customerDiscount)
      return { type: "PRODUCTS", products: productData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading products", { error })
      return { type: "ERROR", error: "Failed to load products" }
    }
  }

  private async loadProductsByCategory(
    workspaceId: string,
    customerDiscount: number,
    categoryName: string
  ): Promise<LoadedData> {
    try {
      const products = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
          productCategories: {
            some: {
              category: {
                name: { contains: categoryName, mode: "insensitive" },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          type: true,
          allergens: true,
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      })

      const productData = this.mapProducts(products, customerDiscount)
      return { type: "PRODUCTS", products: productData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading products by category", { error })
      return { type: "ERROR", error: "Failed to load products" }
    }
  }

  /**
   * 🚚 Load products by transport type (Frozen, Refrigerated, Ambient Temperature)
   * Used for Order Optimization feature
   */
  private async loadProductsByType(
    workspaceId: string,
    customerDiscount: number,
    typeName: string
  ): Promise<LoadedData> {
    try {
      logger.info("🚚 [DataLoader] Loading products by transport type", {
        workspaceId,
        typeName,
      })
      
      const products = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
          OR: [
            { type: { contains: typeName, mode: "insensitive" } },
            {
              productTypes: {
                some: {
                  type: {
                    name: { contains: typeName, mode: "insensitive" },
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          type: true,
          allergens: true,
          productCertifications: {
            select: {
              certification: { select: { name: true } },
            },
          },
          productTypes: {
            select: {
              type: { select: { name: true } },
            },
          },
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: "asc" },
        take: 20, // Limit to avoid too many results
      })

      logger.info("🚚 [DataLoader] Found products by transport type", {
        typeName,
        count: products.length,
      })

      if (products.length === 0) {
        return { type: "EMPTY", reason: `no_products_for_transport_${typeName}` }
      }

      const productData = this.mapProducts(products, customerDiscount)
      return { type: "PRODUCTS", products: productData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading products by transport type", { error, typeName })
      return { type: "ERROR", error: "Failed to load products by transport type" }
    }
  }

  /**
   * 🆕 Load product by SKU (exact match - more reliable than name search)
   */
  private async loadProductBySku(
    workspaceId: string,
    customerDiscount: number,
    sku: string,
    customerIsActive: boolean = false // 🔒 Feature 174
  ): Promise<LoadedData> {
    try {
      const product = await this.prisma.products.findFirst({
        where: {
          workspaceId,
          isActive: true,
          sku: sku,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          type: true,
          allergens: true,
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
      })

      if (!product) {
        logger.warn("📦 [DataLoader] Product not found by SKU, falling back to name search", { sku })
        return { type: "PRODUCT_DETAIL", product: null }
      }

      logger.info("📦 [DataLoader] Product found by SKU", { 
        sku, 
        productName: product.name 
      })
      
      const productData = this.mapProduct(product, customerDiscount, customerIsActive)
      return { type: "PRODUCT_DETAIL", product: productData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading product by SKU", { sku, error })
      return { type: "ERROR", error: "Failed to load product" }
    }
  }

  private async loadProductByName(
    workspaceId: string,
    customerDiscount: number,
    productName: string,
    customerIsActive: boolean = false // 🔒 Feature 174: For price visibility control
  ): Promise<LoadedData> {
    try {
      const products = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
          name: { contains: productName, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          allergens: true,
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
        take: 10,
      })

      if (products.length === 0) {
        return { type: "PRODUCT_DETAIL", product: null }
      }

      const rankedProducts = this.rankProductsByName(products, productName)
      const bestMatch = rankedProducts[0]

      const productData = this.mapProduct(bestMatch, customerDiscount, customerIsActive)
      return { type: "PRODUCT_DETAIL", product: productData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading product", { error })
      return { type: "ERROR", error: "Failed to load product" }
    }
  }

  private rankProductsByName<T extends { name: string | null; stock?: number | null }>(
    products: T[],
    query: string
  ): T[] {
    const normalizedQuery = this.normalizeText(query)
    const queryTokens = normalizedQuery
      ? normalizedQuery.split(" ").filter((token) => token.length >= 3)
      : []

    const ranked = products.map((product, index) => {
      const normalizedName = this.normalizeText(product.name || "")
      let score = 0

      if (normalizedName && normalizedQuery) {
        if (normalizedName === normalizedQuery) score += 50
        if (normalizedName.startsWith(normalizedQuery)) score += 25
        if (normalizedName.includes(normalizedQuery)) score += 10

        for (const token of queryTokens) {
          if (normalizedName.includes(token)) {
            score += 5
          }
        }
      }

      if ((product.stock || 0) > 0) {
        score += 20
      }

      return { product, score, index }
    })

    ranked.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }

      const stockDiff = (b.product.stock || 0) - (a.product.stock || 0)
      if (stockDiff !== 0) {
        return stockDiff
      }

      if (a.product.name && b.product.name) {
        return a.product.name.localeCompare(b.product.name)
      }

      return a.index - b.index
    })

    return ranked.map((entry) => entry.product)
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  }

  private tokenizeQuery(message: string): string[] {
    const normalized = this.normalizeText(message)
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    if (!normalized) return []

    return normalized
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  }

  private async matchCategoriesFromQuery(
    workspaceId: string,
    query: string
  ): Promise<CategoryData[] | null> {
    try {
      const tokens = this.tokenizeQuery(query)
      if (tokens.length === 0) {
        return null
      }

      const categories = await this.fetchCategories(workspaceId)
      if (categories.length === 0) {
        return null
      }

      const matchingTokens = tokens.filter((token) =>
        categories.some((category) =>
          this.normalizeText(category.name).includes(token)
        )
      )

      if (matchingTokens.length === 0) {
        return null
      }

      if (matchingTokens.length < 2 && tokens.length > 1) {
        return null
      }

      const scored = categories
        .map((category, index) => ({
          category,
          index,
          score: this.calculateCategoryMatchScore(category.name, matchingTokens),
        }))
        .filter((entry) => entry.score > 0)

      if (scored.length === 0) {
        return null
      }

      scored.sort((a, b) => {
        if (b.score === a.score) {
          return a.index - b.index
        }
        return b.score - a.score
      })

      return scored.map((entry) => entry.category)
    } catch (error) {
      logger.error("❌ [DataLoader] Error matching categories from query", { error })
      return null
    }
  }

  private calculateCategoryMatchScore(name: string, tokens: string[]): number {
    const normalizedName = this.normalizeText(name)
    if (!normalizedName) {
      return 0
    }

    let score = 0
    for (const token of tokens) {
      if (!token) continue
      if (normalizedName === token) {
        score += 20
      } else if (normalizedName.startsWith(token)) {
        score += 10
      } else if (normalizedName.includes(token)) {
        score += 6
      }
    }
    return score
  }

  private async loadProductSearch(
    workspaceId: string,
    customerDiscount: number,
    query: string
  ): Promise<LoadedData> {
    try {
      // SEMPRE usa LLM per filtrare - capisce sinonimi, altre lingue, termini generici
      // Es: "latticini" → formaggi, "dairy" → formaggi, "qualcosa di fresco" → prodotti freschi
      logger.info("📦 [DataLoader] Loading all products for LLM semantic search", {
        query,
        workspaceId,
      })

      const allProducts = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          allergens: true,
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
          productCertifications: {
            select: {
              certification: { select: { name: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      })

      if (allProducts.length === 0) {
        logger.info("📦 [DataLoader] No products in workspace", { workspaceId })
        return { type: "PRODUCTS", products: [] }
      }

      // LLM filtra i prodotti in base alla query
      // Capisce: sinonimi, altre lingue, termini generici, categorie implicite
      const filteredProducts = await this.semanticFilterProducts(allProducts, query, customerDiscount)
      
      logger.info("📦 [DataLoader] LLM filtered products", {
        query,
        totalProducts: allProducts.length,
        matchingProducts: filteredProducts.length,
      })

      return { type: "PRODUCTS", products: filteredProducts }
    } catch (error) {
      logger.error("❌ [DataLoader] Error searching products", { error })
      return { type: "ERROR", error: "Failed to search products" }
    }
  }

  // ================================================================================
  // CART OPERATIONS
  // ================================================================================

  private async loadCart(
    workspaceId: string,
    customerId: string,
    customerDiscount: number
  ): Promise<LoadedData> {
    try {
      const cart = await this.prisma.carts.findFirst({
        where: { customerId, workspaceId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, price: true, stock: true } },
              service: { select: { id: true, name: true, price: true } },
            },
          },
        },
      })

      if (!cart) {
        return {
          type: "CART",
          cart: { id: "", items: [], itemCount: 0, totalAmount: 0, isEmpty: true },
        }
      }

      const cartItems: CartItemData[] = cart.items.map((item) => {
        // Handle both products and services in cart
        const isService = item.itemType === "SERVICE" && item.service
        const isProduct = item.product
        
        if (!isProduct && !isService) {
          logger.warn("⚠️ [DataLoader] Cart item has no product or service", { itemId: item.id })
          // Return a placeholder for orphaned items
          return {
            id: item.id,
            productId: "",
            productName: "[Item rimosso]",
            quantity: item.quantity,
            unitPrice: 0,
            totalPrice: 0,
            stock: 0,
            isService: false,
          }
        }
        
        if (isService) {
          // Service item - no discount, no stock
          const servicePrice = Number(item.service!.price)
          return {
            id: item.id,
            productId: item.serviceId || "",
            productName: item.service!.name,
            quantity: item.quantity,
            unitPrice: servicePrice,
            totalPrice: servicePrice * item.quantity,
            stock: 999, // Services always available
            isService: true,
          }
        }

        // Product item - apply discount if applicable
        const unitPrice = customerDiscount > 0
          ? Number(item.product!.price) * (1 - customerDiscount / 100)
          : Number(item.product!.price)
        return {
          id: item.id,
          productId: item.productId || "",
          productName: item.product!.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
          stock: item.product!.stock,
          isService: false,
        }
      })

      const totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0)

      // Calculate transport costs (Feature: optimize-transport)
      let transport: TransportCostBreakdown | undefined = undefined
      try {
        const orderOptimizationService = new OrderOptimizationService(this.prisma)
        const isTransportConfigured = await orderOptimizationService.hasTransportPricesConfigured(workspaceId)
        
        if (isTransportConfigured && cartItems.length > 0) {
          const analysis = await orderOptimizationService.analyzeCart(workspaceId, customerId)
          
          if (!analysis.isEmpty && analysis.transports.length > 0) {
            const byType: Record<string, { itemCount: number; cost: number }> = {}
            for (const t of analysis.transports) {
              byType[t.typeName] = { itemCount: t.productCount, cost: t.transportPrice }
            }
            transport = {
              byType,
              totalTransportCost: analysis.totalTransportCost,
              selectedTypeName: analysis.selectedTypeName,
              selectedTypeId: analysis.selectedTypeId,
            }
          }
        }
      } catch (transportError) {
        logger.warn("⚠️ [DataLoader] Could not calculate transport costs", {
          error: transportError instanceof Error ? transportError.message : transportError,
          workspaceId,
        })
        // Continue without transport info
      }

      return {
        type: "CART",
        cart: { 
          id: cart.id, 
          items: cartItems, 
          itemCount: cartItems.length, 
          totalAmount, 
          isEmpty: cartItems.length === 0,
          transport,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading cart", { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        customerId,
        workspaceId,
      })
      return { type: "ERROR", error: "Failed to load cart" }
    }
  }

  /**
   * Load cart items formatted for removal selection
   * Shows numbered list of products and services that can be removed
   */
  private async loadCartForRemoval(
    workspaceId: string,
    customerId: string,
    customerDiscount: number
  ): Promise<LoadedData> {
    try {
      const cart = await this.prisma.carts.findFirst({
        where: { customerId, workspaceId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, price: true } },
              service: { select: { id: true, name: true, price: true } },
            },
          },
        },
      })

      if (!cart || cart.items.length === 0) {
        return { type: "EMPTY", reason: "cart_empty_for_removal" }
      }

      const removalItems: CartRemovalItemData[] = cart.items.map((item) => {
        const isService = item.itemType === "SERVICE" && item.service
        
        if (isService) {
          return {
            id: item.id,
            name: item.service!.name,
            quantity: item.quantity,
            price: Number(item.service!.price),
            isService: true,
          }
        }

        // Product
        const price = customerDiscount > 0
          ? Number(item.product!.price) * (1 - customerDiscount / 100)
          : Number(item.product!.price)
        
        return {
          id: item.id,
          name: item.product?.name || "[Prodotto rimosso]",
          quantity: item.quantity,
          price,
          isService: false,
        }
      })

      logger.info("🗑️ [DataLoader] Loaded cart for removal", {
        itemCount: removalItems.length,
        products: removalItems.filter(i => !i.isService).length,
        services: removalItems.filter(i => i.isService).length,
      })

      return { type: "CART_REMOVAL_OPTIONS", items: removalItems }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading cart for removal", { error })
      return { type: "ERROR", error: "Failed to load cart for removal" }
    }
  }

  private async handleCartAdd(
    workspaceId: string,
    customerId: string,
    customerDiscount: number,
    intent: AddToCartIntent
  ): Promise<LoadedData> {
    try {
      logger.info("🛒 [DataLoader] Adding to cart", {
        productId: intent.productId,
        productName: intent.productName,
        quantity: intent.quantity,
      })

      // Find product by ID (preferred) or by name (fallback with fuzzy search)
      let product
      if (intent.productId) {
        product = await this.prisma.products.findFirst({
          where: { id: intent.productId, workspaceId, isActive: true },
          select: { id: true, name: true, price: true, stock: true },
        })
      }
      
      if (!product && intent.productName) {
        // Try exact contains first
        product = await this.prisma.products.findFirst({
          where: { workspaceId, isActive: true, name: { contains: intent.productName, mode: "insensitive" } },
          select: { id: true, name: true, price: true, stock: true },
        })
        
        // If not found, try fuzzy search with word roots (handles plurals like "pecorini" → "pecorino")
        if (!product) {
          // Remove common Italian plural endings and search
          const searchTerm = intent.productName
            .replace(/i$/i, "")  // pecorini → pecorin
            .replace(/e$/i, "")  // mele → mel
            .replace(/hi$/i, "o") // funghi → fungo
            .trim()
          
          if (searchTerm.length >= 3) {
            product = await this.prisma.products.findFirst({
              where: { 
                workspaceId, 
                isActive: true, 
                name: { contains: searchTerm, mode: "insensitive" } 
              },
              select: { id: true, name: true, price: true, stock: true },
            })
            
            if (product) {
              logger.info("🛒 [DataLoader] Found product via fuzzy search", {
                searchTerm,
                originalTerm: intent.productName,
                foundProduct: product.name,
              })
            }
          }
        }
      }

      if (!product) {
        logger.warn("🛒 [DataLoader] Product not found for cart add", {
          productId: intent.productId,
          productName: intent.productName,
          searchAttempts: {
            byId: !!intent.productId,
            byExactName: !!intent.productName,
            fuzzySearchTerm: intent.productName?.replace(/i$/i, "").replace(/e$/i, "").replace(/hi$/i, "o").trim(),
          }
        })
        return { type: "ERROR", error: "Product not found" }
      }
      
      if (product.stock !== null && product.stock < intent.quantity) {
        return { type: "ERROR", error: `Insufficient stock. Available: ${product.stock}` }
      }

      let cart = await this.prisma.carts.findFirst({ where: { customerId, workspaceId } })
      if (!cart) {
        cart = await this.prisma.carts.create({ data: { customerId, workspaceId } })
      }

      const existingItem = await this.prisma.cartItems.findFirst({ where: { cartId: cart.id, productId: product.id } })
      if (existingItem) {
        await this.prisma.cartItems.update({ where: { id: existingItem.id, cart: { workspaceId } }, data: { quantity: existingItem.quantity + intent.quantity } })
        logger.info("🛒 [DataLoader] Updated existing cart item", {
          productName: product.name,
          newQuantity: existingItem.quantity + intent.quantity,
        })
      } else {
        await this.prisma.cartItems.create({ data: { cartId: cart.id, productId: product.id, quantity: intent.quantity } })
        logger.info("🛒 [DataLoader] Created new cart item", {
          productName: product.name,
          quantity: intent.quantity,
        })
      }

      return this.loadCart(workspaceId, customerId, customerDiscount)
    } catch (error) {
      logger.error("❌ [DataLoader] Error adding to cart", { error })
      return { type: "ERROR", error: "Failed to add to cart" }
    }
  }

  private async handleCartRemove(
    workspaceId: string,
    customerId: string,
    intent: RemoveFromCartIntent
  ): Promise<LoadedData> {
    try {
      const cart = await this.prisma.carts.findFirst({ where: { customerId, workspaceId } })
      if (!cart) return { type: "ERROR", error: "Cart not found" }

      // Clean the product name (remove emoji prefix like "🎁 ")
      const cleanName = intent.productName.replace(/^[🎁🛒✅❌⚠️]\s*/g, "").trim()
      
      logger.info("🛒 [DataLoader] Removing from cart", {
        originalName: intent.productName,
        cleanName,
        cartId: cart.id,
      })

      // Try to find as product first
      const product = await this.prisma.products.findFirst({
        where: { workspaceId, name: { contains: cleanName, mode: "insensitive" } },
      })
      
      if (product) {
        await this.prisma.cartItems.deleteMany({ where: { cartId: cart.id, productId: product.id } })
        logger.info("✅ [DataLoader] Removed product from cart", { productName: product.name })
        return this.loadCart(workspaceId, customerId, 0)
      }

      // If not found as product, try to find as service
      const service = await this.prisma.services.findFirst({
        where: { workspaceId, name: { contains: cleanName, mode: "insensitive" } },
      })
      
      if (service) {
        await this.prisma.cartItems.deleteMany({ where: { cartId: cart.id, serviceId: service.id } })
        logger.info("✅ [DataLoader] Removed service from cart", { serviceName: service.name })
        return this.loadCart(workspaceId, customerId, 0)
      }

      logger.warn("⚠️ [DataLoader] Item not found for removal", { cleanName, workspaceId })
      return { type: "ERROR", error: `Item "${cleanName}" not found in catalog` }
    } catch (error) {
      logger.error("❌ [DataLoader] Error removing from cart", { error })
      return { type: "ERROR", error: "Failed to remove from cart" }
    }
  }

  /**
   * Remove a cart item by its ID (from CART_ITEMS selection)
   */
  private async removeCartItem(
    workspaceId: string,
    customerId: string,
    cartItemId: string,
    customerDiscount: number
  ): Promise<LoadedData> {
    try {
      // Find the cart item to get its name for confirmation message (with workspace isolation)
      const cartItem = await this.prisma.cartItems.findFirst({
        where: { id: cartItemId, cart: { workspaceId } },
        include: {
          product: { select: { name: true } },
          service: { select: { name: true } },
        },
      })

      if (!cartItem) {
        logger.warn("⚠️ [DataLoader] Cart item not found for removal", { cartItemId })
        return { type: "ERROR", error: "Articolo non trovato nel carrello" }
      }

      const itemName = cartItem.service?.name || cartItem.product?.name || "Articolo"
      const isService = !!cartItem.serviceId

      // Delete the cart item (with workspace isolation)
      await this.prisma.cartItems.delete({ where: { id: cartItemId, cart: { workspaceId } } })

      logger.info("✅ [DataLoader] Cart item removed by ID", {
        cartItemId,
        itemName,
        isService,
      })

      // Return updated cart
      return this.loadCart(workspaceId, customerId, customerDiscount)
    } catch (error) {
      logger.error("❌ [DataLoader] Error removing cart item by ID", { error, cartItemId })
      return { type: "ERROR", error: "Failed to remove cart item" }
    }
  }

  private async handleCartUpdate(
    workspaceId: string,
    customerId: string,
    customerDiscount: number,
    intent: UpdateCartQuantityIntent
  ): Promise<LoadedData> {
    try {
      const cart = await this.prisma.carts.findFirst({ where: { customerId, workspaceId } })
      if (!cart) return { type: "ERROR", error: "Cart not found" }

      // Clean the product name (remove emoji prefix like "🎁 ")
      const cleanName = intent.productName.replace(/^[🎁🛒✅❌⚠️]\s*/g, "").trim()

      if (intent.quantity <= 0) {
        return this.handleCartRemove(workspaceId, customerId, { type: "REMOVE_FROM_CART", productName: cleanName })
      }

      // Try to find as product first
      const product = await this.prisma.products.findFirst({
        where: { workspaceId, name: { contains: cleanName, mode: "insensitive" } },
      })
      if (product) {
        await this.prisma.cartItems.updateMany({ where: { cartId: cart.id, productId: product.id }, data: { quantity: intent.quantity } })
        return this.loadCart(workspaceId, customerId, customerDiscount)
      }

      // If not found as product, try to find as service
      const service = await this.prisma.services.findFirst({
        where: { workspaceId, name: { contains: cleanName, mode: "insensitive" } },
      })
      if (service) {
        await this.prisma.cartItems.updateMany({ where: { cartId: cart.id, serviceId: service.id }, data: { quantity: intent.quantity } })
        return this.loadCart(workspaceId, customerId, customerDiscount)
      }

      return { type: "ERROR", error: `Item "${cleanName}" not found in catalog` }
    } catch (error) {
      logger.error("❌ [DataLoader] Error updating cart", { error })
      return { type: "ERROR", error: "Failed to update cart" }
    }
  }

  private async handleCartClear(workspaceId: string, customerId: string): Promise<LoadedData> {
    try {
      const cart = await this.prisma.carts.findFirst({ where: { customerId, workspaceId } })
      if (cart) {
        await this.prisma.cartItems.deleteMany({ where: { cartId: cart.id } })
      }
      return { type: "CART", cart: { id: cart?.id || "", items: [], itemCount: 0, totalAmount: 0, isEmpty: true } }
    } catch (error) {
      logger.error("❌ [DataLoader] Error clearing cart", { error })
      return { type: "ERROR", error: "Failed to clear cart" }
    }
  }

  // ================================================================================
  // ORDER LOADERS
  // ================================================================================

  private async loadOrders(workspaceId: string, customerId: string): Promise<LoadedData> {
    try {
      const orders = await this.prisma.orders.findMany({
        where: { customerId, workspaceId },
        include: {
          items: { select: { quantity: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })

      const orderData: OrderData[] = orders.map((o) => ({
        id: o.id,
        code: o.orderCode,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: o.createdAt,
      }))

      return { type: "ORDER_LIST", orders: orderData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading orders", { error })
      return { type: "ERROR", error: "Failed to load orders" }
    }
  }

  private async loadOrderStatus(
    workspaceId: string,
    customerId: string,
    orderCode?: string
  ): Promise<LoadedData> {
    try {
      const includeConfig = {
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            product: { select: { name: true } },
          },
        },
        creditNotes: {
          select: {
            id: true,
            creditNoteCode: true,
            amount: true,
            reason: true,
          },
        },
      } as const

      let order = null

      if (orderCode && orderCode.trim().length > 0) {
        order = await this.prisma.orders.findFirst({
          where: {
            OR: [
              { id: orderCode, customerId, workspaceId },
              { orderCode, customerId, workspaceId },
            ],
          },
          include: includeConfig,
        })
      }

      if (!order) {
        order = await this.prisma.orders.findFirst({
          where: { customerId, workspaceId },
          orderBy: { createdAt: "desc" },
          include: includeConfig,
        })
      }

      if (!order) return { type: "ORDER_DETAIL", order: null }

      return {
        type: "ORDER_DETAIL",
        order: {
          id: order.id,
          code: order.orderCode,
          status: order.status,
          totalAmount: Number(order.totalAmount),
          itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            productName: item.product?.name || "Unknown",
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          })),
          hasCreditNotes: order.creditNotes && order.creditNotes.length > 0,
          creditNotesCount: order.creditNotes?.length || 0,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading order", { error })
      return { type: "ERROR", error: "Failed to load order" }
    }
  }

  /**
   * @deprecated Use optionId from selectIntent instead
   * This method had hardcoded language patterns which break multilingual support
   * Kept only for reference - should not be called
   */
  private parseOrderAction(selectedLabel: string): LoadedData {
    logger.error("📦 [DataLoader] parseOrderAction called - should use optionId instead!", { selectedLabel })
    return { type: "EMPTY", reason: "deprecated_parse_order_action" }
  }

  // ================================================================================
  // WORKSPACE INFO
  // ================================================================================

  private async loadWorkspaceIdentity(workspaceId: string): Promise<LoadedData> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, description: true, botIdentityResponse: true, welcomeMessage: true },
      })
      if (!workspace) return { type: "ERROR", error: "Workspace not found" }
      // Handle botIdentityResponse (String) and welcomeMessage (Json)
      let welcomeMsg: string | undefined = undefined
      if (workspace.welcomeMessage) {
        welcomeMsg = typeof workspace.welcomeMessage === "string" 
          ? workspace.welcomeMessage 
          : JSON.stringify(workspace.welcomeMessage)
      }
      return {
        type: "IDENTITY",
        identity: {
          name: workspace.name,
          description: workspace.description || undefined,
          botName: workspace.botIdentityResponse || undefined,
          welcomeMessage: welcomeMsg,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading workspace identity", { error })
      return { type: "ERROR", error: "Failed to load workspace info" }
    }
  }

  /**
   * Load business info (sector/type) for ASK_BUSINESS_INFO intent
   * Returns the business type and chatbot name for "che settore?" questions
   */
  private async loadBusinessInfo(workspaceId: string): Promise<LoadedData> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { 
          name: true, 
          description: true,
          address: true,
        },
      })
      if (!workspace) return { type: "ERROR", error: "Workspace not found" }
      
      return {
        type: "BUSINESS_INFO",
        businessInfo: {
          workspaceName: workspace.name,
          description: workspace.description || undefined,
          address: workspace.address || undefined,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading business info", { error })
      return { type: "ERROR", error: "Failed to load business info" }
    }
  }

  private async loadWorkspaceLocation(workspaceId: string): Promise<LoadedData> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { address: true, notificationEmail: true, whatsappPhoneNumber: true },
      })
      if (!workspace) return { type: "ERROR", error: "Workspace not found" }
      return {
        type: "LOCATION",
        location: {
          address: workspace.address || undefined,
          email: workspace.notificationEmail || undefined,
          phone: workspace.whatsappPhoneNumber || undefined,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading workspace location", { error })
      return { type: "ERROR", error: "Failed to load location info" }
    }
  }

  /**
   * Load FAQs for the workspace
   * Returns all active FAQs for LLM to match against user query
   */
  private async loadFAQs(workspaceId: string, query: string): Promise<LoadedData> {
    try {
      const faqs = await this.prisma.fAQ.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        select: {
          id: true,
          question: true,
          answer: true,
          keywords: true,
          category: true,
        },
        orderBy: { order: "asc" },
      })

      logger.info("📦 [DataLoader] Loaded FAQs", {
        workspaceId,
        faqCount: faqs.length,
        query,
      })

      return {
        type: "FAQ",
        faqs: faqs.map((faq) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          keywords: faq.keywords,
          category: faq.category || undefined,
        })),
        query,
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading FAQs", { error })
      return { type: "ERROR", error: "Failed to load FAQs" }
    }
  }

  /**
   * Load customer profile (includes discount information)
   */
  private async loadCustomerProfile(workspaceId: string, customerId: string): Promise<LoadedData> {
    try {
      const customer = await this.prisma.customers.findFirst({
        where: {
          id: customerId,
          workspaceId,
        },
        select: {
          name: true,
          email: true,
          phone: true,
          discount: true,
          language: true,
        },
      })

      if (!customer) {
        return { type: "ERROR", error: "Customer not found" }
      }

      logger.info("📦 [DataLoader] Loaded customer profile", {
        workspaceId,
        customerId,
        discount: customer.discount,
      })

      return {
        type: "PROFILE",
        profile: {
          name: customer.name,
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          discount: customer.discount || 0,
          language: customer.language || undefined,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading customer profile", { error })
      return { type: "ERROR", error: "Failed to load profile" }
    }
  }

  /**
   * Load agent info for B2B customer
   * @see Feature 202 - Agent Variables
   * 
   * Returns agent details if:
   * 1. Workspace has hasSalesAgents=true
   * 2. Customer has a salesId assigned
   * 
   * Otherwise returns a message indicating no agent is assigned
   */
  private async loadAgentInfo(workspaceId: string, customerId: string): Promise<LoadedData> {
    try {
      // First check if workspace has sales agents enabled
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          hasSalesAgents: true,
          name: true,
        },
      })

      if (!workspace) {
        return { type: "ERROR", error: "Workspace not found" }
      }

      // If workspace doesn't use sales agents, return appropriate message
      if (!workspace.hasSalesAgents) {
        logger.info("📦 [DataLoader] Workspace doesn't use sales agents", { workspaceId })
        return {
          type: "AGENT_INFO",
          agentInfo: {
            hasAgent: false,
            reason: "workspace_no_agents",
            message: "This workspace doesn't use dedicated sales agents. For assistance, please contact our support team.",
          },
        }
      }

      // Load customer with agent info
      const customer = await this.prisma.customers.findFirst({
        where: {
          id: customerId,
          workspaceId,
        },
        select: {
          salesId: true,
          sales: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      })

      if (!customer) {
        return { type: "ERROR", error: "Customer not found" }
      }

      // If customer has no assigned agent
      if (!customer.salesId || !customer.sales) {
        logger.info("📦 [DataLoader] Customer has no assigned agent", { workspaceId, customerId })
        return {
          type: "AGENT_INFO",
          agentInfo: {
            hasAgent: false,
            reason: "no_agent_assigned",
            message: "You don't have a dedicated agent assigned yet. For assistance, please contact our support team.",
          },
        }
      }

      // Return agent info
      const agent = customer.sales
      logger.info("📦 [DataLoader] Loaded agent info", {
        workspaceId,
        customerId,
        agentId: agent.id,
      })

      return {
        type: "AGENT_INFO",
        agentInfo: {
          hasAgent: true,
          name: `${agent.firstName || ""} ${agent.lastName || ""}`.trim(),
          email: agent.email || undefined,
          phone: agent.phone || undefined,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading agent info", { error })
      return { type: "ERROR", error: "Failed to load agent info" }
    }
  }

  /**
   * Load active offers for a workspace
   * 🆕 If there's only ONE offer with a category, directly load the products (more fluid UX)
   */
  private async loadOffers(workspaceId: string, customerDiscount: number = 0): Promise<LoadedData> {
    try {
      const now = new Date()
      
      const offers = await this.prisma.offers.findMany({
        where: {
          workspaceId,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          category: true,
        },
        orderBy: { endDate: "asc" },
      })

      logger.info("📦 [DataLoader] Loaded offers", {
        workspaceId,
        count: offers.length,
      })

      // 🆕 If there's only ONE offer with a category, include products WITH offer context
      // This way user sees "20% off on Frozen!" + the actual products
      const offersWithCategories = offers.filter(o => o.category?.name)
      if (offersWithCategories.length === 1) {
        const singleOffer = offersWithCategories[0]
        logger.info("📦 [DataLoader] Single offer with category - loading products WITH offer context", {
          offerName: singleOffer.name,
          categoryName: singleOffer.category?.name,
          discount: singleOffer.discountPercent,
        })
        
        // Load products for this category
        const productsResult = await this.loadProductsByCategory(workspaceId, customerDiscount, singleOffer.category!.name)
        
        // Return OFFER_WITH_PRODUCTS type so formatter shows offer context + products
        return {
          type: "OFFER_WITH_PRODUCTS",
          offer: {
            id: singleOffer.id,
            name: singleOffer.name,
            description: singleOffer.description || undefined,
            discountPercent: singleOffer.discountPercent || 0,
            categoryName: singleOffer.category?.name || undefined,
            startDate: singleOffer.startDate,
            endDate: singleOffer.endDate,
          },
          products: productsResult.type === "PRODUCTS" ? productsResult.products : [],
          categoryName: singleOffer.category?.name,
        }
      }

      return {
        type: "OFFERS",
        offers: offers.map((offer) => ({
          id: offer.id,
          name: offer.name,
          description: offer.description || undefined,
          discountPercent: offer.discountPercent || 0,
          categoryName: offer.category?.name || undefined,
          startDate: offer.startDate,
          endDate: offer.endDate,
        })),
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading offers", { error })
      return { type: "ERROR", error: "Failed to load offers" }
    }
  }

  /**
   * Load products by group name (for hierarchical categories)
   * Groups are sub-categories like "Formaggi Freschi" within "Formaggi"
   */
  private async loadProductsByGroup(
    workspaceId: string,
    customerDiscount: number,
    groupName: string
  ): Promise<LoadedData> {
    try {
      // Groups could be stored as categories with parent relationship
      // or as tags/attributes on products
      // For now, treat group as a category name
      return this.loadProductsByCategory(workspaceId, customerDiscount, groupName)
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading products by group", { error })
      return { type: "ERROR", error: "Failed to load products by group" }
    }
  }

  /**
   * Load products by SKU codes
   * Used when user selects a smart group that contains specific SKUs
   * 🆕 Made public for use in FAST-PATH groupMapping resolution
   */
  async loadProductsBySkus(
    workspaceId: string,
    skus: string[],
    customerDiscount: number = 0,
    customerIsActive: boolean = false // 🔒 Feature 174
  ): Promise<ProductData[]> {
    try {
      logger.info("📦 [DataLoader] Loading products by SKUs", {
        skus,
        count: skus.length,
      })

      const products = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
          sku: { in: skus },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          type: true,
          allergens: true,
          productCategories: {
            select: {
              category: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      })

      if (products.length === 0) {
        logger.warn("📦 [DataLoader] No products found for SKUs", { skus })
        return []
      }

      const productData = products.map((p) => this.mapProduct(p, customerDiscount, customerIsActive))

      logger.info("📦 [DataLoader] Products loaded by SKUs", {
        requested: skus.length,
        found: productData.length,
      })

      return productData
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading products by SKUs", { error, skus })
      return []
    }
  }

  // ================================================================================
  // SEMANTIC FILTERING (LLM-powered)
  // ================================================================================

  /**
   * Use LLM to filter products semantically based on a query
   * E.g., "latticini" → finds products in "Formaggi" category
   */
  private async semanticFilterProducts(
    products: any[],
    query: string,
    customerDiscount: number
  ): Promise<ProductData[]> {
    try {
      const trimmedQuery = query?.trim()
      if (!trimmedQuery) {
        logger.info("📦 [DataLoader] Empty search query", { query })
        return []
      }

      const sanitizedQuery = trimmedQuery.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()
      const fuseQuery = sanitizedQuery.length > 0 ? sanitizedQuery : trimmedQuery

      const fuse = new Fuse(products, {
        keys: [
          { name: "name", weight: 0.5 },
          { name: "description", weight: 0.2 },
          { name: "productCategories.category.name", weight: 0.15 },
          { name: "region", weight: 0.05 },
          { name: "formato", weight: 0.05 },
          { name: "productCertifications.certification.name", weight: 0.05 },
        ],
        threshold: 0.38,
        ignoreLocation: true,
        includeScore: true,
        minMatchCharLength: 2,
      })

      const fuseResults = fuse.search(fuseQuery)
      let candidates = fuseResults.map((result) => result.item)

      if (candidates.length === 0) {
        candidates = this.basicTextMatch(products, trimmedQuery)
      }

      if (candidates.length === 0) {
        candidates = this.findSimilarProductsByName(products, trimmedQuery)
      }

      const limitedCandidates = candidates.slice(0, 25)

      logger.info("📦 [DataLoader] Fuzzy product search", {
        query: trimmedQuery,
        sanitizedQuery: fuseQuery,
        totalProducts: products.length,
        fuseMatches: fuseResults.length,
        fallbackMatches: candidates.length,
        returned: limitedCandidates.length,
      })

      return this.mapProducts(limitedCandidates, customerDiscount)
    } catch (error) {
      logger.error("❌ [DataLoader] Semantic search error", { error })
      return []
    }
  }

  private basicTextMatch(products: any[], query: string): any[] {
    const tokens = this.tokenizeQueryForSearch(query)
    if (tokens.length === 0) {
      return []
    }

    return products.filter((product) => {
      const categoryNames =
        Array.isArray(product.productCategories) && product.productCategories.length > 0
          ? product.productCategories.map((pc: any) => pc.category?.name || "").join(" ")
          : ""

      const certificationNames = Array.isArray(product.productCertifications)
        ? product.productCertifications.map((pc: any) => pc.certification?.name || "").join(" ")
        : Array.isArray(product.certifications)
          ? product.certifications.join(" ")
          : ""

      const normalizedTarget = this.normalizeSearchText(
        [
          product.name || "",
          product.description || "",
          categoryNames,
          certificationNames,
          product.region || "",
          product.formato || "",
        ].join(" ")
      )

      const targetWords = normalizedTarget.split(" ").filter(Boolean)
      const longTokens = tokens.filter((token) => token.length >= 4)
      const tokensToCheck = longTokens.length > 0 ? longTokens : tokens
      const matches = tokensToCheck.filter((token) =>
        this.tokenMatchesTarget(token, normalizedTarget, targetWords)
      ).length
      return matches > 0
    })
  }

  private tokenizeQueryForSearch(query: string): string[] {
    return this.normalizeSearchText(query)
      .split(/\s+/)
      .filter((token) => token.length > 2)
  }

  private normalizeSearchText(value: string): string {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  private tokenMatchesTarget(token: string, normalizedTarget: string, targetWords: string[]): boolean {
    if (!token) {
      return false
    }

    if (normalizedTarget.includes(token)) {
      return true
    }

    for (const word of targetWords) {
      if (word.length <= 1) continue
      if (this.wordSimilarity(word, token) >= 0.66) {
        return true
      }
    }

    return false
  }

  private wordSimilarity(a: string, b: string): number {
    const normalizedA = a.toLowerCase()
    const normalizedB = b.toLowerCase()
    if (normalizedA === normalizedB) {
      return 1
    }
    const maxLen = Math.max(normalizedA.length, normalizedB.length)
    if (maxLen === 0) {
      return 1
    }
    const distance = this.levenshteinDistance(normalizedA, normalizedB)
    return 1 - distance / maxLen
  }

  private levenshteinDistance(a: string, b: string): number {
    const lenA = a.length
    const lenB = b.length
    const matrix: number[][] = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0))

    for (let i = 0; i <= lenA; i++) {
      matrix[i][0] = i
    }
    for (let j = 0; j <= lenB; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= lenA; i++) {
      for (let j = 1; j <= lenB; j++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          )
        }
      }
    }

    return matrix[lenA][lenB]
  }

  private findSimilarProductsByName(products: any[], query: string): any[] {
    const queryTokens = this.tokenizeQueryForSearch(query)
    if (queryTokens.length === 0) {
      return []
    }

    const matches: Array<{ product: any; ratio: number; avgScore: number; combined: number }> = []

    for (const product of products) {
      const normalizedName = this.normalizeSearchText(product.name || "")
      if (!normalizedName) continue
      const nameTokens = normalizedName.split(" ").filter((token) => token.length > 2)
      if (nameTokens.length === 0) continue

      let matchCount = 0
      let totalScore = 0

      for (const nameToken of nameTokens) {
        let bestScore = 0
        for (const queryToken of queryTokens) {
          const similarity = this.wordSimilarity(nameToken, queryToken)
          if (similarity > bestScore) {
            bestScore = similarity
            if (bestScore >= 0.99) break
          }
        }

      if (bestScore >= 0.65) {
        matchCount++
        totalScore += bestScore
      }
      }

      if (matchCount === 0) continue

      const ratio = matchCount / nameTokens.length
      const avgScore = totalScore / matchCount
      const combinedScore = ratio * 0.6 + avgScore * 0.4

      if (combinedScore >= 0.58) {
        matches.push({ product, ratio, avgScore, combined: combinedScore })
      }
    }

    matches.sort((a, b) => b.combined - a.combined)
    return matches.slice(0, 15).map((entry) => entry.product)
  }

  /**
   * Resolve the transport type name from selection metadata or label
   */
  private resolveTypeName(selectIntent: SelectOptionIntent): string | null {
    const metadataName = (selectIntent.optionMetadata as any)?.typeName
    if (typeof metadataName === "string" && metadataName.trim().length > 0) {
      return metadataName.trim()
    }

    if (selectIntent.skus && selectIntent.skus.length > 0) {
      const skuValue = selectIntent.skus[0]
      if (typeof skuValue === "string" && skuValue.trim().length > 0) {
        return skuValue.trim()
      }
    }

    const cleanedLabel = OptionsMappingService.cleanLabel(selectIntent.resolvedValue)
    if (!cleanedLabel) {
      return null
    }

    const normalizedLabel = cleanedLabel.replace(/mostra prodotti/i, "").replace(/prodotti/i, "").trim()
    return normalizedLabel || null
  }

  // ================================================================================
  // HELPERS
  // ================================================================================

  private mapProducts(products: any[], customerDiscount: number, customerIsActive: boolean = false): ProductData[] {
    return products.map((p) => this.mapProduct(p, customerDiscount, customerIsActive))
  }

  private mapProduct(p: any, customerDiscount: number, customerIsActive: boolean = false): ProductData {
    // 🔒 Feature 174: Hide prices for non-registered users (Rule #4)
    const discount = (customerDiscount > 0 && p.price !== null) ? p.price * (1 - customerDiscount / 100) : undefined
    const finalPrice = customerIsActive ? p.price : null
    const finalDiscountedPrice = customerIsActive ? discount : null
    
    // Extract certifications from productCertifications relation (preferred) or fallback to deprecated field
    let certs: string[] = []
    if (p.productCertifications && Array.isArray(p.productCertifications)) {
      certs = p.productCertifications.map((pc: any) => pc.certification?.name).filter(Boolean)
    } else if (Array.isArray(p.certifications)) {
      // Fallback to deprecated field
      certs = p.certifications.map(String)
    }
    const allergenList = Array.isArray(p.allergens) ? p.allergens.map(String) : []
    let type = p.type || undefined
    if (!type && Array.isArray(p.productTypes) && p.productTypes.length > 0) {
      type = p.productTypes[0]?.type?.name || type
    }

    return {
      id: p.id,
      name: p.name,
      sku: p.sku || undefined,
      description: p.description || undefined,
      price: finalPrice, // 🔒 Feature 174: null if user not registered
      priceWithDiscount: finalDiscountedPrice, // 🔒 Feature 174: null if user not registered
      stock: p.stock,
      imageUrl: this.getFirstImageUrl(p.imageUrl),
      categoryId: p.productCategories?.[0]?.category?.id,
      categoryName: p.productCategories?.[0]?.category?.name,
      region: p.region || undefined,
      formato: p.formato || undefined,
      certifications: certs,
      allergens: allergenList,
      type,
      isAvailable: p.stock > 0,
    }
  }

  private getFirstImageUrl(imageField: unknown): string | undefined {
    const urls = this.normalizeImageArray(imageField)
    return urls[0]
  }

  private normalizeImageArray(imageField: unknown): string[] {
    if (!imageField) return []
    const entries = Array.isArray(imageField) ? imageField : [imageField]
    const urls: string[] = []

    for (const entry of entries) {
      if (typeof entry !== "string") continue
      const resolved = this.buildPublicImageUrl(entry)
      if (resolved) {
        urls.push(resolved)
      }
    }

    return urls
  }

  /**
   * Return relative image path - frontend will resolve with IMG_BASE_URL
   * DO NOT build full URL here - let frontend handle it
   */
  private buildPublicImageUrl(imagePath?: string): string | undefined {
    if (!imagePath) return undefined
    const trimmed = imagePath.trim()
    if (!trimmed) return undefined
    // If already absolute URL, extract just the path
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed)
        return url.pathname // Extract /uploads/products/...
      } catch {
        return trimmed
      }
    }
    // Return relative path - frontend will prepend IMG_BASE_URL (3001)
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  }
}

// ================================================================================
// SINGLETON
// ================================================================================

let dataLoaderInstance: DataLoaderService | null = null

export function getDataLoader(prisma: PrismaClient): DataLoaderService {
  if (!dataLoaderInstance) {
    dataLoaderInstance = new DataLoaderService(prisma)
  }
  return dataLoaderInstance
}
