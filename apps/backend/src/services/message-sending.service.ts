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

import { prisma, PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import { WhatsAppDirectSendService } from "./whatsapp-direct-send.service"
import { config } from "../config"
import { TranslationAgent } from "../application/agents/TranslationAgent"

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
  status?: "queued" | "sent" | "blocked" | "failed" // Queue status indicator
}

/**
 * Message Sending Service
 * Punto UNICO per tutti gli invii WhatsApp
 * 
 * 🎯 IMPORTANTE: Usa la Queue per tutti gli invii!
 * La queue rispetta debugMode e applica Security Agent nello scheduler
 */
export class MessageSendingService {
  private translationAgent: TranslationAgent

  constructor(private prisma: PrismaClient) {
    this.translationAgent = new TranslationAgent(prisma)
  }

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
      let finalMessage = options.message
      let securityChecked = false

      // 1. Translation Layer (ALWAYS before enqueue)
      try {
        const translationResult = await this.translationAgent.process({
          workspaceId: options.workspaceId,
          message: options.message,
          targetLanguage: options.userLanguage || "en",
          customerName: options.metadata?.customerName,
          customerId: options.customerId,
          channel: "whatsapp",
        })

        finalMessage = translationResult.message || options.message
        logger.info("✅ [MESSAGE-SEND] Translation layer applied", {
          originalLength: options.message.length,
          finalLength: finalMessage.length,
        })
      } catch (translationError) {
        logger.warn(
          "[MESSAGE-SEND] ⚠️ Translation failed, using original message",
          translationError
        )
        finalMessage = options.message
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

      // 4. Enqueue to WhatsApp Queue (rispetta debugMode!)
      logger.info("📱 [MESSAGE-SEND] Enqueueing to WhatsApp Queue", {
        phoneNumber: options.phoneNumber,
        messageLength: finalMessage.length,
        sendType: options.sendType,
      })

      // Get customerId for queue entry
      let customerId = options.customerId
      if (!customerId && options.phoneNumber) {
        // Try to find customer by phone
        const customer = await this.prisma.customers.findFirst({
          where: {
            phone: options.phoneNumber,
            workspaceId: options.workspaceId,
          },
          select: { id: true },
        })
        customerId = customer?.id
      }

      const directSend = new WhatsAppDirectSendService(this.prisma)
      const sendResult = await directSend.send({
        workspaceId: options.workspaceId,
        customerId: customerId || "",
        phoneNumber: options.phoneNumber,
        messageContent: finalMessage,
        conversationMessageId: messageId,
        skipSecurityCheck: securityChecked, // security already applied above if needed
      })

      logger.info("✅ [MESSAGE-SEND] Message sent successfully", {
        sendType: options.sendType,
        securityChecked,
        duration: Date.now() - startTime,
      })

      return {
        success: sendResult.success,
        messageId: sendResult.messageId,
        blocked: sendResult.blocked ?? false,
        securityChecked,
        translatedText: finalMessage,
        status: sendResult.success ? "sent" : "failed",
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
      return true
    } catch (error) {
      logger.error("❌ [MESSAGE-SEND] Health check failed", error)
      return false
    }
  }

}

// Export singleton instance
export default new MessageSendingService(prisma)
