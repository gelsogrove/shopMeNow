/**
 * formatDetailPhotoReply — photo delivery for single-place detail answers.
 *
 * WHAT: custom-demosappada's withFaqMedia appends ONE media link under a
 * detail answer (video first, photo only when the place has no video —
 * contratto.md: "se c'è il video vince il video sulla foto"). When that
 * trailing link is a PHOTO, the WhatsApp layer must deliver it as a real
 * image with the reply text as caption (photo on top, text below —
 * Andrea, 2026-09-01), not as a bare URL the guest has to tap.
 *
 * WHY these cases: the helper must fire ONLY on the exact layout the module
 * produces (reply + blank line + lone photo URL as the last line). Anything
 * else — video links, URLs inside prose, no URL at all — must pass through
 * unchanged, so lists and video answers keep today's behavior.
 */
import { formatDetailPhotoReply } from "../../utils/detail-photo-reply"

describe("formatDetailPhotoReply", () => {
  // The exact shape withFaqMedia emits: reply, blank line, photo URL.
  // This is the tourist-gallery public URL, which ends in /image.jpg
  // precisely so extension-based recognition works.
  const photoUrl =
    "https://api.example.com/api/public/tourist-photos/abc123/image.jpg"

  it("splits a reply whose last line is a lone photo URL into image + caption", () => {
    const reply = `Il **Rifugio Monte Siera** è aperto da giugno a settembre.\n\n${photoUrl}`
    expect(formatDetailPhotoReply(reply)).toEqual({
      imageUrl: photoUrl,
      // Caption is the reply WITHOUT the URL line: the photo shows on top,
      // this text renders under it as the WhatsApp caption.
      caption: "Il **Rifugio Monte Siera** è aperto da giugno a settembre.",
    })
  })

  it("accepts a photo URL with a query string (cache busters, signed URLs)", () => {
    const reply = `Ecco le Cascatelle.\n\nhttps://cdn.example.com/foto.jpeg?v=2`
    expect(formatDetailPhotoReply(reply)?.imageUrl).toBe(
      "https://cdn.example.com/foto.jpeg?v=2"
    )
  })

  it("returns null for a trailing VIDEO link — video keeps the link-preview behavior", () => {
    // Video wins over photo upstream (mediaLinksIn ranks it first) and is
    // deliberately left as a link: WhatsApp renders its own preview card.
    const yt = `Guarda il video del Nevelandia.\n\nhttps://youtu.be/dQw4w9WgXcQ`
    const mp4 = `Guarda il video.\n\nhttps://cdn.example.com/clip.mp4`
    expect(formatDetailPhotoReply(yt)).toBeNull()
    expect(formatDetailPhotoReply(mp4)).toBeNull()
  })

  it("returns null when the photo URL sits INSIDE the prose, not on its own last line", () => {
    // A URL the author wove into a sentence belongs to that sentence —
    // ripping it out would break the text. Only the module's appended
    // trailing line is delivery-formatted.
    const reply = `Trovi la foto qui ${photoUrl} insieme agli orari di apertura.`
    expect(formatDetailPhotoReply(reply)).toBeNull()
  })

  it("returns null when there is no URL at all (plain text stays plain text)", () => {
    expect(formatDetailPhotoReply("Il rifugio apre alle 9.")).toBeNull()
    expect(formatDetailPhotoReply("")).toBeNull()
  })

  it("returns null when the caption would exceed WhatsApp's 1024-char limit", () => {
    // Falling back to text + link keeps the full answer intact — the guest's
    // content is never truncated to fit a caption.
    const longText = "a".repeat(1025)
    expect(formatDetailPhotoReply(`${longText}\n\n${photoUrl}`)).toBeNull()
  })

  it("handles a reply that is ONLY the photo URL (empty caption)", () => {
    expect(formatDetailPhotoReply(photoUrl)).toEqual({
      imageUrl: photoUrl,
      caption: "",
    })
  })
})
