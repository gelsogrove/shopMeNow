import { PrismaClient } from '@prisma/client'
import logger from '../utils/logger'
import { sendToWhatsApp } from './whatsapp-api.service'
import { markdownToWhatsApp } from '../utils/whatsapp-formatter'

/**
 * WhatsApp Notification Service
 * 
 * Single Responsibility: Send push notifications to customers via WhatsApp
 * 
 * Use cases:
 * - Chatbot activated/deactivated
 * - New discount available
 * - Order status changed
 * - Payment reminder
 * - Generic notifications
 */

const prisma = new PrismaClient()

export interface NotificationResult {
  success: boolean
  messageId?: string
  error?: string
}

export type NotificationType = 
  | 'chatbot_activated'
  | 'chatbot_deactivated'
  | 'new_discount'
  | 'order_status_changed'
  | 'payment_reminder'
  | 'generic'

/**
 * Send WhatsApp notification to customer
 */
export async function sendWhatsAppNotification(
  customerId: string,
  workspaceId: string,
  message: string,
  notificationType: NotificationType,
  metadata?: Record<string, any>
): Promise<NotificationResult> {
  try {
    logger.info('[WHATSAPP-NOTIFICATION] 📤 Sending notification', {
      customerId,
      workspaceId,
      notificationType,
      messageLength: message.length
    })
    
    // 1️⃣ VALIDATE: Customer exists and belongs to workspace
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        phone: true,
        workspaceId: true,
        email: true,
        activeChatbot: true
      }
    })
    
    if (!customer) {
      logger.error('[WHATSAPP-NOTIFICATION] ❌ Customer not found', { customerId })
      return {
        success: false,
        error: 'Customer not found'
      }
    }
    
    if (customer.workspaceId !== workspaceId) {
      logger.error('[WHATSAPP-NOTIFICATION] ❌ Customer does not belong to workspace', {
        customerId,
        customerWorkspace: customer.workspaceId,
        requestedWorkspace: workspaceId
      })
      return {
        success: false,
        error: 'Customer does not belong to workspace'
      }
    }
    
    if (!customer.phone) {
      logger.error('[WHATSAPP-NOTIFICATION] ❌ Customer has no phone number', {
        customerId,
        email: customer.email
      })
      return {
        success: false,
        error: 'Customer has no phone number'
      }
    }
    
    // 2️⃣ VALIDATE: Workspace has WhatsApp configured
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        whatsappApiKey: true,
        whatsappPhoneNumber: true
      }
    })
    
    if (!workspace?.whatsappApiKey || !workspace?.whatsappPhoneNumber) {
      logger.error('[WHATSAPP-NOTIFICATION] ❌ WhatsApp not configured for workspace', {
        workspaceId,
        workspaceName: workspace?.name
      })
      return {
        success: false,
        error: 'WhatsApp not configured for workspace'
      }
    }
    
    // 3️⃣ CONVERT: Markdown → WhatsApp format
    const whatsappMessage = markdownToWhatsApp(message)
    
    // 4️⃣ SEND: Via WhatsApp API
    const sendResult = await sendToWhatsApp(
      customer.phone,
      whatsappMessage,
      workspaceId
    )
    
    if (!sendResult.success) {
      logger.error('[WHATSAPP-NOTIFICATION] ❌ Failed to send via API', {
        customerId,
        phoneNumber: customer.phone,
        error: sendResult.error
      })
      
      // Save failed message to database
      await saveNotificationToDatabase(
        customerId,
        workspaceId,
        message,
        notificationType,
        'failed',
        sendResult.error,
        metadata
      )
      
      return {
        success: false,
        error: sendResult.error
      }
    }
    
    // 5️⃣ SAVE: Success message to database
    await saveNotificationToDatabase(
      customerId,
      workspaceId,
      message,
      notificationType,
      'sent',
      undefined,
      metadata,
      sendResult.messageId
    )
    
    logger.info('[WHATSAPP-NOTIFICATION] ✅ Notification sent successfully', {
      customerId,
      phoneNumber: customer.phone,
      messageId: sendResult.messageId,
      notificationType
    })
    
    return {
      success: true,
      messageId: sendResult.messageId
    }
    
  } catch (error: any) {
    logger.error('[WHATSAPP-NOTIFICATION] ❌ Unexpected error:', {
      error: error.message,
      stack: error.stack,
      customerId,
      workspaceId,
      notificationType
    })
    
    return {
      success: false,
      error: error.message || 'Unexpected error sending notification'
    }
  }
}

