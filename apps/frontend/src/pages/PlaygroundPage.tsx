import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd"
import {
  ArrowLeft,
  Check,
  ClipboardList,
  KanbanSquare,
  LogOut,
  Mail,
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

const ALLOWED_USERS = {
  ANDREA: { password: "Admin123", color: "#2563eb" },
  OLGA: { password: "Admin123", color: "#db2777" },
  admin: { password: "Admin123", color: "#059669" },
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")
    const workspaceId = params.get("workspaceId")
    const path = window.location.pathname

    if (token && workspaceId) {
      localStorage.setItem("playgroundToken", token)
      localStorage.setItem("playgroundWorkspaceId", workspaceId)
      localStorage.setItem("playgroundUser", "ANDREA")
      setUser("ANDREA")
    } else if (path.startsWith("/demo/demowash") && !localStorage.getItem("playgroundWorkspaceId")) {
      // Public entry point for Demowash demo: resolve the workspace id from
      // the backend so the user can log in with admin/Admin123 without
      // needing token+workspaceId query params.
      fetch(`/api/v1/playground/resolve-demo/demowash`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.workspaceId) {
            localStorage.setItem("playgroundWorkspaceId", data.workspaceId)
          }
        })
        .catch(() => {/* silent fail — login will still fail visibly */})
    } else {
      const isBasePath =
        path === "/demo/ecolaundry" || path === "/demo/ecolaundry/"
      if (isBasePath && localStorage.getItem("playgroundToken")) {
        localStorage.removeItem("playgroundToken")
        localStorage.removeItem("playgroundWorkspaceId")
        localStorage.removeItem("playgroundUser")
        setUser(null)
      }
    }
  }, [])

  const login = (u: PlaygroundUser) => {
    localStorage.setItem("playgroundUser", u)
    setUser(u)
  }
  const logout = () => {
    localStorage.removeItem("playgroundUser")
    localStorage.removeItem("playgroundToken")
    localStorage.removeItem("playgroundWorkspaceId")
    setUser(null)
  }
  return { user, login, logout }
}

