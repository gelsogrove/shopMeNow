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
   * Send media message via Meta Business API
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'video' | 'document' = 'image'
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
