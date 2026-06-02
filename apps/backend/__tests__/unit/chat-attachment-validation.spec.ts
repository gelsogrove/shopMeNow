/**
 * Unit Tests — Chat Attachment Validation
 *
 * WHAT: Validates the pure validation logic for chat message attachments
 *       (images + PDF): MIME whitelist, extension/MIME consistency, per-type
 *       size caps, batch count cap, and magic-byte content sniffing.
 *
 * WHY:  Attachments arrive from untrusted external sources (WhatsApp customers,
 *       widget visitors). These checks are the security boundary that keeps the
 *       system from storing/forwarding spoofed or oversized files. The logic is
 *       isolated in a pure module precisely so it can be tested without multer,
 *       storage, or the network. See docs/media-attachments-plan.md §11.
 */

import {
  ACCEPTED_CHAT_MIME,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  classifyKind,
  sniffMime,
  validateAttachment,
  validateAttachmentBatch,
  validateContentMatchesDeclared,
} from "../../src/services/chat-attachment.validation"

describe("chat-attachment.validation", () => {
  describe("classifyKind()", () => {
    it("maps jpeg and png to IMAGE", () => {
      expect(classifyKind("image/jpeg")).toBe("IMAGE")
      expect(classifyKind("image/png")).toBe("IMAGE")
    })

    it("maps application/pdf to DOCUMENT", () => {
      expect(classifyKind("application/pdf")).toBe("DOCUMENT")
    })

    it("is case-insensitive on the MIME type", () => {
      expect(classifyKind("IMAGE/JPEG")).toBe("IMAGE")
    })

    it("returns null for unsupported types (gif, webp, svg, video)", () => {
      // WhatsApp accepts gif/webp as stickers/animations but our chat feature
      // is deliberately scoped to jpeg/png/pdf only (plan §13 v1).
      expect(classifyKind("image/gif")).toBeNull()
      expect(classifyKind("image/webp")).toBeNull()
      expect(classifyKind("image/svg+xml")).toBeNull()
      expect(classifyKind("video/mp4")).toBeNull()
      expect(classifyKind("")).toBeNull()
    })
  })

  describe("validateAttachment() — type & extension", () => {
    it("accepts a valid jpeg with matching extension", () => {
      const r = validateAttachment({
        mimeType: "image/jpeg",
        filename: "photo.jpg",
        sizeBytes: 1024,
      })
      expect(r).toEqual({ ok: true, kind: "IMAGE" })
    })

    it("accepts a valid pdf", () => {
      const r = validateAttachment({
        mimeType: "application/pdf",
        filename: "invoice.pdf",
        sizeBytes: 1024,
      })
      expect(r).toEqual({ ok: true, kind: "DOCUMENT" })
    })

    it("accepts when no filename is provided (extension check skipped)", () => {
      const r = validateAttachment({ mimeType: "image/png", sizeBytes: 500 })
      expect(r.ok).toBe(true)
      expect(r.kind).toBe("IMAGE")
    })

    it("rejects an unsupported MIME type", () => {
      const r = validateAttachment({
        mimeType: "image/gif",
        filename: "anim.gif",
        sizeBytes: 100,
      })
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/Unsupported file type/i)
    })

    it("rejects when extension does not match the declared MIME (spoof attempt)", () => {
      // e.g. an executable renamed to .jpg but declared as pdf, or mismatch.
      const r = validateAttachment({
        mimeType: "application/pdf",
        filename: "evil.jpg",
        sizeBytes: 100,
      })
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/does not match/i)
    })
  })

  describe("validateAttachment() — size caps", () => {
    it("accepts an image exactly at the 5MB cap", () => {
      const r = validateAttachment({
        mimeType: "image/jpeg",
        filename: "p.jpg",
        sizeBytes: MAX_IMAGE_BYTES,
      })
      expect(r.ok).toBe(true)
    })

    it("rejects an image just over the 5MB cap", () => {
      const r = validateAttachment({
        mimeType: "image/jpeg",
        filename: "p.jpg",
        sizeBytes: MAX_IMAGE_BYTES + 1,
      })
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/Image too large/i)
    })

    it("accepts a PDF up to the 20MB cap (larger than the image cap)", () => {
      const r = validateAttachment({
        mimeType: "application/pdf",
        filename: "doc.pdf",
        sizeBytes: MAX_DOCUMENT_BYTES,
      })
      expect(r.ok).toBe(true)
    })

    it("rejects a PDF over the 20MB cap", () => {
      const r = validateAttachment({
        mimeType: "application/pdf",
        filename: "doc.pdf",
        sizeBytes: MAX_DOCUMENT_BYTES + 1,
      })
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/Document too large/i)
    })

    it("rejects zero or invalid sizes", () => {
      expect(validateAttachment({ mimeType: "image/png", sizeBytes: 0 }).ok).toBe(false)
      expect(
        validateAttachment({ mimeType: "image/png", sizeBytes: NaN as unknown as number }).ok
      ).toBe(false)
    })
  })

  describe("validateAttachmentBatch() — count cap", () => {
    const valid = { mimeType: "image/jpeg", filename: "p.jpg", sizeBytes: 1024 }

    it("rejects an empty batch", () => {
      expect(validateAttachmentBatch([]).ok).toBe(false)
    })

    it("accepts up to the max number of attachments", () => {
      const batch = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, () => ({ ...valid }))
      expect(validateAttachmentBatch(batch).ok).toBe(true)
    })

    it("rejects more than the max number of attachments", () => {
      const batch = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, () => ({ ...valid }))
      const r = validateAttachmentBatch(batch)
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/Too many attachments/i)
    })

    it("returns the first invalid item's error", () => {
      const r = validateAttachmentBatch([{ ...valid }, { mimeType: "image/gif", sizeBytes: 10 }])
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/Unsupported file type/i)
    })
  })

  describe("sniffMime() — magic bytes", () => {
    it("detects JPEG (FF D8 FF)", () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
      expect(sniffMime(buf)).toBe("image/jpeg")
    })

    it("detects PNG (89 50 4E 47)", () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(sniffMime(buf)).toBe("image/png")
    })

    it("detects PDF (%PDF)", () => {
      const buf = Buffer.from("%PDF-1.7\n", "ascii")
      expect(sniffMime(buf)).toBe("application/pdf")
    })

    it("returns null for unknown / too-short content", () => {
      expect(sniffMime(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBeNull()
      expect(sniffMime(Buffer.from([0xff]))).toBeNull()
      expect(sniffMime(Buffer.alloc(0))).toBeNull()
    })
  })

  describe("validateContentMatchesDeclared() — anti-spoofing", () => {
    it("passes when sniffed content matches the declared MIME", () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      expect(validateContentMatchesDeclared(jpeg, "image/jpeg")).toEqual({
        ok: true,
        kind: "IMAGE",
      })
    })

    it("fails when a file is declared image/jpeg but is actually a PDF", () => {
      const pdf = Buffer.from("%PDF-1.4", "ascii")
      const r = validateContentMatchesDeclared(pdf, "image/jpeg")
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/does not match declared type/i)
    })

    it("fails when content is not a supported image or PDF", () => {
      const junk = Buffer.from([0x00, 0x11, 0x22, 0x33])
      const r = validateContentMatchesDeclared(junk, "image/png")
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/not a supported/i)
    })
  })

  describe("constants sanity", () => {
    it("whitelist contains exactly jpeg, png, pdf", () => {
      expect([...ACCEPTED_CHAT_MIME].sort()).toEqual(
        ["application/pdf", "image/jpeg", "image/png"].sort()
      )
    })

    it("image cap is below the document cap (WhatsApp parity)", () => {
      expect(MAX_IMAGE_BYTES).toBeLessThan(MAX_DOCUMENT_BYTES)
    })
  })
})
