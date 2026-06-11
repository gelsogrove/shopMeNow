import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap, CheckCircle, ArrowRight } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"

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
    apiDesc: "La nostra REST API documentata ti permette di connettere qualsiasi sistema interno, anche proprietario. Supporto webhook WhatsApp e documentazione Swagger/OpenAPI completa per un'integrazione semplice e veloce.",
    apiFeatures: [
      "REST API con autenticazione JWT Bearer token",
      "Integrazione webhook WhatsApp in tempo reale",
      "API multi-tenant con isolamento workspace",
      "Documentazione Swagger/OpenAPI completa",
      "Compatibile con qualsiasi sistema REST esterno",
      "Accesso sicuro via API key per workspace",
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
    apiDesc: "Our documented REST API lets you connect any internal or proprietary system. Full WhatsApp webhook support and complete Swagger/OpenAPI documentation for simple, fast integration.",
    apiFeatures: [
      "REST API with JWT Bearer token authentication",
      "Real-time WhatsApp webhook integration",
      "Multi-tenant API with workspace isolation",
      "Complete Swagger/OpenAPI documentation",
      "Compatible with any REST-compliant external system",
      "Secure API key access per workspace",
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
    apiDesc: "Nuestra REST API documentada te permite conectar cualquier sistema interno, incluso propietario. Soporte completo de webhooks WhatsApp y documentación Swagger/OpenAPI para una integración sencilla y rápida.",
    apiFeatures: [
      "REST API con autenticación JWT Bearer token",
      "Integración webhook WhatsApp en tiempo real",
      "API multi-tenant con aislamiento de workspace",
      "Documentación Swagger/OpenAPI completa",
      "Compatible con cualquier sistema REST externo",
      "Acceso seguro via API key por workspace",
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
    apiDesc: "Nossa REST API documentada permite conectar qualquer sistema interno ou proprietário. Suporte completo a webhooks WhatsApp e documentação Swagger/OpenAPI para integração simples e rápida.",
    apiFeatures: [
      "REST API com autenticação JWT Bearer token",
      "Integração webhook WhatsApp em tempo real",
      "API multi-tenant com isolamento de workspace",
      "Documentação Swagger/OpenAPI completa",
      "Compatível com qualquer sistema REST externo",
      "Acesso seguro via API key por workspace",
    ],
  },
}

export function CrmIntegrationPage() {
  const { language } = useLanguage()
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-200">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/crm-integration" lang={language} serviceType="CRM Integration" />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="pt-24 pb-16 lg:pt-32 lg:pb-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              <div>
                <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight whitespace-pre-line">
                  {t.heroTitle}
                </h1>
                <p className="text-xl text-slate-400 mb-10 leading-relaxed">{t.heroSub}</p>
                <Link to="/contact" className="inline-flex items-center gap-3 bg-[#25D366] hover:bg-[#1fb355] text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg">
                  <Zap className="h-5 w-5" />
                  {t.cta}
                </Link>
              </div>
              {/* Hero image */}
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl blur-xl opacity-40" />
                <img src="/CRM.png" alt="CRM Integration" className="relative w-full h-auto rounded-3xl shadow-2xl border border-white/10 object-contain" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-white text-center mb-12">{t.benefitsTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {t.benefits.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex gap-6 p-6 bg-slate-900/50 backdrop-blur rounded-2xl shadow-2xl border border-white/10 hover:shadow-lg transition-all"
                >
                  <div className="text-4xl flex-shrink-0">{b.icon}</div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{b.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{b.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* API Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              className="group relative"
              initial={{ opacity: 0, x: 80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl sm:rotate-1 scale-[1.01] group-hover:rotate-2 transition-transform duration-500" />
              <div className="relative bg-slate-900/50 backdrop-blur rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-white/10 hover:-translate-y-1 transition-all duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  <div className="space-y-6">
                    <h2 className="text-3xl lg:text-4xl font-bold text-white">{t.apiTitle}</h2>
                    <p className="text-lg text-slate-400 leading-relaxed">{t.apiDesc}</p>
                    <ul className="space-y-3">
                      {t.apiFeatures.map((f, i) => (
                        <li key={i} className="flex items-center gap-3 text-slate-300">
                          <CheckCircle className="h-5 w-5 text-[#25D366] flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl blur-xl opacity-40" />
                    <img src="/survery-crm.png" alt="API Documentation" className="relative w-full h-auto rounded-2xl shadow-xl border border-white/10 object-contain" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-green-600 to-emerald-700">
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
