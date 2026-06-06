/**
 * Meta WhatsApp Provider
 * 
 * Wrapper around existing Meta Business API implementation
 * 
 * @architecture Strategy Pattern implementation
 */

import axios from 'axios'
import logger from '../../utils/logger'
import {
  InboundMediaRef,
  InboundMediaResult,
  WhatsAppProvider,
  WhatsAppSendMessageResult,
} from './whatsapp-provider.interface'

export interface MetaConfig {
  phoneNumberId: string
  accessToken: string
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  private readonly baseUrl = 'https://graph.facebook.com/v21.0'

  constructor(private config: MetaConfig) {
    if (!config.phoneNumberId || !config.accessToken) {
      throw new Error('Meta: phoneNumberId and accessToken are required')
    }
  }

  getProviderName(): string {
    return 'Meta Business API'
  }

  /**
   * Send text message via Meta Business API
   */
  async sendTextMessage(
    to: string,
    message: string
  ): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedPhone = to.replace(/[\s+]/g, '')

      const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`

      logger.info('📤 Meta: Sending text message', {
        to: formattedPhone,
        messageLength: message.length,
      })

      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          timeout: 30000,
        }
      )

      logger.info('✅ Meta: Message sent successfully', {
        to: formattedPhone,
        messageId: response.data.messages?.[0]?.id,
      })

      return {
        messageId: response.data.messages?.[0]?.id || `meta-${Date.now()}`,
        success: true,
      }
    } catch (error: any) {
      logger.error('❌ Meta: Failed to send message', {
        to,
        error: error.message,
        response: error.response?.data,
      })

      return {
        messageId: '',
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  /**
   * Show the "typing…" indicator while the LLM composes a reply.
   *
   * Meta Cloud API exposes the typing indicator ONLY as part of marking the
   * inbound message as read: POST /{phone-number-id}/messages with
   * { status:'read', message_id, typing_indicator:{type:'text'} }. So this one
   * call also delivers the blue read ticks. The indicator stays up to 25s or
   * until the next outbound message is sent (auto-clears on reply) — no refresh
   * loop needed.
   *
   * Fire-and-forget: never throws, swallows its own errors so it can never
   * block or break the reply path.
   *
   * @param to                recipient phone (unused by Meta — read/typing keys
   *                          off message_id; kept for interface compatibility)
   * @param inboundMessageId  wamid of the customer message being replied to
   */
  async sendTypingIndicator(
    to: string,
    inboundMessageId?: string
  ): Promise<void> {
    // Without the inbound wamid there is nothing to attach the indicator to.
    if (!inboundMessageId) {
      logger.debug('⌨️ Meta: skip typing indicator — no inbound message id')
      return
    }

    try {
      const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`

