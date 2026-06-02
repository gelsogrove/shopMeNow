/**
 * WelcomeVideoCard — the company presentation video shown ONLY on the first
 * (welcome) message of a chat. Reuses the existing YouTube preview + modal
 * player. The URL field is flexible: a YouTube link renders the clickable
 * thumbnail card; a direct .mp4 renders an inline <video> player (so the same
 * config field can later point to a self-hosted video for native WhatsApp).
 */

import { useState } from "react"
import { YouTubePreview } from "@/components/shared/YouTubePreview"
import { YouTubePlayerModal } from "@/components/shared/YouTubePlayerModal"

interface WelcomeVideoCardProps {
  url: string
  align?: "left" | "right"
}

export function WelcomeVideoCard({ url, align = "right" }: WelcomeVideoCardProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  if (!url) return null

  const justify = align === "right" ? "justify-end" : "justify-start"
  const isMp4 = /\.mp4(\?.*)?$/i.test(url)

  return (
    <div className={`mt-2 flex ${justify}`} data-testid="welcome-video-card">
      <div className="w-full max-w-[280px]">
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
