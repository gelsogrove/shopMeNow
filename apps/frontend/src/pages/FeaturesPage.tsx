import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { 
  Bot, 
  MessageSquare, 
  Users, 
  ShoppingCart, 
  Lock, 
  Zap,
  Globe,
  Smartphone,
  Brain,
  Clock,
  TrendingUp,
  CalendarCheck,
} from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"

type Language = "it" | "en" | "es" | "pt"

const translations = {
  it: {
    seoTitle: "Funzionalità - Piattaforma AI Chatbot WhatsApp",
    ctaTitle: "Pronto a trasformare il tuo business?",
    ctaSub: "Raccontaci la tua attività, ti rispondiamo a breve.",
    ctaBtn: "Contattaci",
    seoDescription: "Scopri tutte le funzionalità di eChatbot: automazione AI, supporto umano, marketing push, integrazione CRM, e-commerce, privacy e sicurezza. La piattaforma completa per chatbot WhatsApp.",
    seoKeywords: "chatbot whatsapp, ai chatbot, automazione customer service, marketing push, crm integration, ecommerce chatbot, human in the loop, privacy gdpr",
    breadcrumb: "Funzionalità",
    hero: {
      badge: "Piattaforma Completa",
      title: "Tutto ciò di cui hai bisogno per<br/>automatizzare il tuo business",
      subtitle: "eChatbot combina intelligenza artificiale, automazione e intervento umano per creare esperienze clienti eccezionali su WhatsApp e widget web.",
      cta: "Contattaci",
    },
    coreFeatures: {
      title: "Funzionalità Principali",
      subtitle: "Le capacità che rendono eChatbot la scelta ideale per il tuo business",
      features: [
        {
          icon: "Bot",
          title: "Automazione AI Avanzata",
          description: "Chatbot intelligente basato su GPT-4 che comprende il linguaggio naturale, risponde alle domande complesse e impara dalle conversazioni per migliorare continuamente.",
          points: ["Comprensione del contesto", "Risposte personalizzate", "Apprendimento continuo"],
        },
        {
          icon: "Users",
          title: "Human-in-the-Loop Support",
          description: "Passa facilmente dall'AI a un operatore umano quando necessario. Il chatbot sa quando chiedere aiuto e trasferisce la conversazione senza interruzioni.",
          points: ["Handoff intelligente", "Dashboard operatori", "Continuità conversazione"],
        },
        {
          icon: "MessageSquare",
          title: "Marketing Push Proattivo",
          description: "Invia campagne di marketing mirate su WhatsApp. Segmenta il pubblico, personalizza i messaggi e misura i risultati in tempo reale.",
          points: ["Segmentazione avanzata", "A/B testing", "Analytics dettagliati"],
        },
        {
          icon: "ShoppingCart",
          title: "E-Commerce Integrato",
          description: "Vendi prodotti direttamente su WhatsApp. Catalogo prodotti, carrello, pagamenti e tracking ordini tutto in chat.",
          points: ["Catalogo prodotti AI", "Pagamenti sicuri", "Gestione ordini"],
        },
        {
          icon: "Globe",
          title: "Widget → WhatsApp",
          description: "Un unico chatbot per sito web e WhatsApp. I clienti iniziano sul widget e continuano su WhatsApp senza ripetere informazioni.",
          points: ["Sessione unificata", "Continuità dati", "Zero friction"],
        },
        {
          icon: "Lock",
          title: "Privacy & Sicurezza GDPR",
          description: "Conformità totale GDPR, crittografia end-to-end, data retention policy personalizzabili e controllo completo sui dati dei tuoi clienti.",
          points: ["GDPR compliant", "Crittografia E2E", "Data ownership"],
        },
        {
          icon: "CalendarCheck",
          title: "Prenotazione Appuntamenti",
          description: "System di prenotazione appuntamenti integrato con il chatbot. I clienti possono prenotare, modificare e cancellare appuntamenti direttamente in chat.",
          points: ["Slot disponibili in tempo reale", "Promemoria automatici WhatsApp", "Gestione orari e blackout"],
        },
      ],
    },
    integration: {
      title: "Integrazioni Potenti",
      subtitle: "Connetti eChatbot con i tuoi strumenti di lavoro",
      description: "Integra facilmente il chatbot con CRM (Salesforce, HubSpot), piattaforme e-commerce (WooCommerce, PrestaShop, Magento), sistemi ERP, software di magazzino, strumenti di marketing automation e molto altro.",
      imagePlaceholder: "Placeholder immagine integr",
    },
  },
  en: {
    seoTitle: "Features - AI WhatsApp Chatbot Platform | eChatbot",
    ctaTitle: "Ready to transform your business?",
    ctaSub: "Tell us about your business — we will get back to you shortly.",
    ctaBtn: "Contact Us",
    seoDescription: "Discover all eChatbot features: AI automation, human support, push marketing, CRM integration, e-commerce, privacy and security. The complete platform for WhatsApp chatbots.",
    seoKeywords: "whatsapp chatbot, ai chatbot, customer service automation, push marketing, crm integration, ecommerce chatbot, human in the loop, privacy gdpr",
    breadcrumb: "Features",
    hero: {
      badge: "Complete Platform",
      title: "Everything you need to<br/>automate your business",
      subtitle: "eChatbot combines artificial intelligence, automation and human intervention to create exceptional customer experiences on WhatsApp and web widgets.",
      cta: "Contact Us",
    },
    coreFeatures: {
      title: "Core Features",
      subtitle: "The capabilities that make eChatbot the ideal choice for your business",
      features: [
        { icon: "Bot", title: "Advanced AI Automation", description: "Intelligent chatbot based on GPT-4 that understands natural language, answers complex questions and learns from conversations to continuously improve.", points: ["Context understanding", "Personalized responses", "Continuous learning"] },
        { icon: "Users", title: "Human-in-the-Loop Support", description: "Easily switch from AI to a human operator when needed. The chatbot knows when to ask for help and transfers the conversation seamlessly.", points: ["Intelligent handoff", "Operator dashboard", "Conversation continuity"] },
        { icon: "MessageSquare", title: "Proactive Push Marketing", description: "Send targeted marketing campaigns on WhatsApp. Segment your audience, personalize messages and measure results in real time.", points: ["Advanced segmentation", "A/B testing", "Detailed analytics"] },
        { icon: "ShoppingCart", title: "Integrated E-Commerce", description: "Sell products directly on WhatsApp. Product catalog, cart, payments and order tracking all in chat.", points: ["AI product catalog", "Secure payments", "Order management"] },
        { icon: "Globe", title: "Widget → WhatsApp", description: "A single chatbot for website and WhatsApp. Customers start on the widget and continue on WhatsApp without repeating information.", points: ["Unified session", "Data continuity", "Zero friction"] },
        { icon: "Lock", title: "GDPR Privacy & Security", description: "Full GDPR compliance, end-to-end encryption, customizable data retention policies and complete control over your customers' data.", points: ["GDPR compliant", "E2E encryption", "Data ownership"] },
        { icon: "CalendarCheck", title: "Appointment Booking", description: "Integrated appointment booking system with the chatbot. Customers can book, modify and cancel appointments directly in chat.", points: ["Real-time available slots", "Automatic WhatsApp reminders", "Business hours & blackout management"] },
      ],
    },
    integration: {
      title: "Powerful Integrations",
      subtitle: "Connect eChatbot with your work tools",
      description: "Easily integrate the chatbot with CRMs (Salesforce, HubSpot), e-commerce platforms (WooCommerce, PrestaShop, Magento), ERP systems, warehouse software, marketing automation tools and much more.",
      imagePlaceholder: "Integration image placeholder",
    },
  },
  es: {
    seoTitle: "Funcionalidades - Plataforma AI Chatbot WhatsApp | eChatbot",
    ctaTitle: "¿Listo para transformar tu negocio?",
    ctaSub: "Cuéntanos tu negocio, te respondemos pronto.",
    ctaBtn: "Contáctanos",
    seoDescription: "Descubre todas las funcionalidades de eChatbot: automatización IA, soporte humano, marketing push, integración CRM, e-commerce, privacidad y seguridad.",
    seoKeywords: "chatbot whatsapp, ai chatbot, automatización customer service, marketing push, integración crm, chatbot ecommerce, human in the loop, privacidad gdpr",
    breadcrumb: "Funcionalidades",
    hero: {
      badge: "Plataforma Completa",
      title: "Todo lo que necesitas para<br/>automatizar tu negocio",
      subtitle: "eChatbot combina inteligencia artificial, automatización e intervención humana para crear experiencias de cliente excepcionales en WhatsApp y widgets web.",
      cta: "Contáctanos",
    },
    coreFeatures: {
      title: "Funcionalidades Principales",
      subtitle: "Las capacidades que hacen de eChatbot la elección ideal para tu negocio",
      features: [
        { icon: "Bot", title: "Automatización IA Avanzada", description: "Chatbot inteligente basado en GPT-4 que comprende el lenguaje natural, responde preguntas complejas y aprende de las conversaciones.", points: ["Comprensión del contexto", "Respuestas personalizadas", "Aprendizaje continuo"] },
        { icon: "Users", title: "Soporte Human-in-the-Loop", description: "Cambia fácilmente de IA a un operador humano cuando sea necesario. El chatbot sabe cuándo pedir ayuda y transfiere la conversación sin interrupciones.", points: ["Handoff inteligente", "Dashboard operadores", "Continuidad conversación"] },
        { icon: "MessageSquare", title: "Marketing Push Proactivo", description: "Envía campañas de marketing dirigidas en WhatsApp. Segmenta la audiencia, personaliza los mensajes y mide resultados en tiempo real.", points: ["Segmentación avanzada", "A/B testing", "Analytics detallados"] },
        { icon: "ShoppingCart", title: "E-Commerce Integrado", description: "Vende productos directamente en WhatsApp. Catálogo de productos, carrito, pagos y seguimiento de pedidos todo en el chat.", points: ["Catálogo IA", "Pagos seguros", "Gestión de pedidos"] },
        { icon: "Globe", title: "Widget → WhatsApp", description: "Un único chatbot para sitio web y WhatsApp. Los clientes empiezan en el widget y continúan en WhatsApp sin repetir información.", points: ["Sesión unificada", "Continuidad de datos", "Sin fricción"] },
        { icon: "Lock", title: "Privacidad & Seguridad GDPR", description: "Cumplimiento total GDPR, cifrado de extremo a extremo, políticas de retención de datos personalizables y control completo sobre los datos de tus clientes.", points: ["Conforme GDPR", "Cifrado E2E", "Data ownership"] },
        { icon: "CalendarCheck", title: "Reserva de Citas", description: "Sistema de reserva de citas integrado con el chatbot. Los clientes pueden reservar, modificar y cancelar citas directamente en el chat.", points: ["Slots disponibles en tiempo real", "Recordatorios automáticos WhatsApp", "Gestión de horarios y bloqueos"] },
      ],
    },
    integration: {
      title: "Integraciones Potentes",
      subtitle: "Conecta eChatbot con tus herramientas de trabajo",
      description: "Integra fácilmente el chatbot con CRMs (Salesforce, HubSpot), plataformas de e-commerce (WooCommerce, PrestaShop, Magento), sistemas ERP, software de almacén, herramientas de marketing automation y mucho más.",
      imagePlaceholder: "Imagen de integración",
    },
  },
  pt: {
    seoTitle: "Funcionalidades - Plataforma IA Chatbot WhatsApp | eChatbot",
    ctaTitle: "Pronto para transformar o seu negócio?",
    ctaSub: "Conte-nos sobre o seu negócio, respondemos em breve.",
    ctaBtn: "Fale Connosco",
    seoDescription: "Descubra todas as funcionalidades do eChatbot: automação IA, suporte humano, marketing push, integração CRM, e-commerce, privacidade e segurança.",
    seoKeywords: "chatbot whatsapp, ai chatbot, automatização customer service, marketing push, integração crm, chatbot ecommerce, human in the loop, privacidade gdpr",
    breadcrumb: "Funcionalidades",
    hero: {
      badge: "Plataforma Completa",
      title: "Tudo o que precisa para<br/>automatizar o seu negócio",
      subtitle: "O eChatbot combina inteligência artificial, automação e intervenção humana para criar experiências de cliente excecionais no WhatsApp e widgets web.",
      cta: "Fale Connosco",
    },
    coreFeatures: {
      title: "Funcionalidades Principais",
      subtitle: "As capacidades que tornam o eChatbot a escolha ideal para o seu negócio",
      features: [
        { icon: "Bot", title: "Automação IA Avançada", description: "Chatbot inteligente baseado em GPT-4 que compreende linguagem natural, responde a perguntas complexas e aprende com as conversas.", points: ["Compreensão do contexto", "Respostas personalizadas", "Aprendizagem contínua"] },
        { icon: "Users", title: "Suporte Human-in-the-Loop", description: "Mude facilmente da IA para um operador humano quando necessário. O chatbot sabe quando pedir ajuda e transfere a conversa sem interrupções.", points: ["Handoff inteligente", "Dashboard operadores", "Continuidade da conversa"] },
        { icon: "MessageSquare", title: "Marketing Push Proativo", description: "Envie campanhas de marketing direcionadas no WhatsApp. Segmente o público, personalize mensagens e meça resultados em tempo real.", points: ["Segmentação avançada", "A/B testing", "Analytics detalhados"] },
        { icon: "ShoppingCart", title: "E-Commerce Integrado", description: "Venda produtos diretamente no WhatsApp. Catálogo de produtos, carrinho, pagamentos e rastreamento de pedidos tudo no chat.", points: ["Catálogo IA", "Pagamentos seguros", "Gestão de pedidos"] },
        { icon: "Globe", title: "Widget → WhatsApp", description: "Um único chatbot para site e WhatsApp. Os clientes começam no widget e continuam no WhatsApp sem repetir informações.", points: ["Sessão unificada", "Continuidade de dados", "Zero fricção"] },
        { icon: "Lock", title: "Privacidade & Segurança GDPR", description: "Conformidade total GDPR, criptografia ponta a ponta, políticas de retenção de dados personalizáveis e controlo total sobre os dados dos seus clientes.", points: ["Conforme GDPR", "Criptografia E2E", "Data ownership"] },
        { icon: "CalendarCheck", title: "Agendamento de Consultas", description: "Sistema de agendamento de consultas integrado com o chatbot. Os clientes podem agendar, modificar e cancelar consultas diretamente no chat.", points: ["Slots disponíveis em tempo real", "Lembretes automáticos WhatsApp", "Gestão de horários e bloqueios"] },
      ],
    },
    integration: {
      title: "Integrações Poderosas",
      subtitle: "Ligue o eChatbot às suas ferramentas de trabalho",
      description: "Integre facilmente o chatbot com CRMs (Salesforce, HubSpot), plataformas de e-commerce (WooCommerce, PrestaShop, Magento), sistemas ERP, software de armazém, ferramentas de marketing automation e muito mais.",
      imagePlaceholder: "Imagem de integração",
    },
  },
}