      await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: inboundMessageId,
          typing_indicator: { type: 'text' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          timeout: 8000,
        }
      )

      logger.debug('⌨️ Meta: typing indicator sent', { inboundMessageId })
    } catch (error: any) {
      // Non-critical — must never block the reply.
      logger.debug('⌨️ Meta: typing indicator failed (non-critical)', {
        error: error.message,
        response: error.response?.data,
      })
    }
  }

  /**
   * Send a reaction (emoji) to a previously exchanged message.
   * Meta Cloud API: POST /{phone-number-id}/messages with type "reaction".
   * An empty emoji removes the reaction.
   */
  async sendReaction(
    to: string,
    messageId: string,
    emoji: string
  ): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedPhone = to.replace(/[\s+]/g, '')
      const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`

      logger.info('📤 Meta: Sending reaction', {
        to: formattedPhone,
        messageId,
        emoji,
      })

      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'reaction',
          reaction: { message_id: messageId, emoji },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          timeout: 30000,
        }
      )

      return {
        messageId: response.data.messages?.[0]?.id || `meta-react-${Date.now()}`,
        success: true,
      }
    } catch (error: any) {
      logger.error('❌ Meta: Failed to send reaction', {
        to,
        messageId,
        error: error.message,
        response: error.response?.data,
      })
      return {
        messageId: '',
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  /**
   * Send media message via Meta Business API
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'video' | 'document' = 'image',
    filename?: string
  ): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedPhone = to.replace(/[\s+]/g, '')

      const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`

      const mediaPayload: any = {
        link: mediaUrl,
      }

      if (caption) {
        mediaPayload.caption = caption
      }

      // WhatsApp Cloud API requires "filename" for document messages to display
      // the real file name instead of "Untitled" in the customer's chat.
      if (mediaType === 'document' && filename) {
        mediaPayload.filename = filename
      }

      logger.info('📤 Meta: Sending media message', {
        to: formattedPhone,
        mediaType,
        mediaUrl,
      })

      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: mediaType,
          [mediaType]: mediaPayload,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          timeout: 30000,
        }
      )

      logger.info('✅ Meta: Media sent successfully', {
        to: formattedPhone,
        mediaType,
        messageId: response.data.messages?.[0]?.id,
      })

      return {
        messageId: response.data.messages?.[0]?.id || `meta-${Date.now()}`,
        success: true,
      }
    } catch (error: any) {
      logger.error('❌ Meta: Failed to send media', {
        to,
        mediaType,
        error: error.message,
        response: error.response?.data,
      })

      return {
        messageId: '',
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  async sendAudioMessage(to: string, audioUrl: string): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedPhone = to.replace(/[\s+]/g, '')
      const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'audio',
          audio: { link: audioUrl },
        },
        {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.accessToken}` },
          timeout: 30000,
        }
      )
      logger.info('✅ Meta: Audio sent', { to: formattedPhone, messageId: response.data.messages?.[0]?.id })
      return { messageId: response.data.messages?.[0]?.id || `meta-${Date.now()}`, success: true }
    } catch (error: any) {
      logger.error('❌ Meta: Failed to send audio', { to, error: error.message, response: error.response?.data })
      return { messageId: '', success: false, error: error.message }
    }
  }

  /**
   * Download inbound media from Meta.
   * Two steps: (1) GET /{media_id} → { url, mime_type, file_size }, then
   * (2) GET that url with the Bearer token → binary. The media URL requires
   * the same access token; it is NOT publicly fetchable.
   * Meta stores inbound media for 14 days, so this must run promptly.
   */
  async downloadInboundMedia(ref: InboundMediaRef): Promise<InboundMediaResult> {
    if (!ref.mediaId) {
      throw new Error('Meta: mediaId is required to download inbound media')
    }

    const metaUrl = `${this.baseUrl}/${ref.mediaId}`
    const meta = await axios.get(metaUrl, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      timeout: 30000,
    })

    const downloadUrl: string | undefined = meta.data?.url
    const mimeType: string = meta.data?.mime_type || 'application/octet-stream'
    if (!downloadUrl) {
      throw new Error('Meta: media metadata did not include a download url')
    }

    const bin = await axios.get(downloadUrl, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      responseType: 'arraybuffer',
      timeout: 60000,
    })

    const buffer = Buffer.from(bin.data)
    logger.info('📥 Meta: Downloaded inbound media', {
      mediaId: ref.mediaId,
      mimeType,
      sizeBytes: buffer.length,
    })

    return { buffer, mimeType, sizeBytes: buffer.length }
  }

  /**
   * Send template message (Meta Business API only)
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    params: string[]
  ): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedPhone = to.replace(/[\s+]/g, '')

      const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`

      const components = params.map((param) => ({
        type: 'body',
        parameters: [{ type: 'text', text: param }],
      }))

      logger.info('📤 Meta: Sending template message', {
        to: formattedPhone,
        templateName,
        paramsCount: params.length,
      })

      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          timeout: 30000,
        }
      )

      logger.info('✅ Meta: Template sent successfully', {
        to: formattedPhone,
        templateName,
        messageId: response.data.messages?.[0]?.id,
      })

      return {
        messageId: response.data.messages?.[0]?.id || `meta-${Date.now()}`,
        success: true,
      }
    } catch (error: any) {
      logger.error('❌ Meta: Failed to send template', {
        to,
        templateName,
        error: error.message,
        response: error.response?.data,
      })

      return {
        messageId: '',
        success: false,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }
}
