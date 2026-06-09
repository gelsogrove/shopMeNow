import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
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
// Translated to it / en / es / pt; fr / ca fall back to English.
// ---------------------------------------------------------------------------

type Lang = "it" | "en" | "es" | "pt" | "fr" | "ca"

const WA_GREEN = "#25D366"

function pick(lang: Lang, it: string, en: string, es: string, pt: string): string {
  switch (lang) {
    case "it":
      return it
    case "es":
      return es
    case "pt":
      return pt
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
  const p = (it: string, en: string, es: string, pt: string) => pick(lang, it, en, es, pt)

  const title = p(
    "Tutto il tuo franchising su WhatsApp.",
    "Your whole franchise on WhatsApp.",
    "Toda tu franquicia en WhatsApp.",
    "Todo o teu franchising no WhatsApp."
  )
  const subtitle = p(
    "Una sola AI che accoglie, traduce, passa all'operatore, conosce ogni negozio, prenota, si collega ai tuoi sistemi e capisce gli audio.",
    "One AI that welcomes, translates, hands off to a human, knows every shop, books appointments, connects to your systems and understands voice notes.",
    "Una sola IA que da la bienvenida, traduce, pasa a un humano, conoce cada tienda, agenda, se conecta a tus sistemas y entiende los audios.",
    "Uma só IA que dá as boas-vindas, traduz, passa a um humano, conhece cada loja, marca, liga-se aos teus sistemas e entende áudios."
  )
  const everyLang = p(
    "Parla ogni lingua del mondo.",
    "Speaks every language in the world.",
    "Habla todos los idiomas del mundo.",
    "Fala todas as línguas do mundo."
  )
  const online = p("online", "online", "en línea", "online")
  const liveLabel = p("dal vivo", "live", "en vivo", "ao vivo")
  const opLabel = p("OPERATORE", "OPERATOR", "OPERADOR", "OPERADOR")
  const voiceLabel = p("Messaggio vocale", "Voice message", "Mensaje de voz", "Mensagem de voz")

  // 8 capability cards — ordered to match the story flow, so the highlight
  // moves top→bottom as the conversation plays. Indices referenced by script.
  const features: Feature[] = [
    {
      icon: "👋",
      title: p("Messaggio di benvenuto", "Welcome message", "Mensaje de bienvenida", "Mensagem de boas-vindas"),
      desc: p(
        "Accoglie e guida ogni cliente, anche con un video.",
        "Welcomes and guides every customer, video included.",
        "Da la bienvenida y guía a cada cliente, con vídeo.",
        "Recebe e orienta cada cliente, com vídeo."
      ),
    },
    {
      icon: "🔗",
      title: p("Connessione API", "API connect", "Conexión API", "Ligação API"),
      desc: p(
        "Si collega ai tuoi sistemi: sblocca, fattura, traccia.",
        "Connects to your systems: unlock, invoice, track.",
        "Se conecta a tus sistemas: desbloquea, factura, rastrea.",
        "Liga-se aos teus sistemas: desbloqueia, fatura, rastreia."
      ),
    },
    {
      icon: "🙋",
      title: p("Scala a operatore", "Human escalation", "Escala a operador", "Escala para operador"),
      desc: p(
        "Passa a un operatore, con tutto il contesto.",
        "Hands off to a human, with full context.",
        "Pasa a un humano, con todo el contexto.",
        "Passa a um humano, com todo o contexto."
      ),
    },
    {
      icon: "🎙️",
      title: p("Messaggi audio", "Audio messages", "Mensajes de audio", "Mensagens de áudio"),
      desc: p(
        "Capisce e risponde alle note vocali.",
        "Understands and replies to voice notes.",
        "Entiende y responde a las notas de voz.",
        "Entende e responde às notas de voz."
      ),
    },
    {
      icon: "📍",
      title: p("Dati del franchising", "Franchising data", "Datos de la franquicia", "Dados do franchising"),
      desc: p(
        "Prezzi, orari e promo giusti, per ogni sede.",
        "The right prices, hours and promos, per location.",
        "Precios, horarios y promos correctos, por sede.",
        "Preços, horários e promos certos, por unidade."
      ),
    },
    {
      icon: "📅",
      title: p("Prenota appuntamenti", "Appointment booking", "Reserva de citas", "Marcação de consultas"),
      desc: p(
        "Prenota, sposta o annulla appuntamenti via chat.",
        "Books, reschedules or cancels appointments in chat.",
        "Reserva, cambia o cancela citas por chat.",
        "Marca, remarca ou cancela consultas por chat."
      ),
    },
    {
      icon: "🌐",
      title: p("Operatore multilingua", "Multilingual operator", "Operador multilingüe", "Operador multilíngue"),
      desc: p(
        "Operatore e cliente, ognuno nella sua lingua.",
        "Operator and customer, each in their own language.",
        "Operador y cliente, cada uno en su idioma.",
        "Operador e cliente, cada um na sua língua."
      ),
    },
    {
      icon: "🧾",
      title: p("Invio fatture e file", "Invoices & files", "Facturas y archivos", "Faturas e ficheiros"),
      desc: p(
        "Invia fatture e documenti direttamente in chat.",
        "Sends invoices and documents right in the chat.",
        "Envía facturas y documentos en el chat.",
        "Envia faturas e documentos no chat."
      ),
    },
    {
      icon: "📣",
      title: p("Notifiche push", "Push notifications", "Notificaciones push", "Notificações push"),
      desc: p(
        "Campagne e promo a tutti i clienti, in un clic.",
        "Campaigns and promos to all customers, in one click.",
        "Campañas y promos a todos los clientes, en un clic.",
        "Campanhas e promos a todos os clientes, num clique."
      ),
    },
  ]

  // ONE continuous story. Each step highlights a feature and shows its messages.
  const script: Step[] = [
    // 1 — Welcome (+video)
    {
      feature: 0,
      msgs: [
        { role: "in", text: p("Ciao, non mi funziona la lavatrice 😩", "Hi, my washer isn't working 😩", "Hola, mi lavadora no funciona 😩", "Olá, a minha máquina não funciona 😩") },
        { role: "out", text: p("Ciao e benvenuto in DemoWash! 👋 Sono il tuo assistente e sono qui per aiutarti 24/7 😊", "Hi and welcome to DemoWash! 👋 I'm your assistant, here to help you 24/7 😊", "¡Hola y bienvenido a DemoWash! 👋 Soy tu asistente y estoy aquí para ayudarte 24/7 😊", "Olá e bem-vindo à DemoWash! 👋 Sou o teu assistente e estou aqui para te ajudar 24/7 😊") },
        { role: "out", video: true, text: p("Ti mando una nostra presentazione 🎥 Guarda come funziona DemoWash", "I'll send you a quick presentation 🎥 See how DemoWash works", "Te envío una presentación 🎥 Mira cómo funciona DemoWash", "Envio-te uma apresentação 🎥 Vê como funciona a DemoWash") },
      ],
    },
    // 2 — API connect (unlock the machine)
    {
      feature: 1,
      msgs: [
        { role: "out", text: p("Qual è il numero della lavatrice?", "What's the washer number?", "¿Cuál es el número de la lavadora?", "Qual é o número da máquina?") },
        { role: "in", text: p("La numero 4", "Number 4", "La número 4", "A número 4") },
        { role: "out", status: true, text: p("Connessione alla lavatrice 4…", "Connecting to washer 4…", "Conectando con la lavadora 4…", "A ligar à máquina 4…") },
        { role: "out", text: p("Fatto ✅ Lavatrice 4 sbloccata. Riprova pure!", "Done ✅ Washer 4 unlocked. Try again!", "Hecho ✅ Lavadora 4 desbloqueada. ¡Prueba de nuevo!", "Feito ✅ Máquina 4 desbloqueada. Tenta de novo!") },
      ],
    },
    // 3 — Human escalation
    {
      feature: 2,
      msgs: [
        { role: "in", text: p("Però voglio un rimborso per ieri.", "But I want a refund for yesterday.", "Pero quiero un reembolso de ayer.", "Mas quero um reembolso de ontem.") },
        { role: "out", text: p("Ti passo Ana, la nostra operatrice 🙋", "Connecting you to Ana, our agent 🙋", "Te paso con Ana, nuestra operadora 🙋", "Passo-te à Ana, a nossa operadora 🙋") },
        { role: "op", text: p("Ciao, sono Ana del team 👋 Ho letto tutta la tua richiesta e mi dispiace per il disagio.", "Hi, I'm Ana from the team 👋 I've read your whole request and I'm sorry for the trouble.", "Hola, soy Ana del equipo 👋 He leído toda tu solicitud y siento las molestias.", "Olá, sou a Ana da equipa 👋 Li todo o teu pedido e lamento o incómodo.") },
      ],
    },
    // 4 — Audio
    {
      feature: 3,
      msgs: [
        { role: "in", audio: true },
        { role: "out", text: p("Ho ascoltato il tuo audio 🎙️ ti invieremo per email quanto richiesto.", "I've listened to your audio 🎙️ we'll email you what you requested.", "He escuchado tu audio 🎙️ te enviaremos por email lo solicitado.", "Ouvi o teu áudio 🎙️ enviaremos por email o que pediste.") },
      ],
    },
    // 5 — Franchising data (asks the location first, then prices + loyalty card)
    {
      feature: 4,
      msgs: [
        { role: "in", text: p("Quanto costa un lavaggio?", "How much is a wash?", "¿Cuánto cuesta un lavado?", "Quanto custa uma lavagem?") },
        { role: "out", text: p("In quale sede ti trovi?", "Which location are you at?", "¿En qué sede estás?", "Em que unidade estás?") },
        { role: "in", text: p("A Barcellona", "In Barcelona", "En Barcelona", "Em Barcelona") },
        { role: "out", text: p("📍 Sede di Barcellona\n🕗 Aperto 8:00–21:00\n🧺 Lavaggio 4,50 € · Asciugatura 3,00 €", "📍 Barcelona location\n🕗 Open 8:00–21:00\n🧺 Wash €4.50 · Dry €3.00", "📍 Sede de Barcelona\n🕗 Abierto 8:00–21:00\n🧺 Lavado 4,50 € · Secado 3,00 €", "📍 Unidade de Barcelona\n🕗 Aberto 8:00–21:00\n🧺 Lavagem 4,50 € · Secagem 3,00 €") },
        { role: "out", text: p("🎁 E con la carta fedeltà hai -10% sul primo lavaggio!", "🎁 And with the loyalty card you get -10% on your first wash!", "🎁 ¡Y con la tarjeta de fidelización tienes -10% en el primer lavado!", "🎁 E com o cartão de fidelização tens -10% na primeira lavagem!") },
      ],
    },
    // 6 — Appointment booking (reset: a clean booking demo)
    {
      feature: 5,
      msgs: [
        { role: "in", text: p("Vorrei una consulenza per aprire una sede a Sitges 📈", "I'd like a consultation to open a location in Sitges 📈", "Quiero una consultoría para abrir una sede en Sitges 📈", "Quero uma consultoria para abrir uma unidade em Sitges 📈") },
        { role: "out", text: p("🎉 Ho questi orari disponibili 📅\n1️⃣ Mar 14 · 17:00\n2️⃣ Mer 15 · 10:00\n3️⃣ Gio 16 · 18:30", "🎉 Here are the available slots 📅\n1️⃣ Tue 14 · 17:00\n2️⃣ Wed 15 · 10:00\n3️⃣ Thu 16 · 18:30", "🎉 Tengo estos horarios disponibles 📅\n1️⃣ Mar 14 · 17:00\n2️⃣ Mié 15 · 10:00\n3️⃣ Jue 16 · 18:30", "🎉 Tenho estes horários disponíveis 📅\n1️⃣ Ter 14 · 17:00\n2️⃣ Qua 15 · 10:00\n3️⃣ Qui 16 · 18:30") },
        { role: "in", text: p("Il 2️⃣ è perfetto", "Number 2️⃣ is perfect", "El 2️⃣ es perfecto", "O 2️⃣ é perfeito") },
        { role: "out", text: p("✅ Confermato: Mer 15 alle 10:00\n📅 Aggiunto al tuo Google Calendar\n🔔 Ti ricordo il giorno prima", "✅ Confirmed: Wed 15 at 10:00\n📅 Added to your Google Calendar\n🔔 I'll remind you the day before", "✅ Confirmado: Mié 15 a las 10:00\n📅 Añadido a tu Google Calendar\n🔔 Te recuerdo el día antes", "✅ Confirmado: Qua 15 às 10:00\n📅 Adicionado ao teu Google Calendar\n🔔 Lembro-te no dia anterior") },
      ],
    },
    // 7 — Multilingual operator (reset: operator writes once, customer reads in their language)
    {
      reset: true,
      feature: 6,
      msgs: [
        { role: "in", text: "مرحباً، هل طلبي جاهز للاستلام؟", sub: p("🌐 IT: Salve, il mio ordine è pronto per il ritiro?", "🌐 EN: Hi, is my order ready for pickup?", "🌐 ES: Hola, ¿mi pedido está listo para recoger?", "🌐 PT: Olá, o meu pedido está pronto para recolha?"), rtl: true },
        { role: "op", text: p("Buongiorno! Sì, il suo ordine è pronto per il ritiro 😊", "Good morning! Yes, your order is ready for pickup 😊", "¡Buenos días! Sí, su pedido está listo para recoger 😊", "Bom dia! Sim, o seu pedido está pronto para recolha 😊"), sub: p("🌐 inviato in arabo al cliente →", "🌐 sent to the customer in Arabic →", "🌐 enviado al cliente en árabe →", "🌐 enviado ao cliente em árabe →") },
      ],
    },
    // 8 — Invoices & files (reset: the AI sends a document)
    {
      reset: true,
      feature: 7,
      msgs: [
        { role: "in", text: p("Posso avere la fattura del mio ultimo lavaggio?", "Can I get the invoice for my last wash?", "¿Me das la factura de mi último lavado?", "Podes dar-me a fatura da minha última lavagem?") },
        { role: "out", text: p("Certo! Mi dici ragione sociale e P.IVA per la fattura? 🧾", "Sure! What's the company name and VAT number for the invoice? 🧾", "¡Claro! ¿Razón social y CIF para la factura? 🧾", "Claro! Qual é a denominação social e o NIF para a fatura? 🧾") },
        { role: "in", text: "Marta Ribas SRL · B12345678" },
        { role: "out", file: true, fileName: "Fattura-2026-0042.pdf", text: p("Fatto ✅ Ecco la tua fattura 🧾", "Done ✅ Here's your invoice 🧾", "Hecho ✅ Aquí tienes tu factura 🧾", "Feito ✅ Aqui está a tua fatura 🧾") },
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
          imgTitle: p("DemoWash · Promo del mese", "DemoWash · Monthly promo", "DemoWash · Promo del mes", "DemoWash · Promo do mês"),
          imgBig: "-20%",
          imgSmall: p("sul prossimo lavaggio 🧺", "on your next wash 🧺", "en tu próximo lavado 🧺", "na tua próxima lavagem 🧺"),
          text: p("📣 La nostra promo del mese, per te! Ti aspettiamo 💚", "📣 Our promo of the month, just for you! See you soon 💚", "📣 ¡Nuestra promo del mes, para ti! Te esperamos 💚", "📣 A nossa promo do mês, para ti! Esperamos por ti 💚"),
        },
      ],
    },
  ]

  return { title, subtitle, everyLang, online, liveLabel, opLabel, voiceLabel, features, script }
}

