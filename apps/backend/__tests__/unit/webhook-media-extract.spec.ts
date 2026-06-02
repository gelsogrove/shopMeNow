/**
 * Unit Tests — Webhook Media Extraction
 *
 * WHAT: Validates that inbound media references are correctly pulled from each
 *       provider's webhook payload (Meta media id; UltraMsg/Wasender direct
 *       URL), and that text-only / unsupported-media messages yield null so the
 *       caller falls through to the existing text path untouched.
 *
 * WHY:  These parsers are the bridge between the three different provider
 *       payload shapes and the single ingestion pipeline. A wrong parse means
 *       lost attachments or a broken text flow. See plan §4.
 */

import {
  extractMetaMedia,
  extractUltramsgMedia,
  extractWasenderMedia,
} from "../../src/services/webhook-media.extract"

describe("extractMetaMedia()", () => {
  it("extracts an image (media id + mime + caption)", () => {
    const msg = {
      type: "image",
      image: { id: "wamid.img1", mime_type: "image/jpeg", caption: "broken" },
    }
    expect(extractMetaMedia(msg)).toEqual({
      kind: "IMAGE",
      ref: { mediaId: "wamid.img1" },
      declaredMime: "image/jpeg",
      filename: undefined,
      caption: "broken",
      waMediaId: "wamid.img1",
    })
  })

  it("extracts a document (filename preserved)", () => {
    const msg = {
      type: "document",
      document: { id: "wamid.doc1", mime_type: "application/pdf", filename: "invoice.pdf" },
    }
    const r = extractMetaMedia(msg)
    expect(r?.kind).toBe("DOCUMENT")
    expect(r?.ref).toEqual({ mediaId: "wamid.doc1" })
    expect(r?.filename).toBe("invoice.pdf")
  })

  it("returns null for a text message", () => {
    expect(extractMetaMedia({ type: "text", text: { body: "hi" } })).toBeNull()
  })

  it("returns null for unsupported media (audio/video/sticker)", () => {
    expect(extractMetaMedia({ type: "audio", audio: { id: "a1" } })).toBeNull()
    expect(extractMetaMedia({ type: "video", video: { id: "v1" } })).toBeNull()
  })

  it("returns null when the media id is missing", () => {
    expect(extractMetaMedia({ type: "image", image: { mime_type: "image/png" } })).toBeNull()
  })
})

describe("extractUltramsgMedia()", () => {
  it("extracts an image from a direct media URL", () => {
    const data = { type: "image", media: "https://ultra/media/x.jpg", caption: "see" }
    expect(extractUltramsgMedia(data)).toEqual({
      kind: "IMAGE",
      ref: { mediaUrl: "https://ultra/media/x.jpg" },
      filename: undefined,
      caption: "see",
    })
  })

  it("extracts a document URL with filename", () => {
    const data = { type: "document", media: "https://ultra/media/x.pdf", filename: "x.pdf" }
    const r = extractUltramsgMedia(data)
    expect(r?.kind).toBe("DOCUMENT")
    expect(r?.ref).toEqual({ mediaUrl: "https://ultra/media/x.pdf" })
    expect(r?.filename).toBe("x.pdf")
  })

  it("returns null for a chat/text message", () => {
    expect(extractUltramsgMedia({ type: "chat", body: "hello" })).toBeNull()
  })

  it("returns null when there is no valid URL", () => {
    expect(extractUltramsgMedia({ type: "image", media: "not-a-url" })).toBeNull()
  })
})

describe("extractWasenderMedia()", () => {
  it("extracts an image message", () => {
    const msg = {
      message: { imageMessage: { url: "https://wa/x.jpg", mimetype: "image/jpeg", caption: "hi" } },
    }
    expect(extractWasenderMedia(msg)).toEqual({
      kind: "IMAGE",
      ref: { mediaUrl: "https://wa/x.jpg" },
      declaredMime: "image/jpeg",
      caption: "hi",
    })
  })

  it("extracts a document message with fileName", () => {
    const msg = {
      message: { documentMessage: { url: "https://wa/x.pdf", mimetype: "application/pdf", fileName: "doc.pdf" } },
    }
    const r = extractWasenderMedia(msg)
    expect(r?.kind).toBe("DOCUMENT")
    expect(r?.ref).toEqual({ mediaUrl: "https://wa/x.pdf" })
    expect(r?.filename).toBe("doc.pdf")
  })

  it("returns null for a plain conversation message", () => {
    expect(extractWasenderMedia({ message: { conversation: "hello" } })).toBeNull()
  })

  it("returns null when there is no message body", () => {
    expect(extractWasenderMedia({})).toBeNull()
  })
})