/**
 * Save notification to database
 */
async function saveNotificationToDatabase(
  customerId: string,
  workspaceId: string,
  message: string,
  notificationType: NotificationType,
  status: 'sent' | 'failed',
  error?: string,
  metadata?: Record<string, any>,
  whatsappMessageId?: string
): Promise<void> {
  try {
    // Get or create chat session
    let chatSession = await prisma.chatSession.findFirst({
      where: {
        customerId,
        workspaceId,
        status: 'active'
      }
    })
    
    if (!chatSession) {
      logger.info('[WHATSAPP-NOTIFICATION] Creating new chat session', {
        customerId,
        workspaceId
      })
      
      chatSession = await prisma.chatSession.create({
        data: {
          customerId,
          workspaceId,
          status: 'active',
          context: {
            createdBy: 'notification-service',
            notificationType
          }
        }
      })
    }
    
    // Save message
    await prisma.message.create({
      data: {
        chatSessionId: chatSession.id,
        direction: 'OUTBOUND', // Notification from assistant
        content: message,
        type: 'TEXT',
        whatsappStatus: status,
        whatsappError: error,
        whatsappMessageId: whatsappMessageId,
        metadata: {
          notificationType,
          sentVia: 'notification-service',
          ...metadata
        }
      }
    })
    
    logger.debug('[WHATSAPP-NOTIFICATION] Message saved to database', {
      chatSessionId: chatSession.id,
      status,
      whatsappMessageId
    })
    
  } catch (error: any) {
    logger.error('[WHATSAPP-NOTIFICATION] ❌ Failed to save to database:', {
      error: error.message,
      stack: error.stack,
      customerId,
      workspaceId
    })
  }
}

/**
 * Send chatbot activation notification
 */
export async function sendChatbotActivatedNotification(
  customerId: string,
  workspaceId: string
): Promise<NotificationResult> {
  const message = `🤖 *Chatbot Attivato*

Il nostro assistente virtuale è ora attivo e pronto ad aiutarti!

Puoi inviarmi domande sui nostri prodotti, verificare lo stato degli ordini o ricevere assistenza in qualsiasi momento.

Scrivi semplicemente la tua domanda e ti risponderò immediatamente! 💬`
  
  return sendWhatsAppNotification(
    customerId,
    workspaceId,
    message,
    'chatbot_activated'
  )
}

/**
 * Send chatbot deactivation notification
 */
export async function sendChatbotDeactivatedNotification(
  customerId: string,
  workspaceId: string
): Promise<NotificationResult> {
  const message = `🤖 *Chatbot Disattivato*

L'assistente virtuale è stato disattivato per il tuo account.

Un operatore umano ti risponderà appena possibile durante il nostro orario di assistenza.

Grazie per la pazienza! 👤`
  
  return sendWhatsAppNotification(
    customerId,
    workspaceId,
    message,
    'chatbot_deactivated'
  )
}

/**
 * Send order status changed notification
 */
export async function sendOrderStatusNotification(
  customerId: string,
  workspaceId: string,
  orderCode: string,
  newStatus: string,
  trackingUrl?: string
): Promise<NotificationResult> {
  let message = `📦 *Aggiornamento Ordine ${orderCode}*

Lo stato del tuo ordine è cambiato: *${newStatus}*`
  
  if (trackingUrl) {
    message += `\n\n🔗 Traccia la spedizione: ${trackingUrl}`
  }
  
  message += `\n\nPer maggiori dettagli, scrivi "stato ordine ${orderCode}"`
  
  return sendWhatsAppNotification(
    customerId,
    workspaceId,
    message,
    'order_status_changed',
    { orderCode, newStatus, trackingUrl }
  )
}

/**
 * Send new discount notification
 */
export async function sendNewDiscountNotification(
  customerId: string,
  workspaceId: string,
  discountCode: string,
  discountPercentage: number,
  expiryDate?: Date
): Promise<NotificationResult> {
  let message = `🎉 *Nuova Promozione per Te!*

Abbiamo uno sconto speciale: *${discountPercentage}% OFF*

Codice: \`${discountCode}\``
  
  if (expiryDate) {
    const dateStr = expiryDate.toLocaleDateString('it-IT')
    message += `\nValido fino al: ${dateStr}`
  }
  
  message += `\n\nApplica il codice al checkout per risparmiare! 💰`
  
  return sendWhatsAppNotification(
    customerId,
    workspaceId,
    message,
    'new_discount',
    { discountCode, discountPercentage, expiryDate }
  )
}
