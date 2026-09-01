import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GeocodingResult, searchPlaces } from "@/services/geocodingApi"
import { ExternalLink, Loader2, MapPin } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface LocationFieldProps {
  defaultValue?: string | null
}

// Free-text place picker backed by Nominatim/OpenStreetMap search — no
// Google Places API key, no per-lookup cost (Andrea, 2026-09-01: "senza api
// di google.senza spendere troppi soldi"). Typing shows a dropdown of real
// matches to pick from, but the field stays plain text underneath: picking a
// result just fills the input with its display_name, same as typing it by
// hand. The chatbot builds its Google Maps link from that same text at
// answer time (google.com/maps/search needs no key either), so the "Check on
// Google Maps" line previews exactly what the customer would receive.
//
// Debounced at 600ms — Nominatim's usage policy caps free use at 1 req/s
// (https://operations.osmfoundation.org/policies/nominatim/); this is a
// backoffice form typed by hand, nowhere near that ceiling even without the
// debounce, but the delay avoids firing a request per keystroke.
export function LocationField({ defaultValue }: LocationFieldProps) {
  const [value, setValue] = useState(defaultValue ?? "")
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Only searches typed by the visitor trigger a lookup — picking a result or
  // loading the initial value must not immediately re-search itself.
  const suppressNextSearch = useRef(true)

  useEffect(() => {
    if (suppressNextSearch.current) {
      suppressNextSearch.current = false
      return
    }
    clearTimeout(debounceRef.current)
    const query = value.trim()
    if (query.length < 3) {
      setResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchPlaces(query)
        setResults(found)
        setIsOpen(true)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 600)
    return () => clearTimeout(debounceRef.current)
  }, [value])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const pickResult = (result: GeocodingResult) => {
    suppressNextSearch.current = true
    setValue(result.display_name)
    setResults([])
    setIsOpen(false)
  }

  const trimmed = value.trim()
  const previewHref = trimmed
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
    : null

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor="location">Location</Label>
      <div className="relative">
        <Input
          id="location"
          name="location"
          value={value}
          autoComplete="off"
          onChange={(e) => {
            suppressNextSearch.current = false
            setValue(e.target.value)
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search a place or type an address…"
        />
        {isSearching && (
          <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
        {isOpen && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-56 overflow-auto">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lon}-${i}`}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span>{r.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
