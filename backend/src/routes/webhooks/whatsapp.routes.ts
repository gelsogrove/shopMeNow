/**
 * WHATSAPP WEBHOOK ROUTES
 *
 * Handles incoming WhatsApp messages and webhook verification
 * Isolated from main routes for clarity and maintainability
 */

import { PrismaClient } from "@prisma/client"
import { Response, Router } from "express"
import { SafetyTranslationAgent } from "../../application/agents/SafetyTranslationAgent"
import { LinkReplacementService } from "../../application/services/link-replacement.service"
import { RegistrationAttemptsService } from "../../application/services/registration-attempts.service"
import { SecureTokenService } from "../../application/services/secure-token.service"
import { SpamDetectionService } from "../../application/services/spam-detection.service"
import { webhookLimiter } from "../../config/rate-limiters"
import { MessageRepository } from "../../repositories/message.repository"
import { LLMRouterService } from "../../services/llm-router.service"
import logger from "../../utils/logger"

const router = Router()
const prisma = new PrismaClient()

/**
 * 🔒 BLACKLIST CHECK HELPER
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
 * 🌐 LANGUAGE DETECTION HELPER
 */
function detectLanguageFromPhonePrefix(phoneNumber: string): string {
  if (phoneNumber.startsWith("+39")) return "it"
  if (phoneNumber.startsWith("+34")) return "es"
  if (phoneNumber.startsWith("+351")) return "pt"
  return "en"
}

/**
 * 📝 REGISTRATION TEXT HELPER
 */
