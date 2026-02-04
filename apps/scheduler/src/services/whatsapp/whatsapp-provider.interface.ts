/**
 * WhatsApp Provider Interface
 * 
 * Abstraction layer for WhatsApp messaging providers (Meta, UltraMsg, etc.)
 * Enables multi-provider support with unified API
 * 
 * @architecture Strategy Pattern - each provider implements this interface
 */

export interface WhatsAppSendMessageResult {
  messageId: string
  success: boolean
  error?: string
}

export interface WhatsAppProvider {
  /**
   * Send a text message
   */
  sendTextMessage(
    to: string,
    message: string
  ): Promise<WhatsAppSendMessageResult>

  /**
   * Send a media message (image, video, document)
   */
  sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption?: string,
    mediaType?: 'image' | 'video' | 'document'
  ): Promise<WhatsAppSendMessageResult>

  /**
   * Send a template message (Meta Business API only)
   * Optional - not all providers support templates
   */
  sendTemplateMessage?(
    to: string,
    templateName: string,
    params: string[]
  ): Promise<WhatsAppSendMessageResult>

  /**
   * Get provider name for logging/debugging
   */
  getProviderName(): string
}