export function HomeShowcase({ lang = "en" }: { lang?: Lang }) {
  const c = buildContent(lang)
  const chatRef = useRef<HTMLDivElement>(null)
  const iRef = useRef(0) // driver's current flat message index (mutable, clickable)
  const [visible, setVisible] = useState(0) // number of revealed messages (flat)
  const [typing, setTyping] = useState(false) // bot "typing…" indicator
  const [activeFeature, setActiveFeature] = useState(0)
  // 📱 On mobile the auto-playing chat animation is heavy and the layout is
  // cramped — we freeze it and show a static first-scene snapshot instead.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Flatten the script into a single ordered list of messages.
  const events = c.script.flatMap((stp) =>
    stp.msgs.map((m, mi) => ({ m, feature: stp.feature, resetStart: !!stp.reset && mi === 0 }))
  )

  // Drive the conversation like a real chat: one message at a time, with a
  // "typing…" pause before each reply and a 3s wait while "connecting".
  useEffect(() => {
    // 📱 Mobile: no auto-play animation. Show the first scene fully revealed
    // (static) with the first capability card highlighted — no loop, no timers.
    if (isMobile) {
      const firstStepLen = c.script[0]?.msgs.length ?? 0
      setTyping(false)
      setActiveFeature(0)
      setVisible(firstStepLen)
      iRef.current = firstStepLen
      return
    }
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
  }, [lang, isMobile])

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

      {/* Try-the-demo CTA — WhatsApp-styled, links to the live demo widget */}
      <Link
        to="/demo/demowash"
        className="z-20 mb-6 flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-3.5 text-base font-bold text-white shadow-xl transition-all hover:scale-[1.03] hover:brightness-110 lg:absolute lg:right-8 lg:top-8 lg:mb-0 lg:inline-flex lg:w-auto"
        style={{ background: WA_GREEN }}
      >
        <svg viewBox="0 0 32 32" className="h-6 w-6 fill-white" aria-hidden="true">
          <path d="M16.003 3C9.38 3 4 8.38 4 15.003c0 2.117.553 4.187 1.605 6.01L4 29l8.184-1.55a11.94 11.94 0 0 0 3.819.626h.003C22.626 28.075 28 22.695 28 16.072 28 9.45 22.626 3 16.003 3Zm0 21.86h-.002a9.9 9.9 0 0 1-3.46-.62l-.248-.094-4.857.92.94-4.735-.16-.244a9.85 9.85 0 0 1-1.5-5.224c0-5.46 4.44-9.9 9.91-9.9 2.646 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.46-4.44 9.9-9.91 9.9Zm5.43-7.42c-.297-.15-1.758-.867-2.03-.967-.272-.099-.47-.148-.668.149-.198.297-.767.967-.94 1.166-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.76-1.653-2.057-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.496.099-.198.05-.372-.025-.521-.074-.149-.668-1.611-.916-2.206-.241-.58-.486-.501-.668-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.073.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347Z" />
        </svg>
        {pick(lang, "Prova la nostra demo", "Try our demo", "Prueba nuestra demo", "Experimenta a nossa demo")} →
      </Link>

      {/* Header — title + subtitle ABOVE the cards */}
      <div className="relative mb-8 max-w-2xl">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{ background: `${WA_GREEN}1f`, color: WA_GREEN }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-75" style={{ background: WA_GREEN }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: WA_GREEN }} />
          </span>
          WhatsApp · {c.liveLabel}
        </span>
        <h2 className="mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl">{c.title}</h2>
        <p className="mt-2 text-slate-400">{c.subtitle}</p>
      </div>

      {/* Phone + capability cards */}
      <div className="relative grid grid-cols-1 items-start gap-10 lg:grid-cols-[25rem_34rem] lg:justify-center">
        {/* WhatsApp phone */}
        <div className="mx-auto w-full max-w-[400px] lg:sticky lg:top-24">
          <div className="rounded-[2.25rem] bg-slate-950 p-3 shadow-2xl ring-1 ring-white/10">
            <div className="overflow-hidden rounded-[1.5rem] bg-[#ECE5DD]">
              {/* header */}
              <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: "#075E54" }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-base" style={{ background: WA_GREEN }}>
                  🤖
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
                className="h-[685px] overflow-y-auto px-3 py-4 text-sm [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
              >
                <div className="mt-auto flex min-h-full flex-col justify-end gap-2">
                  {bubbles.map(({ key, m }) => (
                    <ChatBubble key={key} m={m} opLabel={c.opLabel} voiceLabel={c.voiceLabel} />
                  ))}
                  {typing && <TypingDots />}
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
                  ? { borderColor: `${WA_GREEN}80`, background: `${WA_GREEN}14`, boxShadow: `0 10px 30px -12px ${WA_GREEN}55` }
                  : { borderColor: "rgba(255,255,255,0.10)", background: "rgba(15,23,42,0.40)" }
              }
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ background: i === activeFeature ? `${WA_GREEN}33` : "rgba(255,255,255,0.05)" }}
              >
                {f.icon}
              </span>
              <span>
                <span className={`block font-bold ${i === activeFeature ? "text-white" : "text-slate-200"}`}>{f.title}</span>
                <span className="mt-0.5 block text-sm text-slate-400">{f.desc}</span>
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
