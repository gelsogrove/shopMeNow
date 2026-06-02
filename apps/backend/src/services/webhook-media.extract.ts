/**
 * Webhook media extraction
 *
 * Normalises the provider-specific inbound webhook payloads into a single
 * shape the ingestion pipeline understands. Pure + testable — no I/O. Each
 * provider exposes media differently:
 *
 *   - Meta:     message.type ∈ {image,document,...}; message[type] = { id,
 *               mime_type, caption?, filename? } → ref.mediaId
 *   - UltraMsg: data.type ∈ {image,document}; data.media is a direct URL;
 *               data.caption / data.filename → ref.mediaUrl
 *   - Wasender: message.message.imageMessage|documentMessage = { url, mimetype,
 *               fileName?, caption? } → ref.mediaUrl
 *
 * Returns null when the message carries no (supported) media, so the caller
 * simply continues with the existing text path. We only surface image/document
 * here (the chat feature's scope); audio/video/sticker are ignored.
 *
 * See docs/media-attachments-plan.md §4.
 */

import { InboundMediaRef } from "./whatsapp/whatsapp-provider.interface"

export interface ExtractedMedia {
  kind: "IMAGE" | "DOCUMENT"
  ref: InboundMediaRef
  declaredMime?: string
  filename?: string
  caption?: string
  waMediaId?: string
}

const SUPPORTED_TYPES = ["image", "document"] as const

function kindFromType(type: string): "IMAGE" | "DOCUMENT" | null {
  if (type === "image") return "IMAGE"
  if (type === "document") return "DOCUMENT"
  return null
}

/** Meta Cloud API inbound message → media (uses media id). */
export function extractMetaMedia(message: any): ExtractedMedia | null {
  const type = message?.type
  const kind = kindFromType(type)
  if (!kind) return null

  const media = message[type]
  if (!media?.id) return null

  return {
    kind,
    ref: { mediaId: media.id },
    declaredMime: media.mime_type,
    filename: media.filename,
    caption: media.caption,
    waMediaId: media.id,
  }
}

/** UltraMsg inbound payload (data.*) → media (uses direct URL). */
export function extractUltramsgMedia(data: any): ExtractedMedia | null {
  const type = data?.type
  const kind = kindFromType(type)
  if (!kind) return null

  const url = data.media || data.body
  if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) return null

  return {
    kind,
    ref: { mediaUrl: url },
    filename: data.filename,
    caption: data.caption,
  }
}

/** Wasender inbound message → media (uses direct URL). */
export function extractWasenderMedia(message: any): ExtractedMedia | null {
  const inner = message?.message
  if (!inner) return null

  if (inner.imageMessage?.url) {
    return {
      kind: "IMAGE",
      ref: { mediaUrl: inner.imageMessage.url },
      declaredMime: inner.imageMessage.mimetype,
      caption: inner.imageMessage.caption,
    }
  }
  if (inner.documentMessage?.url) {
    return {
      kind: "DOCUMENT",
      ref: { mediaUrl: inner.documentMessage.url },
      declaredMime: inner.documentMessage.mimetype,
      filename: inner.documentMessage.fileName,
      caption: inner.documentMessage.caption,
    }
  }
  return null
}

export const SUPPORTED_MEDIA_TYPES = SUPPORTED_TYPES
