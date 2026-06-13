/**
 * DemoWidgetPage
 *
 * Public, standalone "try it" page served at /demo/<slug> (e.g. /demo/demowash,
 * /demo/democasa). It resolves the demo workspace from the chatbot slug and
 * renders the real embeddable ChatWidget pointed at that workspace, so a visitor
 * can talk to the live chatbot exactly as a customer would — including the
 * registration form that asks for name, phone and language before the first message.
 *
 * Branding is per-slug (see BRAND_THEMES below): demowash = laundry, democasa =
 * DemoCasa real-estate agency — both use the same WhatsApp-green styling. The
 * slug also drives the resolve-demo lookup (workspace.customChatbotId === slug).
 *
 * Why this exists / production note:
 *   The previous /demo/<slug> route rendered the internal Playground, which
 *   talks to the backend through RELATIVE paths (`/api/v1/playground/...`). In
 *   production the frontend is served from www.echatbot.ai while the API lives
 *   on api.echatbot.ai, so those relative calls 404 and the page is broken.
 *   This page (and the widget it renders) always uses the ABSOLUTE API base
 *   below, so it works the same in dev and in production.
 */
import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ChatWidget } from "@/components/ChatWidget"

// API base for both the slug resolution below and the widget it renders.
// Resolution order:
//   1. VITE_API_URL when provided (production builds set the absolute API host).
//   2. In local dev (localhost) fall back to the RELATIVE "/api/v1" so requests
//      go through the Vite dev proxy to the backend — same-origin, no CORS, and
//      reachable from any browser.
//   3. Otherwise (production with no env) the absolute API host. NEVER a
//      relative path here: the static frontend host has no /api proxy in prod.
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    if (host === "localhost" || host === "127.0.0.1") return "/api/v1"
  }
  return "https://api.echatbot.ai/api/v1"
}

interface ResolvedDemo {
  workspaceId: string
  workspaceName: string
  chatbotId: string
  welcomeVideoUrl?: string | null
}

// ── Per-brand visual theme (keyed by slug) ───────────────────────────────────
// Tailwind class strings are kept as full literals so the JIT compiler keeps
// them. demowash reproduces the original green branding exactly; democasa shares
// the same WhatsApp-green branding (only the wordmark + monogram differ).
interface BrandTheme {
  titleA: string // first half of the H1 (kept white)
  titleB: string // second half of the H1 (accent color)
  monogram: string
  primaryColor: string
  // class fragments
  pageGradient: string
  blob1: string
  blob2: string
  accentText: string // accent color for H1 second half + brand-logo suffix
  badge: string // "Live demo" pill background/text
  dot: string // pulsing dot in the pill
  introText: string
  tryLabel: string
  itemsText: string
  contactBtn: string
  spinner: string
  loadingText: string
  openHint: string
}

const BRAND_THEMES: Record<string, BrandTheme> = {
  demowash: {
    titleA: "Demo",
    titleB: "Wash",
    monogram: "DW",
    primaryColor: "#25D366",
    pageGradient: "from-emerald-600 via-emerald-700 to-emerald-900",
    blob1: "bg-emerald-400/30",
    blob2: "bg-teal-300/20",
    accentText: "text-emerald-300",
    badge: "bg-white/10 text-emerald-50",
    dot: "bg-emerald-300",
    introText: "text-emerald-50/90",
    tryLabel: "text-emerald-200",
    itemsText: "text-emerald-50/90",
    contactBtn: "text-emerald-700 hover:bg-emerald-50",
    spinner: "border-emerald-200 border-t-white",
    loadingText: "text-emerald-50",
    openHint: "text-emerald-100/80",
  },
  // DemoCasa shares the WhatsApp-green branding of demowash (Andrea's choice) —
  // only the wordmark ("Casa") and monogram ("DC") differ.
  democasa: {
    titleA: "Demo",
    titleB: "Casa",
    monogram: "DC",
    primaryColor: "#25D366",
    pageGradient: "from-emerald-600 via-emerald-700 to-emerald-900",
    blob1: "bg-emerald-400/30",
    blob2: "bg-teal-300/20",
    accentText: "text-emerald-300",
    badge: "bg-white/10 text-emerald-50",
    dot: "bg-emerald-300",
    introText: "text-emerald-50/90",
    tryLabel: "text-emerald-200",
    itemsText: "text-emerald-50/90",
    contactBtn: "text-emerald-700 hover:bg-emerald-50",
    spinner: "border-emerald-200 border-t-white",
    loadingText: "text-emerald-50",
    openHint: "text-emerald-100/80",
  },
}

