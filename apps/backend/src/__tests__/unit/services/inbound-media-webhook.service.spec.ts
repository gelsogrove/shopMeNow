/**
 * Unit tests — inbound media webhook helper.
 *
 * WHAT: ingestInboundWebhookMedia() is the glue the 3 webhook controllers call.
 * It must (a) link the attachment to the LATEST inbound user message of the
 * conversation, (b) skip cleanly when the workspace/provider is not ready or no
 * message exists, and (c) NEVER throw — a media failure must not break the text
 * reply (plan §4, §11).
 * WHY: this is the single seam every provider shares, so its contract guards the
 * whole inbound-media feature.
 */

import { ingestInboundWebhookMedia } from "../../../services/inbound-media-webhook.service"
import { WhatsAppProviderFactory } from "../../../services/whatsapp/whatsapp-provider.factory"
import { ingestInboundMedia } from "../../../services/inbound-media.service"
import { prisma } from "../../../lib/prisma"

// Prisma is mocked: we only need workspace.findUnique + conversationMessage.findFirst.
jest.mock("../../../lib/prisma", () => ({
  prisma: {
    workspace: { findUnique: jest.fn() },
    conversationMessage: { findFirst: jest.fn() },
  },
}))
jest.mock("../../../services/whatsapp/whatsapp-provider.factory")
// The real ingestion pipeline is tested elsewhere; here we assert it is CALLED
// with the right linkage, so we mock it.
jest.mock("../../../services/inbound-media.service")
// These are only passed through to the (mocked) ingest call.
jest.mock("../../../services/storage.service", () => ({ storageService: {} }))
jest.mock("../../../repositories/message-attachment.repository", () => ({
  messageAttachmentRepository: {},
}))
jest.mock("../../../utils/logger", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

const mockPrisma = prisma as unknown as {
  workspace: { findUnique: jest.Mock }
  conversationMessage: { findFirst: jest.Mock }
}
const mockFactory = WhatsAppProviderFactory as jest.Mocked<typeof WhatsAppProviderFactory>
const mockIngest = ingestInboundMedia as jest.Mock

const META_MEDIA = {
  kind: "IMAGE" as const,
  ref: { mediaId: "WA123" },
  filename: null,
  caption: "ciao",
  waMediaId: "WA123",
}

describe("ingestInboundWebhookMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFactory.isConfigured = jest.fn().mockReturnValue(true)
    mockFactory.create = jest.fn().mockReturnValue({ downloadInboundMedia: jest.fn() } as any)
  })

  it("links the attachment to the latest inbound user message and returns its id", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws1",
      whatsappProvider: "meta",
      metaPhoneNumberId: "p",
      metaAccessToken: "t",
    })
    mockPrisma.conversationMessage.findFirst.mockResolvedValue({ id: "cm-99" })
    mockIngest.mockResolvedValue({ ok: true, attachment: { id: "att-1", kind: "IMAGE" } })

    const id = await ingestInboundWebhookMedia({
      workspaceId: "ws1",
      conversationId: "conv1",
      media: META_MEDIA as any,
    })

    expect(id).toBe("att-1")
    // Must look up the LATEST user message of this conversation.
    expect(mockPrisma.conversationMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: "conv1", workspaceId: "ws1", role: "user" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    )
    // Must ingest against that exact message id, preserving the media ref.
    expect(mockIngest).toHaveBeenCalledWith(
      expect.objectContaining({ provider: expect.any(Object) }),
      expect.objectContaining({
        workspaceId: "ws1",
        chatSessionId: "conv1",
        conversationMessageId: "cm-99",
        ref: { mediaId: "WA123" },
        waMediaId: "WA123",
      })
    )
  })

  it("returns null and does not ingest when there is no inbound message", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws1",
      whatsappProvider: "meta",
      metaPhoneNumberId: "p",
      metaAccessToken: "t",
    })
    mockPrisma.conversationMessage.findFirst.mockResolvedValue(null)

    const id = await ingestInboundWebhookMedia({
      workspaceId: "ws1",
      conversationId: "conv1",
      media: META_MEDIA as any,
    })

    expect(id).toBeNull()
    expect(mockIngest).not.toHaveBeenCalled()
  })

  it("returns null when the provider is not configured", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: "ws1" })
    mockFactory.isConfigured = jest.fn().mockReturnValue(false)

    const id = await ingestInboundWebhookMedia({
      workspaceId: "ws1",
      conversationId: "conv1",
      media: META_MEDIA as any,
    })

    expect(id).toBeNull()
    expect(mockPrisma.conversationMessage.findFirst).not.toHaveBeenCalled()
    expect(mockIngest).not.toHaveBeenCalled()
  })

  it("returns null when the workspace is not found", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(null)

    const id = await ingestInboundWebhookMedia({
      workspaceId: "missing",
      conversationId: "conv1",
      media: META_MEDIA as any,
    })

    expect(id).toBeNull()
    expect(mockIngest).not.toHaveBeenCalled()
  })

  it("is fail-safe: returns null (never throws) if a dependency throws", async () => {
    mockPrisma.workspace.findUnique.mockRejectedValue(new Error("db down"))

    await expect(
      ingestInboundWebhookMedia({
        workspaceId: "ws1",
        conversationId: "conv1",
        media: META_MEDIA as any,
      })
    ).resolves.toBeNull()
  })

  it("returns null when ingestion is rejected by the pipeline (bad/oversized file)", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws1",
      whatsappProvider: "meta",
      metaPhoneNumberId: "p",
      metaAccessToken: "t",
    })
    mockPrisma.conversationMessage.findFirst.mockResolvedValue({ id: "cm-1" })
    mockIngest.mockResolvedValue({ ok: false, error: "file_too_large" })

    const id = await ingestInboundWebhookMedia({
      workspaceId: "ws1",
      conversationId: "conv1",
      media: META_MEDIA as any,
    })

    expect(id).toBeNull()
  })
})
