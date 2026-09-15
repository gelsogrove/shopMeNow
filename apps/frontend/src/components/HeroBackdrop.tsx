import { useCallback, useEffect, useRef, useState } from "react"
import { useLanguage } from "@/contexts/LanguageContext"

/**
 * The hero backdrop: muted clips of the territory cross-fading into one
 * another, with a still photo behind them (Andrea, 2026-09-15: "mi piacciono
 * quei siti dove hanno un video di background").
 *
 * 🚨 THE PHOTO IS NOT A PLACEHOLDER — it is the load-bearing layer.
 * The video is an enhancement painted on top, and it is skipped entirely when
 * it would do more harm than good:
 *
 *   - a phone or tablet (< 1024px) → photo only: see the note above CLIPS
 *   - no files on disk       → photo only (drop mp4s in public/hero/ and they
 *                              join the rotation)
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
 * These ten ship in public/hero/ — 360p clips from coverr.co (free for
 * commercial use, no attribution required), 6 MB for the whole set, close to
 * the single hero video on the site this was modelled on. 360p is
 * deliberate: the footage sits behind a dark veil and is motion-blurred, so
 * resolution buys nothing a rural connection should pay for.
 *
 * 🚨 REPLACE THEM with the tenant's own footage when there is any — real
 * Sappada beats generic mountains, and these are placeholders with a licence,
 * not a final choice.
 *
 * Add or drop files freely: missing ones are skipped, not awaited, so the page
 * never waits for a file that is not there, and with NONE present the photo
 * alone carries the hero. Order matters — this is the order they play in.
 */
/**
 * Each clip carries the question a guest would actually ask while looking at
 * it (Andrea, 2026-09-15: "non so se sale bike? Dove possiamo andare a fare
 * una passeggiata e il chatbot risponde… ovviamente sincronizzate").
 *
 * This is the page's argument made visible: the footage shows the holiday,
 * the bubble shows the question it provokes, and the product is what answers.
 * A hero video that is only scenery says "nice place"; this one says "this is
 * what people ask us, all day".
 *
 * The questions are SHORT on purpose — a bubble competing with the headline
 * for attention loses, and loses the headline too.
 */
type Scene = {
  src: string
  /** it, en, es, ca, fr, de — same six the page's switcher offers. */
  ask: Record<string, string>
}

