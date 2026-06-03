import { useEffect, useRef, useState } from "react"
import { SmilePlus } from "lucide-react"
import { REACTION_EMOJIS } from "./reactionEmojis"

/**
 * ReactionPicker — a WhatsApp-style reaction bar.
 *
 * Mirrors WhatsApp's UX: a rounded white pill with the quick-reaction emojis
 * that grow on hover, plus a "+" that expands the full set. Clicking an emoji
 * fires `onReact(emoji)`. The component is presentational; the parent decides
 * when to show it (typically on hover over a message bubble) and where.
 *
 * Plain Unicode emojis (same glyphs WhatsApp uses). English labels (rule #15).
 */

// WhatsApp shows ~6 quick reactions + a plus. We surface the most common ones
// first; the "+" reveals the rest.
const QUICK_COUNT = 7

export interface ReactionPickerProps {
  onReact: (emoji: string) => void
  disabled?: boolean
  /** Extra classes for the outer pill (positioning is the parent's job). */
  className?: string
}

export function ReactionPicker({ onReact, disabled, className }: ReactionPickerProps) {
  const [expanded, setExpanded] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!expanded) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [expanded])

  const quick = REACTION_EMOJIS.slice(0, QUICK_COUNT)
  const rest = REACTION_EMOJIS.slice(QUICK_COUNT)

  const Emoji = ({ emoji, label }: { emoji: string; label: string }) => (
    <button
      type="button"
      aria-label={`React with ${label}`}
      title={label}
      disabled={disabled}
      onClick={() => {
        onReact(emoji)
        setExpanded(false)
      }}
      className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 disabled:opacity-50"
    >
      {emoji}
    </button>
  )

  return (
    <div
      ref={rootRef}
      className={
        "relative inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-white px-1.5 py-1 shadow-lg " +
        (className || "")
      }
    >
      {quick.map((r) => (
        <Emoji key={r.emoji} emoji={r.emoji} label={r.label} />
      ))}

      {rest.length > 0 && (
        <button
          type="button"
          aria-label="More reactions"
          title="More"
          disabled={disabled}
          onClick={() => setExpanded((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-emerald-600 disabled:opacity-50"
        >
          <SmilePlus className="h-4 w-4" />
        </button>
      )}

      {expanded && rest.length > 0 && (
        <div className="absolute bottom-10 right-0 z-50 grid w-56 grid-cols-8 gap-0.5 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
          {rest.map((r) => (
            <Emoji key={r.emoji} emoji={r.emoji} label={r.label} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ReactionPicker
