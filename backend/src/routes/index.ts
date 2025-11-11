/**
 * 🔹 MAIN ROUTER - INDEX.TS
 *
 * Central routing file for ShopME backend.
 *
 * ORGANIZATION:
 * 1. Core imports (Prisma, Express, Config)
 * 2. Middleware imports
 * 3. Service imports
 * 4. Controller imports
 * 5. Repository imports
 * 6. Router imports (feature-specific)
 * 7. Helper functions (moved to separate files where possible)
 * 8. Route registration
 */

// ============================================================================
// 1. CORE IMPORTS
// ============================================================================
import { PrismaClient } from "@prisma/client"
import { NextFunction, Request, Response, Router } from "express"
import { config } from "../config"
import logger from "../utils/logger"

// ============================================================================
// 2. MIDDLEWARE IMPORTS
// ============================================================================
import { webhookLimiter } from "../config/rate-limiters"
import { authMiddleware } from "../interfaces/http/middlewares/auth.middleware"
import { sessionValidationMiddleware } from "../interfaces/http/middlewares/session-validation.middleware"
import { workspaceValidationMiddleware } from "../interfaces/http/middlewares/workspace-validation.middleware"

// ============================================================================
// 3. SERVICE IMPORTS
// ============================================================================
import { SafetyTranslationAgent } from "../application/agents/SafetyTranslationAgent"
import { OtpService } from "../application/services/otp.service"
import { PasswordResetService } from "../application/services/password-reset.service"
import { RegistrationAttemptsService } from "../application/services/registration-attempts.service"
import { SecureTokenService } from "../application/services/secure-token.service"
import { UserService } from "../application/services/user.service"
import { LLMRouterService } from "../services/llm-router.service"

// ============================================================================
// 4. CONTROLLER IMPORTS
// ============================================================================
import { AuthController } from "../interfaces/http/controllers/auth.controller"
import { CampaignController } from "../interfaces/http/controllers/campaign.controller"
import { CartTokenController } from "../interfaces/http/controllers/cart-token.controller"
import { CategoryController } from "../interfaces/http/controllers/category.controller"
import { ChatController } from "../interfaces/http/controllers/chat.controller"
import { CustomersController } from "../interfaces/http/controllers/customers.controller"
import { FaqController } from "../interfaces/http/controllers/faq.controller"
import { FeedbackController } from "../interfaces/http/controllers/feedback.controller"
import { ProductController } from "../interfaces/http/controllers/product.controller"
import { ServicesController } from "../interfaces/http/controllers/services.controller"
import { SettingsController } from "../interfaces/http/controllers/settings.controller"
import { UserController } from "../interfaces/http/controllers/user.controller"

// ============================================================================
// 5. REPOSITORY IMPORTS
// ============================================================================
import { MessageRepository } from "../repositories/message.repository"

// ============================================================================
// 6. ROUTER IMPORTS (Feature-specific routes)
// ============================================================================
// Agent & AI
import { createAgentRouter } from "../interfaces/http/routes/agent.routes"
import agentChatRoutes from "./agentChatRoutes"

// Auth & User
import { authRouter } from "../interfaces/http/routes/auth.routes"
import createRegistrationRouter from "../interfaces/http/routes/registration.routes"
import { sessionRoutes } from "../interfaces/http/routes/session.routes"
import { createUserRouter } from "../interfaces/http/routes/user.routes"

// Workspace
import { workspaceRoutes } from "../interfaces/http/routes/workspace.routes"
import workspaceRoutesLegacy from "./workspace.routes"

// E-commerce
import { cartRouter } from "../interfaces/http/routes/cart.routes"
import { categoriesRouter } from "../interfaces/http/routes/categories.routes"
import { chatRouter } from "../interfaces/http/routes/chat.routes"
import { checkoutRouter } from "../interfaces/http/routes/checkout.routes"
import { offersRouter } from "../interfaces/http/routes/offers.routes"
import { createOrderRouter } from "../interfaces/http/routes/order.routes"
import ordersPublicRoutes from "../interfaces/http/routes/orders.routes"
import productsRouter from "../interfaces/http/routes/products.routes"
import publicOrdersRoutes from "../interfaces/http/routes/public-orders.routes"
import { salesRouter } from "../interfaces/http/routes/sales.routes"

// Customer & Communication
import { campaignRoutes } from "../interfaces/http/routes/campaign.routes"
import {
  customersRouter,
  workspaceCustomersRouter,
} from "../interfaces/http/routes/customers.routes"
import { faqsRouter } from "../interfaces/http/routes/faqs.routes"
import { feedbackRoutes } from "../interfaces/http/routes/feedback.routes"

