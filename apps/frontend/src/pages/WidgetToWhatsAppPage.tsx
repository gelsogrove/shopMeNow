import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Zap, CheckCircle } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Widget Chat → WhatsApp - Chatbot Unificato per Sito e WhatsApp",
    ctaTitle: "Pronto ad unificare i tuoi canali?",
    seoDesc: "Scopri come eChatbot unifica il widget sul sito web con WhatsApp in un'unica sessione continua. I clienti iniziano sul sito e continuano su WhatsApp senza perdere il contesto.",
    seoKeys: "widget whatsapp, chatbot sito web, chat widget, whatsapp business chatbot, omnichannel chatbot, unified chat session",
    breadcrumb: "Widget → WhatsApp",
    badge: "Omnicanale",
    heroTitle: "Un chatbot, due canali,\nzero discontinuità",
    heroSub: "Il cliente inizia a chattare sul tuo sito web nel widget, poi continua su WhatsApp. La conversazione non si interrompe mai. Nessun dato perso, nessuna ripetizione.",
    cta: "Contattaci",
    ctaSub: "Nessun impegno, ti rispondiamo a breve",
    howTitle: "Come funziona",
    howSub: "Un'esperienza cliente senza precedenti in 3 semplici passaggi",
    steps: [
      { step: "1", icon: "🌐", title: "Cliente visita il sito", desc: "Il visitatore apre il widget di chat sul tuo sito web e inizia una conversazione con l'AI chatbot. Viene identificato automaticamente." },
      { step: "2", icon: "📱", title: "Passa a WhatsApp", desc: "Con un clic, il cliente trasferisce la conversazione su WhatsApp. Tutto il contesto, la cronologia e i dati vengono trasferiti istantaneamente." },
      { step: "3", icon: "✅", title: "Continua senza interruzioni", desc: "La conversazione riprende esattamente da dove era rimasta. Il chatbot AI ricorda tutto e può continuare ad assistere o passare a un operatore umano." },
    ],
    benefitsTitle: "Perché il Widget → WhatsApp cambia tutto",
    benefits: [
      { icon: "🎯", title: "Tasso di conversione +40%", desc: "I clienti che passano da widget a WhatsApp hanno il 40% di probabilità in più di completare un acquisto, grazie alla continuità dell'esperienza." },
      { icon: "⏱️", title: "Zero attrito nel passaggio", desc: "L'handover widget → WhatsApp avviene in un clic. Nessun modulo da compilare, nessuna ripetizione di informazioni già fornite." },
      { icon: "🧠", title: "Memoria della conversazione", desc: "Il chatbot AI mantiene il contesto completo: prodotti visualizzati, domande fatte, preferenze espresse. Tutto viene ricordato su entrambi i canali." },
      { icon: "📊", title: "Analytics unificati", desc: "Dashboard unificata con metriche di entrambi i canali. Vedi il percorso completo del cliente dal widget fino alla conversione su WhatsApp." },
    ],
    techTitle: "Tecnologia sotto il cofano",
    techDesc: "eChatbot utilizza session tokens crittografati per trasferire il contesto tra widget e WhatsApp. La tecnologia proprietaria garantisce che ogni cliente venga riconosciuto e la conversazione continui senza interruzioni, anche dopo ore o giorni.",
    imagePlaceholder1: "Widget Chat Screenshot",
    imagePlaceholder2: "WhatsApp Conversation Screenshot",
    useCasesTitle: "Casi d'uso",
    useCases: [
      { icon: "🛒", title: "E-commerce", desc: "Il cliente cerca un prodotto sul widget, poi riceve su WhatsApp aggiornamenti in tempo reale su disponibilità, spedizione e promozioni personalizzate." },
      { icon: "🏥", title: "Sanità & Benessere", desc: "Il paziente prenota un appuntamento sul widget del sito e riceve conferme, promemoria e follow-up su WhatsApp." },
      { icon: "🏠", title: "Real Estate", desc: "Il potenziale acquirente esplora le proprietà sul sito e viene guidato su WhatsApp durante l'intero processo di acquisto/affitto." },
      { icon: "🎓", title: "Formazione", desc: "Lo studente si informa sui corsi sul widget e riceve materiali, aggiornamenti e supporto direttamente su WhatsApp." },
    ],
  },
  en: {
    seoTitle: "Widget Chat → WhatsApp - Unified Chatbot for Website and WhatsApp",
    ctaTitle: "Ready to unify your channels?",
    seoDesc: "Discover how eChatbot unifies your website chat widget with WhatsApp in a single continuous session. Customers start on your site and continue on WhatsApp without losing context.",
    seoKeys: "widget whatsapp, website chatbot, chat widget, whatsapp business chatbot, omnichannel chatbot, unified chat session",
    breadcrumb: "Widget → WhatsApp",
    badge: "Omnichannel",
    heroTitle: "One chatbot, two channels,\nzero discontinuity",
    heroSub: "The customer starts chatting on your website widget, then continues on WhatsApp. The conversation never breaks. No lost data, no repetition.",
    cta: "Contact Us",
    ctaSub: "No commitment — we will get back to you shortly",
    howTitle: "How It Works",
    howSub: "An unprecedented customer experience in 3 simple steps",
    steps: [
      { step: "1", icon: "🌐", title: "Customer visits the site", desc: "The visitor opens the chat widget on your website and starts a conversation with the AI chatbot. They are automatically identified." },
      { step: "2", icon: "📱", title: "Switch to WhatsApp", desc: "With one click, the customer transfers the conversation to WhatsApp. All context, history and data are transferred instantly." },
      { step: "3", icon: "✅", title: "Continue seamlessly", desc: "The conversation picks up exactly where it left off. The AI chatbot remembers everything and can continue assisting or hand off to a human agent." },
    ],
    benefitsTitle: "Why Widget → WhatsApp changes everything",
    benefits: [
      { icon: "🎯", title: "Conversion rate +40%", desc: "Customers who move from widget to WhatsApp are 40% more likely to complete a purchase, thanks to the continuity of the experience." },
      { icon: "⏱️", title: "Zero friction in transition", desc: "The widget → WhatsApp handover happens in one click. No forms to fill out, no repetition of information already provided." },
      { icon: "🧠", title: "Conversation memory", desc: "The AI chatbot maintains full context: viewed products, questions asked, expressed preferences. Everything is remembered across both channels." },
      { icon: "📊", title: "Unified analytics", desc: "Unified dashboard with metrics from both channels. See the complete customer journey from widget to WhatsApp conversion." },
    ],
    techTitle: "Technology Under the Hood",
    techDesc: "eChatbot uses encrypted session tokens to transfer context between widget and WhatsApp. The proprietary technology ensures every customer is recognized and the conversation continues seamlessly, even after hours or days.",
    imagePlaceholder1: "Widget Chat Screenshot",
    imagePlaceholder2: "WhatsApp Conversation Screenshot",
    useCasesTitle: "Use Cases",
    useCases: [
      { icon: "🛒", title: "E-commerce", desc: "The customer searches for a product on the widget, then receives real-time updates on WhatsApp about availability, shipping and personalized promotions." },
      { icon: "🏥", title: "Healthcare & Wellness", desc: "The patient books an appointment on the website widget and receives confirmations, reminders and follow-ups on WhatsApp." },
      { icon: "🏠", title: "Real Estate", desc: "The potential buyer explores properties on the site and is guided on WhatsApp throughout the entire buying/renting process." },
      { icon: "🎓", title: "Education", desc: "The student inquires about courses on the widget and receives materials, updates and support directly on WhatsApp." },
    ],
  },
  es: {
    seoTitle: "Widget Chat → WhatsApp - Chatbot Unificado para Sitio Web y WhatsApp",
    ctaTitle: "¿Listo para unificar tus canales?",
    seoDesc: "Descubre cómo eChatbot unifica el widget de chat del sitio web con WhatsApp en una sesión continua. Los clientes empiezan en el sitio y continúan en WhatsApp sin perder el contexto.",
    seoKeys: "widget whatsapp, chatbot sitio web, chat widget, whatsapp business chatbot, chatbot omnicanal, sesión chat unificada",
    breadcrumb: "Widget → WhatsApp",
    badge: "Omnicanal",
    heroTitle: "Un chatbot, dos canales,\ncero discontinuidad",
    heroSub: "El cliente empieza a chatear en el widget de tu sitio web, luego continúa en WhatsApp. La conversación nunca se interrumpe. Sin datos perdidos, sin repeticiones.",
    cta: "Contáctanos",
    ctaSub: "Sin compromiso, te respondemos pronto",
    howTitle: "Cómo Funciona",
    howSub: "Una experiencia de cliente sin precedentes en 3 sencillos pasos",
    steps: [
      { step: "1", icon: "🌐", title: "El cliente visita el sitio", desc: "El visitante abre el widget de chat en tu sitio web y empieza una conversación con el chatbot AI. Se identifica automáticamente." },
      { step: "2", icon: "📱", title: "Pasa a WhatsApp", desc: "Con un clic, el cliente transfiere la conversación a WhatsApp. Todo el contexto, historial y datos se transfieren instantáneamente." },
      { step: "3", icon: "✅", title: "Continúa sin interrupciones", desc: "La conversación retoma exactamente donde se quedó. El chatbot AI recuerda todo y puede continuar asistiendo o pasar a un agente humano." },
    ],
    benefitsTitle: "Por qué Widget → WhatsApp lo cambia todo",
    benefits: [
      { icon: "🎯", title: "Tasa de conversión +40%", desc: "Los clientes que pasan del widget a WhatsApp tienen un 40% más de probabilidad de completar una compra, gracias a la continuidad de la experiencia." },
      { icon: "⏱️", title: "Cero fricción en la transición", desc: "La transferencia widget → WhatsApp ocurre con un clic. Sin formularios, sin repetir información ya proporcionada." },
      { icon: "🧠", title: "Memoria de conversación", desc: "El chatbot AI mantiene el contexto completo: productos vistos, preguntas formuladas, preferencias expresadas. Todo se recuerda en ambos canales." },
      { icon: "📊", title: "Analíticas unificadas", desc: "Panel unificado con métricas de ambos canales. Ve el recorrido completo del cliente desde el widget hasta la conversión en WhatsApp." },
    ],
    techTitle: "Tecnología Bajo el Capó",
    techDesc: "eChatbot utiliza tokens de sesión cifrados para transferir contexto entre widget y WhatsApp. La tecnología propietaria garantiza que cada cliente sea reconocido y la conversación continúe sin interrupciones, incluso después de horas o días.",
    imagePlaceholder1: "Captura Widget Chat",
    imagePlaceholder2: "Captura Conversación WhatsApp",
    useCasesTitle: "Casos de Uso",
    useCases: [
      { icon: "🛒", title: "E-commerce", desc: "El cliente busca un producto en el widget, luego recibe actualizaciones en tiempo real en WhatsApp sobre disponibilidad, envío y promociones personalizadas." },
      { icon: "🏥", title: "Salud & Bienestar", desc: "El paciente reserva una cita en el widget del sitio y recibe confirmaciones, recordatorios y seguimiento en WhatsApp." },
      { icon: "🏠", title: "Inmobiliaria", desc: "El comprador potencial explora propiedades en el sitio y es guiado en WhatsApp durante todo el proceso de compra/alquiler." },
      { icon: "🎓", title: "Educación", desc: "El estudiante se informa sobre cursos en el widget y recibe materiales, actualizaciones y soporte directamente en WhatsApp." },
    ],
  },
  pt: {
    seoTitle: "Widget Chat → WhatsApp - Chatbot Unificado para Site e WhatsApp",
    ctaTitle: "Pronto para unificar os seus canais?",
    seoDesc: "Descubra como o eChatbot unifica o widget de chat do site com o WhatsApp em uma sessão contínua. Os clientes começam no site e continuam no WhatsApp sem perder o contexto.",
    seoKeys: "widget whatsapp, chatbot site, chat widget, whatsapp business chatbot, chatbot omnicanal, sessão chat unificada",
    breadcrumb: "Widget → WhatsApp",
    badge: "Omnicanal",
    heroTitle: "Um chatbot, dois canais,\nzero descontinuidade",
    heroSub: "O cliente começa a conversar no widget do seu site, depois continua no WhatsApp. A conversa nunca se interrompe. Sem dados perdidos, sem repetições.",
    cta: "Fale Connosco",
    ctaSub: "Sem compromisso, respondemos em breve",
    howTitle: "Como Funciona",
    howSub: "Uma experiência de cliente sem precedentes em 3 simples passos",
    steps: [
      { step: "1", icon: "🌐", title: "Cliente visita o site", desc: "O visitante abre o widget de chat no seu site e inicia uma conversa com o chatbot AI. É identificado automaticamente." },
      { step: "2", icon: "📱", title: "Passa para o WhatsApp", desc: "Com um clique, o cliente transfere a conversa para o WhatsApp. Todo o contexto, histórico e dados são transferidos instantaneamente." },
      { step: "3", icon: "✅", title: "Continua sem interrupções", desc: "A conversa retoma exatamente de onde parou. O chatbot AI lembra de tudo e pode continuar auxiliando ou passar para um agente humano." },
    ],
    benefitsTitle: "Por que Widget → WhatsApp muda tudo",
    benefits: [
      { icon: "🎯", title: "Taxa de conversão +40%", desc: "Clientes que passam do widget para o WhatsApp têm 40% mais probabilidade de concluir uma compra, graças à continuidade da experiência." },
      { icon: "⏱️", title: "Zero atrito na transição", desc: "A transferência widget → WhatsApp acontece em um clique. Sem formulários para preencher, sem repetição de informações já fornecidas." },
      { icon: "🧠", title: "Memória da conversa", desc: "O chatbot AI mantém o contexto completo: produtos visualizados, perguntas feitas, preferências expressas. Tudo é lembrado em ambos os canais." },
      { icon: "📊", title: "Analytics unificados", desc: "Dashboard unificado com métricas de ambos os canais. Veja a jornada completa do cliente desde o widget até a conversão no WhatsApp." },
    ],
    techTitle: "Tecnologia Sob o Capô",
    techDesc: "O eChatbot usa tokens de sessão criptografados para transferir contexto entre widget e WhatsApp. A tecnologia proprietária garante que cada cliente seja reconhecido e a conversa continue sem interrupções, mesmo após horas ou dias.",
    imagePlaceholder1: "Screenshot Widget Chat",
    imagePlaceholder2: "Screenshot Conversa WhatsApp",
    useCasesTitle: "Casos de Uso",
    useCases: [
      { icon: "🛒", title: "E-commerce", desc: "O cliente procura um produto no widget, depois recebe atualizações em tempo real no WhatsApp sobre disponibilidade, envio e promoções personalizadas." },
      { icon: "🏥", title: "Saúde & Bem-estar", desc: "O paciente agenda um compromisso no widget do site e recebe confirmações, lembretes e acompanhamento no WhatsApp." },
      { icon: "🏠", title: "Imobiliária", desc: "O potencial comprador explora imóveis no site e é guiado no WhatsApp durante todo o processo de compra/aluguel." },
      { icon: "🎓", title: "Educação", desc: "O estudante se informa sobre cursos no widget e recebe materiais, atualizações e suporte diretamente no WhatsApp." },
    ],
  },
}

