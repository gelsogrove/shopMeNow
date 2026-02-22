/**
 * SupportChatPage
 *
 * No-login operator handoff page. Accessed via token link sent to operator.
 * Token expires in 48h. No authentication required — the token IS the auth.
 *
 * URL: /support-chat?token=<support_chat_token>
 */

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

interface CustomerInfo {
  id: string
  name: string
  phone: string
  email?: string | null
  language?: string | null
  activeChatbot: boolean
  originChannel?: string | null
  operatorRequestedAt?: string | null
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const API_BASE = "/api/v1/support-chat"

async function fetchSession(token: string) {
  const res = await fetch(`${API_BASE}/session?token=${encodeURIComponent(token)}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{
    customer: CustomerInfo
    session: { id: string } | null
    messages: SessionMessage[]
    channel: string
    tokenMeta: { expiresAt: string }
  }>
}

async function sendReply(token: string, message: string): Promise<void> {
  const res = await fetch(`${API_BASE}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, message }),
  })
  if (!res.ok) throw new Error(await res.text())
}

async function markDone(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/done`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new Error(await res.text())
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupportChatPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [channel, setChannel] = useState<string>("widget")
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Load session ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setError("Link non valido — token mancante.")
      setLoading(false)
      return
    }

    fetchSession(token)
      .then((data) => {
        setCustomer(data.customer)
        setChannel(data.channel)
        setMessages(data.messages)
        setTokenExpiry(data.tokenMeta?.expiresAt ?? null)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message.includes("401") || e.message.includes("Token") ? "Link scaduto o non valido." : "Errore caricamento sessione.")
        setLoading(false)
      })
  }, [token])

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Poll for new customer messages every 8s ─────────────────────────────────

  useEffect(() => {
    if (!token || done || !customer) return
    const poll = async () => {
      try {
        const data = await fetchSession(token)
        setMessages(data.messages)
        setCustomer(data.customer)
      } catch {
        // ignore
      }
    }
    const id = setInterval(poll, 8000)
    return () => clearInterval(id)
  }, [token, done, customer])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!inputText.trim() || sending) return
    const text = inputText.trim()
    setInputText("")
    setSending(true)
    try {
      await sendReply(token, text)
      // Optimistically add the message to the list
      const now = new Date().toISOString()
      setMessages((prev) => [
        ...prev,
        { id: `local-${now}`, role: "assistant", content: text, createdAt: now },
      ])
    } catch (e) {
      setInputText(text)
      alert("Invio fallito. Riprova.")
    } finally {
      setSending(false)
    }
  }

  const handleDone = async () => {
    if (!confirm("Riabilitare il chatbot? Il cliente potrà di nuovo interagire con il bot.")) return
    try {
      await markDone(token)
      setDone(true)
    } catch {
      alert("Operazione fallita. Riprova.")
    }
  }

  // ── Loading / Error / Done states ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">⛔</div>
          <h2 className="text-lg font-semibold text-gray-800">Link non valido</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-semibold text-gray-800">Chatbot riabilitato</h2>
          <p className="text-gray-500 text-sm">Il cliente può di nuovo interagire con il chatbot. Puoi chiudere questa finestra.</p>
        </div>
      </div>
    )
  }

  // ── Main UI ─────────────────────────────────────────────────────────────────

  const channelLabel = channel === "whatsapp" ? "📱 WhatsApp" : "💬 Widget"
  const expiryLabel = tokenExpiry
    ? `Link valido fino al ${new Date(tokenExpiry).toLocaleString("it-IT")}`
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
            {customer?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{customer?.name}</div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>{customer?.phone}</span>
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">{channelLabel}</span>
              {customer?.operatorRequestedAt && (
                <span className="text-gray-400">
                  richiesto {new Date(customer.operatorRequestedAt).toLocaleTimeString("it-IT")}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleDone}
          className="text-xs font-semibold px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
        >
          ✅ Riattiva chatbot
        </button>
      </header>

      {/* Token expiry notice */}
      {expiryLabel && (
        <div className="bg-amber-50 border-b border-amber-100 text-amber-700 text-xs text-center py-1.5 px-4">
          🔒 {expiryLabel}
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-3xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">
            Nessun messaggio ancora.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                  : "bg-blue-600 text-white rounded-br-sm"
              }`}
            >
              {msg.content}
              <div className={`text-[10px] mt-1 ${msg.role === "user" ? "text-gray-400" : "text-blue-200"}`}>
                {new Date(msg.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 p-4 max-w-3xl mx-auto w-full">
        <div className="flex gap-3 items-end">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={`Rispondi a ${customer?.name ?? "cliente"}... (Enter per inviare)`}
            disabled={sending}
            rows={2}
            className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputText.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-fit"
          >
            {sending ? "..." : "Invia"}
          </button>
        </div>
        {channel === "whatsapp" && (
          <p className="text-xs text-gray-400 mt-2">
            📱 Il messaggio sarà inviato su WhatsApp al numero {customer?.phone}
          </p>
        )}
      </div>
    </div>
  )
}