function resolveBrand(slug: string): BrandTheme {
  return BRAND_THEMES[slug] ?? BRAND_THEMES.demowash
}

// ── Demo intro copy, localized to the visitor's browser language ─────────────
// This public page deliberately avoids the app-wide LanguageContext so it stays
// self-contained in production. We read navigator.language and pick the matching
// copy, falling back to English for any unsupported language. The shared copy is
// brand-agnostic; the per-brand "Try, for example" items live in DEMO_ITEMS_I18N.
interface DemoIntroCopy {
  liveDemo: string
  intro: string
  tryFor: string
  loading: string
  unavailable: string
  contact: string
}

const DEMO_INTRO_I18N: Record<string, DemoIntroCopy> = {
  en: {
    liveDemo: "Live demo",
    intro:
      "Try our WhatsApp AI assistant live — just start chatting, exactly like on WhatsApp. The bot detects your language automatically.",
    tryFor: "Try, for example:",
    loading: "Loading the assistant…",
    unavailable: "Demo unavailable",
    contact: "Contact us",
  },
  it: {
    liveDemo: "Demo dal vivo",
    intro:
      "Prova dal vivo il nostro assistente AI su WhatsApp — inizia semplicemente a scrivere, esattamente come su WhatsApp. Il bot rileva la tua lingua automaticamente.",
    tryFor: "Prova, per esempio:",
    loading: "Caricamento dell'assistente…",
    unavailable: "Demo non disponibile",
    contact: "Contattaci",
  },
  es: {
    liveDemo: "Demo en vivo",
    intro:
      "Prueba en vivo nuestro asistente de IA en WhatsApp — empieza a escribir, igual que en WhatsApp. El bot detecta tu idioma automáticamente.",
    tryFor: "Prueba, por ejemplo:",
    loading: "Cargando el asistente…",
    unavailable: "Demo no disponible",
    contact: "Contáctanos",
  },
  fr: {
    liveDemo: "Démo en direct",
    intro:
      "Essayez en direct notre assistant IA sur WhatsApp — commencez simplement à écrire, exactement comme sur WhatsApp. Le bot détecte votre langue automatiquement.",
    tryFor: "Essayez, par exemple :",
    loading: "Chargement de l'assistant…",
    unavailable: "Démo indisponible",
    contact: "Contactez-nous",
  },
  ca: {
    liveDemo: "Demo en directe",
    intro:
      "Prova en directe el nostre assistent d'IA a WhatsApp — comença a escriure, igual que a WhatsApp. El bot detecta el teu idioma automàticament.",
    tryFor: "Prova, per exemple:",
    loading: "Carregant l'assistent…",
    unavailable: "Demo no disponible",
    contact: "Contacta'ns",
  },
  de: {
    liveDemo: "Live-Demo",
    intro:
      "Teste unseren WhatsApp-KI-Assistenten live — schreib einfach los, genau wie in WhatsApp. Der Bot erkennt deine Sprache automatisch.",
    tryFor: "Probier zum Beispiel:",
    loading: "Assistent wird geladen…",
    unavailable: "Demo nicht verfügbar",
    contact: "Kontaktiere uns",
  },
}

