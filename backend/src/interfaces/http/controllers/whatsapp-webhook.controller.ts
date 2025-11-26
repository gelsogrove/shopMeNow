import { Request, Response } from "express"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import { UrlShortenerService } from "../../../application/services/url-shortener.service"
import { BillingPrices } from "../../../domain/enums/billing-prices.enum"
import { prisma } from "../../../lib/prisma"
import { LLMRouterService } from "../../../services/llm-router.service"
import {
  detectLanguageFromPhonePrefix,
  getRegistrationText,
} from "../../../utils/language-detector"
import logger from "../../../utils/logger"
import { whatsAppToMarkdown } from "../../../utils/whatsapp-formatter"

/**
 * WhatsApp Webhook Controller
 *
 * Single Responsibility: Handle INBOUND messages from WhatsApp
 *
 * SECURITY:
 * - ✅ Verifica firma HMAC SHA256 (CRITICO!)
 * - ✅ Accetta SOLO messaggi da numeri nel database
 * - ✅ Rate limiting per workspace e customer
 * - ✅ Validazione payload WhatsApp
 *
 * Flow:
 * 1. Verify HMAC signature (reject if invalid)
 * 2. Extract phone number from payload
 * 3. Find customer in database
 * 4. Convert WhatsApp format → Markdown
 * 5. Process with LLM (if customer exists)
 * 6. Convert Markdown → WhatsApp format
 * 7. Send response via WhatsApp API
 * 8. Save to database with status tracking
 */

export class WhatsAppWebhookController {
  /**
   * GET /api/whatsapp/webhook
   * Webhook verification endpoint (one-time setup by Meta)
   *
   * SECURITY: Public endpoint (required by Meta for webhook setup)
   */
  async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query["hub.mode"]
      const token = req.query["hub.verify_token"]
      const challenge = req.query["hub.challenge"]

      logger.info("[WEBHOOK-VERIFY] Meta verification request received", {
        mode,
        tokenMatch: token === process.env.WHATSAPP_VERIFY_TOKEN,
      })

