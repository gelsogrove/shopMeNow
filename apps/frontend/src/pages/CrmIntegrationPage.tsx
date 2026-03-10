import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Database, Zap, CheckCircle, ArrowRight, Link2, BarChart3 } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Integrazione CRM ERP - Connetti eChatbot con i tuoi Sistemi",
    ctaTitle: "Pronto a connettere i tuoi sistemi?",
    ctaSub: "Richiedi una demo personalizzata con il nostro team tecnico.",
    seoDesc: "Integra eChatbot con Salesforce, HubSpot, Microsoft Dynamics, sistemi ERP, warehouse management e piattaforme di marketing automation. Sincronizzazione dati in tempo reale.",
    seoKeys: "integrazione crm chatbot, salesforce whatsapp, hubspot chatbot, erp chatbot, woocommerce chatbot, prestashop chatbot, magento chatbot, zapier integration",
    breadcrumb: "Integrazione CRM",
    badge: "Integrazioni",
    heroTitle: "Connetti eChatbot\ncon il tuo stack tecnologico",
    heroSub: "eChatbot si integra con i tuoi sistemi esistenti. CRM, ERP, e-commerce, marketing automation, software di magazzino. I dati fluiscono automaticamente, eliminando la duplicazione manuale.",
    cta: "Richiedi Demo",
    howTitle: "Integrazioni disponibili",
    howSub: "Connessioni native e API aperta per qualsiasi sistema",
    integrations: [
      { category: "CRM", icon: "👥", items: ["Salesforce", "HubSpot", "Microsoft Dynamics", "Pipedrive", "Zoho CRM"] },
      { category: "E-Commerce", icon: "🛒", items: ["WooCommerce", "PrestaShop", "Magento", "Shopify", "OpenCart"] },
      { category: "ERP & Gestionale", icon: "⚙️", items: ["SAP", "Oracle", "Microsoft Dynamics 365", "Odoo", "Gestionale personalizzato"] },
      { category: "Marketing", icon: "📣", items: ["Mailchimp", "ActiveCampaign", "Klaviyo", "Brevo", "GetResponse"] },
      { category: "Pagamenti", icon: "💳", items: ["Stripe", "PayPal", "Square", "Braintree", "Adyen"] },
      { category: "Warehouse & Logistica", icon: "📦", items: ["custom WMS", "GLS", "DHL", "BRT", "API corriere custom"] },
    ],
    benefitsTitle: "Perché integrare eChatbot con il tuo CRM",
    benefits: [
      { icon: "🔄", title: "Sincronizzazione bidirezionale", desc: "I dati del cliente su WhatsApp si sincronizzano automaticamente nel CRM. Ogni contatto, ogni conversazione, ogni acquisto aggiornato in tempo reale." },
      { icon: "👤", title: "Customer 360°", desc: "Il chatbot conosce la storia completa di ogni cliente: acquisti passati, ticket aperti, preferenze e comunicazioni. Risponde con il contesto giusto." },
      { icon: "🤖", title: "Automazione workflow", desc: "Crea ordini, aggiorna lead score, trigger campagne email, notifica il team di vendita — tutto automaticamente dalle conversazioni WhatsApp." },
      { icon: "📊", title: "Analytics unificati", desc: "Un'unica dashboard con dati da chatbot, CRM ed e-commerce. Vedi il ROI reale di ogni conversazione." },
    ],
    apiTitle: "API Aperta per Integrazioni Custom",
    apiDesc: "La nostra REST API documentata ti permette di connettere qualsiasi sistema interno, anche proprietario. Supporto a webhook, event streaming e batch sync per massima flessibilità.",
    apiFeatures: [
      "REST API con autenticazione OAuth 2.0",
      "Webhook per eventi in tempo reale",
      "SDK disponibili per Node.js, Python, PHP",
      "Documentazione Swagger completa",
      "Ambiente sandbox per test",
      "SLA 99.9% uptime garantito",
    ],
  },
  en: {
    seoTitle: "CRM ERP Integration - Connect eChatbot with Your Systems",
    ctaTitle: "Ready to connect your systems?",
    ctaSub: "Request a personalized demo with our technical team.",
    seoDesc: "Integrate eChatbot with Salesforce, HubSpot, Microsoft Dynamics, ERP systems, warehouse management and marketing automation platforms. Real-time data synchronization.",
    seoKeys: "crm chatbot integration, salesforce whatsapp, hubspot chatbot, erp chatbot, woocommerce chatbot, prestashop chatbot, magento chatbot, zapier integration",
    breadcrumb: "CRM Integration",
    badge: "Integrations",
    heroTitle: "Connect eChatbot\nwith your tech stack",
    heroSub: "eChatbot integrates with your existing systems. CRM, ERP, e-commerce, marketing automation, warehouse software. Data flows automatically, eliminating manual duplication.",
    cta: "Request Demo",
    howTitle: "Available Integrations",
    howSub: "Native connections and open API for any system",
    integrations: [
      { category: "CRM", icon: "👥", items: ["Salesforce", "HubSpot", "Microsoft Dynamics", "Pipedrive", "Zoho CRM"] },
      { category: "E-Commerce", icon: "🛒", items: ["WooCommerce", "PrestaShop", "Magento", "Shopify", "OpenCart"] },
      { category: "ERP & Management", icon: "⚙️", items: ["SAP", "Oracle", "Microsoft Dynamics 365", "Odoo", "Custom ERP"] },
      { category: "Marketing", icon: "📣", items: ["Mailchimp", "ActiveCampaign", "Klaviyo", "Brevo", "GetResponse"] },
      { category: "Payments", icon: "💳", items: ["Stripe", "PayPal", "Square", "Braintree", "Adyen"] },
      { category: "Warehouse & Logistics", icon: "📦", items: ["Custom WMS", "DHL", "FedEx", "UPS", "Custom courier API"] },
    ],
    benefitsTitle: "Why integrate eChatbot with your CRM",
    benefits: [
      { icon: "🔄", title: "Bidirectional sync", desc: "Customer data on WhatsApp automatically syncs to CRM. Every contact, conversation, and purchase updated in real time." },
      { icon: "👤", title: "Customer 360°", desc: "The chatbot knows each customer's complete history: past purchases, open tickets, preferences and communications. Responds with the right context." },
      { icon: "🤖", title: "Workflow automation", desc: "Create orders, update lead scores, trigger email campaigns, notify the sales team — all automatically from WhatsApp conversations." },
      { icon: "📊", title: "Unified analytics", desc: "A single dashboard with data from chatbot, CRM and e-commerce. See the real ROI of each conversation." },
    ],
    apiTitle: "Open API for Custom Integrations",
    apiDesc: "Our documented REST API lets you connect any internal system, even proprietary ones. Support for webhooks, event streaming and batch sync for maximum flexibility.",
    apiFeatures: [
      "REST API with OAuth 2.0 authentication",
      "Webhooks for real-time events",
      "SDKs available for Node.js, Python, PHP",
      "Complete Swagger documentation",
      "Sandbox environment for testing",
      "99.9% uptime SLA guaranteed",
    ],
  },
  es: {
    seoTitle: "Integración CRM ERP - Conecta eChatbot con tus Sistemas",
    ctaTitle: "¿Listo para conectar tus sistemas?",
    ctaSub: "Solicita una demo personalizada con nuestro equipo técnico.",
    seoDesc: "Integra eChatbot con Salesforce, HubSpot, Microsoft Dynamics, sistemas ERP, gestión de almacenes y plataformas de marketing automation. Sincronización de datos en tiempo real.",
    seoKeys: "integración crm chatbot, salesforce whatsapp, hubspot chatbot, erp chatbot, woocommerce chatbot, prestashop chatbot, magento chatbot, zapier integration",
    breadcrumb: "Integración CRM",
    badge: "Integraciones",
    heroTitle: "Conecta eChatbot\ncon tu stack tecnológico",
    heroSub: "eChatbot se integra con tus sistemas existentes. CRM, ERP, e-commerce, marketing automation, software de almacén. Los datos fluyen automáticamente, eliminando la duplicación manual.",
    cta: "Solicitar Demo",
    howTitle: "Integraciones disponibles",
    howSub: "Conexiones nativas y API abierta para cualquier sistema",
    integrations: [
      { category: "CRM", icon: "👥", items: ["Salesforce", "HubSpot", "Microsoft Dynamics", "Pipedrive", "Zoho CRM"] },
      { category: "E-Commerce", icon: "🛒", items: ["WooCommerce", "PrestaShop", "Magento", "Shopify", "OpenCart"] },
      { category: "ERP & Gestión", icon: "⚙️", items: ["SAP", "Oracle", "Microsoft Dynamics 365", "Odoo", "ERP personalizado"] },
      { category: "Marketing", icon: "📣", items: ["Mailchimp", "ActiveCampaign", "Klaviyo", "Brevo", "GetResponse"] },
      { category: "Pagos", icon: "💳", items: ["Stripe", "PayPal", "Square", "Braintree", "Adyen"] },
      { category: "Almacén & Logística", icon: "📦", items: ["WMS personalizado", "DHL", "FedEx", "UPS", "API courier custom"] },
    ],
    benefitsTitle: "Por qué integrar eChatbot con tu CRM",
    benefits: [
      { icon: "🔄", title: "Sincronización bidireccional", desc: "Los datos del cliente en WhatsApp se sincronizan automáticamente en el CRM. Cada contacto, conversación y compra actualizada en tiempo real." },
      { icon: "👤", title: "Customer 360°", desc: "El chatbot conoce el historial completo de cada cliente: compras pasadas, tickets abiertos, preferencias y comunicaciones. Responde con el contexto correcto." },
      { icon: "🤖", title: "Automatización de workflows", desc: "Crea pedidos, actualiza lead scores, activa campañas email, notifica al equipo de ventas — todo automáticamente desde conversaciones WhatsApp." },
      { icon: "📊", title: "Analíticas unificadas", desc: "Un único panel con datos de chatbot, CRM y e-commerce. Ve el ROI real de cada conversación." },
    ],
    apiTitle: "API Abierta para Integraciones Custom",
    apiDesc: "Nuestra REST API documentada te permite conectar cualquier sistema interno, incluso propietario. Soporte para webhooks, event streaming y batch sync para máxima flexibilidad.",
    apiFeatures: [
      "REST API con autenticación OAuth 2.0",
      "Webhooks para eventos en tiempo real",
      "SDKs disponibles para Node.js, Python, PHP",
      "Documentación Swagger completa",
      "Entorno sandbox para pruebas",
      "SLA 99.9% uptime garantizado",
    ],
  },
  pt: {
    seoTitle: "Integração CRM ERP - Conecte o eChatbot com seus Sistemas",
    ctaTitle: "Pronto para conectar os seus sistemas?",
    ctaSub: "Solicite uma demo personalizada com a nossa equipe técnica.",
    seoDesc: "Integre o eChatbot com Salesforce, HubSpot, Microsoft Dynamics, sistemas ERP, gerenciamento de armazém e plataformas de marketing automation. Sincronização de dados em tempo real.",
    seoKeys: "integração crm chatbot, salesforce whatsapp, hubspot chatbot, erp chatbot, woocommerce chatbot, prestashop chatbot, magento chatbot, zapier integration",
    breadcrumb: "Integração CRM",
    badge: "Integrações",
    heroTitle: "Conecte o eChatbot\nao seu stack tecnológico",
    heroSub: "O eChatbot integra-se com seus sistemas existentes. CRM, ERP, e-commerce, automação de marketing, software de armazém. Os dados fluem automaticamente, eliminando duplicação manual.",
    cta: "Solicitar Demo",
    howTitle: "Integrações disponíveis",
    howSub: "Conexões nativas e API aberta para qualquer sistema",
    integrations: [
      { category: "CRM", icon: "👥", items: ["Salesforce", "HubSpot", "Microsoft Dynamics", "Pipedrive", "Zoho CRM"] },
      { category: "E-Commerce", icon: "🛒", items: ["WooCommerce", "PrestaShop", "Magento", "Shopify", "OpenCart"] },
      { category: "ERP & Gestão", icon: "⚙️", items: ["SAP", "Oracle", "Microsoft Dynamics 365", "Odoo", "ERP personalizado"] },
      { category: "Marketing", icon: "📣", items: ["Mailchimp", "ActiveCampaign", "Klaviyo", "Brevo", "GetResponse"] },
      { category: "Pagamentos", icon: "💳", items: ["Stripe", "PayPal", "Square", "Braintree", "Adyen"] },
      { category: "Armazém & Logística", icon: "📦", items: ["WMS personalizado", "DHL", "FedEx", "Correios", "API courier custom"] },
    ],
    benefitsTitle: "Por que integrar o eChatbot com seu CRM",
    benefits: [
      { icon: "🔄", title: "Sincronização bidirecional", desc: "Os dados do cliente no WhatsApp se sincronizam automaticamente no CRM. Cada contato, conversa e compra atualizada em tempo real." },
      { icon: "👤", title: "Customer 360°", desc: "O chatbot conhece o histórico completo de cada cliente: compras passadas, tickets abertos, preferências e comunicações. Responde com o contexto certo." },
      { icon: "🤖", title: "Automação de workflows", desc: "Crie pedidos, atualize lead scores, acione campanhas de email, notifique a equipe de vendas — tudo automaticamente a partir das conversas do WhatsApp." },
      { icon: "📊", title: "Analytics unificados", desc: "Um único dashboard com dados de chatbot, CRM e e-commerce. Veja o ROI real de cada conversa." },
    ],
    apiTitle: "API Aberta para Integrações Personalizadas",
    apiDesc: "Nossa REST API documentada permite conectar qualquer sistema interno, até proprietários. Suporte a webhooks, event streaming e batch sync para máxima flexibilidade.",
    apiFeatures: [
      "REST API com autenticação OAuth 2.0",
      "Webhooks para eventos em tempo real",
      "SDKs disponíveis para Node.js, Python, PHP",
      "Documentação Swagger completa",
      "Ambiente sandbox para testes",
      "SLA 99.9% uptime garantido",
    ],
  },
}

