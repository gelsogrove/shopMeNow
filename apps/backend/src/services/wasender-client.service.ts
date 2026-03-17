/**
 * WasenderAPI Client Service
 *
 * Manages WhatsApp sessions via WasenderAPI REST API.
 * Provider: https://wasenderapi.com ($4.50–6/session/month)
 *
 * ARCHITECTURE:
 * - Personal Access Token (env: WASENDER_PERSONAL_ACCESS_TOKEN) → session CRUD
 * - Per-session api_key → message sending (stored in workspace.wasenderApiKey)
 *
 * TWO-STEP QR FLOW:
 * 1. createSession() → returns { sessionId, apiKey }
 * 2. connectSession(sessionId) → returns qrString (or 'already_connected')
 * 3. QR updates via webhook (qrcode.updated event) OR poll getQrCode()
 */

import axios, { AxiosInstance } from 'axios'
import logger from '../utils/logger'

// ─── Response interfaces ────────────────────────────────────────────────────

interface WasenderCreateSessionResponse {
  success: boolean
  data: {
    id: number        // numeric session ID
    api_key: string   // per-session key for messaging
    webhook_secret?: string
    status?: string
  }
}

interface WasenderConnectResponse {
  success: boolean
  data: {
    status: string  // 'NEED_SCAN' | 'ALREADY_CONNECTED'
    qrCode?: string // raw QR string (expires after 45s)
  }
}

interface WasenderQrResponse {
  success: boolean
  data: {
    qrCode: string  // raw QR string (NOT base64 image)
  }
}

interface WasenderSessionStatusResponse {
  success: boolean
  data: {
    status: string  // 'connected' | 'disconnected' | 'CONNECTING' | 'need_scan'
    id: number
  }
}

