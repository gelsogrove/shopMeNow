/**
 * AudioMessagePlayer — WhatsApp-style voice-note player for chat bubbles.
 *
 * Replaces the native <audio controls> (which looks nothing like WhatsApp)
 * with the familiar layout: round mic badge · play/pause · progress track
 * with a draggable round handle · elapsed/total time underneath. Used for
 * voice notes in both directions (customer recording and bot TTS reply).
 * English UI (rule #15).
 */
import { Mic, Pause, Play } from "lucide-react"
import { useRef, useState } from "react"

function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "0:00"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export function AudioMessagePlayer({
  src,
  title,
}: {
  src: string
  title?: string | null
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  // Chrome reports Infinity for MediaRecorder blobs until the file has been
  // scanned: seek far past the end once, then read the real duration back.
  const handleLoadedMetadata = () => {
    const el = audioRef.current
    if (!el) return
    if (Number.isFinite(el.duration)) {
      setDuration(el.duration)
      return
    }
    const fix = () => {
      el.removeEventListener("timeupdate", fix)
      el.currentTime = 0
      if (Number.isFinite(el.duration)) setDuration(el.duration)
    }
    el.addEventListener("timeupdate", fix)
    el.currentTime = 1e7
  }

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
    } else {
      void el.play().catch(() => setPlaying(false))
    }
  }

  const handleSeek = (value: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = value
    setCurrent(value)
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0

  return (
    <div
      className="flex w-[230px] max-w-full items-center gap-2 py-1"
      data-testid="audio-message-player"
      title={title || "Voice message"}
    >
      <style>{`
        .wa-audio-range {
          -webkit-appearance: none;
          appearance: none;
          height: 3px;
          border-radius: 9999px;
          outline: none;
          cursor: pointer;
        }
        .wa-audio-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 13px;
          width: 13px;
          border-radius: 50%;
          background: #ffffff;
          border: 1px solid #c8cdd1;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .wa-audio-range::-moz-range-thumb {
          height: 13px;
          width: 13px;
          border-radius: 50%;
          background: #ffffff;
          border: 1px solid #c8cdd1;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
      `}</style>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={() => {
          const d = audioRef.current?.duration
          if (d && Number.isFinite(d)) setDuration(d)
        }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrent(0)
        }}
      />
      {/* Round mic badge (WhatsApp shows the sender's avatar here) */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-inner">
        <Mic className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="shrink-0 text-[#54656F] transition-colors hover:text-[#3b4a54] focus:outline-none"
      >
        {playing ? (
          <Pause className="h-6 w-6 fill-current" />
        ) : (
          <Play className="h-6 w-6 fill-current" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={(e) => handleSeek(Number(e.target.value))}
          aria-label="Seek within voice message"
          className="wa-audio-range w-full"
          style={{
            background: `linear-gradient(to right, #25D366 ${progress}%, #c8cdd1 ${progress}%)`,
          }}
        />
        <span className="text-[11px] leading-none text-gray-500">
          {formatTime(playing || current > 0 ? current : duration)}
        </span>
      </div>
    </div>
  )
}

export default AudioMessagePlayer