export function CrmIntegrationPage() {
  const [language, setLanguage] = useState<Language>("it")
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
    const browserLang = navigator.language.slice(0, 2)
    if (["it", "en", "es", "pt"].includes(browserLang)) setLanguage(browserLang as Language)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/crm-integration" lang={language} />
      <SiteHeader language={language} onLanguageChange={setLanguage} />

      <main>
        {/* Hero */}
        <section className="pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} hideVisual />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              <div>
                <span className="inline-block bg-blue-100 text-blue-700 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                  {t.badge}
                </span>
                <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight whitespace-pre-line">
                  {t.heroTitle}
                </h1>
                <p className="text-xl text-slate-600 mb-10 leading-relaxed">{t.heroSub}</p>
                <Link to="/" className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg">
                  <Zap className="h-5 w-5" />
                  {t.cta}
                </Link>
              </div>
              {/* Hero image placeholder */}
              <div className="aspect-square bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl border-2 border-dashed border-blue-200 flex items-center justify-center shadow-xl">
                <div className="text-center p-8">
                  <Database className="h-24 w-24 text-blue-300 mx-auto mb-4" />
                  <p className="text-sm text-slate-500 font-medium">CRM Integration Diagram</p>
                  <p className="text-xs text-slate-400 mt-1">1000x1000px PNG</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Integrations Grid */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-slate-900 mb-4">{t.howTitle}</h2>
              <p className="text-xl text-slate-600">{t.howSub}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {t.integrations.map((int, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white rounded-2xl p-6 shadow-lg border border-blue-50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{int.icon}</span>
                    <h3 className="text-xl font-bold text-slate-900">{int.category}</h3>
                  </div>
                  <ul className="space-y-2">
                    {int.items.map((item, j) => (
                      <li key={j} className="flex items-center gap-2 text-slate-600 text-sm">
                        <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-slate-900 text-center mb-12">{t.benefitsTitle}</h2>
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

        {/* API Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              className="group relative"
              initial={{ opacity: 0, x: 80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-3xl sm:rotate-1 scale-[1.01] group-hover:rotate-2 transition-transform duration-500" />
              <div className="relative bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-slate-100 hover:-translate-y-1 transition-all duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  <div className="space-y-6">
                    <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">{t.apiTitle}</h2>
                    <p className="text-lg text-slate-600 leading-relaxed">{t.apiDesc}</p>
                    <ul className="space-y-3">
                      {t.apiFeatures.map((f, i) => (
                        <li key={i} className="flex items-center gap-3 text-slate-700">
                          <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="aspect-video bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-dashed border-blue-200 flex items-center justify-center">
                    <div className="text-center p-8">
                      <Link2 className="h-16 w-16 text-blue-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500 font-medium">API Documentation Screenshot</p>
                      <p className="text-xs text-slate-400 mt-1">1200x675px PNG</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-blue-600 to-cyan-700">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">{t.ctaTitle}</h2>
            <p className="text-xl text-blue-100 mb-8">{t.ctaSub}</p>
            <Link to="/" className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 text-blue-600 font-semibold px-10 py-5 rounded-2xl shadow-lg text-lg transition-all">
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
