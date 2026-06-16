/**
 * DemoWidgetPage
 *
 * Public, standalone "try it" page served at /demo/<slug> (e.g. /demo/demowash,
 * /demo/demorealestate). It resolves the demo workspace from the chatbot slug and
 * renders the real embeddable ChatWidget pointed at that workspace, so a visitor
 * can talk to the live chatbot exactly as a customer would — including the
 * registration form that asks for name, phone and language before the first message.
 *
 * Branding is per-slug (see BRAND_THEMES below): demowash = laundry, demorealestate =
 * DemoRealEstate real-estate agency — both use the same WhatsApp-green styling. The
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
import { ChatWidget, type PushDemoCase } from "@/components/ChatWidget"

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
}

// ── Per-brand visual theme (keyed by slug) ───────────────────────────────────
// Tailwind class strings are kept as full literals so the JIT compiler keeps
// them. demowash reproduces the original green branding exactly; demorealestate shares
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
  // DemoRealEstate shares the WhatsApp-green branding of demowash (Andrea's choice) —
  // only the wordmark ("RealEstate") and monogram ("DR") differ.
  demorealestate: {
    titleA: "Demo",
    titleB: "RealEstate",
    monogram: "DR",
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
  pushBtn: string
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
    pushBtn: "📣 Push message (in the customer's language)",
  },
  it: {
    liveDemo: "Demo dal vivo",
    intro:
      "Prova dal vivo il nostro assistente AI su WhatsApp — inizia semplicemente a scrivere, esattamente come su WhatsApp. Il bot rileva la tua lingua automaticamente.",
    tryFor: "Prova, per esempio:",
    loading: "Caricamento dell'assistente…",
    unavailable: "Demo non disponibile",
    contact: "Contattaci",
    pushBtn: "📣 Push message (nella lingua del cliente)",
  },
  es: {
    liveDemo: "Demo en vivo",
    intro:
      "Prueba en vivo nuestro asistente de IA en WhatsApp — empieza a escribir, igual que en WhatsApp. El bot detecta tu idioma automáticamente.",
    tryFor: "Prueba, por ejemplo:",
    loading: "Cargando el asistente…",
    unavailable: "Demo no disponible",
    contact: "Contáctanos",
    pushBtn: "📣 Push message (en el idioma del cliente)",
  },
  fr: {
    liveDemo: "Démo en direct",
    intro:
      "Essayez en direct notre assistant IA sur WhatsApp — commencez simplement à écrire, exactement comme sur WhatsApp. Le bot détecte votre langue automatiquement.",
    tryFor: "Essayez, par exemple :",
    loading: "Chargement de l'assistant…",
    unavailable: "Démo indisponible",
    contact: "Contactez-nous",
    pushBtn: "📣 Push message (dans la langue du client)",
  },
  ca: {
    liveDemo: "Demo en directe",
    intro:
      "Prova en directe el nostre assistent d'IA a WhatsApp — comença a escriure, igual que a WhatsApp. El bot detecta el teu idioma automàticament.",
    tryFor: "Prova, per exemple:",
    loading: "Carregant l'assistent…",
    unavailable: "Demo no disponible",
    contact: "Contacta'ns",
    pushBtn: "📣 Push message (en l'idioma del client)",
  },
  de: {
    liveDemo: "Live-Demo",
    intro:
      "Teste unseren WhatsApp-KI-Assistenten live — schreib einfach los, genau wie in WhatsApp. Der Bot erkennt deine Sprache automatisch.",
    tryFor: "Probier zum Beispiel:",
    loading: "Assistent wird geladen…",
    unavailable: "Demo nicht verfügbar",
    contact: "Kontaktiere uns",
    pushBtn: "📣 Push message (in der Sprache des Kunden)",
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
      "🧥 Ask the price to dry-clean a coat",
      "👔 Ask when you can pick up your trousers (dry cleaning)",
      "🙋 Ask to talk to a human operator",
    ],
    it: [
      "📅 Prenota un appuntamento",
      "💶 Chiedi prezzi e orari di apertura",
      "🧺 Segnala che una lavatrice non funziona",
      "🧥 Chiedi il prezzo per lavare un cappotto",
      "👔 Chiedi quando puoi ritirare i pantaloni (tintoria)",
      "🙋 Chiedi di parlare con un operatore",
    ],
    es: [
      "📅 Reserva una cita",
      "💶 Pregunta precios y horarios de apertura",
      "🧺 Informa de que una lavadora no funciona",
      "🧥 Pregunta el precio de limpiar un abrigo",
      "👔 Pregunta cuándo recoger tus pantalones (tintorería)",
      "🙋 Pide hablar con un operador",
    ],
    fr: [
      "📅 Prendre un rendez-vous",
      "💶 Demander les prix et les horaires d'ouverture",
      "🧺 Signaler qu'un lave-linge ne fonctionne pas",
      "🧥 Demander le prix pour nettoyer un manteau",
      "👔 Demander quand récupérer votre pantalon (pressing)",
      "🙋 Demander à parler à un opérateur",
    ],
    ca: [
      "📅 Reserva una cita",
      "💶 Pregunta preus i horaris d'obertura",
      "🧺 Informa que una rentadora no funciona",
      "🧥 Pregunta el preu per netejar un abric",
      "👔 Pregunta quan pots recollir els pantalons (tintoreria)",
      "🙋 Demana parlar amb un operador",
    ],
    de: [
      "📅 Einen Termin buchen",
      "💶 Nach Preisen und Öffnungszeiten fragen",
      "🧺 Melden, dass eine Waschmaschine nicht funktioniert",
      "🧥 Frag den Preis für die Reinigung eines Mantels",
      "👔 Frag, wann du deine Hose abholen kannst (Reinigung)",
      "🙋 Mit einem Mitarbeiter sprechen",
    ],
  },
  demorealestate: {
    en: [
      "🏠 Ask which homes are available",
      "🔎 Find a 2-bedroom flat in Gràcia under €1,300/month",
      "📅 Book a property viewing",
      "📈 Request a free valuation of your home",
      "🏦 Ask about mortgage options",
      "🙋 Ask to talk to an agent",
    ],
    it: [
      "🏠 Chiedi quali case sono disponibili",
      "🔎 Cerca un appartamento con 2 camere a Gràcia sotto i 1.300 €/mese",
      "📅 Prenota una visita",
      "📈 Richiedi una valutazione gratuita della tua casa",
      "🏦 Chiedi informazioni sul mutuo",
      "🙋 Chiedi di parlare con un agente",
    ],
    es: [
      "🏠 Pregunta qué casas hay disponibles",
      "🔎 Busca un piso de 2 habitaciones en Gràcia por menos de 1.300 €/mes",
      "📅 Reserva una visita",
      "📈 Pide una valoración gratuita de tu vivienda",
      "🏦 Pregunta por opciones de hipoteca",
      "🙋 Pide hablar con un agente",
    ],
    fr: [
      "🏠 Demander quels logements sont disponibles",
      "🔎 Chercher un appartement 2 chambres à Gràcia sous 1 300 €/mois",
      "📅 Réserver une visite",
      "📈 Demander une estimation gratuite de votre logement",
      "🏦 Se renseigner sur le prêt immobilier",
      "🙋 Demander à parler à un agent",
    ],
    ca: [
      "🏠 Pregunta quins habitatges hi ha disponibles",
      "🔎 Busca un pis de 2 habitacions a Gràcia per menys de 1.300 €/mes",
      "📅 Reserva una visita",
      "📈 Demana una valoració gratuïta del teu habitatge",
      "🏦 Pregunta per opcions d'hipoteca",
      "🙋 Demana parlar amb un agent",
    ],
    de: [
      "🏠 Verfügbare Wohnungen erfragen",
      "🔎 Eine 3-Zimmer-Wohnung in Gràcia unter 1.300 €/Monat suchen",
      "📅 Eine Besichtigung buchen",
      "📈 Eine kostenlose Bewertung deiner Immobilie anfordern",
      "🏦 Nach Hypotheken-Optionen fragen",
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

// 📣 Simulated PROMOTIONAL push cards, per brand × language. Clicking the demo
// "push" button injects these (one per click, cycling) as incoming bot bubbles
// with a beep — so a visitor sees what a proactive promo feels like, delivered
// in the customer's own language. Each is a structured card (badge + body +
// optional big image) rendered by ChatWidget's `renderContent` — NOT the generic
// MessageRenderer (which caps images at 120px). Images are served from the
// frontend origin (/public): /house-1.jpg, /house-2.jpg, /laundry.png.
const WASH_BADGE = "📣 PROMO · DemoWash"
const RE_BADGE = "📣 PROMO · DemoRealEstate"

const PUSH_CASES_I18N: Record<string, Record<string, PushDemoCase[]>> = {
  demowash: {
    en: [
      { badge: WASH_BADGE, body: "🎫 Loyalty card: -20% on every wash. Activate it today at your store!", image: "/laundry.png" },
      { badge: WASH_BADGE, body: "🧺 -30% on duvets this weekend at your store!" },
      { badge: WASH_BADGE, body: "🎁 Bring a friend and you both get a free wash!" },
      { badge: WASH_BADGE, body: "⭐ You have 50 points: a free wash is waiting for you!" },
      { badge: WASH_BADGE, body: "📣 New store in Sants! Come try it with a free dry." },
    ],
    it: [
      { badge: WASH_BADGE, body: "🎫 Tessera fedeltà: -20% su ogni lavaggio. Attivala oggi nella tua sede!", image: "/laundry.png" },
      { badge: WASH_BADGE, body: "🧺 -30% sui piumoni questo weekend nella tua sede!" },
      { badge: WASH_BADGE, body: "🎁 Porta un amico e avete entrambi un lavaggio gratis!" },
      { badge: WASH_BADGE, body: "⭐ Hai 50 punti: ti aspetta un lavaggio gratis!" },
      { badge: WASH_BADGE, body: "📣 Nuova sede a Sants! Vieni a provarla con un'asciugatura gratis." },
    ],
    es: [
      { badge: WASH_BADGE, body: "🎫 Tarjeta de fidelización: -20% en cada lavado. ¡Actívala hoy en tu sede!", image: "/laundry.png" },
      { badge: WASH_BADGE, body: "🧺 ¡-30% en edredones este fin de semana en tu sede!" },
      { badge: WASH_BADGE, body: "🎁 ¡Trae a un amigo y los dos tenéis un lavado gratis!" },
      { badge: WASH_BADGE, body: "⭐ Tienes 50 puntos: ¡te espera un lavado gratis!" },
      { badge: WASH_BADGE, body: "📣 ¡Nueva sede en Sants! Ven a probarla con un secado gratis." },
    ],
    fr: [
      { badge: WASH_BADGE, body: "🎫 Carte de fidélité : -20% sur chaque lavage. Activez-la aujourd'hui dans votre point !", image: "/laundry.png" },
      { badge: WASH_BADGE, body: "🧺 -30% sur les couettes ce week-end dans votre point !" },
      { badge: WASH_BADGE, body: "🎁 Amenez un ami et profitez chacun d'un lavage gratuit !" },
      { badge: WASH_BADGE, body: "⭐ Vous avez 50 points : un lavage gratuit vous attend !" },
      { badge: WASH_BADGE, body: "📣 Nouveau point à Sants ! Venez l'essayer avec un séchage gratuit." },
    ],
    ca: [
      { badge: WASH_BADGE, body: "🎫 Targeta de fidelització: -20% en cada rentat. Activa-la avui a la teva seu!", image: "/laundry.png" },
      { badge: WASH_BADGE, body: "🧺 -30% en edredons aquest cap de setmana a la teva seu!" },
      { badge: WASH_BADGE, body: "🎁 Porta un amic i tots dos teniu un rentat gratis!" },
      { badge: WASH_BADGE, body: "⭐ Tens 50 punts: t'espera un rentat gratis!" },
      { badge: WASH_BADGE, body: "📣 Nova seu a Sants! Vine a provar-la amb un assecat gratis." },
    ],
    de: [
      { badge: WASH_BADGE, body: "🎫 Treuekarte: -20% auf jede Wäsche. Aktiviere sie heute in deiner Filiale!", image: "/laundry.png" },
      { badge: WASH_BADGE, body: "🧺 -30% auf Bettdecken dieses Wochenende in deiner Filiale!" },
      { badge: WASH_BADGE, body: "🎁 Bring einen Freund mit und ihr bekommt beide eine Gratis-Wäsche!" },
      { badge: WASH_BADGE, body: "⭐ Du hast 50 Punkte: eine Gratis-Wäsche wartet auf dich!" },
      { badge: WASH_BADGE, body: "📣 Neue Filiale in Sants! Komm und teste sie mit einem Gratis-Trocknen." },
    ],
  },
  demorealestate: {
    en: [
      { badge: RE_BADGE, body: "🏡 New home in Gràcia\n3 rooms · 85 m² · bright · €320,000", image: "/house-1.jpg" },
      { badge: RE_BADGE, body: "📉 Price drop! The penthouse you viewed is now €280,000." },
      { badge: RE_BADGE, body: "🔔 5 new homes just listed in your area. Want to see them?" },
      { badge: RE_BADGE, body: "🔑 New rental in Sant Cugat\n2 rooms · 70 m² · €1,200/month", image: "/house-2.jpg" },
      { badge: RE_BADGE, body: "📈 Your area is in high demand. Get a free valuation of your home!" },
    ],
    it: [
      { badge: RE_BADGE, body: "🏡 Nuova casa a Gràcia\n3 locali · 85 m² · luminosa · 320.000 €", image: "/house-1.jpg" },
      { badge: RE_BADGE, body: "📉 Ribasso di prezzo! L'attico che hai visto ora a 280.000 €." },
      { badge: RE_BADGE, body: "🔔 5 nuove case appena pubblicate nella tua zona. Vuoi vederle?" },
      { badge: RE_BADGE, body: "🔑 Nuovo affitto a Sant Cugat\n2 locali · 70 m² · 1.200 €/mese", image: "/house-2.jpg" },
      { badge: RE_BADGE, body: "📈 La tua zona è molto richiesta. Valuta la tua casa gratis!" },
    ],
    es: [
      { badge: RE_BADGE, body: "🏡 Nueva casa en Gràcia\n3 hab · 85 m² · luminosa · 320.000 €", image: "/house-1.jpg" },
      { badge: RE_BADGE, body: "📉 ¡Bajada de precio! El ático que viste ahora a 280.000 €." },
      { badge: RE_BADGE, body: "🔔 5 casas nuevas recién publicadas en tu zona. ¿Quieres verlas?" },
      { badge: RE_BADGE, body: "🔑 Nuevo alquiler en Sant Cugat\n2 hab · 70 m² · 1.200 €/mes", image: "/house-2.jpg" },
      { badge: RE_BADGE, body: "📈 Tu zona está muy solicitada. ¡Valora tu casa gratis!" },
    ],
    fr: [
      { badge: RE_BADGE, body: "🏡 Nouveau logement à Gràcia\n3 pièces · 85 m² · lumineux · 320 000 €", image: "/house-1.jpg" },
      { badge: RE_BADGE, body: "📉 Baisse de prix ! Le penthouse que vous avez vu est maintenant à 280 000 €." },
      { badge: RE_BADGE, body: "🔔 5 nouveaux logements publiés dans votre quartier. Voulez-vous les voir ?" },
      { badge: RE_BADGE, body: "🔑 Nouvelle location à Sant Cugat\n2 pièces · 70 m² · 1 200 €/mois", image: "/house-2.jpg" },
      { badge: RE_BADGE, body: "📈 Votre quartier est très demandé. Estimez votre logement gratuitement !" },
    ],
    ca: [
      { badge: RE_BADGE, body: "🏡 Nou habitatge a Gràcia\n3 habitacions · 85 m² · lluminós · 320.000 €", image: "/house-1.jpg" },
      { badge: RE_BADGE, body: "📉 Baixada de preu! L'àtic que vas veure ara a 280.000 €." },
      { badge: RE_BADGE, body: "🔔 5 habitatges nous acabats de publicar a la teva zona. Els vols veure?" },
      { badge: RE_BADGE, body: "🔑 Nou lloguer a Sant Cugat\n2 habitacions · 70 m² · 1.200 €/mes", image: "/house-2.jpg" },
      { badge: RE_BADGE, body: "📈 La teva zona està molt sol·licitada. Valora casa teva gratis!" },
    ],
    de: [
      { badge: RE_BADGE, body: "🏡 Neue Wohnung in Gràcia\n3 Zimmer · 85 m² · hell · 320.000 €", image: "/house-1.jpg" },
      { badge: RE_BADGE, body: "📉 Preissenkung! Das Penthouse, das du gesehen hast, jetzt für 280.000 €." },
      { badge: RE_BADGE, body: "🔔 5 neue Wohnungen in deiner Gegend veröffentlicht. Möchtest du sie sehen?" },
      { badge: RE_BADGE, body: "🔑 Neue Mietwohnung in Sant Cugat\n2 Zimmer · 70 m² · 1.200 €/Monat", image: "/house-2.jpg" },
      { badge: RE_BADGE, body: "📈 Deine Gegend ist sehr gefragt. Bewerte dein Zuhause kostenlos!" },
    ],
  },
}

function resolveDemoPushCases(slug: string, lang: string): PushDemoCase[] {
  const brand = PUSH_CASES_I18N[slug] ?? PUSH_CASES_I18N.demowash
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
  const pushCases = useMemo(() => resolveDemoPushCases(slug, lang), [slug, lang])

  const [demo, setDemo] = useState<ResolvedDemo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // 📣 Each click increments this → the ChatWidget fires the next promo push
  // (and shows a clickable notification above its icon when closed).
  const [pushTrigger, setPushTrigger] = useState(0)

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
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-start">
            <Link
              to="/contact"
              className={`inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold ${brand.contactBtn} shadow-lg transition active:scale-[0.98]`}
            >
              ✉️ {t.contact}
            </Link>

            {/* 📣 Demo-only: simulate a promotional push. Lives OUTSIDE the chat
                on purpose — clicking it makes a clickable notification pop above
                the WhatsApp icon (close the chat first to see it), proving the
                push arrives from outside the conversation. */}
            {demo && pushCases.length > 0 && (
              <button
                type="button"
                onClick={() => setPushTrigger((n) => n + 1)}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-amber-300 bg-amber-50/95 px-6 py-3 text-sm font-semibold text-amber-700 shadow-lg transition hover:bg-amber-100 active:scale-[0.98]"
              >
                {t.pushBtn}
              </button>
            )}
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
          pushDemoCases={pushCases}
          pushTrigger={pushTrigger}
        />
      )}
    </div>
  )
}

export default DemoWidgetPage
