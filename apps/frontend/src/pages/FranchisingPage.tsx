import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, MapPin, Clock, Tag, FileText, Megaphone, Building2, CheckCircle, Layers } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Chatbot WhatsApp per Franchising Multi-Sede - eChatbot",
    seoDesc: "Un'unica AI per tutte le tue sedi in franchising. Configurazione centrale del brand con override per sede di orari, prezzi, istruzioni e promozioni. L'AI riconosce da quale sede scrive il cliente e risponde sempre con i dati corretti.",
    seoKeys: "chatbot franchising, whatsapp multi sede, chatbot multi negozio, assistente ia franchising, gestione sedi whatsapp, override prezzi orari sede",
    breadcrumb: "Franchising Multi-Sede",
    badge: "Per Catene e Franchising",
    heroTitle: "Una sola AI.\nOgni sede. La risposta giusta, sempre.",
    heroSub: "Il brand è uno, le sedi sono tante — ognuna con i suoi orari, prezzi e regole. eChatbot riconosce da quale punto vendita scrive il cliente e risponde con i dati esatti di quel locale. Tu governi tutto da un unico pannello.",
    cta: "Parliamone",
    ctaSub: "Demo personalizzata, nessun impegno",
    overrideTitle: "Configurazione centrale, override per sede.",
    overrideSub: "Imposti il brand una volta. Ogni sede eredita tutto e sovrascrive solo ciò che cambia. Zero duplicazioni, zero risposte sbagliate.",
    overrideItems: [
      { icon: "clock", title: "Orari", desc: "Ogni sede ha i suoi orari di apertura, festivi e chiusure straordinarie. L'AI risponde sempre con l'orario del locale corretto." },
      { icon: "tag", title: "Prezzi", desc: "Listini diversi per sede o area. Promozioni locali senza toccare il listino nazionale." },
      { icon: "file", title: "Istruzioni", desc: "Procedure, FAQ e istruzioni operative specifiche per punto vendita. Quello che vale per una sede non confonde le altre." },
      { icon: "megaphone", title: "Promozioni", desc: "Campagne mirate per singola sede o gruppo di sedi, inviate via WhatsApp solo ai clienti di quell'area." },
    ],
    problemsTitle: "I problemi di chi gestisce più sedi",
    problems: [
      { num: "1", problem: "Ogni sede risponde in modo diverso e il cliente riceve informazioni sbagliate?", solutionTitle: "Risposte coerenti col brand", solutionDesc: "Una base di conoscenza centrale garantisce tono e contenuti uniformi. Ogni sede aggiunge solo i propri dettagli locali." },
      { num: "2", problem: "Aggiornare orari e prezzi su decine di sedi è un incubo?", solutionTitle: "Un pannello, tutte le sedi", solutionDesc: "Modifichi al centro o per singola sede. Le modifiche sono immediate, senza ricaricare prompt o riaddestrare nulla." },
      { num: "3", problem: "Il cliente non sa a quale sede rivolgersi o scrive a quella sbagliata?", solutionTitle: "Riconoscimento automatico della sede", solutionDesc: "L'AI identifica il punto vendita dal contesto e risponde con indirizzo, orari e contatti corretti — o chiede quale sede serve." },
      { num: "4", problem: "Le promozioni locali si perdono o arrivano ai clienti sbagliati?", solutionTitle: "Campagne per sede", solutionDesc: "Invii offerte mirate solo ai clienti di una sede o area, dallo stesso canale di supporto WhatsApp." },
    ],
    tagline: "Un brand coerente al centro, dati corretti in ogni sede.",
    howTitle: "Come funziona",
    howSub: "Dalla configurazione centrale alla risposta locale, tutto automatico.",
    steps: [
      { icon: "🏢", title: "Configuri il brand", desc: "Definisci una volta tono, conoscenza di base, regole e contenuti comuni a tutte le sedi." },
      { icon: "📍", title: "Aggiungi le sedi", desc: "Ogni punto vendita eredita la base e sovrascrive solo ciò che cambia: orari, prezzi, istruzioni, indirizzo." },
      { icon: "💬", title: "Il cliente scrive", desc: "L'AI riconosce la sede dal contesto e risponde con i dati esatti di quel locale, nella lingua del cliente." },
      { icon: "📊", title: "Governi tutto", desc: "Monitori conversazioni e performance per sede da un unico pannello. Modifiche immediate, ovunque." },
    ],
    benefitsTitle: "Perché le catene scelgono eChatbot",
    benefits: [
      { icon: "layers", title: "Scala senza caos", desc: "Aggiungi nuove sedi in minuti. La base centrale fa il lavoro pesante, la sede mette solo i dettagli." },
      { icon: "building", title: "Controllo del brand", desc: "Mantieni voce e qualità uniformi su tutta la rete, anche con decine di sedi e operatori diversi." },
      { icon: "pin", title: "Precisione locale", desc: "Mai più orari o prezzi sbagliati: ogni cliente riceve i dati della sua sede." },
    ],
    ctaTitle: "Hai una rete in franchising?",
    ctaDesc: "Ti mostriamo come gestire tutte le sedi con un'unica AI. Demo su misura per la tua catena.",
  },
  en: {
    seoTitle: "WhatsApp Chatbot for Multi-Location Franchises - eChatbot",
    seoDesc: "One AI for all your franchise locations. Central brand setup with per-store override of hours, prices, instructions and promotions. The AI detects which location the customer is writing from and always answers with the correct data.",
    seoKeys: "franchise chatbot, multi location whatsapp, multi store chatbot, franchise ai assistant, location management whatsapp, per store price hours override",
    breadcrumb: "Multi-Location Franchises",
    badge: "For Chains & Franchises",
    heroTitle: "One AI.\nEvery location. The right answer, every time.",
    heroSub: "One brand, many locations — each with its own hours, prices and rules. eChatbot detects which store the customer is writing from and replies with that location's exact data. You manage everything from a single panel.",
    cta: "Let's Talk",
    ctaSub: "Custom demo, no commitment",
    overrideTitle: "Central setup, per-store override.",
    overrideSub: "Configure the brand once. Each location inherits everything and overrides only what changes. Zero duplication, zero wrong answers.",
    overrideItems: [
      { icon: "clock", title: "Hours", desc: "Each location has its own opening hours, holidays and special closures. The AI always answers with the correct store's schedule." },
      { icon: "tag", title: "Prices", desc: "Different price lists per location or area. Local promotions without touching the national list." },
      { icon: "file", title: "Instructions", desc: "Procedures, FAQs and operating instructions specific to each store. What applies to one location never confuses the others." },
      { icon: "megaphone", title: "Promotions", desc: "Targeted campaigns for a single location or group of stores, sent via WhatsApp only to customers in that area." },
    ],
    problemsTitle: "The pains of running multiple locations",
    problems: [
      { num: "1", problem: "Each location answers differently and customers get wrong information?", solutionTitle: "On-brand, consistent answers", solutionDesc: "A central knowledge base keeps tone and content uniform. Each location adds only its own local details." },
      { num: "2", problem: "Updating hours and prices across dozens of stores is a nightmare?", solutionTitle: "One panel, all locations", solutionDesc: "Edit centrally or per location. Changes are instant — no reloading prompts or retraining anything." },
      { num: "3", problem: "Customers don't know which location to ask, or write to the wrong one?", solutionTitle: "Automatic location detection", solutionDesc: "The AI identifies the store from context and replies with the correct address, hours and contacts — or asks which location is needed." },
      { num: "4", problem: "Local promotions get lost or reach the wrong customers?", solutionTitle: "Per-location campaigns", solutionDesc: "Send targeted offers only to customers of one location or area, from the same WhatsApp support channel." },
    ],
    tagline: "A consistent brand at the center, correct data at every location.",
    howTitle: "How it works",
    howSub: "From central setup to local answer, all automatic.",
    steps: [
      { icon: "🏢", title: "Configure the brand", desc: "Define tone, base knowledge, rules and shared content once for all locations." },
      { icon: "📍", title: "Add locations", desc: "Each store inherits the base and overrides only what changes: hours, prices, instructions, address." },
      { icon: "💬", title: "Customer writes", desc: "The AI detects the location from context and answers with that store's exact data, in the customer's language." },
      { icon: "📊", title: "Govern everything", desc: "Monitor conversations and performance per location from a single panel. Instant changes, everywhere." },
    ],
    benefitsTitle: "Why chains choose eChatbot",
    benefits: [
      { icon: "layers", title: "Scale without chaos", desc: "Add new locations in minutes. The central base does the heavy lifting, the store adds only the details." },
      { icon: "building", title: "Brand control", desc: "Keep voice and quality uniform across the whole network, even with dozens of locations and different operators." },
      { icon: "pin", title: "Local accuracy", desc: "No more wrong hours or prices: every customer gets their own location's data." },
    ],
    ctaTitle: "Run a franchise network?",
    ctaDesc: "We'll show you how to manage every location with a single AI. Demo tailored to your chain.",
  },
  es: {
    seoTitle: "Chatbot WhatsApp para Franquicias Multi-Sede - eChatbot",
    seoDesc: "Una sola IA para todas las sedes de tu franquicia. Configuración central de la marca con override por local de horarios, precios, instrucciones y promociones. La IA detecta desde qué sede escribe el cliente y responde siempre con los datos correctos.",
    seoKeys: "chatbot franquicia, whatsapp multi sede, chatbot multi tienda, asistente ia franquicia, gestión locales whatsapp, override precios horarios sede",
    breadcrumb: "Franquicias Multi-Sede",
    badge: "Para Cadenas y Franquicias",
    heroTitle: "Una sola IA.\nCada sede. La respuesta correcta, siempre.",
    heroSub: "Una marca, muchas sedes — cada una con sus horarios, precios y reglas. eChatbot detecta desde qué local escribe el cliente y responde con los datos exactos de esa sede. Tú lo gestionas todo desde un único panel.",
    cta: "¿Lo hablamos?",
    ctaSub: "Demo personalizada, sin compromiso",
    overrideTitle: "Configuración central, override por sede.",
    overrideSub: "Configuras la marca una vez. Cada sede hereda todo y sobrescribe solo lo que cambia. Cero duplicación, cero respuestas erróneas.",
    overrideItems: [
      { icon: "clock", title: "Horarios", desc: "Cada sede tiene sus horarios de apertura, festivos y cierres especiales. La IA responde siempre con el horario del local correcto." },
      { icon: "tag", title: "Precios", desc: "Listas de precios distintas por sede o zona. Promociones locales sin tocar la lista nacional." },
      { icon: "file", title: "Instrucciones", desc: "Procedimientos, FAQ e instrucciones operativas específicas por local. Lo que vale para una sede no confunde a las demás." },
      { icon: "megaphone", title: "Promociones", desc: "Campañas dirigidas a una sede o grupo de sedes, enviadas por WhatsApp solo a los clientes de esa zona." },
    ],
    problemsTitle: "Los problemas de gestionar varias sedes",
    problems: [
      { num: "1", problem: "¿Cada sede responde de forma distinta y el cliente recibe información errónea?", solutionTitle: "Respuestas coherentes con la marca", solutionDesc: "Una base de conocimiento central garantiza tono y contenido uniformes. Cada sede añade solo sus detalles locales." },
      { num: "2", problem: "¿Actualizar horarios y precios en decenas de sedes es una pesadilla?", solutionTitle: "Un panel, todas las sedes", solutionDesc: "Editas en el centro o por sede. Los cambios son inmediatos, sin recargar prompts ni reentrenar nada." },
      { num: "3", problem: "¿El cliente no sabe a qué sede dirigirse o escribe a la equivocada?", solutionTitle: "Reconocimiento automático de sede", solutionDesc: "La IA identifica el local por el contexto y responde con dirección, horarios y contactos correctos — o pregunta qué sede necesita." },
      { num: "4", problem: "¿Las promociones locales se pierden o llegan a los clientes equivocados?", solutionTitle: "Campañas por sede", solutionDesc: "Envías ofertas dirigidas solo a los clientes de una sede o zona, desde el mismo canal de soporte de WhatsApp." },
    ],
    tagline: "Una marca coherente en el centro, datos correctos en cada sede.",
    howTitle: "Cómo funciona",
    howSub: "De la configuración central a la respuesta local, todo automático.",
    steps: [
      { icon: "🏢", title: "Configuras la marca", desc: "Defines una vez tono, conocimiento base, reglas y contenido común a todas las sedes." },
      { icon: "📍", title: "Añades las sedes", desc: "Cada local hereda la base y sobrescribe solo lo que cambia: horarios, precios, instrucciones, dirección." },
      { icon: "💬", title: "El cliente escribe", desc: "La IA reconoce la sede por el contexto y responde con los datos exactos de ese local, en el idioma del cliente." },
      { icon: "📊", title: "Lo gestionas todo", desc: "Monitorizas conversaciones y rendimiento por sede desde un único panel. Cambios inmediatos, en todas partes." },
    ],
    benefitsTitle: "Por qué las cadenas eligen eChatbot",
    benefits: [
      { icon: "layers", title: "Escala sin caos", desc: "Añade nuevas sedes en minutos. La base central hace el trabajo pesado, la sede solo pone los detalles." },
      { icon: "building", title: "Control de marca", desc: "Mantén voz y calidad uniformes en toda la red, incluso con decenas de sedes y operadores distintos." },
      { icon: "pin", title: "Precisión local", desc: "Nunca más horarios o precios equivocados: cada cliente recibe los datos de su sede." },
    ],
    ctaTitle: "¿Tienes una red de franquicias?",
    ctaDesc: "Te mostramos cómo gestionar todas las sedes con una sola IA. Demo a medida para tu cadena.",
  },
  pt: {
    seoTitle: "Chatbot WhatsApp para Franquias Multi-Sede - eChatbot",
    seoDesc: "Uma única IA para todas as unidades da sua franquia. Configuração central da marca com override por loja de horários, preços, instruções e promoções. A IA deteta de qual unidade o cliente está a escrever e responde sempre com os dados corretos.",
    seoKeys: "chatbot franquia, whatsapp multi unidade, chatbot multi loja, assistente ia franquia, gestão unidades whatsapp, override preços horários unidade",
    breadcrumb: "Franquias Multi-Sede",
    badge: "Para Redes e Franquias",
    heroTitle: "Uma única IA.\nCada unidade. A resposta certa, sempre.",
    heroSub: "Uma marca, muitas unidades — cada uma com os seus horários, preços e regras. O eChatbot deteta de qual loja o cliente está a escrever e responde com os dados exatos dessa unidade. Você gere tudo a partir de um único painel.",
    cta: "Vamos conversar",
    ctaSub: "Demo personalizada, sem compromisso",
    overrideTitle: "Configuração central, override por unidade.",
    overrideSub: "Configura a marca uma vez. Cada unidade herda tudo e sobrescreve apenas o que muda. Zero duplicação, zero respostas erradas.",
    overrideItems: [
      { icon: "clock", title: "Horários", desc: "Cada unidade tem os seus horários de abertura, feriados e fechos especiais. A IA responde sempre com o horário da loja correta." },
      { icon: "tag", title: "Preços", desc: "Tabelas de preços diferentes por unidade ou zona. Promoções locais sem tocar na tabela nacional." },
      { icon: "file", title: "Instruções", desc: "Procedimentos, FAQ e instruções operacionais específicas por loja. O que vale para uma unidade não confunde as outras." },
      { icon: "megaphone", title: "Promoções", desc: "Campanhas dirigidas a uma unidade ou grupo de lojas, enviadas por WhatsApp apenas aos clientes dessa zona." },
    ],
    problemsTitle: "Os problemas de gerir várias unidades",
    problems: [
      { num: "1", problem: "Cada unidade responde de forma diferente e o cliente recebe informação errada?", solutionTitle: "Respostas coerentes com a marca", solutionDesc: "Uma base de conhecimento central garante tom e conteúdo uniformes. Cada unidade adiciona apenas os seus detalhes locais." },
      { num: "2", problem: "Atualizar horários e preços em dezenas de lojas é um pesadelo?", solutionTitle: "Um painel, todas as unidades", solutionDesc: "Edita no centro ou por unidade. As alterações são imediatas, sem recarregar prompts nem retreinar nada." },
      { num: "3", problem: "O cliente não sabe a que unidade se dirigir ou escreve à errada?", solutionTitle: "Reconhecimento automático da unidade", solutionDesc: "A IA identifica a loja pelo contexto e responde com a morada, horários e contactos corretos — ou pergunta qual a unidade necessária." },
      { num: "4", problem: "As promoções locais perdem-se ou chegam aos clientes errados?", solutionTitle: "Campanhas por unidade", solutionDesc: "Envia ofertas dirigidas apenas aos clientes de uma unidade ou zona, a partir do mesmo canal de suporte WhatsApp." },
    ],
    tagline: "Uma marca coerente no centro, dados corretos em cada unidade.",
    howTitle: "Como funciona",
    howSub: "Da configuração central à resposta local, tudo automático.",
    steps: [
      { icon: "🏢", title: "Configura a marca", desc: "Define uma vez o tom, conhecimento base, regras e conteúdo comum a todas as unidades." },
      { icon: "📍", title: "Adiciona as unidades", desc: "Cada loja herda a base e sobrescreve apenas o que muda: horários, preços, instruções, morada." },
      { icon: "💬", title: "O cliente escreve", desc: "A IA reconhece a unidade pelo contexto e responde com os dados exatos dessa loja, no idioma do cliente." },
      { icon: "📊", title: "Gere tudo", desc: "Monitoriza conversas e desempenho por unidade a partir de um único painel. Alterações imediatas, em todo o lado." },
    ],
    benefitsTitle: "Porque as redes escolhem o eChatbot",
    benefits: [
      { icon: "layers", title: "Escala sem caos", desc: "Adiciona novas unidades em minutos. A base central faz o trabalho pesado, a loja coloca apenas os detalhes." },
      { icon: "building", title: "Controlo da marca", desc: "Mantém voz e qualidade uniformes em toda a rede, mesmo com dezenas de unidades e operadores diferentes." },
      { icon: "pin", title: "Precisão local", desc: "Nunca mais horários ou preços errados: cada cliente recebe os dados da sua unidade." },
    ],
    ctaTitle: "Tem uma rede de franquias?",
    ctaDesc: "Mostramos-lhe como gerir todas as unidades com uma única IA. Demo à medida da sua rede.",
  },
}

