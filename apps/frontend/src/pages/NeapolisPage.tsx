import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { SEO } from "@/components/SEO"
import { ArrowRight } from "lucide-react"
import { GreenCtaButton } from "@/components/ui/green-cta-button"

// ─────────────────────────────────────────
// Translations
// ─────────────────────────────────────────
type Lang = "it" | "en" | "es" | "de"

const T: Record<Lang, {
  seoTitle: string
  seoDesc: string
  badge: string
  greeting: string
  introPart1: string
  introPart2: string
  offer: string
  offerFreeWord: string
  offerItems: string[]
  offerExclusion: string
  goal: string
  cta_title: string
  cta_desc: string
  cta_btn: string
  footer_back: string
}> = {
  it: {
    seoTitle: "Collaborazione Neapolis × eChatbot.AI",
    seoDesc: "eChatbot.AI cerca partner nel network Neapolis. Chatbot AI su misura: sviluppo e integrazione sempre gratuiti, paghi solo piano e consumi LLM.",
    badge: "Offerta esclusiva per la community Neapolis",
    greeting: "Ciao, benvenuto su eChatbot.AI",
    introPart1: "Sviluppiamo chatbot su misura, integrati con i sistemi aziendali del cliente (CRM, ERP, API, ecc.). Trasformiamo la conversazione in uno strumento strategico: risposte precise in tempo reale basate sui dati aziendali, e notifiche push per azioni di marketing conversazionale mirato.",
    introPart2: "Per crescere abbiamo bisogno del nostro Cliente 0, una startup del network Neàpolis con cui fare la nostra prima DEMO. Ecco il nostro modello di business: sviluppo, integrazione e analisi sono sempre gratuiti. Paghi solo il piano di sottoscrizione e i consumi LLM.",
    offer: "Sviluppo e integrazione sempre gratuiti.",
    offerFreeWord: "gratuiti",
    offerItems: [
      "Tutto lo sviluppo e l'integrazione con i tuoi sistemi (CRM, ERP, API, ecc.) è sempre gratuito",
      "Assistenza e analisi continue sempre incluse senza costi aggiuntivi",
    ],
    offerExclusion: "Paghi solo il piano di sottoscrizione e i consumi LLM (es. OpenAI, WhatsApp Business).",
    goal: "L'obiettivo è collaborare con un partner che ci permetta di dimostrare concretamente il valore della piattaforma e di farci conoscere all'interno della community.",
    cta_title: "Ti incuriosisce?",
    cta_desc: "Rispondi a qualche breve domanda per capire come eChatbot può trasformare il tuo business. Circa 2 minuti, zero impegno.",
    cta_btn: "Avvia il survey →",
    footer_back: "← Torna alla homepage",
  },
  en: {
    seoTitle: "Neapolis × eChatbot.AI Partnership",
    seoDesc: "eChatbot.AI is looking for partners in the Neapolis network. Custom AI chatbot: development and integration always free, you only pay for plan and LLM usage.",
    badge: "Exclusive offer for the Neapolis community",
    greeting: "Hello, welcome to eChatbot.AI",
    introPart1: "We develop custom chatbots integrated with the client's business systems (CRM, ERP, API, etc.). We turn conversation into a strategic tool: precise real-time responses based on corporate data, and push notifications for targeted conversational marketing.",
    introPart2: "To grow, we need our Client 0, a startup within the Neàpolis network to make our first DEMO with. Here's our business model: development, integration, and analysis are always free. You only pay for the subscription plan and LLM usage.",
    offer: "Development and integration always free.",
    offerFreeWord: "free",
    offerItems: [
      "All development and integration with your systems (CRM, ERP, API, etc.) is always free",
      "Continuous support and analysis always included at no extra cost",
    ],
    offerExclusion: "You only pay for the subscription plan and LLM usage (e.g. OpenAI, WhatsApp Business).",
    goal: "Our goal is to collaborate with a partner who allows us to concretely demonstrate the value of the platform and to make ourselves known within the community.",
    cta_title: "Does it sound interesting?",
    cta_desc: "Answer a few quick questions to help us understand how eChatbot can transform your business. About 2 minutes, no commitment.",
    cta_btn: "Start the survey →",
    footer_back: "← Back to homepage",
  },
  es: {
    seoTitle: "Colaboración Neapolis × eChatbot.AI",
    seoDesc: "eChatbot.AI busca socios en la red Neapolis. Chatbot AI personalizado: desarrollo e integración siempre gratuitos, solo pagas plan y uso de LLM.",
    badge: "Oferta exclusiva para la comunidad Neapolis",
    greeting: "Hola, bienvenido a eChatbot.AI",
    introPart1: "Desarrollamos chatbots a medida integrados con los sistemas del cliente (CRM, ERP, API, etc.). Transformamos la conversación en una herramienta estratégica: respuestas precisas en tiempo real basadas en datos corporativos, y notificaciones push para acciones de marketing conversacional dirigido.",
    introPart2: "Para crecer necesitamos nuestro Cliente 0, una startup dentro de la red Neàpolis con quien hacer nuestra primera DEMO. Este es nuestro modelo de negocio: desarrollo, integración y análisis son siempre gratuitos. Solo pagas el plan de suscripción y el uso de LLM.",
    offer: "Desarrollo e integración siempre gratuitos.",
    offerFreeWord: "gratuitos",
    offerItems: [
      "Todo el desarrollo e integración con tus sistemas (CRM, ERP, API, etc.) es siempre gratuito",
      "Soporte y análisis continuos siempre incluidos sin costes adicionales",
    ],
    offerExclusion: "Solo pagas el plan de suscripción y el uso de LLM (ej. OpenAI, WhatsApp Business).",
    goal: "El objetivo es colaborar con un socio que nos permita demostrar concretamente el valor de la plataforma y darnos a conocer dentro de la comunidad.",
    cta_title: "¿Te parece interesante?",
    cta_desc: "Responde algunas preguntas rápidas para entender cómo eChatbot puede transformar tu negocio. Unos 2 minutos, sin compromiso.",
    cta_btn: "Iniciar el survey →",
    footer_back: "← Volver a la página principal",
  },
  de: {
    seoTitle: "Partnerschaft Neapolis × eChatbot.AI",
    seoDesc: "eChatbot.AI sucht Partner im Neapolis-Netzwerk. Maßgeschneiderter AI-Chatbot: Entwicklung und Integration immer kostenlos, du zahlst nur Plan und LLM-Nutzung.",
    badge: "Exklusives Angebot für die Neapolis-Community",
    greeting: "Hallo, willkommen bei eChatbot.AI",
    introPart1: "Wir entwickeln maßgeschneiderte Chatbots, integriert in die Unternehmenssysteme des Kunden (CRM, ERP, API usw.). Wir machen aus dem Gespräch ein strategisches Werkzeug: präzise Antworten in Echtzeit auf Basis der Unternehmensdaten und Push-Benachrichtigungen für gezieltes konversationelles Marketing.",
    introPart2: "Um zu wachsen, brauchen wir unseren Kunden 0, ein Startup aus dem Neàpolis-Netzwerk, mit dem wir unsere erste DEMO machen. Das ist unser Geschäftsmodell: Entwicklung, Integration und Analyse sind immer kostenlos. Du zahlst nur den Abo-Plan und die LLM-Nutzung.",
    offer: "Entwicklung und Integration immer kostenlos.",
    offerFreeWord: "kostenlos",
    offerItems: [
      "Die gesamte Entwicklung und Integration mit deinen Systemen (CRM, ERP, API usw.) ist immer kostenlos",
      "Laufender Support und laufende Analyse immer inklusive, ohne Zusatzkosten",
    ],
    offerExclusion: "Du zahlst nur den Abo-Plan und die LLM-Nutzung (z. B. OpenAI, WhatsApp Business).",
    goal: "Ziel ist es, mit einem Partner zusammenzuarbeiten, der es uns ermöglicht, den Wert der Plattform konkret zu zeigen und uns innerhalb der Community bekannt zu machen.",
    cta_title: "Klingt das interessant?",
    cta_desc: "Beantworte ein paar kurze Fragen, damit wir verstehen, wie eChatbot dein Business verändern kann. Etwa 2 Minuten, völlig unverbindlich.",
    cta_btn: "Survey starten →",
    footer_back: "← Zurück zur Startseite",
  },
}

