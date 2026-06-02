/**
 * WelcomeVideoCard — the company presentation video shown ONLY on the chatbot's
 * first (welcome) reply. Renders a short localized intro line above the video.
 *
 * Behaviour: YouTube → plays in the in-app modal player (YouTubePlayerModal);
 * a direct .mp4 → inline <video> player. Reuses the existing shared components.
 *
 * LANGUAGE: the intro line follows the conversation language. We resolve it
 * robustly: if the greeting text is in a non-Latin script (Arabic, etc.) we use
 * that script's language directly, otherwise we trust the passed `lang`
 * (customer.language). `dir="auto"` makes the phrase render RTL/LTR correctly.
 * Unknown languages fall back to English. (For FULL coverage of any language
 * the phrase could be LLM-generated as part of the welcome — see notes.)
 *
 * NOTE: in-app playback requires the YouTube video to ALLOW embedding.
 */

import { useState } from "react"
import { YouTubePreview } from "@/components/shared/YouTubePreview"
import { YouTubePlayerModal } from "@/components/shared/YouTubePlayerModal"

interface WelcomeVideoCardProps {
  url: string
  /** Conversation language (ISO 639-1) for the intro line. */
  lang?: string | null
  /** The greeting text — used to detect non-Latin scripts (e.g. Arabic). */
  greeting?: string
  /** Show a "DEMO" badge over the thumbnail (placeholder video). Default true. */
  demoBadge?: boolean
}

// Localized intro line shown above the presentation video. Falls back to en.
const INTRO: Record<string, string> = {
  es: "Antes de empezar, te dejo una breve presentación 👇",
  it: "Prima di iniziare, ecco una breve presentazione 👇",
  en: "Before we start, here's a short presentation 👇",
  ca: "Abans de començar, et deixo una breu presentació 👇",
  pt: "Antes de começar, deixo-te uma breve apresentação 👇",
  fr: "Avant de commencer, voici une brève présentation 👇",
  de: "Bevor wir beginnen, hier eine kurze Präsentation 👇",
  ar: "قبل أن نبدأ، إليك عرضًا تقديميًا موجزًا 👇",
}

// Detect a few unmistakable non-Latin scripts straight from the greeting, so
// the intro matches the reply even if customer.language wasn't persisted.
function detectScriptLang(text?: string): string | null {
  if (!text) return null
  if (/[؀-ۿ]/.test(text)) return "ar" // Arabic
  return null
}

export function WelcomeVideoCard({
  url,
  lang,
  greeting,
  demoBadge = true,
}: WelcomeVideoCardProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  if (!url) return null

  const isMp4 = /\.mp4(\?.*)?$/i.test(url)
  const resolvedLang = (detectScriptLang(greeting) || lang || "en").toLowerCase()
  const intro = INTRO[resolvedLang] || INTRO.en

  return (
    <div className="my-3 flex flex-col items-start gap-2" data-testid="welcome-video-card">
      <p className="text-sm" style={{ lineHeight: "1.5" }} dir="auto">
        {intro}
      </p>
      <div className="relative w-full max-w-[280px]">
        {/* "DEMO" badge — the presentation video is a placeholder. Hide by
            passing demoBadge={false} once a real company video is set. */}
        {demoBadge && (
          <span className="absolute left-2 top-2 z-10 rounded bg-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 shadow">
            Demo
          </span>
        )}
        {isMp4 ? (
          <video
            src={url}
            controls
            preload="metadata"
            className="w-full rounded-lg shadow"
          />
        ) : (
          <YouTubePreview url={url} onClick={(id) => setVideoId(id)} />
        )}
      </div>
      {!isMp4 && (
        <YouTubePlayerModal videoId={videoId} onClose={() => setVideoId(null)} />
      )}
    </div>
  )
}