// Services & Suppliers
import { servicesRouter } from "../interfaces/http/routes/services.routes"
import supplierRoutes from "../interfaces/http/routes/supplier.routes"

// System & Config
import analyticsRoutes from "../interfaces/http/routes/analytics.routes"
import { billingRouter } from "../interfaces/http/routes/billing.routes"
import debugRoutes from "../interfaces/http/routes/debug.routes"
import { createLanguagesRouter } from "../interfaces/http/routes/languages.routes"
import pricingRoutes from "../interfaces/http/routes/pricing.routes"
import createSettingsRouter from "../interfaces/http/routes/settings.routes"
import { shortUrlRoutes } from "../interfaces/http/routes/short-url.routes"
import whatsappRoutes from "../interfaces/http/routes/whatsapp.routes"
import { createTokenRouter } from "./token"

// ============================================================================
// 7. TYPE IMPORTS
// ============================================================================
import { LLMRequest } from "../types/whatsapp.types"

/**
 * 🔒 BLACKLIST CHECK HELPER
 * Checks if a customer is blacklisted and returns appropriate response
 */
async function checkCustomerBlacklist(
  phoneNumber: string,
  workspaceId: string,
  res: Response,
  format: "WHATSAPP" | "TEST" = "WHATSAPP"
): Promise<boolean> {
  try {
    const customer = await prisma.customers.findFirst({
      where: {
        phone: phoneNumber.replace(/\s+/g, ""),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        language: true,
        isBlacklisted: true,
      },
    })

    // ✅ BLACKLIST CHECK ENABLED - Check customer blacklist status
    logger.info(`🚫 ${format}: Checking blacklist status for ${phoneNumber}`)
    if (customer?.isBlacklisted) {
      logger.info(
        `🚫 ${format}: Customer ${phoneNumber} is blacklisted - IGNORING MESSAGE`
      )
      res.status(200).json({
        success: true,
        data: {
          sessionId: null,
          message: "EVENT_RECEIVED_CUSTOMER_BLACKLISTED",
        },
      })
      return true
    }

    return false
  } catch (error) {
    logger.error(
      `[BLACKLIST_CHECK] Error checking blacklist for ${phoneNumber}:`,
      error
    )
    return false
  }
}

/**
 * � LANGUAGE DETECTION HELPER
 * Determines user language based on phone number prefix
 * @param phoneNumber - User phone number with country prefix
 * @returns Language code (it, es, pt, en)
 */
function detectLanguageFromPhonePrefix(phoneNumber: string): string {
  // Supported country prefixes with their corresponding languages:
  // +39 = Italy (Italian)
  // +34 = Spain (Spanish)
  // +351 = Portugal (Portuguese)
  // All others = Default to English

  if (phoneNumber.startsWith("+39")) {
    return "it" // Italian
  } else if (phoneNumber.startsWith("+34")) {
    return "es" // Spanish
  } else if (phoneNumber.startsWith("+351")) {
    return "pt" // Portuguese
  }
  return "en" // Default to English for all other prefixes
}

/**
 * �🆕 NEW USER WELCOME FLOW HELPER
 * Handles new user detection, registration attempts tracking, and welcome message sending
 * @param phoneNumber - User phone number
 * @param workspaceId - Workspace ID
 * @param messageContent - User message content
 * @param res - Express response object
 * @param format - Format type for logging ('WHATSAPP' or 'TEST')
 * @returns Promise<boolean> - true if handled (response sent), false if should continue normal flow
 */
