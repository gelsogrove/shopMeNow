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
  WhatsAppProvider,
  WhatsAppSendMessageResult,
} from './whatsapp-provider.interface'

export interface UltraMsgConfig {
  instanceId: string
  token: string
}

export class UltraMsgWhatsAppProvider implements WhatsAppProvider {
  private readonly baseUrl = 'https://api.ultramsg.com'

  constructor(private config: UltraMsgConfig) {
    if (!config.instanceId || !config.token) {
      throw new Error('UltraMsg: instanceId and token are required')
    }
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

      const url = `${this.baseUrl}/${this.config.instanceId}/messages/chat`

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
    mediaType: 'image' | 'video' | 'document' = 'image'
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
        priority: '1',
      })

      const url = `${this.baseUrl}/${this.config.instanceId}/${endpoint}`

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
   * UltraMsg does NOT support WhatsApp Business Template messages
   * This method is not implemented
   */
  // sendTemplateMessage is intentionally not implemented
  // UltraMsg doesn't support WhatsApp Business API templates
}
