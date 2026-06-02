import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd"
import {
  ArrowLeft,
  Check,
  Info,
  KanbanSquare,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MessageAttachments } from "@/components/chat/MessageAttachments"
import ReactMarkdown from "react-markdown"
import {
  Link,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom"
import rehypeHighlight from "rehype-highlight"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import "highlight.js/styles/github.css"

const API_BASE = "/api/v1/playground"

async function playFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("playgroundToken")
  const workspaceId = localStorage.getItem("playgroundWorkspaceId")
  
  if (token || workspaceId) {
    const headers = new Headers(init?.headers)
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`)
    }
    if (workspaceId && !headers.has("x-workspace-id")) {
      headers.set("x-workspace-id", workspaceId)
    }
    return fetch(input, {
      ...init,
      headers,
    })
  }
  return fetch(input, init)
}
// Background refresh: rare. The chat refetches explicitly after sending,
// and the kanban refetches after a drag. The interval is just a safety net
// for changes done in another tab (e.g. another collaborator edits a TODO).
const POLL_INTERVAL = 30000
const MIN_BOT_LOADING_MS = 1400

// Each playground user is bound to one demo workspace. On successful login
// the LoginScreen redirects to that demo's URL (/demo/<slug>), where the
// existing slug-based resolver picks up the right workspaceId from the
// backend and rewrites localStorage.
const ALLOWED_USERS = {
  ANDREA: { password: "Admin123", color: "#2563eb", demoSlug: "ecolaundry" },
  OLGA: { password: "Admin123", color: "#db2777", demoSlug: "ecolaundry" },
  demo: { password: "Admin123", color: "#059669", demoSlug: "demowash" },
} as const
type PlaygroundUser = keyof typeof ALLOWED_USERS

const STATUS_COLUMNS: { id: TodoStatus; title: string; headerBg: string; bg: string }[] = [
  { id: "TODO", title: "TODO", headerBg: "bg-slate-200", bg: "bg-slate-50" },
  { id: "IN_PROGRESS", title: "IN PROGRESS", headerBg: "bg-blue-200", bg: "bg-blue-50" },
  { id: "REVIEW", title: "REVIEW", headerBg: "bg-yellow-200", bg: "bg-yellow-50" },
  { id: "DONE", title: "DONE", headerBg: "bg-green-200", bg: "bg-green-50" },
  { id: "NICE_TO_HAVE", title: "VER 2", headerBg: "bg-purple-200", bg: "bg-purple-50" },
]

type TodoStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "NICE_TO_HAVE"
type Priority = "Alto" | "Medio" | "Basso"

type Comment = {
  id: string
  todoId: string
  commentText: string
  createdBy: string
  color: string | null
  createdAt: string
}

type Todo = {
  id: string
  workspaceId: string
  dialogId: string
  messageType: "chatbot" | "human"
  messageContent: string
  chatbotResponse: string | null
  commentTitle: string
  priority: Priority
  status: TodoStatus
  position: number
  createdBy: string
  createdAt: string
  updatedAt: string
  comments: Comment[]
}

type ChatMessage = {
  id: string
  direction: "INBOUND" | "OUTBOUND"
  content: string
  type: string
  createdAt: string
  aiGenerated: boolean
  chatSessionId: string
  attachments?: Array<{
    id: string
    url: string
    kind: "IMAGE" | "DOCUMENT"
    mimeType: string
    filename?: string | null
    sizeBytes?: number
  }>
}

type ChatSession = {
  id: string
  customer: { id: string; name: string | null; phone: string | null }
  messages: ChatMessage[]
}

// ── Local-only chat metadata (demo, not persisted to backend) ────────────────
// Chat title overrides + per-CHAT feedback live in localStorage so the
// playground can display them without a backend column. When the data model
// graduates to production, these maps move to the ChatSession columns.

type Feedback = "like" | "dislike"

const TITLE_STORAGE_KEY = "ecolaundry-demo-chat-titles"
const FEEDBACK_STORAGE_KEY = "ecolaundry-demo-chat-feedback"
const ORDER_STORAGE_KEY = "ecolaundry-demo-chat-order"

function readJsonArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

function writeJsonArray(key: string, value: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded — ignore, demo overlay */
  }
}

function readJsonMap<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, T>) : {}
  } catch {
    return {}
  }
}

function writeJsonMap<T>(key: string, value: Record<string, T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded or storage disabled — ignore, this is a demo overlay */
  }
}

const PRIORITY_COLOR: Record<Priority, string> = {
  Alto: "bg-red-100 text-red-700 border-red-300",
  Medio: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Basso: "bg-green-100 text-green-700 border-green-300",
}

// Bot replies are authored in markdown (the JSON flow prompts use
// `**bold**` for program names like **60º**, **40º**, etc.). The
// playground must render them as actual bold, not show the literal
// asterisks. Customer messages stay as plain text — customers don't
// type markdown and we don't want to interpret it.
//
// We strip the default `<p>` margins so paragraphs flow tightly inside
// the chat bubble, and add a small gap between adjacent paragraphs to
// keep the loopback question visually separated from the program list.
function MessageBody({
  content,
  isInbound,
}: {
  content: string
  isInbound: boolean
}) {
  if (isInbound) {
    return <div className="whitespace-pre-wrap">{content}</div>
  }
  return (
    <div className="prose prose-sm max-w-none [&_p]:my-0 [&_p+p]:mt-2 [&_strong]:font-semibold [&_ul]:my-1 [&_ol]:my-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

const HUMAN_SUPPORT_MARKER = "**👤 Human Support message**"

function splitBotMessage(content: string): {
  customer: string
  operator: string | null
} {
  const idx = content.indexOf(HUMAN_SUPPORT_MARKER)
  if (idx === -1) return { customer: content, operator: null }
  return {
    customer: content.slice(0, idx).trimEnd(),
    operator: content.slice(idx),
  }
}

// Three-dot "typing" indicator used in the chat bubble while waiting for
// the bot reply. Pure CSS; no extra deps.
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span
        className="w-2 h-2 rounded-full bg-emerald-700/60 animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-emerald-700/60 animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-emerald-700/60 animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  )
}

// ----------------------------------------------------------------------------
// AUTH
// ----------------------------------------------------------------------------
function useAuth() {
  const [user, setUser] = useState<PlaygroundUser | null>(() => {
    const saved = localStorage.getItem("playgroundUser")
    return saved && ALLOWED_USERS[saved as PlaygroundUser]
      ? (saved as PlaygroundUser)
      : null
  })
  // React-side mirror of `localStorage.playgroundWorkspaceId`. Held as state
  // so screens depending on it (chat list, kanban) can re-render — and
  // re-fetch — once the async `/resolve-demo` lookup completes after a
  // login redirect. Without this, the first paint after login fires the
  // initial fetchAll() with no workspaceId header and the user has to
  // refresh to see their data.
  const [workspaceId, setWorkspaceId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : localStorage.getItem("playgroundWorkspaceId"),
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")
    const workspaceId = params.get("workspaceId")
    const path = window.location.pathname

    // Each /demo/<slug> URL is a fully isolated tenant: its own workspaceId,
    // its own chat history, its own usecases.md, its own users. The slug in
    // the URL is the source of truth — we resolve the corresponding
    // workspaceId from the backend on EVERY mount and overwrite localStorage
    // unconditionally. Otherwise a visitor who first opens /demo/ecolaundry
    // and then /demo/demowash would keep ecolaundry's workspaceId stuck in
    // storage and see ecolaundry's data on the demowash page.
    const demoMatch = path.match(/^\/demo\/([a-z0-9-]+)/)
    const demoSlug = demoMatch?.[1] ?? null
    const previousSlug = localStorage.getItem("playgroundDemoSlug")

    // Pick the default playground user for this demo. Each demo has one or
    // more bound users (defined in ALLOWED_USERS via `demoSlug`); we pick
    // the first one as the "anonymous visitor" identity.
    const defaultUserForSlug = (slug: string | null): PlaygroundUser | null => {
      if (!slug) return null
      const entry = (Object.entries(ALLOWED_USERS) as [PlaygroundUser, { demoSlug: string }][])
        .find(([, cfg]) => cfg.demoSlug === slug)
      return entry?.[0] ?? null
    }

    if (token && workspaceId) {
      // (a) Backoffice → playground via query params: dashboard "Open
      //     playground" link. The token+workspaceId pair wins over the
      //     slug-based resolution. The bound user follows the demo slug
      //     (so demowash gets `demo`, not `ANDREA`).
      const boundUser = defaultUserForSlug(demoSlug) ?? "ANDREA"
      localStorage.setItem("playgroundToken", token)
      localStorage.setItem("playgroundWorkspaceId", workspaceId)
      localStorage.setItem("playgroundUser", boundUser)
      if (demoSlug) localStorage.setItem("playgroundDemoSlug", demoSlug)
      setUser(boundUser)
      setWorkspaceId(workspaceId)
    } else if (demoSlug) {
      // (b) Visitor lands on /demo/<slug> directly (public demo URL).
      //     We auto-sign-in as that demo's bound user so the visitor
      //     skips the login screen, and resolve the workspaceId from the
      //     backend.
      //
      // 🚪 Exception: if the visitor explicitly logged out on this same
      //    URL, DO NOT auto-sign them back in on refresh. The logout
      //    handler sets `playgroundLoggedOut: "1"` to remember the
      //    intent; we honour it here and show the login screen instead.
      //    The flag is cleared by a successful login.
      const loggedOutIntentionally =
        localStorage.getItem("playgroundLoggedOut") === "1"
      if (loggedOutIntentionally) {
        // Make sure no stale identity sneaks back in via other tabs.
        localStorage.removeItem("playgroundToken")
        localStorage.removeItem("playgroundWorkspaceId")
        localStorage.removeItem("playgroundUser")
        return
      }
      if (previousSlug !== demoSlug) {
        // Coming from a different demo (or first visit): drop any stale
        // token/workspaceId from the previous tenant — they are bound to
        // a specific workspace and would not authenticate against this one.
        localStorage.removeItem("playgroundToken")
        localStorage.removeItem("playgroundWorkspaceId")
      }
      localStorage.setItem("playgroundDemoSlug", demoSlug)
      const boundUser = defaultUserForSlug(demoSlug)
      if (boundUser) {
        localStorage.setItem("playgroundUser", boundUser)
        setUser(boundUser)
      }
      fetch(`/api/v1/playground/resolve-demo/${demoSlug}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.workspaceId) {
            localStorage.setItem("playgroundWorkspaceId", data.workspaceId)
            // Notify the rest of the app: this triggers a re-fetch in
            // ChatScreen so the visitor sees their chats immediately,
            // without having to refresh after the login redirect.
            setWorkspaceId(data.workspaceId)
          }
        })
        .catch(() => {/* silent fail — UI will surface the missing data */})
    }
  }, [])

  const login = (u: PlaygroundUser) => {
    localStorage.setItem("playgroundUser", u)
    // Explicit login clears the "logged out" flag so future refreshes auto-
    // resume normally for this visitor.
    localStorage.removeItem("playgroundLoggedOut")
    setUser(u)
  }
  const logout = () => {
    // Nuke the entire localStorage so the next visitor starts from a fully
    // clean slate — no stale tokens, no leftover chat overlays, no cached
    // "About popup seen" flag, no language preference from the previous
    // user. Anything we add later (analytics opt-in, feature flags, etc.)
    // is wiped automatically without us having to remember to list it here.
    //
    // 🚪 Sticky logout flag: on a public /demo/<slug> URL the mount effect
    //    auto-signs the visitor back in after every refresh. We re-set
    //    `playgroundLoggedOut` AFTER the clear so that effect knows to
    //    honour the logout intent until the visitor explicitly logs in
    //    again.
    localStorage.clear()
    localStorage.setItem("playgroundLoggedOut", "1")
    setUser(null)
    setWorkspaceId(null)
  }
  return { user, workspaceId, login, logout }
}

// Supported usecases languages — kept in sync with the markdown files we
// ship under custom-demowash/usecases_<lang>.md.
const LOGIN_LANG_OPTIONS = [
  { code: "es", label: "Español" },
  { code: "ca", label: "Català" },
  { code: "it", label: "Italiano" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "de", label: "Deutsch" },
] as const

// Localized label for the right-side panel header. Mirrors the 7 supported
// usecases languages so the panel title tracks the language picked at login.
const USE_CASES_LABEL: Record<
  (typeof LOGIN_LANG_OPTIONS)[number]["code"],
  string
> = {
  es: "Casos de uso",
  ca: "Casos d'ús",
  it: "Casi d'uso",
  en: "Use Cases",
  fr: "Cas d'usage",
  pt: "Casos de uso",
  de: "Anwendungsfälle",
}