function getRegistrationText(language: string): {
  link: string
  validity: string
} {
  // Read TOKEN_EXPIRATION from environment (e.g., "15m" or "1h")
  const tokenExpiration = process.env.TOKEN_EXPIRATION || "1h"

  // Parse the duration
  const match = tokenExpiration.match(/^(\d+)([hm])$/)
  let validityText = "1 hour" // Default fallback

  if (match) {
    const value = parseInt(match[1], 10)
    const unit = match[2]

    // Generate text based on language and duration
    if (unit === "m") {
      // Minutes
      validityText =
        language.toLowerCase() === "en"
          ? `${value} minutes`
          : language.toLowerCase() === "es"
            ? `${value} minutos`
            : language.toLowerCase() === "pt"
              ? `${value} minutos`
              : `${value} minuti` // Italian
    } else {
      // Hours
      validityText =
        language.toLowerCase() === "en"
          ? `${value} hour${value > 1 ? "s" : ""}`
          : language.toLowerCase() === "es"
            ? `${value} hora${value > 1 ? "s" : ""}`
            : language.toLowerCase() === "pt"
              ? `${value} hora${value > 1 ? "s" : ""}`
              : `${value} ora${value > 1 ? "" : ""}` // Italian (1 ora, 2 ore)
    }
  }

  switch (language.toLowerCase()) {
    case "en":
      return {
        link: "To continue, register here",
        validity: `Link valid for ${validityText}`,
      }
    case "es":
      return {
        link: "Para continuar, regístrate aquí",
        validity: `Enlace válido por ${validityText}`,
      }
    case "pt":
      return {
        link: "Para continuar, registre-se aqui",
        validity: `Link válido por ${validityText}`,
      }
    case "it":
    default:
      return {
        link: "Per continuare, registrati qui",
        validity: `Link valido per ${validityText}`,
      }
  }
}

async function handleNewUserWelcomeFlow(
  phoneNumber: string,
  workspaceId: string,
  messageContent: string,
  res: Response,
  format: "WHATSAPP" | "TEST" = "WHATSAPP"
): Promise<boolean> {
  try {
    // Initialize services
    const secureTokenService = new SecureTokenService()
    const messageRepository = new MessageRepository()
    const registrationAttemptsService = new RegistrationAttemptsService(prisma)

    // Check if user is blocked due to too many registration attempts
    const isBlocked = await registrationAttemptsService.isBlocked(
      phoneNumber,
      workspaceId
    )
    if (isBlocked) {
      // ✅ REGISTRATION ATTEMPTS CHECK ENABLED - Block users with too many attempts
      logger.info(
        `🚫 ${format}: User ${phoneNumber} is blocked due to too many registration attempts - IGNORING MESSAGE`
      )
      res.status(200).json({
        success: true,
        data: {
          sessionId: null,
          message: "EVENT_RECEIVED_CUSTOMER_BLACKLISTED",
        },
      })
      return true
    }

    // Record this registration attempt
    const attempt = await registrationAttemptsService.recordAttempt(
      phoneNumber,
      workspaceId
    )
    logger.info(
      `📊 ${format}: Registration attempt ${attempt.attemptCount}/3 for ${phoneNumber}`
    )

    // If user is now blocked after this attempt, ignore completely (blacklist totale)
    if (attempt.isBlocked) {
      // ✅ REGISTRATION ATTEMPTS CHECK ENABLED - Block users after too many attempts
      logger.info(
        `🚫 ${format}: User ${phoneNumber} blocked after ${attempt.attemptCount} attempts - IGNORING MESSAGE`
      )
      res.status(200).json({
        success: true,
        data: {
          sessionId: null,
          message: "EVENT_RECEIVED_CUSTOMER_BLACKLISTED",
        },
      })
      return true
    }

    // If no customer is found, this is a new user
    // 🔒 USE LLMService.handleNewUserWelcome() - ENSURES Safety & Translation layer
    const { LLMService } = require("../services/llm.service")
    const llmService = new LLMService()

    const result = await llmService.handleNewUserWelcome(
      phoneNumber,
      workspaceId,
      messageContent
    )

    const completeMessage = result.message
    const { detectedLanguage } = result.debugInfo

    // 💾 SAVE MESSAGE TO HISTORY - Save both user message and welcome response
    await messageRepository.saveMessage({
      workspaceId: workspaceId,
      phoneNumber: phoneNumber,
      message: messageContent,
      response: completeMessage,
      direction: "INBOUND",
      agentSelected: "CHATBOT",
      functionCallsDebug: [],
      processingSource: "new_user_welcome",
      debugInfo: JSON.stringify({
        isNewUser: true,
        detectedLanguage,
        attemptCount: attempt.attemptCount,
        ...result.debugInfo,
      }),
    })

    logger.info(
      `✅ ${format}: New user welcome sent (via LLMService) to ${phoneNumber}`
    )

    res.status(200).json({
      success: true,
      data: {
        sessionId: null,
        message: completeMessage,
      },
    })

    return true
  } catch (error) {
    logger.error(
      `❌ ${format}: Error handling new user welcome flow for ${phoneNumber}:`,
      error
    )
    res.status(500).send("ERROR")
    return true // Error handled
  }
}

