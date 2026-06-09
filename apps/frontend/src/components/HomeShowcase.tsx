import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { MapPin, Mic, Play } from "lucide-react"

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

  // 8 capability cards (order matters: indices referenced by the script).
  const features: Feature[] = [
    {
      icon: "👋",
      title: p("Messaggio di benvenuto", "Welcome message", "Mensaje de bienvenida", "Mensagem de boas-vindas"),
      desc: p(
        "Accoglie ogni nuovo cliente con un messaggio e un video, e lo guida subito.",
        "Welcomes every new customer with a message and a video, guiding them instantly.",
        "Da la bienvenida a cada cliente con un mensaje y un vídeo, y lo guía al instante.",
        "Recebe cada novo cliente com uma mensagem e um vídeo, e orienta-o de imediato."
      ),
    },
    {
      icon: "🙋",
      title: p("Scala a operatore", "Human escalation", "Escala a operador", "Escala para operador"),
      desc: p(
        "Passa a un umano quando serve, con tutto il contesto.",
        "Hands off to a human when needed, with full context.",
        "Pasa a un humano cuando hace falta, con todo el contexto.",
        "Passa a um humano quando é preciso, com todo o contexto."
      ),
    },
    {
      icon: "🌍",
      title: p("Traduzione live", "Live translation", "Traducción en vivo", "Tradução ao vivo"),
      desc: p(
        "Supporto dell'operatore tradotto dal vivo nella lingua del cliente.",
        "Operator support translated live into the customer's language.",
        "Soporte del operador traducido en vivo al idioma del cliente.",
        "Suporte do operador traduzido ao vivo na língua do cliente."
      ),
    },
    {
      icon: "📍",
      title: p("Dati del franchising", "Franchising data", "Datos de la franquicia", "Dados do franchising"),
      desc: p(
        "Riconosce la sede del cliente e risponde con prezzi, orari, istruzioni e promozioni di quel negozio.",
        "Detects the customer's location and replies with that shop's prices, hours, instructions and promos.",
        "Reconoce la sede del cliente y responde con precios, horarios, instrucciones y promociones de esa tienda.",
        "Reconhece a unidade do cliente e responde com preços, horários, instruções e promoções dessa loja."
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
      icon: "🎙️",
      title: p("Messaggi audio", "Audio messages", "Mensajes de audio", "Mensagens de áudio"),
      desc: p(
        "Capisce e risponde anche alle note vocali.",
        "Understands and replies to voice notes too.",
        "Entiende y responde también a las notas de voz.",
        "Entende e responde também às notas de voz."
      ),
    },
    {
      icon: "📣",
      title: p("Notifiche push", "Push notifications", "Notificaciones push", "Notificações push"),
      desc: p(
        "Invii campagne e promozioni a tutti i clienti su WhatsApp, con un clic.",
        "Send campaigns and promos to all your customers on WhatsApp, in one click.",
        "Envía campañas y promociones a todos los clientes en WhatsApp, con un clic.",
        "Envia campanhas e promoções a todos os clientes no WhatsApp, com um clique."
      ),
    },
    {
      icon: "📅",
      title: p("Prenota appuntamenti", "Appointment booking", "Reserva de citas", "Marcação de consultas"),
      desc: p(
        "Si collega al calendario e prenota, sposta o annulla appuntamenti via chat.",
        "Connects to the calendar and books, reschedules or cancels appointments via chat.",
        "Se conecta al calendario y reserva, cambia o cancela citas por chat.",
        "Liga-se ao calendário e marca, remarca ou cancela consultas por chat."
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
        { role: "out", text: p("Ciao! Sono l'assistente DemoWash 😊 Ci penso io 👇", "Hi! I'm the DemoWash assistant 😊 I'll help 👇", "¡Hola! Soy el asistente de DemoWash 😊 Yo te ayudo 👇", "Olá! Sou o assistente DemoWash 😊 Eu ajudo 👇") },
        { role: "out", video: true, text: p("🎥 Intanto guarda come funziona DemoWash", "🎥 Meanwhile, see how DemoWash works", "🎥 Mientras, mira cómo funciona DemoWash", "🎥 Entretanto, vê como funciona a DemoWash") },
      ],
    },
    // 2 — Live translation (Catalan customer in Barcelona)
    {
      feature: 2,
      msgs: [
        { role: "out", text: p("In quale sede sei? Barcellona? 📍", "Which location are you at? Barcelona? 📍", "¿En qué sede estás? ¿Barcelona? 📍", "Em que unidade estás? Barcelona? 📍") },
        { role: "in", text: "Sí, a Barcelona. Gràcies!", sub: p("🌐 IT: Sì, a Barcellona. Grazie!", "🌐 EN: Yes, in Barcelona. Thanks!", "🌐 ES: Sí, en Barcelona. ¡Gracias!", "🌐 PT: Sim, em Barcelona. Obrigado!") },
      ],
    },
    // 3 — API connect (unlock the machine)
    {
      feature: 4,
      msgs: [
        { role: "out", text: p("Qual è il numero della lavatrice?", "What's the washer number?", "¿Cuál es el número de la lavadora?", "Qual é o número da máquina?") },
        { role: "in", text: p("La numero 4", "Number 4", "La número 4", "A número 4") },
        { role: "out", text: p("Fatto ✅ Lavatrice 4 sbloccata. Riprova pure!", "Done ✅ Washer 4 unlocked. Try again!", "Hecho ✅ Lavadora 4 desbloqueada. ¡Prueba de nuevo!", "Feito ✅ Máquina 4 desbloqueada. Tenta de novo!") },
      ],
    },
    // 4 — Human escalation
    {
      feature: 1,
      msgs: [
        { role: "in", text: p("Però voglio un rimborso per ieri.", "But I want a refund for yesterday.", "Pero quiero un reembolso de ayer.", "Mas quero um reembolso de ontem.") },
        { role: "out", text: p("Ti passo Ana, la nostra operatrice 🙋", "Connecting you to Ana, our agent 🙋", "Te paso con Ana, nuestra operadora 🙋", "Passo-te à Ana, a nossa operadora 🙋") },
        { role: "op", text: p("Ciao, sono Ana. Ho già tutto il contesto 💚", "Hi, I'm Ana. I have the full context 💚", "Hola, soy Ana. Tengo todo el contexto 💚", "Olá, sou a Ana. Tenho todo o contexto 💚") },
      ],
    },
    // 5 — Audio
    {
      feature: 5,
      msgs: [
        { role: "in", audio: true },
        { role: "out", text: p("Capito dal tuo vocale 🎙️ Tutto risolto!", "Got it from your voice note 🎙️ All sorted!", "Entendido por tu nota de voz 🎙️ ¡Todo resuelto!", "Percebi pela tua nota de voz 🎙️ Tudo resolvido!") },
      ],
    },
    // 6 — Franchising data (prices/hours for that location)
    {
      feature: 3,
      msgs: [
        { role: "in", text: p("Quanto costa un lavaggio da voi?", "How much is a wash with you?", "¿Cuánto cuesta un lavado?", "Quanto custa uma lavagem?") },
        { role: "out", text: p("Nella sede di Barcellona: 4,50 € 📍 Aperto 8:00–21:00.", "At the Barcelona location: €4.50 📍 Open 8:00–21:00.", "En la sede de Barcelona: 4,50 € 📍 Abierto 8:00–21:00.", "Na unidade de Barcelona: 4,50 € 📍 Aberto 8:00–21:00.") },
      ],
    },
    // 7 — Appointment booking (open a franchise in Sitges)
    {
      feature: 7,
      msgs: [
        { role: "in", text: p("Vorrei aprire una sede a Sitges, in Catalogna!", "I'd like to open a location in Sitges, Catalonia!", "¡Me gustaría abrir una sede en Sitges, Cataluña!", "Gostava de abrir uma unidade em Sitges, Catalunha!") },
        { role: "out", text: p("Fantastico! 🎉 Ti fisso una consulenza franchising 📅", "Amazing! 🎉 Let me book you a franchise consultation 📅", "¡Genial! 🎉 Te agendo una consultoría de franquicia 📅", "Fantástico! 🎉 Marco-te uma consultoria de franchising 📅") },
        { role: "out", text: p("✅ Martedì 18:00, aggiunto al calendario!", "✅ Tuesday 18:00, added to the calendar!", "✅ Martes 18:00, ¡añadido al calendario!", "✅ Terça 18:00, adicionado ao calendário!") },
      ],
    },
    // 8 — Push notifications (subscribed to offers)
    {
      feature: 6,
      msgs: [
        { role: "out", text: p("📣 E iscritto alle offerte: -20% sul primo mese! 💚", "📣 And you're subscribed to our offers: -20% on the first month! 💚", "📣 Y suscrito a nuestras ofertas: ¡-20% el primer mes! 💚", "📣 E subscrito às nossas ofertas: -20% no primeiro mês! 💚") },
        { role: "in", text: p("Perfetto, grazie!! 🙌", "Perfect, thanks!! 🙌", "¡Perfecto, gracias!! 🙌", "Perfeito, obrigado!! 🙌") },
      ],
    },
    // 9 — Reset: a brand-new customer writes in Arabic, the AI replies in Arabic.
    {
      feature: 2,
      reset: true,
      msgs: [
        { role: "in", text: "مرحباً، هل أنتم مفتوحون الآن؟", rtl: true },
        { role: "out", text: "نعم، نحن مفتوحون حتى الساعة 9 مساءً 😊 أهلاً بك!", rtl: true },
      ],
    },
  ]

  return { title, subtitle, everyLang, online, liveLabel, opLabel, voiceLabel, features, script }
}

