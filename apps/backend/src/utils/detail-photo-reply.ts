/**
 * Detail-photo helper.
 *
 * custom-demosappada's withFaqMedia (faq-media.ts) appends ONE media link
 * under a detail answer about a single place — ranked video first, photo
 * second (contratto.md: video wins over the photo; Andrea, 2026-09-01:
 * "se c'è il video vince il video sulla foto"). A video link is left as a
 * link on purpose (WhatsApp renders its own preview card), but a PHOTO
 * arriving as a bare URL is just a link the guest has to tap. Andrea,
 * 2026-09-01: the photo must be SHOWN, with the reply text under it.
 *
 * This helper recognises exactly that layout — a reply whose LAST line is a
 * lone photo URL — and turns it into the shape of a real WhatsApp image
 * message: the photo as media, the reply text as the caption (photo on top,
 * text below). Anything else returns null and the caller sends the reply
 * unchanged: a URL inside the prose belongs to the author's sentence, and a
 * video/.mp4 link keeps today's link-preview behavior.
 *
 * Deterministic, host-side (CLAUDE.md §16 iron rule 1): the module decides
 * WHICH media belongs to the answer; this layer only decides HOW a photo is
 * delivered on WhatsApp. Channel-agnostic like formatWelcomeReply — the
 * caller uses WhatsAppDirectSendService.sendMedia(), which works the same on
 * Meta, UltraMsg and Wasender.
 */

/**
 * A line that is nothing but a photo URL. Extensions mirror faq-media.ts's
 * PHOTO_LINK_RE (and the tourist gallery's public path, which ends in
 * /image.jpg precisely so this recognition works by extension).
 */
const PHOTO_URL_RE = /^https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif)(?:[?#]\S*)?$/i

/**
 * WhatsApp's media caption limit (Meta Cloud API: 1024 chars). A longer
 * detail answer falls back to the plain text + link message rather than
 * being truncated — nothing the guest wrote for is ever cut.
 */
const CAPTION_MAX_CHARS = 1024

/**
 * Split a bot reply whose last line is a lone photo URL into image + caption.
 * Returns null when the reply carries no trailing photo (caller sends the
 * reply unchanged as text).
 */
export function formatDetailPhotoReply(
  customerReply: string
): { imageUrl: string; caption: string } | null {
  if (!customerReply) return null
  const lines = customerReply.trimEnd().split("\n")
  const last = lines[lines.length - 1].trim()
  if (!PHOTO_URL_RE.test(last)) return null
  const caption = lines
    .slice(0, -1)
    .join("\n")
    .trim()
  if (caption.length > CAPTION_MAX_CHARS) return null
  return { imageUrl: last, caption }
}