// ============================================================================
// 8. HELPER FUNCTIONS
// ============================================================================
// (checkCustomerBlacklist, detectLanguageFromPhonePrefix, getRegistrationText, handleNewUserWelcomeFlow defined above)

// Simple logging middleware
const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  logger.info(`Request: ${req.method} ${req.originalUrl}`)

  // Track the original end method
  const originalEnd = res.end

  // Override the end method to log the response
  res.end = function () {
    logger.info(
      `Response for ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`
    )

    // Call the original end method
    return originalEnd.apply(this, arguments)
  }

  next()
}

// Log router setup
logger.info("Setting up API routes")

// Create a router instance
const router = Router()

// Add logging middleware
router.use(loggingMiddleware)

// � SESSION VALIDATION MIDDLEWARE (with exceptions)
const SESSION_EXEMPT_ROUTES = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/register",
  "/health",
  "/session/validate",
  "/whatsapp/webhook",
  "/chat", // WhatsApp compatibility endpoint
  "/cart-tokens", // Support interface
  "/token/", // TOKEN-BASED routes (NO sessionId required)
  "/analytics", // Analytics routes (JWT-based authentication)
  "/pricing", // PUBLIC pricing configuration endpoint (no auth required)
]

router.use((req: Request, res: Response, next: NextFunction) => {
  const path = req.path

  // Skip sessionId validation for exempt routes
  if (SESSION_EXEMPT_ROUTES.some((route) => path.startsWith(route))) {
    logger.debug(`🔓 SessionID check SKIPPED for exempt route: ${path}`)
    return next()
  }

  // Skip sessionId validation for internal routes (JWT-based)
  if (path.startsWith("/internal/")) {
    logger.debug(`🔓 SessionID check SKIPPED for internal route: ${path}`)
    return next()
  }

  // Apply sessionId validation for all other routes
  logger.debug(`🔒 SessionID validation REQUIRED for: ${path}`)
  return sessionValidationMiddleware(req, res, next)
})
logger.info("✅ Session validation middleware registered with exceptions")

// �🛒 Cart Token Routes (for support interface)
router.post("/cart-tokens", (req, res) =>
  cartTokenController.getCartToken(req, res)
)
router.get("/cart-tokens/:token/validate", (req, res) =>
  cartTokenController.validateCartToken(req, res)
)

// ============================================================================
// 9. ROUTE DEFINITIONS
// ============================================================================

// WhatsApp webhook routes - Now handled by controller-based architecture
// See: /interfaces/http/controllers/whatsapp-webhook.controller.ts
// See: /interfaces/http/routes/whatsapp.routes.ts

logger.info("Registered WhatsApp webhook routes (public, no authentication)")

// Debug middleware removed - TypeScript errors fixed

logger.info("Registered WhatsApp webhook routes (public, no authentication)")

// Debug middleware removed - TypeScript errors fixed

// Initialize Prisma client
const prisma = new PrismaClient()

// Initialize services
const userService = new UserService(prisma)
const otpService = new OtpService(prisma)
const passwordResetService = new PasswordResetService(prisma)
// billingService removed - billing is now handled by message.repository.ts

// Create controllers in advance
const cartTokenController = new CartTokenController()
const customersController = new CustomersController()
const servicesController = new ServicesController()
const campaignController = new CampaignController()
const feedbackController = new FeedbackController()

const categoryController = new CategoryController()

const chatController = new ChatController()
// Removed messageController
const productController = new ProductController()
const userController = new UserController(userService)
const authController = new AuthController(
  userService,
  otpService,
  passwordResetService
)
const faqController = new FaqController()
// Removed whatsappController

// Initialize Settings controller for GDPR routes
const settingsController = new SettingsController()

// ========================================
// 🎫 TOKEN ROUTES (NO SessionID required)
// ========================================
router.use("/token", createTokenRouter())
logger.info(
  "✅ Registered /api/token/* routes (registration, checkout, orders-public)"
)

// Public routes (MUST BE BEFORE AUTH ROUTES)
router.use(shortUrlRoutes)
logger.info("Registered short URL routes for /s/:shortCode redirection")

// Legacy token routes (kept for backward compatibility - will be removed later)
router.use("/checkout", checkoutRouter)
logger.info("⚠️ LEGACY: /checkout (use /token/checkout instead)")

router.use("/cart", cartRouter)
logger.info("⚠️ LEGACY: /cart (use /token/cart instead)")

router.use("/registration", createRegistrationRouter())
logger.info("⚠️ LEGACY: /registration (use /token/registration instead)")

