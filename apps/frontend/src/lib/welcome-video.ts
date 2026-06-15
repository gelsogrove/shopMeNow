/**
 * Welcome-video extractor (frontend mirror of the backend `extractVideoUrl`).
 *
 * The presentation video URL is authored INSIDE the welcome message itself (the
 * custom module's first-turn greeting). The chat renderers (ChatWidget,
 * operator ChatPage) extract it from the first bot message and render it as a
 * WelcomeVideoCard — there is no separate workspace field.
 */

/**
 * Find the FIRST YouTube or direct .mp4 URL inside free text and return it
 * together with the text stripped of that URL (surrounding blank lines
 * collapsed). Returns null when the text contains no video URL.
 */
export function extractVideoUrl(
  text: string
): { url: string; text: string } | null {
  if (!text) return null
  const matches = text.match(/https?:\/\/[^\s<>()]+/gi)
  if (!matches) return null
  for (const raw of matches) {
    // Trim trailing markdown/sentence punctuation that isn't part of the URL.
    const url = raw.replace(/[)\].,;:!?]+$/, "")
    const isVideo =
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))[\w-]{6,}/.test(
        url
      ) || /\.mp4(\?[^\s]*)?$/i.test(url)
    if (!isVideo) continue
    const cleaned = text
      .replace(raw, "")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    return { url, text: cleaned }
  }
  return null
}