export function HomeShowcase({ lang = "en" }: { lang?: Lang }) {
  const c = buildContent(lang)
  const [step, setStep] = useState(0)
  const chatRef = useRef<HTMLDivElement>(null)

  // Advance the story; each step highlights its feature card.
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % c.script.length), 4200)
    return () => clearInterval(id)
  }, [c.script.length])

  const activeFeature = c.script[step].feature

  // The chat ACCUMULATES — bubbles stay on screen until the context resets
  // (the final Arabic exchange, or the loop restarting at step 0).
  let start = 0
  for (let i = step - 1; i >= 0; i--) {
    if (c.script[i].reset) {
      start = i + 1
      break
    }
  }
  const groupIdxs = c.script[step].reset
    ? [step]
    : Array.from({ length: step - start + 1 }, (_, k) => start + k)
  const bubbles = groupIdxs.flatMap((gi) =>
    c.script[gi].msgs.map((m, mi) => ({ key: `g${gi}-m${mi}`, m }))
  )

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    const el = chatRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [step])

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#070d18] p-6 shadow-2xl sm:p-8 lg:p-10">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl" style={{ background: `${WA_GREEN}26` }} />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />

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
      <div className="relative grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        {/* WhatsApp phone */}
        <div className="mx-auto w-full max-w-sm lg:sticky lg:top-24">
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
                className="h-[560px] overflow-y-auto px-3 py-4 text-sm [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
              >
                <div className="mt-auto flex min-h-full flex-col justify-end gap-2">
                  {bubbles.map(({ key, m }) => (
                    <ChatBubble key={key} m={m} opLabel={c.opLabel} voiceLabel={c.voiceLabel} />
                  ))}
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
              onClick={() => setStep(c.script.findIndex((s) => s.feature === i))}
              className="flex w-full items-start gap-4 rounded-2xl border px-5 py-3.5 text-left transition-all duration-300"
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
function ChatBubble({ m, opLabel, voiceLabel }: { m: Msg; opLabel: string; voiceLabel: string }) {
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
    <motion.div variants={item} className={`flex ${align}`}>
      <div dir={m.rtl ? "rtl" : "ltr"} className={`${bubbleBase} ${skin}`} style={style}>
        {m.role === "op" && (
          <p className="mb-0.5 text-[10px] font-semibold" style={{ color: "#0a6cff" }}>
            {opLabel}
          </p>
        )}
        {m.video ? (
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
            <p>{m.text}</p>
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
