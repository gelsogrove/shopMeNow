// 📎 Persist flow-step media (flow builder Assets) as MessageAttachment rows
// on the saved assistant message — ONE definition for every channel path
// (widget controller, UltraMsg webhook, Meta/Wasender inbound pipeline), so
// the /chat operator view and widget history hydration render the node's
// image/document exactly like operator-sent attachments.
//
// storageKey is deliberately EMPTY: the binary is the flow builder's shared
// Asset on Cloudinary, referenced by every conversation that walks the flow.
// Attachment purgers (customer/session hard-delete) skip empty storageKeys
// (attachment-lifecycle.service: `if (!ref?.storageKey) continue`), so the
// row cascades away with its message while the shared Asset binary survives.
// Asset type "link" is not persisted — it is not a file.

import logger from "../utils/logger"
import { messageAttachmentRepository } from "../repositories/message-attachment.repository"

export interface FlowStepMediaItem {
  url: string
  type: string
  title: string
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
}

function extOf(url: string): string {
  try {
    return new URL(url).pathname.match(/\.[a-z0-9]{2,5}$/i)?.[0]?.toLowerCase() ?? ""
  } catch {
    return ""
  }
}

export async function persistFlowStepMediaAttachments(params: {
  workspaceId: string
  conversationMessageId: string
  media: FlowStepMediaItem[]
}): Promise<void> {
  const { workspaceId, conversationMessageId, media } = params

  for (const item of media) {
    if (item.type !== "image" && item.type !== "video" && item.type !== "document") continue
    try {
      const ext = extOf(item.url)
      await messageAttachmentRepository.create({
        conversationMessageId,
        workspaceId,
        kind: item.type === "image" ? "IMAGE" : "DOCUMENT",
        url: item.url,
        storageKey: "",
        mimeType:
          MIME_BY_EXT[ext] ?? (item.type === "image" ? "image/jpeg" : "application/octet-stream"),
        filename: ext && !item.title.toLowerCase().endsWith(ext) ? `${item.title}${ext}` : item.title,
        sizeBytes: 0,
      })
    } catch (persistError) {
      logger.error("[FLOW-STEP-MEDIA] ❌ Failed to persist attachment row", {
        error: persistError instanceof Error ? persistError.message : String(persistError),
        url: item.url,
        workspaceId,
      })
    }
  }
}
