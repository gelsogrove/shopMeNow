/**
 * Unit Tests — Inbound Media Ingestion
 *
 * WHAT: Validates the inbound media pipeline (download → sniff/validate →
 *       upload → persist) using injected mock collaborators.
 *
 * WHY:  This pipeline ingests untrusted files from external customers over
 *       WhatsApp. It MUST: trust bytes over the declared content-type, reject
 *       spoofed/oversized/unsupported content before storage, store customer
 *       media as PRIVATE (PII), and never throw (a media failure must not break
 *       the text-message path). These tests pin all of that behaviour.
 *       See docs/media-attachments-plan.md §4, §11.
 */

import {
  AttachmentRepository,
  AttachmentStorage,
  IngestDeps,
  MediaDownloader,
  ingestInboundMedia,
  ingestInboundMediaBundle,
} from "../../src/services/inbound-media.service"
import { MAX_IMAGE_BYTES } from "../../src/services/chat-attachment.validation"

// Real-ish magic-byte buffers for sniffing.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PDF = Buffer.from("%PDF-1.7\n%mock\n", "ascii")

function makeDeps(overrides: Partial<IngestDeps> = {}): {
  deps: IngestDeps
  storage: jest.Mocked<AttachmentStorage>
  repository: jest.Mocked<AttachmentRepository>
  downloadMock: jest.Mock
} {
  const downloadMock = jest.fn()
  const provider: MediaDownloader = { downloadInboundMedia: downloadMock as any }

  const storage = {
    upload: jest.fn().mockResolvedValue({
      url: "https://cdn/echatbot/chat-attachments/ws1/sess1/file.jpg",
      key: "echatbot/chat-attachments/ws1/sess1/file",
    }),
  } as unknown as jest.Mocked<AttachmentStorage>

  const repository = {
    create: jest.fn().mockResolvedValue({ id: "att_1" }),
  } as unknown as jest.Mocked<AttachmentRepository>

  const deps: IngestDeps = {
    provider,
    storage,
    repository,
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    ...overrides,
  }
  return { deps, storage, repository, downloadMock }
}

const baseInput = {
  workspaceId: "ws1",
  chatSessionId: "sess1",
  conversationMessageId: "cmsg1",
  ref: { mediaId: "wamid.media1" },
}

