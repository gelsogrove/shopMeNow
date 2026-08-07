/**
 * PlaygroundKanbanPage
 *
 * Public board served at /demo/<slug>/kanban — one board per Flow workspace
 * (demowash, demorobot, demobeauty, …), never shared between them.
 *
 * What it is for: while a client tries their bot on /demo/<slug>, a wrong reply
 * can be turned into a card straight from the chat. The card freezes the
 * message and the bot's answer, so the report stays readable later and nobody
 * has to describe the bug from memory. Cards then move TODO → IN_PROGRESS →
 * REVIEW → DONE, with comments as the back-and-forth.
 *
 * Identity: there is no login here. The playground sessionId the visitor
 * already owns after their first message is the credential — the backend
 * derives both the workspace and the author name from it, so this page never
 * sends a workspace id or an author. Without a session there is nothing to
 * show, and the page says so instead of guessing.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

import { loadWidgetSessionId } from "@/components/chat/adapters/widgetAdapter"
import {
  addComment,
  deleteComment,
  deleteTodo,
  fetchTodos,
  KANBAN_COLUMNS,
  KANBAN_PRIORITIES,
  updateTodo,
  type KanbanPriority,
  type KanbanStatus,
  type KanbanTodo,
} from "@/services/playgroundKanbanApi"

// Same resolution order as DemoWidgetPage: the static frontend host has no /api
// proxy in production, so a relative path is only ever correct in local dev.
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    if (host === "localhost" || host === "127.0.0.1") return "/api/v1"
  }
  return "https://api.echatbot.ai/api/v1"
}

const COLUMN_LABELS: Record<KanbanStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
  NICE_TO_HAVE: "Nice to have",
}

const PRIORITY_STYLES: Record<KanbanPriority, string> = {
  HIGH: "bg-red-100 text-red-700 border-red-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
}

/** Stable per-author chip color, so the same person reads the same everywhere. */
function authorColor(name: string): string {
  const palette = [
    "bg-emerald-100 text-emerald-800",
    "bg-sky-100 text-sky-800",
    "bg-violet-100 text-violet-800",
    "bg-orange-100 text-orange-800",
    "bg-pink-100 text-pink-800",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return palette[Math.abs(hash) % palette.length]
}

export default function PlaygroundKanbanPage() {
  const { slug = "" } = useParams<{ slug: string }>()
  const apiUrl = useMemo(getApiBaseUrl, [])

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [todos, setTodos] = useState<KanbanTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // 1) slug → workspaceId, then the session the widget stored for that workspace.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${apiUrl}/playground/resolve-demo/${slug}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data?.error || `Demo "${slug}" not found`)
        return data as { workspaceId?: string }
      })
      .then((data) => {
        if (cancelled) return
        if (!data?.workspaceId) throw new Error("Demo workspace is not configured")
        setWorkspaceId(data.workspaceId)
        setSessionId(loadWidgetSessionId(localStorage, data.workspaceId))
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load the board")
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiUrl, slug])

  const reload = useCallback(async () => {
    if (!sessionId) return
    try {
      const { todos: rows } = await fetchTodos(apiUrl, sessionId)
      setTodos(rows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the board")
    } finally {
      setLoading(false)
    }
  }, [apiUrl, sessionId])

  // 2) Initial load once the session is known.
  useEffect(() => {
    if (!workspaceId) return
    if (!sessionId) {
      setLoading(false)
      return
    }
    void reload()
  }, [workspaceId, sessionId, reload])

  // 3) Live updates: the board is a shared surface, so other people's changes
  //    must land without a refresh. Socket events are broadcast for every
  //    workspace, so we re-read our own scoped board rather than trusting the
  //    payload — the server is the only thing that knows which board it belongs to.
  useEffect(() => {
    if (!sessionId) return
    let socket: { disconnect: () => void } | null = null
    let cancelled = false

    import("socket.io-client")
      .then(({ io }) => {
        if (cancelled) return
        const origin = apiUrl.startsWith("http")
          ? new URL(apiUrl).origin
          : window.location.origin
        const client = io(origin, { transports: ["websocket", "polling"] })
        socket = client
        for (const event of [
          "playground:todo:created",
          "playground:todo:updated",
          "playground:todo:deleted",
          "playground:comment:created",
          "playground:comment:deleted",
        ]) {
          client.on(event, () => void reload())
        }
      })
      .catch(() => {
        // Realtime is a convenience: the board still works without it.
      })

    return () => {
      cancelled = true
      socket?.disconnect()
    }
  }, [apiUrl, sessionId, reload])

  const byColumn = useMemo(() => {
    const grouped: Record<KanbanStatus, KanbanTodo[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
      NICE_TO_HAVE: [],
    }
    for (const todo of todos) {
      if (grouped[todo.status]) grouped[todo.status].push(todo)
    }
    for (const status of KANBAN_COLUMNS) {
      grouped[status].sort((a, b) => a.position - b.position)
    }
    return grouped
  }, [todos])

  // Optimistic move: the card follows the cursor immediately, and a failure
  // reloads the authoritative board rather than leaving a lie on screen.
  const moveCard = async (todo: KanbanTodo, status: KanbanStatus) => {
    if (!sessionId || todo.status === status) return
    const position = byColumn[status].length
    setTodos((cur) =>
      cur.map((t) => (t.id === todo.id ? { ...t, status, position } : t))
    )
    try {
      await updateTodo(apiUrl, sessionId, todo.id, { status, position })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move the card")
      void reload()
    }
  }

  const changePriority = async (todo: KanbanTodo, priority: KanbanPriority) => {
    if (!sessionId) return
    setTodos((cur) => cur.map((t) => (t.id === todo.id ? { ...t, priority } : t)))
    try {
      await updateTodo(apiUrl, sessionId, todo.id, { priority })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the card")
      void reload()
    }
  }

  const removeCard = async (todo: KanbanTodo) => {
    if (!sessionId) return
    setTodos((cur) => cur.filter((t) => t.id !== todo.id))
    setOpenCardId(null)
    try {
      await deleteTodo(apiUrl, sessionId, todo.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the card")
      void reload()
    }
  }

  const openCard = todos.find((t) => t.id === openCardId) || null

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  // No session means the visitor has not talked to this bot yet. Cards are
  // created from chat messages, so there is nothing meaningful to show.
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">Board unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">
            Start a chat on the demo page first — cards are created from chat
            messages, and your session identifies this board.
          </p>
          <a
            href={`/demo/${slug}`}
            className="mt-5 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Open the demo
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              Feedback board
            </h1>
            <p className="text-sm text-slate-500">
              {slug} · {todos.length} {todos.length === 1 ? "card" : "cards"}
            </p>
          </div>
          <a
            href={`/demo/${slug}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to the demo
          </a>
        </div>
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </header>

      <div className="overflow-x-auto p-6">
        <div className="flex min-w-max gap-4">
          {KANBAN_COLUMNS.map((status) => (
            <section
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const dragged = todos.find((t) => t.id === draggedId)
                if (dragged) void moveCard(dragged, status)
                setDraggedId(null)
              }}
              className="flex w-72 flex-col rounded-lg bg-slate-100 p-3"
            >
              <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
                {COLUMN_LABELS[status]}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                  {byColumn[status].length}
                </span>
              </h2>

              <div className="flex flex-col gap-2">
                {byColumn[status].map((todo) => (
                  <article
                    key={todo.id}
                    draggable
                    onDragStart={() => setDraggedId(todo.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => setOpenCardId(todo.id)}
                    className="cursor-pointer rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-emerald-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-slate-800">
                        {todo.commentTitle}
                      </h3>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[todo.priority]}`}
                      >
                        {todo.priority}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                      {todo.messageContent}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                      <span
                        className={`rounded-full px-2 py-0.5 ${authorColor(todo.createdBy)}`}
                      >
                        {todo.createdBy}
                      </span>
                      {todo.comments.length > 0 && (
                        <span>💬 {todo.comments.length}</span>
                      )}
                    </div>
                  </article>
                ))}

                {byColumn[status].length === 0 && (
                  <p className="rounded-md border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">
                    Drop cards here
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      {openCard && (
        <CardDetail
          apiUrl={apiUrl}
          sessionId={sessionId}
          todo={openCard}
          onClose={() => setOpenCardId(null)}
          onChangePriority={(priority) => void changePriority(openCard, priority)}
          onDelete={() => void removeCard(openCard)}
          onCommentsChanged={reload}
        />
      )}
    </div>
  )
}

