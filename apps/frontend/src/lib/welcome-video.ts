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
 * together with the authored text BEFORE and AFTER the URL (trimmed). The URL
 * position is the split point: text before → above the video card, text after →
 * below it. The intro line ("ecco una breve presentazione 👇") is authored by
 * the LLM right before the URL, so it lands above the video automatically — no
 * hardcoded intro injection. Returns null when there is no video URL.
 */
export function extractVideoUrl(
  text: string
): { url: string; before: string; after: string } | null {
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
    const idx = text.indexOf(raw)
    const before = text.slice(0, idx).replace(/[ \t]+$/gm, "").trim()
    const after = text.slice(idx + raw.length).replace(/[ \t]+$/gm, "").trim()
    return { url, before, after }
  }
  return null
}
