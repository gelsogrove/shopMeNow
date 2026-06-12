import { prisma } from "@echatbot/database"
import logger from "../utils/logger"
import { WhatsAppQueueService } from "./whatsapp-queue.service"
import { WhatsAppProviderFactory } from "./whatsapp/whatsapp-provider.factory"

// WhatsApp Queue Service instance
const whatsappQueueService = new WhatsAppQueueService(prisma)

// prisma imported

/**
 * 📱 PUSH MESSAGING SERVICE - Sistema Centralizzato
 *
 * Gestisce tutti i push messaging WhatsApp con:
 * - 🌍 Supporto multilingua automatico
 * - 📊 Integrazione analytics (via queue/billing)
 * - 🔄 Template messaging unificati
 *
 * @author Andrea Gelso
 */

export enum PushMessageType {
  ORDER_CONFIRMED = "ORDER_CONFIRMED",
  USER_REGISTERED = "USER_REGISTERED",
  DISCOUNT_UPDATED = "DISCOUNT_UPDATED",
  NEW_OFFER = "NEW_OFFER",
  CHATBOT_REACTIVATED = "CHATBOT_REACTIVATED",
}

export interface PushMessageData {
  workspaceId: string
  customerId: string
  customerPhone: string
  customerLanguage?: string
  type: PushMessageType
  templateData?: {
    orderCode?: string
    discountPercentage?: number
    offerPercentage?: number
    categoryName?: string
    offerEndDate?: string
    customerName?: string
  }
}

interface MessageTemplate {
  it: string
  en: string
  es?: string
  pt?: string
  fr?: string
  de?: string
}

/**
 * Template messaggi per tutti i tipi di push
 */
const MESSAGE_TEMPLATES: Record<PushMessageType, MessageTemplate> = {
  [PushMessageType.ORDER_CONFIRMED]: {
    it: "🎉 Ordine confermato! Numero ordine: {orderCode}. Ti contatteremo per i dettagli di consegna.",
    en: "🎉 Order confirmed! Order number: {orderCode}. We'll contact you for delivery details.",
    es: "🎉 ¡Pedido confirmado! Número de pedido: {orderCode}. Te contactaremos para los detalles de entrega.",
    pt: "🎉 Pedido confirmado! Número do pedido: {orderCode}. Entraremos em contato para os detalhes da entrega.",
    fr: "🎉 Commande confirmée! Numéro de commande: {orderCode}. Nous vous contactrons pour les détails de livraison.",
    de: "🎉 Bestellung bestätigt! Bestellnummer: {orderCode}. Wir werden Sie bezüglich der Lieferdetails kontaktieren.",
  },

  [PushMessageType.USER_REGISTERED]: {
    it: "👋 Benvenuto! Grazie per esserti registrato al nostro servizio di IA presto verrai attivato dai nostri commerciali.",
    en: "👋 Welcome! Thank you for registering to our AI service, you will be activated soon by our sales team.",
    es: "👋 ¡Bienvenido! Gracias por registrarte en nuestro servicio de IA, pronto serás activado por nuestro equipo comercial.",
    pt: "👋 Bem-vindo! Obrigado por se registrar em nosso serviço de IA, você será ativado em breve por nossa equipe de vendas.",
    fr: "👋 Bienvenue! Merci de vous être inscrit à notre service d'IA, vous serez bientôt activé par notre équipe commerciale.",
    de: "👋 Willkommen! Danke für die Anmeldung bei unserem KI-Service, Sie werden bald von unserem Vertriebsteam aktiviert.",
  },

  [PushMessageType.DISCOUNT_UPDATED]: {
    it: "💸 Ciao {customerName}! Da oggi puoi usufruire del {discountPercentage}% di sconto sui nostri prodotti.",
    en: "💸 Hi {customerName}! From today you can enjoy {discountPercentage}% discount on our products.",
    es: "💸 ¡Hola {customerName}! Desde hoy puedes disfrutar de {discountPercentage}% de descuento en nuestros productos.",
    pt: "💸 Olá {customerName}! A partir de hoje você pode aproveitar {discountPercentage}% de desconto em nossos produtos.",
    fr: "💸 Salut {customerName}! À partir d'aujourd'hui, vous pouvez bénéficier de {discountPercentage}% de remise sur nos produits.",
    de: "💸 Hallo {customerName}! Ab heute können Sie {discountPercentage}% Rabatt auf unsere Produkte genießen.",
  },

  [PushMessageType.NEW_OFFER]: {
    it: "🎯 Ciao {customerName}! Abbiamo un'offerta del {offerPercentage}% sulla categoria: {categoryName} fino al {offerEndDate}",
    en: "🎯 Hi {customerName}! We have a {offerPercentage}% offer on category: {categoryName} until {offerEndDate}",
    es: "🎯 ¡Hola {customerName}! Tenemos una oferta del {offerPercentage}% en la categoría: {categoryName} hasta el {offerEndDate}",
    pt: "🎯 Olá {customerName}! Temos uma oferta de {offerPercentage}% na categoria: {categoryName} até {offerEndDate}",
    fr: "🎯 Salut {customerName}! Nous avons une offre de {offerPercentage}% sur la catégorie: {categoryName} jusqu'au {offerEndDate}",
    de: "🎯 Hallo {customerName}! Wir haben ein {offerPercentage}% Angebot für die Kategorie: {categoryName} bis {offerEndDate}",
  },

  [PushMessageType.CHATBOT_REACTIVATED]: {
    it: "🤖 Ciao {customerName}, il chatbot è ora disponibile, come posso aiutarti oggi?",
    en: "🤖 Hi {customerName}, the chatbot is now available, how can I help you today?",
    es: "🤖 ¡Hola {customerName}, el chatbot ya está disponible, ¿cómo puedo ayudarte hoy?",
    pt: "🤖 Olá {customerName}, o chatbot está agora disponível, como posso ajudá-lo hoje?",
    fr: "🤖 Salut {customerName}, le chatbot est maintenant disponible, comment puis-je vous aider aujourd'hui?",
    de: "🤖 Hallo {customerName}, der Chatbot ist jetzt verfügbar, wie kann ich Ihnen heute helfen?",
  },
}

