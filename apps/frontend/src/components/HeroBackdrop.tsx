import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLanguage } from "@/contexts/LanguageContext"

declare global {
  interface Window {
    /** Set by the hero lede once it has finished typing. */
    __heroLedeDone?: boolean
  }
}

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
  /** Optional: a scene whose answer stands on its own shows no link bubble. */
  link?: { label: string; phone: string }
  /**
   * A video the assistant sends of the place itself (Andrea, 2026-09-15: "al
   * posto del link fai vedere un video che mandi sul posto"). Mutually
   * exclusive with `link` on a scene — the point is showing the OTHER media
   * type WhatsApp can carry, not stacking both on one reply. The label is
   * translated like ask/reply (Andrea: "i testi non sono tutti tradotti?") —
   * a caption under a video is still copy a visitor reads.
   */
  video?: { label: Record<string, string> }
  /**
   * The pinned location the assistant shares alongside the link (Andrea,
   * 2026-09-15: "e mandi la location !!!"). Like the link, it is a STILL:
   * rendered as a WhatsApp location card but never a real map link.
   *
   * Omitted when the answer offers SEVERAL places — pinning one of three
   * taverns contradicts the list the link points at. `name` is translated;
   * `address` is not — a street name/number reads the same in every language,
   * same as the invented phone numbers on `link`.
   */
  place?: { name: Record<string, string>; address: string }
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
      it: "Oggi è sereno: vi consiglio il sentiero delle cascate, 40 minuti e ombra per tutto il percorso 🌲 Mettete scarpe chiuse, l'ultimo tratto vicino all'acqua è scivoloso",
      en: "It's clear today: I'd suggest the waterfall trail, 40 minutes and shaded the whole way 🌲 Wear closed shoes — the last stretch near the water is slippery",
      es: "Hoy está despejado: os aconsejo la ruta de las cascadas, 40 minutos y con sombra todo el camino 🌲 Llevad calzado cerrado, el último tramo junto al agua resbala",
      ca: "Avui està serè: us aconsello el camí de les cascades, 40 minuts i amb ombra tot el recorregut 🌲 Porteu calçat tancat, l'últim tram vora l'aigua rellisca",
      fr: "Le temps est clair aujourd'hui : je vous conseille le sentier des cascades, 40 minutes et à l'ombre tout du long 🌲 Prenez des chaussures fermées, le dernier tronçon près de l'eau glisse",
      de: "Heute ist es klar: Ich empfehle den Wasserfallweg, 40 Minuten und durchgehend schattig 🌲 Ziehen Sie feste Schuhe an — das letzte Stück am Wasser ist rutschig",
    },
    video: {
      label: {
        it: "Video del sentiero",
        en: "Trail video",
        es: "Vídeo de la ruta",
        ca: "Vídeo del camí",
        fr: "Vidéo du sentier",
        de: "Wegvideo",
      },
    },
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
      it: "Con questo tempo vi consiglio il museo del paese, in centro: due sale su storia e tradizioni locali, e si sta all'asciutto ☔ Chiude alle 18, ultimo ingresso alle 17:30",
      en: "With this weather I'd suggest the village museum, right in the centre: two rooms on local history and traditions, and you'll stay dry ☔ It closes at 6pm, last entry 5:30",
      es: "Con este tiempo os aconsejo el museo del pueblo, en el centro: dos salas sobre historia y tradiciones locales, y se está seco ☔ Cierra a las 18 h, última entrada a las 17:30",
      ca: "Amb aquest temps us aconsello el museu del poble, al centre: dues sales sobre història i tradicions locals, i s'hi està eixut ☔ Tanca a les 18 h, última entrada a les 17:30",
      fr: "Avec ce temps, je vous conseille le musée du village, en plein centre : deux salles sur l'histoire et les traditions locales, et vous resterez au sec ☔ Il ferme à 18h, dernière entrée à 17h30",
      de: "Bei diesem Wetter empfehle ich das Dorfmuseum mitten im Zentrum: zwei Räume zu lokaler Geschichte und Tradition, und Sie bleiben trocken ☔ Es schließt um 18 Uhr, letzter Einlass 17:30",
    },
    place: {
      name: {
        it: "Museo del Paese",
        en: "Village Museum",
        es: "Museo del Pueblo",
        ca: "Museu del Poble",
        fr: "Musée du Village",
        de: "Dorfmuseum",
      },
      address: "Piazza Centrale, 3",
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
    reply: {
      it: "Al centro sportivo, aperto dalle 9 alle 18. Vi lascio il numero 📞 perché è fondamentale prenotare in anticipo: +39 0400 111 258. Vi ricordo inoltre di indossare il giubbotto salvagente durante l'attività 🛶",
      en: "At the sports centre, open 9 to 6. Here's the number 📞 — booking ahead is essential: +39 0400 111 258. And do remember to wear a life jacket while you're out 🛶",
      es: "En el centro deportivo, abierto de 9 a 18. Os paso el número 📞 porque es fundamental reservar con antelación: +39 0400 111 258. Y recordad llevar el chaleco salvavidas durante la actividad 🛶",
      ca: "Al centre esportiu, obert de 9 a 18. Us passo el número 📞 perquè és fonamental reservar amb antelació: +39 0400 111 258. I recordeu dur l'armilla salvavides durant l'activitat 🛶",
      fr: "Au centre sportif, ouvert de 9h à 18h. Voici le numéro 📞 car il est indispensable de réserver à l'avance : +39 0400 111 258. Pensez aussi à porter le gilet de sauvetage pendant l'activité 🛶",
      de: "Im Sportzentrum, von 9 bis 18 Uhr geöffnet. Hier die Nummer 📞 — eine Reservierung vorab ist unerlässlich: +39 0400 111 258. Denken Sie außerdem daran, während der Tour eine Schwimmweste zu tragen 🛶",
    },
    place: {
      name: {
        it: "Centro Sportivo",
        en: "Sports Centre",
        es: "Centro Deportivo",
        ca: "Centre Esportiu",
        fr: "Centre Sportif",
        de: "Sportzentrum",
      },
      address: "Via dello Sport, 14",
    },
  },
  {
    // action: cycling
    src: "/hero/bike.mp4",
    ask: {
      it: "Dove possiamo noleggiare bici oggi?",
      en: "Where can we rent bikes today?",
      es: "¿Dónde podemos alquilar bicis hoy?",
      ca: "On podem llogar bicis avui?",
      fr: "Où peut-on louer des vélos aujourd'hui ?",
      de: "Wo können wir heute Fahrräder mieten?",
    },
    reply: {
      it: "Sì, due noleggi in paese: il più vicino è a 300 m 🚲 Oggi però il tempo non promette bene, vi consiglio domani mattina",
      en: "Yes, two rentals in the village: the nearest is 300 m away 🚲 Today's weather doesn't look good though — I'd suggest tomorrow morning",
      es: "Sí, dos alquileres en el pueblo: el más cercano a 300 m 🚲 Pero hoy el tiempo no acompaña, os aconsejo mañana por la mañana",
      ca: "Sí, dos lloguers al poble: el més proper a 300 m 🚲 Però avui el temps no acompanya, us aconsello demà al matí",
      fr: "Oui, deux loueurs au village : le plus proche à 300 m 🚲 Mais la météo n'est pas bonne aujourd'hui, je conseille demain matin",
      de: "Ja, zwei Verleihe im Ort: der nächste ist 300 m entfernt 🚲 Heute wird das Wetter aber nicht gut — ich empfehle morgen früh",
    },
    link: { label: "noleggi.proloco.it/ebike", phone: "+39 0400 111 264" },
    place: {
      name: {
        it: "Noleggio Bici",
        en: "Bike Rental",
        es: "Alquiler de Bicis",
        ca: "Lloguer de Bicis",
        fr: "Location de Vélos",
        de: "Fahrradverleih",
      },
      address: "Via del Paese, 22",
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
    reply: {
      it: "Gli impianti chiudono alle 17:00. Vi consiglio di avviarvi per tempo verso valle, così da evitare di arrivare a ridosso della chiusura 😊",
      en: "The lifts close at 5pm. I'd suggest heading down in good time, so you don't arrive right on closing 😊",
      es: "Los remontes cierran a las 17:00. Os aconsejo bajar con tiempo, para no llegar justo al cierre 😊",
      ca: "Els remuntadors tanquen a les 17:00. Us aconsello baixar amb temps, per no arribar just al tancament 😊",
      fr: "Les remontées ferment à 17h. Je vous conseille de redescendre à temps, pour ne pas arriver juste à la fermeture 😊",
      de: "Die Lifte schließen um 17 Uhr. Ich empfehle, rechtzeitig ins Tal aufzubrechen, damit Sie nicht knapp vor Schluss ankommen 😊",
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
    reply: {
      it: "Tre osterie in centro fanno piatti del posto: vi lascio indirizzi e numeri 🍽️ La sera si riempiono, vi conviene prenotare un tavolo",
      en: "Three taverns in the centre serve local dishes: here are the addresses and numbers 🍽️ They fill up in the evening, so it's worth booking a table",
      es: "Tres tabernas en el centro sirven platos locales: os paso direcciones y números 🍽️ Por la noche se llenan, os conviene reservar mesa",
      ca: "Tres tavernes al centre fan plats del lloc: us passo adreces i números 🍽️ Al vespre s'omplen, us convé reservar taula",
      fr: "Trois auberges au centre servent les plats du coin : voici adresses et numéros 🍽️ Le soir elles affichent complet, mieux vaut réserver une table",
      de: "Drei Gasthäuser im Zentrum servieren lokale Gerichte: hier Adressen und Nummern 🍽️ Abends sind sie voll — reservieren Sie besser einen Tisch",
    },
    link: { label: "osterie.proloco.it/tipici", phone: "+39 0400 111 283" },
  },
  {
    // wide: an alpine lake
    src: "/hero/lake.mp4",
    ask: {
      it: "È possibile fare il giro del lago a piedi?",
      en: "Is it possible to walk around the lake?",
      es: "¿Es posible rodear el lago a pie?",
      ca: "És possible voltar el llac a peu?",
      fr: "Est-il possible de faire le tour du lac à pied ?",
      de: "Ist es möglich, den See zu Fuß zu umrunden?",
    },
    reply: {
      it: "Sì certo: i vostri bimbi di 8 e 9 anni sono abbastanza grandi per un percorso di media difficoltà, e oggi è una giornata stupenda per farlo, non sono previste piogge 🚶",
      en: "Yes of course: your children of 8 and 9 are big enough for a moderate route, and today is a perfect day for it — no rain forecast 🚶",
      es: "Sí, claro: vuestros niños de 8 y 9 años son bastante mayores para un recorrido de dificultad media, y hoy es un día estupendo para hacerlo, no se prevén lluvias 🚶",
      ca: "Sí, és clar: els vostres nens de 8 i 9 anys són prou grans per a un recorregut de dificultat mitjana, i avui és un dia esplèndid per fer-lo, no es preveuen pluges 🚶",
      fr: "Oui bien sûr : vos enfants de 8 et 9 ans sont assez grands pour un parcours de difficulté moyenne, et aujourd'hui est une journée idéale, aucune pluie prévue 🚶",
      de: "Ja, natürlich: Ihre Kinder mit 8 und 9 Jahren sind groß genug für eine mittelschwere Route, und heute ist ein herrlicher Tag dafür — es ist kein Regen angesagt 🚶",
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
      it: "Aperto giovedì e domenica, 10–17. C'è la visita guidata alle 11 🏰 Volete che vi prenoti la visita?",
      en: "Open Thursdays and Sundays, 10–5. There's a guided tour at 11 🏰 Would you like me to book you a place?",
      es: "Abierto jueves y domingos, 10–17. Hay visita guiada a las 11 🏰 ¿Queréis que os reserve la visita?",
      ca: "Obert dijous i diumenges, 10–17. Hi ha visita guiada a les 11 🏰 Voleu que us reservi la visita?",
      fr: "Ouvert jeudi et dimanche, 10h–17h. Il y a une visite guidée à 11h 🏰 Voulez-vous que je vous réserve une place ?",
      de: "Donnerstag und Sonntag, 10–17 Uhr. Um 11 Uhr gibt es eine Führung 🏰 Soll ich Ihnen die Führung reservieren?",
    },
    video: {
      label: {
        it: "Video di presentazione del castello",
        en: "Castle introduction video",
        es: "Vídeo de presentación del castillo",
        ca: "Vídeo de presentació del castell",
        fr: "Vidéo de présentation du château",
        de: "Vorstellungsvideo der Burg",
      },
    },
  },
]



/**
 * The guest the demo exchange is with (Andrea, 2026-09-15: "scrivi Ciao Luca,
 * e poi la frase"). A name in front of the answer shows the assistant knows
 * WHO is asking — on WhatsApp it always does, because the number is the
 * identity. That is the difference from a web widget, and it costs one word.
 *
 * It greets ONCE, on the opening scene only (Andrea, 2026-09-15: "fallo solo
 * una volta non sempre saluta! sembra ripetitivo"): a real conversation says
 * the name when it starts, not in front of every answer.
 */
const GUEST_NAME = "Luca"

/** "Apri in Google Maps" — the line under a shared WhatsApp location. */
const OPEN_IN_MAPS: Record<string, string> = {
  it: "Apri in Google Maps",
  en: "Open in Google Maps",
  es: "Abrir en Google Maps",
  ca: "Obre al Google Maps",
  fr: "Ouvrir dans Google Maps",
  de: "In Google Maps öffnen",
}

/** "Ciao Luca," — the opening greeting, in each language the hero speaks. */
const GREETING: Record<string, string> = {
  it: `Ciao ${GUEST_NAME},`,
  en: `Hi ${GUEST_NAME},`,
  es: `Hola ${GUEST_NAME},`,
  ca: `Hola ${GUEST_NAME},`,
  fr: `Bonjour ${GUEST_NAME},`,
  de: `Hallo ${GUEST_NAME},`,
}

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
 * Fourteen seconds — up from ten — to make room for ASK_DELAY_SECONDS: the
 * footage needs a few silent seconds up front before the chat card interrupts
 * it (Andrea, 2026-09-15: "animazione a destra non deve apparire subito...
 * fallo dopo alcuni secondi del video").
 */
const SCENE_SECONDS = 14

/**
 * How long the new clip plays on its own, in silence, before the chat card
 * dissolves in over it. Without this pause the card competed with the video
 * for the very first thing a visitor's eye catches.
 */
const ASK_DELAY_SECONDS = 3

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
    })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * The first question waits for the headline to finish typing (Andrea,
   * 2026-09-15: "il primo messaggio deve uscire solo quando la frase è
   * finita") — two things animating at once means neither gets read.
   *
   * The page fires `hero:lede-done` from the Typewriter's onDone. The flag on
   * window covers the race where typing finishes before this effect mounts;
   * the fallback timer covers a hero rendered without a Typewriter at all.
   */
  useEffect(() => {
    if (clips.length === 0) return
    if (window.__heroLedeDone) {
      const t = window.setTimeout(() => setAsking(true), 400)
      return () => window.clearTimeout(t)
    }
    const onLedeDone = () => setAsking(true)
    window.addEventListener("hero:lede-done", onLedeDone, { once: true })
    // Nothing is listening for us to give up on: if the sentence never
    // reports back, the conversation still happens.
    const fallback = window.setTimeout(() => setAsking(true), 9000)
    return () => {
      window.removeEventListener("hero:lede-done", onLedeDone)
      window.clearTimeout(fallback)
    }
  }, [clips.length])

  // Let the dots run for a beat, then answer. 1.4s is long enough to read as
  // "thinking" and short enough that nobody scrolls past before the payoff —
  // which is the whole point of the exchange (Andrea: "deve rispondere il
  // chatbot!!").
  useEffect(() => {
    if (!asking) return
    replyTimer.current = window.setTimeout(() => setAnswered(true), 1700)
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
    }, FADE_SECONDS * 1000)

    // The chat card waits its own beat after the fade settles, so the new
    // footage gets a few seconds of quiet before the card dissolves in.
    window.setTimeout(() => setAsking(true), ASK_DELAY_SECONDS * 1000)
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
              <span className="relative max-w-[85%] rounded-lg rounded-tr-sm bg-[#D9FDD3] px-3 py-2 leading-snug text-slate-900 shadow-sm" style={{ fontSize: 16 }}>
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
            <div className="mt-2.5 flex justify-start">
              {answered ? (
                <div className="flex max-w-[90%] flex-col gap-1.5">
                  <span className="rounded-lg rounded-tl-sm bg-white px-3 py-2 text-sm leading-snug text-slate-900 shadow-sm">
                    {scene === 0 ? `${GREETING[language] ?? GREETING.it} ` : ""}
                    {clips[scene]?.reply[language] ?? clips[scene]?.reply.it}
                  </span>
                  {/* Not an <a>: a still of a conversation, not one you can have. */}
                  {clips[scene]?.link && (
                    <span className="rounded-lg rounded-tl-sm bg-white px-3 py-2 text-sm leading-snug text-slate-900 shadow-sm">
                      <span className="text-[#027EB5] underline">
                        {clips[scene]?.link?.label}
                      </span>
                      <br />
                      <span className="text-slate-600">{clips[scene]?.link?.phone}</span>
                    </span>
                  )}
                  {/* A video the assistant sends of the place — same still-frame
                      rule as the map and the link: it is a picture of a chat,
                      the play button is not clickable. */}
                  {clips[scene]?.video && (
                    <span className="w-[13.5rem] max-w-full overflow-hidden rounded-lg rounded-tl-sm bg-white shadow-sm">
                      <span className="relative flex h-32 items-center justify-center bg-slate-800">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow">
                          <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-slate-800" aria-hidden="true">
                            <path d="M8 5v14l11-7Z" />
                          </svg>
                        </span>
                        <span className="absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          0:15
                        </span>
                      </span>
                      <span className="block px-3 py-2 text-sm leading-snug text-slate-900">
                        {clips[scene]?.video?.label[language] ?? clips[scene]?.video?.label.it}
                      </span>
                    </span>
                  )}
                  {/* The shared location, as WhatsApp renders one: a map
                      thumbnail with the pin, then the place and the line that
                      opens Google Maps. It does NOT fill the row — WhatsApp
                      sizes a location card to its thumbnail. Still a picture
                      of a chat: the map is drawn, nothing is clickable. */}
                  {clips[scene]?.place && (
                  <span className="w-[13.5rem] max-w-full overflow-hidden rounded-lg rounded-tl-sm bg-white shadow-sm">
                    <span className="relative flex h-24 items-center justify-center bg-[#e8eae6]">
                      {/* Stylised streets, so the thumbnail reads as a map. */}
                      <svg viewBox="0 0 200 80" className="absolute inset-0 h-full w-full" aria-hidden="true">
                        <path d="M0 52 H200" stroke="#ffffff" strokeWidth="7" fill="none" />
                        <path d="M0 22 H200" stroke="#ffffff" strokeWidth="4" fill="none" />
                        <path d="M58 0 V80" stroke="#ffffff" strokeWidth="5" fill="none" />
                        <path d="M142 0 V80" stroke="#ffffff" strokeWidth="4" fill="none" />
                        <rect x="66" y="28" width="34" height="18" fill="#dcdfda" />
                        <rect x="150" y="28" width="30" height="18" fill="#dcdfda" />
                        <rect x="12" y="58" width="34" height="16" fill="#dcdfda" />
                        <path d="M0 68 H200" stroke="#d6e8c8" strokeWidth="10" fill="none" />
                      </svg>
                      <svg viewBox="0 0 24 24" className="relative h-8 w-8 drop-shadow text-[#ea4335]" fill="currentColor" aria-hidden="true">
                        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                      </svg>
                    </span>
                    <span className="block px-3 py-2">
                      <span className="block text-sm font-medium leading-snug text-slate-900">
                        {clips[scene]?.place?.name[language] ?? clips[scene]?.place?.name.it}
                      </span>
                      <span className="block text-xs leading-snug text-slate-500">
                        {clips[scene]?.place?.address}
                      </span>
                      <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#027EB5]">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M3 11l18-8-8 18-2-8-8-2Z" strokeLinejoin="round" />
                        </svg>
                        {OPEN_IN_MAPS[language] ?? OPEN_IN_MAPS.it}
                      </span>
                    </span>
                  </span>
                  )}
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
