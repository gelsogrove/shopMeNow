import { useEffect, useRef, useState } from "react"
import { Smile } from "lucide-react"

/**
 * EmojiPicker — a small, dependency-free WhatsApp-style emoji picker.
 *
 * Renders a 🙂 toggle button; clicking it opens a popover with a curated set of
 * the emojis people actually use on WhatsApp, grouped by category. Selecting one
 * calls `onSelect(emoji)` (the parent inserts it into its text state). Emojis are
 * plain Unicode text, so they flow through the normal send path unchanged.
 *
 * No external library (project guideline: avoid heavy deps). All UI text is in
 * English (project rule #15).
 */

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  disabled?: boolean
  /** Tailwind size classes for the toggle button (default matches a 40px input). */
  className?: string
}

// Curated, intentionally compact. Covers the everyday WhatsApp range without
// shipping a 1800-emoji dataset.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "😘",
      "😜", "🤔", "🤩", "🥳", "😎", "😏", "😴", "😅", "😢", "😭",
      "😡", "🥺", "😱", "🤗", "🤫", "🙃", "😬", "😌",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍", "👎", "👌", "🙏", "👏", "🙌", "🤝", "💪", "👋", "✌️",
      "🤙", "👀", "🫶", "🤞", "☝️", "✋",
    ],
  },
  {
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️",
      "💕", "💯",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "🔥", "✨", "🎉", "🎁", "✅", "❌", "⚠️", "⭐", "💰", "🛒",
      "📦", "📍", "📞", "⏰", "☕", "🍕", "🚀", "📷",
    ],
  },
]

export function EmojiPicker({ onSelect, disabled, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Insert emoji"
        title="Insert emoji"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={
          className ||
          "w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
        }
      >
        <Smile className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className="absolute bottom-12 left-0 z-50 w-[min(18rem,calc(100vw-2rem))] max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
        >
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {group.label}
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Insert ${emoji}`}
                    onClick={() => {
                      onSelect(emoji)
                      setOpen(false)
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-xl hover:bg-emerald-50"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default EmojiPicker
