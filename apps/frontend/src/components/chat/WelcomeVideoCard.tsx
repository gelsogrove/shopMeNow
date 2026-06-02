/**
 * WelcomeVideoCard — the company presentation video shown ONLY on the chatbot's
 * first (welcome) reply. Renders a short localized intro line above the video.
 *
 * Behaviour: YouTube → plays in the in-app modal player (YouTubePlayerModal);
 * a direct .mp4 → inline <video> player. Reuses the existing shared components.
 *
 * NOTE: in-app playback requires the YouTube video to ALLOW embedding. If the
 * owner disabled embedding (e.g. the current demo placeholder), the embed shows
 * "This content is blocked" — in that case pick an embeddable video.
 */

import { useState } from "react"
import { YouTubePreview } from "@/components/shared/YouTubePreview"
import { YouTubePlayerModal } from "@/components/shared/YouTubePlayerModal"

interface WelcomeVideoCardProps {
  url: string
  /** Conversation language (ISO 639-1) for the intro line. Falls back to es. */
  lang?: string | null
  /** Show a "DEMO" badge over the thumbnail (placeholder video). Default true. */
  demoBadge?: boolean
}

// Localized intro line shown above the presentation video, in the 6 supported
// languages (+ de). Falls back to Spanish (the business default).
const INTRO: Record<string, string> = {
  es: "Antes de empezar, te dejo una breve presentación 👇",
  it: "Prima di iniziare, ecco una breve presentazione 👇",
  en: "Before we start, here's a short presentation 👇",
  ca: "Abans de començar, et deixo una breu presentació 👇",
  pt: "Antes de começar, deixo-te uma breve apresentação 👇",
  fr: "Avant de commencer, voici une brève présentation 👇",
  de: "Bevor wir beginnen, hier eine kurze Präsentation 👇",
}

export function WelcomeVideoCard({ url, lang, demoBadge = true }: WelcomeVideoCardProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  if (!url) return null

  const isMp4 = /\.mp4(\?.*)?$/i.test(url)
  const intro = INTRO[(lang || "es").toLowerCase()] || INTRO.es

  return (
    <div className="my-3 flex flex-col items-start gap-2" data-testid="welcome-video-card">
      <p className="text-sm" style={{ lineHeight: "1.5" }}>{intro}</p>
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
