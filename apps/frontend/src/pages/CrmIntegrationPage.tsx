import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { LandingHero } from "@/components/landing/LandingHero"
import { UseCaseGrid } from "@/components/landing/UseCaseGrid"
import { FeatureChecklist } from "@/components/landing/FeatureChecklist"
import { CtaSection } from "@/components/landing/CtaSection"

type Language = "it" | "en" | "es" | "de"

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
  de: {
    seoTitle: "CRM-ERP-Integration - Verbinde eChatbot mit deinen Systemen",
    ctaTitle: "Bereit, deine Systeme zu verbinden?",
    ctaSub: "Fordere eine persönliche Demo mit unserem Technikteam an.",
    seoDesc: "Integriere eChatbot mit Salesforce, HubSpot, Microsoft Dynamics, ERP-Systemen, Lagerverwaltung und Marketing-Automation-Plattformen. Datensynchronisation in Echtzeit.",
    seoKeys: "crm chatbot integration, salesforce whatsapp, hubspot chatbot, erp chatbot, woocommerce chatbot, prestashop chatbot, magento chatbot, zapier integration",
    breadcrumb: "CRM-Integration",
    badge: "Integrationen",
    heroTitle: "Verbinde eChatbot\nmit deinem Tech-Stack",
    heroSub: "eChatbot integriert sich in deine bestehenden Systeme. CRM, ERP, E-Commerce, Marketing-Automation, Lagersoftware. Daten fließen automatisch und vermeiden manuelle Doppelerfassung.",
    cta: "Demo anfordern",
    howTitle: "Verfügbare Integrationen",
    howSub: "Native Verbindungen und offene API für jedes System",
    integrations: [
      { category: "CRM", icon: "👥", items: ["Salesforce", "HubSpot", "Microsoft Dynamics", "Pipedrive", "Zoho CRM"] },
      { category: "E-Commerce", icon: "🛒", items: ["WooCommerce", "PrestaShop", "Magento", "Shopify", "OpenCart"] },
      { category: "ERP & Warenwirtschaft", icon: "⚙️", items: ["SAP", "Oracle", "Microsoft Dynamics 365", "Odoo", "Individuelles ERP"] },
      { category: "Marketing", icon: "📣", items: ["Mailchimp", "ActiveCampaign", "Klaviyo", "Brevo", "GetResponse"] },
      { category: "Zahlungen", icon: "💳", items: ["Stripe", "PayPal", "Square", "Braintree", "Adyen"] },
      { category: "Lager & Logistik", icon: "📦", items: ["Individuelles WMS", "DHL", "FedEx", "UPS", "Individuelle Kurier-API"] },
    ],
    benefitsTitle: "Warum du eChatbot mit deinem CRM integrieren solltest",
    benefits: [
      { icon: "🔄", title: "Bidirektionale Synchronisation", desc: "Kundendaten aus WhatsApp synchronisieren sich automatisch ins CRM. Jeder Kontakt, jedes Gespräch und jeder Kauf wird in Echtzeit aktualisiert." },
      { icon: "👤", title: "Customer 360°", desc: "Der Chatbot kennt die komplette Historie jedes Kunden: vergangene Käufe, offene Tickets, Vorlieben und Kommunikation. Er antwortet mit dem richtigen Kontext." },
      { icon: "🤖", title: "Workflow-Automatisierung", desc: "Erstelle Bestellungen, aktualisiere Lead-Scores, löse E-Mail-Kampagnen aus, benachrichtige das Vertriebsteam — alles automatisch aus WhatsApp-Gesprächen." },
      { icon: "📊", title: "Einheitliche Analytics", desc: "Ein einziges Dashboard mit Daten aus Chatbot, CRM und E-Commerce. Sieh den echten ROI jedes Gesprächs." },
    ],
    apiTitle: "Offene API für individuelle Integrationen",
    apiDesc: "Unsere dokumentierte REST-API lässt dich jedes interne oder proprietäre System anbinden. Vollständiger WhatsApp-Webhook-Support und komplette Swagger/OpenAPI-Dokumentation für eine einfache und schnelle Integration.",
    apiFeatures: [
      "REST-API mit JWT-Bearer-Token-Authentifizierung",
      "WhatsApp-Webhook-Integration in Echtzeit",
      "Mandantenfähige API mit Workspace-Isolation",
      "Komplette Swagger/OpenAPI-Dokumentation",
      "Kompatibel mit jedem externen REST-System",
      "Sicherer API-Key-Zugriff pro Workspace",
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
        <LandingHero
          title={t.heroTitle}
          subtitle={t.heroSub}
          ctaLabel={t.cta}
          image={{ src: "/CRM.png", alt: "CRM Integration" }}
          imageSide="right"
          buttonClassName="bg-[#25D366] hover:bg-[#1fb355]"
        />

        {/* Benefits */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-white text-center mb-12">{t.benefitsTitle}</h2>
            <UseCaseGrid items={t.benefits} />
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
                    <FeatureChecklist items={t.apiFeatures} />
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

        <CtaSection title={t.ctaTitle} subtitle={t.ctaSub} ctaLabel={t.cta} />
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