export interface WasenderSessionInfo {
  sessionId: string   // numeric ID as string
  apiKey: string      // per-session API key for messaging
  qrString: string | null
  status: string
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class WasenderClientService {
  private readonly baseUrl = 'https://www.wasenderapi.com'
  private managementClient: AxiosInstance   // auth: Personal Access Token

  constructor() {
    this.managementClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${process.env.WASENDER_PERSONAL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    // Log requests (mask token in headers)
    this.managementClient.interceptors.request.use((config) => {
      logger.info('[Wasender-Client] Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data,
      })
      return config
    })

    this.managementClient.interceptors.response.use(
      (response) => {
        logger.info('[Wasender-Client] Response:', {
          status: response.status,
          data: response.data,
        })
        return response
      },
      (error) => {
        logger.error('[Wasender-Client] Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        })
        throw error
      }
    )
  }

  // ─── Session Management (Personal Access Token) ───────────────────────────

  /**
   * Create a new WhatsApp session.
   * Must call connectSession() next to start QR flow.
   *
   * @param workspaceId  Used as session name for identification
   * @param phoneNumber  Customer WhatsApp number (E.164, optional - can be blank for QR)
   * @param webhookUrl   URL where WasenderAPI will POST webhook events
   * @returns sessionId (string) + apiKey (per-session, for messaging)
   */
  async createSession(
    workspaceId: string,
    phoneNumber: string,
    webhookUrl: string
  ): Promise<{ sessionId: string; apiKey: string }> {
    try {
      // WasenderAPI expects E.164 format with + prefix (e.g. "+34602119358")
      // Strip spaces/dashes but keep the leading +
      // Omit entirely if blank or too short — phone_number is optional for QR-based sessions
      const phoneFormatted = phoneNumber?.replace(/[^\d+]/g, '') || ''

      // Webhook URL must be a complete https URL — guard against misconfigured env
      const safeWebhookUrl = webhookUrl.startsWith('http') ? webhookUrl : null

      const { data } = await this.managementClient.post<WasenderCreateSessionResponse>(
        '/api/whatsapp-sessions',
        {
          name: `echatbot-${workspaceId}`,
          account_protection: true,    // required boolean
          log_messages: false,         // required boolean
          ...(phoneFormatted.length >= 8 && { phone_number: phoneFormatted }),
          ...(safeWebhookUrl && {
            webhook_url: safeWebhookUrl,
            webhook_enabled: true,
            webhook_events: ['messages.received', 'session.status', 'qr.code.updated'],
          }),
        }
      )

      const sessionId = String(data.data.id)
      const apiKey = data.data.api_key

      logger.info('[Wasender] Session created:', {
        sessionId,
        workspaceId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
      })

      return { sessionId, apiKey }
    } catch (error: any) {
      const status = error.response?.status
      logger.error('[Wasender] Failed to create session:', { status, data: error.response?.data })

      // 402 = plan limit exceeded (no more sessions available on Wasender account)
      if (status === 402) {
        throw new Error('WASENDER_PLAN_LIMIT: Your WasenderAPI plan has reached the maximum number of sessions. Upgrade your WasenderAPI plan at wasenderapi.com to add more channels.')
      }
      // 401 = invalid or expired Personal Access Token
      if (status === 401) {
        throw new Error('WASENDER_AUTH_ERROR: Invalid or expired WasenderAPI Personal Access Token. Check your WASENDER_PERSONAL_ACCESS_TOKEN configuration.')
      }
      // 422 = validation error — expose full response body for debugging
      if (status === 422) {
        const detail = JSON.stringify(error.response?.data)
        throw new Error(`WasenderAPI session creation failed (422 Unprocessable): ${detail}`)
      }
      throw new Error(`WasenderAPI session creation failed: ${error.message}`)
    }
  }

  /**
   * Initiate connection — MUST be called after createSession().
   * Returns QR string directly if phone needs scan.
   *
   * @param sessionId  Numeric session ID (as string)
   * @returns qrString if phone needs scan, null if already connected
   */
  async connectSession(sessionId: string): Promise<string | null> {
    try {
      const { data } = await this.managementClient.post<WasenderConnectResponse>(
        `/api/whatsapp-sessions/${sessionId}/connect`
      )

      const status = data.data.status?.toUpperCase()

      if (status === 'NEED_SCAN' && data.data.qrCode) {
        logger.info('[Wasender] Session needs QR scan:', { sessionId })
        return data.data.qrCode
      }

      // Already connected (no QR needed)
      logger.info('[Wasender] Session already connected:', { sessionId })
      return null
    } catch (error: any) {
      logger.error('[Wasender] Failed to connect session:', error)
      throw new Error(`WasenderAPI connect failed: ${error.message}`)
    }
  }

  /**
   * Get fresh QR code (call if previous QR expired — expires after 45s).
   *
   * @param sessionId  Numeric session ID (as string)
   * @returns raw QR string — use qrcode library on frontend to render as image
   */
  async getQrCode(sessionId: string): Promise<string> {
    try {
      const { data } = await this.managementClient.get<WasenderQrResponse>(
        `/api/whatsapp-sessions/${sessionId}/qrcode`
      )

      logger.info('[Wasender] QR code fetched:', { sessionId })
      return data.data.qrCode
    } catch (error: any) {
      logger.error('[Wasender] Failed to get QR code:', error)
      throw new Error(`WasenderAPI QR retrieval failed: ${error.message}`)
    }
  }

  /**
   * Get session connection status.
   *
   * @param sessionId  Numeric session ID (as string)
   */
  async getSessionStatus(sessionId: string): Promise<string> {
    try {
      const { data } = await this.managementClient.get<WasenderSessionStatusResponse>(
        `/api/whatsapp-sessions/${sessionId}`
      )
      return data.data.status?.toLowerCase() || 'unknown'
    } catch (error: any) {
      logger.error('[Wasender] Failed to get session status:', error)
      throw new Error(`WasenderAPI status check failed: ${error.message}`)
    }
  }

  /**
   * Disconnect a session (pause, keeps session record).
   * Client's phone disconnects from WasenderAPI but session can be reconnected.
   *
   * @param sessionId  Numeric session ID (as string)
   */
  async disconnectSession(sessionId: string): Promise<void> {
    try {
      await this.managementClient.post(`/api/whatsapp-sessions/${sessionId}/disconnect`)
      logger.info('[Wasender] Session disconnected:', { sessionId })
    } catch (error: any) {
      logger.error('[Wasender] Failed to disconnect session:', error)
      throw new Error(`WasenderAPI disconnect failed: ${error.message}`)
    }
  }

  /**
   * Permanently delete a session.
   * Auto-disconnects phone first if connected. IRREVERSIBLE.
   * Call when workspace is deleted or provider is switched.
   *
   * @param sessionId  Numeric session ID (as string)
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.managementClient.delete(`/api/whatsapp-sessions/${sessionId}`)
      logger.info('[Wasender] Session deleted:', { sessionId })
    } catch (error: any) {
      // 404 means already deleted — treat as success
      if (error.response?.status === 404) {
        logger.warn('[Wasender] Session already deleted or not found:', { sessionId })
        return
      }
      logger.error('[Wasender] Failed to delete session:', error)
      throw new Error(`WasenderAPI deletion failed: ${error.message}`)
    }
  }

  // ─── Messaging (Session API Key) ─────────────────────────────────────────

  /**
   * Send a text message via WasenderAPI.
   * Uses per-session api_key for auth (NOT the Personal Access Token).
   *
   * @param sessionApiKey  The workspace.wasenderApiKey
   * @param to             Phone number in E.164 format (+39...)
   * @param body           Message text
   * @returns messageId from WasenderAPI
   */
  async sendTextMessage(
    sessionApiKey: string,
    to: string,
    body: string
  ): Promise<string> {
    try {
      // Format: remove + prefix, append @s.whatsapp.net
      const formattedTo = to.replace(/^\+/, '') + '@s.whatsapp.net'

      const client = axios.create({
        baseURL: this.baseUrl,
        headers: {
          Authorization: `Bearer ${sessionApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      })

      const { data } = await client.post('/api/send-message', {
        to: formattedTo,
        body,
      })

      const messageId = data?.data?.id || data?.id || 'unknown'
      logger.info('[Wasender] Message sent:', {
        to: this.maskPhoneNumber(to),
        messageId,
      })

      return messageId
    } catch (error: any) {
      logger.error('[Wasender] Failed to send message:', {
        to: this.maskPhoneNumber(to),
        error: error.response?.data || error.message,
      })
      throw new Error(`WasenderAPI send message failed: ${error.message}`)
    }
  }

  // ─── Presence & Read (Session API Key) ────────────────────────────────────

  /**
   * Send a presence update ("typing...", "recording...") to a recipient.
   * Used to show the bot is "composing" a reply while the LLM processes.
   *
   * Call with 'composing' before LLM, 'paused' after — all fire & forget.
   *
   * @param sessionApiKey  workspace.wasenderApiKey
   * @param to             JID: e.g. "1234567890@s.whatsapp.net"
   * @param presence       'composing' | 'paused' | 'recording'
   */
  async sendPresenceUpdate(
    sessionApiKey: string,
    to: string,
    presence: 'composing' | 'paused' | 'recording'
  ): Promise<void> {
    try {
      const client = axios.create({
        baseURL: this.baseUrl,
        headers: { Authorization: `Bearer ${sessionApiKey}`, 'Content-Type': 'application/json' },
        timeout: 8000,
      })
      await client.post('/api/send-presence-update', { to, presence })
      logger.debug('[Wasender] Presence update sent:', { to: to.substring(0, 6) + '***', presence })
    } catch (error: any) {
      // Non-critical — just log at debug level
      logger.debug('[Wasender] Presence update failed (non-critical):', error.message)
    }
  }

  /**
   * Mark a received message as read (sends blue ticks to the sender).
   * Call immediately after receiving a message before LLM processing.
   *
   * @param sessionApiKey  workspace.wasenderApiKey
   * @param messageId      key.id from the webhook payload
   * @param remoteJid      key.remoteJid from the webhook payload (e.g. "1234@s.whatsapp.net")
   */
  async markMessageAsRead(
    sessionApiKey: string,
    messageId: string,
    remoteJid: string
  ): Promise<void> {
    try {
      const client = axios.create({
        baseURL: this.baseUrl,
        headers: { Authorization: `Bearer ${sessionApiKey}`, 'Content-Type': 'application/json' },
        timeout: 8000,
      })
      await client.post('/api/messages/read', { messageId, phoneNumber: remoteJid })
      logger.debug('[Wasender] Message marked as read:', { messageId: messageId.substring(0, 8) + '...' })
    } catch (error: any) {
      logger.debug('[Wasender] Mark as read failed (non-critical):', error.message)
    }
  }

  // ─── Session Restart (Personal Access Token) ─────────────────────────────

  /**
   * Restart an active WhatsApp session.
   * Useful to recover from stuck states without a full QR re-scan.
   *
   * @param sessionId  Numeric session ID (as string)
   */
  async restartSession(sessionId: string): Promise<void> {
    try {
      await this.managementClient.post(`/api/whatsapp-sessions/${sessionId}/restart`)
      logger.info('[Wasender] Session restarted:', { sessionId })
    } catch (error: any) {
      logger.error('[Wasender] Failed to restart session:', error)
      throw new Error(`WasenderAPI restart failed: ${error.message}`)
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Mask phone number for logging (PII protection).
   */
  private maskPhoneNumber(phone: string): string {
    if (!phone || phone.length <= 4) return '***'
    return phone.substring(0, 3) + '***' + phone.substring(phone.length - 4)
  }
}
