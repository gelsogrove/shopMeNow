import { prisma } from "@echatbot/database"
import logger from "../utils/logger"

/**
 * WhatsApp API Service
 *
 * Single Responsibility: Send messages via WhatsApp Business API
 *
 * Features:
 * - Send text messages to WhatsApp
 * - Handle API errors gracefully
 * - Return structured results (success, error, messageId)
 * - Fetch workspace-specific credentials from database
 */

// prisma imported

export interface WhatsAppSendResult {
  success: boolean
  error?: string
  messageId?: string
}

/**
 * Send a text message via WhatsApp Business API
 *
 * @param phoneNumber - Customer phone number (with + prefix)
 * @param message - Text message to send (already in WhatsApp format)
 * @param workspaceId - Workspace ID to fetch credentials
 * @returns Result object with success status and optional error/messageId
 *
 * @example
 * const result = await sendToWhatsApp('+393491234567', 'Ciao!', workspaceId)
 * if (!result.success) {
 *   logger.error('Failed to send WhatsApp message:', result.error)
 * }
 */
export async function sendToWhatsApp(
  phoneNumber: string,
  message: string,
  workspaceId: string
): Promise<WhatsAppSendResult> {
  try {
    // 1. Get workspace WhatsApp settings from database
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        whatsappApiKey: true,
        whatsappPhoneNumber: true,
        whatsappPhoneNumberId: true,
      },
    })

    // 2. Validate workspace configuration
    if (!workspace?.whatsappApiKey || !workspace?.whatsappPhoneNumber) {
      logger.warn(`WhatsApp not configured for workspace ${workspaceId}`)
      return {
        success: false,
        error: "WhatsApp not configured for this workspace",
      }
    }

    // 3. Prepare WhatsApp API request
    // TODO: Will be replaced with new WhatsApp library
    const senderId = workspace.whatsappPhoneNumberId || workspace.whatsappPhoneNumber
    if (!workspace.whatsappPhoneNumberId) {
      logger.warn("[WhatsApp API] Missing phoneNumberId - falling back to phoneNumber", {
        workspaceId,
        phoneNumber: workspace.whatsappPhoneNumber,
      })
    }
    const apiUrl = `https://graph.facebook.com/v18.0/${senderId}/messages`

    const payload = {
      messaging_product: "whatsapp",
      to: phoneNumber.replace("+", ""), // WhatsApp expects no + prefix
      type: "text",
      text: {
        body: message,
      },
    }

    // 4. Send to WhatsApp Business API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workspace.whatsappApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    // 5. Handle API response
    if (!response.ok) {
      const errorData = await response.text()
      logger.error(`WhatsApp API error: ${response.status} ${errorData}`, {
        workspaceId,
        phoneNumber,
        status: response.status,
      })
      return {
        success: false,
        error: `WhatsApp API error: ${response.status}`,
      }
    }

    // 6. Extract message ID from response
    const data = await response.json()
    const messageId = data.messages?.[0]?.id

    logger.info(`WhatsApp message sent successfully`, {
      messageId,
      workspaceId,
      phoneNumber,
    })

    return {
      success: true,
      messageId,
    }
  } catch (error: any) {
    logger.error("Failed to send WhatsApp message:", {
      error: error.message,
      stack: error.stack,
      workspaceId,
      phoneNumber,
    })
    return {
      success: false,
      error: error.message,
    }
  }
}