// Per-brand suggestion chips ("Try, for example"). Each keeps its leading emoji.
// Falls back to English, then to the demowash set for unknown brands.
const DEMO_ITEMS_I18N: Record<string, Record<string, string[]>> = {
  demowash: {
    en: [
      "📅 Book an appointment",
      "💶 Ask for prices and opening hours",
      "🧺 Report that a washing machine isn't working",
      "🙋 Ask to talk to a human operator",
    ],
    it: [
      "📅 Prenota un appuntamento",
      "💶 Chiedi prezzi e orari di apertura",
      "🧺 Segnala che una lavatrice non funziona",
      "🙋 Chiedi di parlare con un operatore",
    ],
    es: [
      "📅 Reserva una cita",
      "💶 Pregunta precios y horarios de apertura",
      "🧺 Informa de que una lavadora no funciona",
      "🙋 Pide hablar con un operador",
    ],
    fr: [
      "📅 Prendre un rendez-vous",
      "💶 Demander les prix et les horaires d'ouverture",
      "🧺 Signaler qu'un lave-linge ne fonctionne pas",
      "🙋 Demander à parler à un opérateur",
    ],
    ca: [
      "📅 Reserva una cita",
      "💶 Pregunta preus i horaris d'obertura",
      "🧺 Informa que una rentadora no funciona",
      "🙋 Demana parlar amb un operador",
    ],
    de: [
      "📅 Einen Termin buchen",
      "💶 Nach Preisen und Öffnungszeiten fragen",
      "🧺 Melden, dass eine Waschmaschine nicht funktioniert",
      "🙋 Mit einem Mitarbeiter sprechen",
    ],
  },
  democasa: {
    en: [
      "🏠 Ask which homes are available",
      "📅 Book a property viewing",
      "📈 Request a free valuation of your home",
      "🙋 Ask to talk to an agent",
    ],
    it: [
      "🏠 Chiedi quali case sono disponibili",
      "📅 Prenota una visita",
      "📈 Richiedi una valutazione gratuita della tua casa",
      "🙋 Chiedi di parlare con un agente",
    ],
    es: [
      "🏠 Pregunta qué casas hay disponibles",
      "📅 Reserva una visita",
      "📈 Pide una valoración gratuita de tu vivienda",
      "🙋 Pide hablar con un agente",
    ],
    fr: [
      "🏠 Demander quels logements sont disponibles",
      "📅 Réserver une visite",
      "📈 Demander une estimation gratuite de votre logement",
      "🙋 Demander à parler à un agent",
    ],
    ca: [
      "🏠 Pregunta quins habitatges hi ha disponibles",
      "📅 Reserva una visita",
      "📈 Demana una valoració gratuïta del teu habitatge",
      "🙋 Demana parlar amb un agent",
    ],
    de: [
      "🏠 Verfügbare Wohnungen erfragen",
      "📅 Eine Besichtigung buchen",
      "📈 Eine kostenlose Bewertung deiner Immobilie anfordern",
      "🙋 Mit einem Makler sprechen",
    ],
  },
}

// Resolve the browser language (e.g. "it-IT" → "it"), English fallback.
function resolveLang(): string {
  const raw =
    typeof navigator !== "undefined" ? navigator.language || "en" : "en"
  return raw.slice(0, 2).toLowerCase()
}

function resolveDemoIntro(lang: string): DemoIntroCopy {
  return DEMO_INTRO_I18N[lang] || DEMO_INTRO_I18N.en
}

function resolveDemoItems(slug: string, lang: string): string[] {
  const brand = DEMO_ITEMS_I18N[slug] ?? DEMO_ITEMS_I18N.demowash
  return brand[lang] || brand.en
}

