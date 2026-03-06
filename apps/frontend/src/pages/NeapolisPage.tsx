import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { SEO } from "@/components/SEO"
import { WidgetLoader } from "@/components/WidgetLoader"
import { ChatWidget } from "@/components/ChatWidget"
import { ArrowRight, Gift, Wrench, Headphones, Users } from "lucide-react"

// ─────────────────────────────────────────
// Translations
// ─────────────────────────────────────────
type Lang = "it" | "en" | "es" | "pt"

const T: Record<Lang, {
  seoTitle: string
  seoDesc: string
  badge: string
  greeting: string
  intro: string
  client0Label: string
  client0: string
  offer: string
  offerItems: string[]
  goal: string
  cta_title: string
  cta_desc: string
  cta_btn: string
  footer_back: string
}> = {
  it: {
    seoTitle: "Collaborazione Neapolis × eChatbot.AI",
    seoDesc: "eChatbot.AI cerca il Cliente 0 all'interno del network Neapolis. Chatbot AI su misura, completamente gratuito per un anno.",
    badge: "Offerta esclusiva per la community Neapolis",
    greeting: "Ciao,",
    intro: "eChatbot.AI è una nuova startup e ci vantiamo di poter creare chatbot customizzati di alta qualità.",
    client0Label: "Cliente 0",
    client0: "In questo momento stiamo cercando il Cliente 0 all'interno del network di Neapolis — qualcuno che voglia sperimentare con noi il potenziale di un assistente AI costruito su misura per la propria attività.",
    offer: "Offriamo il servizio completamente gratuito per un anno.",
    offerItems: [
      "Tutta l'implementazione tecnica inclusa",
      "Integrazioni con fonti e servizi terzi",
      "Supporto continuo gratuito per 12 mesi",
    ],
    goal: "L'obiettivo è collaborare con un partner che ci permetta di dimostrare concretamente il valore della piattaforma e di farci conoscere all'interno della community.",
    cta_title: "Ti incuriosisce?",
    cta_desc: "Rispondi a qualche breve domanda per capire come eChatbot può trasformare il tuo business. Circa 5 minuti — zero impegno.",
    cta_btn: "Avvia il survey →",
    footer_back: "← Torna alla homepage",
  },
  en: {
    seoTitle: "Neapolis × eChatbot.AI Partnership",
    seoDesc: "eChatbot.AI is looking for Client 0 within the Neapolis network. Custom AI chatbot, completely free for one year.",
    badge: "Exclusive offer for the Neapolis community",
    greeting: "Hello,",
    intro: "eChatbot.AI is a new startup and we pride ourselves on building high-quality customised chatbots.",
    client0Label: "Client 0",
    client0: "We are currently looking for our Client 0 within the Neapolis network — someone willing to explore with us the potential of an AI assistant built specifically for their business.",
    offer: "We offer the service completely free for one year.",
    offerItems: [
      "Full technical implementation included",
      "Integrations with third-party sources and services",
      "Free continuous support for 12 months",
    ],
    goal: "Our goal is to collaborate with a partner who allows us to concretely demonstrate the value of the platform and to make ourselves known within the community.",
    cta_title: "Does it sound interesting?",
    cta_desc: "Answer a few quick questions to help us understand how eChatbot can transform your business. About 5 minutes — no commitment.",
    cta_btn: "Start the survey →",
    footer_back: "← Back to homepage",
  },
  es: {
    seoTitle: "Colaboración Neapolis × eChatbot.AI",
    seoDesc: "eChatbot.AI busca al Cliente 0 dentro de la red Neapolis. Chatbot AI personalizado, completamente gratuito durante un año.",
    badge: "Oferta exclusiva para la comunidad Neapolis",
    greeting: "Hola,",
    intro: "eChatbot.AI es una nueva startup y nos enorgullece crear chatbots personalizados de alta calidad.",
    client0Label: "Cliente 0",
    client0: "Actualmente estamos buscando al Cliente 0 dentro de la red de Neapolis — alguien que quiera explorar con nosotros el potencial de un asistente AI construido a medida para su negocio.",
    offer: "Ofrecemos el servicio completamente gratuito durante un año.",
    offerItems: [
      "Toda la implementación técnica incluida",
      "Integraciones con fuentes y servicios de terceros",
      "Soporte continuo gratuito durante 12 meses",
    ],
    goal: "El objetivo es colaborar con un socio que nos permita demostrar concretamente el valor de la plataforma y darnos a conocer dentro de la comunidad.",
    cta_title: "¿Te parece interesante?",
    cta_desc: "Responde algunas preguntas rápidas para entender cómo eChatbot puede transformar tu negocio. Unos 5 minutos — sin compromiso.",
    cta_btn: "Iniciar el survey →",
    footer_back: "← Volver a la página principal",
  },
  pt: {
    seoTitle: "Parceria Neapolis × eChatbot.AI",
    seoDesc: "eChatbot.AI procura o Cliente 0 dentro da rede Neapolis. Chatbot AI personalizado, completamente gratuito por um ano.",
    badge: "Oferta exclusiva para a comunidade Neapolis",
    greeting: "Olá,",
    intro: "eChatbot.AI é uma nova startup e temos orgulho em criar chatbots personalizados de alta qualidade.",
    client0Label: "Cliente 0",
    client0: "Estamos à procura do nosso Cliente 0 dentro da rede Neapolis — alguém disposto a explorar connosco o potencial de um assistente AI construído especificamente para o seu negócio.",
    offer: "Oferecemos o serviço completamente gratuito por um ano.",
    offerItems: [
      "Toda a implementação técnica incluída",
      "Integrações com fontes e serviços de terceiros",
      "Suporte contínuo gratuito por 12 meses",
    ],
    goal: "O objetivo é colaborar com um parceiro que nos permita demonstrar concretamente o valor da plataforma e tornarmo-nos conhecidos dentro da comunidade.",
    cta_title: "Parece interessante?",
    cta_desc: "Responda a algumas perguntas rápidas para entender como o eChatbot pode transformar o seu negócio. Cerca de 5 minutos — sem compromisso.",
    cta_btn: "Iniciar o survey →",
    footer_back: "← Voltar à página inicial",
  },
}

