import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
 * These nine ship in public/hero/ — 360p clips from coverr.co (free for
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
 * alone carries the hero.
 *
 * The order here is NOT the playing order: the rotation is shuffled on every
 * visit, so no clip is condemned to be the one nobody ever reaches. Keep this
 * list grouped by theme for the humans reading it.
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
  /**
   * What the assistant answers (Andrea, 2026-09-15: "deve rispondere il
   * chatbot!!"). Without it the three dots typed forever and the demo showed
   * a bot that never delivers — the opposite of the point.
   *
   * Deliberately SHORT and specific: a real answer names a place, a time, a
   * number. Vague encouragement ("certo, ci sono tanti sentieri!") is exactly
   * what the rest of the page promises the product does NOT do.
   */
  reply: Record<string, string>
  /**
   * A follow-up message carrying a link and a phone number (Andrea,
   * 2026-09-15: "metti anche un secondo messaggio, ecco il link del posto —
   * ovviamente non e' cliccabile, e' giusto per far capire come funziona").
   *
   * It is a STILL: rendered as link-blue text but never an <a>, because this
   * is a picture of a conversation, not one you can have. The numbers are
   * invented and deliberately non-routable (the 0400 prefix does not exist in
   * Italy) so nobody's real line rings.
   */
  link: { label: string; phone: string }
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
    reply: {
      it: "Oggi sereno: il sentiero delle cascate, 40 min, ombra tutto il percorso 🌲",
      en: "Clear today: the waterfall trail, 40 min, shaded the whole way 🌲",
      es: "Hoy despejado: la ruta de las cascadas, 40 min, con sombra 🌲",
      ca: "Avui serè: el camí de les cascades, 40 min, amb ombra 🌲",
      fr: "Beau temps : le sentier des cascades, 40 min, à l'ombre 🌲",
      de: "Heute klar: der Wasserfallweg, 40 Min., durchgehend schattig 🌲",
    },
    link: { label: "sentieri.proloco.it/cascate", phone: "+39 0400 111 221" },
  },
  {
    // indoors: somewhere warm when the weather turns
    src: "/hero/bar.mp4",
    ask: {
      it: "Cosa facciamo se piove?",
      en: "What can we do if it rains?",
      es: "¿Qué hacemos si llueve?",
      ca: "Què fem si plou?",
      fr: "Que faire s'il pleut ?",
      de: "Was machen wir, wenn es regnet?",
    },
    reply: {
      it: "Il museo è aperto fino alle 18, e alle 17 c'è la degustazione in malga ☔",
      en: "The museum is open till 6pm, and there's a tasting at the dairy at 5 ☔",
      es: "El museo abre hasta las 18 h, y a las 17 h hay una cata ☔",
      ca: "El museu obre fins a les 18 h, i a les 17 h hi ha un tast ☔",
      fr: "Le musée est ouvert jusqu'à 18h, et dégustation à 17h ☔",
      de: "Das Museum hat bis 18 Uhr offen, um 17 Uhr gibt es eine Verkostung ☔",
    },
    link: { label: "museo.proloco.it/orari", phone: "+39 0400 111 232" },
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
    reply: {
      it: "Sì, alle 21 in piazza: coro di montagna, ingresso libero 🎶",
      en: "Yes, 9pm in the square: mountain choir, free entry 🎶",
      es: "Sí, a las 21 h en la plaza: coro de montaña, entrada libre 🎶",
      ca: "Sí, a les 21 h a la plaça: cor de muntanya, entrada lliure 🎶",
      fr: "Oui, 21h sur la place : chœur de montagne, entrée libre 🎶",
      de: "Ja, 21 Uhr auf dem Platz: Bergchor, Eintritt frei 🎶",
    },
    link: { label: "eventi.proloco.it/concerti", phone: "+39 0400 111 245" },
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
    reply: {
      it: "Al centro sportivo, aperto 9–18. Vi lascio il numero 📞",
      en: "At the sports centre, open 9–6. Here's the number 📞",
      es: "En el centro deportivo, abierto 9–18. Os paso el número 📞",
      ca: "Al centre esportiu, obert 9–18. Us passo el número 📞",
      fr: "Au centre sportif, ouvert 9h–18h. Voici le numéro 📞",
      de: "Im Sportzentrum, 9–18 Uhr geöffnet. Hier die Nummer 📞",
    },
    link: { label: "sport.proloco.it/noleggi", phone: "+39 0400 111 258" },
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
    reply: {
      it: "Sì, due noleggi in paese. Il più vicino a voi è a 300 m 🚲",
      en: "Yes, two rentals in the village. The nearest is 300 m away 🚲",
      es: "Sí, dos alquileres en el pueblo. El más cercano a 300 m 🚲",
      ca: "Sí, dos lloguers al poble. El més proper a 300 m 🚲",
      fr: "Oui, deux loueurs au village. Le plus proche à 300 m 🚲",
      de: "Ja, zwei Verleihe im Ort. Der nächste ist 300 m entfernt 🚲",
    },
    link: { label: "noleggi.proloco.it/ebike", phone: "+39 0400 111 264" },
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
    reply: {
      it: "Ultima risalita alle 16:30, rientro in valle entro le 17 ⛷️",
      en: "Last lift at 4:30pm, back in the valley by 5 ⛷️",
      es: "Último remonte a las 16:30, regreso antes de las 17 ⛷️",
      ca: "Últim remuntador a les 16:30, tornada abans de les 17 ⛷️",
      fr: "Dernière remontée à 16h30, retour avant 17h ⛷️",
      de: "Letzte Bergfahrt 16:30 Uhr, Rückkehr bis 17 Uhr ⛷️",
    },
    link: { label: "impianti.proloco.it/orari", phone: "+39 0400 111 277" },
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
    reply: {
      it: "Tre osterie in centro fanno piatti del posto: vi lascio indirizzi e numeri 🍽️",
      en: "Three inns in the centre serve local dishes — here are the addresses and numbers 🍽️",
      es: "Tres tabernas del centro sirven platos locales: os paso direcciones y teléfonos 🍽️",
      ca: "Tres tavernes del centre serveixen plats locals: us passo adreces i telèfons 🍽️",
      fr: "Trois auberges au centre servent local — voici adresses et numéros 🍽️",
      de: "Drei Gasthäuser im Zentrum kochen regional — hier Adressen und Nummern 🍽️",
    },
    link: { label: "osterie.proloco.it/tipici", phone: "+39 0400 111 283" },
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
    reply: {
      it: "Sì, 4 km pianeggianti, circa un'ora. Adatto anche ai passeggini 🚶",
      en: "Yes, 4 km flat, about an hour. Pushchair-friendly too 🚶",
      es: "Sí, 4 km llanos, una hora. Apto para carritos 🚶",
      ca: "Sí, 4 km plans, una hora. Apte per a cotxets 🚶",
      fr: "Oui, 4 km plats, environ une heure. Poussettes possibles 🚶",
      de: "Ja, 4 km eben, etwa eine Stunde. Auch mit Kinderwagen 🚶",
    },
    link: { label: "sentieri.proloco.it/lago", phone: "+39 0400 111 290" },
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
    reply: {
      it: "Aperto giovedì e domenica, 10–17. Visita guidata alle 11 🏰",
      en: "Open Thursdays and Sundays, 10–5. Guided tour at 11 🏰",
      es: "Abierto jueves y domingos, 10–17. Visita guiada a las 11 🏰",
      ca: "Obert dijous i diumenges, 10–17. Visita guiada a les 11 🏰",
      fr: "Ouvert jeudi et dimanche, 10h–17h. Visite guidée à 11h 🏰",
      de: "Donnerstag und Sonntag, 10–17 Uhr. Führung um 11 Uhr 🏰",
    },
    link: { label: "castello.proloco.it/visite", phone: "+39 0400 111 305" },
  },
]



