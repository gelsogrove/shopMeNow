import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExternalLink } from "lucide-react"
import { useState } from "react"

interface LocationFieldProps {
  defaultValue?: string | null
}

// Plain text field for a place's address/area — no Google Places
// autocomplete, so no API key and no per-lookup cost (Andrea, 2026-09-01:
// "senza api di google.senza spendere troppi soldi"). The chatbot builds a
// Google Maps link from this same text at answer time (google.com/maps/search
// needs no key), so the preview link below opens exactly what the customer
// would receive — the way to catch a vague address before saving, not after.
export function LocationField({ defaultValue }: LocationFieldProps) {
  const [value, setValue] = useState(defaultValue ?? "")
  const trimmed = value.trim()
  const previewHref = trimmed
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
    : null

  return (
    <div className="space-y-2">
      <Label htmlFor="location">Location</Label>
      <Input
        id="location"
        name="location"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {previewHref && (
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          Check on Google Maps
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