const offerIcons = [Gift, Wrench, Headphones]

export function NeapolisPage() {
  const [lang, setLang] = useState<Lang>("it")

  useEffect(() => {
    const l = navigator.language.slice(0, 2)
    if (l === "en" || l === "es" || l === "pt") setLang(l)
    else setLang("it") // Italian as default for Neapolis
  }, [])

  const t = T[lang]

  return (
    <>
      <SEO
        title={t.seoTitle}
        description={t.seoDesc}
        lang={lang}
        url="https://www.echatbot.ai/neapolis"
      />

      <div
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(135deg, #f0fdf4 0%, #f8fafc 50%, #ecfdf5 100%)",
        }}
      >
        {/* ── Header ── */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            {/* Logos */}
            <div className="flex items-center gap-5">
              <img
                src="https://www.neapolis.cat/wp-content/uploads/2022/09/logo.svg"
                alt="Neapolis"
                className="h-8 w-auto"
              />
              <span className="text-slate-300 text-xl font-light">×</span>
              <Link to="/" className="flex items-center gap-2">
                <img src="/logo.png" alt="eChatbot" className="w-8 h-8" />
                <span className="text-lg font-bold text-green-600">eChatbot.AI</span>
              </Link>
            </div>

            {/* Language switcher */}
            <div className="flex items-center gap-1">
              {(["it", "en", "es", "pt"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                    lang === l
                      ? "bg-green-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ── Hero badge ── */}
        <div className="max-w-3xl mx-auto px-6 pt-14 pb-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-sm font-semibold px-5 py-2 rounded-full border border-green-200">
              <Users className="w-4 h-4" />
              {t.badge}
            </span>
          </motion.div>
        </div>

        {/* ── Main card ── */}
        <div className="max-w-3xl mx-auto px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
          >
            {/* Green top banner with both logos */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-10 py-10 text-white">
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="bg-white/20 backdrop-blur rounded-2xl px-5 py-3">
                  <img
                    src="https://www.neapolis.cat/wp-content/uploads/2022/09/logo.svg"
                    alt="Neapolis"
                    className="h-9 w-auto brightness-0 invert"
                  />
                </div>
                <span className="text-3xl font-light opacity-80">×</span>
                <div className="bg-white/20 backdrop-blur rounded-2xl px-5 py-3 flex items-center gap-2">
                  <img src="/logo.png" alt="eChatbot" className="w-9 h-9" />
                  <span className="text-xl font-bold">eChatbot.AI</span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-10 py-10 space-y-8">

              {/* Greeting + intro */}
              <div>
                <p className="text-2xl font-bold text-slate-900 mb-3">{t.greeting}</p>
                <p className="text-lg text-slate-700 leading-relaxed">{t.intro}</p>
              </div>

              {/* Client 0 highlight */}
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-7">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                    <span className="text-white font-black text-lg">0</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-700 uppercase tracking-widest mb-2">
                      {t.client0Label}
                    </p>
                    <p className="text-base text-slate-700 leading-relaxed">{t.client0}</p>
                  </div>
                </div>
              </div>

              {/* Offer heading */}
              <div>
                <p className="text-xl font-bold text-slate-900 mb-5">{t.offer}</p>
                <div className="grid gap-4">
                  {t.offerItems.map((item, i) => {
                    const Icon = offerIcons[i]
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                        className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-xl px-5 py-4"
                      >
                        <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-green-700" />
                        </div>
                        <p className="text-base font-medium text-slate-800">{item}</p>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Goal */}
              <p className="text-base text-slate-600 leading-relaxed border-l-4 border-green-400 pl-5 italic">
                {t.goal}
              </p>

              {/* Divider */}
              <div className="border-t border-slate-100" />

              {/* Survey CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-8 text-white text-center shadow-xl"
              >
                <h2 className="text-2xl font-bold mb-3">{t.cta_title}</h2>
                <p className="text-green-100 text-base leading-relaxed mb-7 max-w-lg mx-auto">
                  {t.cta_desc}
                </p>
                <Link
                  to="/survey"
                  className="inline-flex items-center gap-3 bg-white text-green-700 hover:bg-green-50 font-bold px-9 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
                >
                  <span>{t.cta_btn}</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>

              {/* Footer back link */}
              <div className="text-center pt-2">
                <Link
                  to="/"
                  className="text-sm text-slate-400 hover:text-green-600 transition-colors"
                >
                  {t.footer_back}
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <WidgetLoader />
      <ChatWidget workspaceId="echatbot-hq-support" position="bottom-right" logoUrl="/logo.png" />
    </>
  )
}
