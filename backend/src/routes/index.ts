import { PrismaClient } from "@prisma/client"
import { NextFunction, Request, Response, Router } from "express"
// BillingService import removed - billing handled by message.repository.ts
import { linkGeneratorService } from "../application/services/link-generator.service"
import { OtpService } from "../application/services/otp.service"
import { PasswordResetService } from "../application/services/password-reset.service"
import { RegistrationAttemptsService } from "../application/services/registration-attempts.service"
import { SecureTokenService } from "../application/services/secure-token.service"
import { SpamDetectionService } from "../application/services/spam-detection.service"
import { UserService } from "../application/services/user.service"
import { config } from "../config"
import { webhookLimiter } from "../config/rate-limiters"
// BillingPrices import removed - billing handled by message.repository.ts
import { AuthController } from "../interfaces/http/controllers/auth.controller"
import { CampaignController } from "../interfaces/http/controllers/campaign.controller"
import { CartTokenController } from "../interfaces/http/controllers/cart-token.controller"
import { CategoryController } from "../interfaces/http/controllers/category.controller"
import { ChatController } from "../interfaces/http/controllers/chat.controller"
import { CustomersController } from "../interfaces/http/controllers/customers.controller"
import { FeedbackController } from "../interfaces/http/controllers/feedback.controller"
import { MessageRepository } from "../repositories/message.repository"
// usageService import removed - usage tracking handled by message.repository.ts
import logger from "../utils/logger"

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
    // Determine language based on phone number prefix
    const detectedLanguage = detectLanguageFromPhonePrefix(phoneNumber)

    // Get welcome message from database
    const welcomeMessage = await messageRepository.getWelcomeMessage(
      workspaceId,
      detectedLanguage
    )
    if (!welcomeMessage) {
      logger.error(
        `❌ ${format}: No welcome message found for language ${detectedLanguage} in workspace ${workspaceId}`
      )
      res.status(500).send("ERROR")
      return true
    }

    // Generate secure registration token
    const registrationToken = await secureTokenService.createToken(
      "registration",
      workspaceId,
      { phone: phoneNumber, language: detectedLanguage },
      undefined, // Uses TOKEN_EXPIRATION from env
      undefined,
      phoneNumber
    )

    // Create short registration URL using LinkGeneratorService
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
    const longUrl = `${frontendUrl}/register?token=${registrationToken}&phone=${encodeURIComponent(phoneNumber)}&workspace=${workspaceId}&lang=${detectedLanguage}`
    const registrationUrl = await linkGeneratorService.generateShortLink(
      longUrl,
      workspaceId,
      "registration"
    )

    // Send complete welcome message with registration link in customer's language
    const registrationText = getRegistrationText(detectedLanguage)
    const completeMessage = `${welcomeMessage}\n\n🔗 **${registrationText.link}:**\n${registrationUrl}\n\n⏰ ${registrationText.validity}`

    // 💾 SAVE MESSAGE TO HISTORY - Save both user message and welcome response
    try {
      await messageRepository.saveMessage({
        workspaceId: workspaceId,
        phoneNumber: phoneNumber,
        message: messageContent,
        response: completeMessage,
        direction: "INBOUND", // ✅ CORRECT: User message is INBOUND, system response is OUTBOUND
        agentSelected: "CHATBOT", // ✅ ADD: Set agentSelected to CHATBOT for green styling
        functionCallsDebug: [],
        processingSource: "new_user_welcome",
        debugInfo: JSON.stringify({
          isNewUser: true,
          detectedLanguage: detectedLanguage,
          registrationUrl: registrationUrl,
          attemptCount: attempt.attemptCount,
        }),
      })
      logger.info(
        `💾 ${format}: New user welcome message saved to history for ${phoneNumber}`
      )
    } catch (saveError) {
      logger.error(
        `❌ ${format}: Failed to save new user welcome message:`,
        saveError
      )
      // Continue - don't fail the whole request if save fails
    }

    logger.info(
      `✅ ${format}: New user welcome message sent to ${phoneNumber} in ${detectedLanguage}`
    )
    res.status(200).json({
      success: true,
      data: {
        sessionId: null, // New users don't have a session yet
        message: completeMessage,
      },
    })

    return true // Handled successfully
  } catch (error) {
    logger.error(
      `❌ ${format}: Error handling new user welcome flow for ${phoneNumber}:`,
      error
    )
    res.status(500).send("ERROR")
    return true // Error handled
  }
}

