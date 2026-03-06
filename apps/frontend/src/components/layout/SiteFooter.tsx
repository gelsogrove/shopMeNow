import { Link } from "react-router-dom"
import { Facebook, Twitter, Linkedin, Instagram, Mail } from "lucide-react"

interface SiteFooterProps {
  language?: "it" | "en" | "es" | "pt"
}

const translations = {
  it: {
    product: "Prodotto",
    features: "Funzionalità",
    pricing: "Prezzi",
    widgetToWhatsApp: "Widget → WhatsApp",
    humanSupport: "Supporto Umano",
    crmIntegration: "Integrazione CRM",
    resources: "Risorse",
    teamCollaboration: "Collaborazione Team",
    privacyDesign: "Privacy by Design",
    documentation: "Documentazione",
    company: "Azienda",
    about: "Chi Siamo",
    contact: "Contatti",
    blog: "Blog",
    legal: "Legale",
    privacy: "Privacy Policy",
    terms: "Termini di Servizio",
    refund: "Politica di Rimborso",
    followUs: "Seguici",
    allRightsReserved: "Tutti i diritti riservati.",
    madeWith: "Fatto con",
    in: "in Italia",
  },
  en: {
    product: "Product",
    features: "Features",
    pricing: "Pricing",
    widgetToWhatsApp: "Widget → WhatsApp",
    humanSupport: "Human Support",
    crmIntegration: "CRM Integration",
    resources: "Resources",
    teamCollaboration: "Team Collaboration",
    privacyDesign: "Privacy by Design",
    documentation: "Documentation",
    company: "Company",
    about: "About Us",
    contact: "Contact",
    blog: "Blog",
    legal: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    refund: "Refund Policy",
    followUs: "Follow Us",
    allRightsReserved: "All rights reserved.",
    madeWith: "Made with",
    in: "in Italy",
  },
  es: {
    product: "Producto",
    features: "Funcionalidades",
    pricing: "Precios",
    widgetToWhatsApp: "Widget → WhatsApp",
    humanSupport: "Soporte Humano",
    crmIntegration: "Integración CRM",
    resources: "Recursos",
    teamCollaboration: "Colaboración en Equipo",
    privacyDesign: "Privacy by Design",
    documentation: "Documentación",
    company: "Empresa",
    about: "Sobre Nosotros",
    contact: "Contacto",
    blog: "Blog",
    legal: "Legal",
    privacy: "Política de Privacidad",
    terms: "Términos de Servicio",
    refund: "Política de Reembolso",
    followUs: "Síguenos",
    allRightsReserved: "Todos los derechos reservados.",
    madeWith: "Hecho con",
    in: "en Italia",
  },
  pt: {
    product: "Produto",
    features: "Funcionalidades",
    pricing: "Preços",
    widgetToWhatsApp: "Widget → WhatsApp",
    humanSupport: "Suporte Humano",
    crmIntegration: "Integração CRM",
    resources: "Recursos",
    teamCollaboration: "Colaboração em Equipe",
    privacyDesign: "Privacy by Design",
    documentation: "Documentação",
    company: "Empresa",
    about: "Sobre Nós",
    contact: "Contato",
    blog: "Blog",
    legal: "Legal",
    privacy: "Política de Privacidade",
    terms: "Termos de Serviço",
    refund: "Política de Reembolso",
    followUs: "Siga-nos",
    allRightsReserved: "Todos os direitos reservados.",
    madeWith: "Feito com",
    in: "na Itália",
  },
}

export function SiteFooter({ language = "en" }: SiteFooterProps) {
  const t = translations[language]
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Logo + Description */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">e</span>
              </div>
              <span className="text-xl font-bold text-white">eChatbot</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              AI-powered WhatsApp chatbot platform for businesses. Automate customer support, sales, and marketing with intelligent conversations.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-green-500 transition-colors"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-green-500 transition-colors"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-green-500 transition-colors"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-green-500 transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t.product}</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/features" className="text-sm hover:text-green-500 transition-colors">
                  {t.features}
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-sm hover:text-green-500 transition-colors">
                  {t.pricing}
                </Link>
              </li>
              <li>
                <Link to="/widget-to-whatsapp" className="text-sm hover:text-green-500 transition-colors">
                  {t.widgetToWhatsApp}
                </Link>
              </li>
              <li>
                <Link to="/human-support" className="text-sm hover:text-green-500 transition-colors">
                  {t.humanSupport}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t.resources}</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/crm-integration" className="text-sm hover:text-green-500 transition-colors">
                  {t.crmIntegration}
                </Link>
              </li>
              <li>
                <Link to="/team-collaboration" className="text-sm hover:text-green-500 transition-colors">
                  {t.teamCollaboration}
                </Link>
              </li>
              <li>
                <Link to="/privacy-by-design" className="text-sm hover:text-green-500 transition-colors">
                  {t.privacyDesign}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t.legal}</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/privacy" className="text-sm hover:text-green-500 transition-colors">
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm hover:text-green-500 transition-colors">
                  {t.terms}
                </Link>
              </li>
              <li>
                <Link to="/refund" className="text-sm hover:text-green-500 transition-colors">
                  {t.refund}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            © {currentYear} eChatbot. {t.allRightsReserved}
          </p>
          <p className="text-sm text-slate-400 flex items-center gap-1">
            {t.madeWith} <span className="text-red-500">❤️</span> {t.in}
          </p>
        </div>
      </div>
    </footer>
  )
}
