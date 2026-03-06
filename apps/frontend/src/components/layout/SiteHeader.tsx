import { Link, useLocation } from "react-router-dom"
import { useState } from "react"
import { Menu, X, ChevronDown } from "lucide-react"

interface SiteHeaderProps {
  language?: "it" | "en" | "es" | "pt"
}

const translations = {
  it: {
    home: "Home",
    features: "Funzionalità",
    pricing: "Prezzi",
    resources: "Risorse",
    humanSupport: "Supporto Umano",
    crmIntegration: "Integrazione CRM",
    teamCollaboration: "Collaborazione Team",
    privacyDesign: "Privacy by Design",
    widgetToWhatsApp: "Widget → WhatsApp",
    getStarted: "Inizia Gratis",
    signIn: "Accedi",
  },
  en: {
    home: "Home",
    features: "Features",
    pricing: "Pricing",
    resources: "Resources",
    humanSupport: "Human Support",
    crmIntegration: "CRM Integration",
    teamCollaboration: "Team Collaboration",
    privacyDesign: "Privacy by Design",
    widgetToWhatsApp: "Widget → WhatsApp",
    getStarted: "Get Started",
    signIn: "Sign In",
  },
  es: {
    home: "Inicio",
    features: "Funcionalidades",
    pricing: "Precios",
    resources: "Recursos",
    humanSupport: "Soporte Humano",
    crmIntegration: "Integración CRM",
    teamCollaboration: "Colaboración en Equipo",
    privacyDesign: "Privacy by Design",
    widgetToWhatsApp: "Widget → WhatsApp",
    getStarted: "Comenzar Gratis",
    signIn: "Iniciar Sesión",
  },
  pt: {
    home: "Início",
    features: "Funcionalidades",
    pricing: "Preços",
    resources: "Recursos",
    humanSupport: "Suporte Humano",
    crmIntegration: "Integração CRM",
    teamCollaboration: "Colaboração em Equipe",
    privacyDesign: "Privacy by Design",
    widgetToWhatsApp: "Widget → WhatsApp",
    getStarted: "Começar Grátis",
    signIn: "Entrar",
  },
}

export function SiteHeader({ language = "en" }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isResourcesOpen, setIsResourcesOpen] = useState(false)
  const location = useLocation()
  const t = translations[language]

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-xl font-bold">e</span>
            </div>
            <span className="text-xl font-bold text-slate-900">eChatbot</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <Link
              to="/"
              className={`font-medium transition-colors hover:text-green-600 ${
                isActive("/") ? "text-green-600" : "text-slate-700"
              }`}
            >
              {t.home}
            </Link>

            <Link
              to="/features"
              className={`font-medium transition-colors hover:text-green-600 ${
                isActive("/features") ? "text-green-600" : "text-slate-700"
              }`}
            >
              {t.features}
            </Link>

            <Link
              to="/pricing"
              className={`font-medium transition-colors hover:text-green-600 ${
                isActive("/pricing") ? "text-green-600" : "text-slate-700"
              }`}
            >
              {t.pricing}
            </Link>

            {/* Resources Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => setIsResourcesOpen(true)}
              onMouseLeave={() => setIsResourcesOpen(false)}
            >
              <button className="flex items-center gap-1 font-medium text-slate-700 hover:text-green-600 transition-colors">
                {t.resources}
                <ChevronDown className="h-4 w-4" />
              </button>

              {isResourcesOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  <Link
                    to="/widget-to-whatsapp"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                  >
                    {t.widgetToWhatsApp}
                  </Link>
                  <Link
                    to="/human-support"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                  >
                    {t.humanSupport}
                  </Link>
                  <Link
                    to="/crm-integration"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                  >
                    {t.crmIntegration}
                  </Link>
                  <Link
                    to="/team-collaboration"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                  >
                    {t.teamCollaboration}
                  </Link>
                  <Link
                    to="/privacy-by-design"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                  >
                    {t.privacyDesign}
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              to="/"
              className="text-slate-700 hover:text-green-600 font-medium transition-colors"
            >
              {t.signIn}
            </Link>
            <Link
              to="/"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {t.getStarted}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-slate-700 hover:text-green-600 transition-colors"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-slate-200">
            <nav className="flex flex-col gap-4">
              <Link
                to="/"
                className="font-medium text-slate-700 hover:text-green-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t.home}
              </Link>
              <Link
                to="/features"
                className="font-medium text-slate-700 hover:text-green-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t.features}
              </Link>
              <Link
                to="/pricing"
                className="font-medium text-slate-700 hover:text-green-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t.pricing}
              </Link>

              <div className="border-t border-slate-200 pt-4 mt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {t.resources}
                </p>
                <div className="flex flex-col gap-3 ml-4">
                  <Link
                    to="/widget-to-whatsapp"
                    className="text-sm text-slate-700 hover:text-green-600 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t.widgetToWhatsApp}
                  </Link>
                  <Link
                    to="/human-support"
                    className="text-sm text-slate-700 hover:text-green-600 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t.humanSupport}
                  </Link>
                  <Link
                    to="/crm-integration"
                    className="text-sm text-slate-700 hover:text-green-600 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t.crmIntegration}
                  </Link>
                  <Link
                    to="/team-collaboration"
                    className="text-sm text-slate-700 hover:text-green-600 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t.teamCollaboration}
                  </Link>
                  <Link
                    to="/privacy-by-design"
                    className="text-sm text-slate-700 hover:text-green-600 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t.privacyDesign}
                  </Link>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 mt-2 flex flex-col gap-3">
                <Link
                  to="/"
                  className="text-center bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t.getStarted}
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
