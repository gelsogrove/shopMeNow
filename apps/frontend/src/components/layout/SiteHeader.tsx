import { Link, useLocation, useNavigate } from "react-router-dom"
import { useState, useRef, useEffect } from "react"
import { Menu, X, ChevronDown, Mail, Crown, LogOut, User, CreditCard, MessageSquare } from "lucide-react"
import { useLanguage, SUPPORTED_LANGUAGES } from "@/contexts/LanguageContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { storage } from "@/lib/storage"
import { workspaceApi } from "@/services/workspaceApi"
import { getBillingOverview, PlanType } from "@/services/subscriptionBillingApi"
import { logger } from "@/lib/logger"

type Language = "it" | "en" | "es" | "de"

// Props kept for backward compatibility — language is driven by global context
interface SiteHeaderProps {
  language?: Language
  onLanguageChange?: (lang: Language) => void
}

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
    yourChannels: "I tuoi canali",
    profile: "Profilo",
    billing: "Fatturazione",
    support: "Supporto",
    logout: "Esci",
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
    yourChannels: "Your Channels",
    profile: "Profile",
    billing: "Billing",
    support: "Support",
    logout: "Log Out",
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
    yourChannels: "Tus canales",
    profile: "Perfil",
    billing: "Facturación",
    support: "Soporte",
    logout: "Cerrar sesión",
  },
  de: {
    home: "Startseite",
    features: "Funktionen",
    pricing: "Preise",
    resources: "Ressourcen",
    contact: "Kontakt",
    humanSupport: "Menschlicher Support",
    crmIntegration: "CRM-Integration",
    teamCollaboration: "Team-Zusammenarbeit",
    privacyDesign: "Privacy by Design",
    widgetToWhatsApp: "Widget → WhatsApp",
    getStarted: "Kostenlos starten",
    signIn: "Anmelden",
    language: "Sprache",
    yourChannels: "Deine Kanäle",
    profile: "Profil",
    billing: "Abrechnung",
    support: "Support",
    logout: "Abmelden",
  },
}

