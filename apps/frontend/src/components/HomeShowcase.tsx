import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MapPin } from "lucide-react"

// ---------------------------------------------------------------------------
// HomeShowcase — dark marketing hero showcase for the homepage.
// Title + subtitle on top, a WhatsApp phone on the left and the feature cards
// ("what the software does") on the right. One card highlights at a time, in
// sync with the chat, so a visitor immediately understands the product.
// Fully translated to the public-site languages (it / en / es / pt); fr / ca
// fall back to English. The Arabic line stays Arabic in every language (it is
// the foreign customer being translated live).
// ---------------------------------------------------------------------------

type Lang = "it" | "en" | "es" | "pt" | "fr" | "ca"

// Pick the right string for the active language (es/fr/ca → en fallback handled
// by the caller passing en as the 4th arg position default).
function pick(lang: Lang, it: string, en: string, es: string, pt: string): string {
  switch (lang) {
    case "it":
      return it
    case "es":
      return es
    case "pt":
      return pt
    default:
      return en // en / fr / ca
  }
}

interface Feature {
  icon: string
  title: string
  desc: string
}

interface ChatLine {
  side: "in" | "out"
  text: string
  sub?: string // small translation/footnote line
  rtl?: boolean
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
    "Una sola AI che risponde, traduce, riconosce il negozio e vende — 24/7.",
    "One AI that answers, translates, knows the shop and sells — 24/7.",
    "Una sola IA que responde, traduce, reconoce la tienda y vende — 24/7.",
    "Uma só IA que responde, traduz, reconhece a loja e vende — 24/7."
  )

  const features: Feature[] = [
    {
      icon: "🤖",
      title: p("Supporto 24/7", "24/7 support", "Soporte 24/7", "Suporte 24/7"),
      desc: p(
        "Risponde da solo su WhatsApp, a ogni ora.",
        "Answers on its own over WhatsApp, any hour.",
        "Responde solo en WhatsApp, a cualquier hora.",
        "Responde sozinho no WhatsApp, a qualquer hora."
      ),
    },
    {
      icon: "🌍",
      title: p("Traduzione live", "Live translation", "Traducción en vivo", "Tradução ao vivo"),
      desc: p(
        "Parla la lingua di ogni cliente, in automatico.",
        "Speaks every customer's language, automatically.",
        "Habla el idioma de cada cliente, en automático.",
        "Fala o idioma de cada cliente, automaticamente."
      ),
    },
    {
      icon: "📍",
      title: p("Dati per negozio", "Per-shop data", "Datos por tienda", "Dados por loja"),
      desc: p(
        "Prezzi e orari giusti, per ogni sede.",
        "The right prices and hours, for every location.",
        "Precios y horarios correctos, por cada sede.",
        "Preços e horários certos, por cada unidade."
      ),
    },
    {
      icon: "🔗",
      title: p("Agisce e vende", "Acts & sells", "Actúa y vende", "Age e vende"),
      desc: p(
        "Si collega ai tuoi sistemi e propone offerte.",
        "Connects to your systems and offers deals.",
        "Se conecta a tus sistemas y ofrece promos.",
        "Liga-se aos teus sistemas e oferece promos."
      ),
    },
  ]

  // One short chat scene per feature, so the phone matches the highlighted card.
  const scenes: ChatLine[][] = [
    [
      { side: "in", text: p("Ciao, la lavatrice 4 è libera?", "Hi, is washer 4 free?", "Hola, ¿la lavadora 4 está libre?", "Olá, a máquina 4 está livre?") },
      { side: "out", text: p("Ciao! Sì, la 4 è libera ora. 👋", "Hi! Yes, 4 is free right now. 👋", "¡Hola! Sí, la 4 está libre ahora. 👋", "Olá! Sim, a 4 está livre agora. 👋") },
    ],
    [
      { side: "in", text: "في أي وقت تغلقون؟", sub: p("🌐 IT: A che ora chiudete?", "🌐 EN: What time do you close?", "🌐 ES: ¿A qué hora cerráis?", "🌐 PT: A que horas fecham?"), rtl: true },
      { side: "out", text: p("Chiudiamo alle 21:00. 🌍", "We close at 21:00. 🌍", "Cerramos a las 21:00. 🌍", "Fechamos às 21:00. 🌍") },
    ],
    [
      { side: "in", text: p("Quanto costa un lavaggio a Milano?", "How much is a wash in Milano?", "¿Cuánto cuesta un lavado en Milán?", "Quanto custa uma lavagem em Milão?") },
      { side: "out", text: p("A Milano Centro: 4,50 €. 📍", "At Milano Centro: €4.50. 📍", "En Milano Centro: 4,50 €. 📍", "Na Milano Centro: 4,50 €. 📍") },
    ],
    [
      { side: "in", text: p("La lavatrice non si apre!", "The washer won't open!", "¡La lavadora no se abre!", "A máquina não abre!") },
      { side: "out", text: p("Sbloccata! ✅ E hai un -10% al prossimo lavaggio. 🎁", "Unlocked! ✅ And here's -10% off your next wash. 🎁", "¡Desbloqueada! ✅ Y tienes -10% en tu próximo lavado. 🎁", "Desbloqueada! ✅ E tens -10% na próxima lavagem. 🎁") },
    ],
  ]

  const languages = ["🇮🇹", "🇬🇧", "🇪🇸", "🇵🇹", "🇫🇷", "🇸🇦"]
  const online = p("online", "online", "en línea", "online")
  const liveLabel = p("dal vivo", "live", "en vivo", "ao vivo")

  return { title, subtitle, features, scenes, languages, online, liveLabel }
}