/**
 * The guest the demo exchange is with (Andrea, 2026-09-15: "scrivi Ciao Luca,
 * e poi la frase"). A name in front of the answer shows the assistant knows
 * WHO is asking — on WhatsApp it always does, because the number is the
 * identity. That is the difference from a web widget, and it costs one word.
 */
const GUEST_NAME = "Luca"

/** Already in the repo: a real hotel in Sappada with the mountains behind. */
const POSTER_SRC = "/sappada/bach-boutique-hotel.jpg"

/**
 * Seconds of overlap. The outgoing clip is still playing underneath for this
 * long, which is what makes it a dissolve rather than a cut — and it is why
 * the hand-over starts BEFORE the clip ends rather than on its 'ended' event.
 */
const FADE_SECONDS = 1.2

/**
 * How long each clip holds before handing over, regardless of its own length.
 * Ten seconds is enough to read the question, watch the dots and take in the
 * answer without the hero feeling like it is stalling.
 */
const SCENE_SECONDS = 10

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
  /** Dots first, then the answer — the assistant has to actually reply. */
  const [answered, setAnswered] = useState(false)
  const replyTimer = useRef<number | null>(null)
  const { language } = useLanguage()
  /** Where the page wants the thread drawn. */
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setSlot(document.getElementById("hero-chat-slot"))
  }, [])

  const [sentAt] = useState(() =>
    new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  )

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

      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[available[i], available[j]] = [available[j], available[i]]
      }
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

  // Let the dots run for a beat, then answer. 1.4s is long enough to read as
  // "thinking" and short enough that nobody scrolls past before the payoff —
  // which is the whole point of the exchange (Andrea: "deve rispondere il
  // chatbot!!").
  useEffect(() => {
    if (!asking) return
    replyTimer.current = window.setTimeout(() => setAnswered(true), 1400)
    return () => {
      if (replyTimer.current) window.clearTimeout(replyTimer.current)
    }
  }, [asking, scene])

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
    setAnswered(false)
    if (replyTimer.current) window.clearTimeout(replyTimer.current)
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

  // Every scene lasts SCENE_SECONDS, then hands over. Clips loop in place if
  // they are shorter than that, so a 6-second file simply plays twice rather
  // than freezing on its last frame.
  useEffect(() => {
    if (clips.length < 2) return
    const t = window.setTimeout(handOver, SCENE_SECONDS * 1000)
    return () => window.clearTimeout(t)
  }, [scene, clips.length, handOver])

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
            loop
            playsInline
            preload="auto"
            // Shorter clips loop until their 10 seconds are up; the timer,
            // not the file, decides when to move on.
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

      {/* The question this clip provokes, staged as a real WhatsApp exchange.
          A plain white pill read as a tooltip, not as a message, and it sat in
          the band where the veil fades to white so it half-disappeared
          (Andrea, 2026-09-15: "non si vede la frase di whatsapp e non si
          capisce che e' di whatsapp… dagli un tocco").

          What makes it legible as WhatsApp, all of it borrowed from the real
          client: the #ECE5DD thread paper, the outgoing bubble in #D9FDD3 with
          its tail on the right, the timestamp and the BLUE double tick, and
          the reply typing underneath. Moved higher (bottom-24) so it sits on
          the dark part of the veil, and given a dark ring so it detaches from
          whatever frame is playing behind it. */}
      {/* The thread is rendered into #hero-chat-slot, which the page places
          in the hero's right column. See the note above. */}
      {clips.length > 0 && slot && createPortal(
          <div
            className={[
              "w-full max-w-lg rounded-2xl bg-[#ECE5DD] p-3.5 shadow-2xl shadow-slate-950/50 ring-1 ring-slate-950/10 transition-all duration-700 ease-out",
              asking ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            ].join(" ")}
          >
            {/* Outgoing: the guest's question. */}
            <div className="mt-1.5 flex justify-end">
              <span className="relative max-w-[85%] rounded-lg rounded-tr-sm bg-[#D9FDD3] px-3 py-2 text-sm leading-snug text-slate-900 shadow-sm">
                {clips[scene]?.ask[language] ?? clips[scene]?.ask.it}
                <span className="ml-2 inline-flex translate-y-[3px] items-center gap-0.5 text-[10px] text-slate-500">
                  {sentAt}
                  {/* Read receipt: two ticks, in WhatsApp's blue. */}
                  <svg viewBox="0 0 18 12" className="h-3 w-3 fill-none stroke-[#53BDEB] stroke-[1.8]" aria-hidden="true">
                    <path d="M1 6.5 4 9.5 10 2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 6.5 10 9.5 16 2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>
            </div>

            {/* Incoming: the assistant types, then answers. The dots alone
                showed a bot that never delivers. */}
            <div className="mt-1.5 flex justify-start">
              {answered ? (
                <div className="flex max-w-[90%] flex-col gap-1.5">
                  <span className="rounded-lg rounded-tl-sm bg-white px-3 py-2 text-sm leading-snug text-slate-900 shadow-sm">
                    Ciao {GUEST_NAME}, {clips[scene]?.reply[language] ?? clips[scene]?.reply.it}
                  </span>
                  {/* Not an <a>: a still of a conversation, not one you can have. */}
                  <span className="rounded-lg rounded-tl-sm bg-white px-3 py-2 text-sm leading-snug text-slate-900 shadow-sm">
                    <span className="text-[#027EB5] underline">
                      {clips[scene]?.link.label}
                    </span>
                    <br />
                    <span className="text-slate-600">{clips[scene]?.link.phone}</span>
                  </span>
                </div>
              ) : (
                <span className="flex items-center gap-1 rounded-lg rounded-tl-sm bg-white px-3 py-2.5 shadow-sm">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                      style={{ animationDelay: `${d * 140}ms` }}
                    />
                  ))}
                </span>
              )}
            </div>
          </div>
      , slot)}

    </div>
  )
}
