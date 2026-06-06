/**
 * Welcome-video helper.
 *
 * Custom chatbots (demowash, ecolaundry, …) can show a presentation video on the
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

export interface WelcomeVideoSplit {
  /** Message 1 — greeting + intro line. */
  textMessage: string
  /** Message 2 — image URL (YouTube thumbnail). */
  imageUrl: string
  /** Message 2 — caption: rest of the reply + clickable video link. */
  caption: string
}

/**
 * Split a custom-chatbot reply into the two-message welcome-video layout.
 *
 * @param customerReply  the bot reply (Markdown). Expected shape: "greeting\n\nrest".
 * @param videoUrl       the workspace welcome video URL.
 * @param language       customer language (for the intro line); falls back to en.
 * @returns the split, or null when no YouTube thumbnail can be resolved (caller
 *          should then fall back to the legacy inline-URL single message).
 */
export function buildWelcomeVideoSplit(
  customerReply: string,
  videoUrl: string,
  language?: string | null
): WelcomeVideoSplit | null {
  const imageUrl = youtubeThumbnail(videoUrl)
  if (!imageUrl) return null

  const intro = WELCOME_VIDEO_INTRO[language ?? "en"] ?? WELCOME_VIDEO_INTRO.en

  const breakIdx = customerReply.indexOf("\n\n")
  const greeting = breakIdx !== -1 ? customerReply.slice(0, breakIdx) : customerReply
  const rest = breakIdx !== -1 ? customerReply.slice(breakIdx + 2) : ""

  const textMessage = `${greeting}\n\n${intro}`
  const caption = [rest, videoUrl].filter(Boolean).join("\n\n")

  return { textMessage, imageUrl, caption }
}
