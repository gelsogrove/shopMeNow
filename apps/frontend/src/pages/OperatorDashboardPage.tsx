/**
 * OperatorDashboardPage
 *
 * Standalone public page (no login required) for operators to select
 * which customer to handle next from the waiting queue.
 *
 * URL: /operator-dashboard?token=<operator_dashboard_token>
 *
 * FLOW:
 *  1. Load queue on mount (with AI summaries)
 *  2. Poll every 5s silently (no spinner on refresh)
 *  3. Operator taps [Manage] → POST /assign → redirect to /support-chat?token=yyy
 *
 * DESIGN: mobile-first, 44px+ tap targets
 */

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { operatorDashboardApi, type QueueEntry } from "../services/operatorDashboardApi"

// ─── Channel badge ────────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: string | null }) {
  const isWhatsApp = channel === "whatsapp"
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
        isWhatsApp
          ? "bg-green-100 text-green-800"
          : "bg-blue-100 text-blue-800"
      }`}
    >
      {isWhatsApp ? "📱 WhatsApp" : "💬 Widget"}
    </span>
  )
}

// ─── Customer card ────────────────────────────────────────────────────────────

interface CustomerCardProps {
  entry: QueueEntry
  onManage: (customerId: string) => void
  assigning: boolean
}

function CustomerCard({ entry, onManage, assigning }: CustomerCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg font-semibold text-gray-800 truncate">
            {entry.name}
          </span>
          <ChannelBadge channel={entry.channel} />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
          #{entry.position}
        </span>
      </div>

      {/* Wait time */}
      <p className="text-sm text-gray-500">
        Waiting:{" "}
        <span className="font-medium text-gray-700">
          {entry.waitMinutes < 1
            ? "Just arrived"
            : entry.waitMinutes === 1
            ? "1 minute"
            : `${entry.waitMinutes} minutes`}
        </span>
      </p>

      {/* AI summary */}
      {entry.aiSummary && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 italic">
          "{entry.aiSummary}"
        </p>
      )}

      {/* Manage button */}
      <button
        onClick={() => onManage(entry.customerId)}
        disabled={assigning}
        className="w-full mt-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm
          active:bg-green-700 hover:bg-green-700 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          min-h-[44px]"
      >
        {assigning ? "Opening chat..." : `Manage ${entry.name}`}
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OperatorDashboardPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  // Track if first load is done (to suppress spinner on polls)
  const initialized = useRef(false)

  // ── Load queue ─────────────────────────────────────────────────────────────

  async function loadQueue(silent = false) {
    if (!token) return
    try {
      const data = await operatorDashboardApi.getQueue(token)
      setQueue(data)
      setError(null)
    } catch (e) {
      if (!silent) {
        const msg = e instanceof Error ? e.message : "Error loading queue"
        if (msg.includes("401") || msg.toLowerCase().includes("invalid")) {
          setError("This link has expired or is invalid.")
        } else {
          setError("Could not load the queue. Please try again.")
        }
      }
    } finally {
      if (!initialized.current) {
        initialized.current = true
        setLoading(false)
      }
    }
  }

  // Initial load
  useEffect(() => {
    if (!token) {
      setError("Invalid link — token missing.")
      setLoading(false)
      return
    }
    loadQueue(false)
  }, [token])

  // Poll every 5s (silent — no spinner)
  useEffect(() => {
    if (!token || error) return
    const id = setInterval(() => loadQueue(true), 5000)
    return () => clearInterval(id)
  }, [token, error])

  // ── Manage handler ─────────────────────────────────────────────────────────

  async function handleManage(customerId: string) {
    setAssigningId(customerId)
    try {
      const result = await operatorDashboardApi.assignCustomer(token, customerId)
      // Redirect to support-chat page with the new token
      window.location.href = result.chatUrl
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error"
      if (msg.includes("not found in queue")) {
        setError("This customer is no longer in the queue. Refreshing...")
        loadQueue(false)
      } else {
        setError("Could not open chat. Please try again.")
      }
      setAssigningId(null)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold">Invalid link</p>
          <p className="text-sm text-gray-500 mt-1">Token missing from URL.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-gray-500">Loading queue...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600">Error</p>
          <p className="text-sm text-gray-600 mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); initialized.current = false; loadQueue(false) }}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-gray-900">Customer Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {queue.length === 0
              ? "No customers waiting"
              : `${queue.length} customer${queue.length !== 1 ? "s" : ""} waiting`}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {queue.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-800">
              All customers handled!
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              No one is waiting right now.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {queue.map((entry) => (
              <CustomerCard
                key={entry.customerId}
                entry={entry}
                onManage={handleManage}
                assigning={assigningId === entry.customerId}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