function LoginScreen({ onLogin }: { onLogin: (u: PlaygroundUser) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  // The login language dropdown always defaults to Spanish (the demo's source
  // language). The visitor can still change it from the dropdown before Login.
  const [lang, setLang] = useState<
    (typeof LOGIN_LANG_OPTIONS)[number]["code"]
  >("es")
  const [error, setError] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = username.trim()
    // Case-insensitive lookup: try exact match, then UPPER, then lower
    const candidates = [input, input.toUpperCase(), input.toLowerCase()]
    const match = candidates.find((c) => ALLOWED_USERS[c as PlaygroundUser]) as PlaygroundUser | undefined
    if (!match) return setError("Invalid username")
    if (ALLOWED_USERS[match].password !== password) return setError("Invalid password")
    setError("")

    // Persist the chosen usecases language so the panel renders in that
    // language without the visitor having to flip a flag after login.
    localStorage.setItem("playgroundUsecasesLang", lang)

    // Each user is bound to a specific demo. If the current URL is not on
    // that demo's slug, drop any stale workspaceId/token from a previous
    // demo and hard-navigate to the right /demo/<slug>. The mount-time
    // effect on PlaygroundPage will then resolve the correct workspaceId.
    const targetSlug = ALLOWED_USERS[match].demoSlug
    const expectedPath = `/demo/${targetSlug}`
    const currentPath = window.location.pathname
    const alreadyOnDemo = currentPath === expectedPath || currentPath.startsWith(`${expectedPath}/`)

    if (!alreadyOnDemo) {
      localStorage.setItem("playgroundUser", match)
      localStorage.removeItem("playgroundToken")
      localStorage.removeItem("playgroundWorkspaceId")
      localStorage.removeItem("playgroundDemoSlug")
      window.location.href = expectedPath
      return
    }

    onLogin(match)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50">
      <form
        onSubmit={submit}
        className="bg-white p-8 rounded-2xl shadow-xl w-96 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center text-emerald-700">
          Playground
        </h1>
        <p className="text-sm text-gray-500 text-center">Login to continue</p>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
        />
        <div>
          <label
            htmlFor="playground-login-lang"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Language
          </label>
          <select
            id="playground-login-lang"
            value={lang}
            onChange={(e) =>
              setLang(
                e.target.value as (typeof LOGIN_LANG_OPTIONS)[number]["code"]
              )
            }
            className="w-full border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          >
            {LOGIN_LANG_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-medium transition"
        >
          Login
        </button>
      </form>
    </div>
  )
}

// ----------------------------------------------------------------------------
// SHARED TOP BAR
// ----------------------------------------------------------------------------
function TopBar({
  user,
  onLogout,
  rightSlot,
  leftSlot,
  title,
  hideUserChip,
  customChatbotId,
}: {
  user: PlaygroundUser
  onLogout: () => void
  rightSlot?: React.ReactNode
  leftSlot?: React.ReactNode
  title?: string
  hideUserChip?: boolean
  // When set to "demowash", the top-left "Playground" wordmark is
  // replaced by the DemoWash brand lockup plus the public demo
  // credentials underneath. This makes it obvious to a visitor on
  // /demo/demowash that they're inside a sandbox tenant.
  customChatbotId?: string | null
}) {
  const isDemowash = customChatbotId === "demowash"
  return (
    <header className="bg-emerald-700 text-white px-6 py-3 flex justify-between items-center shadow shrink-0 z-10">
      <div className="flex items-center gap-4">
        {leftSlot}
        {isDemowash ? (
          <div className="flex flex-col leading-tight">
            <div className="text-xl font-extrabold tracking-tight">
              <span className="text-white">Demo</span>
              <span className="text-emerald-200">Wash</span>
            </div>
          </div>
        ) : (
          <h1 className="text-xl font-bold">Playground</h1>
        )}
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        {!hideUserChip && (
          <span
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{ background: ALLOWED_USERS[user].color }}
          >
            {user}
          </span>
        )}
        <button
          onClick={onLogout}
          title="Logout"
          className="hover:bg-emerald-800 p-2 rounded-full"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}

// ----------------------------------------------------------------------------
// NEW CHAT MODAL
// ----------------------------------------------------------------------------
function NewChatModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (sessionId: string) => void
}) {
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim() || !message.trim()) return
    setSending(true)
    setError("")
    try {
      // Demo invariant: the customer name MUST be captured by the bot during
      // the conversation (e.g. "¿Cómo te llamas?" → user reply), never via a
      // form shortcut. We deliberately do NOT send `customerName` so the
      // backend falls back to its anonymous placeholder.
      const res = await playFetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPhone: phone.trim(),
          message: message.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || "Failed to send")
        return
      }
      onCreated(data.sessionId)
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl p-6 w-[440px] shadow-2xl space-y-4"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">New Chat</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <input
          required
          placeholder="Phone number (e.g. +34666123456)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
        <textarea
          required
          placeholder="First message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {sending ? "Sending..." : "Start chat"}
        </button>
      </form>
    </div>
  )
}

