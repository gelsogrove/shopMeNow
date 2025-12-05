/**
 * Message Sending Service - CENTRAL HUB for all WhatsApp messages
 *
 * 🎯 OBIETTIVO: TUTTI i messaggi WhatsApp DEVONO passare da questo service
 *
 * ✅ Garantisce che security layer sia applicato quando necessario
 * ✅ Log uniforme per audit trail
 * ✅ Gestione errori centralizzata
 * ✅ Salvataggio automatico in database
 *
 * 🚨 REGOLA CRITICA: sendToWhatsApp NON deve essere chiamato direttamente!
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import translationSecurityService from "./translation-security.service"
import { sendToWhatsApp } from "./whatsapp-api.service"

// Tipi di invio messaggi
export type SendType =
  | "CHATBOT" // LLM risponde al cliente
  | "ADMIN_MANUAL" // Admin invia manualmente dalla UI
  | "CAMPAIGN" // Campagna schedulata con token replacement
  | "SCHEDULER" // Scheduler automatico (future use)
  | "SYSTEM" // Notifica di sistema

export interface SendMessageOptions {
  phoneNumber: string
  message: string
  workspaceId: string
  customerId?: string
  sendType: SendType
  skipSecurityLayer?: boolean // Default: false (security sempre attivo tranne se esplicitamente disabilitato)
  userLanguage?: "it" | "es" | "pt" | "en"
  metadata?: Record<string, any>
  chatSessionId?: string
}

export interface SendMessageResult {
  success: boolean
  error?: string
  messageId?: string
  blocked?: boolean
  blockReason?: string
  securityChecked: boolean
  translatedText?: string
}

/**
 * Message Sending Service
 * Punto UNICO per tutti gli invii WhatsApp
 */
