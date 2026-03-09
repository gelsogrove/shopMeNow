import { Link, useLocation } from "react-router-dom"
import { useState, useRef, useEffect } from "react"
import { Menu, X, ChevronDown } from "lucide-react"

type Language = "it" | "en" | "es" | "pt"

interface SiteHeaderProps {
  language?: Language
  onLanguageChange?: (lang: Language) => void
}

const LANGUAGES = [
  { code: "it" as Language, name: "Italiano", flag: "🇮🇹" },
  { code: "en" as Language, name: "English", flag: "🇬🇧" },
  { code: "es" as Language, name: "Español", flag: "🇪🇸" },
  { code: "pt" as Language, name: "Português", flag: "🇵🇹" },
]

const translations = {
  it: {
    home: "Home",
    features: "Funzionalità",
    pricing: "Prezzi",
    resources: "Risorse",
    contact: "Contatti",
    humanSupport: "Supporto Umano",
    crmIntegration: "Integrazione CRM",
    teamCollaboration: "Collaborazione Team",
    privacyDesign: "Privacy by Design",
    widgetToWhatsApp: "Widget → WhatsApp",
    getStarted: "Inizia Gratis",
    signIn: "Accedi",
    language: "Lingua",
  },
  en: {
    home: "Home",
    features: "Features",
    pricing: "Pricing",
    resources: "Resources",
    contact: "Contact",
    humanSupport: "Human Support",
    crmIntegration: "CRM Integration",
    teamCollaboration: "Team Collaboration",
    privacyDesign: "Privacy by Design",
    widgetToWhatsApp: "Widget → WhatsApp",
    getStarted: "Get Started",
    signIn: "Sign In",
    language: "Language",
  },
  es: {
    home: "Inicio",
    features: "Funcionalidades",
    pricing: "Precios",
    resources: "Recursos",
    contact: "Contacto",
    humanSupport: "Soporte Humano",
    crmIntegration: "Integración CRM",
    teamCollaboration: "Colaboración en Equipo",
    privacyDesign: "Privacy by Design",
    widgetToWhatsApp: "Widget → WhatsApp",
    getStarted: "Comenzar Gratis",
    signIn: "Iniciar Sesión",
    language: "Idioma",
  },
  pt: {
    home: "Início",
    features: "Funcionalidades",
    pricing: "Preços",
    resources: "Recursos",
    contact: "Contato",
    humanSupport: "Suporte Humano",
    crmIntegration: "Integração CRM",
    teamCollaboration: "Colaboração em Equipe",
    privacyDesign: "Privacy by Design",
    widgetToWhatsApp: "Widget → WhatsApp",
    getStarted: "Começar Grátis",
    signIn: "Entrar",
    language: "Idioma",
  },
}

export function SiteHeader({ language = "en", onLanguageChange }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isResourcesOpen, setIsResourcesOpen] = useState(false)
  const resourcesRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const t = translations[language]

  const isActive = (path: string) => location.pathname === path

  // Close Resources dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
        setIsResourcesOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])


  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="eChatbot Logo" className="w-[44px] h-[44px] object-contain" />
            <span className="text-xl font-bold text-green-600">eChatbot</span>
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

            {/* Resources Dropdown - click based */}
            <div className="relative" ref={resourcesRef}>
              <button
                onClick={() => setIsResourcesOpen(!isResourcesOpen)}
                className="flex items-center gap-1 font-medium text-slate-700 hover:text-green-600 transition-colors"
              >
                {t.resources}
                <ChevronDown className={`h-4 w-4 transition-transform ${isResourcesOpen ? "rotate-180" : ""}`} />
              </button>

              {isResourcesOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  <Link
                    to="/widget-to-whatsapp"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                    onClick={() => setIsResourcesOpen(false)}
                  >
                    {t.widgetToWhatsApp}
                  </Link>
                  <Link
                    to="/human-support"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                    onClick={() => setIsResourcesOpen(false)}
                  >
                    {t.humanSupport}
                  </Link>
                  <Link
                    to="/crm-integration"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                    onClick={() => setIsResourcesOpen(false)}
                  >
                    {t.crmIntegration}
                  </Link>
                  <Link
                    to="/team-collaboration"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                    onClick={() => setIsResourcesOpen(false)}
                  >
                    {t.teamCollaboration}
                  </Link>
                  <Link
                    to="/privacy-by-design"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                    onClick={() => setIsResourcesOpen(false)}
                  >
                    {t.privacyDesign}
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/contact"
              className={`font-medium transition-colors hover:text-green-600 ${
                isActive("/contact") ? "text-green-600" : "text-slate-700"
              }`}
            >
              {t.contact}
            </Link>
          </nav>

          {/* Right: Language + CTA */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language Switcher - inline flags (same style as survey) */}
            <div className="flex items-center gap-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => onLanguageChange?.(lang.code)}
                  title={lang.name}
                  className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                    language === lang.code
                      ? "bg-green-500 shadow-md scale-110 ring-2 ring-green-300"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                </button>
              ))}
            </div>

            <Link
              to="/"
              className="text-slate-700 hover:text-green-600 font-medium transition-colors"
            >
              {t.signIn}
            </Link>
            <Link
              to="/auth/signup"
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
              <Link
                to="/contact"
                className="font-medium text-slate-700 hover:text-green-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t.contact}
              </Link>

              <div className="border-t border-slate-200 pt-4 mt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {t.resources}
                </p>
                <div className="flex flex-col gap-3 ml-4">
                  <Link to="/widget-to-whatsapp" className="text-sm text-slate-700 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.widgetToWhatsApp}</Link>
                  <Link to="/human-support" className="text-sm text-slate-700 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.humanSupport}</Link>
                  <Link to="/crm-integration" className="text-sm text-slate-700 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.crmIntegration}</Link>
                  <Link to="/team-collaboration" className="text-sm text-slate-700 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.teamCollaboration}</Link>
                  <Link to="/privacy-by-design" className="text-sm text-slate-700 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.privacyDesign}</Link>
                </div>
              </div>

              {/* Mobile Language Switcher */}
              <div className="border-t border-slate-200 pt-4 mt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t.language}</p>
                <div className="flex gap-2 flex-wrap ml-4">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        onLanguageChange?.(lang.code)
                        setIsMenuOpen(false)
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                        language === lang.code
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-slate-200 text-slate-600 hover:border-green-400"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.code.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 mt-2">
                <Link
                  to="/auth/signup"
                  className="block text-center bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all"
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