const CLIPS: Scene[] = [
  {
    // action: walking a misty forest trail
    src: "/hero/forest.mp4",
    ask: {
      it: "Dove possiamo andare a farci una passeggiata oggi?",
      en: "Where can we go for a walk today?",
      es: "¿Dónde podemos ir a dar un paseo hoy?",
      ca: "On podem anar a fer un tomb avui?",
      fr: "Où peut-on aller se promener aujourd'hui ?",
      de: "Wo können wir heute spazieren gehen?",
    },
  },
  {
    // action: a picnic — the one question that needs the live forecast
    src: "/hero/picnic.mp4",
    ask: {
      it: "Domani è una bella giornata per un picnic?",
      en: "Is tomorrow a good day for a picnic?",
      es: "¿Mañana es buen día para un picnic?",
      ca: "Demà fa bon dia per a un pícnic?",
      fr: "Demain, c'est un bon jour pour un pique-nique ?",
      de: "Ist morgen ein guter Tag für ein Picknick?",
    },
  },
  {
    // action: a live gig — tonight's events
    src: "/hero/music.mp4",
    ask: {
      it: "C'è musica dal vivo stasera?",
      en: "Is there live music tonight?",
      es: "¿Hay música en vivo esta noche?",
      ca: "Hi ha música en directe aquesta nit?",
      fr: "Y a-t-il de la musique live ce soir ?",
      de: "Gibt es heute Abend Livemusik?",
    },
  },
  {
    // action: on the water — points at a rental business
    src: "/hero/rafting.mp4",
    ask: {
      it: "Dove possiamo affittare una canoa?",
      en: "Where can we rent a canoe?",
      es: "¿Dónde podemos alquilar una canoa?",
      ca: "On podem llogar una canoa?",
      fr: "Où peut-on louer un canoë ?",
      de: "Wo können wir ein Kanu mieten?",
    },
  },
  {
    // action: cycling
    src: "/hero/bike.mp4",
    ask: {
      it: "Si noleggiano e-bike qui?",
      en: "Can we rent e-bikes here?",
      es: "¿Se alquilan bicis eléctricas aquí?",
      ca: "Es lloguen bicis elèctriques aquí?",
      fr: "Peut-on louer des vélos électriques ici ?",
      de: "Kann man hier E-Bikes mieten?",
    },
  },
  {
    // action: skiing the slope
    src: "/hero/ski.mp4",
    ask: {
      it: "A che ora chiudono gli impianti?",
      en: "When do the lifts close?",
      es: "¿A qué hora cierran los remontes?",
      ca: "A quina hora tanquen els remuntadors?",
      fr: "À quelle heure ferment les remontées ?",
      de: "Wann schließen die Lifte?",
    },
  },
  {
    // close: meat on the grill — where to eat the local food
    src: "/hero/food.mp4",
    ask: {
      it: "Dove si mangiano i prodotti tipici?",
      en: "Where can we eat the local food?",
      es: "¿Dónde se comen los productos típicos?",
      ca: "On es mengen els productes típics?",
      fr: "Où manger les produits locaux ?",
      de: "Wo isst man die regionalen Spezialitäten?",
    },
  },
  {
    // action: someone photographing the landscape
    src: "/hero/photo.mp4",
    ask: {
      it: "Dove si vedono i panorami più belli?",
      en: "Where are the best viewpoints?",
      es: "¿Dónde están los mejores miradores?",
      ca: "On són els millors miradors?",
      fr: "Où sont les plus beaux points de vue ?",
      de: "Wo sind die schönsten Aussichtspunkte?",
    },
  },
  {
    // wide: an alpine lake
    src: "/hero/lake.mp4",
    ask: {
      it: "Si fa il giro del lago a piedi?",
      en: "Can you walk around the lake?",
      es: "¿Se puede rodear el lago a pie?",
      ca: "Es pot voltar el llac a peu?",
      fr: "Peut-on faire le tour du lac à pied ?",
      de: "Kann man den See umrunden?",
    },
  },
  {
    // wide: a castle on the mountain
    src: "/hero/castle.mp4",
    ask: {
      it: "Si può visitare il castello?",
      en: "Can we visit the castle?",
      es: "¿Se puede visitar el castillo?",
      ca: "Es pot visitar el castell?",
      fr: "Peut-on visiter le château ?",
      de: "Kann man die Burg besichtigen?",
    },
  },
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
  /** The scenes whose clip actually exists on disk, in CLIPS order. */
  const [clips, setClips] = useState<Scene[]>([])
  /** Which of the two <video> slots is currently in front. */
  const [front, setFront] = useState(0)
  /** Which clip each slot holds. Slot 0 opens on the first, slot 1 on the next. */
  const [sources, setSources] = useState<[string | null, string | null]>([null, null])

  const slotA = useRef<HTMLVideoElement>(null)
  const slotB = useRef<HTMLVideoElement>(null)
  const slots = [slotA, slotB]
  /** Guards against the timeupdate handler firing the same hand-over twice. */
  const swapping = useRef(false)
  /** Index of the scene in front — drives both the queue and the bubble. */
  const playing = useRef(0)
  const [scene, setScene] = useState(0)
  /** The bubble is hidden during the dissolve, so it never straddles two clips. */
  const [asking, setAsking] = useState(false)
  const { language } = useLanguage()

  useEffect(() => {
    // Desktop only — see the note above CLIPS. matchMedia, not a resize
    // listener: this is decided once, and a phone does not become a desktop.
    const wide = window.matchMedia?.("(min-width: 1024px)").matches ?? true
    if (!wide) return

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
      CLIPS.map((scene) =>
        fetch(scene.src, { method: "HEAD" })
          .then((res) => (res.ok ? scene : null))
          .catch(() => null)
      )
    ).then((found) => {
      if (cancelled) return
      const available = found.filter((scene): scene is Scene => scene !== null)
      if (available.length === 0) return
      // Slot 0 shows the first clip; slot 1 pre-loads the second (or the same
      // one again when there is only one, so the loop still dissolves).
      setSources([available[0].src, available[1 % available.length].src])
      setClips(available)
      // Let the first clip establish the shot before the question appears.
      window.setTimeout(() => setAsking(true), 1200)
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
    // Hide the outgoing question immediately and bring the new one in once the
    // dissolve has settled: a bubble that outlives its own footage reads as a
    // caption for the wrong picture.
    setAsking(false)
    setScene(playing.current)

    // Queue the one AFTER the incoming clip into the slot going to the back.
    // Deferred past the fade so swapping the src cannot disturb a frame that
    // is still visible underneath.
    const upcoming = clips[(playing.current + 1) % clips.length].src
    window.setTimeout(() => {
      setSources((cur) => {
        const copy: [string | null, string | null] = [cur[0], cur[1]]
        copy[front] = upcoming
        return copy
      })
      swapping.current = false
      setAsking(true)
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

      {/* The question this clip provokes — see the note above CLIPS. */}
      {clips.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 hidden justify-center px-6 lg:flex">
          <div
            className={[
              "flex max-w-md items-end gap-2.5 transition-all duration-700 ease-out",
              asking ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            ].join(" ")}
          >
            <span className="rounded-2xl rounded-br-sm bg-white/95 px-4 py-2.5 text-sm font-medium text-slate-800 shadow-lg backdrop-blur-sm">
              {clips[scene]?.ask[language] ?? clips[scene]?.ask.it}
            </span>
            {/* The assistant, mid-answer: three dots say "it is replying" in
                every language, which a translated label could not. */}
            <span className="flex shrink-0 items-center gap-1 rounded-2xl rounded-bl-sm bg-emerald-600/95 px-3 py-3 shadow-lg">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90"
                  style={{ animationDelay: `${d * 140}ms` }}
                />
              ))}
            </span>
          </div>
        </div>
      )}

    </div>
  )
}
