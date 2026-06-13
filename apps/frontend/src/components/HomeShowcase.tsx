import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Loader2, MapPin, Mic, Play } from "lucide-react"

// ---------------------------------------------------------------------------
// HomeShowcase — dark marketing hero for the homepage.
// Title + subtitle on top, an animated WhatsApp phone on the left and the
// product's real capabilities on the right.
//
// It plays ONE continuous conversation (a Catalonia laundry customer whose
// broken-washer chat turns into opening a franchise in Sitges). As the story
// advances, the matching capability card highlights — so a visitor sees every
// feature in a single, natural flow.
//
// Capabilities mirror the product exactly (no invented features):
//   Welcome(+video) · Human escalation · Live translation · Franchising data ·
//   API connect · Audio · Push · Appointment booking.
// WhatsApp green (#25D366). No fixed language list — it speaks every language.
// Translated to it / en / es / de; fr / ca fall back to English.
// ---------------------------------------------------------------------------

type Lang = "it" | "en" | "es" | "de" | "fr" | "ca"

const WA_GREEN = "#25D366"

function pick(lang: Lang, it: string, en: string, es: string, de: string): string {
  switch (lang) {
    case "it":
      return it
    case "es":
      return es
    case "de":
      return de
    default:
      return en
  }
}

type Role = "in" | "out" | "op"
interface Msg {
  role: Role
  text?: string
  sub?: string
  rtl?: boolean
  audio?: boolean // voice-note bubble
  video?: boolean // video-message thumbnail above the text
  image?: boolean // promo-image card above the text (campaign demo)
  file?: boolean // document/invoice attachment card above the text
  fileName?: string // shown on the document card
  status?: boolean // centered system status pill (e.g. "connecting…")
  imgTitle?: string // promo banner: small caps title
  imgBig?: string // promo banner: big value (e.g. -20%)
  imgSmall?: string // promo banner: subtitle line
}
interface Feature {
  icon: string
  title: string
  desc: string
}
interface Step {
  feature: number // index into features[] to highlight
  msgs: Msg[]
  reset?: boolean // clears the chat (start of a fresh conversation)
}