describe("ingestInboundMedia()", () => {
  it("ingests a valid JPEG: downloads, uploads PRIVATE, persists the row", async () => {
    const { deps, storage, repository, downloadMock } = makeDeps()
    downloadMock.mockResolvedValue({
      buffer: JPEG,
      mimeType: "image/jpeg",
      sizeBytes: JPEG.length,
    })

    const r = await ingestInboundMedia(deps, baseInput)

    expect(r.ok).toBe(true)
    expect(r.attachment?.kind).toBe("IMAGE")
    expect(r.attachment?.mimeType).toBe("image/jpeg")
    expect(r.attachment?.id).toBe("att_1")

    // Uploaded to a per-workspace/per-session private folder.
    expect(storage.upload).toHaveBeenCalledTimes(1)
    const uploadArgs = storage.upload.mock.calls[0][1]
    expect(uploadArgs.folder).toBe("chat-attachments/ws1/sess1")
    expect(uploadArgs.isPublic).toBe(true) // v1: public + unguessable key (signed URLs = prod follow-up)
    expect(uploadArgs.contentType).toBe("image/jpeg")

    // Persisted with the storageKey needed for later physical deletion.
    expect(repository.create).toHaveBeenCalledTimes(1)
    const row = repository.create.mock.calls[0][0]
    expect(row.workspaceId).toBe("ws1")
    expect(row.conversationMessageId).toBe("cmsg1")
    expect(row.storageKey).toBe("echatbot/chat-attachments/ws1/sess1/file")
    expect(row.kind).toBe("IMAGE")
  })

  it("ingests a valid PDF as DOCUMENT", async () => {
    const { deps } = makeDeps()
    ;(deps.provider.downloadInboundMedia as jest.Mock).mockResolvedValue({
      buffer: PDF,
      mimeType: "application/pdf",
      sizeBytes: PDF.length,
    })

    const r = await ingestInboundMedia(deps, {
      ...baseInput,
      ref: { mediaUrl: "https://ultramsg/media/abc.pdf" },
      filename: "invoice.pdf",
    })

    expect(r.ok).toBe(true)
    expect(r.attachment?.kind).toBe("DOCUMENT")
    expect(r.attachment?.mimeType).toBe("application/pdf")
  })

  it("TRUSTS BYTES over declared MIME: PNG bytes are ingested as image/png", async () => {
    // Provider claims jpeg, but the bytes are actually PNG → we store png.
    const { deps } = makeDeps()
    ;(deps.provider.downloadInboundMedia as jest.Mock).mockResolvedValue({
      buffer: PNG,
      mimeType: "image/jpeg", // lie
      sizeBytes: PNG.length,
    })

    const r = await ingestInboundMedia(deps, baseInput)
    expect(r.ok).toBe(true)
    expect(r.attachment?.mimeType).toBe("image/png")
  })

  it("rejects spoofed/unsupported content (not image or PDF) BEFORE upload", async () => {
    const { deps, storage, repository } = makeDeps()
    ;(deps.provider.downloadInboundMedia as jest.Mock).mockResolvedValue({
      buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]), // "MZ" = Windows executable
      mimeType: "image/jpeg",
      sizeBytes: 4,
    })

    const r = await ingestInboundMedia(deps, baseInput)
    expect(r.ok).toBe(false)
    expect(r.error).toBe("unsupported_content")
    expect(storage.upload).not.toHaveBeenCalled()
    expect(repository.create).not.toHaveBeenCalled()
  })

  it("rejects an oversized image before upload", async () => {
    const { deps, storage } = makeDeps()
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES + 1)])
    ;(deps.provider.downloadInboundMedia as jest.Mock).mockResolvedValue({
      buffer: big,
      mimeType: "image/jpeg",
      sizeBytes: big.length,
    })

    const r = await ingestInboundMedia(deps, baseInput)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/too large/i)
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it("returns ok:false when the provider cannot download media (no throw)", async () => {
    const { deps } = makeDeps({ provider: {} }) // no downloadInboundMedia
    const r = await ingestInboundMedia(deps, baseInput)
    expect(r.ok).toBe(false)
    expect(r.error).toBe("provider_does_not_support_media_download")
  })

  it("returns ok:false when no media reference is given", async () => {
    const { deps } = makeDeps()
    const r = await ingestInboundMedia(deps, { ...baseInput, ref: {} })
    expect(r.ok).toBe(false)
    expect(r.error).toBe("missing_media_reference")
  })

  it("NEVER throws: a download error becomes ok:false", async () => {
    const { deps, storage } = makeDeps()
    ;(deps.provider.downloadInboundMedia as jest.Mock).mockRejectedValue(
      new Error("network down")
    )
    const r = await ingestInboundMedia(deps, baseInput)
    expect(r.ok).toBe(false)
    expect(r.error).toBe("network down")
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it("NEVER throws: an empty download becomes ok:false", async () => {
    const { deps } = makeDeps()
    ;(deps.provider.downloadInboundMedia as jest.Mock).mockResolvedValue({
      buffer: Buffer.alloc(0),
      mimeType: "image/jpeg",
      sizeBytes: 0,
    })
    const r = await ingestInboundMedia(deps, baseInput)
    expect(r.ok).toBe(false)
    expect(r.error).toBe("empty_media")
  })
})

describe("ingestInboundMediaBundle()", () => {
  it("ingests each item and continues past a single failure", async () => {
    const { deps, downloadMock } = makeDeps()
    downloadMock
      .mockResolvedValueOnce({ buffer: JPEG, mimeType: "image/jpeg", sizeBytes: JPEG.length })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ buffer: PDF, mimeType: "application/pdf", sizeBytes: PDF.length })

    const results = await ingestInboundMediaBundle(deps, [
      { ...baseInput, ref: { mediaId: "a" } },
      { ...baseInput, ref: { mediaId: "b" } },
      { ...baseInput, ref: { mediaId: "c" } },
    ])

    expect(results).toHaveLength(3)
    expect(results[0].ok).toBe(true)
    expect(results[1].ok).toBe(false)
    expect(results[2].ok).toBe(true)
  })

  it("caps the bundle at the max attachments per message", async () => {
    const { deps, downloadMock } = makeDeps()
    downloadMock.mockResolvedValue({ buffer: JPEG, mimeType: "image/jpeg", sizeBytes: JPEG.length })

    const many = Array.from({ length: 9 }, (_, i) => ({ ...baseInput, ref: { mediaId: `m${i}` } }))
    const results = await ingestInboundMediaBundle(deps, many)

    expect(results.length).toBe(5) // MAX_ATTACHMENTS_PER_MESSAGE
  })
})
