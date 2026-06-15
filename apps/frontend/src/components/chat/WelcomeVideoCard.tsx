/**
 * WelcomeVideoCard — the company presentation video shown ONLY on the chatbot's
 * first (welcome) reply.
 *
 * Behaviour: YouTube → plays in the in-app modal player (YouTubePlayerModal);
 * a direct .mp4 → inline <video> player. Reuses the existing shared components.
 *
 * The intro line ("ecco una breve presentazione 👇") is NOT rendered here: it is
 * authored by the LLM as part of the welcome message text, in the SAME language
 * as the rest of the reply, and rendered in the bubble ABOVE this card. This
 * guarantees a single language per message with no hardcoded translation map.
 *
 * NOTE: in-app playback requires the YouTube video to ALLOW embedding.
 */

import { useState } from "react"
import { YouTubePreview } from "@/components/shared/YouTubePreview"
import { YouTubePlayerModal } from "@/components/shared/YouTubePlayerModal"

interface WelcomeVideoCardProps {
  url: string
  /** Show a "DEMO" badge over the thumbnail (placeholder video). Default true. */
  demoBadge?: boolean
}

export function WelcomeVideoCard({ url, demoBadge = true }: WelcomeVideoCardProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  if (!url) return null

  const isMp4 = /\.mp4(\?.*)?$/i.test(url)

  return (
    <div className="my-3 flex flex-col items-start gap-2" data-testid="welcome-video-card">
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