export function FeaturesPage() {
  const { language } = useLanguage()
  const t = translations[language]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const iconMap = {
    Bot: <Bot className="h-8 w-8" />,
    Users: <Users className="h-8 w-8" />,
    MessageSquare: <MessageSquare className="h-8 w-8" />,
    ShoppingCart: <ShoppingCart className="h-8 w-8" />,
    Globe: <Globe className="h-8 w-8" />,
    Lock: <Lock className="h-8 w-8" />,
    CalendarCheck: <CalendarCheck className="h-8 w-8" />,
  }

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={t.seoTitle}
        description={t.seoDescription}
        keywords={t.seoKeywords}
        url="/features"
        lang={language}
        serviceType="WhatsApp AI Chatbot Platform"
      />

      <SiteHeader />

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-emerald-50 via-white to-green-50 overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
          
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} hideVisual />

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-4xl mx-auto"
            >
              <span className="inline-block bg-green-100 text-green-700 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                {t.hero.badge}
              </span>
              
              <h1 
                className="text-4xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight"
                dangerouslySetInnerHTML={{ __html: t.hero.title }}
              />
              
              <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                {t.hero.subtitle}
              </p>

              <Link
                to="/contact"
                className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-10 py-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
              >
                <Zap className="h-6 w-6" />
                <span>{t.hero.cta}</span>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Core Features Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                {t.coreFeatures.title}
              </h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                {t.coreFeatures.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {t.coreFeatures.features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group relative"
                >
                  {/* Decorative background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl rotate-1 scale-100 group-hover:rotate-2 group-hover:scale-105 transition-transform duration-500 opacity-50" />
                  
                  {/* Card content */}
                  <div className="relative bg-white rounded-3xl p-8 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-500 h-full flex flex-col">
                    <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg">
                      {iconMap[feature.icon as keyof typeof iconMap]}
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 mb-4">
                      {feature.title}
                    </h3>

                    <p className="text-slate-600 leading-relaxed mb-6 flex-1">
                      {feature.description}
                    </p>

                    <ul className="space-y-2">
                      {feature.points.map((point, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                          <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Integration Section */}
        <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              className="group relative"
              initial={{ opacity: 0, x: 80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            >
              {/* Decorative background frame */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-3xl rotate-0 sm:rotate-1 scale-100 sm:scale-[1.01] shadow-lg group-hover:rotate-2 transition-transform duration-500" />

              <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:shadow-3xl hover:-translate-y-1 transition-all duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  {/* Left: Content */}
                  <div className="space-y-6">
                    <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                      {t.integration.title}
                    </h2>
                    <p className="text-xl text-slate-600 leading-relaxed">
                      {t.integration.subtitle}
                    </p>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      {t.integration.description}
                    </p>
                    <Link
                      to="/crm-integration"
                      className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold text-lg group"
                    >
                      Scopri le integrazioni
                      <TrendingUp className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>

                  {/* Right: Image placeholder */}
                  <div className="relative">
                    <div className="relative">
                      <div className="absolute -inset-4 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl blur-xl opacity-40" />
                      <img src="/survey-ecommerce.png" alt="Integration Dashboard" className="relative w-full h-auto rounded-2xl shadow-2xl border border-white/60 object-contain" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-green-600 to-emerald-700">
          <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                {t.ctaTitle}
              </h2>
              <p className="text-xl text-green-100 mb-10">
                {t.ctaSub}
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 text-green-600 font-semibold px-10 py-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
              >
                <Zap className="h-6 w-6" />
                <span>{t.ctaBtn}</span>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
