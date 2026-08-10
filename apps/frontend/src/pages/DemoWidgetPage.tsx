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
 *   talks to the backend through RELATIVE paths (`/api/v1/playground/...`).
 *   Those broke in production, so this page (and the widget it renders) always
 *   uses the ABSOLUTE API base below and works the same in dev and in prod.
 *   That base is www.echatbot.ai — the backend serves the API from the same
 *   host as the frontend, and api.echatbot.ai does NOT resolve.
 */
import { Fragment, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
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
  // Same host as the frontend: api.echatbot.ai does not resolve.
  return "https://www.echatbot.ai/api/v1"
}

interface ResolvedDemo {
  workspaceId: string
  workspaceName: string
  chatbotId: string
  // Live content counts for the feature table's Qty column (see resolveDemo).
  faqCount?: number
  flowCount?: number
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
  spinner: string
  loadingText: string
  openHint: string
  // When set, the page copy is forced to this language instead of following
  // the visitor's browser language (demorobot must always show English).
  pageLang?: string
  // When set, the resolve-demo lookup uses this customChatbotId instead of the
  // URL slug (demorobot resolves to the "demoam" workspace since 2026-08-06,
  // when the old demorobot workspace was deleted).
  chatbotId?: string
  // Optional widget-config override. When present, the page does NOT render the
  // React <ChatWidget>: it loads the REAL production embed snippet instead
  // (window.eChatbotConfig + /widget.js), exactly as a customer's website
  // would — so the actual embed code is what gets verified on this page.
  widget?: {
    title: string
    icon: string
    language?: string
    logoUrl?: string
    useChannelLogo?: boolean
  }
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
    spinner: "border-emerald-200 border-t-white",
    loadingText: "text-emerald-50",
    openHint: "text-emerald-100/80",
  },
  // Demobeauty — beauty-center franchise. Same WhatsApp-green branding; only the
  // wordmark ("beauty") and monogram ("DB") differ.
  demobeauty: {
    titleA: "Demo",
    titleB: "beauty",
    monogram: "DB",
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
    spinner: "border-emerald-200 border-t-white",
    loadingText: "text-emerald-50",
    openHint: "text-emerald-100/80",
  },
  // DemoRobot — STORM robotic-lawnmower support. Same emerald page styling; the
  // WIDGET however is loaded via the real embed snippet with the production
  // config for this workspace (sparkles icon + channel logo + #3aad38).
  demorobot: {
    titleA: "Demo",
    titleB: "Robot",
    monogram: "DR",
    chatbotId: "demoam",
    primaryColor: "#3aad38",
    pageGradient: "from-emerald-600 via-emerald-700 to-emerald-900",
    blob1: "bg-emerald-400/30",
    blob2: "bg-teal-300/20",
    accentText: "text-emerald-300",
    badge: "bg-white/10 text-emerald-50",
    dot: "bg-emerald-300",
    introText: "text-emerald-50/90",
    tryLabel: "text-emerald-200",
    itemsText: "text-emerald-50/90",
    spinner: "border-emerald-200 border-t-white",
    loadingText: "text-emerald-50",
    openHint: "text-emerald-100/80",
    pageLang: "en",
    widget: {
      title: "Chat with us",
      icon: "sparkles",
      language: "en",
      logoUrl:
        "https://res.cloudinary.com/dpagtnf1i/image/upload/v1785492466/echatbot/users/temp_1785492466207_2o889c_ptdrs1.jpg",
      useChannelLogo: true,
    },
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
    pushBtn: "📣 Push message (in the customer's language)",
  },
  it: {
    liveDemo: "Demo dal vivo",
    intro:
      "Prova dal vivo il nostro assistente AI su WhatsApp — inizia semplicemente a scrivere, esattamente come su WhatsApp. Il bot rileva la tua lingua automaticamente.",
    tryFor: "Prova, per esempio:",
    loading: "Caricamento dell'assistente…",
    unavailable: "Demo non disponibile",
    pushBtn: "📣 Push message (nella lingua del cliente)",
  },
  es: {
    liveDemo: "Demo en vivo",
    intro:
      "Prueba en vivo nuestro asistente de IA en WhatsApp — empieza a escribir, igual que en WhatsApp. El bot detecta tu idioma automáticamente.",
    tryFor: "Prueba, por ejemplo:",
    loading: "Cargando el asistente…",
    unavailable: "Demo no disponible",
    pushBtn: "📣 Push message (en el idioma del cliente)",
  },
  fr: {
    liveDemo: "Démo en direct",
    intro:
      "Essayez en direct notre assistant IA sur WhatsApp — commencez simplement à écrire, exactement comme sur WhatsApp. Le bot détecte votre langue automatiquement.",
    tryFor: "Essayez, par exemple :",
    loading: "Chargement de l'assistant…",
    unavailable: "Démo indisponible",
    pushBtn: "📣 Push message (dans la langue du client)",
  },
  ca: {
    liveDemo: "Demo en directe",
    intro:
      "Prova en directe el nostre assistent d'IA a WhatsApp — comença a escriure, igual que a WhatsApp. El bot detecta el teu idioma automàticament.",
    tryFor: "Prova, per exemple:",
    loading: "Carregant l'assistent…",
    unavailable: "Demo no disponible",
    pushBtn: "📣 Push message (en l'idioma del client)",
  },
  de: {
    liveDemo: "Live-Demo",
    intro:
      "Teste unseren WhatsApp-KI-Assistenten live — schreib einfach los, genau wie in WhatsApp. Der Bot erkennt deine Sprache automatisch.",
    tryFor: "Probier zum Beispiel:",
    loading: "Assistent wird geladen…",
    unavailable: "Demo nicht verfügbar",
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
  demobeauty: {
    en: [
      "💆‍♀️ Ask which treatments and prices are available",
      "📍 Choose a center (Navigli, Isola, Monza)",
      "📅 Book a facial and a manicure for Friday",
      "💅 Add gel polish and see the new total",
      "🛍️ Add a product to your cart for pickup",
      "🙋 Ask to talk to a human operator",
    ],
    it: [
      "💆‍♀️ Chiedi quali trattamenti e prezzi sono disponibili",
      "📍 Scegli un centro (Navigli, Isola, Monza)",
      "📅 Prenota pulizia viso e manicure per venerdì",
      "💅 Aggiungi il semipermanente e guarda il nuovo totale",
      "🛍️ Aggiungi un prodotto al carrello da ritirare",
      "🙋 Chiedi di parlare con un operatore",
    ],
    es: [
      "💆‍♀️ Pregunta qué tratamientos y precios hay",
      "📍 Elige un centro (Navigli, Isola, Monza)",
      "📅 Reserva una limpieza facial y una manicura para el viernes",
      "💅 Añade el semipermanente y mira el nuevo total",
      "🛍️ Añade un producto al carrito para recoger",
      "🙋 Pide hablar con un operador",
    ],
    fr: [
      "💆‍♀️ Demande quels soins et tarifs sont disponibles",
      "📍 Choisis un centre (Navigli, Isola, Monza)",
      "📅 Réserve un soin du visage et une manucure pour vendredi",
      "💅 Ajoute le vernis semi-permanent et vois le nouveau total",
      "🛍️ Ajoute un produit au panier à retirer",
      "🙋 Demande à parler à un opérateur",
    ],
    ca: [
      "💆‍♀️ Pregunta quins tractaments i preus hi ha",
      "📍 Tria un centre (Navigli, Isola, Monza)",
      "📅 Reserva una neteja facial i una manicura per divendres",
      "💅 Afegeix el semipermanent i mira el nou total",
      "🛍️ Afegeix un producte al carret per recollir",
      "🙋 Demana parlar amb un operador",
    ],
    de: [
      "💆‍♀️ Frag nach Behandlungen und Preisen",
      "📍 Wähle ein Studio (Navigli, Isola, Monza)",
      "📅 Buche eine Gesichtsbehandlung und Maniküre für Freitag",
      "💅 Füge Gel-Lack hinzu und sieh die neue Summe",
      "🛍️ Lege ein Produkt zum Abholen in den Warenkorb",
      "🙋 Mit einem Mitarbeiter sprechen",
    ],
  },
  // 2 FAQ + 1 diagnostic flow + operator. Texts talk about a generic robot
  // mower (no brand names): the FAQs are the two Andrea picked from the
  // workspace FAQ list, the problem chip triggers the workspace "ERROR 001"
  // flow. English only — this demo page is forced to English (pageLang).
  demorobot: {
    en: [
      "🧽 Ask how to clean your robot",
      "🌧️ Ask if the robot can work in the rain",
      "⚠️ Say your robot shows ERROR 001 on the display",
      "🙋 Ask to talk to a human operator",
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
const BEAUTY_BADGE = "📣 PROMO · Demobeauty"

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
  demobeauty: {
    en: [
      { badge: BEAUTY_BADGE, body: "✨ New treatment at Navigli: cryolipolysis. First session €120!" },
      { badge: BEAUTY_BADGE, body: "💅 New product: Night Retinol Serum 30ml — launch price €42, this week only." },
      { badge: BEAUTY_BADGE, body: "🗓️ Reminder: tomorrow at 5:30pm, facial + gel manicure with Elena (Navigli)." },
      { badge: BEAUTY_BADGE, body: "🎁 Bring a friend: you both get -20% on your next treatment!" },
      { badge: BEAUTY_BADGE, body: "📣 New center now open in Monza! Come try it with a free skin check-up." },
    ],
    it: [
      { badge: BEAUTY_BADGE, body: "✨ Nuovo trattamento a Navigli: criolipolisi. Prima seduta 120€!" },
      { badge: BEAUTY_BADGE, body: "💅 Nuovo prodotto: Siero Retinolo Notte 30ml — prezzo lancio 42€, solo questa settimana." },
      { badge: BEAUTY_BADGE, body: "🗓️ Promemoria: domani alle 17:30, pulizia viso + semipermanente con Elena (Navigli)." },
      { badge: BEAUTY_BADGE, body: "🎁 Porta un'amica: per entrambe -20% sul prossimo trattamento!" },
      { badge: BEAUTY_BADGE, body: "📣 Nuova sede a Monza! Vieni a provarla con un check-up cutaneo gratuito." },
    ],
    es: [
      { badge: BEAUTY_BADGE, body: "✨ Nuevo tratamiento en Navigli: criolipólisis. ¡Primera sesión 120€!" },
      { badge: BEAUTY_BADGE, body: "💅 Nuevo producto: Sérum de Retinol Noche 30ml — precio de lanzamiento 42€, solo esta semana." },
      { badge: BEAUTY_BADGE, body: "🗓️ Recordatorio: mañana a las 17:30, limpieza facial + semipermanente con Elena (Navigli)." },
      { badge: BEAUTY_BADGE, body: "🎁 Trae a una amiga: ¡las dos tenéis -20% en el próximo tratamiento!" },
      { badge: BEAUTY_BADGE, body: "📣 ¡Nuevo centro en Monza! Ven a probarlo con un chequeo cutáneo gratis." },
    ],
    fr: [
      { badge: BEAUTY_BADGE, body: "✨ Nouveau soin à Navigli : cryolipolyse. Première séance 120 € !" },
      { badge: BEAUTY_BADGE, body: "💅 Nouveau produit : Sérum Rétinol Nuit 30ml — prix de lancement 42 €, cette semaine seulement." },
      { badge: BEAUTY_BADGE, body: "🗓️ Rappel : demain à 17h30, soin du visage + vernis semi-permanent avec Elena (Navigli)." },
      { badge: BEAUTY_BADGE, body: "🎁 Amenez une amie : -20% chacune sur votre prochain soin !" },
      { badge: BEAUTY_BADGE, body: "📣 Nouveau centre à Monza ! Venez l'essayer avec un bilan de peau gratuit." },
    ],
    ca: [
      { badge: BEAUTY_BADGE, body: "✨ Nou tractament a Navigli: criolipòlisi. Primera sessió 120€!" },
      { badge: BEAUTY_BADGE, body: "💅 Nou producte: Sèrum de Retinol Nit 30ml — preu de llançament 42€, només aquesta setmana." },
      { badge: BEAUTY_BADGE, body: "🗓️ Recordatori: demà a les 17:30, neteja facial + semipermanent amb Elena (Navigli)." },
      { badge: BEAUTY_BADGE, body: "🎁 Porta una amiga: totes dues teniu -20% al pròxim tractament!" },
      { badge: BEAUTY_BADGE, body: "📣 Nou centre a Monza! Vine a provar-lo amb un check-up cutani gratuït." },
    ],
    de: [
      { badge: BEAUTY_BADGE, body: "✨ Neue Behandlung in Navigli: Kryolipolyse. Erste Sitzung 120 €!" },
      { badge: BEAUTY_BADGE, body: "💅 Neues Produkt: Nacht-Retinol-Serum 30ml — Einführungspreis 42 €, nur diese Woche." },
      { badge: BEAUTY_BADGE, body: "🗓️ Erinnerung: morgen um 17:30 Uhr, Gesichtsbehandlung + Gel-Maniküre mit Elena (Navigli)." },
      { badge: BEAUTY_BADGE, body: "🎁 Bring eine Freundin mit: ihr bekommt beide -20% auf die nächste Behandlung!" },
      { badge: BEAUTY_BADGE, body: "📣 Neues Studio in Monza! Komm vorbei mit einem kostenlosen Haut-Check-up." },
    ],
  },
}

// ── Feature status table (demorobot) ─────────────────────────────────────────
// Shown under the hero copy so a visitor sees at a glance what the assistant
// already does and what is still coming. `status` drives the rendering: "done"
// gets a check icon, "todo" a clock, and a plain string is printed as-is (used
// for the supported-languages row).
interface DemoFeature {
  name: string
  description: string
  status: "done" | "in_progress" | "todo" | string
  // Free-text note shown in the Notes column — scope, caveats, what is covered
  // so far (e.g. which languages are live). Left out when there is nothing
  // worth saying; the cell then renders empty.
  note?: string
  // Rough build effort, rendered as a 5-segment bar. Shown on every row that
  // sets one, so delivered work is sized on the same scale as pending work.
  effort?: 1 | 2 | 3 | 4 | 5
  // Price in euro for the single feature, shown in the Price column.
  // "tbd" renders as a question mark: the price is still to be evaluated.
  price?: number | "tbd"
  // Development progress % shown in the Status column. Defaults by status:
  // done 100, in_progress 50, todo 0 — set it to override (e.g. 80).
  progress?: number
}

// Delivery phases. The roadmap is presented as separate blocks so a visitor
// reads it as a sequence rather than one long undifferentiated list: what
// already works today, what comes next, and the bigger builds after that.
interface DemoPhase {
  title: string
  subtitle: string
  features: DemoFeature[]
  // Price in euro for the whole phase, rendered as a closing "Total" row.
  total?: number
  // Flat-rate phase: the total covers everything, so features without their
  // own price render "—" instead of €0.
  flat?: boolean
}

const formatEuro = (amount: number) => `€${amount.toLocaleString("en-US")}`

// Effort bar styling. Green→amber→red reads as "quick" → "significant build";
// the colour carries the meaning at a glance, the tooltip spells it out.
const EFFORT_COLORS: Record<number, string> = {
  1: "bg-emerald-400",
  2: "bg-lime-300",
  3: "bg-amber-300",
  4: "bg-orange-400",
  5: "bg-rose-400",
}

const EFFORT_LABELS: Record<number, string> = {
  1: "Very low effort",
  2: "Low effort",
  3: "Medium effort",
  4: "High effort",
  5: "Very high effort",
}

const DEMO_PHASES: DemoPhase[] = [
  {
    title: "Software",
    subtitle: "Available today — everything you can try right now in this demo.",
    total: 1300,
    flat: true,
    features: [
      {
        name: "Languages",
        description: "Detects the customer's language and replies in it automatically.",
        status: "done",
        note: "English, Danish, German, French, Italian, Spanish",
      },
      {
        name: "AI personality",
        description: "You define the assistant personality",
        status: "done",
        note: "Assistance name, chatbot tone, channel rules, AI models, temperature, escalation rules",
      },
      {
        name: "Welcome message",
        description: "Welcome message in the customer's language.",
        status: "done",
        note: "The first time a customer writes, the chatbot sends the welcome message. If the customer has written before, it sends a welcome back message greeting them by name — so the conversation feels natural.",
      },
      {
        name: "FAQ",
        description: "Answers common questions.",
        status: "done",
        note: 'Try: "How do I clean my robot?" · "Can I fit a second battery?" · "What does the warranty cover?"',
      },
      {
        name: "Flow",
        description: "You define the procedure, the chatbot guides the customer through it step by step.",
        status: "done",
        note: 'Try: "My robot shows ERROR 001" · "It lost a wheel while mowing" · "It no longer cuts the grass evenly"',
      },
      {
        name: "Escalate to Human support",
        description: "Hands the conversation to a real operator and notifies them by email.",
        status: "done",
        note: "If the assistant can't find the answer in FAQ or Flow, the conversation is forwarded to a human operator.",
      },
      {
        name: "Summary for Support",
        description: "When a conversation is handed over, the operator receives a summary of what has been said — no need to reread the whole chat.",
        status: "done",
      },
      {
        name: "Chat history",
        description: "The chatbot remembers previous conversations with each customer and picks up where they left off.",
        status: "done",
        note: "Operators can also review the full conversation history of every customer from the backoffice.",
      },
      {
        name: "Widget",
        description: "Embeddable chat for any website.",
        status: "done",
      },
      {
        name: "Two-way live translation",
        description:
          "Your operators reply in their own language: each message is translated into the customer's language automatically.",
        status: "done",
        price: 0,
      },
      {
        name: "Block spam user",
        description: "Blocked numbers are ignored: no reply, no notification, no cost.",
        status: "done",
        price: 0,
      },
      {
        name: "Speech to text",
        description: "Customers can send voice messages: the chatbot understands them and replies as usual.",
        status: "done",
      },
    ],
  },
  {
    title: "Customizations",
    subtitle: "Tailor-made for you — setup, integrations and adaptations on top of the software.",
    total: 2850,
    features: [
      {
        name: "Installation on-premise",
        description: "Deploys and configures the assistant on the customer's server.",
        status: "todo",
        effort: 5,
        price: 700,
      },
      {
        name: "Loading Context Data",
        description: "We load your FAQs and Flows into the platform from your documents — a dedicated AI assists the process.",
        status: "todo",
        effort: 5,
        price: 400,
      },
      {
        name: "WhatsApp integration (Meta setup)",
        description: "We configure your Meta WhatsApp Business account end to end, so the same assistant answers directly on your WhatsApp business number.",
        status: "todo",
        effort: 4,
        price: 700,
      },
      {
        name: "Security",
        description: "Security analysis directly on your server.",
        status: "todo",
        effort: 4,
        price: 300,
        note: "We take care of your security: we make sure all security best practices are in place.",
      },
      {
        name: "Forward Human Support logic",
        description: "Forwards the conversation to the agent for the customer's country.",
        status: "todo",
        effort: 3,
        price: 300,
        note: "Example: a customer writing in Danish is forwarded to your Danish support team, a German customer to the German one.",
      },
      {
        name: "Ticketing platform Integration",
        description: "Let that the Chabot can interact with the Ticketing platform ",
        status: "todo",
        price: 300,
        effort: 4,
        note: "To be assessed together: the price is an estimate, it depends on the ticketing platform you use.",
      },
      {
        name: "Terms and conditions",
        description: "Shows terms and conditions in the welcome message.",
        status: "todo",
        effort: 1,
        price: 150,
        note: "A link to a page on your website informing the customer about terms and conditions and other privacy rules.",
      },
    ],
  },
  {
    title: "Maybe Later",
    subtitle: "",
    total: 4900,
    features: [
      {
        name: "Sales modules",
        description: "Takes reservations directly in the chat.",
        status: "todo",
        effort: 5,
        price: 1000,
      },
      {
        name: "Push Message",
        description: "Proactive promotions and reminder messages.",
        status: "todo",
        effort: 5,
        price: 0,
        note: "No setup cost: push messages are billed per use, €1 per message sent.",
      },
      {
        name: "Voice message (evenLabs)",
        description: "Sends and understands voice messages in the chat.",
        status: "todo",
        effort: 3,
        price: 1000,
      },
      {
        name: "Appointment and Calendar",
        description: "Books, moves and cancels appointments against a live calendar.",
        status: "todo",
        effort: 5,
        price: 1000,
      },
      {
        name: "Presentation Video",
        description: "Short video introducing the assistant and how it works.",
        status: "todo",
        effort: 1,
        price: 150,
      },
      {
        name: "Send Images and Documents",
        description: "The chatbot can send images and documents to the customer.",
        status: "todo",
        effort: 5,
        price: 750,
      },
      {
        name: "CRM integration",
        description: "Syncs customers and conversations with your existing CRM.",
        status: "todo",
        effort: 5,
        price: 1000,
      },
    ],
  },
]

function resolveDemoPushCases(slug: string, lang: string): PushDemoCase[] {
  const brand = PUSH_CASES_I18N[slug] ?? PUSH_CASES_I18N.demowash
  return brand[lang] || brand.en
}

// Full per-language push map for a brand. Passed to ChatWidget so the promo is
// shown in the language the BOT is replying in (the conversation language),
// not the browser language.
function resolveDemoPushCasesByLang(slug: string): Record<string, PushDemoCase[]> {
  return PUSH_CASES_I18N[slug] ?? PUSH_CASES_I18N.demowash
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
  const lang = useMemo(() => brand.pageLang ?? resolveLang(), [brand])
  const t = useMemo(() => resolveDemoIntro(lang), [lang])
  const items = useMemo(() => resolveDemoItems(slug, lang), [slug, lang])
  const pushCases = useMemo(() => resolveDemoPushCases(slug, lang), [slug, lang])
  const pushCasesByLang = useMemo(() => resolveDemoPushCasesByLang(slug), [slug])

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
    fetch(`${apiUrl}/playground/resolve-demo/${brand.chatbotId ?? slug}`)
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
  }, [apiUrl, slug, brand.chatbotId])

  // ── Real-embed mode ────────────────────────────────────────────────────────
  // Brands with a `widget` config (demorobot) load the widget through the REAL
  // production embed snippet — window.eChatbotConfig + /widget.js — exactly as
  // a customer's website would, so this page verifies the actual embed code.
  // Only the workspaceId differs from the customer snippet: it is resolved at
  // runtime from the slug, so the same code works in dev and in production.
  // The other brands keep rendering the React <ChatWidget> directly (unchanged).
  useEffect(() => {
    if (!brand.widget || !demo) return
    const w = window as unknown as {
      eChatbotConfig?: Record<string, unknown>
      _eChatbotWidget?: { destroy?: () => void }
    }
    w.eChatbotConfig = {
      workspaceId: demo.workspaceId,
      position: "bottom-right",
      title: brand.widget.title,
      primaryColor: brand.primaryColor,
      icon: brand.widget.icon,
      language: brand.widget.language,
      useChannelLogo: brand.widget.useChannelLogo,
      logoUrl: brand.widget.logoUrl,
      // Demo page: land straight on the chat, no launcher bubble to click and
      // no dimming overlay over the page copy.
      openByDefault: true,
    }
    // Same-origin script: /widget.js is served by this frontend in dev and prod.
    const script = document.createElement("script")
    script.src = "/widget.js"
    script.async = true
    document.body.appendChild(script)
    return () => {
      w._eChatbotWidget?.destroy?.()
      delete w._eChatbotWidget
      delete w.eChatbotConfig
      script.remove()
    }
  }, [brand, demo])

  return (
    <div className={`relative h-[100dvh] w-full overflow-hidden bg-gradient-to-br ${brand.pageGradient}`}>
      {/* Decorative blurred blobs */}
      <div className={`pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full ${brand.blob1} blur-3xl`} />
      <div className={`pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full ${brand.blob2} blur-3xl`} />

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
      {/* justify-center only while the copy fits: `my-auto` on the inner column
          centers it on tall screens and lets it scroll on short ones instead of
          being clipped (the feature table makes the column tall). */}
      <div className="relative z-10 flex h-full flex-col items-center overflow-y-auto px-6 py-12 text-center sm:items-start sm:px-16 sm:text-left">
        <div className="w-full max-w-6xl">
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

          {/* Feature status table — what the assistant already does vs. what is
              still coming. Only on demorobot, where the list applies. */}
          {slug === "demorobot" && (
            <div className="mt-7 w-full">
              {/* Pricing model — the one-time bundle (mapping to the phase
                  below) plus metered usage. */}
              <div className="mb-12">
                <span className={`block text-xl font-extrabold tracking-tight sm:text-2xl ${brand.itemsText}`}>
                  Pricing model
                </span>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/10 p-5 backdrop-blur">
                    <span className={`block text-sm font-semibold uppercase tracking-wide ${brand.tryLabel}`}>
                      Software + Customizations
                    </span>
                    <span className={`mt-2 block text-2xl font-extrabold ${brand.itemsText}`}>
                      €3,500
                    </span>
                    <span className={`mt-2 block text-sm leading-snug ${brand.openHint}`}>
                      One-time. The assistant with the whole basic functionality
                      already working today, plus everything tailor-made for
                      you: on-premise installation, loading your data and the
                      modules you pick.
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/10 p-5 backdrop-blur">
                    <span className={`block text-sm font-semibold uppercase tracking-wide ${brand.tryLabel}`}>
                      Monthly fee + usage
                    </span>
                    <span className={`mt-2 block text-xl font-extrabold ${brand.itemsText}`}>
                      €90/month + €0.05/message
                    </span>
                    <span className={`mt-2 block text-sm leading-snug ${brand.openHint}`}>
                      Hosting of the AI gateway, updates, monitoring and
                      support, plus what the assistant actually works.
                    </span>
                  </div>
                </div>
              </div>
              <table className="w-full border-collapse text-left text-base">
                <tbody>
                  {DEMO_PHASES.map((phase) => (
                  <Fragment key={phase.title}>
                    {/* Phase separator — turns the roadmap into readable
                        blocks instead of one long list. */}
                    <tr className="border-b border-white/20">
                      <td colSpan={5} className="pb-3 pt-7">
                        <span className={`block text-xl font-extrabold tracking-tight sm:text-2xl ${brand.itemsText}`}>
                          {phase.title}
                        </span>
                        {phase.subtitle && (
                          <span className={`mt-1 block text-base leading-snug ${brand.openHint}`}>
                            {phase.subtitle}
                          </span>
                        )}
                      </td>
                    </tr>
                    {/* Column header repeated per phase, so every block reads
                        as a self-contained table. */}
                    <tr className={`border-b border-white/25 ${brand.tryLabel}`}>
                      <th className="py-2 pr-4 text-sm font-semibold uppercase tracking-wide">
                        Feature
                      </th>
                      <th className="py-2 pr-4 text-sm font-semibold uppercase tracking-wide">
                        Status
                      </th>
                      <th className="py-2 pr-4 text-sm font-semibold uppercase tracking-wide">
                        Effort
                      </th>
                      <th className="py-2 pr-4 text-sm font-semibold uppercase tracking-wide">
                        Price
                      </th>
                      <th className="py-2 text-sm font-semibold uppercase tracking-wide">
                        Notes
                      </th>
                    </tr>
                    {phase.features.map((feature) => (
                    <tr key={feature.name} className="border-b border-white/10 align-top">
                      {/* Name + one-line description of what the feature does. */}
                      <td className="py-2.5 pr-4">
                        <span className={`font-medium ${brand.itemsText}`}>{feature.name}</span>
                        <span className={`mt-0.5 block text-sm leading-snug ${brand.openHint}`}>
                          {feature.description}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-4">
                        {feature.status === "done" ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
                            ✅ {feature.progress ?? 100}%
                          </span>
                        ) : feature.status === "in_progress" ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-sky-300">
                            🚧 {feature.progress ?? 50}%
                          </span>
                        ) : feature.status === "todo" ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-amber-200/90">
                            🕒 {feature.progress ?? 0}%
                          </span>
                        ) : (
                          <span className={brand.itemsText}>{feature.status}</span>
                        )}
                      </td>
                      {/* Effort bar — 5 segments, filled up to `effort`. Shown
                          on any row that declares one, so the work already done
                          is sized on the same scale as what is still pending. */}
                      <td className="whitespace-nowrap py-2.5 pr-4">
                        {feature.effort ? (
                          <span
                            className="inline-flex items-center gap-[3px] align-middle"
                            title={EFFORT_LABELS[feature.effort]}
                            aria-label={`Effort: ${EFFORT_LABELS[feature.effort]}`}
                          >
                            {[1, 2, 3, 4, 5].map((segment) => (
                              <span
                                key={segment}
                                className={`block h-3.5 w-2 rounded-sm ${
                                  segment <= feature.effort!
                                    ? EFFORT_COLORS[feature.effort!]
                                    : "bg-white/15"
                                }`}
                              />
                            ))}
                          </span>
                        ) : null}
                      </td>
                      {/* Price — per-feature cost, when quoted. */}
                      <td className={`whitespace-nowrap py-2.5 pr-4 font-medium ${brand.itemsText}`}>
                        {feature.price === "tbd"
                          ? "❓"
                          : phase.flat && !feature.price
                            ? "—"
                            : formatEuro(feature.price ?? 0)}
                      </td>
                      {/* Notes — free-text scope/caveat for the feature. */}
                      <td className={`py-2.5 text-sm leading-snug ${brand.openHint}`}>
                        {feature.note ?? ""}
                      </td>
                    </tr>
                    ))}
                    {/* Phase total — closing price row for the whole block. */}
                    {phase.total && (
                      <tr className="border-b border-white/20">
                        <td
                          colSpan={3}
                          className={`py-3 pr-4 font-extrabold ${brand.itemsText}`}
                        >
                          Total
                        </td>
                        <td
                          className={`whitespace-nowrap py-3 pr-4 text-lg font-extrabold ${brand.itemsText}`}
                        >
                          {formatEuro(phase.total)}
                        </td>
                        <td />
                      </tr>
                    )}
                  </Fragment>
                  ))}
                  {/* Grand total — sum of every phase total, computed so it
                      never drifts when a single phase price changes. */}
                  <tr>
                    <td
                      colSpan={3}
                      className={`py-4 pr-4 text-lg font-extrabold ${brand.itemsText}`}
                    >
                      Grand total
                    </td>
                    <td
                      className={`whitespace-nowrap py-4 pr-4 text-xl font-extrabold ${brand.itemsText}`}
                    >
                      {formatEuro(
                        DEMO_PHASES.reduce((sum, p) => sum + (p.total ?? 0), 0)
                      )}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>

            </div>
          )}

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-start">
            {/* 📣 Demo-only: simulate a promotional push. Lives OUTSIDE the chat
                on purpose — clicking it makes a clickable notification pop above
                the WhatsApp icon (close the chat first to see it), proving the
                push arrives from outside the conversation. */}
            {/* Hidden in real-embed mode: the push injection needs the React
                ChatWidget; the iframe embed cannot receive it. */}
            {demo && !brand.widget && pushCases.length > 0 && (
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

        </div>
      </div>

      {/* The real widget, opened by default so the visitor lands on the form.
          Skipped in real-embed mode: there the widget is mounted by /widget.js
          (see the embed useEffect above), not by React. */}
      {demo && !brand.widget && (
        <ChatWidget
          workspaceId={demo.workspaceId}
          apiUrl={apiUrl}
          useWindowConfig={false}
          defaultOpen
          instantChat
          hideWorkspaceName
          plainWhatsappNumber
          whatsappBadge
          feedbackBoardSlug={slug}
          icon="whatsapp"
          monogram={brand.monogram}
          title={`${brand.titleA}${brand.titleB}`}
          primaryColor={brand.primaryColor}
          position="bottom-right"
          pushDemoCases={pushCases}
          pushDemoCasesByLang={pushCasesByLang}
          pushTrigger={pushTrigger}
        />
      )}
    </div>
  )
}

export default DemoWidgetPage
