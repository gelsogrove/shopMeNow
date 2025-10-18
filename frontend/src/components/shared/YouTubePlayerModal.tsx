import React, { useEffect } from "react"
import { X } from "lucide-react"
import { getYouTubeEmbedUrl } from "@/utils/youtubeUtils"

interface YouTubePlayerModalProps {
  /** ID del video YouTube da riprodurre */
  videoId: string | null
  /** Callback per chiudere la modal */
  onClose: () => void
}

/**
 * YouTubePlayerModal Component
 * 
 * Modal fullscreen per riprodurre video YouTube con:
 * - Player YouTube iframe (autoplay)
 * - Pulsante X in alto a destra per chiudere
 * - Click fuori dal player per chiudere
 * - ESC key per chiudere
 * - Responsive (16:9 aspect ratio)
 * 
 * @example
 * const [videoId, setVideoId] = useState<string | null>(null)
 * 
 * <YouTubePlayerModal
 *   videoId={videoId}
 *   onClose={() => setVideoId(null)}
 * />
 */
export const YouTubePlayerModal: React.FC<YouTubePlayerModalProps> = ({
  videoId,
  onClose,
}) => {
  // Non renderizzare se videoId è null
  if (!videoId) return null

  // ESC key per chiudere
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  // Prevent body scroll quando modal è aperta
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [])

  const embedUrl = getYouTubeEmbedUrl(videoId, true)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Video player"
    >
      {/* Container del player - click non chiude */}
      <div
        className="relative w-full max-w-5xl mx-4 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pulsante X chiusura - top right */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-red-500 transition-colors duration-200 z-10 bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
          aria-label="Chiudi video"
        >
          <X className="w-8 h-8" />
        </button>

        {/* Player YouTube - aspect ratio 16:9 */}
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embedUrl}
            title="YouTube video player"
            className="absolute top-0 left-0 w-full h-full rounded-lg shadow-2xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {/* Hint per chiudere (solo mobile) */}
        <div className="mt-4 text-center text-white text-sm opacity-75 md:hidden">
          Tocca fuori dal video o premi ESC per chiudere
        </div>
      </div>
    </div>
  )
}

/**
 * Custom CSS per animazioni (aggiungere a index.css o globals.css)
 * 
 * @keyframes fadeIn {
 *   from { opacity: 0; }
 *   to { opacity: 1; }
 * }
 * 
 * @keyframes slideUp {
 *   from {
 *     opacity: 0;
 *     transform: translateY(20px);
 *   }
 *   to {
 *     opacity: 1;
 *     transform: translateY(0);
 *   }
 * }
 * 
 * .animate-fadeIn {
 *   animation: fadeIn 0.2s ease-out;
 * }
 * 
 * .animate-slideUp {
 *   animation: slideUp 0.3s ease-out;
 * }
 */