export class MessageSendingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Invia un messaggio WhatsApp con security layer automatico
   *
   * @param options Opzioni di invio
   * @returns Risultato dell'invio
   */
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const startTime = Date.now()

    logger.info("📤 [MESSAGE-SEND] Starting message send", {
      sendType: options.sendType,
      phoneNumber: options.phoneNumber,
      workspaceId: options.workspaceId,
      customerId: options.customerId,
      messageLength: options.message.length,
      skipSecurityLayer: options.skipSecurityLayer,
    })

    try {
      // 1. Determine if security layer is needed
      const needsSecurity = this.needsSecurityCheck(
        options.sendType,
        options.skipSecurityLayer
      )

      let finalMessage = options.message
      let securityChecked = false
      let blocked = false
      let blockReason: string | undefined

      // 2. Apply security layer if needed
      if (needsSecurity) {
        logger.info("🔒 [MESSAGE-SEND] Applying security layer", {
          sendType: options.sendType,
        })

        const securityResult = await this.applySecurityLayer(
          options.message,
          options.userLanguage || "it",
          options.workspaceId
        )

        securityChecked = true

        if (securityResult.blocked) {
          blocked = true
          blockReason = securityResult.reason

          logger.warn("🚨 [MESSAGE-SEND] Security layer BLOCKED message", {
            sendType: options.sendType,
            reason: securityResult.reason,
            phoneNumber: options.phoneNumber,
            customerId: options.customerId,
          })

          // Return blocked result WITHOUT sending to WhatsApp
          return {
            success: false,
            error: `Message blocked by security layer: ${securityResult.reason}`,
            blocked: true,
            blockReason: securityResult.reason,
            securityChecked: true,
          }
        }

        finalMessage = securityResult.translatedText
        logger.info("✅ [MESSAGE-SEND] Security layer passed", {
          originalLength: options.message.length,
          finalLength: finalMessage.length,
        })
      } else {
        logger.info("⏭️ [MESSAGE-SEND] Skipping security layer", {
          sendType: options.sendType,
          reason: options.skipSecurityLayer
            ? "Explicitly skipped"
            : "Not required for this send type",
        })
      }

      // 3. Save to database BEFORE sending to WhatsApp (for better audit trail)
      let messageId: string | undefined
      if (options.chatSessionId) {
        logger.info(
          "💾 [MESSAGE-SEND] Saving to history BEFORE WhatsApp send",
          {
            chatSessionId: options.chatSessionId,
            sendType: options.sendType,
          }
        )

        messageId = await this.saveMessageToDatabase(
          options,
          finalMessage,
          { success: false }, // Temporary status, will update after WhatsApp send
          securityChecked
        )

        logger.info("✅ [MESSAGE-SEND] Message saved to history", {
          messageId,
          duration: Date.now() - startTime,
        })
      }

      // 4. Send to WhatsApp
      logger.info("📱 [MESSAGE-SEND] Sending to WhatsApp", {
        phoneNumber: options.phoneNumber,
        messageLength: finalMessage.length,
      })

      const whatsappResult = await sendToWhatsApp(
        options.phoneNumber,
        finalMessage,
        options.workspaceId
      )

      if (!whatsappResult.success) {
        logger.error("❌ [MESSAGE-SEND] WhatsApp send failed", {
          error: whatsappResult.error,
          phoneNumber: options.phoneNumber,
        })

        // Update message status to failed
        if (messageId) {
          await this.updateMessageStatus(
            messageId,
            "failed",
            whatsappResult.error
          )
        }

        return {
          success: false,
          error: whatsappResult.error,
          securityChecked,
          blocked: false,
        }
      }

      logger.info("✅ [MESSAGE-SEND] WhatsApp send successful", {
        messageId: whatsappResult.messageId,
        duration: Date.now() - startTime,
      })

      // 5. Update message status to sent
      if (messageId) {
        await this.updateMessageStatus(
          messageId,
          "sent",
          undefined,
          whatsappResult.messageId
        )
      }

      return {
        success: true,
        messageId: whatsappResult.messageId,
        blocked: false,
        securityChecked,
        translatedText: finalMessage,
      }
    } catch (error) {
      logger.error("❌ [MESSAGE-SEND] Fatal error", {
        error,
        sendType: options.sendType,
        phoneNumber: options.phoneNumber,
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        securityChecked: false,
        blocked: false,
      }
    }
  }

  /**
   * Determina se il security layer è necessario
   *
   * @param sendType Tipo di invio
   * @param skipExplicit Flag esplicito per saltare security
   * @returns true se security layer necessario
   */
  private needsSecurityCheck(
    sendType: SendType,
    skipExplicit?: boolean
  ): boolean {
    // Se esplicitamente saltato dall'utente, rispetta la scelta
    if (skipExplicit === true) {
      return false
    }

    // Matrice decisionale basata su sendType
    switch (sendType) {
      case "CHATBOT":
        // ✅ LLM può generare contenuto inappropriato
        return true

      case "CAMPAIGN":
        // ✅ Token replacement da DB può contenere dati malevoli
        return true

      case "SCHEDULER":
        // ✅ Contenuto automatico, serve controllo
        return true

      case "ADMIN_MANUAL":
        // ❌ Admin è fidato (ma può esplicitamente richiedere check)
        return false

      case "SYSTEM":
        // ❌ Notifiche hardcoded, nessun input esterno
        return false

      default:
        // 🚨 Safe default: in caso di dubbio, applica security
        logger.warn(
          "⚠️ [MESSAGE-SEND] Unknown sendType, applying security by default",
          {
            sendType,
          }
        )
        return true
    }
  }

  /**
   * Applica il security layer al messaggio
   */
  private async applySecurityLayer(
    message: string,
    language: "it" | "es" | "pt" | "en",
    workspaceId: string
  ) {
    // Get workspace with agentConfigs to use same LLM model as agent
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        url: true,
        agentConfigs: {
          select: {
            model: true,
          },
          take: 1, // Get first (primary) agent config
        },
      },
    })

    const workspaceUrl = workspace?.url || ""

    const allowedLinks = [
      workspaceUrl,
      `${workspaceUrl}/s/`, // Short URLs with tokens
      `${workspaceUrl}/orders-public`,
      `${workspaceUrl}/checkout-public`,
      `${workspaceUrl}/api/`,
      "https://wa.me/",
    ]

    // 🔧 Get LLM config from Agent Settings (same model/provider as agent)
    const { getLLMConfig } = await import("../config/llm.config")
    const agentModel = workspace?.agentConfigs?.[0]?.model
    const llmConfig = getLLMConfig(agentModel)

    logger.info("🔒 [MESSAGE-SEND] Security layer using agent model", {
      agentModel,
      provider: llmConfig.useLocal ? "Ollama (local)" : "OpenRouter (cloud)",
    })

    return await translationSecurityService.processResponse(
      message,
      language,
      allowedLinks,
      llmConfig.model, // Use same model as agent
      llmConfig.baseURL, // Use same baseURL as agent
      llmConfig.apiKey // Use same API key as agent
    )
  }

  /**
   * Salva il messaggio nel database con audit trail
   * @returns messageId del messaggio salvato
   */
  private async saveMessageToDatabase(
    options: SendMessageOptions,
    finalMessage: string,
    whatsappResult: any,
    securityChecked: boolean
  ): Promise<string | undefined> {
    try {
      const savedMessage = await this.prisma.message.create({
        data: {
          chatSessionId: options.chatSessionId!,
          direction: "OUTBOUND",
          content: finalMessage,
          whatsappStatus: whatsappResult.success ? "sent" : "pending",
          whatsappError: whatsappResult.error || null,
          whatsappMessageId: whatsappResult.messageId || null,
          metadata: {
            sendType: options.sendType,
            securityChecked,
            originalMessage:
              options.message !== finalMessage ? options.message : undefined,
            ...options.metadata,
          },
        },
      })

      logger.info("💾 [MESSAGE-SEND] Message saved to database", {
        chatSessionId: options.chatSessionId,
        sendType: options.sendType,
        messageId: savedMessage.id,
      })

      return savedMessage.id
    } catch (error) {
      logger.error("❌ [MESSAGE-SEND] Failed to save message to DB", {
        error,
        chatSessionId: options.chatSessionId,
      })
      // Don't throw - continue with WhatsApp send
      return undefined
    }
  }

  /**
   * Aggiorna lo stato WhatsApp del messaggio
   */
  private async updateMessageStatus(
    messageId: string,
    status: "sent" | "failed" | "pending",
    error?: string,
    whatsappMessageId?: string
  ) {
    try {
      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          whatsappStatus: status,
          whatsappError: error || null,
          whatsappMessageId: whatsappMessageId || null,
        },
      })

      logger.info("✅ [MESSAGE-SEND] Message status updated", {
        messageId,
        status,
      })
    } catch (error) {
      logger.error("❌ [MESSAGE-SEND] Failed to update message status", {
        error,
        messageId,
      })
    }
  }

  /**
   * Health check - verifica che il service sia configurato correttamente
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1`

      // Check translation service
      const isHealthy = await translationSecurityService.healthCheck()

      return isHealthy
    } catch (error) {
      logger.error("❌ [MESSAGE-SEND] Health check failed", error)
      return false
    }
  }
}

// Export singleton instance
export default new MessageSendingService(new PrismaClient())
