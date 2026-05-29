import { Languages } from "lucide-react"
import { useState } from "react"
import { api } from "@/services/api"

// Reusable toggle/button rendered under a chat bubble to show the operator
// either the translation (for foreign-language customer / bot messages) or
// the original text (for operator messages that were auto-translated to the
// customer's language). The translation is fetched lazily and cached in
// component state so subsequent toggles cost zero network roundtrips.
//
// Two modes:
//   mode="translate"  → for messages whose `content` is in the customer's
//                       language. Calls POST /api/chat/translate-message
//                       lazily on first open.
//   mode="original"   → for operator messages: shows the operator's source
//                       text from `originalContent` (already in props,
//                       persisted in message.metadata at send time).

type Mode = "translate" | "original"

export function MessageTranslationToggle(props: {
  mode: Mode
  /** Message id used as cache key. */
  messageId: string
  /** Raw content shown in the bubble. */
  content: string
  /** Mode "original": the source text the operator originally typed. */
  originalContent?: string | null
  /** Mode "translate": optional source language ISO code (skip the LLM
   *  detection step when known). */
  sourceLanguage?: string | null
  /** Visual variant: aligns colors to the bubble color (operator green vs
   *  customer light). */
  variant?: "operator" | "customer"
}) {
  const { mode, messageId, content, originalContent, sourceLanguage, variant = "customer" } = props
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [translated, setTranslated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isOperator = variant === "operator"

  // Original mode: we already have the source text, no fetch needed.
  if (mode === "original") {
    if (!originalContent || originalContent === content) return null
    return (
      <Wrapper open={open} setOpen={setOpen} isOperator={isOperator}>
        {open && (
          <Panel isOperator={isOperator} label="ORIGINAL">
            {originalContent}
          </Panel>
        )}
      </Wrapper>
    )
  }

  // Translate mode: fetch lazily on first open.
  const handleToggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    if (translated !== null || loading) {
      setOpen(true)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.post("/chat/translate-message", {
        content,
        sourceLanguage: sourceLanguage || undefined,
      })
      const data = res.data?.data
      setTranslated(data?.translated || "")
      setOpen(true)
    } catch (err: any) {
      setError(err?.response?.data?.error || "Translation failed")
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Wrapper open={open} setOpen={handleToggle} isOperator={isOperator} loading={loading}>
      {open && (
        <Panel isOperator={isOperator} label="TRANSLATION">
          {error ? <span className="italic text-red-600">{error}</span> : translated || ""}
        </Panel>
      )}
    </Wrapper>
  )
  void messageId // explicit no-op so the prop participates in the public API even though we don't use it as a key (cache lives in this component instance)
}

function Wrapper({
  open,
  setOpen,
  children,
  isOperator,
  loading,
}: {
  open: boolean
  setOpen: ((v: boolean) => void) | (() => void)
  children: React.ReactNode
  isOperator: boolean
  loading?: boolean
}) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => (typeof setOpen === "function" ? (setOpen as any)(!open) : null)}
        disabled={loading}
        className={
          "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition " +
          (isOperator
            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
            : "bg-blue-100 text-blue-800 hover:bg-blue-200") +
          (loading ? " opacity-60 cursor-wait" : " cursor-pointer")
        }
      >
        <Languages className="w-3 h-3" />
        {loading ? "Translating…" : open ? "Hide" : isOperator ? "View original" : "Translate"}
      </button>
      {children}
    </div>
  )
}

function Panel({
  isOperator,
  label,
  children,
}: {
  isOperator: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      className={
        "mt-1.5 rounded-md p-2 text-sm border " +
        (isOperator
          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
          : "bg-blue-50 border-blue-200 text-blue-900")
      }
    >
      <div
        className={
          "text-[9px] font-semibold uppercase tracking-wider mb-1 " +
          (isOperator ? "text-emerald-700" : "text-blue-700")
        }
      >
        {label}
      </div>
      <div className="whitespace-pre-wrap break-words">{children}</div>
    </div>
  )
}