function LoginScreen({ onLogin }: { onLogin: (u: PlaygroundUser) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
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
}: {
  user: PlaygroundUser
  onLogout: () => void
  rightSlot?: React.ReactNode
  leftSlot?: React.ReactNode
  title?: string
  hideUserChip?: boolean
}) {
  return (
    <header className="bg-emerald-700 text-white px-6 py-3 flex justify-between items-center shadow shrink-0 z-10">
      <div className="flex items-center gap-4">
        {leftSlot}
        <h1 className="text-xl font-bold">Playground</h1>
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
// Demo-only overlay. The chat session has no `title` field on the backend
// today; the value is stored in localStorage by the parent component.
// When backend support is added, swap the prop callback for an API call.
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
  onLogout,
}: {
  user: PlaygroundUser
  onLogout: () => void
}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [usecasesMd, setUsecasesMd] = useState("")
  // 🌍 Selected language for the Use Cases panel (markdown + intro card).
  // Default is Spanish since the source usecases.md is in Spanish.
  const [usecasesLang, setUsecasesLang] = useState<
    "es" | "it" | "en" | "fr" | "pt" | "ca" | "de"
  >("es")
  const [usecasesLoading, setUsecasesLoading] = useState(false)
  // 🎯 CTA gating: show Survey + Contact buttons only when the visitor
  // arrived from the public demo page (https://www.echatbot.ai/demo/demowash).
  // We persist the flag in sessionStorage so the buttons keep showing after
  // an in-app navigation that wipes document.referrer.
  const [isFromDemoLink, setIsFromDemoLink] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return sessionStorage.getItem("playground:fromDemoLink") === "1"
    } catch {
      return false
    }
  })
  const [workspaceName, setWorkspaceName] = useState<string>("Ecolaundry")
  const [customChatbotId, setCustomChatbotId] = useState<string | null>(null)
  // 🎯 In-app survey + contact popup state. We render the routes inside
  // an iframe overlay instead of using window.open() — the latter spawns
  // a browser-level popup window that is frequently blocked by popup
  // blockers and breaks the in-app UX.
  const [showSurveyModal, setShowSurveyModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
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
  // ChatSession.feedback respectively.
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

  // 🎯 Referrer check — done once on mount. We accept any URL whose origin
  // is https://www.echatbot.ai AND whose path starts with /demo/demowash
  // (so /demo/demowash, /demo/demowash/, /demo/demowash?utm=… all qualify).
  // Once detected, we persist the flag in sessionStorage so subsequent
  // in-app navigation doesn't lose it.
  useEffect(() => {
    if (isFromDemoLink) return
    try {
      const ref = document.referrer
      if (!ref) return
      const u = new URL(ref)
      const okOrigin = u.origin === "https://www.echatbot.ai"
      const okPath = u.pathname === "/demo/demowash" || u.pathname.startsWith("/demo/demowash/")
      if (okOrigin && okPath) {
        sessionStorage.setItem("playground:fromDemoLink", "1")
        setIsFromDemoLink(true)
      }
    } catch {
      // Malformed referrer URL — ignore
    }
  }, [isFromDemoLink])

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
    playFetch(`${API_BASE}/workspace-info`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) setWorkspaceName(data.name)
        if (data?.chatbotId) setCustomChatbotId(data.chatbotId)
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
  }, [fetchAll])

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
        rightSlot={
          <div className="flex items-center gap-2">
            {/* 🎯 Survey + Contact us — DemoWash-only CTA. Both conditions
                must hold: the workspace must be the DemoWash demo AND the
                visitor must have arrived from https://www.echatbot.ai/demo/demowash.
                This way internal users opening DemoWash directly don't see
                them, and people landing on a different workspace from any
                referrer don't see them either. Both open in a popup window. */}
            {isFromDemoLink && customChatbotId === "demowash" && (
              <>
                <button
                  onClick={() => setShowSurveyModal(true)}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow"
                  title="Take the demo survey"
                >
                  <ClipboardList className="w-4 h-4" />
                  Survey
                </button>
                <button
                  onClick={() => setShowContactModal(true)}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow"
                  title="Contact us"
                >
                  <Mail className="w-4 h-4" />
                  Contact us
                </button>
              </>
            )}
            <button
              onClick={() => setShowNewChat(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
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
          <div className="px-3 py-2 bg-emerald-600 text-white shrink-0">
            <span className="font-semibold text-sm">Chats</span>
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
                    {customTitle && (
                      <div className="text-[10px] text-gray-500 truncate">
                        {primary}
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
              const primary = activeSession
                ? phone || (!isGenericName ? name : null) || "Chat"
                : "Select a chat"
              const secondary = !isGenericName && phone ? name : null
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
                    {secondary && (
                      <div className="text-xs opacity-80 truncate">
                        {secondary}
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
            <span>Use Cases</span>
            {/* 🌍 Language flags — click to translate the whole Use Cases
                block (intro card + markdown content) into the target language.
                Backend translates on first request and caches. Rendered as
                inline SVG (not emoji) so they render consistently on every
                OS/browser, including macOS Chrome which sometimes drops
                flag-emoji glyphs. */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  // 🇪🇸 Spanish first (default), 🇪🇸+🇦🇩 Catalan kept right
                  // next to Spanish because the two languages live in the
                  // same cultural/linguistic neighborhood (most Catalan
                  // speakers also speak Spanish, and the demo tenant is in
                  // Catalonia). The rest follows EU-language conventions.
                  { code: "es", label: "ES" },
                  { code: "ca", label: "CA" },
                  { code: "it", label: "IT" },
                  { code: "en", label: "EN" },
                  { code: "fr", label: "FR" },
                  { code: "pt", label: "PT" },
                  { code: "de", label: "DE" },
                ] as const
              ).map((opt) => {
                const active = usecasesLang === opt.code
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setUsecasesLang(opt.code)}
                    disabled={usecasesLoading && !active}
                    title={opt.label}
                    aria-label={`Translate to ${opt.label}`}
                    className={
                      "leading-none p-1 rounded transition-all " +
                      (active
                        ? "bg-white ring-2 ring-white shadow-md scale-110"
                        : "opacity-80 hover:opacity-100 hover:bg-white/20")
                    }
                  >
                    <FlagSvg code={opt.code} />
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 prose prose-sm max-w-none break-words relative">
            {usecasesLoading && (
              <div className="absolute top-2 right-3 text-xs text-slate-500 flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                Translating…
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
      {/* 🎯 Survey + Contact modals — in-app popups that load the /survey
          and /contact routes in an iframe. Closes on ESC, on click-outside,
          or via the X button. Using an iframe (vs. embedding the route
          components directly) keeps each panel self-contained and avoids
          prop/state coupling with the playground. */}
      {showSurveyModal && (
        <IframeModal
          src="/survey"
          title="Survey"
          icon={<ClipboardList className="w-4 h-4" />}
          onClose={() => setShowSurveyModal(false)}
        />
      )}
      {showContactModal && (
        <IframeModal
          src="/contact"
          title="Contact us"
          icon={<Mail className="w-4 h-4" />}
          onClose={() => setShowContactModal(false)}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// IframeModal — generic in-app overlay that hosts an internal route inside
// an iframe. Replaces the old window.open() approach which spawned a
// browser-level popup window often blocked by popup blockers. Shared by
// both Survey (/survey) and Contact us (/contact) buttons.
// ----------------------------------------------------------------------------
function IframeModal({
  src,
  title,
  icon,
  onClose,
}: {
  src: string
  title: string
  icon: React.ReactNode
  onClose: () => void
}) {
  // Close on ESC for keyboard accessibility.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            {icon}
            {title}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-200"
            title="Close"
            aria-label={`Close ${title}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <iframe
          src={src}
          title={title}
          className="flex-1 w-full border-0"
        />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// FLAG SVGs — inline language-selector flags for the Use Cases header. We
// render SVG (not emoji) because flag-emoji glyphs are inconsistently
// supported across macOS / Chrome / Windows fonts: on systems without the
// emoji font the button shows up as an empty rectangle. SVG is always
// crisp, scales freely, and renders the same everywhere.
// ----------------------------------------------------------------------------
function FlagSvg({ code }: { code: "es" | "it" | "en" | "fr" | "pt" | "ca" | "de" }) {
  // Common props: ~28×20 (3:2 ratio) — readable but compact.
  const common = {
    width: 28,
    height: 20,
    viewBox: "0 0 9 6",
    preserveAspectRatio: "xMidYMid slice",
    className: "rounded-[3px] shadow-sm block",
    "aria-hidden": true as const,
  }
  switch (code) {
    case "es":
      // Spain: red / yellow (double-height) / red horizontal bands
      return (
        <svg {...common}>
          <rect width="9" height="6" fill="#AA151B" />
          <rect y="1.5" width="9" height="3" fill="#F1BF00" />
        </svg>
      )
    case "it":
      // Italy: green / white / red vertical bands
      return (
        <svg {...common}>
          <rect width="3" height="6" fill="#009246" />
          <rect x="3" width="3" height="6" fill="#fff" />
          <rect x="6" width="3" height="6" fill="#CE2B37" />
        </svg>
      )
    case "en":
      // United Kingdom (Union Jack) — simplified but recognizable
      return (
        <svg {...common} viewBox="0 0 60 40">
          <rect width="60" height="40" fill="#012169" />
          {/* White diagonals */}
          <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8" />
          {/* Red diagonals */}
          <path
            d="M0,0 L60,40 M60,0 L0,40"
            stroke="#C8102E"
            strokeWidth="4"
            clipPath="url(#uk-clip)"
          />
          <defs>
            <clipPath id="uk-clip">
              <polygon points="0,0 30,20 60,0 60,8 38,20 60,32 60,40 30,20 0,40 0,32 22,20 0,8" />
            </clipPath>
          </defs>
          {/* White cross */}
          <rect x="25" width="10" height="40" fill="#fff" />
          <rect y="15" width="60" height="10" fill="#fff" />
          {/* Red cross */}
          <rect x="27" width="6" height="40" fill="#C8102E" />
          <rect y="17" width="60" height="6" fill="#C8102E" />
        </svg>
      )
    case "fr":
      // France: blue / white / red vertical bands
      return (
        <svg {...common}>
          <rect width="3" height="6" fill="#0055A4" />
          <rect x="3" width="3" height="6" fill="#fff" />
          <rect x="6" width="3" height="6" fill="#EF4135" />
        </svg>
      )
    case "pt":
      // Portugal: green (2/5) + red (3/5) + yellow circle marker
      return (
        <svg {...common} viewBox="0 0 60 40">
          <rect width="24" height="40" fill="#006600" />
          <rect x="24" width="36" height="40" fill="#FF0000" />
          <circle cx="24" cy="20" r="6" fill="#FFD700" stroke="#fff" strokeWidth="0.6" />
          <circle cx="24" cy="20" r="3" fill="#fff" />
          <circle cx="24" cy="20" r="2" fill="#003399" />
        </svg>
      )
    case "ca":
      // Catalonia (Senyera): yellow background with 4 red horizontal stripes
      return (
        <svg {...common} viewBox="0 0 9 6">
          <rect width="9" height="6" fill="#FCDD09" />
          <rect y="0.66" width="9" height="0.66" fill="#DA121A" />
          <rect y="1.98" width="9" height="0.66" fill="#DA121A" />
          <rect y="3.30" width="9" height="0.66" fill="#DA121A" />
          <rect y="4.62" width="9" height="0.66" fill="#DA121A" />
        </svg>
      )
    case "de":
      // Germany: black (top) / red (middle) / gold (bottom) — equal horizontal bands
      return (
        <svg {...common}>
          <rect width="9" height="2" fill="#000000" />
          <rect y="2" width="9" height="2" fill="#DD0000" />
          <rect y="4" width="9" height="2" fill="#FFCE00" />
        </svg>
      )
  }
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
  const [customChatbotId, setCustomChatbotId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    playFetch(`${API_BASE}/workspace-info`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) setWorkspaceName(data.name)
        if (data?.chatbotId) setCustomChatbotId(data.chatbotId)
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
  const { user, login, logout } = useAuth()
  if (!user) return <LoginScreen onLogin={login} />
  return (
    <Routes>
      <Route index element={<ChatScreen user={user} onLogout={logout} />} />
      <Route
        path="kanban"
        element={<KanbanScreen user={user} onLogout={logout} />}
      />
    </Routes>
  )
}