function buildContent(lang: Lang) {
  const p = (it: string, en: string, es: string, de: string) => pick(lang, it, en, es, de)

  const title = p(
    "Tutto il tuo franchising su WhatsApp.",
    "Your whole franchise on WhatsApp.",
    "Toda tu franquicia en WhatsApp.",
    "Dein ganzes Franchise auf WhatsApp."
  )
  const subtitle = p(
    "Una sola AI che accoglie, traduce, si collega ai tuoi sistemi e si adatta alle specifiche di ogni franchising.",
    "One AI that welcomes, translates, connects to your systems and adapts to the specifics of every franchise.",
    "Una sola IA que da la bienvenida, traduce, se conecta a tus sistemas y se adapta a las particularidades de cada franquicia.",
    "Eine einzige KI, die begrüßt, übersetzt, sich mit deinen Systemen verbindet und sich an die Besonderheiten jedes Franchise anpasst."
  )
  const everyLang = p(
    "Parla ogni lingua del mondo.",
    "Speaks every language in the world.",
    "Habla todos los idiomas del mundo.",
    "Spricht jede Sprache der Welt."
  )
  const online = p("online", "online", "en línea", "online")
  const opLabel = p("OPERATORE", "OPERATOR", "OPERADOR", "MITARBEITER")
  const voiceLabel = p("Messaggio vocale", "Voice message", "Mensaje de voz", "Sprachnachricht")

  // 8 capability cards — ordered to match the story flow, so the highlight
  // moves top→bottom as the conversation plays. Indices referenced by script.
  const features: Feature[] = [
    {
      icon: "👋",
      title: p("Messaggio di benvenuto", "Welcome message", "Mensaje de bienvenida", "Willkommensnachricht"),
      desc: p(
        "Accoglie e guida ogni cliente, anche con un video.",
        "Welcomes and guides every customer, video included.",
        "Da la bienvenida y guía a cada cliente, con vídeo.",
        "Begrüßt und begleitet jeden Kunden, mit Video."
      ),
    },
    {
      icon: "🔗",
      title: p("Connessione API", "API connect", "Conexión API", "API-Anbindung"),
      desc: p(
        "Si collega ai tuoi sistemi: sblocca, fattura, traccia.",
        "Connects to your systems: unlock, invoice, track.",
        "Se conecta a tus sistemas: desbloquea, factura, rastrea.",
        "Verbindet sich mit deinen Systemen: entsperren, fakturieren, tracken."
      ),
    },
    {
      icon: "🙋",
      title: p("Scala a operatore", "Human escalation", "Escala a operador", "Übergabe an Mitarbeiter"),
      desc: p(
        "Passa a un operatore, con tutto il contesto.",
        "Hands off to a human, with full context.",
        "Pasa a un humano, con todo el contexto.",
        "Übergibt an einen Menschen, mit vollem Kontext."
      ),
    },
    {
      icon: "🎙️",
      title: p("Messaggi audio", "Audio messages", "Mensajes de audio", "Audionachrichten"),
      desc: p(
        "Capisce e risponde alle note vocali.",
        "Understands and replies to voice notes.",
        "Entiende y responde a las notas de voz.",
        "Versteht und beantwortet Sprachnachrichten."
      ),
    },
    {
      icon: "📍",
      title: p("Dati del franchising", "Franchising data", "Datos de la franquicia", "Franchise-Daten"),
      desc: p(
        "Prezzi, orari e promo giusti, per ogni sede.",
        "The right prices, hours and promos, per location.",
        "Precios, horarios y promos correctos, por sede.",
        "Die richtigen Preise, Zeiten und Aktionen, pro Standort."
      ),
    },
    {
      icon: "📅",
      title: p("Prenota appuntamenti", "Appointment booking", "Reserva de citas", "Terminbuchung"),
      desc: p(
        "Prenota, sposta o annulla appuntamenti via chat.",
        "Books, reschedules or cancels appointments in chat.",
        "Reserva, cambia o cancela citas por chat.",
        "Bucht, verschiebt oder storniert Termine im Chat."
      ),
    },
    {
      icon: "🌐",
      title: p("Operatore multilingua", "Multilingual operator", "Operador multilingüe", "Mehrsprachiger Mitarbeiter"),
      desc: p(
        "L'operatore scrive nella sua lingua, l'AI traduce in tempo reale.",
        "The operator writes in their language, the AI translates live.",
        "El operador escribe en su idioma, la IA traduce al instante.",
        "Der Mitarbeiter schreibt in seiner Sprache, die KI übersetzt in Echtzeit."
      ),
    },
    {
      icon: "🧾",
      title: p("Invio fatture e file", "Invoices & files", "Facturas y archivos", "Rechnungen & Dateien"),
      desc: p(
        "Invia fatture e documenti direttamente in chat.",
        "Sends invoices and documents right in the chat.",
        "Envía facturas y documentos en el chat.",
        "Sendet Rechnungen und Dokumente direkt im Chat."
      ),
    },
    {
      icon: "📣",
      title: p("Notifiche push", "Push notifications", "Notificaciones push", "Push-Benachrichtigungen"),
      desc: p(
        "Campagne e promo a tutti i clienti, in un clic.",
        "Campaigns and promos to all customers, in one click.",
        "Campañas y promos a todos los clientes, en un clic.",
        "Kampagnen und Aktionen an alle Kunden, mit einem Klick."
      ),
    },
  ]

  // ONE continuous story. Each step highlights a feature and shows its messages.
  const script: Step[] = [
    // 1 — Welcome (+video)
    {
      feature: 0,
      msgs: [
        { role: "in", text: p("Ciao, non mi funziona la lavatrice 😩", "Hi, my washer isn't working 😩", "Hola, mi lavadora no funciona 😩", "Hallo, meine Waschmaschine funktioniert nicht 😩") },
        { role: "out", text: p("Ciao e benvenuto in DemoWash! 👋 Sono il tuo assistente e sono qui per aiutarti 24/7 😊", "Hi and welcome to DemoWash! 👋 I'm your assistant, here to help you 24/7 😊", "¡Hola y bienvenido a DemoWash! 👋 Soy tu asistente y estoy aquí para ayudarte 24/7 😊", "Hallo und willkommen bei DemoWash! 👋 Ich bin dein Assistent und helfe dir rund um die Uhr 😊") },
        { role: "out", video: true, text: p("Ti mando una nostra presentazione 🎥 Guarda come funziona DemoWash", "I'll send you a quick presentation 🎥 See how DemoWash works", "Te envío una presentación 🎥 Mira cómo funciona DemoWash", "Ich schicke dir eine kurze Präsentation 🎥 Sieh dir an, wie DemoWash funktioniert") },
      ],
    },
    // 2 — API connect (unlock the machine)
    {
      feature: 1,
      msgs: [
        { role: "out", text: p("Qual è il numero della lavatrice?", "What's the washer number?", "¿Cuál es el número de la lavadora?", "Welche Nummer hat die Waschmaschine?") },
        { role: "in", text: p("La numero 4", "Number 4", "La número 4", "Die Nummer 4") },
        { role: "out", status: true, text: p("Connessione alla lavatrice 4…", "Connecting to washer 4…", "Conectando con la lavadora 4…", "Verbinde mit Waschmaschine 4…") },
        { role: "out", text: p("Fatto ✅ Lavatrice 4 sbloccata. Riprova pure!", "Done ✅ Washer 4 unlocked. Try again!", "Hecho ✅ Lavadora 4 desbloqueada. ¡Prueba de nuevo!", "Erledigt ✅ Waschmaschine 4 entsperrt. Versuch's nochmal!") },
      ],
    },
    // 3 — Human escalation
    {
      feature: 2,
      msgs: [
        { role: "in", text: p("Però voglio un rimborso per ieri.", "But I want a refund for yesterday.", "Pero quiero un reembolso de ayer.", "Aber ich möchte eine Rückerstattung für gestern.") },
        { role: "out", text: p("Ti passo Ana, la nostra operatrice 🙋", "Connecting you to Ana, our agent 🙋", "Te paso con Ana, nuestra operadora 🙋", "Ich verbinde dich mit Ana, unserer Mitarbeiterin 🙋") },
        { role: "op", text: p("Ciao, sono Ana del team 👋 Ho letto tutta la tua richiesta e mi dispiace per il disagio.", "Hi, I'm Ana from the team 👋 I've read your whole request and I'm sorry for the trouble.", "Hola, soy Ana del equipo 👋 He leído toda tu solicitud y siento las molestias.", "Hallo, ich bin Ana aus dem Team 👋 Ich habe deine ganze Anfrage gelesen und die Umstände tun mir leid.") },
      ],
    },
    // 4 — Audio
    {
      feature: 3,
      msgs: [
        { role: "in", audio: true },
        { role: "out", text: p("Ho ascoltato il tuo audio 🎙️ ti invieremo per email quanto richiesto.", "I've listened to your audio 🎙️ we'll email you what you requested.", "He escuchado tu audio 🎙️ te enviaremos por email lo solicitado.", "Ich habe deine Sprachnachricht angehört 🎙️ wir schicken dir das Gewünschte per E-Mail.") },
      ],
    },
    // 5 — Franchising data (asks the location first, then prices + loyalty card)
    {
      feature: 4,
      msgs: [
        { role: "in", text: p("Quanto costa un lavaggio?", "How much is a wash?", "¿Cuánto cuesta un lavado?", "Was kostet eine Wäsche?") },
        { role: "out", text: p("In quale sede ti trovi?", "Which location are you at?", "¿En qué sede estás?", "An welchem Standort bist du?") },
        { role: "in", text: p("A Barcellona", "In Barcelona", "En Barcelona", "In Barcelona") },
        { role: "out", text: p("📍 Sede di Barcellona\n🕗 Aperto 8:00–21:00\n🧺 Lavaggio 4,50 € · Asciugatura 3,00 €", "📍 Barcelona location\n🕗 Open 8:00–21:00\n🧺 Wash €4.50 · Dry €3.00", "📍 Sede de Barcelona\n🕗 Abierto 8:00–21:00\n🧺 Lavado 4,50 € · Secado 3,00 €", "📍 Standort Barcelona\n🕗 Geöffnet 8:00–21:00\n🧺 Waschen 4,50 € · Trocknen 3,00 €") },
        { role: "out", text: p("🎁 E con la carta fedeltà hai -10% sul primo lavaggio!", "🎁 And with the loyalty card you get -10% on your first wash!", "🎁 ¡Y con la tarjeta de fidelización tienes -10% en el primer lavado!", "🎁 Und mit der Treuekarte bekommst du -10% auf die erste Wäsche!") },
      ],
    },
    // 6 — Appointment booking (reset: a clean booking demo)
    {
      feature: 5,
      msgs: [
        { role: "in", text: p("Vorrei una consulenza per aprire una sede a Sitges 📈", "I'd like a consultation to open a location in Sitges 📈", "Quiero una consultoría para abrir una sede en Sitges 📈", "Ich hätte gern eine Beratung, um einen Standort in Sitges zu eröffnen 📈") },
        { role: "out", text: p("🎉 Ho questi orari disponibili 📅\n1️⃣ Mar 14 · 17:00\n2️⃣ Mer 15 · 10:00\n3️⃣ Gio 16 · 18:30", "🎉 Here are the available slots 📅\n1️⃣ Tue 14 · 17:00\n2️⃣ Wed 15 · 10:00\n3️⃣ Thu 16 · 18:30", "🎉 Tengo estos horarios disponibles 📅\n1️⃣ Mar 14 · 17:00\n2️⃣ Mié 15 · 10:00\n3️⃣ Jue 16 · 18:30", "🎉 Diese Termine sind verfügbar 📅\n1️⃣ Di 14 · 17:00\n2️⃣ Mi 15 · 10:00\n3️⃣ Do 16 · 18:30") },
        { role: "in", text: p("Il 2️⃣ è perfetto", "Number 2️⃣ is perfect", "El 2️⃣ es perfecto", "Nummer 2️⃣ ist perfekt") },
        { role: "out", text: p("✅ Confermato: Mer 15 alle 10:00\n📧 Ti ho inviato l'invito per il calendario via email, con la chiamata Zoom\n🔔 Ti ricordo il giorno prima", "✅ Confirmed: Wed 15 at 10:00\n📧 I've emailed you the calendar invite, with the Zoom call\n🔔 I'll remind you the day before", "✅ Confirmado: Mié 15 a las 10:00\n📧 Te he enviado la invitación del calendario por email, con la llamada de Zoom\n🔔 Te recuerdo el día antes", "✅ Bestätigt: Mi 15 um 10:00\n📧 Ich habe dir die Kalendereinladung per E-Mail geschickt, mit dem Zoom-Call\n🔔 Ich erinnere dich am Tag davor") },
      ],
    },
    // 7 — Multilingual operator (reset). The two-way magic must be VISIBLE:
    // the customer writes Arabic (sub: what the operator reads, in the
    // visitor's language), the operator types in the visitor's language
    // (sub: the Arabic the customer actually receives). AI translates live.
    {
      reset: true,
      feature: 6,
      msgs: [
        {
          role: "in",
          text: "مرحباً، هل طلبي جاهز للاستلام؟",
          rtl: true,
          sub: p(
            "🌐 L'operatore legge: «Ciao, il mio ordine è pronto per il ritiro?»",
            "🌐 The operator reads: “Hi, is my order ready for pickup?”",
            "🌐 El operador lee: «Hola, ¿mi pedido está listo para recoger?»",
            "🌐 Der Mitarbeiter liest: «Hallo, ist meine Bestellung abholbereit?»"
          ),
        },
        {
          role: "op",
          text: p(
            "Buongiorno! Sì, il suo ordine è pronto. La aspettiamo 😊",
            "Good morning! Yes, your order is ready. See you soon 😊",
            "¡Buenos días! Sí, tu pedido está listo. Te esperamos 😊",
            "Guten Morgen! Ja, deine Bestellung ist fertig. Bis gleich 😊"
          ),
          sub: p(
            "🌐 Il cliente riceve in arabo: «صباح الخير! نعم، طلبك جاهز للاستلام 😊»",
            "🌐 The customer receives it in Arabic: «صباح الخير! نعم، طلبك جاهز للاستلام 😊»",
            "🌐 El cliente lo recibe en árabe: «صباح الخير! نعم، طلبك جاهز للاستلام 😊»",
            "🌐 Der Kunde erhält es auf Arabisch: «صباح الخير! نعم، طلبك جاهز للاستلام 😊»"
          ),
        },
      ],
    },
    // 8 — Invoices & files (reset: the AI sends a document)
    {
      reset: true,
      feature: 7,
      msgs: [
        { role: "in", text: p("Posso avere la fattura del mio ultimo lavaggio?", "Can I get the invoice for my last wash?", "¿Me das la factura de mi último lavado?", "Kann ich die Rechnung für meine letzte Wäsche bekommen?") },
        { role: "out", text: p("Certo! Mi dici ragione sociale e P.IVA per la fattura? 🧾", "Sure! What's the company name and VAT number for the invoice? 🧾", "¡Claro! ¿Razón social y CIF para la factura? 🧾", "Klar! Wie lauten Firmenname und USt-IdNr. für die Rechnung? 🧾") },
        { role: "in", text: "Marta Ribas SRL · B12345678" },
        { role: "out", file: true, fileName: "Fattura-2026-0042.pdf", text: p("Fatto ✅ Ecco la tua fattura 🧾", "Done ✅ Here's your invoice 🧾", "Hecho ✅ Aquí tienes tu factura 🧾", "Erledigt ✅ Hier ist deine Rechnung 🧾") },
      ],
    },
    // 9 — Push notifications (reset: a standalone campaign broadcast, bot writes first)
    {
      reset: true,
      feature: 8,
      msgs: [
        {
          role: "out",
          image: true,
          imgTitle: p("DemoWash · Promo del mese", "DemoWash · Monthly promo", "DemoWash · Promo del mes", "DemoWash · Aktion des Monats"),
          imgBig: "-20%",
          imgSmall: p("sul prossimo lavaggio 🧺", "on your next wash 🧺", "en tu próximo lavado 🧺", "auf deine nächste Wäsche 🧺"),
          text: p("📣 La nostra promo del mese, per te! Ti aspettiamo 💚", "📣 Our promo of the month, just for you! See you soon 💚", "📣 ¡Nuestra promo del mes, para ti! Te esperamos 💚", "📣 Unsere Aktion des Monats, nur für dich! Wir freuen uns auf dich 💚"),
        },
      ],
    },
  ]

  return { title, subtitle, everyLang, online, opLabel, voiceLabel, features, script }
}