import { FaqController } from "../interfaces/http/controllers/faq.controller"
// Removed MessageController import
import { ProductController } from "../interfaces/http/controllers/product.controller"
import { ServicesController } from "../interfaces/http/controllers/services.controller"

import { UserController } from "../interfaces/http/controllers/user.controller"
// Removed WhatsAppController import
import { createAgentRouter } from "../interfaces/http/routes/agent.routes"
import { authRouter } from "../interfaces/http/routes/auth.routes"
import { cartRouter } from "../interfaces/http/routes/cart.routes"
import { categoriesRouter } from "../interfaces/http/routes/categories.routes"
import { chatRouter } from "../interfaces/http/routes/chat.routes"
import {
  customersRouter,
  workspaceCustomersRouter,
} from "../interfaces/http/routes/customers.routes"
import { salesRouter } from "../interfaces/http/routes/sales.routes"

import { faqsRouter } from "../interfaces/http/routes/faqs.routes"
import { createLanguagesRouter } from "../interfaces/http/routes/languages.routes"
// Removed messagesRouter import
import { offersRouter } from "../interfaces/http/routes/offers.routes"
import { createOrderRouter } from "../interfaces/http/routes/order.routes"
import createRegistrationRouter from "../interfaces/http/routes/registration.routes"
import { servicesRouter } from "../interfaces/http/routes/services.routes"
import createSettingsRouter from "../interfaces/http/routes/settings.routes"

import { checkoutRouter } from "../interfaces/http/routes/checkout.routes"
// Removed whatsappRouter import
import { workspaceRoutes } from "../interfaces/http/routes/workspace.routes"
// Import the legacy workspace routes that has the /current endpoint
import workspaceRoutesLegacy from "./workspace.routes"
// Add these imports for backward compatibility during migration
import { SettingsController } from "../interfaces/http/controllers/settings.controller"
import { authMiddleware } from "../interfaces/http/middlewares/auth.middleware"
import { sessionValidationMiddleware } from "../interfaces/http/middlewares/session-validation.middleware"
import { workspaceValidationMiddleware } from "../interfaces/http/middlewares/workspace-validation.middleware"
import { createUserRouter } from "../interfaces/http/routes/user.routes"
// Import analytics routes
import analyticsRoutes from "../interfaces/http/routes/analytics.routes"
// Import public orders routes (for secure token validation)
import publicOrdersRoutes from "../interfaces/http/routes/public-orders.routes"
// Import session routes (for sessionId management)
import { sessionRoutes } from "../interfaces/http/routes/session.routes"
// Import WhatsApp routes
import whatsappRoutes from "../interfaces/http/routes/whatsapp.routes"

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

// WhatsApp webhook routes (must be FIRST, before any authentication middleware)
import { LLMRouterService } from "../services/llm-router.service" // 🔧 Multi-agent router with Function Calling
import { LLMRequest } from "../types/whatsapp.types"

// ❌ REMOVED: Old /api/chat endpoint (deprecated - use /api/whatsapp/webhook with LLMRouterService)
// The old endpoint used monolithic LLMService with prompt.txt
// New system uses multi-agent architecture with database-driven prompts

