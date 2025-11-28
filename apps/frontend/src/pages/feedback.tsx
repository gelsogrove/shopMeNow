import { Star } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { api } from "../services/api"

export default function FeedbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token")

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [existingFeedback, setExistingFeedback] = useState<any>(null)

  useEffect(() => {
    if (!token) {
      toast.error("Link non valido")
      setTimeout(() => navigate("/"), 2000)
      return
    }

    loadExistingFeedback()
  }, [token])

  const loadExistingFeedback = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/feedback?token=${token}`)

      if (data.feedback) {
        setExistingFeedback(data.feedback)
        setRating(data.feedback.rating)
        setComment(data.feedback.comment || "")
      }

      setCustomerName(data.customer?.name || "Cliente")
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error("Link scaduto o non valido")
        setTimeout(() => navigate("/"), 2000)
      } else {
        toast.error("Errore nel caricamento")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      toast.error("Seleziona una valutazione con le stelline")
      return
    }

    try {
      setSubmitting(true)

      await api.post("/feedback", {
        token,
        rating,
        comment: comment.trim() || null,
      })

      toast.success("Grazie per il tuo feedback! 🙏")

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate("/")
      }, 2000)
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error("Link scaduto o non valido")
      } else {
        toast.error("Errore nell'invio del feedback")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {existingFeedback ? "Aggiorna il tuo Feedback" : "Il tuo Feedback"}
          </h1>
          {customerName && (
            <p className="text-gray-600">
              Ciao {customerName}, come è stata la tua esperienza?
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Star Rating */}
          <div className="text-center">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Valutazione *
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1"
                >
                  <Star
                    className={`w-12 h-12 ${
                      star <= (hoverRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                {rating === 5 && "Fantastico! 🎉"}
                {rating === 4 && "Ottimo! 😊"}
                {rating === 3 && "Buono 👍"}
                {rating === 2 && "Può migliorare 🤔"}
                {rating === 1 && "Ci dispiace 😔"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commento (opzionale)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Raccontaci la tua esperienza..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-500 text-right">
              {comment.length}/500 caratteri
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={rating === 0 || submitting}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
              rating === 0 || submitting
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Invio in corso...
              </span>
            ) : existingFeedback ? (
              "Aggiorna Feedback"
            ) : (
              "Invia Feedback"
            )}
          </button>

          {existingFeedback && (
            <p className="text-xs text-center text-gray-500">
              Feedback inviato il{" "}
              {new Date(existingFeedback.createdAt).toLocaleDateString("it-IT")}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Grazie per il tuo tempo! 💙</p>
        </div>
      </div>
    </div>
  )
}
