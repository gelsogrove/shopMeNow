import { useCallback, useEffect, useRef, useState } from "react"

/**
 * The hero backdrop: muted clips of the territory cross-fading into one
 * another, with a still photo behind them (Andrea, 2026-09-15: "mi piacciono
 * quei siti dove hanno un video di background").
 *
 * 🚨 THE PHOTO IS NOT A PLACEHOLDER — it is the load-bearing layer.
 * The video is an enhancement painted on top, and it is skipped entirely when
 * it would do more harm than good:
 *
 *   - no files on disk       → photo only (this is the state today: drop the
 *                              mp4s in public/hero/ and they start playing)
 *   - `prefers-reduced-motion` → photo only, no autoplay
 *   - a metered/slow connection (`saveData`, 2g/3g) → photo only
 *
 * A tourist office is often on a rural connection, and a landing page that
 * pushes 8MB of video before anything renders is worse than one that shows a
 * sharp photo instantly.
 *
 * The DARK gradient over the top is what keeps the hero readable, and the
 * hero copy is white because of it. The earlier near-opaque white veil was
 * the usual failure of this pattern: it kept dark text legible by hiding the
 * very footage it was laid over. Dark veil + light copy shows the video AND
 * raises contrast; the login card stays solid white on purpose, because a
 * frosted form over moving video is where these designs become unusable.
 *
 * HOW THE CROSS-FADE WORKS — two <video> elements, never one.
 * A single element that swaps its `src` must tear down the decoder and buy a
 * new first frame, and for those few hundred milliseconds there is nothing to
 * show: the hero blinks back to the photo on every clip change. So both
 * elements stay mounted and alternate. While A plays, B has ALREADY loaded the
 * next clip; at the hand-over B starts and the two opacities cross. The viewer
 * sees a dissolve, never a gap.
 */

/**
 * The clips, played in order and then looped (Andrea, 2026-09-15: "montagna,
 * attivita' sci, cavallo, rafting, prodotti… magari piu' di uno in serie").
 *
 * One season or one sport sells one holiday; a sequence sells a territory
 * that is worth coming back to in another month — which is exactly what the
 * push campaigns further down the page are for.
 *
 * Drop any of these at public/hero/ and they join the rotation. Missing files
 * are skipped, not awaited: the page never waits for a file that is not there,
 * and with NONE of them present the photo alone carries the hero exactly as
 * it does today. Order matters — this is the order they play in.
 */
const CLIPS = [
  "/hero/mountain.mp4",
  "/hero/ski.mp4",
  "/hero/horse.mp4",
  "/hero/rafting.mp4",
  "/hero/food.mp4",
]

/** Already in the repo: a real hotel in Sappada with the mountains behind. */
const POSTER_SRC = "/sappada/bach-boutique-hotel.jpg"

/**
 * Seconds of overlap. The outgoing clip is still playing underneath for this
 * long, which is what makes it a dissolve rather than a cut — and it is why
 * the hand-over starts BEFORE the clip ends rather than on its 'ended' event.
 */
const FADE_SECONDS = 1.2