export function DemoWidgetPage() {
  // Slug comes from the route param. The route is declared as /demo/<slug>/*
  // so we also fall back to parsing the pathname for nested matches.
  const params = useParams()
  const slug = useMemo(() => {
    if (params.slug) return params.slug.toLowerCase()
    const m = window.location.pathname.match(/^\/demo\/([a-z0-9-]+)/)
    return (m?.[1] || "").toLowerCase()
  }, [params.slug])

  const apiUrl = useMemo(() => getApiBaseUrl(), [])

  // Brand theme + intro copy/items, localized to the visitor's browser language.
  const brand = useMemo(() => resolveBrand(slug), [slug])
  const lang = useMemo(() => resolveLang(), [])
  const t = useMemo(() => resolveDemoIntro(lang), [lang])
  const items = useMemo(() => resolveDemoItems(slug, lang), [slug, lang])

  const [demo, setDemo] = useState<ResolvedDemo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${apiUrl}/playground/resolve-demo/${slug}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || data?.message || `Demo "${slug}" not found`)
        }
        return data as ResolvedDemo
      })
      .then((data) => {
        if (cancelled) return
        if (!data?.workspaceId) throw new Error("Demo workspace is not configured")
        setDemo(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load demo")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiUrl, slug])

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden bg-gradient-to-br ${brand.pageGradient}`}>
      {/* Decorative blurred blobs */}
      <div className={`pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full ${brand.blob1} blur-3xl`} />
      <div className={`pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full ${brand.blob2} blur-3xl`} />

      {/* Back to home */}
      <Link
        to="/"
        className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 sm:left-6 sm:top-6"
      >
        ← Home
      </Link>

      {/* eChatbot.AI brand logo */}
      <a
        href="https://www.echatbot.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-5 left-5 z-20 text-lg font-extrabold tracking-tight sm:bottom-6 sm:left-6"
      >
        <span className="text-white">eChatbot</span>
        <span className={brand.accentText}>.AI</span>
      </a>

      {/* Hero copy */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center sm:items-start sm:px-16 sm:py-16 sm:text-left">
        <div className="max-w-xl">
          <div className={`mb-4 inline-flex items-center gap-2 rounded-full ${brand.badge} px-4 py-1.5 text-sm font-medium backdrop-blur`}>
            <span className={`h-2 w-2 rounded-full ${brand.dot}`} />
            {t.liveDemo}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            <span className="text-white">{brand.titleA}</span>
            <span className={brand.accentText}>{brand.titleB}</span>
          </h1>
          {/* Intro — visible on every screen size (mobile included). */}
          <p className={`mt-4 text-base leading-relaxed ${brand.introText} sm:text-xl`}>
            {t.intro}
          </p>

          {/* Suggested things to try in the demo — guides the visitor. */}
          <div className="mt-6">
            <p className={`text-xs font-semibold uppercase tracking-wide ${brand.tryLabel} sm:text-sm`}>
              {t.tryFor}
            </p>
            <ul className={`mx-auto mt-3 flex max-w-md flex-col gap-2 text-left text-sm ${brand.itemsText} sm:mx-0 sm:text-base`}>
              {items.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact us — always visible; routes to the contact form. */}
          <div className="mt-7 flex justify-center sm:justify-start">
            <Link
              to="/contact"
              className={`inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold ${brand.contactBtn} shadow-lg transition active:scale-[0.98]`}
            >
              ✉️ {t.contact}
            </Link>
          </div>

          {loading && (
            <div className={`mt-8 flex items-center gap-3 ${brand.loadingText}`}>
              <span className={`h-5 w-5 animate-spin rounded-full border-2 ${brand.spinner}`} />
              {t.loading}
            </div>
          )}

          {error && (
            <div className="mt-8 rounded-2xl border border-red-300/40 bg-red-500/15 px-5 py-4 text-left text-sm text-red-50 backdrop-blur">
              <p className="font-semibold">{t.unavailable}</p>
              <p className="mt-1 text-red-100/90">{error}</p>
            </div>
          )}

          {demo && !loading && !error && (
            <p className={`mt-8 hidden items-center gap-2 text-sm ${brand.openHint} sm:flex`}>
              The chat is open on the right. 👉
            </p>
          )}
        </div>
      </div>

      {/* The real widget, opened by default so the visitor lands on the form. */}
      {demo && (
        <ChatWidget
          workspaceId={demo.workspaceId}
          apiUrl={apiUrl}
          useWindowConfig={false}
          defaultOpen
          instantChat
          hideWorkspaceName
          plainWhatsappNumber
          whatsappBadge
          icon="whatsapp"
          monogram={brand.monogram}
          title={`${brand.titleA}${brand.titleB}`}
          primaryColor={brand.primaryColor}
          position="bottom-right"
          welcomeVideoUrl={demo.welcomeVideoUrl || undefined}
        />
      )}
    </div>
  )
}

export default DemoWidgetPage