export function NeapolisPage() {
  const { language, setLanguage } = useLanguage()
  const lang: Lang = (["it", "en", "es", "de"].includes(language) ? language : "it") as Lang
  const setLang = (l: Lang) => setLanguage(l)

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
        className="h-screen overflow-y-auto [&::-webkit-scrollbar]:hidden"
        style={{
          background: "linear-gradient(135deg, #f0fdf4 0%, #f8fafc 50%, #ecfdf5 100%)",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        } as React.CSSProperties}
      >
        {/* ── Header ── */}
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1 flex items-center justify-between gap-2">
            <Link to="/" className="flex items-center gap-1 shrink-0">
              <img src="/logo.png" alt="eChatbot" className="w-9 h-9 sm:w-12 sm:h-12" />
              <span className="text-base sm:text-xl font-bold text-green-600">eChatbot.AI</span>
            </Link>
            <div className="flex items-center gap-0.5 sm:gap-1">
              {(["it", "en", "es", "de"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                    lang === l ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ── Main card ── */}
        <div className="flex items-start sm:items-center justify-center min-h-[calc(100vh-56px)] px-3 sm:px-6 py-6 sm:py-8">
        <div className="w-full max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
          >
            {/* Title banner */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-5 sm:px-10 py-6 sm:py-8 text-white text-center">
              <h1 className="text-2xl sm:text-3xl font-bold">Survey</h1>
            </div>

            {/* Logos row */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 px-4 sm:px-10 py-4 sm:py-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-center min-w-0">
                <img
                  src="https://www.neapolis.cat/wp-content/uploads/2022/09/logo.svg"
                  alt="Neàpolis"
                  className="h-10 sm:h-16 w-auto max-w-[110px] sm:max-w-[180px] object-contain"
                />
              </div>
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300 shrink-0" />
              <span className="text-xl sm:text-3xl font-bold text-green-600 whitespace-nowrap">eChatbot.AI</span>
            </div>

            {/* Body */}
            <div className="px-5 sm:px-10 py-5 sm:py-6 space-y-5">

              {/* Greeting + intro */}
              <div className="space-y-3">
                <p className="text-2xl font-bold text-slate-900">{t.greeting}</p>
                <p className="text-lg text-slate-700 leading-relaxed">{t.introPart1}</p>
                <p className="text-lg text-slate-700 leading-relaxed">{t.introPart2}</p>
              </div>

              {/* Offer */}
              <div>
                <p className="text-lg font-bold text-slate-900 mb-3">
                  {t.offer.split(t.offerFreeWord)[0]}<span className="text-red-600 font-extrabold uppercase">{t.offerFreeWord.toUpperCase()}</span>{t.offer.split(t.offerFreeWord)[1]}
                </p>
                <ul className="space-y-2 mb-3">
                  {t.offerItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="shrink-0">✅</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-slate-600 font-medium flex items-start gap-2">
                  <span className="shrink-0">❌</span>
                  {t.offerExclusion}
                </p>
              </div>

              {/* Survey CTA */}
              <div className="text-center pt-2 pb-1">
                <GreenCtaButton to="/survey" icon="📋" size="md">
                  {t.cta_btn}
                </GreenCtaButton>
              </div>

            </div>
          </motion.div>
        </div>
        </div>
      </div>

    </>
  )
}
