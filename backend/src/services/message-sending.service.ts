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

import { PrismaClient } from "@prisma/client"
import translationSecurityService from "./translation-security.service"
import { sendToWhatsApp } from "./whatsapp-api.service"
import logger from "../utils/logger"

// Tipi di invio messaggi
export type SendType = 
  | "CHATBOT"          // LLM risponde al cliente
  | "ADMIN_MANUAL"     // Admin invia manualmente dalla UI
  | "CAMPAIGN"         // Campagna schedulata con token replacement
  | "SCHEDULER"        // Scheduler automatico (future use)
  | "SYSTEM"           // Notifica di sistema

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

      // 3. Send to WhatsApp
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

      // 4. Save to database with audit trail
      if (options.chatSessionId) {
        await this.saveMessageToDatabase(
          options,
          finalMessage,
          whatsappResult,
          securityChecked
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
        logger.warn("⚠️ [MESSAGE-SEND] Unknown sendType, applying security by default", {
          sendType,
        })
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
    // Get allowed links for this workspace
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { url: true },
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

    return await translationSecurityService.processResponse(
      message,
      language,
      allowedLinks
    )
  }

  /**
   * Salva il messaggio nel database con audit trail
   */
  private async saveMessageToDatabase(
    options: SendMessageOptions,
    finalMessage: string,
    whatsappResult: any,
    securityChecked: boolean
  ) {
    try {
      await this.prisma.message.create({
        data: {
          chatSessionId: options.chatSessionId!,
          direction: "OUTBOUND",
          content: finalMessage,
          whatsappStatus: whatsappResult.success ? "sent" : "failed",
          whatsappError: whatsappResult.error || null,
          whatsappMessageId: whatsappResult.messageId || null,
          metadata: {
            sendType: options.sendType,
            securityChecked,
            originalMessage: options.message !== finalMessage ? options.message : undefined,
            ...options.metadata,
          },
        },
      })

      logger.info("💾 [MESSAGE-SEND] Message saved to database", {
        chatSessionId: options.chatSessionId,
        sendType: options.sendType,
      })
    } catch (error) {
      logger.error("❌ [MESSAGE-SEND] Failed to save message to DB", {
        error,
        chatSessionId: options.chatSessionId,
      })
      // Don't throw - WhatsApp message was sent successfully
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
