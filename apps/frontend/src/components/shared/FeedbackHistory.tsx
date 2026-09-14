import { api } from "@/services/api"
import { Loader2, Star } from "lucide-react"
import { useEffect, useState } from "react"

interface FeedbackEntry {
  id: string
  rating: number | null
  comment: string | null
  arrivalDate: string | null
  departureDate: string | null
  createdAt: string
}

interface FeedbackHistoryProps {
  workspaceId: string
  customerId: string
  /** Shown while nothing has been collected yet. */
  emptyLabel?: string
}

/** "12 Aug 2026" — short, unambiguous, locale-independent ordering. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

/** "12 – 19 Aug 2026", or one side of it when only one date is known. */
function formatStay(arrival: string | null, departure: string | null): string | null {
  const from = formatDate(arrival)
  const to = formatDate(departure)
  if (from && to) return `${from} → ${to}`
  return from ?? to
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  )
}

/**
 * Every feedback a guest has given, one entry per stay, newest first (Andrea,
 * 2026-09-14: "a livello di UI/UX devi gestire bene i feedback, con le date
 * delle vacanze e il riscontro").
 *
 * WHY A LIST AND NOT ONE SCORE
 * The customer card used to show the latest answer alone, because the three
 * `customers.feedback*` columns only hold the latest — a second holiday
 * overwrote the first. Reading the per-stay table instead is what turns "4
 * stars" into "4 stars in August, 5 the winter after", which is the thing a
 * Pro Loco desk actually wants to see before greeting a returning guest.
 *
 * Loads on demand: a list of guests must not fire one request per card.
 */
export function FeedbackHistory({
  workspaceId,
  customerId,
  emptyLabel = "No feedback collected yet.",
}: FeedbackHistoryProps) {
  const [entries, setEntries] = useState<FeedbackEntry[] | null>(null)
  const [average, setAverage] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    api
      .get(`/workspaces/${workspaceId}/customers/${customerId}/feedback`)
      .then((res) => {
        if (cancelled) return
        setEntries(res.data.feedbacks ?? [])
        setAverage(res.data.averageRating ?? null)
      })
      .catch(() => {
        // A failed fetch must not blank the card it sits in.
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, customerId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading feedback...
      </div>
    )
  }

  if (error) {
    return <div className="text-xs text-gray-400 py-2">Feedback unavailable.</div>
  }

  if (!entries || entries.length === 0) {
    return <div className="text-xs text-gray-400 py-2">{emptyLabel}</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">
          Feedback ({entries.length} {entries.length === 1 ? "stay" : "stays"})
        </span>
        {average !== null && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            {average} average
          </span>
        )}
      </div>

      <ol className="space-y-2">
        {entries.map((entry) => {
          const stay = formatStay(entry.arrivalDate, entry.departureDate)
          return (
            <li
              key={entry.id}
              className="rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                {/* The stay it refers to — the whole point of keeping one row
                    per holiday. Falls back to when it was given, for guests
                    who answered without ever stating their dates. */}
                <span className="text-xs font-medium text-gray-700">
                  {stay ?? formatDate(entry.createdAt)}
                </span>
                {typeof entry.rating === "number" && entry.rating > 0 && (
                  <Stars rating={entry.rating} />
                )}
              </div>
              {entry.comment && (
                <p className="text-xs italic text-gray-600 leading-relaxed">
                  “{entry.comment}”
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