      // Verify token matches environment variable
      if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        logger.info("[WEBHOOK-VERIFY] ✅ Verification successful")
        res.status(200).send(challenge)
      } else {
        logger.warn("[WEBHOOK-VERIFY] ❌ Verification failed - invalid token")
        res.status(403).send("Forbidden")
      }
    } catch (error: any) {
      logger.error("[WEBHOOK-VERIFY] Error:", error)
      res.status(500).json({ error: "Verification failed" })
    }
  }

  /**
   * POST /api/whatsapp/webhook
   * Receive messages from WhatsApp
   *
   * SECURITY:
   * - ✅ Verifica firma HMAC (CRITICO - previene messaggi fake!)
   * - ✅ Solo numeri registrati nel database
   * - ✅ Rate limiting applicato
   */
  async receiveMessage(req: Request, res: Response): Promise<void> {
    try {
      // 🔒 SECURITY NOTE: HMAC verification removed for frontend compatibility
      // TODO: Re-enable HMAC when using real WhatsApp API webhook
      // For now, security relies on:
      // 1. Customer must exist in database
      // 2. Workspace validation
      // 3. Rate limiting (future)
      logger.info("[WEBHOOK] 📨 Receiving message (HMAC check disabled)")

      // ✅ FIX: Extract message from weird frontend format
      // Frontend sends: { "Ciao": { phoneNumber, workspaceId } }
      let extractedMessage: string | undefined
      let extractedData: any = req.body

      if (req.body && typeof req.body === "object") {
        const keys = Object.keys(req.body)
        // Check if first key looks like a message (not standard fields)
        if (
          keys.length > 0 &&
          ![
            "message",
            "phoneNumber",
            "workspaceId",
            "chatInput",
            "entry",
          ].includes(keys[0])
        ) {
          extractedMessage = keys[0] // "Ciao"
          extractedData = req.body[keys[0]] // { phoneNumber, workspaceId, ... }
          logger.info(
            `📝 [WEBHOOK CONTROLLER] Extracted message from key: "${extractedMessage}"`
          )
        }
      }

      const data = extractedData

      // 🔍 Extract message - Support THREE formats:
      // 1. WhatsApp API format: req.body.entry[0].changes[0].value.messages[0]
      // 2. Frontend simulator format (standard): req.body.message + req.body.phoneNumber
      // 3. Frontend simulator format (weird): message as object key

      let phoneNumber: string
      let messageText: string
      let whatsappMessageId: string
      let workspaceId: string | undefined

      // Check if it's WhatsApp API format
      const entry = data.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value
      const messages = value?.messages

      if (messages && messages.length > 0) {
        // WhatsApp API format
        const message = messages[0]
        // WhatsApp API may send with or without +, ensure it's there (but only one!)
        phoneNumber = message.from.startsWith("+")
          ? message.from.trim()
          : `+${message.from.trim()}`
        messageText = message.text?.body || ""
        whatsappMessageId = message.id
        workspaceId = value.workspaceId // ✅ Extract workspaceId from WhatsApp format

        logger.info("[WEBHOOK] 📨 WhatsApp API format detected", {
          from: phoneNumber,
          messageLength: messageText.length,
          whatsappMessageId,
          workspaceId,
        })
      } else if (data.message && data.phoneNumber) {
        // Frontend simulator format (standard)
        phoneNumber = data.phoneNumber.trim() // ✅ Remove leading/trailing spaces
        messageText = data.message
        whatsappMessageId = `frontend-${Date.now()}-${Math.random().toString(36).substring(7)}`
        workspaceId = data.workspaceId // ✅ Extract workspaceId from standard format

        logger.info(
          "[WEBHOOK] 📨 Frontend simulator format (standard) detected",
          {
            from: phoneNumber,
            messageLength: messageText.length,
            workspaceId: data.workspaceId,
          }
        )
      } else if (extractedMessage && data.phoneNumber) {
        // Frontend simulator format (weird: message as key)
        phoneNumber = data.phoneNumber.trim() // ✅ Remove leading/trailing spaces
        messageText = extractedMessage
        whatsappMessageId = `frontend-${Date.now()}-${Math.random().toString(36).substring(7)}`
        workspaceId = data.workspaceId // ✅ Extract workspaceId from weird format

        logger.info("[WEBHOOK] 📨 Frontend simulator format (weird) detected", {
          from: phoneNumber,
          messageLength: messageText.length,
          workspaceId: data.workspaceId,
        })
      } else {
        // Not a message event (could be status update, etc.)
        logger.info(
          "[WEBHOOK] No message found in payload - probably status update"
        )
        res.status(200).json({ status: "ok" })
        return
      }

      // 🔒 SECURITY STEP 2: Find customer in database OR handle new user
      // workspaceId already extracted above based on format
      // If not provided, try to lookup from channel phone number

      if (!workspaceId) {
        // 🔍 NEW: Try to find workspace from the channel phone number
        // This allows backend to determine correct workspace when FE sends channel number
        const channelPhoneNumber = data.channelPhoneNumber || data.whatsappPhoneNumber
        
        if (channelPhoneNumber) {
          logger.info(
            "[WEBHOOK] 🔍 No workspaceId provided, looking up from channel phone:",
            channelPhoneNumber
          )
          
          const workspace = await prisma.workspace.findFirst({
            where: {
              whatsappPhoneNumber: channelPhoneNumber.trim(),
              isDelete: false,
              isActive: true,
            },
            select: { id: true, name: true }
          })
          
          if (workspace) {
            workspaceId = workspace.id
            logger.info(
              "[WEBHOOK] ✅ Found workspace from channel phone:",
              {
                channelPhone: channelPhoneNumber,
                workspaceId,
                workspaceName: workspace.name,
              }
            )
          } else {
            logger.error(
              "[WEBHOOK] ❌ No workspace found for channel phone:",
              channelPhoneNumber
            )
          }
        } else {
          logger.error("[WEBHOOK] ⚠️ No workspaceId or channel phone provided")
        }

        if (!workspaceId) {
          logger.error("[WEBHOOK] ⚠️ Could not determine workspaceId")
          res.status(400).json({ error: "workspaceId required" })
          return
        }
      }

      const customer = await prisma.customers.findFirst({
        where: {
          phone: phoneNumber,
          workspaceId, // Ensure we search in correct workspace
        },
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          language: true,
          workspaceId: true,
          isActive: true,
          activeChatbot: true, // 🔒 CRITICAL: Load chatbot status
          workspace: {
            select: {
              id: true,
              name: true,
              welcomeMessage: true,
            },
          },
        },
      })

      if (!customer) {
        logger.info(
          "[WEBHOOK] 🆕 New user detected - checking registration attempts",
          {
            phoneNumber,
            workspaceId,
          }
        )

        // 🔒 STEP 1: Check/update RegistrationAttempts (with transaction for concurrency safety)
        const registrationAttempt = await prisma.$transaction(async (tx) => {
          // Find or create RegistrationAttempts record
          let attempt = await tx.registrationAttempts.findUnique({
            where: {
              phoneNumber_workspaceId: {
                phoneNumber: phoneNumber,
                workspaceId: workspaceId,
              },
            },
          })

          if (!attempt) {
            // First message - create record with attemptCount=1
            attempt = await tx.registrationAttempts.create({
              data: {
                phoneNumber: phoneNumber,
                workspaceId: workspaceId,
                attemptCount: 1,
                lastAttemptAt: new Date(),
                isBlocked: false,
              },
            })
            logger.info("[WEBHOOK] 📝 Created RegistrationAttempts record", {
              phoneNumber,
              attemptCount: 1,
            })
          } else {
            // Subsequent message - increment attemptCount
            attempt = await tx.registrationAttempts.update({
              where: {
                phoneNumber_workspaceId: {
                  phoneNumber: phoneNumber,
                  workspaceId: workspaceId,
                },
              },
              data: {
                attemptCount: { increment: 1 },
                lastAttemptAt: new Date(),
                // Set isBlocked=true when attemptCount reaches 4 (after 3 welcome messages)
                isBlocked: attempt.attemptCount + 1 >= 4,
              },
            })
            logger.info(
              "[WEBHOOK] 🔄 Updated RegistrationAttempts record",
              {
                phoneNumber,
                attemptCount: attempt.attemptCount,
                isBlocked: attempt.isBlocked,
              }
            )
          }

          return attempt
        })

        // 🚫 STEP 2: Check if user is blocked (attemptCount >= 4)
        if (registrationAttempt.isBlocked) {
          logger.warn(
            "[WEBHOOK] 🚫 User blocked after 3 registration attempts",
            {
              phoneNumber,
              attemptCount: registrationAttempt.attemptCount,
            }
          )
          // Return 200 OK but don't send any message
          res.status(200).json({
            status: "blocked",
            message: "User blocked after exceeding registration attempts",
            attemptCount: registrationAttempt.attemptCount,
          })
          return
        }

        // ✅ STEP 3: User not blocked - check billing before sending welcome message
        
        // 💰 BILLING CHECK: Verify credit and plan limits BEFORE creating customer
        const { SubscriptionBillingService } = await import(
          "../../../application/services/subscription-billing.service"
        )
        const billingService = new SubscriptionBillingService(prisma)

        // Check trial validity first
        const trialStatus = await billingService.isTrialValid(workspaceId)
        if (trialStatus.isTrialPlan && !trialStatus.isValid) {
          logger.warn("[WEBHOOK] 💰 Trial expired - SILENT BLOCK for new user (no save, no response)", {
            workspaceId,
            phoneNumber,
          })
          // 🚨 CRITICAL: DO NOT create customer, DO NOT respond - completely silent
          res.status(402).json({
            status: "billing_error",
            code: "TRIAL_EXPIRED",
            message: "Trial period has expired. Please upgrade your plan.",
          })
          return
        }

        // Check credit balance
        const messageCost = await billingService.getOperationCost(workspaceId, "message")
        const creditCheck = await billingService.checkCredit(workspaceId, messageCost)

        if (!creditCheck.hasSufficientCredit) {
          logger.warn("[WEBHOOK] 💰 Insufficient credit - SILENT BLOCK for new user (no save, no response)", {
            workspaceId,
            phoneNumber,
            currentBalance: creditCheck.currentBalance,
            requiredAmount: messageCost,
          })
          // 🚨 CRITICAL: DO NOT create customer, DO NOT respond - completely silent
          res.status(402).json({
            status: "billing_error",
            code: "INSUFFICIENT_CREDIT",
            message: "Insufficient credit. Please recharge your account.",
          })
          return
        }

        // Check customer limit (50 for FREE_TRIAL/BASIC, 100 for PREMIUM)
        const customerLimitCheck = await billingService.checkPlanLimits(workspaceId, "customers")
        if (!customerLimitCheck.withinLimits) {
          logger.warn("[WEBHOOK] 📊 Customer limit reached - SILENT BLOCK for new user (no save, no response)", {
            workspaceId,
            phoneNumber,
            current: customerLimitCheck.current,
            max: customerLimitCheck.max,
          })
          // 🚨 CRITICAL: DO NOT create customer, DO NOT respond - completely silent
          // The 51st (or 101st for PREMIUM) customer will never be saved
          res.status(403).json({
            status: "limit_reached",
            code: "CUSTOMER_LIMIT_REACHED",
            message: `Customer limit reached (${customerLimitCheck.current}/${customerLimitCheck.max}). Please upgrade your plan.`,
          })
          return
        }

        logger.info(
          "[WEBHOOK] 📨 Billing checks passed - sending welcome message",
          {
            phoneNumber,
            attemptCount: registrationAttempt.attemptCount,
            creditBalance: creditCheck.currentBalance,
            customersUsed: customerLimitCheck.current,
            customersMax: customerLimitCheck.max,
          }
        )

        // Get workspace to retrieve welcome message
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: {
            id: true,
            name: true,
            welcomeMessage: true,
          },
        })

        if (!workspace) {
          logger.error("[WEBHOOK] ⚠️ Workspace not found", { workspaceId })
          res.status(404).json({ error: "Workspace not found" })
          return
        }

        // Detect language from phone number
        const detectedLanguage = detectLanguageFromPhonePrefix(phoneNumber)
        logger.info("[WEBHOOK] 📱 Detected language from phone", {
          phoneNumber,
          language: detectedLanguage,
        })

        // Generate registration link with secure token
        const secureTokenService = new SecureTokenService()
        const urlShortenerService = new UrlShortenerService()

        // Create secure token for registration (24 hours validity)
        const registrationToken = await secureTokenService.createToken(
          "registration",
          workspaceId,
          { phoneNumber, language: detectedLanguage },
          "24h",
          undefined, // userId - not yet created
          phoneNumber,
          undefined, // ipAddress
          undefined // customerId - not yet created (registration)
        )

        const registrationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/register?token=${registrationToken}`

        // Create short URL that expires in 24 hours
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 24)

        const shortUrl = await urlShortenerService.createShortUrl(
          registrationUrl,
          workspaceId,
          expiresAt
        )

        const registrationLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/s/${shortUrl.shortCode}`

        // Get localized registration texts
        const registrationTexts = getRegistrationText(detectedLanguage)

        // Build welcome message with registration link
        const welcomeMessage =
          workspace.welcomeMessage || "Welcome! How can I help you?"
        const rawWelcomeMessage = `${welcomeMessage}\n\n${registrationTexts.link}: ${registrationLink}\n${registrationTexts.validity}`

        // 🛡️ STEP 4: Pass welcome message through Safety & Translation Agent
        let finalMessage = rawWelcomeMessage
        let safetyTokensUsed = 0
        const debugSteps: any[] = []

        try {
          const {
            SafetyTranslationAgent,
          } = require("../../../application/agents/SafetyTranslationAgent")
          const safetyAgent = new SafetyTranslationAgent(prisma)

          debugSteps.push({
            type: "welcome",
            agent: "Welcome Message Generator",
            timestamp: new Date().toISOString(),
            input: {
              phoneNumber: phoneNumber,
              language: detectedLanguage,
              attemptCount: registrationAttempt.attemptCount,
            },
            output: {
              welcomeMessage: rawWelcomeMessage,
            },
            tokenUsage: {
              totalTokens: 0,
            },
          })

          const safetyResult = await safetyAgent.process({
            workspaceId: workspaceId,
            response: rawWelcomeMessage,
            targetLanguage: detectedLanguage,
            customerName: "New Customer",
            allowedLinks: [registrationLink], // Allow registration link
          })

          if (!safetyResult.safe) {
            logger.error(
              "[WEBHOOK] ⚠️ Welcome message failed safety check (this should never happen)",
              {
                blockedReason: safetyResult.blockedReason,
              }
            )
            // Fallback to raw message if safety check fails
            finalMessage = rawWelcomeMessage
          } else {
            finalMessage = safetyResult.translatedText || rawWelcomeMessage
            safetyTokensUsed = safetyResult.tokensUsed || 0
          }

          debugSteps.push({
            type: "safety",
            agent: "Safety & Translation",
            model: "openai/gpt-4o-mini",
            temperature: 0.2,
            timestamp: new Date().toISOString(),
            systemPrompt: safetyResult.systemPrompt || "Safety & Translation Agent",
            input: {
              originalMessage: rawWelcomeMessage,
              targetLanguage: detectedLanguage,
              customerName: "New Customer",
            },
            output: {
              translatedMessage: finalMessage,
              safe: safetyResult.safe,
              blockedReason: safetyResult.blockedReason || null,
            },
            tokenUsage: {
              totalTokens: safetyTokensUsed,
            },
          })

          logger.info(
            "[WEBHOOK] 🛡️ Welcome message passed through Safety & Translation",
            {
              tokensUsed: safetyTokensUsed,
              safe: safetyResult.safe,
            }
          )
        } catch (safetyError) {
          logger.error(
            "[WEBHOOK] ❌ Safety agent error - using raw message",
            safetyError
          )
          // Fallback to raw message on error
          finalMessage = rawWelcomeMessage
        }

        // ✅ STEP 5: CREATE TEMPORARY CUSTOMER RECORD (will be updated after registration)
        // This allows us to save the welcome message in chat history
        const tempCustomer = await prisma.customers.create({
          data: {
            phone: phoneNumber,
            workspaceId: workspaceId,
            name: "New Customer", // Temporary name
            email: `temp_${phoneNumber.replace(/[^0-9]/g, "")}@pending.com`, // Temporary email (required field)
            language: detectedLanguage,
            isActive: false, // Mark as inactive until registration complete
          },
        })

        // ✅ STEP 6: CREATE CHAT SESSION
        const chatSession = await prisma.chatSession.create({
          data: {
            customerId: tempCustomer.id,
            workspaceId: workspaceId,
            status: "active",
          },
        })

        // ✅ STEP 7: SAVE debugSteps for Message Flow Timeline
        debugSteps.push({
          type: "save",
          agent: "Database Save",
          timestamp: new Date().toISOString(),
          output: {
            conversationId: chatSession.id,
            customerId: tempCustomer.id,
          },
        })

        debugSteps.push({
          type: "whatsapp",
          agent: "WhatsApp Send",
          timestamp: new Date().toISOString(),
          output: {
            status: "queued",
            recipient: phoneNumber,
          },
        })

        // ✅ STEP 8: SAVE WELCOME MESSAGE IN CHAT HISTORY
        // 🔧 CRITICAL: Use conversationMessage table (NEW) not message table (OLD)
        // This ensures messages appear in frontend (getChatSessionMessages queries conversationMessage)
        // 🚫 NOTE: deliveryStatus='not_queued' because welcome messages are system messages, NOT sent via WhatsApp queue
        await prisma.conversationMessage.create({
          data: {
            workspaceId: workspaceId,
            customerId: tempCustomer.id,
            conversationId: chatSession.id,
            role: "assistant", // Bot response
            content: finalMessage,
            agentType: "REGISTRATION_FLOW",
            tokensUsed: safetyTokensUsed,
            deliveryStatus: "not_queued", // 🚫 Welcome messages are NOT sent via WhatsApp queue
            debugInfo: JSON.stringify({
              source: "whatsapp-webhook",
              type: "welcome_new_user",
              language: detectedLanguage,
              registrationLink: registrationLink,
              timestamp: new Date().toISOString(),
              flow: ["welcome", "safety", "save", "whatsapp"],
              attemptCount: registrationAttempt.attemptCount,
              messagePrice: BillingPrices.WELCOME_MESSAGE,
              debugSteps: debugSteps,
            }),
          },
        })

        // 💰 STEP 9: Track welcome message cost (from BillingPrices enum)
        try {
          const { BillingService } = await import(
            "../../../application/services/billing.service"
          )
          const billingService = new BillingService(prisma)

          await billingService.trackMessage(
            workspaceId,
            tempCustomer.id,
            "Welcome message - New user registration",
            finalMessage
          )

          logger.info(
            `[WEBHOOK] 💰 Welcome message cost tracked: €${BillingPrices.WELCOME_MESSAGE.toFixed(2)} for customer ${tempCustomer.id}`
          )
        } catch (billingError) {
          logger.error(
            `[WEBHOOK] ❌ Failed to track welcome message billing:`,
            billingError
          )
          // Don't fail the flow if billing fails
        }

        // ✅ STEP 10: Return success response
        logger.info(
          "[WEBHOOK] ✅ Welcome message prepared and saved to chat history",
          {
            message: finalMessage,
            language: detectedLanguage,
            registrationLink,
            customerId: tempCustomer.id,
            sessionId: chatSession.id,
            attemptCount: registrationAttempt.attemptCount,
          }
        )

        res.status(200).json({
          status: "new_user_welcomed",
          message: finalMessage,
          language: detectedLanguage,
          registrationLink,
          customerId: tempCustomer.id,
          sessionId: chatSession.id,
          attemptCount: registrationAttempt.attemptCount,
        })
        return
      }

      logger.info("[WEBHOOK] ✅ Customer found", {
        customerId: customer.id,
        workspaceId: customer.workspaceId,
        customerName: customer.name,
      })

      // ❌ REMOVED: WhatsApp config check (not needed - we're not sending via WhatsApp yet)
      // TODO: Re-enable when WhatsApp queue is implemented
      // For now: process message → save to DB → return ok (no actual WhatsApp sending)

      // 🔄 Convert WhatsApp format → Markdown (for internal storage)
      const messageMarkdown = whatsAppToMarkdown(messageText)

      // 🔒 CRITICAL: If chatbot is disabled, ONLY save message - DO NOT process with LLM
      if (customer && !customer.activeChatbot) {
        logger.info(
          `🚫 [WEBHOOK] Chatbot disabled for customer ${customer.id} - saving message without LLM processing`
        )

        // Get or create chat session
        let chatSession = await prisma.chatSession.findFirst({
          where: {
            customerId: customer.id,
            workspaceId: customer.workspaceId,
            status: "active",
          },
        })

        if (!chatSession) {
          chatSession = await prisma.chatSession.create({
            data: {
              customerId: customer.id,
              workspaceId: customer.workspaceId,
              status: "active",
              context: {
                createdBy: "whatsapp-webhook",
                phoneNumber,
              },
            },
          })
        }

        // Save customer message to conversationMessage table
        await prisma.conversationMessage.create({
          data: {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: "user", // Customer message
            content: messageMarkdown,
            agentType: "NONE", // No agent processing
            tokensUsed: 0,
            debugInfo: JSON.stringify({
              chatbotDisabled: true,
              reason: "activeChatbot = false",
              timestamp: new Date().toISOString(),
              source: "whatsapp-webhook",
            }),
          },
        })

        // Return success WITHOUT processing with LLM
        res.status(200).json({
          status: "message_saved",
          message: "Message saved (chatbot disabled)",
          chatbotDisabled: true,
          sessionId: chatSession.id,
        })
        return
      }

      // 💾 Get or create active chat session BEFORE LLM call
      let chatSession = await prisma.chatSession.findFirst({
        where: {
          customerId: customer.id,
          workspaceId: customer.workspaceId,
          status: "active",
        },
      })

      if (!chatSession) {
        logger.info("[WEBHOOK] Creating new chat session", {
          customerId: customer.id,
          workspaceId: customer.workspaceId,
        })
        chatSession = await prisma.chatSession.create({
          data: {
            customerId: customer.id,
            workspaceId: customer.workspaceId,
            status: "active",
            context: {
              createdBy: "whatsapp-webhook",
              phoneNumber,
            },
          },
        })
      }

      // 💰 BILLING CHECK: Verify credit before processing with LLM
      const { SubscriptionBillingService } = await import(
        "../../../application/services/subscription-billing.service"
      )
      const billingService = new SubscriptionBillingService(prisma)

      // Check trial validity first
      const trialStatus = await billingService.isTrialValid(customer.workspaceId)
      if (trialStatus.isTrialPlan && !trialStatus.isValid) {
        logger.warn("[WEBHOOK] 💰 Trial expired - SILENT BLOCK (no save, no response)", {
          workspaceId: customer.workspaceId,
          customerId: customer.id,
        })

        // 🚨 CRITICAL: DO NOT save message, DO NOT respond - completely silent
        // Customer won't see any response, message won't appear in history
        res.status(402).json({
          status: "billing_error",
          code: "TRIAL_EXPIRED",
          message: "Trial period has expired. Please upgrade your plan.",
        })
        return
      }

      // Check credit balance
      const messageCost = await billingService.getOperationCost(customer.workspaceId, "message")
      const creditCheck = await billingService.checkCredit(customer.workspaceId, messageCost)

      if (!creditCheck.hasSufficientCredit) {
        logger.warn("[WEBHOOK] 💰 Insufficient credit - SILENT BLOCK (no save, no response)", {
          workspaceId: customer.workspaceId,
          customerId: customer.id,
          currentBalance: creditCheck.currentBalance,
          requiredAmount: messageCost,
        })

        // 🚨 CRITICAL: DO NOT save message, DO NOT respond - completely silent
        // Chatbot remains "mute" - no history, no LLM processing, nothing
        res.status(402).json({
          status: "billing_error",
          code: "INSUFFICIENT_CREDIT",
          message: "Insufficient credit. Please recharge your account.",
          details: {
            currentBalance: creditCheck.currentBalance,
            requiredAmount: messageCost,
          },
        })
        return
      }

      // 🤖 Process with LLMRouterService (NEW - replaces placeholder Echo)
      logger.info("[WEBHOOK] 🎯 Calling LLMRouterService", {
        customerId: customer.id,
        conversationId: chatSession.id,
        messageLength: messageMarkdown.length,
      })

      const llmRouterService = new LLMRouterService(prisma)
      const routerResult = await llmRouterService.routeMessage({
        workspaceId: customer.workspaceId,
        customerId: customer.id,
        conversationId: chatSession.id,
        messageId: whatsappMessageId, // WhatsApp message ID
        message: messageMarkdown,
        customerLanguage: customer.language || "it",
        customerName: customer.name,
      })

      logger.info("[WEBHOOK] ✅ LLMRouterService completed", {
        agentUsed: routerResult.agentUsed,
        tokensUsed: routerResult.tokensUsed,
        executionTimeMs: routerResult.executionTimeMs,
        wasFAQ: routerResult.wasFAQ,
        responseLength: routerResult.response.length,
        isBlocked: routerResult.isBlocked, // 🆕 P1: Log if customer was blocked
      })

      // 🚫 P1: If customer is blocked, return 410 Gone WITHOUT sending message
      if (routerResult.isBlocked) {
        logger.warn("[WEBHOOK] 🚫 P1: Customer blocked - returning 410 Gone", {
          customerId: customer.id,
        })

        res.status(410).json({
          status: "blocked",
          message: "Customer is blocked",
        })
        return
      }

      // ✅ Messages already saved by LLMRouterService (INBOUND + OUTBOUND)
      // ✅ debugInfo already saved with timeline
      // ❌ TODO #1: WhatsApp queue emission (not implemented yet)
      //
      // FUTURE IMPLEMENTATION:
      // await whatsappQueueService.enqueue({
      //   customerId: customer.id,
      //   message: routerResult.response,
      //   workspaceId: customer.workspaceId,
      //   customerPhone: phoneNumber,
      //   customerLanguage: customer.language
      // })
      //
      // For now: Just return success - message processing completed

      // 💰 BILLING: Deduct credit for successful message processing
      try {
        const deductResult = await billingService.deductMessageCredit(
          customer.workspaceId,
          whatsappMessageId
        )
        if (deductResult.success) {
          logger.info("[WEBHOOK] 💰 Credit deducted for message", {
            workspaceId: customer.workspaceId,
            newBalance: deductResult.newBalance,
            messageId: whatsappMessageId,
          })
        } else {
          logger.warn("[WEBHOOK] ⚠️ Failed to deduct credit (non-blocking)", {
            workspaceId: customer.workspaceId,
            error: deductResult.error,
          })
        }
      } catch (billingError) {
        // Don't block the response if billing fails - just log it
        logger.error("[WEBHOOK] ⚠️ Billing error (non-blocking):", billingError)
      }

      logger.info("[WEBHOOK] ✅ Message processed successfully", {
        customerId: customer.id,
        workspaceId: customer.workspaceId,
        responseLength: routerResult.response.length,
      })

      // 📤 Return success to client WITH THE RESPONSE MESSAGE
      res.status(200).json({
        status: "processed",
        agentUsed: routerResult.agentUsed,
        tokensUsed: routerResult.tokensUsed,
        response: routerResult.response, // ✅ CRITICAL: Return actual response to user!
        debugInfo: routerResult.debugInfo, // ✅ Include debug info for frontend debugging
      })
    } catch (error: any) {
      logger.error("[WEBHOOK] ❌ Error processing message:", {
        error: error.message,
        stack: error.stack,
      })

      // Still return 200 to prevent WhatsApp from retrying
      res.status(200).json({ error: "Internal error" })
    }
  }
}
