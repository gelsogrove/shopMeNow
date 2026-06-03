/**
 * Unit tests — webhook media extraction (pure, no I/O).
 *
 * WHAT: each provider exposes inbound media differently; these parsers must
 * normalise image/document payloads into a single ExtractedMedia shape and
 * return null for everything else (text, unsupported audio/video/sticker).
 * WHY: this is the gate that decides whether the inbound media pipeline runs,
 * so wrong parsing = files silently lost or wrong type ingested.
 */

import {
  extractMetaMedia,
  extractUltramsgMedia,
  extractWasenderMedia,
} from "../../../services/webhook-media.extract"

describe("webhook media extraction", () => {
  describe("Meta (media id based)", () => {
    it("extracts an image, carrying the media id + caption", () => {
      const msg = {
        type: "image",
        image: { id: "MID1", mime_type: "image/jpeg", caption: "hi" },
      }
      expect(extractMetaMedia(msg)).toMatchObject({
        kind: "IMAGE",
        ref: { mediaId: "MID1" },
        declaredMime: "image/jpeg",
        caption: "hi",
        waMediaId: "MID1",
      })
    })

    it("extracts a document, carrying the filename", () => {
      const msg = {
        type: "document",
        document: { id: "DID1", mime_type: "application/pdf", filename: "f.pdf" },
      }
      expect(extractMetaMedia(msg)).toMatchObject({
        kind: "DOCUMENT",
        ref: { mediaId: "DID1" },
        filename: "f.pdf",
      })
    })

    it("returns null for plain text", () => {
      expect(extractMetaMedia({ type: "text", text: { body: "ciao" } })).toBeNull()
    })

    it("returns null for unsupported media (audio)", () => {
      expect(extractMetaMedia({ type: "audio", audio: { id: "A1" } })).toBeNull()
    })

    it("returns null when the media id is missing", () => {
      expect(extractMetaMedia({ type: "image", image: { mime_type: "image/png" } })).toBeNull()
    })
  })

  describe("UltraMsg (direct url based)", () => {
    it("extracts an image from a direct url", () => {
      const data = { type: "image", media: "https://x/i.jpg", caption: "c" }
      expect(extractUltramsgMedia(data)).toMatchObject({
        kind: "IMAGE",
        ref: { mediaUrl: "https://x/i.jpg" },
        caption: "c",
      })
    })

    it("extracts a document from a direct url", () => {
      const data = { type: "document", media: "https://x/d.pdf", filename: "d.pdf" }
      expect(extractUltramsgMedia(data)).toMatchObject({
        kind: "DOCUMENT",
        ref: { mediaUrl: "https://x/d.pdf" },
        filename: "d.pdf",
      })
    })

    it("returns null when the url is not http(s)", () => {
      expect(extractUltramsgMedia({ type: "image", media: "not-a-url" })).toBeNull()
    })

    it("returns null for chat text", () => {
      expect(extractUltramsgMedia({ type: "chat", body: "hello" })).toBeNull()
    })
  })

  describe("Wasender (nested message url based)", () => {
    it("extracts an image message", () => {
      const message = {
        message: { imageMessage: { url: "https://x/i.jpg", mimetype: "image/jpeg", caption: "c" } },
      }
      expect(extractWasenderMedia(message)).toMatchObject({
        kind: "IMAGE",
        ref: { mediaUrl: "https://x/i.jpg" },
        declaredMime: "image/jpeg",
      })
    })

    it("extracts a document message with its file name", () => {
      const message = {
        message: { documentMessage: { url: "https://x/d.pdf", mimetype: "application/pdf", fileName: "d.pdf" } },
      }
      expect(extractWasenderMedia(message)).toMatchObject({
        kind: "DOCUMENT",
        ref: { mediaUrl: "https://x/d.pdf" },
        filename: "d.pdf",
      })
    })

    it("returns null for a plain text message", () => {
      expect(extractWasenderMedia({ message: { conversation: "hi" } })).toBeNull()
    })

    it("returns null when there is no inner message", () => {
      expect(extractWasenderMedia({})).toBeNull()
    })
  })
})
