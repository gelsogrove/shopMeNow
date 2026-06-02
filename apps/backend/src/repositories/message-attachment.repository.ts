/**
 * MessageAttachment repository
 *
 * Data-access layer for chat message attachments. Anchored to
 * ConversationMessage (the LIVE chat table the UI reads/writes), NOT the legacy
 * Message model. Used by:
 *  - the inbound ingestion pipeline (create)
 *  - the operator/widget upload endpoint (create)
 *  - message rendering hydration (listByConversationMessageIds)
 *  - the lifecycle/deletion flows (findStorageRefsBy*) — fetch storageKeys
 *    BEFORE the parent conversation messages are deleted, so the binaries can
 *    be purged.
 *
 * NOTE: requires `prisma generate` after the MessageAttachment migration so the
 * `prisma.messageAttachment` delegate is typed.
 */

import { prisma } from "@echatbot/database"

export type AttachmentKind = "IMAGE" | "DOCUMENT"

export interface NewAttachmentRow {
  conversationMessageId: string
  workspaceId: string
  kind: AttachmentKind
  url: string
  storageKey: string
  mimeType: string
  filename?: string | null
  sizeBytes: number
  waMediaId?: string | null
}

export interface StorageRef {
  storageKey: string
  kind: AttachmentKind
}

export interface AttachmentView {
  id: string
  conversationMessageId: string
  kind: AttachmentKind
  url: string
  mimeType: string
  filename: string | null
  sizeBytes: number
  width: number | null
  height: number | null
  createdAt: Date
}

class MessageAttachmentRepository {
  async create(row: NewAttachmentRow): Promise<{ id: string }> {
    const created = await prisma.messageAttachment.create({
      data: {
        conversationMessageId: row.conversationMessageId,
        workspaceId: row.workspaceId,
        kind: row.kind as any,
        url: row.url,
        storageKey: row.storageKey,
        mimeType: row.mimeType,
        filename: row.filename ?? null,
        sizeBytes: row.sizeBytes,
        waMediaId: row.waMediaId ?? null,
      },
      select: { id: true },
    })
    return created
  }

  /** Attachments for a set of conversation messages (for rendering). */
  async listByConversationMessageIds(ids: string[]): Promise<AttachmentView[]> {
    if (ids.length === 0) return []
    const rows = await prisma.messageAttachment.findMany({
      where: { conversationMessageId: { in: ids } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        conversationMessageId: true,
        kind: true,
        url: true,
        mimeType: true,
        filename: true,
        sizeBytes: true,
        width: true,
        height: true,
        createdAt: true,
      },
    })
    return rows as unknown as AttachmentView[]
  }

  /** storageKeys for a chat session — fetch BEFORE deleting its messages. */
  async findStorageRefsByChatSessionId(chatSessionId: string): Promise<StorageRef[]> {
    const rows = await prisma.messageAttachment.findMany({
      where: { conversationMessage: { conversationId: chatSessionId } },
      select: { storageKey: true, kind: true },
    })
    return rows as unknown as StorageRef[]
  }

  /** storageKeys for all of a customer's messages — fetch BEFORE deletion. */
  async findStorageRefsByCustomerId(customerId: string): Promise<StorageRef[]> {
    const rows = await prisma.messageAttachment.findMany({
      where: { conversationMessage: { customerId } },
      select: { storageKey: true, kind: true },
    })
    return rows as unknown as StorageRef[]
  }
}

export const messageAttachmentRepository = new MessageAttachmentRepository()
