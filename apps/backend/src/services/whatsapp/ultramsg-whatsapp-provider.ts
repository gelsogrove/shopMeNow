/**
 * UltraMsg WhatsApp Provider
 * 
 * Implementation of WhatsAppProvider for UltraMsg API
 * Docs: https://docs.ultramsg.com/api/post/messages/chat
 * 
 * @architecture Strategy Pattern implementation
 */

import axios from 'axios'
import querystring from 'querystring'
import logger from '../../utils/logger'
import {
  InboundMediaRef,
  InboundMediaResult,
  WhatsAppProvider,
  WhatsAppSendMessageResult,
} from './whatsapp-provider.interface'

export interface UltraMsgConfig {
  instanceId: string
  token: string
  apiUrl?: string
}

export class UltraMsgWhatsAppProvider implements WhatsAppProvider {
  private readonly defaultBaseUrl = 'https://api.ultramsg.com'

  constructor(private config: UltraMsgConfig) {
    if (!config.instanceId || !config.token) {
      throw new Error('UltraMsg: instanceId and token are required')
    }
  }

  private buildEndpoint(path: string): string {
    const rawBase = (this.config.apiUrl || this.defaultBaseUrl).trim()
    const base = rawBase.replace(/\/$/, '')
    const instanceId = this.config.instanceId.replace(/^\//, '')
    const baseWithInstance = base.endsWith(`/${instanceId}`) ? base : `${base}/${instanceId}`
    return `${baseWithInstance}/${path}`
  }

  getProviderName(): string {
    return 'UltraMsg'
  }

  /**
   * Send text message via UltraMsg API
   * Endpoint: POST /instance{id}/messages/chat
   */
  async sendTextMessage(
    to: string,
    message: string
  ): Promise<WhatsAppSendMessageResult> {
    try {
      // Format phone number (remove + and spaces)
      const formattedPhone = to.replace(/[\s+]/g, '')

      // Prepare form data (application/x-www-form-urlencoded)
      const postData = querystring.stringify({
        token: this.config.token,
        to: formattedPhone,
        body: message,
        priority: '1', // Send immediately
      })

      const url = this.buildEndpoint('messages/chat')

      logger.info('📤 UltraMsg: Sending text message', {
        to: formattedPhone,
        messageLength: message.length,
        url,
      })

      const response = await axios.post(url, postData, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      })

      logger.info('✅ UltraMsg: Message sent successfully', {
        to: formattedPhone,
        responseData: response.data,
      })

      return {
        messageId: response.data?.id || response.data?.msgId || `ultramsg-${Date.now()}`,
        success: true,
      }
    } catch (error: any) {
      logger.error('❌ UltraMsg: Failed to send message', {
        to,
        error: error.message,
        response: error.response?.data,
      })

      return {
        messageId: '',
        success: false,
        error: error.response?.data?.error || error.message,
      }
    }
  }

  /**
   * Send media message (image, video, document)
   * Endpoint: POST /instance{id}/messages/image (or /video, /document)
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

      // Different endpoint based on media type
      const endpoint = mediaType === 'image'
        ? 'messages/image'
        : mediaType === 'video'
        ? 'messages/video'
        : 'messages/document'

      const postData = querystring.stringify({
        token: this.config.token,
        to: formattedPhone,
        [mediaType]: mediaUrl, // "image", "video", or "document"
        caption: caption || '',
        // Pass original filename for document messages so WhatsApp displays the real name
        ...(mediaType === 'document' && filename ? { filename } : {}),
        priority: '1',
      })

      const url = this.buildEndpoint(endpoint)

      logger.info('📤 UltraMsg: Sending media message', {
        to: formattedPhone,
        mediaType,
        mediaUrl,
        url,
      })

      const response = await axios.post(url, postData, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      })

      logger.info('✅ UltraMsg: Media sent successfully', {
        to: formattedPhone,
        mediaType,
        responseData: response.data,
      })

      return {
        messageId: response.data?.id || response.data?.msgId || `ultramsg-${Date.now()}`,
        success: true,
      }
    } catch (error: any) {
      logger.error('❌ UltraMsg: Failed to send media', {
        to,
        mediaType,
        mediaUrl,
        error: error.message,
        response: error.response?.data,
      })

      return {
        messageId: '',
        success: false,
        error: error.response?.data?.error || error.message,
      }
    }
  }

  /**
   * Send a reaction (emoji) to a previously exchanged message.
   * UltraMsg: POST /{instance}/messages/reaction with `token`, `msgId`, `emoji`.
   * Docs: https://docs.ultramsg.com/api/post/messages/reaction
   *
   * `messageId` is the UltraMsg `msgId` of the message being reacted to (the id
   * delivered in inbound webhooks). An empty `emoji` removes a previous reaction.
   * UltraMsg keys the reaction off the message id, so `to` is not needed by the
   * API — it is kept only for interface compatibility.
   */
  async sendReaction(
    _to: string,
    messageId: string,
    emoji: string
  ): Promise<WhatsAppSendMessageResult> {
    try {
      if (!messageId) {
        return { messageId: '', success: false, error: 'UltraMsg: messageId is required for reaction' }
      }

      const postData = querystring.stringify({
        token: this.config.token,
        msgId: messageId,
        emoji: emoji || '', // empty string removes the reaction
      })

      const url = this.buildEndpoint('messages/reaction')

      logger.info('📤 UltraMsg: Sending reaction', { messageId, emoji, url })

      const response = await axios.post(url, postData, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
      })

      logger.info('✅ UltraMsg: Reaction sent', { messageId, responseData: response.data })

      return {
        messageId: response.data?.id || response.data?.msgId || `ultramsg-react-${Date.now()}`,
        success: true,
      }
    } catch (error: any) {
      logger.error('❌ UltraMsg: Failed to send reaction', {
        messageId,
        emoji,
        error: error.message,
        response: error.response?.data,
      })
      return {
        messageId: '',
        success: false,
        error: error.response?.data?.error || error.message,
      }
    }
  }

  /**
   * Download inbound media from UltraMsg.
   * UltraMsg webhooks deliver a direct public media URL (data.media), so a
   * single GET fetches the bytes. MIME comes from the response content-type.
   */
  async downloadInboundMedia(ref: InboundMediaRef): Promise<InboundMediaResult> {
    if (!ref.mediaUrl) {
      throw new Error('UltraMsg: mediaUrl is required to download inbound media')
    }

    const bin = await axios.get(ref.mediaUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    })

    const buffer = Buffer.from(bin.data)
    const mimeType =
      (bin.headers?.['content-type'] as string) || 'application/octet-stream'

    logger.info('📥 UltraMsg: Downloaded inbound media', {
      mimeType,
      sizeBytes: buffer.length,
    })

    return { buffer, mimeType: mimeType.split(';')[0].trim(), sizeBytes: buffer.length }
  }

  /**
   * UltraMsg does NOT support WhatsApp Business Template messages
   * This method is not implemented
   */
  // sendTemplateMessage is intentionally not implemented
  // UltraMsg doesn't support WhatsApp Business API templates
}
