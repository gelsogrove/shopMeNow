/**
 * SettingsDropdown - Menu a tendina per navigare tra le sezioni
 * Stile coerente con il profile dropdown
 */
import { ChevronDown, Check, Bot, Store, Shield, Headphones, Smartphone, Monitor, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface SettingsSection {
  key: string
  label: string
  description?: string
}

interface SettingsDropdownProps {
  sections: SettingsSection[]
  currentSection: string
  onSectionChange: (sectionKey: string) => void
}

// Icon mapping for sections
const SECTION_ICONS: Record<string, React.ReactNode> = {
  "ai-personality": <Bot className="h-4 w-4 text-blue-500" />,
  "business": <Store className="h-4 w-4 text-purple-500" />,
  "whatsapp": <Smartphone className="h-4 w-4 text-emerald-500" />,
  "widget": <Monitor className="h-4 w-4 text-indigo-500" />,
  "widget-support": <Headphones className="h-4 w-4 text-purple-600" />,
  "security": <Shield className="h-4 w-4 text-red-500" />,
  "subscription": <CreditCard className="h-4 w-4 text-amber-500" />,
}

export function SettingsDropdown({
  sections,
  currentSection,
  onSectionChange,
}: SettingsDropdownProps) {
  const currentLabel = sections.find((s) => s.key === currentSection)?.label || "Select Section"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="justify-between text-left font-normal gap-2">
          {SECTION_ICONS[currentSection]}
          <span>{currentLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {sections.map((section) => (
          <DropdownMenuItem
            key={section.key}
            onClick={() => onSectionChange(section.key)}
            className="flex items-center justify-between cursor-pointer p-3"
          >
            <div className="flex items-center gap-3">
              {SECTION_ICONS[section.key]}
              <div className="flex flex-col">
                <span className="font-medium">{section.label}</span>
                {section.description && (
                  <span className="text-xs text-gray-500">{section.description}</span>
                )}
              </div>
            </div>
            {section.key === currentSection && (
              <Check className="h-4 w-4 text-green-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