function getRegistrationText(language: string): {
  link: string
  validity: string
} {
  const tokenExpiration = process.env.TOKEN_EXPIRATION || "1h"
  const match = tokenExpiration.match(/^(\d+)([hm])$/)
  let validityText = "1 hour"

  if (match) {
    const value = parseInt(match[1], 10)
    const unit = match[2]

    if (unit === "m") {
      validityText =
        language.toLowerCase() === "en"
          ? `${value} minutes`
          : language.toLowerCase() === "es"
            ? `${value} minutos`
            : language.toLowerCase() === "pt"
              ? `${value} minutos`
              : `${value} minuti`
    } else {
      validityText =
        language.toLowerCase() === "en"
          ? `${value} hour${value > 1 ? "s" : ""}`
          : language.toLowerCase() === "es"
            ? `${value} hora${value > 1 ? "s" : ""}`
            : language.toLowerCase() === "pt"
              ? `${value} hora${value > 1 ? "s" : ""}`
              : `${value} ora${value > 1 ? "" : ""}`
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

/**
 * 👋 NEW USER WELCOME FLOW
 */
async function handleNewUserWelcomeFlow(
  phoneNumber: string,
  workspaceId: string,
  messageContent: string,
  res: Response,
  format: "WHATSAPP" | "TEST" = "WHATSAPP"
): Promise<boolean> {
  try {
    const secureTokenService = new SecureTokenService()
    const messageRepository = new MessageRepository()
    const registrationAttemptsService = new RegistrationAttemptsService(prisma)

    const isBlocked = await registrationAttemptsService.isBlocked(
      phoneNumber,
      workspaceId
    )
    if (isBlocked) {
      logger.info(
        `🚫 ${format}: User ${phoneNumber} is blocked due to too many registration attempts`
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

    const attempt = await registrationAttemptsService.recordAttempt(
      phoneNumber,
      workspaceId
    )

    if (attempt.isBlocked) {
      logger.info(
        `🚫 ${format}: User ${phoneNumber} blocked after ${attempt.attemptCount} attempts`
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

    // 🔒 USE LLMService.handleNewUserWelcome() - ENSURES Safety & Translation layer
    const { LLMService } = require("../../services/llm.service")
    const llmService = new LLMService()

    const result = await llmService.handleNewUserWelcome(
      phoneNumber,
      workspaceId,
      messageContent
    )

    const completeMessage = result.message
    const { detectedLanguage } = result.debugInfo

    // Save message to database
    await messageRepository.saveMessage({
      workspaceId,
      phoneNumber,
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
      `✅ ${format}: New user welcome message sent to ${phoneNumber} (via LLMService)`
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
    logger.error(`❌ ${format}: Error in new user welcome flow:`, error)
    res.status(500).send("ERROR")
    return true
  }
}

// POST /whatsapp/webhook - Main webhook handler
router.post("/whatsapp/webhook", webhookLimiter, async (req, res) => {
  logger.info("🔥 WEBHOOK POST RECEIVED", new Date().toISOString())

  try {
    const routerService = new LLMRouterService(prisma)
    const messageRepository = new MessageRepository()

    // WhatsApp verification (GET request)
    if (req.method === "GET") {
      const mode = req.query["hub.mode"]
      const token = req.query["hub.verify_token"]
      const challenge = req.query["hub.challenge"]

      // ✅ SECURITY FIX: No hardcoded fallback in production
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
      if (!verifyToken) {
        logger.error("❌ WHATSAPP_VERIFY_TOKEN not configured in environment")
        if (process.env.NODE_ENV === "production") {
          res.status(500).send("Server configuration error")
          return
        }
        // Allow test token only in development
        logger.warn("⚠️ Using test token in development mode")
      }

      if (
        mode === "subscribe" &&
        token === (verifyToken || "test-verify-token")
      ) {
        logger.info("WhatsApp webhook verified")
        res.status(200).send(challenge)
        return
      }

      res.status(403).send("Verification failed")
      return
    }

    const data = req.body
    let phoneNumber, messageContent, workspaceId, customerId

    // Detect format: WhatsApp vs Frontend vs Test
    if (data.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from) {
      // WhatsApp format
      phoneNumber = data.entry[0].changes[0].value.messages[0].from
      messageContent = data.entry[0].changes[0].value.messages[0].text?.body

      // ✅ SECURITY FIX: No hardcoded workspace ID
      workspaceId = process.env.WHATSAPP_WORKSPACE_ID
      if (!workspaceId) {
        logger.error("❌ WHATSAPP_WORKSPACE_ID not configured in environment")
        if (process.env.NODE_ENV === "production") {
          res.status(500).json({ error: "Server configuration error" })
          return
        }
        // Allow test workspace only in development
        logger.warn("⚠️ Using test workspace in development mode")
        workspaceId = "cm9hjgq9v00014qk8fsdy4ujv"
      }

      const customer = await prisma.customers.findFirst({
        where: {
          phone: phoneNumber.replace(/\s+/g, ""),
          workspaceId,
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
        const isBlacklisted = await checkCustomerBlacklist(
          phoneNumber,
          workspaceId,
          res,
          "WHATSAPP"
        )
        if (isBlacklisted) return

        customerId = customer.id
        ;(req as any).customerData = customer
      } else {
        const handled = await handleNewUserWelcomeFlow(
          phoneNumber,
          workspaceId,
          messageContent,
          res,
          "WHATSAPP"
        )
        if (handled) return
      }
    } else if (data.message && data.phoneNumber && data.workspaceId) {
      // Frontend format
      messageContent = data.message
      phoneNumber = data.phoneNumber
      workspaceId = data.workspaceId

      const customer = await prisma.customers.findFirst({
        where: {
          phone: phoneNumber.replace(/\s+/g, ""),
          workspaceId,
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

      if (customer) {
        if (customer.isBlacklisted) {
          logger.info(`🚫 Customer ${phoneNumber} is blacklisted`)
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
      } else {
        const handled = await handleNewUserWelcomeFlow(
          phoneNumber,
          workspaceId,
          messageContent,
          res,
          "TEST"
        )
        if (handled) return
      }
    } else if (data.chatInput && data.workspaceId) {
      // Test format
      messageContent = data.chatInput
      workspaceId = data.workspaceId
      phoneNumber = data.phone || "test-phone-123"

      const customer = await prisma.customers.findFirst({
        where: {
          phone: phoneNumber.replace(/\s+/g, ""),
          workspaceId,
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
        const isBlacklisted = await checkCustomerBlacklist(
          phoneNumber,
          workspaceId,
          res,
          "TEST"
        )
        if (isBlacklisted) return

        phoneNumber = customer.phone || "test-phone-123"
        ;(req as any).customerData = customer
      } else {
        const handled = await handleNewUserWelcomeFlow(
          phoneNumber,
          workspaceId,
          messageContent,
          res,
          "TEST"
        )
        if (handled) return
      }
    } else {
      res.status(200).send("OK")
      return
    }

    // Spam detection
    const spamDetectionService = new SpamDetectionService()
    const spamResult = await spamDetectionService.checkSpamBehavior(
      phoneNumber,
      workspaceId
    )

    if (spamResult.isSpam) {
      await spamDetectionService.blockSpamUser(
        phoneNumber,
        workspaceId,
        spamResult.reason || "Spam behavior detected"
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

    // Session check
    const activeSession = await prisma.chatSession.findFirst({
      where: {
        customerId,
        workspaceId,
        status: "operator_escalated",
      },
      orderBy: { createdAt: "desc" },
    })

    if (activeSession) {
      res.json({
        success: true,
        output:
          "Un operatore ti contatterà al più presto. Il chatbot è temporaneamente disabilitato. 🤝",
      })
      return
    }

    // 🔒 CRITICAL: Check if workspace is in WIP (maintenance mode)
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        isActive: true,
        wipMessage: true,
      },
    })

    if (!workspace) {
      logger.error(`❌ Workspace ${workspaceId} not found`)
      res.status(404).json({ error: "Workspace not found" })
      return
    }

    // Get customer details for language and name
    const customerForWip = await prisma.customers.findUnique({
      where: { id: customerId },
      select: { name: true, language: true },
    })

    // If workspace is in WIP mode, send WIP message through Safety Layer
    if (!workspace.isActive) {
      logger.info(
        `🚧 Workspace ${workspaceId} is in WIP mode - sending maintenance message`
      )

      try {
        // Get WIP message from workspace settings (in customer's language)
        const customerLanguage = customerForWip?.language || "it"
        const wipMessages = workspace.wipMessage as any
        let wipMessageText =
          wipMessages?.[customerLanguage] ||
          wipMessages?.["it"] ||
          "Siamo in manutenzione. Ti contatteremo presto."

        // Pass through Safety & Translation Layer (MANDATORY)
        const safetyAgent = new SafetyTranslationAgent(prisma)
        const safetyResult = await safetyAgent.process(
          wipMessageText,
          customerLanguage,
          workspaceId,
          {
            customerName: customerForWip?.name || "Customer",
          }
        )

        // Use translated/safe message
        let finalMessage = safetyResult.translatedText

        // Apply Link Replacement (if any tokens present)
        const linkService = new LinkReplacementService(prisma)
        finalMessage = await linkService.replaceLinks(
          finalMessage,
          workspaceId,
          customerId
        )

        // Save message to history
        const messageRepository = new MessageRepository()
        await messageRepository.saveMessage({
          workspaceId,
          phoneNumber,
          message: messageContent,
          response: finalMessage,
          direction: "INBOUND",
          agentSelected: "WIP_MESSAGE",
          processingSource: "workspace_wip",
          debugInfo: JSON.stringify({
            workspaceInWIP: true,
            safetyProcessed: true,
            timestamp: new Date().toISOString(),
          }),
        })

        // Return WIP message (will be sent to WhatsApp)
        res.json({
          success: true,
          data: {
            sessionId: null,
            message: finalMessage,
          },
        })
        return
      } catch (error) {
        logger.error("❌ Failed to process WIP message:", error)
        res.status(500).json({ error: "Failed to process WIP message" })
        return
      }
    }

    // Get chat history
    let chatSession = await prisma.chatSession.findFirst({
      where: {
        customerId,
        workspaceId,
        status: "active",
      },
      include: {
        messages: {
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: "asc" },
          take: 10,
        },
      },
    })

    if (!chatSession) {
      chatSession = await prisma.chatSession.create({
        data: {
          customerId,
          workspaceId,
          status: "ACTIVE",
          startedAt: new Date(),
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 10,
          },
        },
      })
    }

    // Process with router
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: {
        name: true,
        language: true,
        activeChatbot: true,
        isBlacklisted: true,
      },
    })

    // 🔒 CRITICAL: If chatbot is disabled, ONLY save message - DO NOT process with LLM
    if (customer && !customer.activeChatbot) {
      logger.info(
        `🚫 Chatbot disabled for customer ${customerId} - saving message without LLM processing`
      )

      // Save customer message to history
      await messageRepository.saveMessage({
        workspaceId,
        phoneNumber,
        message: messageContent,
        response: null, // No response from bot
        direction: "INBOUND",
        agentSelected: "NONE",
        processingSource: "chatbot_disabled",
        debugInfo: JSON.stringify({
          chatbotDisabled: true,
          reason: "activeChatbot = false",
          timestamp: new Date().toISOString(),
        }),
      })

      // Return success WITHOUT sending any WhatsApp message
      res.json({
        success: true,
        data: {
          sessionId: chatSession?.id || null,
          message: null, // No bot response
          chatbotDisabled: true,
        },
      })
      return
    }

    const result = await routerService.routeMessage({
      workspaceId,
      customerId,
      conversationId: chatSession.id,
      messageId: `msg-${Date.now()}`,
      message: messageContent,
      customerLanguage: customer?.language || "it",
      customerName: customer?.name || "Customer",
    })

    // Save message
    if (result.response) {
      await messageRepository.saveMessage({
        workspaceId,
        phoneNumber,
        message: messageContent,
        response: result.response,
        direction: "INBOUND",
        agentSelected: result.agentUsed || "ROUTER",
        processingSource: result.wasFAQ ? "faq" : "router",
        debugInfo: JSON.stringify({
          ...(result.debugInfo || {}),
          agentUsed: result.agentUsed,
          tokensUsed: result.tokensUsed,
          executionTimeMs: result.executionTimeMs,
          wasFAQ: result.wasFAQ,
          faqId: result.faqId,
        }),
      })
    }

    res.json({
      success: true,
      data: {
        sessionId: chatSession?.id || null,
        message: result.response,
      },
    })
  } catch (error) {
    logger.error("❌ WHATSAPP WEBHOOK ERROR:", error)
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
})

// GET /whatsapp/webhook - Verification
router.get("/whatsapp/webhook", async (req, res) => {
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

export default router
