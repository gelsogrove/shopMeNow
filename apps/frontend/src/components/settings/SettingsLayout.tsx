/**
 * SettingsLayout - Layout a 2 colonne: Form (sinistra) + Help (destra)
 */
import { ReactNode } from "react"

interface SettingsLayoutProps {
  children: ReactNode
  helpPanel?: ReactNode
}

export function SettingsLayout({ children, helpPanel }: SettingsLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6 items-start">
      {/* Form area - sinistra */}
      <div className="space-y-6 min-w-0">{children}</div>

      {/* Help panel - destra (aligned with card header, not section header) */}
      {helpPanel && (
        <div className="hidden lg:block">
          <div className="sticky top-[300px]">{helpPanel}</div>
        </div>
      )}
    </div>
  )
}