// Public WhatsApp webhook routes (NO AUTHENTICATION)
// 🔒 SECURITY: Rate limited to 10 requests per minute per IP
router.post("/whatsapp/webhook", webhookLimiter, async (req, res) => {
  logger.info("🔥 WEBHOOK POST RECEIVED", new Date().toISOString())
  logger.info("📨 Request body:", JSON.stringify(req.body, null, 2))
  logger.info("📨 Request headers:", JSON.stringify(req.headers, null, 2))

  // 🔧 WRITE TO DEBUG FILE
  const fs = require("fs")
  const debugData = {
    timestamp: new Date().toISOString(),
    body: req.body,
    headers: req.headers,
    userAgent: req.headers["user-agent"],
  }
  fs.appendFileSync(
    "/tmp/webhook-debug.log",
    JSON.stringify(debugData, null, 2) + "\n---\n"
  )

  try {
    logger.info("🚨🚨🚨 WEBHOOK: INITIALIZING ROUTER SERVICE")
    // Initialize services
    const routerService = new LLMRouterService(prisma) // 🔧 NEW: Use multi-agent router
    const messageRepository = new MessageRepository()
    logger.info("🚨🚨🚨 WEBHOOK: ROUTER SERVICE INITIALIZED")
    // For GET requests (verification)
    if (req.method === "GET") {
      const mode = req.query["hub.mode"]
      const token = req.query["hub.verify_token"]
      const challenge = req.query["hub.challenge"]

      const verifyToken =
        process.env.WHATSAPP_VERIFY_TOKEN || "test-verify-token"
      if (mode === "subscribe" && token === verifyToken) {
        logger.info("WhatsApp webhook verified")
        res.status(200).send(challenge)
        return
      }

      res.status(403).send("Verification failed")
      return
    }

    // For POST requests (incoming messages)
    const data = req.body

    // 🔍 DETECT FORMAT: WhatsApp vs Test Format
    let phoneNumber, messageContent, workspaceId, customerId

    // Check if it's WhatsApp format
    logger.info(
      "🔍 CHECKING FORMAT - WhatsApp condition:",
      !!data.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from
    )
    if (data.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from) {
      logger.info("📱 USING WHATSAPP FORMAT")
      phoneNumber = data.entry[0].changes[0].value.messages[0].from
      messageContent = data.entry[0].changes[0].value.messages[0].text?.body
      workspaceId =
        process.env.WHATSAPP_WORKSPACE_ID || "cm9hjgq9v00014qk8fsdy4ujv"

      // Find customer by phone number with ALL needed data in ONE query
      try {
        logger.info(
          `🔍 WHATSAPP: Looking for customer with phone="${phoneNumber}" (normalized: "${phoneNumber.replace(/\s+/g, "")}")`
        )

        const customer = await prisma.customers.findFirst({
          where: {
            phone: phoneNumber.replace(/\s+/g, ""),
            workspaceId: workspaceId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            company: true,
            discount: true,
            language: true,
          },
        })

        if (customer) {
          // ✅ BLACKLIST CHECK ENABLED - Check customer blacklist status
          const isBlacklisted = await checkCustomerBlacklist(
            phoneNumber,
            workspaceId,
            res,
            "WHATSAPP"
          )
          if (isBlacklisted) {
            return // Response already sent
          }

          customerId = customer.id
          logger.info(
            `✅ WHATSAPP: Customer found: ${customer.name} (${customer.phone})`
          )
        } else {
          // 🆕 NEW USER DETECTED - Use handleNewUserWelcomeFlow for consistency
          logger.info(`🆕 New user detected for phone: ${phoneNumber}`)
          // Handle new user welcome flow using the centralized function
          const handled = await handleNewUserWelcomeFlow(
            phoneNumber,
            workspaceId,
            messageContent,
            res,
            "WHATSAPP"
          )
          if (handled) {
            return // Response already sent
          }
        }

        // Store customer data for later use (avoid double query)
        if (customer) {
          ;(req as any).customerData = customer
        }
      } catch (error) {
        logger.error("❌ Error finding customer:", error)
        res.status(500).send("ERROR")
        return
      }
    }
    // Check if it's frontend format (message, phoneNumber, workspaceId, isNewConversation)
    else if (data.message && data.phoneNumber && data.workspaceId) {
      messageContent = data.message
      phoneNumber = data.phoneNumber
      workspaceId = data.workspaceId

      logger.info(
        `🖥️ FRONTEND FORMAT: Processing message from ${phoneNumber}: "${messageContent}"`
      )

      // Get full customer data (including language) for frontend format
      try {
        logger.info(
          `🔍 FRONTEND FORMAT: Searching for customer with phone="${phoneNumber}" (normalized: "${phoneNumber.replace(/\s+/g, "")}"), workspaceId="${workspaceId}"`
        )
        const customer = await prisma.customers.findFirst({
          where: {
            phone: phoneNumber.replace(/\s+/g, ""),
            workspaceId: workspaceId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            company: true,
            discount: true,
            language: true,
            isBlacklisted: true,
          },
        })

        logger.info(
          `🔍 FRONTEND FORMAT: Customer found:`,
          customer ? `${customer.name} (${customer.phone})` : "NONE"
        )

        if (customer) {
          // ✅ BLACKLIST CHECK ENABLED - Check customer blacklist status
          if (customer.isBlacklisted) {
            logger.info(
              `🚫 FRONTEND FORMAT: Customer ${phoneNumber} is blacklisted - IGNORING MESSAGE`
            )
            res.status(200).json({
              success: true,
              data: {
                sessionId: null,
                message: "EVENT_RECEIVED_CUSTOMER_BLACKLISTED",
              },
            })
            return
          }

          customerId = customer.id
          logger.info(
            `✅ FRONTEND FORMAT: Customer found: ${customer.name} (${customer.phone})`
          )
        } else {
          // New user - handle welcome flow
          logger.info(`🆕 FRONTEND FORMAT: New user detected: ${phoneNumber}`)
          // Handle new user welcome flow (includes blocking logic)
          const handled = await handleNewUserWelcomeFlow(
            phoneNumber,
            workspaceId,
            messageContent,
            res,
            "TEST"
          )
          if (handled) {
            return // Response already sent
          }
        }
      } catch (error) {
        logger.error(
          "❌ Error getting customer data in frontend format:",
          error
        )
        res.status(500).send("ERROR")
        return
      }
    }
    // Check if it's test format
    else if (data.chatInput && data.workspaceId) {
      messageContent = data.chatInput
      workspaceId = data.workspaceId

      // For test format, use phone number if provided, otherwise use test phone
      phoneNumber = data.phone || "test-phone-123"

      // Get full customer data (including language) for test format
      try {
        const customer = await prisma.customers.findFirst({
          where: {
            phone: phoneNumber.replace(/\s+/g, ""),
            workspaceId: workspaceId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            company: true,
            discount: true,
            language: true,
          },
        })

        if (customer) {
          // ✅ BLACKLIST CHECK ENABLED - Check customer blacklist status
          const isBlacklisted = await checkCustomerBlacklist(
            phoneNumber,
            workspaceId,
            res,
            "TEST"
          )
          if (isBlacklisted) {
            return // Response already sent
          }

          phoneNumber = customer.phone || "test-phone-123"
          logger.info(
            `✅ TEST: Customer found: ${customer.name} (${customer.phone}) - Language: ${customer.language}`
          )

          // Store customer data for later use
          ;(req as any).customerData = customer
        } else {
          // 🆕 NEW USER DETECTED IN TEST FORMAT - Use handleNewUserWelcomeFlow for consistency
          logger.info(
            `🆕 TEST FORMAT: New user detected for phone: ${phoneNumber}`
          )

          // Handle new user welcome flow using the centralized function
          const handled = await handleNewUserWelcomeFlow(
            phoneNumber,
            workspaceId,
            messageContent,
            res,
            "TEST"
          )
          if (handled) {
            return // Response already sent
          }
        }
      } catch (error) {
        logger.error("❌ Error getting customer data in test format:", error)
        res.status(500).send("ERROR")
        return
      }
    }
    // Invalid format
    else {
      res.status(200).send("OK")
      return
    }

    // 🔧 DECLARE CHAT SESSION FOR GLOBAL SCOPE (used throughout the webhook)
    let chatSession: any = null

    // 🚨 SPAM DETECTION - Check for spam behavior (50 messages in 60 seconds)
    try {
      const spamDetectionService = new SpamDetectionService()
      const spamResult = await spamDetectionService.checkSpamBehavior(
        phoneNumber,
        workspaceId
      )

      if (spamResult.isSpam) {
        logger.info(
          `🚨 SPAM DETECTED: ${phoneNumber} sent ${spamResult.messageCount} messages in ${spamResult.timeWindow} seconds`
        )

        // Block the spam user
        await spamDetectionService.blockSpamUser(
          phoneNumber,
          workspaceId,
          spamResult.reason || "Spam behavior detected"
        )

        // 🚨 SPAM DETECTION ENABLED - Block spam users
        res.status(200).json({
          success: true,
          data: {
            sessionId: null,
            message: "EVENT_RECEIVED_CUSTOMER_BLACKLISTED",
          },
        })
        return
      }
    } catch (spamError) {
      logger.error("❌ Error in spam detection:", spamError)
      // Continue processing if spam detection fails
    }

    // Check if chat session is disabled (operator escalation)
    let isSessionDisabled = false
    try {
      const activeSession = await prisma.chatSession.findFirst({
        where: {
          customerId: customerId,
          workspaceId: workspaceId,
          status: "operator_escalated",
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      if (activeSession) {
        isSessionDisabled = true
      }
    } catch (sessionError) {
      logger.error("❌ Error checking session status:", sessionError)
      // Continue with normal processing if check fails
    }

    let result
    let llmRequest: LLMRequest | null = null

    if (isSessionDisabled) {
      // Session disabled - send operator message
      result = {
        success: true,
        output:
          "Un operatore ti contatterà al più presto. Nel frattempo, il chatbot è temporaneamente disabilitato per questa conversazione. Grazie per la tua pazienza! 🤝",
      }
    } else {
      // Session active - setup LLM system

      // Initialize variables with defaults
      let variables = {
        nameUser: "Cliente",
        discountUser: "Nessuno sconto attivo",
        companyName: "L'Altra Italia",
        lastorder: "Nessun ordine recente",
        lastordercode: "N/A",
        languageUser: "it",
      }

      // Get agent config with prompt from database
      let agentPrompt = "WhatsApp conversation" // fallback
      let welcomeBackMessage = null // 🎯 TASK: Declare welcome back message variable
      let agentModel = "anthropic/claude-3.5-sonnet" // fallback to Claude
      let agentMaxTokens = 5000 // fallback
      try {
        const agentConfig = await prisma.agentConfig.findFirst({
          where: { workspaceId: workspaceId },
        })
        if (agentConfig && agentConfig.systemPrompt) {
          agentPrompt = agentConfig.systemPrompt
        }
        if (agentConfig?.model) {
          agentModel = agentConfig.model
        }
        if (agentConfig?.maxTokens) {
          agentMaxTokens = agentConfig.maxTokens
        }
        logger.info(
          `🔧 WEBHOOK: Using agent model: ${agentModel}, maxTokens: ${agentMaxTokens}`
        )

        // Use customer data from first query (avoid double query)
        const customer = (req as any).customerData

        // Get last order
        const lastOrder = await prisma.orders.findFirst({
          where: {
            customerId: customerId,
            workspaceId: workspaceId,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            orderCode: true,
            createdAt: true,
          },
        })

        // Prepare variables for replacement
        variables = {
          nameUser: customer?.name || "Unknown Customer",
          discountUser: customer?.discount
            ? `${customer.discount}% di sconto attivo`
            : "Nessuno sconto attivo",
          companyName: customer?.company || "L'Altra Italia",
          lastorder: lastOrder
            ? lastOrder.createdAt.toLocaleDateString()
            : "Nessun ordine recente",
          lastordercode: lastOrder?.orderCode || "N/A",
          languageUser: customer?.language || "it",
        }

        // 🎯 TASK: Check if customer has recent activity for "Bentornato {NOME}" functionality
        try {
          const messageRepository = new MessageRepository()
          const hasRecentActivity = await messageRepository.hasRecentActivity(
            customerId,
            2,
            workspaceId
          )

          if (!hasRecentActivity) {
            // Customer hasn't been active in last 2 hours - show welcome back message
            welcomeBackMessage = await messageRepository.getWelcomeBackMessage(
              workspaceId,
              customer?.name || "Cliente",
              customer?.language || "it"
            )
            logger.info(
              `👋 WELCOME BACK: Customer ${customer?.name} returning after >2 hours - message: ${welcomeBackMessage}`
            )
          } else {
            logger.info(
              `👋 WELCOME BACK: Customer ${customer?.name} has recent activity - no welcome back needed`
            )
          }
        } catch (welcomeBackError) {
          logger.error(
            "❌ Error checking welcome back status:",
            welcomeBackError
          )
          // Continue without welcome back message if error occurs
        }

        // Replace variables in prompt
        agentPrompt = agentPrompt
          .replace(/\{\{nameUser\}\}/g, variables.nameUser)
          .replace(/\{\{discountUser\}\}/g, variables.discountUser)
          .replace(/\{\{companyName\}\}/g, variables.companyName)
          .replace(/\{\{lastorder\}\}/g, variables.lastorder)
          .replace(/\{\{lastordercode\}\}/g, variables.lastordercode)
          .replace(/\{\{languageUser\}\}/g, variables.languageUser)
      } catch (error) {
        logger.error("❌ Error processing customer data:", error)
      }

      //  RETRIEVE CHAT HISTORY FOR CONTEXT
      let chatHistory: any[] = []
      try {
        // Find or create chat session
        chatSession = await prisma.chatSession.findFirst({
          where: {
            customerId: customerId,
            workspaceId: workspaceId,
            status: "active", // 🔧 FIX: Only find active sessions
          },
          include: {
            messages: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Only messages from last 24 hours
                },
              },
              orderBy: {
                createdAt: "asc",
              },
              take: 10, // Last 10 messages for context
            },
          },
        })

        // 🔧 CREATE CHAT SESSION IF NOT EXISTS
        if (!chatSession) {
          chatSession = await prisma.chatSession.create({
            data: {
              customerId: customerId,
              workspaceId: workspaceId,
              status: "ACTIVE",
              startedAt: new Date(),
            },
            include: {
              messages: {
                orderBy: {
                  createdAt: "asc",
                },
                take: 10,
              },
            },
          })
        }

        if (chatSession && chatSession.messages.length > 0) {
          // Convert messages to OpenAI format
          chatHistory = chatSession.messages.map((msg) => ({
            role: msg.direction === "INBOUND" ? "user" : "assistant",
            content: msg.content,
          }))
        } else {
        }

        // 💾 NOTE: User message will be saved AFTER LLM processing by messageRepository.saveMessage()
        // This avoids duplicate message saving in the database
        logger.info(
          "� WEBHOOK: Skipping immediate user message save to avoid duplication"
        )
        logger.info(
          "� WEBHOOK: User message will be saved by messageRepository.saveMessage() after LLM processing"
        )
      } catch (historyError) {
        logger.error("❌ Error retrieving chat history:", historyError)
        // Continue without history if error occurs
      }

      llmRequest = {
        chatInput: messageContent,
        workspaceId: workspaceId,
        customerid: customerId,
        phone: phoneNumber.replace(/\s+/g, ""),
        language: variables.languageUser,
        sessionId: "webhook-session",
        temperature: 0.0, // Zero temperature for webhook responses - no variations
        maxTokens: agentMaxTokens, // Use agent config maxTokens instead of hardcoded
        model: agentModel, // Use agent config model instead of hardcoded
        messages: chatHistory, // 🔥 NOW INCLUDES REAL CHAT HISTORY
        prompt: agentPrompt,
        welcomeBackMessage: welcomeBackMessage || null, // 🎯 TASK: Pass welcome back message to LLM
      }

      logger.info(
        `🔧 WEBHOOK: LLM Request customerid: "${customerId}" workspaceId: "${workspaceId}"`
      )

      // 🔧 NEW: Process with LLMRouterService (multi-agent with Function Calling)
      logger.info(
        "🚀 WEBHOOK: About to call Router service with input:",
        messageContent
      )

      // Get customer details for router
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
        select: { name: true, language: true },
      })

      result = await routerService.routeMessage({
        workspaceId,
        customerId,
        conversationId: chatSession.id,
        messageId: `msg-${Date.now()}`,
        message: messageContent,
        customerLanguage: customer?.language || "it",
        customerName: customer?.name || "Customer",
      })

      // 🔧 NEW: Router service doesn't return "IGNORE", it throws or handles internally
      // The router always returns a response (even for blocked customers via Safety Agent)

      logger.info("� WEBHOOK: Router result received:", {
        hasResponse: !!result.response,
        agentUsed: result.agentUsed,
        tokensUsed: result.tokensUsed,
        executionTimeMs: result.executionTimeMs,
        wasFAQ: result.wasFAQ,
        responseLength: result.response?.length || 0,
        debugInfo: result.debugInfo ? "present" : "missing",
      })
    }

    // Save message and track usage/billing
    if (result.response) {
      try {
        // � Save message with response
        await messageRepository.saveMessage({
          workspaceId: workspaceId,
          phoneNumber: phoneNumber,
          message: messageContent,
          response: result.response,
          direction: "INBOUND",
          agentSelected: result.agentUsed || "ROUTER",
          // 🔧 NEW: Debug data from multi-agent router
          processingSource: result.wasFAQ ? "faq" : "router",
          debugInfo: JSON.stringify({
            ...(result.debugInfo || {}),
            agentUsed: result.agentUsed,
            tokensUsed: result.tokensUsed,
            executionTimeMs: result.executionTimeMs,
            wasFAQ: result.wasFAQ,
            faqId: result.faqId,
            costTimestamp: new Date().toISOString(),
          }),
        })

        // 💰 Billing tracking is handled by messageRepository.saveMessage()
        // (removed duplicate tracking to avoid double billing)
        logger.info(`💰 Billing will be tracked by message.repository.ts`)
        // 💾 SAVE MESSAGE RESPONSE - handled by messageRepository.saveMessage() above
        // Assistant response is already saved by messageRepository.saveMessage()
        logger.info(
          "💾 Message and assistant response saved by messageRepository.saveMessage()"
        )
      } catch (saveError) {
        logger.error("❌ Failed to save message:", saveError)
        // Continue - don't fail the whole request if save fails
      }
    }

    // TODO: Send response back to WhatsApp

    res.json({
      success: true,
      data: {
        sessionId: chatSession?.id || null,
        message: result.output,
      },
      debug: {
        translatedQuery: result.translatedQuery,
        processedPrompt: result.processedPrompt,
        functionCalls: result.functionCalls || [],
        // Unisco tutte le proprietà di debugInfo (model, effectiveParams, ecc)
        ...(result.debugInfo && typeof result.debugInfo === "object"
          ? result.debugInfo
          : {}),
        // 💰 Cost tracking info
        costInfo:
          result.success && result.output
            ? {
                currentCallCost: config.llm.defaultPrice,
                previousTotalUsage: result.debugInfo?.previousTotalUsage || 0,
                newTotalUsage:
                  result.debugInfo?.newTotalUsage || config.llm.defaultPrice,
                costTimestamp: new Date().toISOString(),
              }
            : null,
      },
    })
  } catch (error) {
    logger.error("❌ WHATSAPP WEBHOOK ERROR:", error)
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
})

