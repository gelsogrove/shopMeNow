/**
 * OperatorRecipientList — editable list of escalation recipients.
 *
 * Used for both operator emails and WhatsApp numbers, which behave identically:
 * add, remove, and validate one entry at a time. Kept as its own component so
 * the two lists can never drift apart in behaviour or appearance.
 */
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"

interface OperatorRecipientListProps {
  values: string[]
  onChange: (values: string[]) => void
  disabled?: boolean
  placeholder: string
  /** Returns an error message for an invalid entry, or null when it is valid. */
  validate?: (value: string) => string | null
  addLabel: string
  emptyHint: string
}

export function OperatorRecipientList({
  values,
  onChange,
  disabled,
  placeholder,
  validate,
  addLabel,
  emptyHint,
}: OperatorRecipientListProps) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const value = draft.trim()
    if (!value) return

    const validationError = validate?.(value) ?? null
    if (validationError) {
      setError(validationError)
      return
    }
    // Silently ignore duplicates: adding the same address twice would just send
    // two identical notifications.
    if (values.includes(value)) {
      setError("Already in the list")
      return
    }

    onChange([...values, value])
    setDraft("")
    setError(null)
  }

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="space-y-1.5">
          {values.map((value) => (
            <div
              key={value}
              className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-1.5 text-sm"
            >
              <span className="flex-1 truncate">{value}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                onClick={() => onChange(values.filter((v) => v !== value))}
                disabled={disabled}
                title={`Remove ${value}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
          // Enter is the natural way to commit an entry; without this the form
          // would submit or nothing would happen.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={error ? "border-red-500" : ""}
        />
        <Button variant="outline" onClick={add} disabled={disabled || !draft.trim()}>
          <Plus className="h-4 w-4 mr-1.5" />
          {addLabel}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {values.length === 0 && !error && <p className="text-xs text-gray-500">{emptyHint}</p>}
    </div>
  )
}
