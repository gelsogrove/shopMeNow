/**
 * SettingsField - Wrapper for each form field
 * Handles: label, error, help onFocus
 */
import { ReactNode, FocusEvent } from "react"
import { cn } from "@/lib/utils"

interface SettingsFieldProps {
  label: string
  description?: string
  error?: string
  required?: boolean
  children: ReactNode
  onFocus?: () => void
  className?: string
}

export function SettingsField({
  label,
  description,
  error,
  required,
  children,
  onFocus,
  className,
}: SettingsFieldProps) {
  const handleFocus = (e: FocusEvent<HTMLDivElement>) => {
    // Se il focus è su un input figlio, triggera onFocus
    if (onFocus && (e.target as HTMLElement).tagName.match(/INPUT|SELECT|TEXTAREA/)) {
      onFocus()
    }
  }

  return (
    <div className={cn("space-y-2", className)} onFocus={handleFocus}>
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {required && <span className="text-red-500 text-sm">*</span>}
      </div>

      {description && <p className="text-xs text-gray-500">{description}</p>}

      {children}

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <span>⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}