export function HomeShowcase({ lang = "en" }: { lang?: Lang }) {
  const c = buildContent(lang)
  const chatRef = useRef<HTMLDivElement>(null)
  const iRef = useRef(0) // driver's current flat message index (mutable, clickable)
  const [visible, setVisible] = useState(0) // number of revealed messages (flat)
  const [typing, setTyping] = useState(false) // bot "typing…" indicator
  const [activeFeature, setActiveFeature] = useState(0)

  // Flatten the script into a single ordered list of messages.
  const events = c.script.flatMap((stp) =>
    stp.msgs.map((m, mi) => ({ m, feature: stp.feature, resetStart: !!stp.reset && mi === 0 }))
  )

  // Drive the conversation like a real chat: one message at a time, with a
  // "typing…" pause before each reply and a 3s wait while "connecting".
  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const wait = (ms: number) =>
      new Promise<void>((res) => timers.push(setTimeout(res, ms)))
    const evs = c.script.flatMap((stp) =>
      stp.msgs.map((m, mi) => ({ m, feature: stp.feature, resetStart: !!stp.reset && mi === 0 }))
    )
    iRef.current = 0
    ;(async function run() {
      let prevFeature = -1
      while (!cancelled) {
        const i = iRef.current
        if (i >= evs.length) {
          await wait(3500)
          if (cancelled) return
          iRef.current = 0
          prevFeature = -1
          setVisible(0)
          continue
        }
        const { m, feature } = evs[i]
        const isBot = m.role === "out" || m.role === "op"
        // When the highlighted card changes, settle the highlight calmly first.
        if (feature !== prevFeature && prevFeature !== -1) {
          setActiveFeature(feature)
          await wait(1000)
          if (cancelled) return
          if (iRef.current !== i) continue
        }
        prevFeature = feature
        // Pause before revealing (typing for replies, a beat for the customer).
        if (m.status) {
          setTyping(false)
        } else if (isBot) {
          setTyping(true)
          await wait(m.video || m.image || m.file ? 1800 : 1500)
        } else {
          setTyping(false)
          await wait(1100)
        }
        if (cancelled) return
        if (iRef.current !== i) continue // a card click moved us — restart loop
        // Reveal this message + highlight its card together.
        setTyping(false)
        setActiveFeature(feature)
        setVisible(i + 1)
        iRef.current = i + 1
        // Hold: 3.5s while "connecting…", otherwise a calm reading pace.
        await wait(m.status ? 3500 : isBot ? 2300 : 1700)
      }
    })()
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [lang])

  // Show messages from the last reset boundary up to the revealed count.
  let start = 0
  for (let k = visible - 1; k >= 0; k--) {
    if (events[k]?.resetStart) {
      start = k
      break
    }
  }
  const slice = events.slice(start, visible)
  const bubbles = slice
    .map((ev, idx) => ({ key: `e${start + idx}`, m: ev.m, last: idx === slice.length - 1 }))
    // a "connecting…" status is transient: it vanishes once the result arrives
    .filter((b) => !b.m.status || b.last)

  // Keep the conversation scrolled to the latest message / typing indicator.
  useEffect(() => {
    const el = chatRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visible, typing])

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#070d18] p-6 shadow-2xl sm:p-8 lg:p-10">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl" style={{ background: `${WA_GREEN}26` }} />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />

      {/* Header — title + subtitle ABOVE the cards */}
      <div className="relative mb-8 max-w-2xl">
        <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl">{c.title}</h2>
        <p className="mt-2 text-slate-400">{c.subtitle}</p>
      </div>

      {/* Phone + capability cards */}
      <div className="relative grid grid-cols-1 items-start gap-10 lg:grid-cols-[25rem_34rem] lg:justify-center">
        {/* WhatsApp phone — live auto-play conversation on every size (mobile
            included), so the story plays the same as on desktop. */}
        <div className="mx-auto w-full max-w-[400px] lg:sticky lg:top-24">
          <div className="rounded-[2.25rem] bg-slate-950 p-3 shadow-2xl ring-1 ring-white/10">
            <div className="overflow-hidden rounded-[1.5rem] bg-[#ECE5DD]">
              {/* header */}
              <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: "#075E54" }}>
                {/* DW monogram logo — "D" white, "W" black */}
                <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold tracking-tight sm:h-9 sm:w-9 sm:text-sm" style={{ background: WA_GREEN }}>
                  <span className="text-white">D</span>
                  <span className="text-slate-900">W</span>
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">DemoWash</p>
                  <p className="flex items-center gap-1 text-[11px] text-white/70">
                    <MapPin className="h-3 w-3" /> {c.online}
                  </p>
                </div>
              </div>
              {/* messages — accumulate and scroll to the latest; reset on a
                  context change (final Arabic exchange / loop restart) */}
              <div
                ref={chatRef}
                className="h-[560px] overflow-y-auto px-3 py-3 text-sm [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
              >
                <div className="mt-auto flex min-h-full flex-col justify-end gap-2">
                  {bubbles.map(({ key, m }) => (
                    <ChatBubble key={key} m={m} opLabel={c.opLabel} voiceLabel={c.voiceLabel} />
                  ))}
                  {typing && <TypingDots />}
                </div>
              </div>
              {/* Fake WhatsApp composer — makes the mockup read as a real chat */}
              <div className="flex items-center gap-2 bg-[#F0F0F0] px-3 py-2.5">
                <div className="flex-1 rounded-full bg-white px-4 py-2 text-sm text-gray-400 shadow-sm">
                  {pick(lang, "Messaggio", "Message", "Mensaje", "Nachricht")}
                </div>
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                  style={{ background: WA_GREEN }}
                >
                  <Mic className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Capability cards */}
        <div className="space-y-2.5">
          {c.features.map((f, i) => (
            <button
              key={f.title}
              type="button"
              onClick={() => {
                const si = c.script.findIndex((s) => s.feature === i)
                if (si < 0) return
                const flatStart = c.script
                  .slice(0, si)
                  .reduce((n, s) => n + s.msgs.length, 0)
                setTyping(false)
                setActiveFeature(i)
                setVisible(flatStart)
                iRef.current = flatStart
              }}
              className="flex w-full items-start gap-4 rounded-2xl border px-5 py-3.5 text-left transition-all duration-500"
              style={
                i === activeFeature
                  ? { borderColor: WA_GREEN, background: WA_GREEN, boxShadow: `0 14px 34px -10px ${WA_GREEN}aa` }
                  : { borderColor: "rgba(255,255,255,0.10)", background: "rgba(15,23,42,0.40)" }
              }
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ background: i === activeFeature ? "rgba(7,94,84,0.14)" : "rgba(255,255,255,0.05)" }}
              >
                {f.icon}
              </span>
              <span>
                <span
                  className={`block font-bold ${i === activeFeature ? "" : "text-slate-200"}`}
                  style={i === activeFeature ? { color: "#075E54" } : undefined}
                >
                  {f.title}
                </span>
                <span
                  className={`mt-0.5 block text-sm ${i === activeFeature ? "" : "text-slate-400"}`}
                  style={i === activeFeature ? { color: "#075E54" } : undefined}
                >
                  {f.desc}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// One chat bubble. Bot/operator bubbles fade in after a short stagger, so the
// conversation reads as if it's being written live.
// "typing…" indicator shown on the bot side before each reply.
function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex justify-end"
    >
      <span className="flex items-center gap-1 rounded-2xl rounded-tr-sm px-3 py-2.5 shadow-sm" style={{ background: "#DCF8C6" }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-gray-500"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
    </motion.div>
  )
}