// ========================================
// 🔐 AUTHENTICATED ROUTES (SessionID required)
// ========================================

// ========================================
// 💰 PUBLIC PRICING ROUTES (No auth required)
// ========================================
router.use("/pricing", pricingRoutes)
logger.info("✅ Registered pricing routes (/api/pricing/config)")

router.use("/auth", authRouter(authController))
router.use("/session", sessionRoutes)
logger.info(
  "✅ Registered session routes (/api/session/validate, /api/session/stats)"
)
router.use("/chat", chatRouter(chatController))

// ========================================
// 🤖 MULTI-AGENT CHAT SYSTEM (Sprint 1 - Task 1.5)
// ========================================
router.use("/agent-chat", agentChatRoutes)
logger.info(
  "✅ Registered multi-agent chat routes (/api/agent-chat, /api/agent-chat/metrics, /api/agent-chat/history/:customerId)"
)

// Removed messages, push-messaging, and push-testing routes (not used by frontend)
router.use("/users", createUserRouter())
// Mount customer routes on both legacy and workspace paths to ensure backward compatibility
router.use("/", customersRouter(customersController))
// Utilizziamo il router specifico per workspaces
router.use("/workspaces", workspaceCustomersRouter(customersController))
// Mount workspace routes (includes the /current endpoint) with authentication FIRST
router.use("/workspaces", authMiddleware, workspaceRoutesLegacy)
router.use("/workspaces", workspaceRoutes)

// Mount campaign routes
router.use("/workspaces", campaignRoutes(campaignController))
logger.info(
  "✅ Registered campaign routes: /api/workspaces/:workspaceId/campaigns"
)

// Mount feedback routes (public + admin)
router.use(feedbackRoutes(feedbackController))
logger.info(
  "✅ Registered feedback routes: /api/feedback (public), /api/workspaces/:workspaceId/feedbacks (admin)"
)

// Mount agent routes with workspace parameter properly configured
router.use(
  "/workspaces/:workspaceId/agent",
  (req, res, next) => {
    // Ensure workspaceId is available in params
    if (req.params.workspaceId) {
      logger.debug(
        `Agent route: workspaceId from params: ${req.params.workspaceId}`
      )
    }
    next()
  },
  createAgentRouter()
)
logger.info("Registered agent router with workspace routes only")

// Add a simple test route to debug workspace ID extraction
router.get("/workspaces/:workspaceId/test", authMiddleware, (req, res) => {
  res.json({
    success: true,
    workspaceId: req.params.workspaceId,
    originalUrl: req.originalUrl,
    params: req.params,
    user: req.user ? { userId: (req.user as any).userId } : null,
  })
})

// Mount products routes with workspace context
const productsRouterInstance = productsRouter()
router.use("/workspaces/:workspaceId/products", productsRouterInstance)
logger.info("Registered products router with workspace routes")

// Mount categories routes
const categoriesRouterInstance = categoriesRouter()
router.use("/workspaces/:workspaceId/categories", categoriesRouterInstance)
router.use("/categories", categoriesRouterInstance)
logger.info("Registered categories router with workspace routes")

// Mount sales routes
const salesRouterInstance = salesRouter()
router.use("/workspaces/:workspaceId/sales", salesRouterInstance)
router.use("/sales", salesRouterInstance)
logger.info("Registered sales router with workspace routes")

// Mount suppliers routes
router.use("/workspaces/:workspaceId/suppliers", supplierRoutes)
logger.info("Registered suppliers router with workspace routes")

// Mount services routes (with authentication)
const servicesRouterInstance = servicesRouter(servicesController)
router.use("/workspaces/:workspaceId/services", servicesRouterInstance)
logger.info("Registered services router with workspace routes")

// Mount FAQs router
const faqsRouterInstance = faqsRouter()
router.use("/workspaces/:workspaceId/faqs", faqsRouterInstance)
router.use("/faqs", faqsRouterInstance)
logger.info("Registered FAQs router with workspace routes")

router.use("/settings", createSettingsRouter())
router.use("/languages", createLanguagesRouter())

// Mount billing routes
router.use("/billing", billingRouter)
logger.info("Registered billing routes for usage tracking")

// Mount offers routes
const offersRouterInstance = offersRouter()
router.use("/workspaces/:workspaceId/offers", offersRouterInstance)
router.use("/offers", offersRouterInstance)
logger.info("Registered offers router with workspace routes")