router.get("/whatsapp/webhook", async (req, res) => {
  // Same logic as POST for verification
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "test-verify-token"
  if (mode === "subscribe" && token === verifyToken) {
    logger.info("WhatsApp webhook verified")
    res.status(200).send(challenge)
    return
  }

  res.status(403).send("Verification failed")
})

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
import { createTokenRouter } from "./token"
router.use("/token", createTokenRouter())
logger.info(
  "✅ Registered /api/token/* routes (registration, checkout, orders-public)"
)

// Public routes (MUST BE BEFORE AUTH ROUTES)
import { shortUrlRoutes } from "../interfaces/http/routes/short-url.routes"
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
import pricingRoutes from "../interfaces/http/routes/pricing.routes"
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
import agentChatRoutes from "./agentChatRoutes"
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
import { campaignRoutes } from "../interfaces/http/routes/campaign.routes"
router.use("/workspaces", campaignRoutes(campaignController))
logger.info(
  "✅ Registered campaign routes: /api/workspaces/:workspaceId/campaigns"
)

// Mount feedback routes (public + admin)
import { feedbackRoutes } from "../interfaces/http/routes/feedback.routes"
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
import productsRouter from "../interfaces/http/routes/products.routes"
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
import supplierRoutes from "../interfaces/http/routes/supplier.routes"
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
import { billingRouter } from "../interfaces/http/routes/billing.routes"
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
import ordersPublicRoutes from "../interfaces/http/routes/orders.routes"
router.use("/orders", ordersPublicRoutes)
logger.info("Registered public orders routes with JWT authentication")

// Mount analytics routes
router.use("/analytics", analyticsRoutes)
logger.info("Registered analytics routes for dashboard metrics")

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

logger.info("API routes setup complete")

export default router
