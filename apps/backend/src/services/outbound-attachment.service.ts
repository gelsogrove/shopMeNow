/**
 * Outbound attachment send
 *
 * Sends an already-stored attachment (image / PDF) from the operator to the
 * customer. Branches on channel and on the "active" gate:
 *
 *   - active === false           → do nothing (no send). Implements Andrea's
 *                                  rule "if active is false it neither receives
 *                                  nor sends anything". The CALLER computes
 *                                  `active` from the relevant flag and passes it
 *                                  in, so this module is decoupled from which
 *                                  flag governs (plan §7).
 *   - channel === 'widget'       → persist only; the widget renders via polling,
 *                                  there is no WhatsApp send.
 *   - channel === 'whatsapp'     → send via the active provider's
 *                                  sendMediaMessage(), using a PUBLIC url the
 *                                  provider can fetch (plan §5).
 *
 * Injected collaborators keep it unit-testable without a real provider, DB, or
 * network. Never throws: returns a structured result.
 *
 * See docs/media-attachments-plan.md §5, §6, §7.
 */

import { WhatsAppSendMessageResult } from "./whatsapp/whatsapp-provider.interface"

export type Channel = "whatsapp" | "widget" | "playground"
export type AttachmentKind = "IMAGE" | "DOCUMENT" | "AUDIO"

export interface OutboundProvider {
  sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption?: string,
    mediaType?: "image" | "video" | "document",
    filename?: string
  ): Promise<WhatsAppSendMessageResult>
}

export interface OutboundAttachment {
  kind: AttachmentKind
  /** A URL the provider can fetch (public or signed). For widget this is unused. */
  publicUrl: string
  /** Original filename — passed to the provider for document messages so WhatsApp displays the real name. */
  filename?: string
}

export interface SendOperatorAttachmentInput {
  active: boolean
  channel: Channel
  to: string
  attachment: OutboundAttachment
  caption?: string
}

export interface SendOperatorAttachmentResult {
  ok: boolean
  /** true when the file actually left over WhatsApp; false for widget/skipped. */
  sent: boolean
  skipped?: "inactive"
  providerMessageId?: string
  error?: string
}

export interface SendDeps {
  provider?: OutboundProvider
  logger?: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void }
}

/** Map our attachment kind to the provider's mediaType. */
function providerMediaType(kind: AttachmentKind): "image" | "document" {
  return kind === "IMAGE" ? "image" : "document"
}

export async function sendOperatorAttachment(
  deps: SendDeps,
  input: SendOperatorAttachmentInput
): Promise<SendOperatorAttachmentResult> {
  // Gate: inactive channel → neither send nor error noise.
  if (!input.active) {
    deps.logger?.info?.("[outbound-attachment] skipped: channel inactive")
    return { ok: true, sent: false, skipped: "inactive" }
  }

  // Widget / playground: no provider send — the message + attachment row are
  // persisted by the caller and the widget renders them via polling.
  if (input.channel !== "whatsapp") {
    return { ok: true, sent: false }
  }

  // WhatsApp: send via the active provider.
  if (!deps.provider) {
    return { ok: false, sent: false, error: "no_provider_configured" }
  }
  if (!input.attachment.publicUrl) {
    return { ok: false, sent: false, error: "missing_public_url" }
  }

  try {
    const result = await deps.provider.sendMediaMessage(
      input.to,
      input.attachment.publicUrl,
      input.caption,
      providerMediaType(input.attachment.kind),
      input.attachment.filename
    )
    if (!result.success) {
      return { ok: false, sent: false, error: result.error || "provider_send_failed" }
    }
    return { ok: true, sent: true, providerMessageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    deps.logger?.error?.(`[outbound-attachment] send failed: ${msg}`)
    return { ok: false, sent: false, error: msg }
  }
}
