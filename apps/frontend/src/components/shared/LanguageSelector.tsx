import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"

type Language = "it" | "en" | "es" | "de"

const LANGUAGES = [
  { code: "it" as Language, name: "Italiano", flag: "🇮🇹" },
  { code: "en" as Language, name: "English", flag: "🇬🇧" },
  { code: "es" as Language, name: "Español", flag: "🇪🇸" },
  { code: "de" as Language, name: "Deutsch", flag: "🇩🇪" },
]

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[1]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-8 px-2 sm:h-9 sm:px-3 hover:bg-green-50 rounded-lg transition-colors text-xs sm:text-sm"
      >
        <span className="text-lg sm:text-xl leading-none">{current.flag}</span>
        <span className="font-medium text-slate-700">{current.code.toUpperCase()}</span>
        <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-44 sm:w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); setIsOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm sm:text-base hover:bg-green-50 hover:text-green-600 transition-colors ${
                language === lang.code ? "text-green-600 font-semibold" : "text-slate-700"
              }`}
            >
              <span className="text-lg sm:text-xl">{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
