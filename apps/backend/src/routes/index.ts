/**
 * 🔹 MAIN ROUTER - INDEX.TS
 *
 * Central routing file for eChatbot backend.
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
import { prisma } from "@echatbot/database"
import { NextFunction, Request, Response, Router } from "express"
import logger from "../utils/logger"

// ============================================================================
// 2. MIDDLEWARE IMPORTS
// ============================================================================
import { authMiddleware } from "../interfaces/http/middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../interfaces/http/middlewares/workspace-validation.middleware"
import { loginBlockingMiddleware } from "../interfaces/http/middlewares/soft-delete.middleware"

// ============================================================================
// 3. SERVICE IMPORTS
// ============================================================================
import { AuthService } from "../application/services/auth.service"
import { CustomerService } from "../application/services/customer.service"
import { OtpService } from "../application/services/otp.service"
import { SecureTokenService } from "../application/services/secure-token.service"
import { UserService } from "../application/services/user.service"
import { LLMRouterService } from "../services/llm-router.service"

// ============================================================================
// 4. CONTROLLER IMPORTS
// ============================================================================
import { AuthController } from "../interfaces/http/controllers/auth.controller"
import { CartTokenController } from "../interfaces/http/controllers/cart-token.controller"
import { CategoryController } from "../interfaces/http/controllers/category.controller"
import { ChatController } from "../interfaces/http/controllers/chat.controller"
import { CustomersController } from "../interfaces/http/controllers/customers.controller"
import { FaqController } from "../interfaces/http/controllers/faq.controller"
import { FeedbackController } from "../interfaces/http/controllers/feedback.controller"
import { filesController } from "../interfaces/http/controllers/files.controller"
import { ProductController } from "../interfaces/http/controllers/product.controller"
import { PushController } from "../interfaces/http/controllers/push.controller"
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
import agentConfigRoutes from "../interfaces/http/routes/agent-config.routes"
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
import {
  invitationRoutes,
  publicInvitationRoutes,
} from "../interfaces/http/routes/invitation.routes"
import { memberRoutes } from "../interfaces/http/routes/member.routes"

// E-commerce
import { cartRouter } from "../interfaces/http/routes/cart.routes"
import { categoriesRouter } from "../interfaces/http/routes/categories.routes"
import certificationRoutes from "../interfaces/http/routes/certification.routes"
import { createCallingFunctionsRouter } from "../interfaces/http/routes/calling-functions.routes"
import { createEnvironmentVariableRoutes } from "../interfaces/http/routes/environment-variable.routes"
import creditNoteRoutes from "../interfaces/http/routes/credit-note.routes"
import typeRoutes from "../interfaces/http/routes/type.routes"
import { chatRouter } from "../interfaces/http/routes/chat.routes"
import { checkoutRouter } from "../interfaces/http/routes/checkout.routes"
import { offersRouter } from "../interfaces/http/routes/offers.routes"
import { createOrderRouter } from "../interfaces/http/routes/order.routes"
import ordersPublicRoutes from "../interfaces/http/routes/orders.routes"
import productsRouter from "../interfaces/http/routes/products.routes"
import publicOrdersRoutes from "../interfaces/http/routes/public-orders.routes"
import { salesRouter } from "../interfaces/http/routes/sales.routes"

// Customer & Communication
import {
  customersRouter,
  workspaceCustomersRouter,
} from "../interfaces/http/routes/customers.routes"
import { faqsRouter } from "../interfaces/http/routes/faqs.routes"
import { feedbackRoutes } from "../interfaces/http/routes/feedback.routes"
import { contactRoutes } from "../interfaces/http/routes/contact.routes"
import filesRoutes from "../interfaces/http/routes/files.routes"
import { pushRoutes } from "../interfaces/http/routes/push.routes"
import { whatsappQueueRoutes } from "../interfaces/http/routes/whatsapp-queue.routes"

// Services
import { servicesRouter } from "../interfaces/http/routes/services.routes"

// Appointments
import { createAppointmentRoutes } from "../interfaces/http/routes/appointment.routes"

// System & Config
import { cartTokenLimiter } from "../config/rate-limiters"
import analyticsRoutes from "../interfaces/http/routes/analytics.routes"
import { billingRouter } from "../interfaces/http/routes/billing.routes"
import {
  publicBillingRoutes,
  billingRoutes as subscriptionBillingRoutes
} from "../interfaces/http/routes/subscription-billing.routes"
import { ownerBillingRoutes } from "../interfaces/http/routes/owner-billing.routes"
import debugRoutes from "../interfaces/http/routes/debug.routes"
import { createLanguagesRouter } from "../interfaces/http/routes/languages.routes"
import gdprRoutes from "../interfaces/http/routes/gdpr.routes"
import { legalDocumentRoutes } from "../interfaces/http/routes/legal-documents.routes"
import { widgetEmbedRoutes } from "../interfaces/http/routes/widget-embed.routes"
import platformConfigRoutes from "../interfaces/http/routes/platform-config.routes"
import pricingRoutes from "../interfaces/http/routes/pricing.routes"
import createSettingsRouter from "../interfaces/http/routes/settings.routes"
import { shortUrlRoutes } from "../interfaces/http/routes/short-url.routes"
import whatsappRoutes from "../interfaces/http/routes/whatsapp.routes"
import { createTokenRouter } from "./token"
import userAdminRoutes from "../interfaces/http/routes/user-admin.routes"
import adminInvoiceRoutes from "../interfaces/http/routes/admin/admin-invoice.routes"
import twoFactorResetRoutes from "../interfaces/http/routes/two-factor-reset.routes"
import { createTrashRoutes } from "../interfaces/http/routes/trash.routes"
import { supportRouter } from "../interfaces/http/routes/support.routes"
import { adminSupportRouter } from "../interfaces/http/routes/admin-support.routes"
import { supportChatRoutes } from "../interfaces/http/routes/support-chat.routes"
import { operatorDashboardRoutes } from "../interfaces/http/routes/operator-dashboard.routes"
import { paypalRoutes } from "../interfaces/http/routes/paypal.routes"
import { pushCampaignRoutes } from "../interfaces/http/routes/push-campaign.routes"
import {
  questionnairePublicRouter,
  questionnaireAdminRouter,
} from "../interfaces/http/routes/onboarding-questionnaire.routes"

// ============================================================================
// 7. TYPE IMPORTS
// ============================================================================

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
        workspaceId,
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
  // 🚨 ONLY supported prefixes: IT, ES, PT (Andrea's rule)
  // For unrecognized prefixes → return "" → caller uses workspace.defaultLanguage
  // +39 = Italy (Italian)
  // +34 = Spain (Spanish)
  // +351 = Portugal (Portuguese)

  if (phoneNumber.startsWith("+39")) {
    return "it" // Italian
  } else if (phoneNumber.startsWith("+34")) {
    return "es" // Spanish
  } else if (phoneNumber.startsWith("+351")) {
    return "pt" // Portuguese
  }
  return "" // Unrecognized → caller uses workspace.defaultLanguage
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

    // 🆕 Feature 174: Removed RegistrationAttempts check - users can receive welcome message freely

    // If no customer is found, this is a new user
    // 🔒 USE LLMService.handleNewUserWelcome() - ENSURES Translation Layer
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
        // 🆕 Feature 174: Removed attemptCount - RegistrationAttempts no longer tracked
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

// Create a router instance
const router = Router()

// Add logging middleware
router.use(loggingMiddleware)

// ⚡ SESSION VALIDATION MIDDLEWARE (with exceptions)
const SESSION_EXEMPT_ROUTES = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/register",
  "/auth/verify-2fa-setup", // 🔒 User hasn't authenticated yet - just registered
  "/auth/verify-2fa", // 🔒 2FA verification during login (creates sessionId)
  "/auth/verify-recovery-code", // 🔒 Recovery code verification (creates sessionId)
  "/auth/2fa/verify", // 🔒 2FA verification during login (creates sessionId)
  "/auth/oauth/google", // 🔒 OAuth Google login/register (creates sessionId after 2FA)
  "/health",
  "/session/validate",
  "/whatsapp/webhook/",
  "/chat", // WhatsApp compatibility endpoint
  "/cart-tokens", // Support interface
  "/token/", // TOKEN-BASED routes (NO sessionId required)
  "/widget/", // 🔌 PUBLIC widget routes (NO auth required)
  "/analytics", // Analytics routes (JWT-based authentication)
  "/pricing", // PUBLIC pricing configuration endpoint (no auth required)
  "/subscription/plans", // PUBLIC subscription plans endpoint (Feature 185)
  "/support-chat", // 🆘 PUBLIC operator handoff routes (token-authenticated)
  "/operator-dashboard", // 📊 PUBLIC operator dashboard routes (token-authenticated)
  "/questionnaire", // 📋 PUBLIC onboarding questionnaire (no auth)
  "/legal-documents", // 📜 PUBLIC legal pages (terms, privacy, refund, GDPR)
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

  // NOTE: SessionId validation removed - using JWT-only authentication
  // All protected routes use authMiddleware which validates JWT token

  // Skip sessionId validation for internal routes (JWT-based)
  if (path.startsWith("/internal/")) {
    logger.debug(`🔓 Internal route (JWT-based): ${path}`)
    return next()
  }

  return next()
})
logger.info("✅ Route middleware configured for JWT-only authentication")

// 🛒 Cart Token Routes (for support interface)
// 🔒 SECURITY: Rate limited to prevent token abuse
router.post("/cart-tokens", cartTokenLimiter, (req, res) =>
  cartTokenController.getCartToken(req, res)
)
router.get("/cart-tokens/:token/validate", cartTokenLimiter, (req, res) =>
  cartTokenController.validateCartToken(req, res)
)

// ============================================================================
// 9. ROUTE DEFINITIONS
// ============================================================================

// ========================================
// 🛡️ WEBHOOK ROUTES (NO SessionID required)
// ========================================
// Mount WhatsApp routes (Meta & UltraMsg)
router.use("/whatsapp", whatsappRoutes)
logger.info("Registered WhatsApp routes for webhook (Meta & UltraMsg)")

// Mount WasenderAPI routes (status update + QR events)
import wasenderRoutes from "../interfaces/http/routes/wasender.routes"
router.use("/", wasenderRoutes)
logger.info("Registered WasenderAPI routes for session management and webhooks")

// WhatsApp webhook routes - Now handled by controller-based architecture
// See: /interfaces/http/controllers/whatsapp-webhook.controller.ts
// See: /interfaces/http/routes/whatsapp.routes.ts

logger.info("Registered WhatsApp webhook routes (public, no authentication)")

// Debug middleware removed - TypeScript errors fixed

// Initialize services (using shared prisma instance from @echatbot/database)
const authService = new AuthService(prisma)
const userService = new UserService(prisma)
const otpService = new OtpService(prisma)
// billingService removed - billing is now handled by message.repository.ts

// Create controllers in advance
const cartTokenController = new CartTokenController()
const customersController = new CustomersController()
const servicesController = new ServicesController()
const feedbackController = new FeedbackController()
const pushController = new PushController()

const categoryController = new CategoryController()

const chatController = new ChatController()
// Removed messageController
const productController = new ProductController()
const userController = new UserController(userService)
const authController = new AuthController(
  authService,
  userService,
  otpService
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

// ========================================
// ⚠️ LEGACY ROUTES (Deprecated - will be removed in v2.0)
// ========================================
// Add deprecation warning middleware
const deprecationWarning = (newPath: string) => (req: Request, res: Response, next: NextFunction) => {
  logger.warn(`⚠️ DEPRECATED: ${req.method} ${req.originalUrl} - Use /api/token${newPath} instead`)
  res.setHeader('Deprecation', 'true')
  res.setHeader('Link', `</api/token${newPath}>; rel="successor-version"`)
  next()
}

router.use("/checkout", deprecationWarning("/checkout"), checkoutRouter)
logger.info("⚠️ LEGACY: /checkout (use /token/checkout instead)")

router.use("/cart", deprecationWarning("/cart"), cartRouter)
logger.info("⚠️ LEGACY: /cart (use /token/cart instead)")

router.use("/registration", deprecationWarning("/registration"), createRegistrationRouter())
logger.info("⚠️ LEGACY: /registration (use /token/registration instead)")

// ========================================
// 🔐 AUTHENTICATED ROUTES (SessionID required)
// ========================================

// ========================================
// 💰 PUBLIC PRICING ROUTES (No auth required)
// ========================================
router.use("/pricing", pricingRoutes)
logger.info("✅ Registered pricing routes (/api/pricing/config)")

// ========================================
// 🚀 PLATFORM CONFIG ROUTES (Public + Admin)
// ========================================
router.use("/platform-config", platformConfigRoutes)
logger.info("✅ Registered platform config routes (/api/platform-config)")

// ========================================
// 🌍 LEGAL DOCUMENTS ROUTES (Public GET, Platform Admin PUT only)
// IMPORTANT: MUST be before customersRouter (mounted at '/') which adds
// authMiddleware to ALL routes, blocking public endpoints like this one
// ========================================
router.use("/legal-documents", legalDocumentRoutes)
logger.info("🌍 Registered GLOBAL legal documents routes: /api/legal-documents (PUBLIC GET, PLATFORM ADMIN PUT)")

// ========================================
// 👥 USER ADMIN ROUTES (Platform Admin only)
// ========================================
router.use("/users", userAdminRoutes)
logger.info("✅ Registered user admin routes (/api/users/admin/*)")

// 🧾 ADMIN INVOICE ROUTES (Platform Admin only)
router.use("/users", adminInvoiceRoutes)
logger.info("✅ Registered admin invoice routes (/api/users/admin/invoices/*)")

// ========================================
// 🗑️ TRASH MANAGEMENT ROUTES (Platform Admin only)
// ========================================
router.use("/admin/trash", createTrashRoutes(prisma as any))
logger.info("✅ Registered trash management routes (/api/admin/trash/*)")

// ========================================
// 🕐 SCHEDULER ROUTES (Platform Admin only)
// ========================================
import schedulerRoutes from "../interfaces/http/routes/scheduler.routes"
router.use("/schedulers", schedulerRoutes)
logger.info("✅ Registered scheduler routes (/api/schedulers)")

// 💳 PUBLIC SUBSCRIPTION PLANS (Feature 185 - No auth required)
router.use("/subscription", publicBillingRoutes) // GET /api/subscription/plans
logger.info("✅ Registered PUBLIC subscription plans route (/api/subscription/plans)")

router.use("/auth", authRouter(authController))
router.use("/auth", twoFactorResetRoutes) // 2FA reset public routes
logger.info("✅ Registered 2FA reset routes (/api/auth/2fa-reset/*)")
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

// ========================================
// ⚙️ AGENT CONFIGURATION API
// ========================================
// ========================================
// 🔓 PUBLIC TEAM INVITATION ROUTES (NO AUTH REQUIRED)
// ========================================
// IMPORTANT: These MUST be mounted BEFORE any router that uses router.use(authMiddleware)
// to prevent the auth middleware from intercepting public requests
router.use("/invitations", publicInvitationRoutes)
logger.info("✅ Registered PUBLIC invitation routes: /api/invitations (validate, accept)")

router.use("/", agentConfigRoutes)
logger.info(
  "✅ Registered agent config routes (/api/workspaces/:workspaceId/agent-config)"
)

// 🔓 PUBLIC CONTACT FORM ROUTE (NO AUTH REQUIRED)
// IMPORTANT: Must be mounted BEFORE customersRouter to prevent auth middleware interception
router.use(contactRoutes())
logger.info("✅ Registered contact route: /api/contact (public)")

// 🔓 PUBLIC QUESTIONNAIRE ROUTE (NO AUTH REQUIRED)
router.use(questionnairePublicRouter)
logger.info("✅ Registered public questionnaire route: POST /api/questionnaire")

// 🔒 ADMIN QUESTIONNAIRE ROUTES (auth required)
router.use("/admin", questionnaireAdminRouter)
logger.info("✅ Registered admin questionnaire routes: /api/admin/questionnaire")

// Removed messages, push-messaging, and push-testing routes (not used by frontend)
router.use("/users", createUserRouter())
// Mount customer routes on both legacy and workspace paths to ensure backward compatibility
router.use("/", customersRouter(customersController))
// Utilizziamo il router specifico per workspaces
router.use("/workspaces", workspaceCustomersRouter(customersController))
// Mount workspace routes (includes the /current endpoint) with authentication FIRST
// 🔒 SECURITY: Only authMiddleware here - sessionValidationMiddleware applied per-route basis
// (POST /workspaces for creation doesn't need session, only JWT token)
// NOTE: workspaceRoutes FIRST (has /badge-stats) before workspaceRoutesLegacy (has /:id which would catch "badge-stats" as ID)
router.use("/workspaces", authMiddleware, workspaceRoutes)
router.use("/workspaces", authMiddleware, workspaceRoutesLegacy)

// 🆕 WIDGET EMBED CODE ROUTES (Protected - workspace admin only)
// Returns HTML/JS snippet for website integration
router.use(
  "/workspaces/:workspaceId/widget",
  authMiddleware,
  workspaceValidationMiddleware,
  widgetEmbedRoutes
)
logger.info(
  "✅ Registered PROTECTED widget embed routes: /api/workspaces/:workspaceId/widget/embed-code"
)

// 🔒 SECURITY (TASK06): Private file serving with authentication
router.use("/files", filesRoutes)
logger.info("✅ Registered PROTECTED file routes: /api/v1/files/private/:category/:folder/:filename")

// Mount invitation and member routes for workspace team management (Feature 184)
// Workspace-scoped routes (require workspaceId in path)
router.use("/workspaces/:workspaceId/invitations", invitationRoutes)
router.use("/workspaces/:workspaceId/members", memberRoutes)
router.use(
  "/workspaces/:workspaceId/functions",
  authMiddleware,
  workspaceValidationMiddleware,
  createCallingFunctionsRouter(prisma as any)
)
router.use(
  "/api",
  createEnvironmentVariableRoutes(prisma as any)
)
logger.info(
  "✅ Registered PROTECTED team management routes: /api/workspaces/:workspaceId/invitations, /api/workspaces/:workspaceId/members"
)

// Push Campaigns v2 (WhatsApp only)
router.use(
  "/workspaces/:workspaceId/push-campaigns",
  pushCampaignRoutes()
)
logger.info(
  "✅ Registered push campaign routes: /api/workspaces/:workspaceId/push-campaigns"
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

// Mount certification routes
router.use("/workspaces/:workspaceId/certifications", certificationRoutes)
logger.info("Registered certification router with workspace routes")

// Mount type routes
router.use("/workspaces/:workspaceId/types", typeRoutes)
logger.info("Registered type router with workspace routes")

// Mount WhatsApp queue routes
router.use(whatsappQueueRoutes)
logger.info("Registered WhatsApp queue router with workspace routes")

// Mount services routes (with authentication)
const servicesRouterInstance = servicesRouter(servicesController)
router.use("/workspaces/:workspaceId/services", servicesRouterInstance)
logger.info("Registered services router with workspace routes")

// Mount FAQs router
const faqsRouterInstance = faqsRouter()
router.use("/workspaces/:workspaceId/faqs", faqsRouterInstance)
router.use("/faqs", faqsRouterInstance)
logger.info("Registered FAQs router with workspace routes")

// Mount billing routes (workspace-scoped) - Feature 185
router.use("/workspaces/:workspaceId/billing", subscriptionBillingRoutes)
logger.info("✅ Registered workspace billing routes: /api/workspaces/:workspaceId/billing")

router.use("/settings", createSettingsRouter())
router.use("/languages", createLanguagesRouter())

// Mount appointment booking routes (Feature: Calendar Booking System)
const appointmentRouter = createAppointmentRoutes(prisma)
router.use("/workspaces/:workspaceId/appointment-types", appointmentRouter)
router.use("/workspaces/:workspaceId/business-hours", appointmentRouter)
router.use("/workspaces/:workspaceId/blackout-periods", appointmentRouter)
router.use("/workspaces/:workspaceId/appointments", appointmentRouter)
router.use("/workspaces/:workspaceId/calendar-connection", appointmentRouter)
logger.info("✅ Registered appointment booking routes: appointment-types, business-hours, blackout-periods, calendar-connection")

// Google Calendar OAuth callback (public — workspaceId encoded in state param)
import { AppointmentController as _AppointmentController } from "../interfaces/http/controllers/appointment.controller"
const _calendarCallbackController = new _AppointmentController(prisma)
router.get(
  "/auth/google/calendar/callback",
  (req, res) => _calendarCallbackController.handleGoogleCalendarCallback(req, res)
)
logger.info("✅ Registered Google Calendar OAuth callback: /api/auth/google/calendar/callback")

// Mount GDPR routes (with workspace context and without)
router.use("/workspaces/:workspaceId/gdpr", gdprRoutes)
router.use("/gdpr", gdprRoutes)
logger.info("Registered GDPR routes (/api/workspaces/:workspaceId/gdpr, /api/gdpr)")

// 🆕 Mount Widget routes (v2) - PUBLIC API with unified queue
// Security: Rate limited + 5-step validation (NO auth required)
import widgetRoutes from "../interfaces/http/routes/widget.routes"
import simulateRoutes from "../interfaces/http/routes/simulate.routes"
router.use("/widget", widgetRoutes)
logger.info("🔌 Registered PUBLIC widget routes v2: /api/v1/widget (unified queue, rate limited, CORS *)")

// Mount owner-based billing routes (Feature 198) - NO WORKSPACEID
// This is the NEW primary billing API - uses userId from JWT token
router.use("/subscription-billing", ownerBillingRoutes)
logger.info(
  "Registered owner billing routes: /api/subscription-billing (Feature 198)"
)

// Mount PayPal connect routes (Owner-only)
router.use("/paypal", paypalRoutes)
logger.info("Registered PayPal connect routes: /api/paypal")

// Mount billing routes (legacy usage tracking - has auth middleware that catches all)
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

// Mount credit notes routes
router.use("/", creditNoteRoutes)
logger.info("Registered credit notes routes for partial refunds")

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

// Mount simulate routes (MCP scenario testing)
router.use("/workspaces/:workspaceId/simulate", simulateRoutes)
logger.info("Registered simulate routes for MCP scenario testing")

// Mount push notification routes
router.use("/workspaces/:workspaceId/push", pushRoutes(pushController))
logger.info("Registered push notification routes for chatbot reactivation")

// 💾 Mount customer routes (internal/admin mostly)

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

// Mount support ticket routes
router.use("/support", supportRouter)
logger.info("Registered support ticket routes for customer support")

// Mount admin support ticket routes
router.use("/admin/support", adminSupportRouter)
logger.info("Registered admin support ticket routes for backoffice")

// Mount operator handoff support-chat routes (PUBLIC, token-authenticated)
router.use("/support-chat", supportChatRoutes)
logger.info("Registered operator support-chat routes (token-auth, no login)")

// Mount operator dashboard routes (PUBLIC, token-authenticated)
router.use("/operator-dashboard", operatorDashboardRoutes)
logger.info("Registered operator dashboard routes (token-auth, no login)")

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

export default router
