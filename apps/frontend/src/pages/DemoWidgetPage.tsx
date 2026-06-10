/**
 * DemoWidgetPage
 *
 * Public, standalone "try it" page served at /demo/<slug> (e.g. /demo/demowash).
 * It resolves the demo workspace from the chatbot slug and renders the real
 * embeddable ChatWidget pointed at that workspace, so a visitor can talk to the
 * live chatbot exactly as a customer would — including the registration form
 * that asks for name, phone and language before the first message.
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

// ── Demo intro copy, localized to the visitor's browser language ─────────────
// This public page deliberately avoids the app-wide LanguageContext so it stays
// self-contained in production. We read navigator.language and pick the matching
// copy, falling back to English for any unsupported language. The "Try, for
// example" items keep their leading emoji inside the string.
interface DemoIntroCopy {
  liveDemo: string
  intro: string
  tryFor: string
  items: string[]
  loading: string
  unavailable: string
}

const DEMO_INTRO_I18N: Record<string, DemoIntroCopy> = {
  en: {
    liveDemo: "Live demo",
    intro:
      "Try our WhatsApp AI assistant live — just start chatting, exactly like on WhatsApp. The bot detects your language automatically.",
    tryFor: "Try, for example:",
    items: [
      "📅 Book an appointment",
      "💶 Ask for prices and opening hours",
      "🧺 Report that a washing machine isn't working",
      "🎤 Send a voice message",
      "🙋 Ask to talk to a human operator",
      "🌍 Switch language mid-conversation",
    ],
    loading: "Loading the assistant…",
    unavailable: "Demo unavailable",
  },
  it: {
    liveDemo: "Demo dal vivo",
    intro:
      "Prova dal vivo il nostro assistente AI su WhatsApp — inizia semplicemente a scrivere, esattamente come su WhatsApp. Il bot rileva la tua lingua automaticamente.",
    tryFor: "Prova, per esempio:",
    items: [
      "📅 Prenota un appuntamento",
      "💶 Chiedi prezzi e orari di apertura",
      "🧺 Segnala che una lavatrice non funziona",
      "🎤 Invia un messaggio vocale",
      "🙋 Chiedi di parlare con un operatore",
      "🌍 Cambia lingua durante la conversazione",
    ],
    loading: "Caricamento dell'assistente…",
    unavailable: "Demo non disponibile",
  },
  es: {
    liveDemo: "Demo en vivo",
    intro:
      "Prueba en vivo nuestro asistente de IA en WhatsApp — empieza a escribir, igual que en WhatsApp. El bot detecta tu idioma automáticamente.",
    tryFor: "Prueba, por ejemplo:",
    items: [
      "📅 Reserva una cita",
      "💶 Pregunta precios y horarios de apertura",
      "🧺 Informa de que una lavadora no funciona",
      "🎤 Envía un mensaje de voz",
      "🙋 Pide hablar con un operador",
      "🌍 Cambia de idioma durante la conversación",
    ],
    loading: "Cargando el asistente…",
    unavailable: "Demo no disponible",
  },
  fr: {
    liveDemo: "Démo en direct",
    intro:
      "Essayez en direct notre assistant IA sur WhatsApp — commencez simplement à écrire, exactement comme sur WhatsApp. Le bot détecte votre langue automatiquement.",
    tryFor: "Essayez, par exemple :",
    items: [
      "📅 Prendre un rendez-vous",
      "💶 Demander les prix et les horaires d'ouverture",
      "🧺 Signaler qu'un lave-linge ne fonctionne pas",
      "🎤 Envoyer un message vocal",
      "🙋 Demander à parler à un opérateur",
      "🌍 Changer de langue en cours de conversation",
    ],
    loading: "Chargement de l'assistant…",
    unavailable: "Démo indisponible",
  },
  pt: {
    liveDemo: "Demo ao vivo",
    intro:
      "Experimente ao vivo o nosso assistente de IA no WhatsApp — comece a escrever, tal como no WhatsApp. O bot deteta o seu idioma automaticamente.",
    tryFor: "Experimente, por exemplo:",
    items: [
      "📅 Marcar um agendamento",
      "💶 Perguntar preços e horários de funcionamento",
      "🧺 Avisar que uma máquina de lavar não funciona",
      "🎤 Enviar uma mensagem de voz",
      "🙋 Pedir para falar com um operador",
      "🌍 Mudar de idioma durante a conversa",
    ],
    loading: "A carregar o assistente…",
    unavailable: "Demo indisponível",
  },
  ca: {
    liveDemo: "Demo en directe",
    intro:
      "Prova en directe el nostre assistent d'IA a WhatsApp — comença a escriure, igual que a WhatsApp. El bot detecta el teu idioma automàticament.",
    tryFor: "Prova, per exemple:",
    items: [
      "📅 Reserva una cita",
      "💶 Pregunta preus i horaris d'obertura",
      "🧺 Informa que una rentadora no funciona",
      "🎤 Envia un missatge de veu",
      "🙋 Demana parlar amb un operador",
      "🌍 Canvia d'idioma durant la conversa",
    ],
    loading: "Carregant l'assistent…",
    unavailable: "Demo no disponible",
  },
  de: {
    liveDemo: "Live-Demo",
    intro:
      "Teste unseren WhatsApp-KI-Assistenten live — schreib einfach los, genau wie in WhatsApp. Der Bot erkennt deine Sprache automatisch.",
    tryFor: "Probier zum Beispiel:",
    items: [
      "📅 Einen Termin buchen",
      "💶 Nach Preisen und Öffnungszeiten fragen",
      "🧺 Melden, dass eine Waschmaschine nicht funktioniert",
      "🎤 Eine Sprachnachricht senden",
      "🙋 Mit einem Mitarbeiter sprechen",
      "🌍 Mitten im Gespräch die Sprache wechseln",
    ],
    loading: "Assistent wird geladen…",
    unavailable: "Demo nicht verfügbar",
  },
}

// Resolve the intro copy from the browser language (e.g. "it-IT" → "it"),
// falling back to English for any language we don't translate.
function resolveDemoIntro(): DemoIntroCopy {
  const raw =
    typeof navigator !== "undefined" ? navigator.language || "en" : "en"
  const lang = raw.slice(0, 2).toLowerCase()
  return DEMO_INTRO_I18N[lang] || DEMO_INTRO_I18N.en
}

export function DemoWidgetPage() {
  // Slug comes from the route param. The route is declared as /demo/demowash/*
  // so we also fall back to parsing the pathname for nested matches.
  const params = useParams()
  const slug = useMemo(() => {
    if (params.slug) return params.slug.toLowerCase()
    const m = window.location.pathname.match(/^\/demo\/([a-z0-9-]+)/)
    return (m?.[1] || "").toLowerCase()
  }, [params.slug])

  const apiUrl = useMemo(() => getApiBaseUrl(), [])

  // Intro copy localized to the visitor's browser language (English fallback).
  const t = useMemo(() => resolveDemoIntro(), [])

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
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900">
      {/* Decorative blurred blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />

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
        <span className="text-emerald-300">.AI</span>
      </a>

      {/* Hero copy */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center sm:items-start sm:px-16 sm:text-left">
        <div className="max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-emerald-50 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            {t.liveDemo}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            <span className="text-white">Demo</span>
            <span className="text-emerald-300">Wash</span>
          </h1>
          <p className="mt-4 hidden text-lg leading-relaxed text-emerald-50/90 sm:block sm:text-xl">
            {t.intro}
          </p>

          {/* Suggested things to try in the demo — guides the visitor. */}
          <div className="mt-6 hidden sm:block">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
              {t.tryFor}
            </p>
            <ul className="mt-3 flex max-w-md flex-col gap-2 text-left text-base text-emerald-50/90">
              {t.items.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {loading && (
            <div className="mt-8 flex items-center gap-3 text-emerald-50">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-white" />
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
            <p className="mt-8 hidden items-center gap-2 text-sm text-emerald-100/80 sm:flex">
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
          icon="whatsapp"
          title={demo.workspaceName || "Chat with us 💬"}
          primaryColor="#25D366"
          position="bottom-right"
          welcomeVideoUrl={demo.welcomeVideoUrl || undefined}
        />
      )}
    </div>
  )
}

export default DemoWidgetPage
