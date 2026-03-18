/**
 * WasenderAPI WhatsApp Provider (Scheduler)
 *
 * Implementation of WhatsAppProvider for WasenderAPI.
 * Used by the scheduler queue job to send outbound messages.
 *
 * AUTH: Per-session API key (Bearer) stored in workspace.wasenderApiKey
 * PHONE FORMAT: E.164 (+39...) → JID format (39...@s.whatsapp.net)
 */

import axios from 'axios'
import logger from '../../utils/logger'
import {
  WhatsAppProvider,
  WhatsAppSendMessageResult,
} from './whatsapp-provider.interface'

export interface WasenderConfig {
  sessionApiKey: string   // workspace.wasenderApiKey
}

export class WasenderWhatsAppProvider implements WhatsAppProvider {
  private readonly baseUrl = 'https://www.wasenderapi.com'

  constructor(private config: WasenderConfig) {
    if (!config.sessionApiKey) {
      throw new Error('WasenderAPI: sessionApiKey is required')
    }
  }

  getProviderName(): string {
    return 'WasenderAPI'
  }

  async sendTextMessage(to: string, body: string): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedTo = to.replace(/^\+/, '') + '@s.whatsapp.net'

      const response = await axios.post(
        `${this.baseUrl}/api/send-message`,
        { to: formattedTo, body },
        {
          headers: {
            Authorization: `Bearer ${this.config.sessionApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      )

      const messageId = response.data?.data?.id || response.data?.id || 'unknown'

      logger.info('[Wasender-Provider] ✅ Text message sent:', {
        to: this.maskPhone(to),
        messageId,
      })

      return { messageId, success: true }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message
      logger.error('[Wasender-Provider] ❌ Failed to send text:', {
        to: this.maskPhone(to),
        error: errMsg,
        status: error.response?.status,
      })
      return {
        messageId: '',
        success: false,
        error: `WasenderAPI send failed: ${errMsg}`,
      }
    }
  }

  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'video' | 'document' = 'image'
  ): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedTo = to.replace(/^\+/, '') + '@s.whatsapp.net'

      const payload =
        mediaType === 'image'
          ? { to: formattedTo, imageUrl: mediaUrl, caption }
          : { to: formattedTo, documentUrl: mediaUrl, caption }

      const response = await axios.post(
        `${this.baseUrl}/api/send-message`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.config.sessionApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      )

      const messageId = response.data?.data?.id || 'unknown'

      logger.info('[Wasender-Provider] ✅ Media message sent:', {
        to: this.maskPhone(to),
        mediaType,
        messageId,
      })

      return { messageId, success: true }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message
      logger.error('[Wasender-Provider] ❌ Failed to send media:', {
        to: this.maskPhone(to),
        mediaType,
        error: errMsg,
      })
      return {
        messageId: '',
        success: false,
        error: `WasenderAPI media send failed: ${errMsg}`,
      }
    }
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length <= 4) return '***'
    return phone.substring(0, 3) + '***' + phone.substring(phone.length - 4)
  }
}
