import React from "react"
import { Play } from "lucide-react"
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from "@/utils/youtubeUtils"

interface YouTubePreviewProps {
  /** URL YouTube completo */
  url: string
  /** Callback quando si clicca sulla preview */
  onClick: (videoId: string) => void
  /** Classe CSS aggiuntiva */
  className?: string
}

/**
 * YouTubePreview Component
 * 
 * Mostra preview cliccabile di un video YouTube con:
 * - Thumbnail del video (maxresdefault)
 * - Icona play centrale semi-trasparente
 * - Effetto hover con ingrandimento
 * - Click → apre player in modal
 * 
 * @example
 * <YouTubePreview
 *   url="https://www.youtube.com/watch?v=Sy-K9HuZgYA"
 *   onClick={(videoId) => setSelectedVideo(videoId)}
 * />
 */
export const YouTubePreview: React.FC<YouTubePreviewProps> = ({
  url,
  onClick,
  className = "",
}) => {
  const videoId = extractYouTubeVideoId(url)

  if (!videoId) {
    // Fallback: mostra link normale se URL non valido
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {url}
      </a>
    )
  }

  const thumbnailUrl = getYouTubeThumbnailUrl(videoId)

  return (
    <div
      className={`relative group cursor-pointer rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105 ${className}`}
      onClick={() => onClick(videoId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(videoId)
        }
      }}
      aria-label="Riproduci video YouTube"
    >
      {/* Thumbnail YouTube */}
      <img
        src={thumbnailUrl}
        alt="YouTube video preview"
        className="w-full h-auto"
        onError={(e) => {
          // Fallback a hqdefault se maxresdefault non disponibile
          const img = e.target as HTMLImageElement
          if (img.src.includes("maxresdefault")) {
            img.src = getYouTubeThumbnailUrl(videoId, "hq")
          }
        }}
      />

      {/* Overlay scuro al hover */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-200" />

      {/* Icona Play centrale */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-red-600 bg-opacity-90 rounded-full p-4 group-hover:bg-opacity-100 group-hover:scale-110 transition-all duration-200 shadow-2xl">
          <Play className="w-8 h-8 text-white fill-white" />
        </div>
      </div>

      {/* Badge YouTube in basso a destra */}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 px-2 py-1 rounded text-white text-xs font-semibold">
        YouTube
      </div>
    </div>
  )
}
