import { CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface FeatureChecklistProps {
  items: string[]
  /** Check icon color (default WhatsApp green) */
  iconClassName?: string
}

/**
 * FeatureChecklist — vertical list of features with a check icon,
 * shared by feature panels on marketing pages.
 */
export function FeatureChecklist({ items, iconClassName = "text-[#25D366]" }: FeatureChecklistProps) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-3 text-slate-300">
          <CheckCircle className={cn("h-5 w-5 flex-shrink-0", iconClassName)} />
          {item}
        </li>
      ))}
    </ul>
  )
}
