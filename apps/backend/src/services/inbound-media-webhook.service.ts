/**
 * Inbound media — webhook wiring
 *
 * Thin glue between the WhatsApp webhook controllers (Meta / UltraMsg / Wasender)
 * and the provider-agnostic ingestion pipeline (`inbound-media.service.ts`).
 *
 * The webhook payload carries the media REFERENCE (a Meta media-id or a direct
 * URL); the inbound ConversationMessage (role="user") is persisted by the chat
 * engine while routing. This helper runs AFTER routing, inside the per-customer
 * webhook lock, so "the latest user message for this conversation" is reliably
 * the message we just processed — that is the row the attachment is linked to.
 *
 * FAIL-SAFE: this never throws. A media problem (download/upload/db) must never
 * break the text-message pipeline (plan §4, §11). Worst case: the text arrives,
 * the attachment doesn't.
 *
 * See docs/media-attachments-plan.md §4.
 */

import { prisma } from "../lib/prisma"
import logger from "../utils/logger"
import { WhatsAppProviderFactory } from "./whatsapp/whatsapp-provider.factory"
import { storageService } from "./storage.service"
import { messageAttachmentRepository } from "../repositories/message-attachment.repository"
import { ingestInboundMedia } from "./inbound-media.service"
import { ExtractedMedia } from "./webhook-media.extract"

export interface IngestWebhookMediaParams {
  workspaceId: string
  /** ChatSession id == ConversationMessage.conversationId */
  conversationId: string
  media: ExtractedMedia
}

/**
 * Download → validate → store → persist one inbound media item, linking it to
 * the last user message of the conversation. Returns the created attachment id,
 * or null when nothing was ingested (not configured, no message, or any error).
 */
export async function ingestInboundWebhookMedia(
  params: IngestWebhookMediaParams
): Promise<string | null> {
  const { workspaceId, conversationId, media } = params
  try {
    // The provider (and its credentials) live on the Workspace row; the factory
    // builds the right downloader for whichever provider the workspace uses.
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    })
    if (!workspace) {
      logger.warn("[inbound-media-webhook] workspace not found", { workspaceId })
      return null
    }
    if (!WhatsAppProviderFactory.isConfigured(workspace)) {
      logger.warn("[inbound-media-webhook] provider not configured — skipping media", {
        workspaceId,
      })
      return null
    }

    // The inbound user message just saved by the chat engine while routing.
    const userMessage = await prisma.conversationMessage.findFirst({
      where: { conversationId, workspaceId, role: "user" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    if (!userMessage) {
      logger.warn("[inbound-media-webhook] no inbound message to attach media to", {
        workspaceId,
        conversationId,
      })
      return null
    }

    const provider = WhatsAppProviderFactory.create(workspace)

    const result = await ingestInboundMedia(
      {
        provider,
        storage: storageService,
        repository: messageAttachmentRepository,
        logger,
      },
      {
        workspaceId,
        chatSessionId: conversationId,
        conversationMessageId: userMessage.id,
        ref: media.ref,
        filename: media.filename ?? null,
        waMediaId: media.waMediaId ?? null,
      }
    )

    if (!result.ok || !result.attachment) {
      logger.warn("[inbound-media-webhook] ingestion rejected", {
        workspaceId,
        conversationId,
        error: result.error,
      })
      return null
    }

    logger.info("[inbound-media-webhook] attachment saved", {
      workspaceId,
      conversationId,
      attachmentId: result.attachment.id,
      kind: result.attachment.kind,
    })
    return result.attachment.id
  } catch (err) {
    // Fail-safe: never break the text pipeline.
    logger.error("[inbound-media-webhook] unexpected failure", {
      workspaceId,
      conversationId,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