// Mount orders routes
const ordersRouterInstance = createOrderRouter()
router.use("/workspaces/:workspaceId/orders", ordersRouterInstance)
router.use("/orders", ordersRouterInstance)
logger.info("Registered orders router with workspace routes")

// Mount cart routes with workspace context (for price calculation)
router.use("/workspaces/:workspaceId/cart", cartRouter)
logger.info(
  "Registered cart router with workspace routes for price calculation"
)

// Mount public orders routes (JWT-based)
router.use("/orders", ordersPublicRoutes)
logger.info("Registered public orders routes with JWT authentication")

// Mount analytics routes
router.use("/analytics", analyticsRoutes)
logger.info("Registered analytics routes for dashboard metrics")

// Mount debug routes
router.use("/workspaces/:workspaceId/debug", debugRoutes)
logger.info("Registered debug routes for testing and analysis")

// Mount WhatsApp routes
router.use("/whatsapp", whatsappRoutes)
logger.info("Registered WhatsApp routes for webhook and send message")

// Mount public orders routes (for secure token validation and public access)
router.use("/internal", publicOrdersRoutes)
logger.info("Registered public orders routes for secure token validation")

// Add special route for GDPR default content (to handle frontend request to /gdpr/default)
router.get(
  "/gdpr/default",
  authMiddleware,
  settingsController.getDefaultGdprContent.bind(settingsController)
)
logger.info("Registered /gdpr/default route for backward compatibility")

// Health check
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    apiVersion: "v1",
  })
})

// Simple test route for workspace agent debugging (🔒 PROTECTED)
router.get(
  "/workspaces/:workspaceId/agent-test",
  authMiddleware, // ⚠️ FIXED: Added auth protection
  workspaceValidationMiddleware, // ⚠️ FIXED: Added workspace validation
  (req, res) => {
    res.json({
      success: true,
      message: "Test route working",
      workspaceId: req.params.workspaceId,
      originalUrl: req.originalUrl,
      params: req.params,
    })
  }
)

// Database export endpoint (🔒 PROTECTED - Admin only, Workspace-specific)
router.post(
  "/workspaces/:workspaceId/database/export",
  authMiddleware,
  workspaceValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user
      const workspaceId = req.params.workspaceId

      // Check if user is admin
      if (user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          error: "Only admins can export database",
        })
      }

      logger.info(`🗄️ Starting workspace-specific export for: ${workspaceId}`)

      // Execute workspace-specific export script
      const { execSync } = require("child_process")

      try {
        const output = execSync(
          `npx ts-node scripts/export-workspace-backup.ts ${workspaceId}`,
          {
            cwd: process.cwd(),
            encoding: "utf-8",
            stdio: "pipe",
          }
        )

        logger.info("✅ Workspace backup created successfully:", output)

        return res.status(200).json({
          success: true,
          message: `Workspace ${workspaceId} backed up successfully`,
          timestamp: new Date().toISOString(),
        })
      } catch (execError: any) {
        logger.error("❌ Workspace backup error:", execError.message)
        return res.status(500).json({
          success: false,
          error: "Failed to create workspace backup",
          details: execError.message || "Unknown error during backup",
        })
      }
    } catch (error) {
      logger.error("❌ Database export error:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to start database export",
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }
)

// Database import endpoint (🔒 PROTECTED - Admin only, Workspace-specific)
router.post(
  "/workspaces/:workspaceId/database/import",
  authMiddleware,
  workspaceValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user
      const workspaceId = req.params.workspaceId

      // Check if user is admin
      if (user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          error: "Only admins can import database",
        })
      }

      logger.info(`📥 Starting workspace-specific restore for: ${workspaceId}`)

      // Execute workspace-specific restore script synchronously
      const { execSync } = require("child_process")

      try {
        const output = execSync(
          `npx ts-node scripts/restore-workspace-backup.ts ${workspaceId}`,
          {
            cwd: process.cwd(),
            encoding: "utf-8",
            stdio: "pipe",
          }
        )

        logger.info("✅ Workspace restored successfully:", output)

        return res.status(200).json({
          success: true,
          message: `Workspace ${workspaceId} restored successfully from latest backup`,
          timestamp: new Date().toISOString(),
        })
      } catch (execError: any) {
        logger.error("❌ Workspace restore error:", execError.message)
        return res.status(500).json({
          success: false,
          error: "Failed to restore workspace",
          details: execError.message || "Unknown error during restore",
        })
      }
    } catch (error) {
      logger.error("❌ Database import error:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to start database import",
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }
)

logger.info("API routes setup complete")

export default router
