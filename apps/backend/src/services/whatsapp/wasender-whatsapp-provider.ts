/**
 * WasenderAPI WhatsApp Provider
 *
 * Implementation of WhatsAppProvider for WasenderAPI.
 * Docs: https://wasenderapi.com/api-docs/messages/send-text-message
 *
 * @architecture Strategy Pattern implementation
 *
 * AUTH: Per-session API key (Bearer) — different from Personal Access Token.
 *       Stored in workspace.wasenderApiKey, set at session creation.
 *
 * PHONE FORMAT: WasenderAPI expects JID format: "{number}@s.whatsapp.net"
 *   Input: "+393331234567"  →  "393331234567@s.whatsapp.net"
 */

import axios from 'axios'
import logger from '../../utils/logger'
import {
  InboundMediaRef,
  InboundMediaResult,
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

  /**
   * Send a text message via WasenderAPI.
   *
   * @param to   Phone number in E.164 format (+39...)
   * @param body Message text
   */
  async sendTextMessage(to: string, body: string): Promise<WhatsAppSendMessageResult> {
    try {
      // Format: strip + prefix, append @s.whatsapp.net (JID format)
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

  /**
   * Send a media message (image / video / document).
   * WasenderAPI delivers every media kind via the single /api/send-message
   * endpoint; the media TYPE is selected by which URL field is set
   * (imageUrl | videoUrl | documentUrl), mirroring Meta/UltraMsg behaviour so a
   * provider switch is transparent.
   *
   * @param to        Phone number in E.164 format
   * @param mediaUrl  Public URL of the media file
   * @param caption   Optional caption text
   * @param mediaType image | video | document
   * @param filename  Original file name — sent for documents so WhatsApp shows
   *                  the real name instead of "Untitled"
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'video' | 'document' = 'image',
    filename?: string
  ): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedTo = to.replace(/^\+/, '') + '@s.whatsapp.net'

      // Pick the URL field by media kind. Video must go through videoUrl (NOT
      // documentUrl) so it arrives as a playable video; documents carry the
      // original fileName.
      const payload: Record<string, any> =
        mediaType === 'image'
          ? { to: formattedTo, imageUrl: mediaUrl, caption }
          : mediaType === 'video'
            ? { to: formattedTo, videoUrl: mediaUrl, caption }
            : {
                to: formattedTo,
                documentUrl: mediaUrl,
                caption,
                ...(filename ? { fileName: filename } : {}),
              }

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

  /**
   * Download inbound media from WasenderAPI.
   * Wasender webhooks deliver a direct media URL; a single GET fetches the
   * bytes. MIME comes from the response content-type.
   */
  async downloadInboundMedia(ref: InboundMediaRef): Promise<InboundMediaResult> {
    if (!ref.mediaUrl) {
      throw new Error('WasenderAPI: mediaUrl is required to download inbound media')
    }

    const bin = await axios.get(ref.mediaUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    })

    const buffer = Buffer.from(bin.data)
    const mimeType =
      (bin.headers?.['content-type'] as string) || 'application/octet-stream'

    logger.info('[Wasender-Provider] 📥 Downloaded inbound media:', {
      mimeType,
      sizeBytes: buffer.length,
    })

    return { buffer, mimeType: mimeType.split(';')[0].trim(), sizeBytes: buffer.length }
  }

  /**
   * Send a reaction emoji onto a customer's WhatsApp message.
   * WasenderAPI endpoint: POST /api/send-reaction
   * Empty emoji removes the previous reaction.
   *
   * @param to          Customer phone in E.164 format
   * @param messageId   Provider wamid of the message being reacted to
   * @param emoji       Reaction emoji ('' to remove)
   */
  async sendReaction(to: string, messageId: string, emoji: string): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedTo = to.replace(/^\+/, '') + '@s.whatsapp.net'
      const response = await axios.post(
        `${this.baseUrl}/api/send-reaction`,
        { to: formattedTo, messageId, emoji },
        {
          headers: {
            Authorization: `Bearer ${this.config.sessionApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      )
      const id = response.data?.data?.id || response.data?.id || 'unknown'
      logger.info('[Wasender-Provider] ✅ Reaction sent:', {
        to: this.maskPhone(to),
        emoji,
        messageId,
        id,
      })
      return { messageId: id, success: true }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message
      logger.error('[Wasender-Provider] ❌ Failed to send reaction:', {
        to: this.maskPhone(to),
        emoji,
        error: errMsg,
      })
      return { messageId: '', success: false, error: `WasenderAPI reaction failed: ${errMsg}` }
    }
  }

  /**
   * Show the "typing…" indicator to the customer while the bot composes a reply.
   * WasenderAPI: POST /api/send-presence-update with presence "composing".
   * Fire-and-forget: never throws, swallows its own errors so it can never block
   * the reply path. WhatsApp auto-clears the indicator when the next message is
   * sent, so no refresh loop is needed.
   *
   * @param to                customer phone in E.164 format
   * @param _inboundMessageId unused (Wasender keys presence off the JID, not a
   *                          message id) — kept for interface compatibility
   */
  async sendTypingIndicator(to: string, _inboundMessageId?: string): Promise<void> {
    try {
      if (!to) return
      const formattedTo = to.replace(/^\+/, '') + '@s.whatsapp.net'
      await axios.post(
        `${this.baseUrl}/api/send-presence-update`,
        { to: formattedTo, presence: 'composing' },
        {
          headers: { Authorization: `Bearer ${this.config.sessionApiKey}`, 'Content-Type': 'application/json' },
          timeout: 8000,
        }
      )
      logger.debug('[Wasender-Provider] ⌨️ Typing indicator sent', { to: this.maskPhone(to) })
    } catch (error: any) {
      // Non-critical — must never block the reply.
      logger.debug('[Wasender-Provider] ⌨️ Typing indicator failed (non-critical)', {
        to: this.maskPhone(to),
        error: error.response?.data?.message || error.message,
      })
    }
  }

  async sendAudioMessage(to: string, audioUrl: string): Promise<WhatsAppSendMessageResult> {
    try {
      const formattedTo = to.replace(/^\+/, '') + '@s.whatsapp.net'
      const response = await axios.post(
        `${this.baseUrl}/api/send-message`,
        { to: formattedTo, audioUrl },
        {
          headers: { Authorization: `Bearer ${this.config.sessionApiKey}`, 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      )
      const messageId = response.data?.data?.id || 'unknown'
      logger.info('[Wasender-Provider] ✅ Audio sent', { to: this.maskPhone(to), messageId })
      return { messageId, success: true }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message
      logger.error('[Wasender-Provider] ❌ Failed to send audio', { to: this.maskPhone(to), error: errMsg })
      return { messageId: '', success: false, error: `WasenderAPI audio send failed: ${errMsg}` }
    }
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length <= 4) return '***'
    return phone.substring(0, 3) + '***' + phone.substring(phone.length - 4)
  }
}