export const pushMessagingService = {
  /**
   * 📱 Invia push message centralizzato
   *
   * @param data - Dati del messaggio push
   * @returns Promise<boolean> - Success status
   */
  async sendPushMessage(data: PushMessageData): Promise<boolean> {
    try {
      logger.info(
        `[PUSH-MESSAGING] 🚀 Sending ${data.type} push to ${data.customerPhone}`
      )

      // 1. Ottieni dati customer completi
      const customer = await this.getCustomerData(
        data.customerId,
        data.workspaceId
      )
      if (!customer) {
        logger.error(
          `[PUSH-MESSAGING] ❌ Customer ${data.customerId} not found`
        )
        return false
      }

      // 2. Rileva lingua (auto o da parametro) e mappa formato
      const languageMapping: Record<string, string> = {
        IT: "it",
        ENG: "en",
        ESP: "es",
        PRT: "pt",
        FR: "fr",
        DE: "de",
      }

      const rawLanguage = data.customerLanguage || customer.language || "en"
      const language = languageMapping[rawLanguage] || rawLanguage || "en"

      logger.info(
        `[PUSH-MESSAGING] 🌍 Language mapping: ${customer.language} -> ${language} for customer ${customer.name}`
      )

      // 3. Genera messaggio dalla template
      const message = this.generateMessage(data.type, language, {
        ...data.templateData,
        customerName: customer.name,
      })

      // 4. Salva messaggio in chat history prima dell'invio
      const chatSession = await this.ensureChatSession(
        customer.id,
        data.workspaceId
      )

      // 5. 📱 Invio effettivo WhatsApp
      const whatsappResult = await this.sendWhatsAppMessage(
        data.customerPhone,
        message,
        data.workspaceId
      )

      // 6. Salva messaggio con status corretto basato su risultato WhatsApp
      const messageStatus = whatsappResult.success ? "sent" : "failed"
      await this.saveOutboundMessage(
        chatSession.id,
        message,
        data.type,
        messageStatus,
        whatsappResult.messageId
      )

      if (whatsappResult.success) {
        logger.info(
          `[PUSH-MESSAGING] ✅ Push sent successfully: ${data.type} to ${customer.name}`
        )
        return true
      } else {
        logger.error(`[PUSH-MESSAGING] ❌ Push failed: ${whatsappResult.error}`)
        return false
      }
    } catch (error) {
      logger.error(`[PUSH-MESSAGING] ❌ Error sending push message:`, error)
      return false
    }
  },

  /**
   * 🌍 Genera messaggio dalla template con supporto multilingua
   */
  generateMessage(
    type: PushMessageType,
    language: string,
    templateData: Record<string, any> = {}
  ): string {
    const template = MESSAGE_TEMPLATES[type]
    let message = template[language as keyof MessageTemplate] || template.it

    // Sostituisci placeholder con dati effettivi
    Object.entries(templateData).forEach(([key, value]) => {
      if (value !== undefined) {
        message = message.replace(`{${key}}`, String(value))
      }
    })

    return message
  },

  /**
   * 👤 Ottieni dati customer completi
   */
  async getCustomerData(customerId: string, workspaceId: string) {
    return await prisma.customers.findFirst({
      where: {
        id: customerId,
        workspaceId: workspaceId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        language: true,
        workspaceId: true,
      },
    })
  },

  /**
   * 💬 Assicura esistenza chat session
   */
  async ensureChatSession(customerId: string, workspaceId: string) {
    let chatSession = await prisma.chatSession.findFirst({
      where: {
        customerId: customerId,
        workspaceId: workspaceId,
        status: "active",
      },
    })

    if (!chatSession) {
      chatSession = await prisma.chatSession.create({
        data: {
          customerId: customerId,
          workspaceId: workspaceId,
          status: "active",
          context: {},
        },
      })
    }

    return chatSession
  },

  /**
   * 💾 Salva messaggio outbound in history con status
   * 🔧 CRITICAL: Use conversationMessage table (NEW) for consistency
   */
  async saveOutboundMessage(
    chatSessionId: string,
    content: string,
    pushType: PushMessageType,
    messageStatus: "sent" | "failed" = "sent",
    messageId?: string
  ) {
    // Get chat session to retrieve workspaceId and customerId
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      select: { workspaceId: true, customerId: true },
    })

    if (!chatSession) {
      logger.error(
        `[PUSH-MESSAGING] ❌ Chat session ${chatSessionId} not found - cannot save message`
      )
      return
    }

    // Save to conversationMessage table (NEW format - same as all other messages)
    await prisma.conversationMessage.create({
      data: {
        workspaceId: chatSession.workspaceId,
        customerId: chatSession.customerId,
        conversationId: chatSessionId,
        role: "assistant", // Bot response
        content: content,
        agentType: "PUSH_MESSAGING",
        tokensUsed: 0, // No LLM tokens (static template message)
        debugInfo: JSON.stringify({
          source: "push_messaging",
          pushType: pushType,
          messageStatus: messageStatus,
          whatsappMessageId: messageId,
          timestamp: new Date().toISOString(),
        }),
      },
    })

    logger.info(
      `[PUSH-MESSAGING] 💾 Message saved with status: ${messageStatus}${messageId ? `, messageId: ${messageId}` : ""}`
    )
  },

  /**
   * 📱 Invio WhatsApp via Queue (NON più diretto!)
   * ✅ Passa da Security Agent
   * ✅ Rispetta Debug Mode
   * ✅ Ha billing tracking nel queue job
   * ✅ Ha retry logic
   */
  async sendWhatsAppMessage(
    phoneNumber: string,
    message: string,
    workspaceId: string,
    customerId?: string
  ) {
    try {
      logger.info(
        `[PUSH-MESSAGING] 📤 Adding WhatsApp message to queue for ${phoneNumber}`
      )

      // Validate workspace exists and the SELECTED provider is configured.
      // Provider-agnostic: reads workspace.whatsappProvider and checks the right
      // credentials (Meta / UltraMsg / Wasender) via the factory, instead of the
      // legacy Meta-only whatsappApiKey/whatsappPhoneNumber fields — otherwise a
      // workspace on UltraMsg/Wasender would be wrongly blocked here even though
      // the real send (validateAndSend → factory) would succeed.
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          whatsappProvider: true,
          metaPhoneNumberId: true,
          metaAccessToken: true,
          ultraMsgInstanceId: true,
          ultraMsgToken: true,
          wasenderApiKey: true,
        },
      })

      if (!workspace || !WhatsAppProviderFactory.isConfigured(workspace)) {
        logger.error(
          `[PUSH-MESSAGING] ❌ WhatsApp provider not configured for workspace ${workspaceId}`
        )
        return { success: false, error: "WhatsApp provider not configured" }
      }

      // Get or create customer ID if not provided
      let finalCustomerId = customerId
      if (!finalCustomerId) {
        const customer = await prisma.customers.findFirst({
          where: { phone: phoneNumber, workspaceId },
          select: { id: true },
        })
        finalCustomerId = customer?.id
      }

      if (!finalCustomerId) {
        logger.error(
          `[PUSH-MESSAGING] ❌ Customer not found for phone ${phoneNumber} in workspace ${workspaceId}`
        )
        return { success: false, error: "Customer not found" }
      }

      // 📤 ADD TO QUEUE instead of sending directly!
      // This ensures:
      // ✅ Security Agent validation
      // ✅ Debug Mode respect
      // ✅ Billing tracking
      // ✅ Retry logic
      const queueEntry = await whatsappQueueService.enqueue({
        workspaceId,
        customerId: finalCustomerId,
        phoneNumber,
        messageContent: message,
        // No conversationMessageId for push messages (they're standalone)
      })

      logger.info(
        `[PUSH-MESSAGING] ✅ Message added to queue`,
        {
          queueId: queueEntry.id,
          phoneNumber,
          workspaceId,
          status: "pending",
        }
      )

      return {
        success: true,
        messageId: queueEntry.id,
        status: "pending", // Will be "sent" after scheduler processes it
        queuedAt: new Date().toISOString(),
      }
    } catch (error) {
      logger.error(`[PUSH-MESSAGING] ❌ Error adding message to queue:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },

  /**
   * 📊 Helper per inviare diversi tipi di push message
   */
  async sendOrderConfirmation(
    customerId: string,
    customerPhone: string,
    workspaceId: string,
    orderCode: string
  ) {
    return await this.sendPushMessage({
      workspaceId,
      customerId,
      customerPhone,
      type: PushMessageType.ORDER_CONFIRMED,
      templateData: { orderCode },
    })
  },

  async sendUserWelcome(
    customerId: string,
    customerPhone: string,
    workspaceId: string
  ) {
    return await this.sendPushMessage({
      workspaceId,
      customerId,
      customerPhone,
      type: PushMessageType.USER_REGISTERED,
    })
  },

  async sendDiscountUpdate(
    customerId: string,
    customerPhone: string,
    workspaceId: string,
    discountPercentage: number
  ) {
    return await this.sendPushMessage({
      workspaceId,
      customerId,
      customerPhone,
      type: PushMessageType.DISCOUNT_UPDATED,
      templateData: { discountPercentage },
    })
  },

  async sendNewOffer(
    customerId: string,
    customerPhone: string,
    workspaceId: string,
    offerPercentage: number,
    categoryName: string,
    offerEndDate: string
  ) {
    return await this.sendPushMessage({
      workspaceId,
      customerId,
      customerPhone,
      type: PushMessageType.NEW_OFFER,
      templateData: { offerPercentage, categoryName, offerEndDate },
    })
  },

  async sendChatbotReactivated(
    customerId: string,
    customerPhone: string,
    workspaceId: string
  ) {
    return await this.sendPushMessage({
      workspaceId,
      customerId,
      customerPhone,
      type: PushMessageType.CHATBOT_REACTIVATED,
    })
  },
}