function ChatBubble({ m, opLabel, voiceLabel }: { m: Msg; opLabel: string; voiceLabel: string }) {
  // Centered system status (e.g. "connecting to the machine…") with a spinner.
  if (m.status) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-gray-500 shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" style={{ color: "#075E54" }} />
          {m.text}
        </span>
      </motion.div>
    )
  }
  const align = m.role === "out" ? "justify-end" : "justify-start"
  const bubbleBase = "max-w-[85%] rounded-2xl px-3 py-2 shadow-sm text-gray-900"
  const skin =
    m.role === "out"
      ? "rounded-tr-sm"
      : m.role === "op"
      ? "rounded-tl-sm"
      : "rounded-tl-sm bg-white"
  const style =
    m.role === "out" ? { background: "#DCF8C6" } : m.role === "op" ? { background: "#D8ECFF" } : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex ${align}`}
    >
      <div dir={m.rtl ? "rtl" : "ltr"} className={`${bubbleBase} ${skin}`} style={style}>
        {m.role === "op" && (
          <p className="mb-0.5 text-[10px] font-semibold" style={{ color: "#0a6cff" }}>
            {opLabel}
          </p>
        )}
        {m.file ? (
          <div className="space-y-1.5">
            <div className="flex w-56 items-center gap-3 rounded-lg bg-white/80 p-2 ring-1 ring-black/5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-lg">📄</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-gray-800">{m.fileName}</p>
                <p className="text-[11px] text-gray-500">PDF · 84 KB</p>
              </div>
            </div>
            {m.text && <p className="text-gray-800">{m.text}</p>}
          </div>
        ) : m.image ? (
          <div className="space-y-1.5">
            <div className="relative h-28 w-56 overflow-hidden rounded-lg bg-gradient-to-br from-emerald-500 to-green-700 p-3 text-white">
              <span className="absolute right-2 top-2 text-2xl">🎁</span>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">{m.imgTitle}</p>
              <p className="mt-1 text-3xl font-black leading-none">{m.imgBig}</p>
              <p className="mt-1 text-[11px] opacity-90">{m.imgSmall}</p>
              <span className="absolute bottom-2 right-2 text-2xl">🧺</span>
            </div>
            {m.text && <p className="text-gray-800">{m.text}</p>}
          </div>
        ) : m.video ? (
          <div className="space-y-1.5">
            <div className="relative flex h-24 w-48 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#075E54] to-emerald-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow">
                <Play className="ml-0.5 h-5 w-5 fill-current" style={{ color: "#075E54" }} />
              </span>
              <span className="absolute bottom-1 right-1.5 rounded bg-black/55 px-1 text-[10px] font-medium text-white">
                ▶ 2:14
              </span>
            </div>
            {m.text && <p className="text-gray-800">{m.text}</p>}
          </div>
        ) : m.audio ? (
          <div className="flex items-center gap-2 py-0.5">
            <Play className="h-4 w-4 fill-current" style={{ color: "#075E54" }} />
            <span className="flex items-end gap-[2px]">
              {[6, 11, 7, 14, 9, 13, 6, 10, 5].map((h, i) => (
                <span key={i} className="w-[2px] rounded-full" style={{ height: h, background: "#075E54", opacity: 0.5 }} />
              ))}
            </span>
            <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-gray-500">
              <Mic className="h-3 w-3" /> 0:08
            </span>
            <span className="sr-only">{voiceLabel}</span>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-line">{m.text}</p>
            {m.sub && (
              <p className="mt-1 border-t border-black/5 pt-1 text-[11px] italic text-gray-400" dir="ltr">
                {m.sub}
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
