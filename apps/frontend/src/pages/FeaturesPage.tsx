import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { 
  Bot, 
  MessageSquare, 
  Users, 
  ShoppingCart, 
  BarChart3, 
  Lock, 
  Zap,
  Globe,
  Smartphone,
  Brain,
  Clock,
  TrendingUp,
} from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"

type Language = "it" | "en" | "es" | "pt"

const translations = {
  it: {
    seoTitle: "Funzionalità - Piattaforma AI Chatbot WhatsApp",
    seoDescription: "Scopri tutte le funzionalità di eChatbot: automazione AI, supporto umano, marketing push, integrazione CRM, e-commerce, privacy e sicurezza. La piattaforma completa per chatbot WhatsApp.",
    seoKeywords: "chatbot whatsapp, ai chatbot, automazione customer service, marketing push, crm integration, ecommerce chatbot, human in the loop, privacy gdpr",
    breadcrumb: "Funzionalità",
    hero: {
      badge: "Piattaforma Completa",
      title: "Tutto ciò di cui hai bisogno per<br/>automatizzare il tuo business",
      subtitle: "eChatbot combina intelligenza artificiale, automazione e intervento umano per creare esperienze clienti eccezionali su WhatsApp e widget web.",
      cta: "Prova Gratis per 15 Giorni",
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
      ],
    },
    integration: {
      title: "Integrazioni Potenti",
      subtitle: "Connetti eChatbot con i tuoi strumenti di lavoro",
      description: "Integra facilmente il chatbot con CRM (Salesforce, HubSpot), piattaforme e-commerce (WooCommerce, PrestaShop, Magento), sistemi ERP, software di magazzino, strumenti di marketing automation e molto altro.",
      imagePlaceholder: "Placeholder immagine integr",
    },
  },
  // ... (altre lingue verranno aggiunte dopo, per ora solo IT per brevità)
}

export function FeaturesPage() {
  const [language, setLanguage] = useState<Language>("it")
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
  }

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={t.seoTitle}
        description={t.seoDescription}
        keywords={t.seoKeywords}
        url="/features"
        lang={language}
      />

      <SiteHeader language={language} />

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-emerald-50 via-white to-green-50 overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
          
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} />

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
                to="/"
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
                    <div className="aspect-square bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-dashed border-blue-200 flex items-center justify-center">
                      <div className="text-center p-8">
                        <BarChart3 className="h-24 w-24 text-blue-300 mx-auto mb-4" />
                        <p className="text-sm text-slate-500 font-medium">
                          Integration Dashboard Image
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          1000x1000px PNG/SVG
                        </p>
                      </div>
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
                Pronto a trasformare il tuo business?
              </h2>
              <p className="text-xl text-green-100 mb-10">
                Inizia gratuitamente oggi. Nessuna carta di credito richiesta.
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 text-green-600 font-semibold px-10 py-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
              >
                <Zap className="h-6 w-6" />
                <span>Inizia Gratis</span>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
