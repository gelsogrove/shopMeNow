/**
 * Welcome-video helper.
 *
 * Custom chatbots (demowash, …) can show a presentation video on the
 * customer's first message. On the web playground this renders as a rich
 * WelcomeVideoCard (text before the video → video card → text after).
 *
 * The intro line ("ecco una breve presentazione 👇") is NOT injected here:
 * it is authored by the LLM as part of the welcome message, in the SAME
 * language as the rest of the reply (see each module's prompts/common.md).
 * This guarantees a single language per message — no hardcoded translation
 * map to keep in sync, no language field to plumb through.
 *
 * WhatsApp cannot render a custom card and cannot place an image in the MIDDLE
 * of a text message (the image always sits at the top of its bubble). To mirror
 * the playground ORDER on WhatsApp — and to work identically across ALL
 * providers (Meta, UltraMsg, Wasender) — we split the welcome into two messages:
 *
 *   1. text  : everything authored BEFORE the video URL (greeting + intro line)
 *   2. media : the YouTube thumbnail as a real image, with everything authored
 *              AFTER the URL + the clickable video link as the caption.
 *
 * This produces, on WhatsApp: a text bubble, then a bubble with the thumbnail
 * image and the closing question — the same visual order as the playground.
 *
 * When the video is NOT a YouTube URL (no resolvable thumbnail), this returns
 * an `inline` message and the caller sends a single message with the URL inline.
 */

/**
 * Extract the 11-char YouTube video id from any common YouTube URL shape
 * (watch?v=, youtu.be/, embed/, shorts/). Returns null for non-YouTube URLs.
 */
export function youtubeVideoId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/, // youtube.com/watch?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{11})/, // youtu.be/ID
    /\/embed\/([A-Za-z0-9_-]{11})/, // youtube.com/embed/ID
    /\/shorts\/([A-Za-z0-9_-]{11})/, // youtube.com/shorts/ID
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return null
}

/**
 * Build the YouTube thumbnail URL for a video URL, or null if it is not a
 * YouTube link. `hqdefault.jpg` always exists for any public video (unlike
 * `maxresdefault.jpg`, which is missing for low-res uploads).
 */
export function youtubeThumbnail(url: string): string | null {
  const id = youtubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

/**
 * Find the FIRST video URL (YouTube or direct .mp4) inside free text and return
 * it together with the authored text BEFORE and AFTER the URL (trimmed). The
 * URL position is the split point so the video lands exactly where the author
 * put it: text before → above the video, text after → below it. Returns null
 * when the text contains no video URL.
 *
 * The welcome video is authored INSIDE the welcome message itself (the custom
 * module's greeting in `prompts/common.md`). The rendering layer extracts it
 * here so the same authored message drives both widget and WhatsApp — there is
 * no separate workspace field.
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
      youtubeVideoId(url) !== null || /\.mp4(\?[^\s]*)?$/i.test(url)
    if (!isVideo) continue
    const idx = text.indexOf(raw)
    const before = text.slice(0, idx).replace(/[ \t]+$/gm, "").trim()
    const after = text.slice(idx + raw.length).replace(/[ \t]+$/gm, "").trim()
    return { url, before, after }
  }
  return null
}

/**
 * Result of formatting a first-turn reply that embeds a presentation video.
 *  - `split`  : YouTube — two messages (text + thumbnail image with caption).
 *  - `inline` : non-YouTube (.mp4) — single message with the URL inline.
 */
export type WelcomeVideoMessage =
  | { type: "split"; textMessage: string; imageUrl: string; caption: string }
  | { type: "inline"; text: string }

/**
 * Format a custom-chatbot first-turn reply whose welcome message embeds a video
 * URL. Extracts the URL from the reply text and produces the channel-agnostic
 * layout (text before → video → text after). Returns null when the reply
 * contains no video URL (caller sends the reply unchanged).
 *
 * @param customerReply  the bot reply (Markdown). The intro line is already
 *                       authored (in the reply language) right before the URL.
 */
export function formatWelcomeReply(
  customerReply: string
): WelcomeVideoMessage | null {
  const found = extractVideoUrl(customerReply)
  if (!found) return null

  const imageUrl = youtubeThumbnail(found.url)
  if (imageUrl) {
    // YouTube → two messages (mirrors the playground WelcomeVideoCard order).
    const textMessage = found.before
    const caption = [found.after, found.url].filter(Boolean).join("\n\n")
    return { type: "split", textMessage, imageUrl, caption }
  }

  // Non-YouTube (.mp4) → single message, URL inline where the author put it.
  const text = found.after
    ? `${found.before}\n${found.url}\n\n${found.after}`
    : `${found.before}\n${found.url}`
  return { type: "inline", text }
}