interface CardDetailProps {
  apiUrl: string
  sessionId: string
  todo: KanbanTodo
  onClose: () => void
  onChangePriority: (priority: KanbanPriority) => void
  onDelete: () => void
  onCommentsChanged: () => Promise<void>
}

function CardDetail({
  apiUrl,
  sessionId,
  todo,
  onClose,
  onChangePriority,
  onDelete,
  onCommentsChanged,
}: CardDetailProps) {
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    setCommentError(null)
    try {
      await addComment(apiUrl, sessionId, todo.id, text)
      setDraft("")
      await onCommentsChanged()
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Failed to add comment")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (commentId: string) => {
    try {
      await deleteComment(apiUrl, sessionId, todo.id, commentId)
      await onCommentsChanged()
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Failed to delete comment")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-800">
            {todo.commentTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Priority</span>
          {KANBAN_PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() => onChangePriority(priority)}
              className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                todo.priority === priority
                  ? PRIORITY_STYLES[priority]
                  : "border-slate-200 text-slate-400 hover:border-slate-300"
              }`}
            >
              {priority}
            </button>
          ))}
        </div>

        {/* The frozen evidence: what was asked, and what the bot answered. */}
        <div className="mt-5 space-y-3">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase text-slate-400">
              {todo.messageType === "chatbot" ? "Bot message" : "Customer message"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {todo.messageContent}
            </p>
          </div>
          {todo.chatbotResponse && (
            <div className="rounded-md bg-emerald-50 p-3">
              <p className="text-[11px] font-semibold uppercase text-emerald-600">
                Bot reply
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {todo.chatbotResponse}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700">
            Comments ({todo.comments.length})
          </h3>

          <div className="mt-3 space-y-3">
            {todo.comments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${authorColor(comment.createdBy)}`}
                  >
                    {comment.createdBy}
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(comment.id)}
                    className="text-[11px] text-slate-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {comment.commentText}
                </p>
              </div>
            ))}
            {todo.comments.length === 0 && (
              <p className="text-sm text-slate-400">No comments yet.</p>
            )}
          </div>

          {commentError && (
            <p className="mt-3 text-sm text-red-600">{commentError}</p>
          )}

          <div className="mt-4 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit()
              }}
              placeholder="Write a comment"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !draft.trim()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 text-right">
          <button
            type="button"
            onClick={onDelete}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Delete card
          </button>
        </div>
      </div>
    </div>
  )
}
