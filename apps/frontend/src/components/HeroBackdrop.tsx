import { useEffect, useState } from "react"

/**
 * The hero backdrop: a muted looping video of the territory, with a still
 * photo behind it (Andrea, 2026-09-15: "mi piacciono quei siti dove hanno un
 * video di background").
 *
 * 🚨 THE PHOTO IS NOT A PLACEHOLDER — it is the load-bearing layer.
 * The video is an enhancement painted on top, and it is skipped entirely when
 * it would do more harm than good:
 *
 *   - no file on disk        → photo only (this is the state today: drop an
 *                              mp4 at public/hero.mp4 and it starts playing)
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

const VIDEO_SRC = "/hero.mp4"
/** Already in the repo: a real hotel in Sappada with the mountains behind. */
const POSTER_SRC = "/sappada/bach-boutique-hotel.jpg"

export function HeroBackdrop() {
  const [playVideo, setPlayVideo] = useState(false)

  useEffect(() => {
    // Respect the OS "reduce motion" setting: a looping background is exactly
    // the kind of thing it is meant to stop.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    // Don't spend someone's data plan on decoration.
    const conn = (navigator as any).connection
    if (conn?.saveData) return
    if (/(^|-)(2g|3g)$/.test(conn?.effectiveType ?? "")) return

    // Only mount the <video> once we know the file is actually there, so a
    // missing hero.mp4 costs a HEAD request and nothing else.
    let cancelled = false
    fetch(VIDEO_SRC, { method: "HEAD" })
      .then((res) => {
        if (!cancelled && res.ok) setPlayVideo(true)
      })
      .catch(() => {
        /* no video: the photo already covers it */
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

      {playVideo && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
        />
      )}

      {/* Readability layer. Nearly opaque at the top where the heading and the
          login form sit, clearing towards the bottom so the image is still
          visible as an image. */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/90 to-white" />
    </div>
  )
}
