/**
 * Welcome-video helper.
 *
 * Custom chatbots (demowash, …) can show a presentation video on the
 * customer's first message. On the web playground this renders as a rich
 * WelcomeVideoCard (greeting → intro line → video card → rest of the reply).
 *
 * WhatsApp cannot render a custom card and cannot place an image in the MIDDLE
 * of a text message (the image always sits at the top of its bubble). To mirror
 * the playground ORDER on WhatsApp — and to work identically across ALL
 * providers (Meta, UltraMsg, Wasender) — we split the welcome into two messages:
 *
 *   1. text  : greeting + intro line ("here's a short presentation 👇")
 *   2. media : the YouTube thumbnail as a real image, with the rest of the reply
 *              + the clickable video link as the caption.
 *
 * This produces, on WhatsApp: a text bubble, then a bubble with the thumbnail
 * image and the closing question — the same visual order as the playground.
 *
 * When the video is NOT a YouTube URL (no resolvable thumbnail), this returns
 * null and the caller falls back to the legacy single-message inline-URL format.
 */

/** Localized "here's a short presentation 👇" intro line, per language. */
export const WELCOME_VIDEO_INTRO: Record<string, string> = {
  es: "Antes de empezar, te dejo una breve presentación 👇",
  it: "Prima di iniziare, ecco una breve presentazione 👇",
  en: "Before we start, here's a short presentation 👇",
  ca: "Abans de començar, et deixo una breu presentació 👇",
  pt: "Antes de começar, deixo-te uma breve apresentação 👇",
  fr: "Avant de commencer, voici une brève présentation 👇",
  de: "Bevor wir beginnen, hier eine kurze Präsentation 👇",
  ar: "قبل أن نبدأ، إليك عرضًا تقديميًا موجزًا 👇",
}

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
 * it together with the text stripped of that URL (surrounding blank lines
 * collapsed). Returns null when the text contains no video URL.
 *
 * The welcome video is authored INSIDE the welcome message itself (the custom
 * module's greeting in `prompts/common.md`). The rendering layer extracts it
 * here so the same authored message drives both widget and WhatsApp — there is
 * no separate workspace field.
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
      youtubeVideoId(url) !== null || /\.mp4(\?[^\s]*)?$/i.test(url)
    if (!isVideo) continue
    const cleaned = text
      .replace(raw, "")
      .replace(/[ \t]+$/gm, "") // trailing spaces left on the line
      .replace(/\n{3,}/g, "\n\n") // collapse the gap the URL left behind
      .trim()
    return { url, text: cleaned }
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
 * layout (greeting → intro line → video → rest). Returns null when the reply
 * contains no video URL (caller sends the reply unchanged).
 *
 * @param customerReply  the bot reply (Markdown). Expected shape: "greeting\n\nrest".
 * @param language       customer language (for the intro line); falls back to en.
 */
export function formatWelcomeReply(
  customerReply: string,
  language?: string | null
): WelcomeVideoMessage | null {
  const found = extractVideoUrl(customerReply)
  if (!found) return null

  const intro = WELCOME_VIDEO_INTRO[language ?? "en"] ?? WELCOME_VIDEO_INTRO.en
  const reply = found.text
  const breakIdx = reply.indexOf("\n\n")
  const greeting = breakIdx !== -1 ? reply.slice(0, breakIdx) : reply
  const rest = breakIdx !== -1 ? reply.slice(breakIdx + 2) : ""

  const imageUrl = youtubeThumbnail(found.url)
  if (imageUrl) {
    // YouTube → two messages (mirrors the playground WelcomeVideoCard order).
    const textMessage = `${greeting}\n\n${intro}`
    const caption = [rest, found.url].filter(Boolean).join("\n\n")
    return { type: "split", textMessage, imageUrl, caption }
  }

  // Non-YouTube (.mp4) → single message, URL inline under the intro line.
  const text = rest
    ? `${greeting}\n\n${intro}\n${found.url}\n\n${rest}`
    : `${greeting}\n\n${intro}\n${found.url}`
  return { type: "inline", text }
}
