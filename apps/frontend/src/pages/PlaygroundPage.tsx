import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd"
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  MessageCircle,
  Minimize2,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"
import "highlight.js/styles/github.css"

const API_BASE = "/api/v1/playground"
const POLL_INTERVAL = 4000

const ALLOWED_USERS = {
  ANDREA: { password: "Admin123", color: "#2563eb" },
  HOLGA: { password: "Admin123", color: "#db2777" },
} as const
type PlaygroundUser = keyof typeof ALLOWED_USERS

const STATUS_COLUMNS: { id: TodoStatus; title: string; color: string }[] = [
  { id: "TODO", title: "TODO", color: "bg-slate-100" },
  { id: "IN_PROGRESS", title: "IN PROGRESS", color: "bg-blue-50" },
  { id: "REVIEW", title: "REVIEW", color: "bg-yellow-50" },
  { id: "DONE", title: "DONE", color: "bg-green-50" },
  { id: "NICE_TO_HAVE", title: "NICE TO HAVE", color: "bg-purple-50" },
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

const PRIORITY_COLOR: Record<Priority, string> = {
  Alto: "bg-red-100 text-red-700 border-red-300",
  Medio: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Basso: "bg-green-100 text-green-700 border-green-300",
}

// ----------------------------------------------------------------------------
// LOGIN
// ----------------------------------------------------------------------------
function LoginScreen({ onLogin }: { onLogin: (u: PlaygroundUser) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = username.trim().toUpperCase() as PlaygroundUser
    if (!ALLOWED_USERS[u]) {
      setError("Invalid username")
      return
    }
    if (ALLOWED_USERS[u].password !== password) {
      setError("Invalid password")
      return
    }
    setError("")
    onLogin(u)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50">
      <form
        onSubmit={submit}
        className="bg-white p-8 rounded-2xl shadow-xl w-96 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center text-emerald-700">
          Ecolaundry Playground
        </h1>
        <p className="text-sm text-gray-500 text-center">Login to continue</p>
        <input
          type="text"
          placeholder="Username (ANDREA or HOLGA)"
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
  const [name, setName] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim() || !message.trim()) return
    setSending(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPhone: phone.trim(),
          customerName: name.trim() || undefined,
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
        <input
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
// CREATE-TODO MODAL
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
      await fetch(`${API_BASE}/todos`, {
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
  user,
  onClose,
  onChanged,
}: {
  todo: Todo
  user: PlaygroundUser
  onClose: () => void
  onChanged: () => void
}) {
  const [comment, setComment] = useState("")
  const [posting, setPosting] = useState(false)

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    setPosting(true)
    try {
      await fetch(`${API_BASE}/todos/${todo.id}/comments`, {
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
    await fetch(`${API_BASE}/todos/${todo.id}`, { method: "DELETE" })
    onChanged()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">{todo.commentTitle}</h2>
            <div className="flex gap-2 mt-1 items-center">
              <span
                className={`px-2 py-0.5 rounded-full text-xs border ${
                  PRIORITY_COLOR[todo.priority]
                }`}
              >
                {todo.priority}
              </span>
              <span className="text-xs text-gray-500">by {todo.createdBy}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={remove} title="Delete">
              <Trash2 className="w-5 h-5 text-red-500" />
            </button>
            <button onClick={onClose}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded text-sm border-l-4 border-emerald-400">
          <div className="text-xs text-gray-500 mb-1">
            Original {todo.messageType} message
          </div>
          {todo.messageContent}
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
                <div className="text-sm">{c.commentText}</div>
              </div>
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
// MAIN PAGE
// ----------------------------------------------------------------------------
export default function PlaygroundPage() {
  const [user, setUser] = useState<PlaygroundUser | null>(() => {
    const saved = localStorage.getItem("playgroundUser")
    return saved && ALLOWED_USERS[saved as PlaygroundUser]
      ? (saved as PlaygroundUser)
      : null
  })
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [usecasesMd, setUsecasesMd] = useState("")
  const [commentingMessage, setCommentingMessage] = useState<ChatMessage | null>(null)
  const [openTodo, setOpenTodo] = useState<Todo | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [kanbanExpanded, setKanbanExpanded] = useState(false)
  const [kanbanCollapsed, setKanbanCollapsed] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [sendingChat, setSendingChat] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const handleLogin = (u: PlaygroundUser) => {
    localStorage.setItem("playgroundUser", u)
    setUser(u)
  }
  const handleLogout = () => {
    localStorage.removeItem("playgroundUser")
    setUser(null)
  }

  const fetchAll = useCallback(async () => {
    const [msgRes, todosRes] = await Promise.all([
      fetch(`${API_BASE}/messages`).then((r) => r.json()),
      fetch(`${API_BASE}/todos`).then((r) => r.json()),
    ])
    setSessions(msgRes.sessions || [])
    setTodos(todosRes.todos || [])
  }, [])

  useEffect(() => {
    if (!user) return
    fetchAll()
    fetch(`${API_BASE}/usecases`)
      .then((r) => r.text())
      .then(setUsecasesMd)
      .catch(() => setUsecasesMd("# Use Cases\n\nFile not found."))
    const interval = setInterval(fetchAll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [user, fetchAll])

  // Auto-pick first session if none selected
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id)
    }
  }, [sessions, activeSessionId])

  // Refresh openTodo
  useEffect(() => {
    if (openTodo) {
      const updated = todos.find((t) => t.id === openTodo.id)
      if (updated) setOpenTodo(updated)
    }
  }, [todos, openTodo])

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  )

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeSession?.messages.length])

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !activeSession || sendingChat) return
    setSendingChat(true)
    try {
      await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          message: chatInput.trim(),
        }),
      })
      setChatInput("")
      fetchAll()
    } finally {
      setSendingChat(false)
    }
  }

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
    await fetch(`${API_BASE}/todos/${draggableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, position: destination.index }),
    })
    fetchAll()
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />

  // Kanban can be in 3 states: collapsed (header only), normal, expanded (fullscreen)
  const showTopArea = !kanbanExpanded
  const topAreaHeight = kanbanCollapsed
    ? "flex-1"
    : kanbanExpanded
    ? "hidden"
    : "flex-1"

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="bg-emerald-700 text-white px-6 py-3 flex justify-between items-center shadow shrink-0">
        <h1 className="text-xl font-bold">Ecolaundry Playground</h1>
        <div className="flex items-center gap-3">
          <span
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{ background: ALLOWED_USERS[user].color }}
          >
            {user}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm hover:underline opacity-90"
          >
            Logout
          </button>
        </div>
      </header>

      {/* TOP AREA: 3 columns */}
      {showTopArea && (
        <div className={`grid grid-cols-12 gap-3 p-3 ${topAreaHeight} min-h-0`}>
          {/* CHAT LIST */}
          <aside className="col-span-2 bg-white rounded-xl shadow flex flex-col overflow-hidden min-h-0">
            <div className="px-3 py-2 bg-emerald-600 text-white flex justify-between items-center shrink-0">
              <span className="font-semibold text-sm">Chats</span>
              <button
                onClick={() => setShowNewChat(true)}
                title="New chat"
                className="hover:bg-emerald-700 rounded p-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.length === 0 && (
                <div className="text-center text-xs text-gray-400 p-4">
                  No chats yet.
                  <br />
                  Click + to start.
                </div>
              )}
              {sessions.map((s) => {
                const isActive = s.id === activeSessionId
                const lastMsg = s.messages[s.messages.length - 1]
                const label =
                  s.customer?.name || s.customer?.phone || s.id.slice(0, 8)
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className={`w-full text-left px-3 py-2 border-b hover:bg-gray-50 ${
                      isActive ? "bg-emerald-50 border-l-4 border-l-emerald-500" : ""
                    }`}
                  >
                    <div className="font-medium text-sm truncate">{label}</div>
                    {lastMsg && (
                      <div className="text-xs text-gray-500 truncate">
                        {lastMsg.content}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </aside>

          {/* CHAT PANEL */}
          <section className="col-span-6 bg-white rounded-xl shadow flex flex-col overflow-hidden min-h-0">
            <div className="px-4 py-2 bg-emerald-600 text-white shrink-0">
              <span className="font-semibold">
                {activeSession
                  ? activeSession.customer?.name ||
                    activeSession.customer?.phone ||
                    "Chat"
                  : "Select a chat"}
              </span>
              {activeSession?.customer?.phone && (
                <span className="text-xs ml-2 opacity-80">
                  {activeSession.customer.phone}
                </span>
              )}
            </div>
            <div
              className="flex-1 overflow-y-auto p-4 space-y-2"
              style={{ background: "#ece5dd" }}
            >
              {activeSession?.messages.map((m) => {
                const isInbound = m.direction === "INBOUND"
                const todoCount = todos.filter((t) => t.dialogId === m.id).length
                return (
                  <div
                    key={m.id}
                    className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 shadow text-sm relative group ${
                        isInbound ? "bg-white" : "bg-[#dcf8c6]"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      <div className="text-[10px] text-gray-500 mt-1 flex justify-between gap-3">
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                        <button
                          onClick={() => setCommentingMessage(m)}
                          className="opacity-60 group-hover:opacity-100 transition flex items-center gap-1 hover:text-emerald-700"
                          title="Add TODO"
                        >
                          <MessageCircle className="w-3 h-3" />
                          {todoCount > 0 && <span>{todoCount}</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
              {!activeSession && (
                <div className="text-center text-gray-500 mt-10">
                  Select a chat from the list, or click + to start a new one.
                </div>
              )}
              {activeSession && !activeSession.messages.length && (
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
                  className="flex-1 border rounded-full px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={sendingChat}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-full disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </section>

          {/* MARKDOWN */}
          <section className="col-span-4 bg-white rounded-xl shadow flex flex-col overflow-hidden min-h-0">
            <div className="px-4 py-2 bg-blue-600 text-white font-semibold shrink-0">
              Use Cases
            </div>
            <div className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {usecasesMd}
              </ReactMarkdown>
            </div>
          </section>
        </div>
      )}

      {/* KANBAN */}
      <div
        className={`bg-white border-t shadow-inner flex flex-col ${
          kanbanExpanded ? "flex-1" : kanbanCollapsed ? "shrink-0" : "shrink-0"
        } min-h-0`}
        style={{
          maxHeight: kanbanExpanded
            ? "100%"
            : kanbanCollapsed
            ? "44px"
            : "42vh",
        }}
      >
        <div className="px-4 py-2 bg-gray-100 border-b flex justify-between items-center shrink-0">
          <h2 className="font-bold text-sm flex items-center gap-2">
            Kanban Board
            <span className="text-xs text-gray-500">({todos.length} tasks)</span>
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => {
                setKanbanCollapsed(!kanbanCollapsed)
                setKanbanExpanded(false)
              }}
              title={kanbanCollapsed ? "Expand" : "Collapse"}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {kanbanCollapsed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => {
                setKanbanExpanded(!kanbanExpanded)
                setKanbanCollapsed(false)
              }}
              title={kanbanExpanded ? "Collapse" : "Fullscreen"}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {kanbanExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        {!kanbanCollapsed && (
          <div className="flex-1 overflow-auto p-3 min-h-0">
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-5 gap-3 min-w-[1000px]">
                {STATUS_COLUMNS.map((col) => {
                  const columnTodos = todos
                    .filter((t) => t.status === col.id)
                    .sort((a, b) => a.position - b.position)
                  return (
                    <div key={col.id} className={`${col.color} rounded-lg p-2`}>
                      <h3 className="text-xs font-bold mb-2 text-gray-700 px-1">
                        {col.title} ({columnTodos.length})
                      </h3>
                      <Droppable droppableId={col.id}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2 min-h-[80px]"
                          >
                            {columnTodos.map((t, idx) => (
                              <Draggable
                                key={t.id}
                                draggableId={t.id}
                                index={idx}
                              >
                                {(prov) => (
                                  <div
                                    ref={prov.innerRef}
                                    {...prov.draggableProps}
                                    {...prov.dragHandleProps}
                                    onClick={() => setOpenTodo(t)}
                                    className="bg-white p-2 rounded shadow-sm border hover:shadow-md cursor-pointer text-sm"
                                  >
                                    <div className="font-medium mb-1">
                                      {t.commentTitle}
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] border ${
                                          PRIORITY_COLOR[t.priority]
                                        }`}
                                      >
                                        {t.priority}
                                      </span>
                                      <span className="text-[10px] text-gray-500">
                                        💬 {t.comments.length}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1">
                                      by {t.createdBy}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )
                })}
              </div>
            </DragDropContext>
          </div>
        )}
      </div>

      {commentingMessage && (
        <CreateTodoModal
          message={commentingMessage}
          user={user}
          onClose={() => setCommentingMessage(null)}
          onCreated={fetchAll}
        />
      )}
      {openTodo && (
        <TodoDetailModal
          todo={openTodo}
          user={user}
          onClose={() => setOpenTodo(null)}
          onChanged={fetchAll}
        />
      )}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onCreated={(sid) => {
            setActiveSessionId(sid)
            fetchAll()
          }}
        />
      )}
    </div>
  )
}