// ----------------------------------------------------------------------------
// CREATE TODO MODAL
// ----------------------------------------------------------------------------
function CreateTodoModal({
  message,
  user,
  onClose,
  onCreated,
}: {
  message: ChatMessage
  user: PlaygroundUser
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [comment, setComment] = useState("")
  const [priority, setPriority] = useState<Priority>("Medio")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await playFetch(`${API_BASE}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogId: message.id,
          messageType: message.direction === "INBOUND" ? "human" : "chatbot",
          messageContent: message.content,
          chatbotResponse: null,
          commentTitle: title.trim(),
          priority,
          createdBy: user,
          firstComment: comment.trim() || undefined,
        }),
      })
      onCreated()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl p-6 w-[480px] shadow-2xl space-y-4"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">New TODO</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="bg-gray-50 p-3 rounded text-sm border-l-4 border-emerald-400">
          <div className="text-xs text-gray-500 mb-1">
            {message.direction === "INBOUND" ? "Customer" : "Chatbot"} message
          </div>
          {message.content}
        </div>
        <input
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
        <textarea
          placeholder="Initial comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2"
        />
        <div className="flex gap-2">
          {(["Alto", "Medio", "Basso"] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`px-3 py-1 rounded-full border text-sm ${
                priority === p ? PRIORITY_COLOR[p] : "bg-white text-gray-500"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Create TODO"}
        </button>
      </form>
    </div>
  )
}

// ----------------------------------------------------------------------------
// TODO DETAIL MODAL
// ----------------------------------------------------------------------------
function TodoDetailModal({
  todo,
  sessions,
  user,
  onClose,
  onChanged,
}: {
  todo: Todo
  sessions: ChatSession[]
  user: PlaygroundUser
  onClose: () => void
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const [comment, setComment] = useState("")
  const [posting, setPosting] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(todo.commentTitle)
  const [savingTitle, setSavingTitle] = useState(false)
  const [savingPriority, setSavingPriority] = useState(false)

  const savePriority = async (next: Priority) => {
    if (next === todo.priority) return
    setSavingPriority(true)
    try {
      await playFetch(`${API_BASE}/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: next }),
      })
      onChanged()
    } finally {
      setSavingPriority(false)
    }
  }

  const saveTitle = async () => {
    const next = titleDraft.trim()
    if (!next || next === todo.commentTitle) {
      setEditingTitle(false)
      setTitleDraft(todo.commentTitle)
      return
    }
    setSavingTitle(true)
    try {
      await playFetch(`${API_BASE}/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentTitle: next }),
      })
      setEditingTitle(false)
      onChanged()
    } finally {
      setSavingTitle(false)
    }
  }

  // Find the chat session that contains the message this TODO refers to,
  // so we can render the WHOLE conversation alongside the comment thread.
  const relatedSession = useMemo(
    () =>
      sessions.find((s) => s.messages.some((m) => m.id === todo.dialogId)) ||
      null,
    [sessions, todo.dialogId]
  )
  const conversation = relatedSession?.messages || []
  const customerLabel =
    relatedSession?.customer?.phone ||
    relatedSession?.customer?.name ||
    "Conversation"

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setPosting(true)
    try {
      await playFetch(`${API_BASE}/todos/${todo.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentText: comment.trim(),
          createdBy: user,
          color: ALLOWED_USERS[user].color,
        }),
      })
      setComment("")
      onChanged()
    } finally {
      setPosting(false)
    }
  }

  const remove = async () => {
    if (!confirm("Delete this TODO?")) return
    await playFetch(`${API_BASE}/todos/${todo.id}`, { method: "DELETE" })
    onChanged()
    onClose()
  }

  const deleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return
    await playFetch(`${API_BASE}/todos/${todo.id}/comments/${commentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ createdBy: user }),
    })
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0 mr-2">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                  } else if (e.key === "Escape") {
                    setTitleDraft(todo.commentTitle)
                    setEditingTitle(false)
                  }
                }}
                disabled={savingTitle}
                className="w-full text-xl font-bold border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <h2
                className="text-xl font-bold cursor-text hover:bg-gray-50 rounded px-1 -mx-1 truncate"
                title="Click to edit"
                onClick={() => {
                  setTitleDraft(todo.commentTitle)
                  setEditingTitle(true)
                }}
              >
                {todo.commentTitle}
              </h2>
            )}
            <div className="flex gap-1.5 mt-1 items-center">
              {/* Click to change. The selected priority is filled with its
                  PRIORITY_COLOR; the others stay neutral until clicked.
                  Persists via PATCH /todos/:id. */}
              {(["Alto", "Medio", "Basso"] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => savePriority(p)}
                  disabled={savingPriority}
                  className={`px-2 py-0.5 rounded-full text-xs border transition disabled:opacity-50 ${
                    todo.priority === p
                      ? PRIORITY_COLOR[p]
                      : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
                  }`}
                  title={
                    todo.priority === p
                      ? `Current priority: ${p}`
                      : `Change priority to ${p}`
                  }
                >
                  {p}
                </button>
              ))}
              <span className="text-xs text-gray-500 ml-2">by {todo.createdBy}</span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {relatedSession && (
              <button
                onClick={() => {
                  navigate(
                    `/demo/ecolaundry?session=${relatedSession.id}&highlight=${todo.dialogId}`
                  )
                  onClose()
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm"
                title="Jump to this chat"
              >
                <MessageCircle className="w-4 h-4" />
                Open in chat
              </button>
            )}
            <button onClick={remove} title="Delete">
              <Trash2 className="w-5 h-5 text-red-500" />
            </button>
            <button onClick={onClose}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Conversation · {customerLabel}
          </div>
          <div
            className="rounded-lg border p-3 max-h-72 overflow-y-auto space-y-2"
            style={{ background: "#ece5dd" }}
          >
            {conversation.length === 0 && (
              <div className="text-xs text-gray-500 italic">
                Conversation no longer available — showing the commented message only:
                <div className="mt-2 bg-white rounded px-2 py-1 text-sm">
                  {todo.messageContent}
                </div>
              </div>
            )}
            {conversation.map((m) => {
              const isInbound = m.direction === "INBOUND"
              const isHighlighted = m.id === todo.dialogId
              const { customer: customerText, operator: operatorText } = isInbound
                ? { customer: m.content, operator: null }
                : splitBotMessage(m.content)
              return (
                <div key={m.id} className="space-y-1">
                  <div
                    className={`flex ${
                      isInbound ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow ${
                        isInbound ? "bg-white" : "bg-[#dcf8c6]"
                      } ${
                        isHighlighted
                          ? "ring-2 ring-emerald-500 ring-offset-1"
                          : ""
                      }`}
                    >
                      <MessageBody content={customerText} isInbound={isInbound} />
                      {m.attachments && m.attachments.length > 0 && (
                        <MessageAttachments
                          attachments={m.attachments}
                          align={isInbound ? "left" : "right"}
                        />
                      )}
                      <div className="text-[10px] text-gray-500 mt-1">
                        {new Date(m.createdAt).toLocaleTimeString()}
                        {isHighlighted && (
                          <span className="ml-2 font-semibold text-emerald-700">
                            · commented
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {operatorText && (
                    <div className="flex justify-end">
                      <div
                        className="max-w-[80%] rounded-lg px-3 py-2 text-sm shadow bg-orange-100 border border-orange-300 text-orange-900"
                        title="Internal operator handover — not sent to the customer"
                      >
                        <MessageBody content={operatorText} isInbound={false} />
                        <div className="text-[10px] text-orange-700/80 mt-1 italic">
                          internal — not visible to the customer
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-sm">
            Comments ({todo.comments.length})
          </h3>
          {todo.comments.map((c) => (
            <div
              key={c.id}
              className="flex gap-2 bg-gray-50 p-2 rounded border-l-4"
              style={{ borderColor: c.color || "#888" }}
            >
              <div className="flex-1">
                <div className="text-xs text-gray-500">
                  <strong style={{ color: c.color || "#333" }}>
                    {c.createdBy}
                  </strong>{" "}
                  · {new Date(c.createdAt).toLocaleString()}
                </div>
                <div className="text-sm whitespace-pre-wrap">{c.commentText}</div>
              </div>
              {c.createdBy === user && (
                <button
                  onClick={() => deleteComment(c.id)}
                  title="Delete comment"
                  className="self-start text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={addComment} className="flex gap-2">
          <input
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            disabled={posting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-lg disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// CHAT TITLE EDIT — inline editor for the chat list header
// ----------------------------------------------------------------------------
// Demo-only overlay. Lets the user rename a chat; the value is stored in
// localStorage by the parent. IMPORTANT: this only overrides the DISPLAY
// title — the real customer phone is always shown separately below it (and in
// the conversation detail header), so list and detail never diverge.
function ChatTitleEdit({
  fallbackLabel,
  currentTitle,
  onSave,
}: {
  fallbackLabel: string
  currentTitle: string | null
  onSave: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentTitle || "")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(currentTitle || "")
  }, [currentTitle, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    onSave(draft)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(currentTitle || "")
    setEditing(false)
  }

  if (editing) {
    return (
      <div
        className="flex items-center gap-1 mb-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") cancel()
          }}
          placeholder={fallbackLabel}
          className="flex-1 min-w-0 text-sm border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          onClick={commit}
          className="p-0.5 text-emerald-600 hover:bg-emerald-100 rounded"
          title="Save title"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={cancel}
          className="p-0.5 text-gray-500 hover:bg-gray-100 rounded"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 mb-0.5 group/title">
      <div className="font-medium text-sm truncate flex-1 min-w-0">
        {currentTitle || fallbackLabel}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        className="p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded opacity-0 group-hover/title:opacity-100 transition shrink-0"
        title="Edit chat title"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  )
}

// ----------------------------------------------------------------------------
// CHAT SCREEN — main page
// ----------------------------------------------------------------------------
function ChatScreen({
  user,
  workspaceId,
  onLogout,
}: {
  user: PlaygroundUser
  workspaceId: string | null
  onLogout: () => void
}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [usecasesMd, setUsecasesMd] = useState("")
  // 🌍 Selected language for the Use Cases panel (markdown + intro card).
  // Persisted to localStorage so the choice survives reloads and demo
  // switches. Default is Spanish since the source usecases.md is in Spanish.
  const [usecasesLang, setUsecasesLang] = useState<
    "es" | "it" | "en" | "fr" | "pt" | "ca" | "de"
  >(() => {
    if (typeof window === "undefined") return "es"
    const saved = localStorage.getItem("playgroundUsecasesLang")
    const valid = ["es", "it", "en", "fr", "pt", "ca", "de"] as const
    return (valid as readonly string[]).includes(saved || "")
      ? (saved as (typeof valid)[number])
      : "es"
  })
  useEffect(() => {
    try {
      localStorage.setItem("playgroundUsecasesLang", usecasesLang)
    } catch {
      // Storage full or disabled — ignore, state still works in-memory.
    }
  }, [usecasesLang])
  const [usecasesLoading, setUsecasesLoading] = useState(false)
  // 📘 "About this demo" popup — opened on click of the (i) button in the
  // Use Cases header AND auto-opened once after login for demowash visitors
  // (see effect below). Contents come from `ABOUT_DEMOWASH` keyed by language.
  const [showAboutPopup, setShowAboutPopup] = useState(false)
  // Tracks whether the popup was auto-opened by the post-login welcome
  // effect (true) or by an explicit click on the (i) button (false). On
  // close, the auto-open variant triggers a window.location.reload() so
  // the chat list is fetched with the freshly resolved workspaceId in
  // localStorage — a belt-and-braces fix for the "no chats until I
  // refresh" race after login.
  const popupAutoOpenedRef = useRef(false)
  const [workspaceName, setWorkspaceName] = useState<string>("Ecolaundry")
  // Seed customChatbotId from the URL slug or from localStorage so the very
  // first render already knows which demo we're on. Without this the UI
  // briefly flashes the Ecolaundry layout (kanban button + Spanish usecases)
  // every time the visitor arrives via login redirect, because
  // `/workspace-info` is fetched async.
  const [customChatbotId, setCustomChatbotId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const m = window.location.pathname.match(/^\/demo\/([a-z0-9-]+)/)
    if (m) return m[1]
    return localStorage.getItem("playgroundDemoSlug")
  })
  const [commentingMessage, setCommentingMessage] = useState<ChatMessage | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [sendingChat, setSendingChat] = useState(false)
  // Message id to highlight & scroll to (set when arriving from a kanban "Open in chat" click)
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  // Tracks a session id that was JUST created and might not yet be in the
  // sessions list (fetchAll is async). The "switch to first visible chat"
  // effect below ignores this id so the new chat stays selected even
  // before the backend echoes it back.
  const justCreatedSessionRef = useRef<string | null>(null)
  // Demo-only overlays persisted in localStorage (no backend column today).
  // When backend support lands, these move to ChatSession.title +
  // ChatSession.feedback respectively. NOTE: a custom title only overrides the
  // DISPLAY label; the real customer phone is always shown below it, so list
  // and detail never diverge.
  const [chatTitles, setChatTitles] = useState<Record<string, string>>(() =>
    readJsonMap<string>(TITLE_STORAGE_KEY),
  )
  const [chatFeedback, setChatFeedback] = useState<Record<string, Feedback>>(
    () => readJsonMap<Feedback>(FEEDBACK_STORAGE_KEY),
  )
  // Ordered list of session ids in user-preferred order. Sessions NOT in
  // this list keep their natural (lastActivity) ordering AFTER the pinned
  // ones. New sessions land at the top of the natural list.
  const [chatOrder, setChatOrderState] = useState<string[]>(() =>
    readJsonArray(ORDER_STORAGE_KEY),
  )

  const persistChatOrder = useCallback((next: string[]) => {
    setChatOrderState(next)
    writeJsonArray(ORDER_STORAGE_KEY, next)
  }, [])

  const setChatTitle = useCallback((sessionId: string, title: string) => {
    setChatTitles((prev) => {
      const next = { ...prev }
      const trimmed = title.trim()
      if (trimmed) next[sessionId] = trimmed
      else delete next[sessionId]
      writeJsonMap(TITLE_STORAGE_KEY, next)
      return next
    })
  }, [])

  const toggleChatFeedback = useCallback(
    (sessionId: string, value: Feedback) => {
      setChatFeedback((prev) => {
        const next = { ...prev }
        if (next[sessionId] === value) delete next[sessionId]
        else next[sessionId] = value
        writeJsonMap(FEEDBACK_STORAGE_KEY, next)
        return next
      })
    },
    [],
  )

  const fetchAll = useCallback(async () => {
    const [msgRes, todosRes] = await Promise.all([
      playFetch(`${API_BASE}/messages`).then((r) => r.json()),
      playFetch(`${API_BASE}/todos`).then((r) => r.json()),
    ])
    setSessions(msgRes.sessions || [])
    setTodos(todosRes.todos || [])
  }, [])

  // 🌍 Fetch usecases markdown whenever the selected language changes.
  // For Demowash we hit the public slug-based endpoint so the loader looks
  // inside custom-demowash/ (which ships pre-translated usecases.<lang>.md
  // files) instead of falling back to the Ecolaundry workspace and asking
  // OpenRouter to translate on the fly.
  useEffect(() => {
    let cancelled = false
    setUsecasesLoading(true)
    const url =
      customChatbotId === "demowash"
        ? `${API_BASE}/demo-usecases/demowash?lang=${usecasesLang}`
        : `${API_BASE}/usecases?lang=${usecasesLang}`
    playFetch(url)
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return
        setUsecasesMd(text)
      })
      .catch(() => {
        if (cancelled) return
        setUsecasesMd("# Use Cases\n\nFile not found.")
      })
      .finally(() => {
        if (!cancelled) setUsecasesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [usecasesLang, customChatbotId])

  useEffect(() => {
    fetchAll()
    // The URL slug is the source of truth for which demo we're on. If we
    // are on /demo/<slug>, never let `/workspace-info` override the
    // chatbot id — at first paint after a login redirect that endpoint
    // can still answer with the previous tenant's workspaceId (the new
    // one is being resolved in parallel), and we don't want the right
    // side panel to flash the wrong demo's usecases.
    //
    // `workspaceId` is a dependency: it changes from null → <id> right
    // after the login-redirect `/resolve-demo` call resolves. Re-running
    // fetchAll at that point is what makes chats appear immediately
    // without a manual refresh.
    const urlMatch = window.location.pathname.match(/^\/demo\/([a-z0-9-]+)/)
    const urlSlug = urlMatch?.[1] ?? null
    playFetch(`${API_BASE}/workspace-info`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) setWorkspaceName(data.name)
        if (data?.chatbotId && !urlSlug) setCustomChatbotId(data.chatbotId)
      })
      .catch(() => {/* keep default 'Ecolaundry' */})
    // Pause polling when the tab is hidden — saves backend traffic
    // for a playground that is left open in a background tab.
    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (interval) return
      interval = setInterval(fetchAll, POLL_INTERVAL)
    }
    const stop = () => {
      if (!interval) return
      clearInterval(interval)
      interval = null
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else {
        fetchAll()
        start()
      }
    }
    start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [fetchAll, workspaceId])

  // 📘 Auto-open the "About DemoWash" popup once per session for demowash
  // visitors. Logout wipes localStorage so the next login re-opens it
  // automatically — exactly the welcome flow Andrea wants for the demo.
  useEffect(() => {
    if (customChatbotId !== "demowash") return
    if (localStorage.getItem("playgroundAboutSeen") === "1") return
    popupAutoOpenedRef.current = true
    setShowAboutPopup(true)
    localStorage.setItem("playgroundAboutSeen", "1")
  }, [customChatbotId])

  // Sort sessions by last message timestamp DESC (most recent activity on top).
  // Falls back to session creation/update time when there are no messages yet.
  const sortedSessions = useMemo(() => {
    const getLastActivity = (s: ChatSession): number => {
      const last = s.messages[s.messages.length - 1]
      if (last?.createdAt) return new Date(last.createdAt).getTime()
      return new Date((s as any).updatedAt || (s as any).createdAt || 0).getTime()
    }
    return [...sessions].sort((a, b) => getLastActivity(b) - getLastActivity(a))
  }, [sessions])

  useEffect(() => {
    if (!activeSessionId && sortedSessions.length > 0) {
      setActiveSessionId(sortedSessions[0].id)
    }
  }, [sortedSessions, activeSessionId])

  // Deep-link: ?session=<id>&highlight=<messageId> from "Open in chat" in kanban.
  // Selects the requested session and marks the message to scroll/flash.
  useEffect(() => {
    const sessionParam = searchParams.get("session")
    const highlightParam = searchParams.get("highlight")
    if (!sessionParam && !highlightParam) return
    if (sessionParam) setActiveSessionId(sessionParam)
    if (highlightParam) setHighlightMessageId(highlightParam)
    // Strip params from the URL so a refresh doesn't keep re-triggering it
    const next = new URLSearchParams(searchParams)
    next.delete("session")
    next.delete("highlight")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const activeSession = useMemo(
    () => sortedSessions.find((s) => s.id === activeSessionId) || null,
    [sortedSessions, activeSessionId]
  )

  // Auto-scroll to bottom when new messages arrive (skip when we're about to
  // jump to a specific highlighted message instead).
  useEffect(() => {
    if (highlightMessageId) return
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeSession?.messages.length, activeSessionId, highlightMessageId])

  // When a highlight is requested, scroll to that message and clear after a moment.
  useEffect(() => {
    if (!highlightMessageId) return
    if (!activeSession?.messages.some((m) => m.id === highlightMessageId)) return
    const target = document.getElementById(`msg-${highlightMessageId}`)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" })
    }
    const t = setTimeout(() => setHighlightMessageId(null), 4000)
    return () => clearTimeout(t)
  }, [highlightMessageId, activeSession])

  // Optimistic state: while waiting for the server to persist & the bot to
  // reply, we already render the user message and a typing indicator.
  // Tied to a session id so it disappears automatically when the user
  // switches chat mid-flight.
  const [pendingForSession, setPendingForSession] = useState<{
    sessionId: string
    userMessage: string
  } | null>(null)

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !activeSession || sendingChat) return
    const startedAt = Date.now()
    const text = chatInput.trim()
    setSendingChat(true)
    setChatInput("")
    setPendingForSession({ sessionId: activeSession.id, userMessage: text })
    try {
      const res = await playFetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          message: text,
          // 🌍 Forward the language selected via the Use Cases flag panel.
          // The backend uses this as the language hint for the LLM so the
          // bot reply — and the operator "Human Support message" emitted on
          // escalation — come back in the selected language. Default is
          // Spanish (`usecasesLang` initial state is "es"); only the
          // playground forwards this, real WhatsApp flows keep relying on
          // `customer.language`.
          lang: usecasesLang,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.message || data.error || "Failed to send message")
        return
      }
      const elapsed = Date.now() - startedAt
      if (elapsed < MIN_BOT_LOADING_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_BOT_LOADING_MS - elapsed)
        )
      }
      // Server now has the bot reply persisted: refresh once, that's enough.
      // Clearing the optimistic state AFTER fetchAll resolves avoids a flash
      // where the user message disappears before the real one is rendered.
      await fetchAll()
    } finally {
      setSendingChat(false)
      setPendingForSession(null)
    }
  }

  const todoCountByDialog = useMemo(() => {
    const map = new Map<string, number>()
    todos.forEach((t) => map.set(t.dialogId, (map.get(t.dialogId) || 0) + 1))
    return map
  }, [todos])

  // Map sessionId → todos linked to any of the session's messages
  const todosBySession = useMemo(() => {
    const messageIdToSession = new Map<string, string>()
    sessions.forEach((s) =>
      s.messages.forEach((m) => messageIdToSession.set(m.id, s.id))
    )
    const map = new Map<string, Todo[]>()
    todos.forEach((t) => {
      const sid = messageIdToSession.get(t.dialogId)
      if (sid) {
        const existing = map.get(sid) || []
        map.set(sid, [...existing, t])
      }
    })
    return map
  }, [sessions, todos])

  // Deduplicate consecutive identical messages (chatbot pipeline can save the same text twice)
  const visibleMessages = useMemo(() => {
    if (!activeSession) return []
    const out: typeof activeSession.messages = []
    for (const m of activeSession.messages) {
      const prev = out[out.length - 1]
      if (
        prev &&
        prev.direction === m.direction &&
        prev.content.trim() === m.content.trim()
      ) {
        continue
      }
      out.push(m)
    }
    return out
  }, [activeSession])

  // Count of TODOs blocking deletion of each session.
  // Sessions with at least one TODO referring to one of their messages cannot
  // be deleted until those TODOs are removed/moved on the kanban.
  const todoCountBySession = useMemo(() => {
    const messageIdToSession = new Map<string, string>()
    sessions.forEach((s) =>
      s.messages.forEach((m) => messageIdToSession.set(m.id, s.id))
    )
    const map = new Map<string, number>()
    todos.forEach((t) => {
      const sid = messageIdToSession.get(t.dialogId)
      if (sid) map.set(sid, (map.get(sid) || 0) + 1)
    })
    return map
  }, [sessions, todos])

  const deleteSession = async (sessionId: string) => {
    const blocking = todoCountBySession.get(sessionId) || 0
    if (blocking > 0) {
      alert(
        `This chat has ${blocking} TODO${
          blocking === 1 ? "" : "s"
        } on the kanban. Delete or move them first, then retry.`
      )
      return
    }
    if (!confirm("Delete this chat? Messages will be lost.")) return
    const res = await playFetch(`${API_BASE}/sessions/${sessionId}`, {
      method: "DELETE",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.message || data.error || "Failed to delete chat")
      return
    }
    if (activeSessionId === sessionId) setActiveSessionId(null)
    fetchAll()
  }

  // Hide chats from the list when all linked TODOs are already in DONE.
  // Chats with no linked TODOs stay visible. Then apply the user-defined
  // drag-and-drop order: pinned sessions in `chatOrder` come first in
  // that order; the rest keep their natural lastActivity order.
  const visibleSessions = useMemo(() => {
    const filtered = sortedSessions.filter((s) => {
      const linkedTodos = todosBySession.get(s.id) || []
      if (linkedTodos.length === 0) return true
      return linkedTodos.some((t) => t.status !== "DONE")
    })
    if (chatOrder.length === 0) return filtered
    const byId = new Map(filtered.map((s) => [s.id, s]))
    const pinned: ChatSession[] = []
    for (const id of chatOrder) {
      const s = byId.get(id)
      if (s) {
        pinned.push(s)
        byId.delete(id)
      }
    }
    // The remaining sessions (not in chatOrder) keep their original
    // sortedSessions order, appended after the pinned ones.
    const rest = filtered.filter((s) => byId.has(s.id))
    return [...pinned, ...rest]
  }, [sortedSessions, todosBySession, chatOrder])

  // If the current chat becomes hidden by the DONE-only rule, switch to the
  // first visible chat (or clear selection if none is left).
  //
  // EXCEPTION (just-created session): when "+ New Chat" creates a session,
  // we set activeSessionId to that id BEFORE fetchAll has echoed it back
  // from the backend. Without this guard the effect would race-reset the
  // new chat to whatever is currently visible. The ref is cleared once
  // the new session finally appears in visibleSessions.
  useEffect(() => {
    if (!activeSessionId) return
    const isStillVisible = visibleSessions.some((s) => s.id === activeSessionId)
    if (isStillVisible) {
      if (justCreatedSessionRef.current === activeSessionId) {
        justCreatedSessionRef.current = null
      }
      return
    }
    if (justCreatedSessionRef.current === activeSessionId) {
      // Session just created; wait for fetchAll to bring it in.
      return
    }
    setActiveSessionId(visibleSessions[0]?.id || null)
  }, [visibleSessions, activeSessionId])

  // Drag-and-drop reorder of the chat list. Captures the FULL displayed
  // order (visibleSessions after the move) and persists it. Sessions
  // hidden by the DONE filter aren't touched — they reappear in their
  // natural position when their TODO leaves DONE.
  const onChatListDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return
      const sourceIdx = result.source.index
      const destIdx = result.destination.index
      if (sourceIdx === destIdx) return
      const reordered = [...visibleSessions]
      const [moved] = reordered.splice(sourceIdx, 1)
      reordered.splice(destIdx, 0, moved)
      persistChatOrder(reordered.map((s) => s.id))
    },
    [visibleSessions, persistChatOrder],
  )

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <TopBar
        user={user}
        onLogout={onLogout}
        title={workspaceName}
        hideUserChip={customChatbotId === "demowash"}
        customChatbotId={customChatbotId}
        rightSlot={
          <div className="flex items-center gap-2">
            {/* Kanban Board is for the operator-facing playground only.
                The DemoWash public demo doesn't expose the todo workflow,
                so we hide the entry-point button entirely. */}
            {customChatbotId !== "demowash" && (
              <button
                onClick={() => navigate("/demo/ecolaundry/kanban")}
                className="bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow"
              >
                <KanbanSquare className="w-4 h-4" />
                Kanban Board
                {todos.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full">
                    {todos.length}
                  </span>
                )}
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 grid grid-cols-12 gap-3 p-3 min-h-0">
        {/* CHAT LIST — wider column (+80px) for chat title visibility */}
        <aside className="col-span-3 bg-white rounded-xl shadow flex flex-col overflow-hidden min-h-0 min-w-[280px]">
          <div className="px-3 py-2 bg-emerald-600 text-white shrink-0 flex items-center justify-between gap-2">
            <span className="font-semibold text-sm">Pruebas</span>
            <button
              onClick={() => setShowNewChat(true)}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarGutter: "stable" }}
          >
            {visibleSessions.length === 0 && (
              <div className="text-center text-xs text-gray-400 p-4">
                No chats yet.
                <br />
                Click "New Chat" to start.
              </div>
            )}
            <DragDropContext onDragEnd={onChatListDragEnd}>
              <Droppable droppableId="chat-list">
                {(droppableProvided) => (
                  <div
                    ref={droppableProvided.innerRef}
                    {...droppableProvided.droppableProps}
                  >
                    {visibleSessions.map((s, idx) => {
              const isActive = s.id === activeSessionId
              // Card preview shows the FIRST customer message of the
              // conversation — the topic the user opened the chat with.
              // Falls back to any first message if no INBOUND exists yet
              // (rare: bot-initiated greeting before any user reply).
              const previewMsg =
                s.messages.find((m) => m.direction === "INBOUND") ||
                s.messages[0]
              const phone = s.customer?.phone
              const name = s.customer?.name
              // Phone is the primary label. Name only if it looks meaningful.
              const isGenericName =
                !name ||
                /^(new customer|test_|playground_|unknown)/i.test(name.trim())
              const primary = phone || (!isGenericName ? name : null) || "Unknown"
              const secondary = !isGenericName && phone ? name : null
              const blockingTodos = todoCountBySession.get(s.id) || 0
              const canDelete = blockingTodos === 0
              const linkedTodos = todosBySession.get(s.id) || []
              const totalComments = linkedTodos.reduce(
                (sum, t) => sum + t.comments.length,
                0
              )
              const hasTodos = linkedTodos.length > 0
              const customTitle = chatTitles[s.id] || null
              return (
                <Draggable key={s.id} draggableId={s.id} index={idx}>
                  {(draggableProvided, draggableSnapshot) => (
                <div
                  ref={draggableProvided.innerRef}
                  {...draggableProvided.draggableProps}
                  {...draggableProvided.dragHandleProps}
                  className={`group relative border-b transition ${
                    draggableSnapshot.isDragging
                      ? "bg-emerald-100 ring-2 ring-emerald-400 shadow-lg"
                      : hasTodos && !isActive
                      ? "bg-amber-50 border-l-4 border-l-amber-400 hover:bg-amber-100"
                      : isActive
                      ? "bg-emerald-50 border-l-4 border-l-emerald-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div
                    onClick={() => setActiveSessionId(s.id)}
                    className="w-full text-left px-3 py-2 pr-9 cursor-pointer"
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <div className="flex-1 min-w-0">
                        <ChatTitleEdit
                          fallbackLabel={primary}
                          currentTitle={customTitle}
                          onSave={(next) => setChatTitle(s.id, next)}
                        />
                      </div>
                      {hasTodos && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(
                              `/demo/ecolaundry/kanban?todo=${linkedTodos[0].id}`
                            )
                          }}
                          title={`${linkedTodos.length} todo${linkedTodos.length !== 1 ? "s" : ""} · ${totalComments} comment${totalComments !== 1 ? "s" : ""} — click to open kanban`}
                          className="flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 transition"
                        >
                          <KanbanSquare className="w-3 h-3" />
                          {linkedTodos.length}
                        </button>
                      )}
                    </div>
                    {/* Real customer phone — always shown when a custom title
                        hides it, so the list never diverges from the detail. */}
                    {customTitle && phone && (
                      <div className="text-[10px] text-gray-500 truncate">
                        {phone}
                      </div>
                    )}
                    {secondary && (
                      <div className="text-[10px] text-gray-500 truncate">
                        {secondary}
                      </div>
                    )}
                    {previewMsg && (
                      <div
                        className="text-xs text-gray-500 mt-0.5 overflow-hidden"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {previewMsg.direction === "OUTBOUND" ? "🤖 " : ""}
                        {previewMsg.content}
                      </div>
                    )}
                    {!previewMsg && (
                      <div className="text-[10px] text-gray-400 italic mt-0.5">
                        No messages yet
                      </div>
                    )}
                    {/* Like/dislike for the WHOLE chat (overall quality
                        of the bot's handling). Re-click toggles off.
                        Persisted in localStorage by sessionId. */}
                    <div className="flex items-center gap-1 mt-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleChatFeedback(s.id, "like")
                        }}
                        className={`flex items-center justify-center p-1 rounded-full transition ${
                          chatFeedback[s.id] === "like"
                            ? "bg-emerald-200 text-emerald-700"
                            : "bg-white/70 hover:bg-emerald-100 text-gray-500 hover:text-emerald-700"
                        }`}
                        title={
                          chatFeedback[s.id] === "like"
                            ? "Click to remove like"
                            : "Mark this chat as good"
                        }
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleChatFeedback(s.id, "dislike")
                        }}
                        className={`flex items-center justify-center p-1 rounded-full transition ${
                          chatFeedback[s.id] === "dislike"
                            ? "bg-red-200 text-red-700"
                            : "bg-white/70 hover:bg-red-100 text-gray-500 hover:text-red-700"
                        }`}
                        title={
                          chatFeedback[s.id] === "dislike"
                            ? "Click to remove dislike"
                            : "Mark this chat as bad"
                        }
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(s.id)
                    }}
                    disabled={!canDelete}
                    title={
                      canDelete
                        ? "Delete this chat"
                        : `Cannot delete: ${blockingTodos} TODO${
                            blockingTodos === 1 ? "" : "s"
                          } on the kanban reference this chat. Remove them first.`
                    }
                    className={`absolute top-2 right-2 p-1 rounded transition ${
                      canDelete
                        ? "opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50"
                        : "opacity-60 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                  )}
                </Draggable>
              )
                    })}
                    {droppableProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </aside>

        {/* CHAT — on lg screens reduced from col-span-6 to col-span-5
            because the chat list grew from col-span-2 to col-span-3 (the
            +80px requested). Total stays 12: 3 (chats) + 5 (chat) + 4 (use cases). */}
        <section className="col-span-9 lg:col-span-5 bg-white rounded-xl shadow flex flex-col overflow-hidden min-h-0">
          <div className="px-4 py-3 bg-emerald-600 text-white shrink-0 flex items-center gap-3">
            {(() => {
              const phone = activeSession?.customer?.phone
              const name = activeSession?.customer?.name
              const isGenericName =
                !name ||
                /^(new customer|test_|playground_|unknown)/i.test(name.trim())
              // The detail header must show the SAME labels as the chat list
              // card, otherwise the list shows the renamed title while the
              // detail header shows the underlying phone and the two diverge
              // (the bug Andrea hit). A user-edited custom title wins as the
              // primary label; the real phone and the (non-generic) name are
              // shown underneath so nothing is lost — exactly mirroring the
              // list card (see the customTitle/secondary block above).
              const customTitle = activeSession
                ? chatTitles[activeSession.id] || null
                : null
              const primary = activeSession
                ? customTitle || phone || (!isGenericName ? name : null) || "Chat"
                : "Select a chat"
              // Sub-lines under the primary: when a custom title is set we
              // surface the real phone (otherwise hidden by the title); the
              // name is shown whenever it is meaningful and not already the
              // primary label.
              const subPhone = customTitle ? phone : null
              const subName =
                !isGenericName && name && name !== primary ? name : null
              const initial = (primary[0] || "?").toUpperCase()
              const activeTodos = activeSession
                ? todosBySession.get(activeSession.id) || []
                : []
              const activeTotalComments = activeTodos.reduce(
                (sum, t) => sum + t.comments.length,
                0
              )
              return (
                <>
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{primary}</div>
                    {subPhone && (
                      <div className="text-xs opacity-80 truncate">
                        {subPhone}
                      </div>
                    )}
                    {subName && (
                      <div className="text-xs opacity-80 truncate">
                        {subName}
                      </div>
                    )}
                  </div>
                  {activeTodos.length > 0 && (
                    <button
                      onClick={() =>
                        navigate(
                          `/demo/ecolaundry/kanban?todo=${activeTodos[0].id}`
                        )
                      }
                      title={`${activeTodos.length} todo${activeTodos.length !== 1 ? "s" : ""} · ${activeTotalComments} comment${activeTotalComments !== 1 ? "s" : ""} — open kanban`}
                      className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full transition shrink-0"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {activeTotalComments}
                    </button>
                  )}
                </>
              )
            })()}
          </div>
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-2"
            style={{ background: "#ece5dd" }}
          >
            {visibleMessages.map((m) => {
              const isInbound = m.direction === "INBOUND"
              const todoCount = todoCountByDialog.get(m.id) || 0
              const isHighlighted = m.id === highlightMessageId
              const linkedTodo =
                todoCount > 0
                  ? todos.find((t) => t.dialogId === m.id) || null
                  : null
              const openTaskOnKanban = () => {
                if (!linkedTodo) return
                navigate(`/demo/ecolaundry/kanban?todo=${linkedTodo.id}`)
              }
              const { customer: customerText, operator: operatorText } = isInbound
                ? { customer: m.content, operator: null }
                : splitBotMessage(m.content)
              return (
                <div key={m.id} id={`msg-${m.id}`} className="space-y-1">
                  <div
                    className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      onClick={linkedTodo ? openTaskOnKanban : undefined}
                      title={linkedTodo ? "Click to open the linked task on the kanban" : undefined}
                      className={`max-w-[75%] rounded-lg px-3 py-2 shadow text-sm relative group transition ${
                        isInbound ? "bg-white" : "bg-[#dcf8c6]"
                      } ${linkedTodo ? "cursor-pointer hover:brightness-95" : ""} ${
                        isHighlighted
                          ? "ring-4 ring-emerald-500 ring-offset-2 animate-pulse"
                          : linkedTodo
                          ? "ring-2 ring-amber-400 ring-offset-1"
                          : ""
                      }`}
                    >
                      <MessageBody content={customerText} isInbound={isInbound} />
                      <div className="text-[10px] text-gray-500 mt-1 flex justify-between items-center gap-3">
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                        {/* Comment button only for chatbot (OUTBOUND) messages.
                            Users don't comment on their own messages.
                            Hidden on DemoWash — the public demo doesn't expose
                            the operator todo workflow. */}
                        {!isInbound && customChatbotId !== "demowash" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setCommentingMessage(m)
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/70 hover:bg-emerald-100 text-emerald-700 transition shadow-sm"
                            title="Comment this bot reply"
                          >
                            <MessageCircle className="w-4 h-4" />
                            {todoCount > 0 && (
                              <span className="text-xs font-semibold">
                                {todoCount}
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {operatorText && (
                    <div className="flex justify-end">
                      <div
                        className="max-w-[75%] rounded-lg px-3 py-2 shadow text-sm bg-orange-100 border border-orange-300 text-orange-900"
                        title="Internal operator handover — not sent to the customer"
                      >
                        <MessageBody content={operatorText} isInbound={false} />
                        <div className="text-[10px] text-orange-700/80 mt-1 italic">
                          internal — not visible to the customer
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {/* Optimistic render: while waiting for the server roundtrip,
                show the just-sent user message + a typing indicator so the
                UI feels instant. We hide the optimistic user bubble as soon
                as a matching real message lands from the server (background
                polling can race with sendChatMessage's own fetchAll), to
                avoid a duplicate "sending…" bubble next to the persisted one.
                The typing indicator stays until the server reply lands. */}
            {(() => {
              if (!activeSession) return null
              if (pendingForSession?.sessionId !== activeSession.id) return null
              const pendingText = pendingForSession.userMessage.trim()
              // Find the index of the user's persisted message. If it's there,
              // the optimistic user bubble is redundant and must be hidden.
              const userIdx = visibleMessages.findIndex(
                (m) =>
                  m.direction === "INBOUND" && m.content.trim() === pendingText,
              )
              const userPersisted = userIdx >= 0
              // Bot has replied if there's an OUTBOUND message AFTER the user's
              // persisted one. Without that anchor we can't tell whether a
              // pre-existing bot bubble is the new reply or just history.
              const botReplied =
                userPersisted &&
                visibleMessages
                  .slice(userIdx + 1)
                  .some((m) => m.direction === "OUTBOUND")
              return (
                <>
                  {!userPersisted && (
                    <div className="flex justify-start">
                      <div className="max-w-[75%] rounded-lg px-3 py-2 shadow text-sm bg-white opacity-80">
                        <div className="whitespace-pre-wrap">{pendingText}</div>
                        <div className="text-[10px] text-gray-400 mt-1">
                          sending…
                        </div>
                      </div>
                    </div>
                  )}
                  {!botReplied && (
                    <div className="flex justify-end">
                      <div className="rounded-lg px-3 py-2 shadow text-sm bg-[#dcf8c6]">
                        <TypingDots />
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
            {!activeSession && (
              <div className="text-center text-gray-500 mt-10 flex flex-col items-center gap-4">
                <span>Select a chat from the list, or click + to start a new one.</span>
                <button
                  onClick={() => setShowNewChat(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow"
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
              </div>
            )}
            {activeSession &&
              !activeSession.messages.length &&
              pendingForSession?.sessionId !== activeSession.id && (
                <div className="text-center text-gray-500 mt-10">
                  No messages in this chat yet.
                </div>
              )}
          </div>
          {activeSession && (
            <form
              onSubmit={sendChatMessage}
              className="border-t bg-white p-2 flex gap-2 shrink-0"
            >
              <input
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                name="chat-message"
                className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <button
                type="submit"
                disabled={sendingChat || !chatInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-full disabled:opacity-50 min-w-[44px] flex items-center justify-center"
              >
                {sendingChat ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          )}
        </section>

        {/* MARKDOWN — hidden on smaller screens to give chat room */}
        <section className="hidden lg:flex col-span-4 bg-white rounded-xl shadow flex-col overflow-hidden min-h-0">
          <div className="px-4 py-2 bg-emerald-600 text-white font-semibold shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span>{USE_CASES_LABEL[usecasesLang] ?? USE_CASES_LABEL.es}</span>
              {customChatbotId === "demowash" && (
                <button
                  type="button"
                  onClick={() => {
                    popupAutoOpenedRef.current = false
                    setShowAboutPopup(true)
                  }}
                  title="About this demo"
                  aria-label="About this demo"
                  className="p-1 rounded hover:bg-white/20 cursor-pointer opacity-90 hover:opacity-100 transition"
                >
                  <Info className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Language is chosen at login time (LoginScreen combo) and
                persisted to localStorage; the header no longer offers a
                runtime flag selector — Andrea found the flags confusing
                next to the Info button. */}
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 prose prose-sm max-w-none break-words relative">
            {usecasesLoading && (
              <div className="absolute top-2 right-3 text-xs text-slate-500 flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                Loading…
              </div>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug, rehypeHighlight]}
              components={
                customChatbotId === "demowash"
                  ? {
                      // Inject a multilingual intro card right after the H1 of
                      // the Use Cases markdown (demowash only). The card
                      // text follows the currently selected `usecasesLang` —
                      // the codes (WAIT, SELECT, …) stay the same in every
                      // language because they're real on-screen tokens.
                      h1: ({ children, ...props }) => (
                        <>
                          <h1 {...props}>{children}</h1>
                          <div
                            className="not-prose bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 px-7 py-5 my-5 text-[16px] text-orange-900 leading-relaxed shadow-sm"
                            style={{ borderRadius: 50 }}
                          >
                            <DemowashIntroCard lang={usecasesLang} />
                          </div>
                        </>
                      ),
                    }
                  : undefined
              }
            >
              {usecasesMd}
            </ReactMarkdown>
          </div>
        </section>
      </div>

      {commentingMessage && (
        <CreateTodoModal
          message={commentingMessage}
          user={user}
          onClose={() => setCommentingMessage(null)}
          onCreated={fetchAll}
        />
      )}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onCreated={(sid) => {
            // Mark the id as "just created" so the visibility-reset effect
            // does not race-reset our selection while fetchAll is in flight.
            justCreatedSessionRef.current = sid
            setActiveSessionId(sid)
            // Pin the new chat at the very top of the list, above any
            // user-reordered pinned chats. We prepend its id to chatOrder
            // and dedupe in case the user re-creates a previously
            // ordered session id (defensive — backend gives unique ids
            // today).
            persistChatOrder([sid, ...chatOrder.filter((id) => id !== sid)])
            fetchAll()
            setTimeout(fetchAll, 800)
            setTimeout(fetchAll, 2000)
          }}
        />
      )}
      {showAboutPopup && (
        <AboutDemowashPopup
          lang={usecasesLang}
          onClose={() => {
            setShowAboutPopup(false)
            // After the auto-open welcome popup, do a hard reload so the
            // chat list re-mounts with the workspaceId (resolved async
            // during login) already in localStorage. Belt-and-braces fix
            // for the "no chats until I refresh" race.
            if (popupAutoOpenedRef.current) {
              popupAutoOpenedRef.current = false
              window.location.reload()
            }
          }}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// DEMOWASH INTRO CARD — multilingual presentation box shown above the Use
// Cases markdown. Translations are hardcoded (short text, frequently read,
// not worth an LLM round-trip). Machine codes (WAIT, SELECT, …) are real
// on-screen tokens so they're identical across languages.
// ----------------------------------------------------------------------------
type IntroLang = "es" | "it" | "en" | "fr" | "pt" | "ca" | "de"

function DemowashIntroCard({ lang }: { lang: IntroLang }) {
  const codes = [
    "WAIT",
    "SELECT",
    "OPEN",
    "ALERT OPEN",
    "ERR-01",
    "ALERT",
    "BLOCK",
    "STOP",
    "END",
  ]
  const t: Record<
    IntroLang,
    {
      brand: string
      intro: string
      codesLabel: string
      multilingual: string
      multilingualLabel: string
      languages: string
      footer: string
      whatsappLine: string
      customizationLine: string
    }
  > = {
    es: {
      brand: "DemoWash",
      intro:
        " es una lavandería demo con varias sedes en franquicia repartidas por Cataluña. Cada sede tiene sus propios precios y horarios, y el chatbot adapta sus respuestas a la lavandería donde se encuentra el cliente. En cuanto a las máquinas, cada incidencia se identifica por un código en pantalla con su procedimiento documentado: ",
      codesLabel: "",
      multilingual: ". Además, el chatbot es ",
      multilingualLabel: "multilingüe",
      languages:
        " y responde en 7 idiomas (español, italiano, inglés, catalán, portugués, francés y alemán), detectando automáticamente el idioma del cliente.",
      footer:
        " A continuación tienes la lista de casos: el chatbot responde de forma autónoma y, cuando hace falta, escala a un operador humano que, desde el panel de administración, puede pausar el bot y chatear directamente con el cliente.",
      whatsappLine: "Todo el servicio se ofrece a través de WhatsApp.",
      customizationLine:
        "Por supuesto, estamos abiertos a todas las personalizaciones necesarias, incluso conectarnos remotamente a la máquina para leer su estado o enviar comandos.",
    },
    it: {
      brand: "DemoWash",
      intro:
        " è una lavanderia demo con diverse sedi in franchising sparse per la Catalogna. Ogni sede ha i propri prezzi e orari e il chatbot adatta le sue risposte alla lavanderia in cui si trova il cliente. Per quanto riguarda le macchine, ogni incidenza è identificata da un codice sul display con la propria procedura documentata: ",
      codesLabel: "",
      multilingual: ". Inoltre, il chatbot è ",
      multilingualLabel: "multilingua",
      languages:
        " e risponde in 7 lingue (spagnolo, italiano, inglese, catalano, portoghese, francese e tedesco), rilevando automaticamente la lingua del cliente.",
      footer:
        " Di seguito trovi l'elenco dei casi: il chatbot risponde in modo autonomo e, quando serve, scala a un operatore umano che, dal pannello di amministrazione, può mettere in pausa il bot e chattare direttamente con il cliente.",
      whatsappLine: "Tutto il servizio è erogato tramite WhatsApp.",
      customizationLine:
        "Ovviamente siamo aperti a tutte le customizzazioni del caso, anche collegarci in remoto alla macchina per leggerne lo stato o lanciare comandi.",
    },
    en: {
      brand: "DemoWash",
      intro:
        " is a demo laundromat chain with multiple franchise locations across Catalonia. Each location has its own prices and opening hours, and the chatbot adapts its replies to the laundry the customer is in. For the machines, each incident is identified by an on-screen code with its documented procedure: ",
      codesLabel: "",
      multilingual: ". On top of that, the chatbot is ",
      multilingualLabel: "multilingual",
      languages:
        " and replies in 7 languages (Spanish, Italian, English, Catalan, Portuguese, French and German), automatically detecting the customer's language.",
      footer:
        " Below you'll find the list of use cases: the chatbot replies on its own and, when needed, escalates to a human operator who, from the admin panel, can pause the bot and chat directly with the customer.",
      whatsappLine: "The whole service runs on WhatsApp.",
      customizationLine:
        "Of course, we're open to any customization you need — including connecting remotely to the machine to read its status or send commands.",
    },
    fr: {
      brand: "DemoWash",
      intro:
        " est une laverie démo avec plusieurs établissements en franchise répartis dans toute la Catalogne. Chaque site a ses propres tarifs et horaires, et le chatbot adapte ses réponses à la laverie où se trouve le client. Pour les machines, chaque incident est identifié par un code à l'écran avec sa procédure documentée : ",
      codesLabel: "",
      multilingual: ". De plus, le chatbot est ",
      multilingualLabel: "multilingue",
      languages:
        " et répond en 7 langues (espagnol, italien, anglais, catalan, portugais, français et allemand), en détectant automatiquement la langue du client.",
      footer:
        " Tu trouveras ci-dessous la liste des cas : le chatbot répond de façon autonome et, si nécessaire, transfère à un opérateur humain qui, depuis le panneau d'administration, peut mettre le bot en pause et discuter directement avec le client.",
      whatsappLine: "L'ensemble du service est fourni via WhatsApp.",
      customizationLine:
        "Bien sûr, nous sommes ouverts à toutes les personnalisations nécessaires, y compris nous connecter à distance à la machine pour lire son état ou envoyer des commandes.",
    },
    pt: {
      brand: "DemoWash",
      intro:
        " é uma lavandaria demo com várias sedes em franquia espalhadas pela Catalunha. Cada sede tem os seus próprios preços e horários, e o chatbot adapta as respostas à lavandaria onde o cliente está. Quanto às máquinas, cada incidência identifica-se por um código no ecrã com o seu procedimento documentado: ",
      codesLabel: "",
      multilingual: ". Além disso, o chatbot é ",
      multilingualLabel: "multilingue",
      languages:
        " e responde em 7 idiomas (espanhol, italiano, inglês, catalão, português, francês e alemão), detetando automaticamente o idioma do cliente.",
      footer:
        " Em seguida tens a lista de casos: o chatbot responde de forma autónoma e, quando é preciso, escala para um operador humano que, a partir do painel de administração, pode pausar o bot e conversar diretamente com o cliente.",
      whatsappLine: "Todo o serviço é prestado através do WhatsApp.",
      customizationLine:
        "Claro, estamos abertos a todas as personalizações necessárias, incluindo ligar-nos remotamente à máquina para ler o seu estado ou enviar comandos.",
    },
    ca: {
      brand: "DemoWash",
      intro:
        " és una bugaderia demo amb diverses seus en franquícia repartides per Catalunya. Cada seu té els seus propis preus i horaris, i el chatbot adapta les respostes a la bugaderia on es troba el client. Pel que fa a les màquines, cada incidència s'identifica amb un codi a la pantalla amb el seu procediment documentat: ",
      codesLabel: "",
      multilingual: ". A més, el chatbot és ",
      multilingualLabel: "multilingüe",
      languages:
        " i respon en 7 idiomes (espanyol, italià, anglès, català, portuguès, francès i alemany), detectant automàticament l'idioma del client.",
      footer:
        " A continuació tens la llista de casos: el chatbot respon de manera autònoma i, quan cal, escala a un operador humà que, des del panell d'administració, pot pausar el bot i xatejar directament amb el client.",
      whatsappLine: "Tot el servei s'ofereix a través de WhatsApp.",
      customizationLine:
        "Per descomptat, estem oberts a totes les personalitzacions necessàries, fins i tot connectar-nos remotament a la màquina per llegir-ne l'estat o enviar comandes.",
    },
    de: {
      brand: "DemoWash",
      intro:
        " ist eine Demo-Wäscherei mit mehreren Franchise-Standorten in Katalonien. Jeder Standort hat eigene Preise und Öffnungszeiten, und der Chatbot passt seine Antworten an die Wäscherei an, in der sich der Kunde befindet. Bei den Maschinen wird jeder Vorfall durch einen Bildschirmcode mit dokumentiertem Verfahren identifiziert: ",
      codesLabel: "",
      multilingual: ". Außerdem ist der Chatbot ",
      multilingualLabel: "mehrsprachig",
      languages:
        " und antwortet in 7 Sprachen (Spanisch, Italienisch, Englisch, Katalanisch, Portugiesisch, Französisch und Deutsch) und erkennt die Sprache des Kunden automatisch.",
      footer:
        " Nachfolgend findest du die Liste der Fälle: Der Chatbot antwortet eigenständig und eskaliert bei Bedarf an einen menschlichen Operator, der vom Admin-Panel aus den Bot pausieren und direkt mit dem Kunden chatten kann.",
      whatsappLine: "Der gesamte Service läuft über WhatsApp.",
      customizationLine:
        "Selbstverständlich sind wir offen für alle nötigen Anpassungen — auch die Fernsteuerung der Maschine, um den Status auszulesen oder Befehle zu senden.",
    },
  }
  const tr = t[lang]
  // Split the WhatsApp sentence so we can render "WhatsApp" as a green
  // inline pill (official brand color) right where it appears naturally
  // in the sentence — no awkward leading badge.
  const [waBefore, waAfter = ""] = tr.whatsappLine.split("WhatsApp")
  const WhatsAppPill = (
    <span className="inline-flex items-center gap-1 bg-[#25D366]/15 text-[#128C7E] px-2 py-0.5 rounded-full text-[13px] font-semibold ring-1 ring-[#25D366]/30 align-baseline">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="w-3.5 h-3.5"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01zM12.05 20.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.27-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.69 8.23-8.23 8.23zm4.51-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.22-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01a.92.92 0 0 0-.67.31c-.23.25-.87.85-.87 2.08 0 1.23.89 2.41 1.02 2.58.12.17 1.76 2.69 4.27 3.77.6.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.23-.17-.48-.29z" />
      </svg>
      WhatsApp
    </span>
  )
  return (
    <>
      <strong className="text-orange-700">{tr.brand}</strong>
      {tr.intro}
      {codes.map((c, i) => (
        <Fragment key={c}>
          <code className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-[14px]">
            {c}
          </code>
          {i < codes.length - 1 ? ", " : ""}
        </Fragment>
      ))}
      {tr.multilingual}
      <strong className="text-orange-700">{tr.multilingualLabel}</strong>
      {tr.languages}
      {tr.footer}{" "}
      {waBefore}
      {WhatsAppPill}
      {waAfter}
      {/* Closing line — invitation to customization, including remote
          machine control. Rendered as its own paragraph below for emphasis. */}
      <div className="mt-3 italic text-orange-800">{tr.customizationLine}</div>
    </>
  )
}

// ----------------------------------------------------------------------------
// ABOUT DEMOWASH POPUP — 6-slide hero carousel triggered by the (i) button
// AND auto-opened once after login. Each slide = one big concept (emoji
// icon + headline + short copy with **bold** keywords). Goal: explain
// "what DemoWash is" in 30 seconds, multilingual, no wall of text.
// Close with X / Esc / backdrop. Navigate with ← / → / dot buttons /
// keyboard arrows / Next button.
// ----------------------------------------------------------------------------
type AboutSlide = {
  // Emoji used as the slide's hero icon. Renders inside a green circle.
  icon: string
  // Big slide title (24–28 px, bold, brand green).
  title: string
  // Short copy under the title. Inline **bold** markers are rendered as
  // emerald-700 bold spans — pick 1–2 key phrases per slide, no more.
  body: string
}

type AboutCopy = {
  title: string           // popup header (always "DEMO INFO" — kept localized for a11y)
  closeLabel: string
  nextLabel: string
  prevLabel: string
  ctaLabel: string        // text on the last-slide "Got it, let's try!" button
  slideAria: (n: number, total: number) => string
  slides: AboutSlide[]
}

// Copy is hand-written per language (NOT machine-translated): each slide
// is short, direct, and uses **bold** for the concept the reader should
// remember at a glance. Keep this section in sync across the 7 langs.
const ABOUT_DEMOWASH: Record<IntroLang, AboutCopy> = {
  es: {
    title: "DEMO INFO",
    closeLabel: "Cerrar",
    nextLabel: "Siguiente",
    prevLabel: "Anterior",
    ctaLabel: "¡Empezamos!",
    slideAria: (n, total) => `Diapositiva ${n} de ${total}`,
    slides: [
      {
        icon: "logo:demowash",
        title: "Pruébalo como un cliente",
        body: "Esto es una **simulación en WhatsApp** del asistente virtual de **DemoWash**, una **red ficticia de lavanderías en franquicia** con sedes en Cataluña:\n\n**TERRASSA · RUBÍ · SANT CUGAT · BARCELONA**\n\nEscribe al chatbot y pruébalo como si fueras un usuario.",
      },
      {
        icon: "⚙️",
        title: "Trabaja por ti 24/7",
        body: "Responde a las preguntas frecuentes, recoge los datos de las incidencias y **libera al operador** de las tareas repetitivas.",
      },
      {
        icon: "🏪",
        title: "Conoce cada sede",
        body: "Cada realidad local tiene sus **horarios, precios, procedimientos**. El bot **reconoce la sede** y usa la información correcta.",
      },
      {
        icon: "🤝",
        title: "Escala al operador",
        body: "Si hace falta un humano, el caso pasa al **operador de la sede**, que toma el control de la conversación cuando el bot no basta.",
      },
      {
        icon: "🌍",
        title: "Sin barreras lingüísticas",
        body: "Gracias a la **traducción en tiempo real**, el operador habla con el cliente **en su propio idioma** — escribe como quiera, el cliente lo recibe en el suyo.",
      },
      {
        icon: "🚀",
        title: "¡Listo para empezar!",
        body: "Pulsa **New Chat** para simular un cliente de WhatsApp. A la **izquierda** la lista de pruebas, en el **centro** la conversación y a la **derecha** algunos casos de uso con los que se ha entrenado el modelo — todo **personalizable**.",
      },
    ],
  },
  it: {
    title: "DEMO INFO",
    closeLabel: "Chiudi",
    nextLabel: "Avanti",
    prevLabel: "Indietro",
    ctaLabel: "Iniziamo!",
    slideAria: (n, total) => `Diapositiva ${n} di ${total}`,
    slides: [
      {
        icon: "logo:demowash",
        title: "Provalo come se fossi un cliente",
        body: "Questa è una **simulazione su WhatsApp** dell'assistente virtuale di **DemoWash**, una **rete di lavanderie in franchising fittizia** con sedi in Cataluña:\n\n**TERRASSA · RUBÍ · SANT CUGAT · BARCELONA**\n\nScrivi al chatbot e provalo come se fossi un cliente.",
      },
      {
        icon: "⚙️",
        title: "Lavora per te 24/7",
        body: "Risponde alle domande frequenti, raccoglie i dati delle incidenze e **libera l'operatore** dai compiti ripetitivi.",
      },
      {
        icon: "🏪",
        title: "Conosce ogni sede",
        body: "Ogni realtà locale ha i suoi **orari, prezzi, procedure**. Il bot **riconosce la sede** e usa le informazioni giuste.",
      },
      {
        icon: "🤝",
        title: "Scala all'operatore",
        body: "Se serve un umano, il caso passa all'**operatore della sede**, che prende in mano la conversazione quando il bot non basta.",
      },
      {
        icon: "🌍",
        title: "Niente barriere linguistiche",
        body: "Grazie alla **traduzione in tempo reale**, l'operatore parla con il cliente **nella sua lingua** — scrive come preferisce e il cliente riceve tutto nella propria.",
      },
      {
        icon: "🚀",
        title: "Pronto per iniziare!",
        body: "Clicca su **New Chat** per simulare un cliente WhatsApp. A **sinistra** la lista delle prove, al **centro** la chat e a **destra** alcuni casi d'uso su cui il modello è stato addestrato — tutto **personalizzabile**.",
      },
    ],
  },
  en: {
    title: "DEMO INFO",
    closeLabel: "Close",
    nextLabel: "Next",
    prevLabel: "Previous",
    ctaLabel: "Let's start!",
    slideAria: (n, total) => `Slide ${n} of ${total}`,
    slides: [
      {
        icon: "logo:demowash",
        title: "Try it like a customer would",
        body: "This is a **WhatsApp simulation** of the virtual assistant of **DemoWash**, a **fictional franchise network of laundromats** with locations in Catalonia:\n\n**TERRASSA · RUBÍ · SANT CUGAT · BARCELONA**\n\nChat with the bot and try it as if you were a real customer.",
      },
      {
        icon: "⚙️",
        title: "Works for you 24/7",
        body: "Answers FAQs, collects incident details and **frees your operators** from repetitive work.",
      },
      {
        icon: "🏪",
        title: "Knows every location",
        body: "Every local site has its own **hours, prices, procedures**. The bot **identifies the location** and uses the right information.",
      },
      {
        icon: "🤝",
        title: "Escalates to a human",
        body: "If a human is needed, the case goes to the **local operator**, who takes over the conversation when the bot isn't enough.",
      },
      {
        icon: "🌍",
        title: "No language barriers",
        body: "Thanks to **real-time translation**, the operator talks to the customer **in their own language** — type in whatever language you like, the customer reads it in theirs.",
      },
      {
        icon: "🚀",
        title: "Ready to start!",
        body: "Click **New Chat** to simulate a WhatsApp customer. On the **left** the list of test chats, in the **center** the conversation, and on the **right** a few use cases the model was trained on — all of it **customizable**.",
      },
    ],
  },
  fr: {
    title: "DEMO INFO",
    closeLabel: "Fermer",
    nextLabel: "Suivant",
    prevLabel: "Précédent",
    ctaLabel: "C'est parti !",
    slideAria: (n, total) => `Diapositive ${n} sur ${total}`,
    slides: [
      {
        icon: "logo:demowash",
        title: "Essayez-le comme un client",
        body: "C'est une **simulation sur WhatsApp** de l'assistant virtuel de **DemoWash**, un **réseau fictif de laveries en franchise** avec des sites en Catalogne :\n\n**TERRASSA · RUBÍ · SANT CUGAT · BARCELONA**\n\nDiscutez avec le chatbot et essayez-le comme le ferait un vrai client.",
      },
      {
        icon: "⚙️",
        title: "Travaille pour vous 24/7",
        body: "Répond aux questions fréquentes, collecte les détails des incidents et **libère vos opérateurs** des tâches répétitives.",
      },
      {
        icon: "🏪",
        title: "Connaît chaque site",
        body: "Chaque réalité locale a ses **horaires, tarifs, procédures**. Le bot **identifie le site** et utilise les bonnes informations.",
      },
      {
        icon: "🤝",
        title: "Transfert à l'opérateur",
        body: "Si un humain est nécessaire, le cas passe à l'**opérateur local**, qui prend la main sur la conversation quand le bot ne suffit pas.",
      },
      {
        icon: "🌍",
        title: "Aucune barrière linguistique",
        body: "Grâce à la **traduction en temps réel**, l'opérateur parle au client **dans sa propre langue** — écrivez dans la langue de votre choix, le client la reçoit dans la sienne.",
      },
      {
        icon: "🚀",
        title: "Prêt à commencer !",
        body: "Cliquez sur **New Chat** pour simuler un client WhatsApp. À **gauche** la liste des essais, au **centre** la conversation et à **droite** quelques cas d'usage sur lesquels le modèle a été entraîné — le tout **personnalisable**.",
      },
    ],
  },
  pt: {
    title: "DEMO INFO",
    closeLabel: "Fechar",
    nextLabel: "Seguinte",
    prevLabel: "Anterior",
    ctaLabel: "Vamos começar!",
    slideAria: (n, total) => `Slide ${n} de ${total}`,
    slides: [
      {
        icon: "logo:demowash",
        title: "Experimenta como um cliente",
        body: "Esta é uma **simulação no WhatsApp** do assistente virtual da **DemoWash**, uma **rede fictícia de lavandarias em franchising** com unidades na Catalunha:\n\n**TERRASSA · RUBÍ · SANT CUGAT · BARCELONA**\n\nConversa com o chatbot e experimenta como faria um cliente.",
      },
      {
        icon: "⚙️",
        title: "Trabalha por ti 24/7",
        body: "Responde às perguntas frequentes, recolhe os dados das ocorrências e **liberta os operadores** das tarefas repetitivas.",
      },
      {
        icon: "🏪",
        title: "Conhece cada unidade",
        body: "Cada realidade local tem os seus **horários, preços, procedimentos**. O bot **identifica a unidade** e usa as informações certas.",
      },
      {
        icon: "🤝",
        title: "Encaminha ao operador",
        body: "Se for preciso um humano, o caso passa ao **operador local**, que assume a conversa quando o bot não chega.",
      },
      {
        icon: "🌍",
        title: "Sem barreiras linguísticas",
        body: "Graças à **tradução em tempo real**, o operador fala com o cliente **na sua própria língua** — escreve no idioma que quiseres, o cliente recebe no dele.",
      },
      {
        icon: "🚀",
        title: "Pronto para começar!",
        body: "Clica em **New Chat** para simular um cliente de WhatsApp. À **esquerda** a lista de testes, ao **centro** a conversa e à **direita** alguns casos de uso com que o modelo foi treinado — tudo **personalizável**.",
      },
    ],
  },
  ca: {
    title: "DEMO INFO",
    closeLabel: "Tancar",
    nextLabel: "Següent",
    prevLabel: "Anterior",
    ctaLabel: "Comencem!",
    slideAria: (n, total) => `Diapositiva ${n} de ${total}`,
    slides: [
      {
        icon: "logo:demowash",
        title: "Prova'l com un client",
        body: "Això és una **simulació al WhatsApp** de l'assistent virtual de **DemoWash**, una **xarxa fictícia de bugaderies en franquícia** amb seus a Catalunya:\n\n**TERRASSA · RUBÍ · SANT CUGAT · BARCELONA**\n\nEscriu al chatbot i prova'l com ho faria un client real.",
      },
      {
        icon: "⚙️",
        title: "Treballa per tu 24/7",
        body: "Respon les preguntes habituals, recull les dades de les incidències i **allibera l'operador** de les tasques repetitives.",
      },
      {
        icon: "🏪",
        title: "Coneix cada seu",
        body: "Cada realitat local té els seus **horaris, preus, procediments**. El bot **reconeix la seu** i fa servir la informació correcta.",
      },
      {
        icon: "🤝",
        title: "Escala a l'operador",
        body: "Si cal un humà, el cas passa a l'**operador de la seu**, que pren el control de la conversa quan el bot no n'hi ha prou.",
      },
      {
        icon: "🌍",
        title: "Sense barreres lingüístiques",
        body: "Gràcies a la **traducció en temps real**, l'operador parla amb el client **en la seva pròpia llengua** — escriu en l'idioma que vulguis, el client el rep en el seu.",
      },
      {
        icon: "🚀",
        title: "A punt per començar!",
        body: "Clica **New Chat** per simular un client de WhatsApp. A l'**esquerra** la llista de proves, al **centre** la conversa i a la **dreta** alguns casos d'ús amb què s'ha entrenat el model — tot **personalitzable**.",
      },
    ],
  },
  de: {
    title: "DEMO INFO",
    closeLabel: "Schließen",
    nextLabel: "Weiter",
    prevLabel: "Zurück",
    ctaLabel: "Los geht's!",
    slideAria: (n, total) => `Folie ${n} von ${total}`,
    slides: [
      {
        icon: "logo:demowash",
        title: "Probier's wie ein Kunde",
        body: "Das ist eine **WhatsApp-Simulation** des virtuellen Assistenten von **DemoWash**, einem **fiktiven Franchise-Netzwerk von Waschsalons** mit Standorten in Katalonien:\n\n**TERRASSA · RUBÍ · SANT CUGAT · BARCELONA**\n\nSchreib dem Chatbot und probier ihn aus wie ein echter Kunde.",
      },
      {
        icon: "⚙️",
        title: "Arbeitet 24/7 für dich",
        body: "Beantwortet häufige Fragen, sammelt Vorfall-Details und **entlastet deine Mitarbeiter** von Routineaufgaben.",
      },
      {
        icon: "🏪",
        title: "Kennt jeden Standort",
        body: "Jeder lokale Standort hat eigene **Öffnungszeiten, Preise, Abläufe**. Der Bot **erkennt den Standort** und nutzt die richtigen Infos.",
      },
      {
        icon: "🤝",
        title: "Übergibt an den Mitarbeiter",
        body: "Wird ein Mensch gebraucht, geht der Fall an den **lokalen Mitarbeiter**, der das Gespräch übernimmt, wenn der Bot nicht reicht.",
      },
      {
        icon: "🌍",
        title: "Keine Sprachbarrieren",
        body: "Dank **Echtzeit-Übersetzung** spricht der Mitarbeiter mit dem Kunden **in dessen eigener Sprache** — schreib in der Sprache, die du willst, der Kunde liest sie in seiner.",
      },
      {
        icon: "🚀",
        title: "Bereit loszulegen!",
        body: "Klick auf **New Chat**, um einen WhatsApp-Kunden zu simulieren. **Links** die Liste der Test-Chats, in der **Mitte** das Gespräch und **rechts** einige Anwendungsfälle, mit denen das Modell trainiert wurde — alles **anpassbar**.",
      },
    ],
  },
}

// Inline renderer for the slide body: parses **bold** markers and the
// literal "DemoWash" brand. **bold** → emerald-700 semibold. "DemoWash"
// → emerald-700 bold (kept slightly bigger as the brand mark). Plain
// text passes through. Two passes, simple and robust.
function renderSlideBody(text: string) {
  // Split on the **bold** markers first, then within each plain segment
  // also split on the brand name. This guarantees both work even when
  // the brand is itself wrapped in bold (it stays bold + brand-colored).
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g)
  return boldParts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-emerald-700 font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    // Plain segment — handle the brand mark inside it.
    const brandParts = part.split(/(DemoWash)/g)
    return (
      <Fragment key={i}>
        {brandParts.map((bp, j) =>
          bp === "DemoWash" ? (
            <strong
              key={j}
              className="text-emerald-700 font-bold tracking-tight"
            >
              DemoWash
            </strong>
          ) : (
            <Fragment key={j}>{bp}</Fragment>
          ),
        )}
      </Fragment>
    )
  })
}

function AboutDemowashPopup({
  lang,
  onClose,
}: {
  lang: IntroLang
  onClose: () => void
}) {
  const [slide, setSlide] = useState(0)
  const tr = ABOUT_DEMOWASH[lang] ?? ABOUT_DEMOWASH.es
  const slides = tr.slides
  const totalSlides = slides.length
  const isLast = slide === totalSlides - 1
  const isFirst = slide === 0
  const current = slides[slide]

  // Keyboard nav: Esc closes, ←/→ navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowRight")
        setSlide((s) => Math.min(s + 1, totalSlides - 1))
      else if (e.key === "ArrowLeft") setSlide((s) => Math.max(s - 1, 0))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, totalSlides])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr.title}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand-tinted top stripe + close X (floats over the hero area). */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 shadow-sm border border-slate-200 flex items-center justify-center transition"
          aria-label={tr.closeLabel}
        >
          <X className="w-4 h-4" />
        </button>

        {/* HERO — emoji in a soft brand-green pillow + title + body. */}
        <div
          className="px-8 pt-10 pb-7 text-center bg-gradient-to-b from-emerald-50/60 via-white to-white"
          aria-label={tr.slideAria(slide + 1, totalSlides)}
        >
          {/* Step counter chip — small, discreet, lets the user know
              where they are without dominating the layout. */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold tracking-wider uppercase mb-5">
            {slide + 1} / {totalSlides}
          </div>

          {/* Focal point — emoji icon inside a brand-green circle on most
              slides, OR a wordmark logo when `icon === "logo:demowash"`
              (the opening slide). The wordmark presents the brand more
              elegantly than any emoji would: "Demo" in slate-near-black
              and "Wash" in brand emerald, sitting on a soft tile so it
              matches the visual rhythm of the other slides' icon pills. */}
          {current.icon === "logo:demowash" ? (
            <div className="mx-auto w-fit px-7 py-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-100 shadow-sm mb-5 select-none">
              <div className="text-[40px] font-extrabold tracking-tight leading-none">
                <span className="text-slate-900">Demo</span>
                <span className="text-emerald-600">Wash</span>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-[56px] leading-none shadow-inner mb-5 select-none">
              <span aria-hidden="true">{current.icon}</span>
            </div>
          )}

          {/* Title — big, bold, brand colour. */}
          <h3 className="text-[26px] font-bold text-emerald-700 leading-tight tracking-tight mb-3 px-2">
            {current.title}
          </h3>

          {/* Body — readable size, inline **bold** highlights in green. */}
          <p className="text-[17px] text-slate-700 leading-[1.65] max-w-md mx-auto">
            {renderSlideBody(current.body)}
          </p>

          {/* Last slide gets a prominent CTA button — this is the
              "now go try the bot" call to action Andrea wants to land
              hard. Replaces the boring "Close" footer button. */}
          {isLast && (
            <button
              type="button"
              onClick={onClose}
              className="mt-7 inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-7 py-3 rounded-full text-[16px] font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all hover:-translate-y-0.5"
            >
              {tr.ctaLabel}
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>

        {/* Footer — prev / dots / next. Hidden buttons (not dots) on the
            last slide because the CTA above replaces them. */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSlide((s) => Math.max(s - 1, 0))}
            disabled={isFirst}
            className="text-slate-500 hover:text-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-sm font-medium px-2 py-1 rounded transition"
            aria-label={tr.prevLabel}
          >
            ← {tr.prevLabel}
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={tr.slideAria(i + 1, totalSlides)}
                aria-current={slide === i ? "true" : undefined}
                className={
                  "h-2 rounded-full transition-all " +
                  (slide === i
                    ? "bg-emerald-600 w-6"
                    : "bg-slate-300 hover:bg-slate-400 w-2")
                }
              />
            ))}
          </div>

          {!isLast ? (
            <button
              type="button"
              onClick={() => setSlide((s) => Math.min(s + 1, totalSlides - 1))}
              className="text-emerald-700 hover:text-emerald-900 text-sm font-semibold px-3 py-1 rounded hover:bg-emerald-100 transition"
              aria-label={tr.nextLabel}
            >
              {tr.nextLabel} →
            </button>
          ) : (
            // Symmetry placeholder so the dot row stays perfectly
            // centered when the CTA replaces the Next button.
            <span className="w-[78px]" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// CREATE STANDALONE TASK MODAL — opened from the Kanban "+ New Task" button.
// Backend `POST /todos` requires dialogId/messageType/messageContent because
// the schema was designed for chat-derived tasks. For standalone tasks we
// pass synthetic stable values: dialogId="manual-<timestamp>", type="manual",
// messageContent equal to the user-typed task body. The detail modal already
// handles the case where the related chat session no longer exists.
// ----------------------------------------------------------------------------
function CreateStandaloneTaskModal({
  user,
  onClose,
  onCreated,
}: {
  user: PlaygroundUser
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<Priority>("Medio")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const res = await playFetch(`${API_BASE}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogId: `manual-${Date.now()}`,
          messageType: "manual",
          messageContent: body.trim() || title.trim(),
          chatbotResponse: null,
          commentTitle: title.trim(),
          priority,
          createdBy: user,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.message || data.error || "Failed to create task")
        return
      }
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl p-6 w-[520px] max-h-[85vh] overflow-y-auto shadow-2xl space-y-4"
      >
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-bold">New Task</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">
            Description (optional)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Details, context, expected outcome..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">Priority</label>
          <div className="flex gap-2">
            {(["Alto", "Medio", "Basso"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-3 py-1 rounded-full border text-sm ${
                  priority === p ? PRIORITY_COLOR[p] : "bg-white text-gray-500"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Task"}
        </button>
      </form>
    </div>
  )
}

// ----------------------------------------------------------------------------
// KANBAN SCREEN — dedicated page
// ----------------------------------------------------------------------------
function KanbanScreen({
  user,
  onLogout,
}: {
  user: PlaygroundUser
  onLogout: () => void
}) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [openTodo, setOpenTodo] = useState<Todo | null>(null)
  const [filter, setFilter] = useState<"" | Priority>("")
  const [showNewTask, setShowNewTask] = useState(false)
  const [workspaceName, setWorkspaceName] = useState<string>("Ecolaundry")
  // Seed customChatbotId from the URL slug or from localStorage so the very
  // first render already knows which demo we're on. Without this the UI
  // briefly flashes the Ecolaundry layout (kanban button + Spanish usecases)
  // every time the visitor arrives via login redirect, because
  // `/workspace-info` is fetched async.
  const [customChatbotId, setCustomChatbotId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const m = window.location.pathname.match(/^\/demo\/([a-z0-9-]+)/)
    if (m) return m[1]
    return localStorage.getItem("playgroundDemoSlug")
  })
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    // Same logic as PlaygroundLanding above: the URL slug wins over
    // anything `/workspace-info` answers with, so a stale workspaceId
    // in localStorage right after a login redirect can't flip the demo.
    const urlMatch = window.location.pathname.match(/^\/demo\/([a-z0-9-]+)/)
    const urlSlug = urlMatch?.[1] ?? null
    playFetch(`${API_BASE}/workspace-info`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) setWorkspaceName(data.name)
        if (data?.chatbotId && !urlSlug) setCustomChatbotId(data.chatbotId)
      })
      .catch(() => {/* keep default */})
  }, [])

  const fetchTodos = useCallback(async () => {
    const [todosRes, msgRes] = await Promise.all([
      playFetch(`${API_BASE}/todos`).then((r) => r.json()),
      playFetch(`${API_BASE}/messages`).then((r) => r.json()),
    ])
    setTodos(todosRes.todos || [])
    setSessions(msgRes.sessions || [])
  }, [])

  useEffect(() => {
    fetchTodos()
    const i = setInterval(fetchTodos, POLL_INTERVAL)
    return () => clearInterval(i)
  }, [fetchTodos])

  useEffect(() => {
    if (openTodo) {
      const updated = todos.find((t) => t.id === openTodo.id)
      if (updated) setOpenTodo(updated)
    }
  }, [todos, openTodo])

  // Deep-link: ?todo=<id> from "chat row with todo" click — auto-open that card
  useEffect(() => {
    const todoParam = searchParams.get("todo")
    if (!todoParam || todos.length === 0) return
    const target = todos.find((t) => t.id === todoParam)
    if (target) {
      setOpenTodo(target)
      const next = new URLSearchParams(searchParams)
      next.delete("todo")
      setSearchParams(next, { replace: true })
    }
  }, [todos, searchParams, setSearchParams])

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const { source, destination, draggableId } = result
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return
    const newStatus = destination.droppableId as TodoStatus
    setTodos((prev) =>
      prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t))
    )
    await playFetch(`${API_BASE}/todos/${draggableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, position: destination.index }),
    })
    fetchTodos()
  }

  const filteredTodos = useMemo(
    () => (filter ? todos.filter((t) => t.priority === filter) : todos),
    [todos, filter]
  )

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      <TopBar
        user={user}
        onLogout={onLogout}
        title={workspaceName}
        hideUserChip={customChatbotId === "demowash"}
        customChatbotId={customChatbotId}
        leftSlot={
          <Link
            to="/demo/ecolaundry"
            className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to chat
          </Link>
        }
      />

      <div className="px-4 py-3 bg-white border-b flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-bold text-lg">Kanban Board</h2>
          <p className="text-xs text-gray-500">
            {todos.length} task{todos.length !== 1 ? "s" : ""} total · drag cards
            to change status
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowNewTask(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
          <span className="text-xs text-gray-500 ml-3">Filter priority:</span>
          {(["", "Alto", "Medio", "Basso"] as const).map((p) => (
            <button
              key={p || "all"}
              onClick={() => setFilter(p)}
              className={`px-3 py-1 rounded-full border text-xs ${
                filter === p
                  ? p === ""
                    ? "bg-gray-700 text-white border-gray-700"
                    : PRIORITY_COLOR[p as Priority]
                  : "bg-white text-gray-500"
              }`}
            >
              {p || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 min-h-0">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-5 gap-4 min-w-[1100px] h-full">
            {STATUS_COLUMNS.map((col) => {
              const columnTodos = filteredTodos
                .filter((t) => t.status === col.id)
                .sort((a, b) => a.position - b.position)
              return (
                <div
                  key={col.id}
                  className={`${col.bg} rounded-xl flex flex-col overflow-hidden border`}
                >
                  <div
                    className={`${col.headerBg} px-3 py-2 font-bold text-xs text-gray-700 flex justify-between items-center shrink-0`}
                  >
                    <span>{col.title}</span>
                    <span className="bg-white/60 rounded-full px-2 text-[10px]">
                      {columnTodos.length}
                    </span>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto p-2 space-y-2 transition ${
                          snapshot.isDraggingOver ? "bg-emerald-50" : ""
                        }`}
                      >
                        {columnTodos.map((t, idx) => (
                          <Draggable key={t.id} draggableId={t.id} index={idx}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                onClick={() => setOpenTodo(t)}
                                className={`bg-white p-3 rounded-lg shadow-sm border hover:shadow-md cursor-pointer transition ${
                                  snap.isDragging ? "ring-2 ring-emerald-400" : ""
                                }`}
                              >
                                <div className="font-medium text-sm mb-2 leading-tight">
                                  {t.commentTitle}
                                </div>
                                <div className="text-xs text-gray-500 mb-2 line-clamp-2">
                                  {t.messageContent}
                                </div>
                                <div className="flex justify-between items-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] border ${
                                      PRIORITY_COLOR[t.priority]
                                    }`}
                                  >
                                    {t.priority}
                                  </span>
                                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                    💬 {t.comments.length}
                                  </span>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-2 border-t pt-1">
                                  by {t.createdBy} ·{" "}
                                  {new Date(t.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {columnTodos.length === 0 && !snapshot.isDraggingOver && (
                          <div className="text-center text-xs text-gray-400 py-8">
                            No tasks
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      </div>

      {openTodo && (
        <TodoDetailModal
          todo={openTodo}
          sessions={sessions}
          user={user}
          onClose={() => setOpenTodo(null)}
          onChanged={fetchTodos}
        />
      )}

      {showNewTask && (
        <CreateStandaloneTaskModal
          user={user}
          onClose={() => setShowNewTask(false)}
          onCreated={() => {
            setShowNewTask(false)
            fetchTodos()
          }}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// ROOT
// ----------------------------------------------------------------------------
export default function PlaygroundPage() {
  const { user, workspaceId, login, logout } = useAuth()
  if (!user) return <LoginScreen onLogin={login} />
  return (
    <Routes>
      <Route
        index
        element={
          <ChatScreen user={user} workspaceId={workspaceId} onLogout={logout} />
        }
      />
      <Route
        path="kanban"
        element={<KanbanScreen user={user} onLogout={logout} />}
      />
    </Routes>
  )
}
