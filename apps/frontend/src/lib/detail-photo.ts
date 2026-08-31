/**
 * Detail-photo extractor (frontend mirror of the backend
 * `formatDetailPhotoReply` in apps/backend/src/utils/detail-photo-reply.ts).
 *
 * A detail answer about ONE place carries its gallery photo as the reply's
 * trailing URL (appended by the demosappada module's withFaqMedia — video
 * wins over photo upstream, so a photo here means the place has no video).
 * On WhatsApp the backend delivers it as a real image with the text as
 * caption; the web chat renderers (ChatWidget, operator ChatPage) use this
 * extractor to show the same thing: photo on top, text below (Andrea,
 * 2026-09-01), instead of a bare link.
 *
 * No caption length cap here (unlike WhatsApp's 1024-char limit, which is a
 * channel constraint): the web bubble renders any length under the image.
 */

/** A line that is nothing but a photo URL — extensions mirror the backend. */
const PHOTO_URL_RE = /^https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif)(?:[?#]\S*)?$/i

/**
 * Split a bot message whose LAST line is a lone photo URL into image +
 * caption. Returns null for everything else (video links, URLs woven into
 * the prose, no URL at all) so those messages render unchanged.
 */
export function extractTrailingPhoto(
  text: string
): { imageUrl: string; caption: string } | null {
  if (!text) return null
  const lines = text.trimEnd().split("\n")
  const last = lines[lines.length - 1].trim()
  if (!PHOTO_URL_RE.test(last)) return null
  const caption = lines.slice(0, -1).join("\n").trim()
  return { imageUrl: last, caption }
}
