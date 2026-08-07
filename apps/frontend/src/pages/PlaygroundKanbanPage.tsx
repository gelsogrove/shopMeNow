/**
 * PlaygroundKanbanPage — the public door onto the feedback board.
 *
 * Served at /demo/<slug>/kanban so a client trying their bot can see and work
 * the cards they reported, without an account. The same board is reachable
 * inside the app at /feedback-board, where the team picks the cards up.
 *
 * There is no login here. The playground sessionId the visitor already owns
 * after their first message is the credential — the backend derives both the
 * workspace and the author name from it, so this page never sends a workspace
 * id or an author. Without a session there is nothing to show, and the page
 * says so rather than guessing.
 */
import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

import { loadWidgetSessionId } from "@/components/chat/adapters/widgetAdapter"
import { KanbanBoard, type KanbanOps } from "@/components/kanban/KanbanBoard"
import {
  addComment,
  deleteComment,
  deleteTodo,
  fetchTodos,
  updateTodo,
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
  // Same host as the frontend: api.echatbot.ai does not resolve.
  return "https://www.echatbot.ai/api/v1"
}

export default function PlaygroundKanbanPage() {
  const { slug = "" } = useParams<{ slug: string }>()
  const apiUrl = useMemo(getApiBaseUrl, [])

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [resolving, setResolving] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // slug → workspaceId, then the session the widget stored for that workspace.
  useEffect(() => {
    let cancelled = false

    fetch(`${apiUrl}/playground/resolve-demo/${slug}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data?.error || `Demo "${slug}" not found`)
        return data as { workspaceId?: string }
      })
      .then((data) => {
        if (cancelled) return
        if (!data?.workspaceId) throw new Error("Demo workspace is not configured")
        setSessionId(loadWidgetSessionId(localStorage, data.workspaceId))
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load the board")
      })
      .finally(() => {
        if (!cancelled) setResolving(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiUrl, slug])

  const ops: KanbanOps | null = useMemo(() => {
    if (!sessionId) return null
    return {
      list: async () => (await fetchTodos(apiUrl, sessionId)).todos,
      update: (id, patch) => updateTodo(apiUrl, sessionId, id, patch),
      remove: (id) => deleteTodo(apiUrl, sessionId, id),
      comment: (todoId, text) => addComment(apiUrl, sessionId, todoId, text),
      removeComment: (todoId, commentId) =>
        deleteComment(apiUrl, sessionId, todoId, commentId),
    }
  }, [apiUrl, sessionId])

  const socketOrigin = useMemo(
    () => (apiUrl.startsWith("http") ? new URL(apiUrl).origin : window.location.origin),
    [apiUrl]
  )

  if (resolving) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  // No session means the visitor has not talked to this bot yet. Cards are
  // created from chat messages, so there is nothing meaningful to show.
  if (error || !ops) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">Board unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">
            {error ??
              "Start a chat on the demo page first — cards are created from chat messages, and your session identifies this board."}
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
            <h1 className="text-lg font-semibold text-slate-800">Feedback board</h1>
            <p className="text-sm text-slate-500">{slug}</p>
          </div>
          <a
            href={`/demo/${slug}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to the demo
          </a>
        </div>
      </header>

      <div className="p-6">
        <KanbanBoard ops={ops} socketOrigin={socketOrigin} />
      </div>
    </div>
  )
}
