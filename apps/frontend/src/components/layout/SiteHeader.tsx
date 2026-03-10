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
  const [isLangOpen, setIsLangOpen] = useState(false)
  const resourcesRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const t = translations[language]

  const isActive = (path: string) => location.pathname === path
  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[1]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
        setIsResourcesOpen(false)
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setIsLangOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 lg:px-12">

        {/* Main Header Row — same height/style as homepage */}
        <div className="flex items-center justify-between py-1 md:py-1.5 max-h-[70px]">

          {/* Left: Logo + Brand (identical to homepage) */}
          <Link to="/" className="flex items-center justify-start gap-1 hover:opacity-80 transition-opacity">
            <img
              src="/logo.png"
              alt="eChatbot Logo"
              className="hidden md:block w-[110px] h-[110px] mt-[-10px]"
            />
            <span className="py-2 md:py-[15px] px-2 md:px-0 relative md:left-[-25px] md:top-[-7px] text-2xl md:text-2xl lg:text-4xl font-bold text-green-600 tracking-tight leading-none">
              eChatbot
            </span>
          </Link>

          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
            <Link
              to="/"
              className={`font-medium text-sm xl:text-base transition-colors hover:text-green-600 ${isActive("/") ? "text-green-600" : "text-slate-700"}`}
            >
              {t.home}
            </Link>
            <Link
              to="/features"
              className={`font-medium text-sm xl:text-base transition-colors hover:text-green-600 ${isActive("/features") ? "text-green-600" : "text-slate-700"}`}
            >
              {t.features}
            </Link>
            <Link
              to="/pricing"
              className={`font-medium text-sm xl:text-base transition-colors hover:text-green-600 ${isActive("/pricing") ? "text-green-600" : "text-slate-700"}`}
            >
              {t.pricing}
            </Link>

            {/* Resources Dropdown */}
            <div className="relative" ref={resourcesRef}>
              <button
                onClick={() => setIsResourcesOpen(!isResourcesOpen)}
                className="flex items-center gap-1 font-medium text-sm xl:text-base text-slate-700 hover:text-green-600 transition-colors"
              >
                {t.resources}
                <ChevronDown className={`h-4 w-4 transition-transform ${isResourcesOpen ? "rotate-180" : ""}`} />
              </button>
              {isResourcesOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  <Link to="/widget-to-whatsapp" className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors" onClick={() => setIsResourcesOpen(false)}>{t.widgetToWhatsApp}</Link>
                  <Link to="/human-support" className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors" onClick={() => setIsResourcesOpen(false)}>{t.humanSupport}</Link>
                  <Link to="/crm-integration" className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors" onClick={() => setIsResourcesOpen(false)}>{t.crmIntegration}</Link>
                  <Link to="/team-collaboration" className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors" onClick={() => setIsResourcesOpen(false)}>{t.teamCollaboration}</Link>
                  <Link to="/privacy-by-design" className="block px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors" onClick={() => setIsResourcesOpen(false)}>{t.privacyDesign}</Link>
                </div>
              )}
            </div>

            <Link
              to="/contact"
              className={`font-medium text-sm xl:text-base transition-colors hover:text-green-600 ${isActive("/contact") ? "text-green-600" : "text-slate-700"}`}
            >
              {t.contact}
            </Link>
          </nav>

          {/* Right: Language dropdown (same style as homepage) + CTA */}
          <div className="flex items-center justify-end gap-2 md:gap-4">

            {/* Language Dropdown — flag + code + chevron, identical to homepage */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="hidden lg:flex items-center gap-2 h-9 px-3 hover:bg-green-50 rounded-lg transition-colors"
              >
                <span className="text-xl">{currentLang.flag}</span>
                <span className="text-sm font-medium text-slate-700">{currentLang.code.toUpperCase()}</span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>

              {isLangOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider px-3 py-2 font-semibold">{t.language}</p>
                  <div className="border-t border-slate-100 mb-1" />
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { onLanguageChange?.(lang.code); setIsLangOpen(false) }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-green-50 hover:text-green-600 transition-colors ${language === lang.code ? "text-green-600 font-semibold" : "text-slate-700"}`}
                    >
                      <span className="text-xl">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sign In + Get Started */}
            <div className="hidden lg:flex items-center gap-3">
              <Link to="/" className="text-slate-700 hover:text-green-600 font-medium text-sm transition-colors">
                {t.signIn}
              </Link>
              <Link
                to="/auth/signup"
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-sm"
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
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-slate-200">
            <nav className="flex flex-col gap-4">
              <Link to="/" className="font-medium text-slate-700 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.home}</Link>
              <Link to="/features" className="font-medium text-slate-700 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.features}</Link>
              <Link to="/pricing" className="font-medium text-slate-700 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.pricing}</Link>
              <Link to="/contact" className="font-medium text-slate-700 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.contact}</Link>

              <div className="border-t border-slate-200 pt-4 mt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t.resources}</p>
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
                <div className="flex flex-col gap-1 ml-4">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { onLanguageChange?.(lang.code); setIsMenuOpen(false) }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        language === lang.code
                          ? "bg-green-50 text-green-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-xl">{lang.flag}</span>
                      <span>{lang.name}</span>
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