export function HomeShowcase({ lang = "en" }: { lang?: Lang }) {
  const { title, subtitle, features, scenes, languages, online, liveLabel } = buildContent(lang)
  const [active, setActive] = useState(0)

  // Cycle the highlighted feature + matching chat scene.
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % features.length), 3800)
    return () => clearInterval(id)
  }, [features.length])

  const scene = scenes[active]

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#070d18] p-6 shadow-2xl sm:p-8 lg:p-10">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-green-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />

      {/* Header — title + subtitle ABOVE the cards */}
      <div className="relative mb-8 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-green-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          WhatsApp · {liveLabel}
        </span>
        <h2 className="mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl">{title}</h2>
        <p className="mt-2 text-slate-400">{subtitle}</p>
      </div>

      {/* Phone + feature cards */}
      <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
        {/* WhatsApp phone */}
        <div className="mx-auto w-full max-w-xs">
          <div className="rounded-[2rem] bg-slate-950 p-2.5 shadow-2xl ring-1 ring-white/10">
            <div className="overflow-hidden rounded-[1.5rem] bg-[#ECE5DD]">
              {/* header */}
              <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-base">
                  🤖
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">DemoWash</p>
                  <p className="flex items-center gap-1 text-[11px] text-white/70">
                    <MapPin className="h-3 w-3" /> Milano Centro · {online}
                  </p>
                </div>
              </div>
              {/* messages */}
              <div className="flex min-h-[200px] flex-col gap-2 px-3 py-4 text-[13px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col gap-2"
                  >
                    {scene.map((m, i) => (
                      <div key={i} className={m.side === "out" ? "flex justify-end" : "flex justify-start"}>
                        <div
                          dir={m.rtl ? "rtl" : "ltr"}
                          className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                            m.side === "out"
                              ? "rounded-tr-sm bg-[#DCF8C6] text-gray-900"
                              : "rounded-tl-sm bg-white text-gray-900"
                          }`}
                        >
                          <p>{m.text}</p>
                          {m.sub && (
                            <p className="mt-1 border-t border-gray-100 pt-1 text-[11px] italic text-gray-400" dir="ltr">
                              {m.sub}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
          {/* language strip */}
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {languages.map((f) => (
              <span key={f} className="rounded-full border border-white/10 bg-slate-900/60 px-2 py-1 text-sm">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div className="space-y-3">
          {features.map((f, i) => (
            <button
              key={f.title}
              type="button"
              onClick={() => setActive(i)}
              className={`flex w-full items-start gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${
                i === active
                  ? "border-green-400/50 bg-green-400/[0.08] shadow-lg shadow-green-900/20"
                  : "border-white/10 bg-slate-900/40 hover:border-white/20"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition-colors ${
                  i === active ? "bg-green-400/20" : "bg-white/5"
                }`}
              >
                {f.icon}
              </span>
              <span>
                <span className={`block font-bold ${i === active ? "text-white" : "text-slate-200"}`}>
                  {f.title}
                </span>
                <span className="mt-0.5 block text-sm text-slate-400">{f.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