export function WidgetToWhatsAppPage() {
  const { language } = useLanguage()
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/widget-to-whatsapp" lang={language} serviceType="Website Widget to WhatsApp" />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-teal-50 via-white to-green-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} hideVisual />

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              {/* Left: Text */}
              <div>
                <span className="inline-block bg-teal-100 text-teal-700 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                  {t.badge}
                </span>
                <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight whitespace-pre-line">
                  {t.heroTitle}
                </h1>
                <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                  {t.heroSub}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
                  >
                    <Zap className="h-5 w-5" />
                    {t.cta}
                  </Link>
                  <p className="text-sm text-slate-400 self-center">{t.ctaSub}</p>
                </div>
              </div>

              {/* Right: New single illustration */}
              <div className="relative flex justify-center">
                <div className="relative w-full max-w-xl">
                  <div className="absolute -inset-6 bg-gradient-to-br from-emerald-200/40 via-white to-teal-200/40 rounded-[36px] blur-3xl" />
                  <img
                    src="/survey.png"
                    alt="Widget to WhatsApp illustration"
                    className="relative w-full h-auto rounded-[28px] shadow-2xl border border-white/60 object-contain"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">{t.howTitle}</h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">{t.howSub}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {t.steps.map((step, index) => (
                <div className="relative" key={index}>
                  <motion.div
                    className="bg-gradient-to-br from-teal-50 to-green-50 rounded-2xl p-8 border-2 border-teal-100 h-full shadow-lg hover:shadow-xl transition-all duration-500 flex flex-col"
                    initial={{ opacity: 0, y: 60 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.65, delay: index * 0.1 }}
                  >
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-6 shadow-lg">
                      {step.step}
                    </div>
                    <div className="text-4xl mb-4">{step.icon}</div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">{step.title}</h3>
                    <p className="text-slate-600 leading-relaxed flex-1">{step.desc}</p>
                  </motion.div>

                  {index < t.steps.length - 1 && (
                    <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-green-600 z-10">
                      <ArrowRight className="h-8 w-8" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">{t.benefitsTitle}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {t.benefits.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex gap-6 p-6 bg-white rounded-2xl shadow-md border border-slate-100 hover:shadow-lg transition-all"
                >
                  <div className="text-4xl flex-shrink-0">{b.icon}</div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{b.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{b.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              className="group relative"
              initial={{ opacity: 0, x: -80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.65 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-teal-100 rounded-3xl sm:rotate-1 scale-[1.01] shadow-lg group-hover:rotate-2 transition-transform duration-500" />
              <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:-translate-y-1 transition-all duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  <div className="space-y-6">
                    <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">{t.techTitle}</h2>
                    <p className="text-lg text-slate-600 leading-relaxed">{t.techDesc}</p>
                    <ul className="space-y-3">
                      {["Token cifrato end-to-end", "Sessione persistente 24h", "Trasferimento istantaneo < 100ms", "GDPR compliant"].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-slate-700">
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Technical architecture */}
                  <div className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-br from-teal-100 to-green-100 rounded-2xl blur-xl opacity-40" />
                    <img src="/demo.png" alt="Technical Architecture" className="relative w-full h-auto rounded-2xl shadow-xl border border-white/60 object-contain" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-slate-900 mb-4">{t.useCasesTitle}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {t.useCases.map((uc, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="text-4xl mb-4">{uc.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{uc.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{uc.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-green-600 to-teal-700">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">{t.ctaTitle}</h2>
            <p className="text-xl text-green-100 mb-8">{t.ctaSub}</p>
            <Link to="/contact" className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 text-green-600 font-semibold px-10 py-5 rounded-2xl shadow-lg text-lg transition-all">
              <Zap className="h-6 w-6" />
              {t.cta}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
