import { useEffect, useRef, useState } from "react"

/**
 * Types a sentence out character by character, with a blinking cursor
 * (Andrea, 2026-09-15: "puo' essere come un cursore che scrive come
 * un'animazione?").
 *
 * 🚨 THE TEXT IS ALWAYS IN THE DOM, in full, from the first paint.
 * The visible half is a span layered on top of an invisible copy of the whole
 * sentence, which is what reserves the height. Typing into an empty element
 * would grow it line by line and shove everything below down the page on every
 * few characters — and on the hero that means the pills jumping while the
 * visitor is reading them.
 *
 * It also means the full sentence is there for search engines and screen
 * readers: the invisible copy is the real content, the animated one is
 * aria-hidden decoration.
 *
 * Retypes whenever `text` changes, so switching language restarts it rather
 * than leaving half of the previous sentence on screen.
 */
export function Typewriter({
  text,
  className = "",
  /** Milliseconds per character. ~28ms reads as brisk typing, not as a stutter. */
  speed = 28,
  /** Pause before the first character — the caret blinks alone during it. */
  delay = 900,
  /**
   * Fired once the last character lands (and immediately under reduced
   * motion). The hero waits on it before starting its chat, so the visitor
   * reads the sentence first and the conversation second.
   */
  onDone,
}: {
  text: string
  className?: string
  speed?: number
  delay?: number
  onDone?: () => void
}) {
  const [shown, setShown] = useState(0)
  const done = shown >= text.length
  const timers = useRef<number[]>([])

  // Kept in a ref so an inline arrow from the caller does not restart typing
  // on every render of the page.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setShown(0)
    // Retyping (a language switch) means the sentence is unfinished again.
    window.__heroLedeDone = false

    // Respect the OS setting: a sentence assembling itself is exactly the kind
    // of motion "reduce motion" exists to stop. Show it whole instead.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length)
      onDoneRef.current?.()
      return
    }

    let i = 0
    const start = window.setTimeout(function tick() {
      i += 1
      setShown(i)
      if (i < text.length) {
        timers.current.push(window.setTimeout(tick, speed))
      } else {
        onDoneRef.current?.()
      }
    }, delay)
    timers.current.push(start)

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [text, speed, delay])

  return (
    <p className={`relative ${className}`}>
      {/* The full sentence, invisible: holds the height and is what a crawler
          or a screen reader reads. */}
      <span className="invisible">{text}</span>

      {/* The animated overlay. */}
      <span aria-hidden="true" className="absolute inset-0">
        {text.slice(0, shown)}
        <span
          className={[
            "ml-0.5 inline-block w-[3px] translate-y-[2px] self-center bg-current align-middle",
            // Blinks while waiting and once finished; solid while typing, where
            // the moving text already shows where it is and a blink reads as a
            // glitch.
            shown === 0 || done ? "animate-[caret_1s_steps(2,start)_infinite]" : "",
          ].join(" ")}
          style={{ height: "1em" }}
        />
      </span>
    </p>
  )
}
