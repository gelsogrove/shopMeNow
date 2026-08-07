/**
 * KanbanBoard — the feedback board, shared by both doors onto it.
 *
 * The board itself is identical whether it is reached from the public demo page
 * (visitor authenticated by their playground session) or from inside the app
 * (staff authenticated by JWT). Only the transport differs, so callers pass an
 * `ops` object and this component stays unaware of who is signed in.
 *
 * Cards are created elsewhere — from a chat message, which is what gives a card
 * its evidence. This board reads, moves, comments and deletes them.
 */
import { Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  KANBAN_COLUMNS,
  KANBAN_PRIORITIES,
  type CreateTodoInput,
  type KanbanAuthorKind,
  type KanbanPriority,
  type KanbanStatus,
  type KanbanTodo,
} from "@/services/playgroundKanbanApi"

/** Everything the board needs to talk to the server, whichever door it is behind. */
export interface KanbanOps {
  list: () => Promise<KanbanTodo[]>
  /** Optional: when absent the board is read/move only, with no "New card" button. */
  create?: (input: CreateTodoInput) => Promise<unknown>
  update: (
    id: string,
    patch: Partial<Pick<KanbanTodo, "status" | "priority" | "position" | "commentTitle">>
  ) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
  comment: (todoId: string, text: string) => Promise<unknown>
  removeComment: (todoId: string, commentId: string) => Promise<unknown>
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

/** Customer-reported cards are the point of the board — mark them. */
function AuthorChip({ name, kind }: { name: string; kind: KanbanAuthorKind }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] ${authorColor(name)}`}
      title={kind === "CUSTOMER" ? "Reported by a customer" : "Added by the team"}
    >
      {kind === "CUSTOMER" ? "👤 " : ""}
      {name}
    </span>
  )
}

interface KanbanBoardProps {
  ops: KanbanOps
  /** Origin for the realtime socket. Omit to disable live updates. */
  socketOrigin?: string
}

export function KanbanBoard({ ops, socketOrigin }: KanbanBoardProps) {
  const [todos, setTodos] = useState<KanbanTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)

  const reload = useCallback(async () => {
    try {
      setTodos(await ops.list())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the board")
    } finally {
      setLoading(false)
    }
  }, [ops])

  useEffect(() => {
    void reload()
  }, [reload])

  // Live updates: the board is shared, so somebody else's change must land
  // without a refresh. Socket events are broadcast for every workspace, so we
  // re-read our own scoped board rather than trusting the payload — only the
  // server knows which board an event belongs to.
  useEffect(() => {
    if (!socketOrigin) return
    let socket: { disconnect: () => void } | null = null
    let cancelled = false

    import("socket.io-client")
      .then(({ io }) => {
        if (cancelled) return
        const client = io(socketOrigin, { transports: ["websocket", "polling"] })
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
  }, [socketOrigin, reload])

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

  // Optimistic: the card follows the cursor immediately, and a failure reloads
  // the authoritative board rather than leaving a lie on screen.
  const moveCard = async (todo: KanbanTodo, status: KanbanStatus) => {
    if (todo.status === status) return
    const position = byColumn[status].length
    setTodos((cur) => cur.map((t) => (t.id === todo.id ? { ...t, status, position } : t)))
    try {
      await ops.update(todo.id, { status, position })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move the card")
      void reload()
    }
  }

  const changePriority = async (todo: KanbanTodo, priority: KanbanPriority) => {
    setTodos((cur) => cur.map((t) => (t.id === todo.id ? { ...t, priority } : t)))
    try {
      await ops.update(todo.id, { priority })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the card")
      void reload()
    }
  }

  const removeCard = async (todo: KanbanTodo) => {
    setTodos((cur) => cur.filter((t) => t.id !== todo.id))
    setOpenCardId(null)
    try {
      await ops.remove(todo.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the card")
      void reload()
    }
  }

  const openCard = todos.find((t) => t.id === openCardId) || null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  return (
    // h-full so a parent that hands the board a height gets columns that fill
    // it; min-h-0 lets the inner scroll areas shrink instead of overflowing.
    <div className="flex h-full min-h-0 flex-col">
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {ops.create && (
        <div className="mb-3 flex flex-shrink-0 justify-end">
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            New card
          </button>
        </div>
      )}

      {todos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 py-16 text-center text-sm text-slate-500">
          No cards yet. Add one here, or use the clipboard icon on a chat message
          to report it with the conversation attached.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto pb-2">
          <div className="flex h-full min-w-max gap-4">
            {KANBAN_COLUMNS.map((status) => (
              <section
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const dragged = todos.find((t) => t.id === draggedId)
                  if (dragged) void moveCard(dragged, status)
                  setDraggedId(null)
                }}
                className="flex h-full w-72 flex-col rounded-lg bg-slate-100 p-3"
              >
                <h2 className="mb-3 flex flex-shrink-0 items-center justify-between text-sm font-semibold text-slate-700">
                  {COLUMN_LABELS[status]}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                    {byColumn[status].length}
                  </span>
                </h2>

                {/* Each column scrolls on its own: a long To-do list must not
                    push the other columns off the page. */}
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
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
                      {todo.messageContent && (
                        <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                          {todo.messageContent}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <AuthorChip name={todo.createdBy} kind={todo.authorKind} />
                        {todo.comments.length > 0 && <span>💬 {todo.comments.length}</span>}
                      </div>
                    </article>
                  ))}

                  {byColumn[status].length === 0 && (
                    <p className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-300 text-center text-xs text-slate-400">
                      Drop cards here
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {openCard && (
        <CardDetail
          todo={openCard}
          ops={ops}
          onClose={() => setOpenCardId(null)}
          onChangePriority={(priority) => void changePriority(openCard, priority)}
          onDelete={() => void removeCard(openCard)}
          onCommentsChanged={reload}
        />
      )}

      {composing && ops.create && (
        <NewCardDialog
          create={ops.create}
          onClose={() => setComposing(false)}
          onCreated={reload}
        />
      )}
    </div>
  )
}

interface NewCardDialogProps {
  create: (input: CreateTodoInput) => Promise<unknown>
  onClose: () => void
  onCreated: () => Promise<void>
}

/** A card with no chat behind it — for work that did not start in a conversation. */
function NewCardDialog({ create, onClose, onCreated }: NewCardDialogProps) {
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<KanbanPriority>("MEDIUM")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await create({
        commentTitle: trimmed,
        priority,
        firstComment: note.trim() || undefined,
      })
      await onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the card")
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-800">New card</h2>

        <label className="mt-4 block text-xs font-medium text-slate-600">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit()
            if (e.key === "Escape") onClose()
          }}
          placeholder="What needs doing?"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />

        <label className="mt-4 block text-xs font-medium text-slate-600">Priority</label>
        <div className="mt-1 flex gap-2">
          {KANBAN_PRIORITIES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPriority(value)}
              className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                priority === value
                  ? PRIORITY_STYLES[value]
                  : "border-slate-200 text-slate-400 hover:border-slate-300"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-medium text-slate-600">
          Note <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Any detail worth recording"
          className="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !title.trim()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create card"}
          </button>
        </div>
      </div>
    </div>
  )
}

interface CardDetailProps {
  todo: KanbanTodo
  ops: KanbanOps
  onClose: () => void
  onChangePriority: (priority: KanbanPriority) => void
  onDelete: () => void
  onCommentsChanged: () => Promise<void>
}

function CardDetail({
  todo,
  ops,
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
      await ops.comment(todo.id, text)
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
      await ops.removeComment(todo.id, commentId)
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
          <h2 className="text-base font-semibold text-slate-800">{todo.commentTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-2">
          <AuthorChip name={todo.createdBy} kind={todo.authorKind} />
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

        {/* The frozen evidence, when there is any: what was asked, and what the
            bot answered. Cards created straight on the board have none, and
            show nothing rather than an empty transcript. */}
        {todo.messageContent && (
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
        )}

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700">
            Comments ({todo.comments.length})
          </h3>

          <div className="mt-3 space-y-3">
            {todo.comments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <AuthorChip name={comment.createdBy} kind={comment.authorKind} />
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

          {commentError && <p className="mt-3 text-sm text-red-600">{commentError}</p>}

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
