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
            Live demo
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            <span className="text-white">Demo</span>
            <span className="text-emerald-300">Wash</span>
          </h1>
          <p className="mt-4 hidden text-lg leading-relaxed text-emerald-50/90 sm:block sm:text-xl">
            Try our WhatsApp AI assistant live — just start chatting, exactly
            like on WhatsApp. The bot detects your language automatically.
          </p>

          {loading && (
            <div className="mt-8 flex items-center gap-3 text-emerald-50">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-white" />
              Loading the assistant…
            </div>
          )}

          {error && (
            <div className="mt-8 rounded-2xl border border-red-300/40 bg-red-500/15 px-5 py-4 text-left text-sm text-red-50 backdrop-blur">
              <p className="font-semibold">Demo unavailable</p>
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
        />
      )}
    </div>
  )
}

export default DemoWidgetPage