const PLAN_PRIORITY: Record<PlanType, number> = {
  FREE_TRIAL: 0,
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
}
const getPlanPriorityValue = (planType?: string | null) => {
  if (!planType) return -1
  return PLAN_PRIORITY[planType as PlanType] ?? -1
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SiteHeader({ language: _language, onLanguageChange: _onLanguageChange }: SiteHeaderProps) {
  const { language, setLanguage } = useLanguage()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isResourcesOpen, setIsResourcesOpen] = useState(false)
  const resourcesRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const t = translations[language]

  // Auth state — mirrors LoginPage header
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loggedInUser, setLoggedInUser] = useState<{
    firstName?: string
    lastName?: string
    email?: string
    profilePicture?: string
    authProvider?: string
    isPlatformAdmin?: boolean
  } | null>(null)
  const [avatarImageError, setAvatarImageError] = useState(false)
  const [userPlan, setUserPlan] = useState<{
    planType?: string | null
    trialEndsAt?: string | null
    creditBalance?: number | null
  } | null>(null)
  const supportUnreadCount = 0

  // Load auth state from storage on mount (same logic as LoginPage)
  useEffect(() => {
    const existingToken = storage.getToken()
    if (!existingToken) return

    const cachedUser = storage.getUser<{
      firstName?: string; lastName?: string; email?: string
      profilePicture?: string; authProvider?: string; isPlatformAdmin?: boolean
    }>()
    if (!cachedUser) return

    try {
      setLoggedInUser(cachedUser)
      setIsLoggedIn(true)
      setAvatarImageError(false)

      workspaceApi.getAll().then((workspaces: Array<{ id: string; planType?: string | null; trialEndsAt?: string | null }>) => {
        if (!workspaces || workspaces.length === 0) return

        const storedWorkspaceRaw = storage.getWorkspace<{ id?: string }>()
        const storedWorkspaceId = storedWorkspaceRaw?.id ?? null

        const selectedWorkspace = workspaces.reduce(
          (best: typeof workspaces[0], current: typeof workspaces[0]) => {
            if (!best) return current
            const bestPriority = getPlanPriorityValue(best.planType)
            const currentPriority = getPlanPriorityValue(current.planType)
            if (currentPriority > bestPriority) return current
            if (currentPriority === bestPriority && storedWorkspaceId && current.id === storedWorkspaceId) return current
            return best
          },
          workspaces[0]
        )

        if (!selectedWorkspace) return

        setUserPlan({
          planType: selectedWorkspace.planType,
          trialEndsAt: selectedWorkspace.trialEndsAt,
          creditBalance: null,
        })

        getBillingOverview(selectedWorkspace.id)
          .then((overview) => {
            setUserPlan({
              planType: overview.billing.planType,
              trialEndsAt: overview.billing.trialEndsAt,
              creditBalance: overview.billing.creditBalance,
            })
          })
          .catch((err: Error) => logger.error("SiteHeader: Failed to fetch billing overview:", err))
      }).catch((err: { response?: { status?: number } } & Error) => {
        if (err?.response?.status === 401) {
          storage.clearAuth()
          setIsLoggedIn(false)
          setLoggedInUser(null)
          setUserPlan(null)
          return
        }
        logger.error("SiteHeader: Failed to fetch workspaces:", err)
      })
    } catch (e) {
      logger.error("SiteHeader: Failed to initialise auth:", e)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Plan display values (same as LoginPage)
  const planLabel =
    !userPlan?.planType || userPlan.planType === "FREE_TRIAL"
      ? "Free Trial"
      : userPlan.planType === "BASIC"
      ? "Basic"
      : userPlan.planType === "PREMIUM"
      ? "Premium"
      : userPlan?.planType
      ? userPlan.planType.charAt(0) + userPlan.planType.slice(1).toLowerCase()
      : "Free Trial"

  const trialDaysRemaining = userPlan?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(userPlan.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const handleLogout = () => {
    storage.clearAppState()
    setIsLoggedIn(false)
    setLoggedInUser(null)
    setUserPlan(null)
    navigate("/")
  }

  const isActive = (path: string) => location.pathname === path

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
    <header className="bg-[#070d18]/90 backdrop-blur border-b border-white/10 shadow-sm sticky top-0 z-[100] overflow-visible">
      <div className="max-w-7xl mx-auto px-4 lg:px-12">

        {/* Mini top-bar — sales-led pivot: only Contact link surfaced
            publicly. Pricing is no longer a public page: it's discussed
            during the manual onboarding follow-up, not on the landing. */}
        <div className="hidden lg:flex justify-end pt-3">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
            <a href="/survey" className="hover:text-white transition-colors">Survey</a>
            <span className="text-white/20">|</span>
            <a href="/#demo" className="hover:text-white transition-colors">Demo</a>
            <span className="text-white/20">|</span>
            <a href="/contact" className="hover:text-white transition-colors">{t.contact}</a>
          </div>
        </div>

        {/* Main Header Row — same height/style as homepage */}
        <div className="flex items-center justify-between py-1 md:py-1.5 max-h-[70px]">

          {/* Left: Logo + Brand (identical to homepage) */}
          <Link to="/" className="flex items-center justify-start gap-1 hover:opacity-80 transition-opacity">
            <span className="py-2 md:py-[15px] px-2 md:px-0 text-2xl md:text-2xl lg:text-4xl font-bold tracking-tight leading-none" style={{ color: "#25D366" }}>
              eChatbot<span className="text-white">.AI</span>
            </span>
          </Link>

          {/* Center spacer (nav hidden to mirror homepage header minimal layout) */}
          <div className="hidden lg:block flex-1" />

          {/* Right: Language + Auth (identical layout to homepage) */}
          <div className="flex items-center justify-end gap-2 md:gap-6">

            {/* Language Selector — Shadcn DropdownMenu, identical to homepage */}
            {/* Language Selector — all flags inline (no dropdown), like homepage.
                📱 Visible on mobile too: flag-only on small screens, flag+code from sm. */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {([
                { code: "it", flag: "🇮🇹" },
                { code: "en", flag: "🇬🇧" },
                { code: "es", flag: "🇪🇸" },
                { code: "de", flag: "🇩🇪" },
              ] as const).map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  className={`flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors sm:px-2 ${language === l.code ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <span className="text-lg leading-none">{l.flag}</span>
                  <span className="hidden text-xs font-semibold uppercase sm:inline">{l.code}</span>
                </button>
              ))}
            </div>

            {/* Auth Section — logged in or logged out */}
            {isLoggedIn ? (
              <div className="hidden lg:flex items-center gap-4">
                {/* Support Inbox */}
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/support/tickets")}
                        className="relative h-9 w-9 p-0 text-slate-300 hover:text-green-600 hover:bg-white/10"
                      >
                        <Mail className="h-5 w-5" />
                        {supportUnreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                            {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{supportUnreadCount > 0 ? `${supportUnreadCount} unread` : t.support}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Plan Badge */}
                <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                  !userPlan?.planType || userPlan.planType === "FREE_TRIAL"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : userPlan.planType === "BASIC"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : userPlan.planType === "PREMIUM"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border-amber-200"
                }`}>
                  <Crown className="h-3.5 w-3.5" />
                  <span>
                    {!userPlan?.planType || userPlan.planType === "FREE_TRIAL"
                      ? `Free Trial ${trialDaysRemaining ?? 0}d`
                      : planLabel}
                  </span>
                </div>

                {/* User Avatar Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none hover:scale-105 transition-transform p-0"
                    >
                      {loggedInUser?.profilePicture && !avatarImageError ? (
                        <img
                          src={loggedInUser.profilePicture}
                          alt="User"
                          referrerPolicy="no-referrer"
                          className="h-full w-full rounded-full object-cover ring-2 ring-gray-100"
                          onError={() => setAvatarImageError(true)}
                        />
                      ) : (
                        <div className="h-full w-full rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-semibold ring-2 ring-green-100">
                          {loggedInUser?.firstName && loggedInUser?.lastName
                            ? `${loggedInUser.firstName[0]}${loggedInUser.lastName[0]}`.toUpperCase()
                            : loggedInUser?.firstName?.[0]?.toUpperCase() || loggedInUser?.email?.[0]?.toUpperCase() || "U"}
                        </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-slate-900 border-white/10 text-slate-200" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal p-3">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none truncate">
                          {loggedInUser?.firstName && loggedInUser?.lastName
                            ? `${loggedInUser.firstName} ${loggedInUser.lastName}`
                            : "User"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground truncate">
                          {loggedInUser?.email}
                        </p>
                        {loggedInUser?.isPlatformAdmin && (
                          <p className="text-xs leading-none text-purple-600 font-semibold pt-1">🔐 Platform Admin</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/workspace-selection")}>
                      <MessageSquare className="mr-2 h-4 w-4 text-green-500" fill="currentColor" />
                      <span>{t.yourChannels}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/profile")}>
                      <User className="mr-2 h-4 w-4 text-blue-500" />
                      <span>{t.profile}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/billing")}>
                      <CreditCard className="mr-2 h-4 w-4 text-emerald-500" />
                      <span>{t.billing}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="p-2 cursor-pointer" onClick={() => navigate("/support/tickets")}>
                      <div className="relative mr-2">
                        <Mail className="h-4 w-4 text-blue-500" />
                        {supportUnreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                            {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
                          </span>
                        )}
                      </div>
                      <span>{supportUnreadCount > 0 ? `${t.support} (${supportUnreadCount})` : t.support}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="p-2 cursor-pointer text-red-600 focus:text-red-600"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t.logout}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              // Sales-led pivot: no public "Sign In" or "Get Started"
              // buttons on the marketing header. Existing customers use
              // /login directly; new leads go through /request-access
              // (see hero CTAs below).
              <div className="hidden lg:flex items-center gap-3" />
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 text-slate-200 hover:text-green-600 transition-colors"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-white/10">
            <nav className="flex flex-col gap-4">
              <Link to="/" className="font-medium text-slate-200 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.home}</Link>
              <Link to="/contact" className="font-medium text-slate-200 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.contact}</Link>

              <div className="border-t border-white/10 pt-4 mt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t.resources}</p>
                <div className="flex flex-col gap-3 ml-4">
                  <Link to="/human-support" className="text-sm text-slate-200 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.humanSupport}</Link>
                  <Link to="/crm-integration" className="text-sm text-slate-200 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.crmIntegration}</Link>
                  <Link to="/privacy-by-design" className="text-sm text-slate-200 hover:text-green-600 transition-colors" onClick={() => setIsMenuOpen(false)}>{t.privacyDesign}</Link>
                </div>
              </div>

              {/* Mobile Language Switcher */}
              <div className="border-t border-white/10 pt-4 mt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t.language}</p>
                <div className="flex flex-col gap-1 ml-4">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setIsMenuOpen(false) }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        language === lang.code
                          ? "bg-green-50 text-green-700 font-semibold"
                          : "text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xl">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Auth Section */}
              <div className="border-t border-white/10 pt-4 mt-2">
                {isLoggedIn ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 px-1">
                      <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {loggedInUser?.firstName && loggedInUser?.lastName
                          ? `${loggedInUser.firstName[0]}${loggedInUser.lastName[0]}`.toUpperCase()
                          : loggedInUser?.email?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {loggedInUser?.firstName && loggedInUser?.lastName
                            ? `${loggedInUser.firstName} ${loggedInUser.lastName}`
                            : "User"}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{loggedInUser?.email}</p>
                      </div>
                    </div>
                    <button
                      className="flex items-center gap-2 px-1 py-2 text-sm text-slate-200 hover:text-green-600 transition-colors"
                      onClick={() => { navigate("/workspace-selection"); setIsMenuOpen(false) }}
                    >
                      <MessageSquare className="h-4 w-4 text-green-500" fill="currentColor" />{t.yourChannels}
                    </button>
                    <button
                      className="flex items-center gap-2 px-1 py-2 text-sm text-slate-200 hover:text-green-600 transition-colors"
                      onClick={() => { navigate("/profile"); setIsMenuOpen(false) }}
                    >
                      <User className="h-4 w-4 text-blue-500" />{t.profile}
                    </button>
                    <button
                      className="flex items-center gap-2 px-1 py-2 text-sm text-slate-200 hover:text-green-600 transition-colors"
                      onClick={() => { navigate("/billing"); setIsMenuOpen(false) }}
                    >
                      <CreditCard className="h-4 w-4 text-emerald-500" />{t.billing}
                    </button>
                    <button
                      className="flex items-center gap-2 px-1 py-2 text-sm text-red-600 hover:text-red-700 transition-colors"
                      onClick={() => { handleLogout(); setIsMenuOpen(false) }}
                    >
                      <LogOut className="h-4 w-4" />{t.logout}
                    </button>
                  </div>
                ) : (
                  // Sales-led pivot: mobile CTA points to the lead-capture
                  // form instead of the (now disabled) self-service wizard.
                  <Link
                    to="/request-access"
                    className="block text-center bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t.getStarted}
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

