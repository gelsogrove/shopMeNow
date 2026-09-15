import { useEffect, useState } from "react"

/**
 * The hero backdrop: muted clips of the territory playing one after the other,
 * with a still photo behind them (Andrea, 2026-09-15: "mi piacciono quei siti
 * dove hanno un video di background").
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
 * The white gradient over the top is what keeps the hero readable: the copy
 * and the login form sit on this, and a busy frame under dark text is the
 * usual way these backgrounds go wrong.
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

export function HeroBackdrop() {
  /** The clips that actually exist on disk, in CLIPS order. */
  const [clips, setClips] = useState<string[]>([])
  /** Which one is on screen. Advances on 'ended', wraps to 0. */
  const [i, setI] = useState(0)

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
      if (available.length > 0) setClips(available)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <img
        src={POSTER_SRC}
        alt=""
        className="h-full w-full object-cover"
      />

      {clips.length > 0 && (
        <video
          // Remounting on the key restarts playback cleanly when the source
          // changes; without it Safari keeps the previous frame on screen.
          key={clips[i]}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000"
          src={clips[i]}
          onCanPlay={(e) => {
            e.currentTarget.style.opacity = "1"
          }}
          poster={POSTER_SRC}
          autoPlay
          muted
          // Loop only when it is the single clip available; otherwise the
          // sequence itself is the loop.
          loop={clips.length === 1}
          playsInline
          preload="auto"
          // Next clip, wrapping at the end.
          onEnded={() => setI((n) => (n + 1) % clips.length)}
          // A clip that fails mid-rotation must not freeze the hero: move on.
          onError={() => setI((n) => (n + 1) % clips.length)}
        />
      )}

      {/* Readability layer. Nearly opaque at the top where the heading and the
          login form sit, clearing towards the bottom so the image is still
          visible as an image. */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/90 to-white" />
    </div>
  )
}