const overrideIcon = (key: string) => {
  if (key === "clock") return <Clock className="w-6 h-6 text-green-600" />
  if (key === "tag") return <Tag className="w-6 h-6 text-green-600" />
  if (key === "file") return <FileText className="w-6 h-6 text-green-600" />
  return <Megaphone className="w-6 h-6 text-green-600" />
}

const benefitIcon = (key: string) => {
  if (key === "layers") return <Layers className="w-6 h-6 text-green-600" />
  if (key === "building") return <Building2 className="w-6 h-6 text-green-600" />
  return <MapPin className="w-6 h-6 text-green-600" />
}

export function FranchisingPage() {
  const { language } = useLanguage()
  const t = T[(language as Language) ?? "en"] ?? T.en

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <SEO
        title={t.seoTitle}
        description={t.seoDesc}
        keywords={t.seoKeys}
        url="/franchising"
        lang={language as Language}
        serviceType="Multi-Location Franchise WhatsApp Chatbot"
      />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-green-50 via-white to-green-50 overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} />
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* Left: text */}
              <div>
                <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-6">
                  {t.badge}
                </span>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-4xl lg:text-5xl font-bold leading-tight mb-6 whitespace-pre-line text-slate-900"
                >
                  {t.heroTitle}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-lg text-slate-600 mb-8 max-w-xl"
                >
                  {t.heroSub}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex flex-col sm:flex-row gap-4"
                >
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl transition-colors"
                  >
                    {t.cta} <ArrowRight className="w-5 h-5" />
                  </Link>
                  <p className="self-center text-sm text-slate-500">{t.ctaSub}</p>
                </motion.div>
              </div>
              {/* Right: illustration — drop public/franchising.png (same style). Hidden until present. */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="hidden lg:block"
              >
                <img
                  src="/franchising.png"
                  alt="eChatbot AI assistant for multi-location franchises"
                  className="w-full h-auto rounded-3xl shadow-2xl border border-gray-100"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Override centerpiece */}
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">{t.overrideTitle}</h2>
              <p className="text-gray-600 leading-relaxed">{t.overrideSub}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Override panel mockup */}
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 text-sm">
                <div className="flex items-center gap-2 mb-4 text-green-700 font-semibold text-xs uppercase tracking-wide">
                  <Building2 className="w-4 h-4" /> Brand · EcoWash
                </div>
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl p-3 border-l-2 border-gray-300">
                    <p className="text-gray-500 text-xs mb-1">Default (all locations)</p>
                    <p className="text-gray-800">Mon–Sat 08:00–20:00 · Wash €4.50</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 border-l-2 border-green-500">
                    <p className="text-green-700 text-xs mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Madrid Centro — override
                    </p>
                    <p className="text-gray-900 font-medium">Mon–Sun 07:00–23:00 · Wash €5.00</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 border-l-2 border-green-500">
                    <p className="text-green-700 text-xs mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Sevilla Triana — override
                    </p>
                    <p className="text-gray-900 font-medium">Mon–Sat 09:00–21:00 · Wash €4.00</p>
                  </div>
                </div>
              </div>

              {/* Override item grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {t.overrideItems.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.08 }}
                    className="bg-gray-50 rounded-2xl p-5 border border-gray-100"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {overrideIcon(item.icon)}
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Problems → Solutions */}
        <section className="py-16 lg:py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">{t.problemsTitle}</h2>
            <div className="space-y-6">
              {t.problems.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.07 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start rounded-2xl border border-gray-100 shadow-sm bg-white p-6"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center">{item.num}</span>
                    <p className="text-base font-medium text-gray-800">{item.problem}</p>
                  </div>
                  <div className="flex items-start gap-3 md:border-l md:border-gray-100 md:pl-6">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-gray-900 mb-1">{item.solutionTitle}</p>
                      <p className="text-sm text-gray-600">{item.solutionDesc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-10 bg-green-600 text-white rounded-2xl px-8 py-5 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <p className="font-semibold">{t.tagline}</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">{t.howTitle}</h2>
              <p className="text-gray-600">{t.howSub}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {t.steps.map((step, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
                >
                  <div className="text-3xl mb-3">{step.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 lg:py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">{t.benefitsTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.benefits.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {benefitIcon(item.icon)}
                    <h3 className="font-bold text-gray-900">{item.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 lg:py-24 bg-gradient-to-br from-green-600 to-green-700 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold mb-4">{t.ctaTitle}</h2>
            <p className="text-green-100 text-lg mb-8">{t.ctaDesc}</p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-green-700 font-bold px-10 py-4 rounded-xl transition-colors text-lg"
            >
              {t.cta} <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </>
  )
}
