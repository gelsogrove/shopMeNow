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

/**
 * Reference to an inbound media item, as found in a provider's webhook payload.
 * Meta delivers a `mediaId` (resolve → download with auth); UltraMsg/Wasender
 * deliver a direct `mediaUrl`. Either may be present depending on the provider.
 */
export interface InboundMediaRef {
  mediaId?: string
  mediaUrl?: string
}

/** The downloaded binary plus what we could learn about it from the provider. */
export interface InboundMediaResult {
  buffer: Buffer
  mimeType: string
  filename?: string
  sizeBytes: number
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
    mediaType?: 'image' | 'video' | 'document',
    filename?: string
  ): Promise<WhatsAppSendMessageResult>

  /**
   * Download an inbound media item referenced in a webhook payload.
   * Optional - implemented by providers that support receiving media.
   * Returns the raw bytes + best-known MIME type so the ingestion pipeline can
   * validate (magic-byte sniff + size) and re-archive it on our own storage.
   */
  downloadInboundMedia?(ref: InboundMediaRef): Promise<InboundMediaResult>

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
   * Send a reaction (emoji) to a specific previously exchanged message.
   * Optional - not all providers support reactions. `messageId` is the
   * provider's id of the message being reacted to. An empty `emoji` removes a
   * previously sent reaction (per the WhatsApp Cloud API contract).
   */
  sendReaction?(
    to: string,
    messageId: string,
    emoji: string
  ): Promise<WhatsAppSendMessageResult>

  /**
   * Show a "typing…" indicator to the recipient while the bot composes a reply.
   * Optional - not all providers support it. Implementations MUST be
   * fire-and-forget safe (never throw, swallow their own errors).
   *
   * `inboundMessageId` is the provider's id of the message being replied to.
   * Meta requires it (the indicator is attached to marking that message as read);
   * presence-based providers ignore it.
   */
  sendTypingIndicator?(
    to: string,
    inboundMessageId?: string
  ): Promise<void>

  /**
   * Get provider name for logging/debugging
   */
  getProviderName(): string
}