export function HeroBackdrop() {
  /** The clips that actually exist on disk, in CLIPS order. */
  const [clips, setClips] = useState<string[]>([])
  /** Which of the two <video> slots is currently in front. */
  const [front, setFront] = useState(0)
  /** Which clip each slot holds. Slot 0 opens on the first, slot 1 on the next. */
  const [sources, setSources] = useState<[string | null, string | null]>([null, null])

  const slotA = useRef<HTMLVideoElement>(null)
  const slotB = useRef<HTMLVideoElement>(null)
  const slots = [slotA, slotB]
  /** Guards against the timeupdate handler firing the same hand-over twice. */
  const swapping = useRef(false)
  /** Index of the clip playing in front, so we know what to queue next. */
  const playing = useRef(0)

  useEffect(() => {
    // Respect the OS "reduce motion" setting: a looping background is exactly
    // the kind of thing it is meant to stop.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    // Don't spend someone's data plan on decoration.
    const conn = (navigator as any).connection
    if (conn?.saveData) return
    if (/(^|-)(2g|3g)$/.test(conn?.effectiveType ?? "")) return

    // Ask for all of them at once and keep the ones that answer, preserving
    // CLIPS order. A HEAD costs nothing and means a missing file never shows
    // as a black frame mid-rotation.
    let cancelled = false
    Promise.all(
      CLIPS.map((src) =>
        fetch(src, { method: "HEAD" })
          .then((res) => (res.ok ? src : null))
          .catch(() => null)
      )
    ).then((found) => {
      if (cancelled) return
      const available = found.filter((src): src is string => src !== null)
      if (available.length === 0) return
      // Slot 0 shows the first clip; slot 1 pre-loads the second (or the same
      // one again when there is only one, so the loop still dissolves).
      setSources([available[0], available[1 % available.length]])
      setClips(available)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Hand over to the other slot: start it, bring it to the front, and queue
   * the clip after next into the slot just vacated — so the next hand-over is
   * again against a video that has already buffered.
   */
  const handOver = useCallback(() => {
    if (swapping.current || clips.length === 0) return
    swapping.current = true

    const next = (front + 1) % 2
    const nextVideo = slots[next].current
    if (nextVideo) {
      nextVideo.currentTime = 0
      // Autoplay can still be refused (a background tab, an aggressive policy).
      // Nothing to recover: the outgoing clip stays on screen under the photo.
      nextVideo.play().catch(() => {})
    }

    playing.current = (playing.current + 1) % clips.length
    setFront(next)

    // Queue the one AFTER the incoming clip into the slot going to the back.
    // Deferred past the fade so swapping the src cannot disturb a frame that
    // is still visible underneath.
    const upcoming = clips[(playing.current + 1) % clips.length]
    window.setTimeout(() => {
      setSources((cur) => {
        const copy: [string | null, string | null] = [cur[0], cur[1]]
        copy[front] = upcoming
        return copy
      })
      swapping.current = false
    }, FADE_SECONDS * 1000)
  }, [clips, front])

  /**
   * Start the dissolve FADE_SECONDS before the end instead of waiting for
   * 'ended': by the time that event fires the last frame is already frozen on
   * screen, which reads as a stall.
   */
  const onTimeUpdate = useCallback(
    (slot: number) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (slot !== front) return
      const v = e.currentTarget
      if (!Number.isFinite(v.duration)) return
      if (v.duration - v.currentTime <= FADE_SECONDS) handOver()
    },
    [front, handOver]
  )

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <img src={POSTER_SRC} alt="" className="h-full w-full object-cover" />

      {sources.map((src, slot) =>
        src ? (
          <video
            key={slot}
            ref={slots[slot]}
            className="absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out"
            style={{
              opacity: slot === front ? 1 : 0,
              transitionDuration: `${FADE_SECONDS}s`,
            }}
            src={src}
            // Only the front slot autoplays on mount; the other is primed and
            // started by handOver.
            autoPlay={slot === 0}
            muted
            // A single clip loops on its own — there is nothing to cross to.
            loop={clips.length === 1}
            playsInline
            preload="auto"
            onTimeUpdate={onTimeUpdate(slot)}
            // Belt and braces: if a clip is shorter than the fade, or metadata
            // never arrives, 'ended' still moves the rotation along.
            onEnded={() => slot === front && handOver()}
            // A clip that fails mid-rotation must not freeze the hero.
            onError={() => slot === front && handOver()}
          />
        ) : null
      )}

      {/* Readability layer — DARK, not white.
          A near-opaque white veil (from-white/95) left the video showing at
          about 5%: technically playing, effectively invisible, which defeats
          the point of shipping video at all (Andrea, 2026-09-15: "ovviamente
          non troppe cose altrimenti nascondiamo il video giusto?").
          Dark instead: the footage stays clearly visible while white copy on
          top gains MORE contrast than dark copy ever had. Heaviest at the very
          top (behind the header) and at the bottom (where the section hands
          over to the white page below), lightest through the middle where the
          picture does its work. */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/35 to-slate-950/75" />

      {/* The hand-off into the page: the last few hundred pixels resolve to
          the page's own white so the section ends without a seam. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
    </div>
  )
}
