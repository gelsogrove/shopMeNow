import { Link } from "react-router-dom"

interface SiteFooterProps {
  language?: "it" | "en" | "es" | "pt"
}

const translations = {
  it: {
    tagline: "Piattaforma AI per chatbot WhatsApp. Automatizza vendite, supporto e marketing con conversazioni intelligenti.",
    product: "Prodotto",
    features: "Funzionalità",
    pricing: "Prezzi",
    widgetToWhatsApp: "Widget → WhatsApp",
    humanSupport: "Supporto Umano",
    resources: "Risorse",
    teamCollaboration: "Collaborazione Team",
    privacyDesign: "Privacy by Design",
    crmIntegration: "Integrazione CRM",
    company: "Azienda",
    about: "Chi Siamo",
    contact: "Contatti",
    legal: "Legale",
    privacy: "Privacy Policy",
    terms: "Termini di Servizio",
    refund: "Politica di Rimborso",
    allRightsReserved: "Tutti i diritti riservati.",
    madeWith: "Fatto con",
    in: "in Italia",
  },
  en: {
    tagline: "AI-powered WhatsApp chatbot platform for businesses. Automate customer support, sales, and marketing with intelligent conversations.",
    product: "Product",
    features: "Features",
    pricing: "Pricing",
    widgetToWhatsApp: "Widget → WhatsApp",
    humanSupport: "Human Support",
    resources: "Resources",
    teamCollaboration: "Team Collaboration",
    privacyDesign: "Privacy by Design",
    crmIntegration: "CRM Integration",
    company: "Company",
    about: "About Us",
    contact: "Contact",
    legal: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    refund: "Refund Policy",
    allRightsReserved: "All rights reserved.",
    madeWith: "Made with",
    in: "in Italy",
  },
  es: {
    tagline: "Plataforma de chatbot WhatsApp con IA para empresas. Automatiza soporte, ventas y marketing con conversaciones inteligentes.",
    product: "Producto",
    features: "Funcionalidades",
    pricing: "Precios",
    widgetToWhatsApp: "Widget → WhatsApp",
    humanSupport: "Soporte Humano",
    resources: "Recursos",
    teamCollaboration: "Colaboración en Equipo",
    privacyDesign: "Privacy by Design",
    crmIntegration: "Integración CRM",
    company: "Empresa",
    about: "Sobre Nosotros",
    contact: "Contacto",
    legal: "Legal",
    privacy: "Política de Privacidad",
    terms: "Términos de Servicio",
    refund: "Política de Reembolso",
    allRightsReserved: "Todos los derechos reservados.",
    madeWith: "Hecho con",
    in: "en Italia",
  },
  pt: {
    tagline: "Plataforma de chatbot WhatsApp com IA para empresas. Automatize suporte, vendas e marketing com conversas inteligentes.",
    product: "Produto",
    features: "Funcionalidades",
    pricing: "Preços",
    widgetToWhatsApp: "Widget → WhatsApp",
    humanSupport: "Suporte Humano",
    resources: "Recursos",
    teamCollaboration: "Colaboração em Equipe",
    privacyDesign: "Privacy by Design",
    crmIntegration: "Integração CRM",
    company: "Empresa",
    about: "Sobre Nós",
    contact: "Contato",
    legal: "Legal",
    privacy: "Política de Privacidade",
    terms: "Termos de Serviço",
    refund: "Política de Reembolso",
    allRightsReserved: "Todos os direitos reservados.",
    madeWith: "Feito com",
    in: "na Itália",
  },
}

export function SiteFooter({ language = "en" }: SiteFooterProps) {
  const t = translations[language]
  const currentYear = new Date().getFullYear()
  const madeIn = t.in.replace(/!/g, "")

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Logo + Description */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="eChatbot Logo" className="w-10 h-10 object-contain" />
              <span className="text-xl font-bold text-white">eChatbot</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              {t.tagline}
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t.product}</h3>
            <ul className="space-y-3">
              <li><Link to="/features" className="text-sm hover:text-green-500 transition-colors">{t.features}</Link></li>
              <li><Link to="/pricing" className="text-sm hover:text-green-500 transition-colors">{t.pricing}</Link></li>
              <li><Link to="/widget-to-whatsapp" className="text-sm hover:text-green-500 transition-colors">{t.widgetToWhatsApp}</Link></li>
              <li><Link to="/human-support" className="text-sm hover:text-green-500 transition-colors">{t.humanSupport}</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t.resources}</h3>
            <ul className="space-y-3">
              <li><Link to="/crm-integration" className="text-sm hover:text-green-500 transition-colors">{t.crmIntegration}</Link></li>
              <li><Link to="/team-collaboration" className="text-sm hover:text-green-500 transition-colors">{t.teamCollaboration}</Link></li>
              <li><Link to="/privacy-by-design" className="text-sm hover:text-green-500 transition-colors">{t.privacyDesign}</Link></li>
            </ul>
          </div>

          {/* Company + Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t.company}</h3>
            <ul className="space-y-3 mb-6">
              <li><Link to="/contact" className="text-sm hover:text-green-500 transition-colors">{t.contact}</Link></li>
            </ul>
            <h3 className="text-white font-semibold mb-4">{t.legal}</h3>
            <ul className="space-y-3">
              <li><Link to="/privacy" className="text-sm hover:text-green-500 transition-colors">{t.privacy}</Link></li>
              <li><Link to="/terms" className="text-sm hover:text-green-500 transition-colors">{t.terms}</Link></li>
              <li><Link to="/refund" className="text-sm hover:text-green-500 transition-colors">{t.refund}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            © {currentYear} eChatbot. {t.allRightsReserved}
          </p>
          <p className="text-sm text-slate-400 flex items-center gap-1">
            {t.madeWith} <span className="text-red-500">❤️</span> {madeIn}
          </p>
        </div>
      </div>
    </footer>
  )
}
