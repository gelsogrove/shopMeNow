import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { SEO } from "@/components/SEO"
import { WidgetLoader } from "@/components/WidgetLoader"
import { ChatWidget } from "@/components/ChatWidget"
import { ArrowRight } from "lucide-react"

// ─────────────────────────────────────────
// Translations
// ─────────────────────────────────────────
type Lang = "it" | "en" | "es" | "pt"

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
    seoDesc: "eChatbot.AI cerca il Cliente 0 all'interno del network Neapolis. Chatbot AI su misura, completamente gratuito per un anno.",
    badge: "Offerta esclusiva per la community Neapolis",
    greeting: "Ciao, benvenuto su eChatbot.AI",
    introPart1: "Sviluppiamo chatbot su misura, integrati con i sistemi aziendali del cliente (CRM, ERP, e-commerce, ecc.). Trasformiamo la conversazione in uno strumento strategico: risposte precise in tempo reale basate sui dati aziendali, e notifiche push per azioni di marketing conversazionale mirato.",
    introPart2: "Per crescere abbiamo bisogno del nostro Cliente 0, una startup del network Neàpolis con cui co-costruire il prodotto. Per questo offriamo il servizio completo gratuitamente per il primo anno.",
    offer: "Offriamo il servizio completamente gratuito per un anno.",
    offerFreeWord: "gratuito",
    offerItems: [
      "Sviluppo delle integrazioni con i tuoi sistemi esistenti (CRM, ERP, e-commerce, ecc.) a nostro carico",
      "Supporto continuo gratuito per 12 mesi",
    ],
    offerExclusion: "Non copriamo i costi di utilizzo dei modelli LLM (es. OpenAI)",
    goal: "L'obiettivo è collaborare con un partner che ci permetta di dimostrare concretamente il valore della piattaforma e di farci conoscere all'interno della community.",
    cta_title: "Ti incuriosisce?",
    cta_desc: "Rispondi a qualche breve domanda per capire come eChatbot può trasformare il tuo business. Circa 2 minuti, zero impegno.",
    cta_btn: "Avvia il survey →",
    footer_back: "← Torna alla homepage",
  },
  en: {
    seoTitle: "Neapolis × eChatbot.AI Partnership",
    seoDesc: "eChatbot.AI is looking for Client 0 within the Neapolis network. Custom AI chatbot, completely free for one year.",
    badge: "Exclusive offer for the Neapolis community",
    greeting: "Hello, welcome to eChatbot.AI",
    introPart1: "We develop custom chatbots integrated with the client's business systems (CRM, ERP, e-commerce, etc.). We turn conversation into a strategic tool: precise real-time responses based on corporate data, and push notifications for targeted conversational marketing.",
    introPart2: "To grow, we need our Client 0, a startup within the Neàpolis network to co-build the product with. That's why we offer the full service free for the first year.",
    offer: "We offer the service completely free for one year.",
    offerFreeWord: "free",
    offerItems: [
      "We handle all development to integrate with your existing systems (CRM, ERP, e-commerce, etc.)",
      "Free continuous support for 12 months",
    ],
    offerExclusion: "LLM usage costs not covered (e.g. OpenAI)",
    goal: "Our goal is to collaborate with a partner who allows us to concretely demonstrate the value of the platform and to make ourselves known within the community.",
    cta_title: "Does it sound interesting?",
    cta_desc: "Answer a few quick questions to help us understand how eChatbot can transform your business. About 2 minutes, no commitment.",
    cta_btn: "Start the survey →",
    footer_back: "← Back to homepage",
  },
  es: {
    seoTitle: "Colaboración Neapolis × eChatbot.AI",
    seoDesc: "eChatbot.AI busca al Cliente 0 dentro de la red Neapolis. Chatbot AI personalizado, completamente gratuito durante un año.",
    badge: "Oferta exclusiva para la comunidad Neapolis",
    greeting: "Hola, bienvenido a eChatbot.AI",
    introPart1: "Desarrollamos chatbots a medida integrados con los sistemas del cliente (CRM, ERP, e-commerce, etc.). Transformamos la conversación en una herramienta estratégica: respuestas precisas en tiempo real basadas en datos corporativos, y notificaciones push para acciones de marketing conversacional dirigido.",
    introPart2: "Para crecer necesitamos nuestro Cliente 0, una startup dentro de la red Neàpolis con quien co-construir el producto.",
    offer: "Ofrecemos el servicio completamente gratuito durante un año.",
    offerFreeWord: "gratuito",
    offerItems: [
      "Nos encargamos de todo el desarrollo para integrar con tus sistemas existentes (CRM, ERP, e-commerce, etc.)",
      "Soporte continuo gratuito durante 12 meses",
    ],
    offerExclusion: "No cubrimos los costes de uso de los modelos LLM (ej. OpenAI)",
    goal: "El objetivo es colaborar con un socio que nos permita demostrar concretamente el valor de la plataforma y darnos a conocer dentro de la comunidad.",
    cta_title: "¿Te parece interesante?",
    cta_desc: "Responde algunas preguntas rápidas para entender cómo eChatbot puede transformar tu negocio. Unos 2 minutos, sin compromiso.",
    cta_btn: "Iniciar el survey →",
    footer_back: "← Volver a la página principal",
  },
  pt: {
    seoTitle: "Parceria Neapolis × eChatbot.AI",
    seoDesc: "eChatbot.AI procura o Cliente 0 dentro da rede Neapolis. Chatbot AI personalizado, completamente gratuito por um ano.",
    badge: "Oferta exclusiva para a comunidade Neapolis",
    greeting: "Olá, bem-vindo ao eChatbot.AI",
    introPart1: "Desenvolvemos chatbots personalizados integrados com os sistemas do cliente (CRM, ERP, e-commerce, etc.). Transformamos a conversa numa ferramenta estratégica: respostas precisas em tempo real baseadas em dados corporativos, e notificações push para ações de marketing conversacional dirigido.",
    introPart2: "Para crescer precisamos do nosso Cliente 0, uma startup da rede Neàpolis com quem co-construir o produto. Por isso oferecemos o serviço completo gratuitamente durante o primeiro ano.",
    offer: "Oferecemos o serviço completamente gratuito por um ano.",
    offerFreeWord: "gratuito",
    offerItems: [
      "Tratamos de todo o desenvolvimento para integrar com os seus sistemas existentes (CRM, ERP, e-commerce, etc.)",
      "Suporte contínuo gratuito por 12 meses",
    ],
    offerExclusion: "Custos de uso dos modelos LLM não cobertos (ex. OpenAI)",
    goal: "O objetivo é colaborar com um parceiro que nos permita demonstrar concretamente o valor da plataforma e tornarmo-nos conhecidos dentro da comunidade.",
    cta_title: "Parece interessante?",
    cta_desc: "Responda a algumas perguntas rápidas para entender como o eChatbot pode transformar o seu negócio. Cerca de 2 minutos, sem compromisso.",
    cta_btn: "Iniciar o survey →",
    footer_back: "← Voltar à página inicial",
  },
}

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
              {(["it", "en", "es", "pt"] as Lang[]).map((l) => (
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
            <div className="flex items-center justify-center gap-4 sm:gap-6 px-5 sm:px-10 py-4 sm:py-5 border-b border-slate-100 bg-slate-50/50">
              <img src="https://www.neapolis.cat/wp-content/uploads/2022/09/logo.svg" alt="Neàpolis" className="h-12 sm:h-16 w-auto" />
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />
              <span className="text-2xl sm:text-3xl font-bold text-green-600">eChatbot.AI</span>
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
                <Link
                  to="/survey"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-base"
                >
                  {t.cta_btn}
                </Link>
              </div>

            </div>
          </motion.div>
        </div>
        </div>
      </div>

      <WidgetLoader />
      <ChatWidget workspaceId="echatbot-hq-support" position="bottom-right" logoUrl="/logo.png" useChannelLogo={true} />
    </>
  )
}
