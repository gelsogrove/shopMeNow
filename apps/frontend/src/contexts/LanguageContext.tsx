import React, { createContext, useContext, useEffect, useState } from "react"
import { translations } from "./language-translations"

type Language = "it" | "en" | "es" | "pt" | "fr" | "ca"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

export const SUPPORTED_LANGUAGES = [
  { code: "it" as Language, name: "Italiano", flag: "🇮🇹" },
  { code: "en" as Language, name: "English", flag: "🇬🇧" },
  { code: "es" as Language, name: "Español", flag: "🇪🇸" },
  { code: "pt" as Language, name: "Português", flag: "🇵🇹" },
  { code: "fr" as Language, name: "Français", flag: "🇫🇷" },
  { code: "ca" as Language, name: "Català", flag: "🏴󠁥󠁳󠁣󠁴󠁿" },
]

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
)


export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // 1. Check localStorage first
    const saved = localStorage.getItem("language")
    if (saved && ["it", "en", "es", "pt"].includes(saved)) {
      return saved as Language
    }
    
    // 2. Detect browser language
    const browserLang = navigator.language.split('-')[0].toLowerCase()
    const langMap: Record<string, Language> = {
      'it': 'it',
      'en': 'en', 
      'es': 'es',
      'pt': 'pt',
      // Common variants
      'italiano': 'it',
      'english': 'en',
      'español': 'es',
      'português': 'pt',
    }
    
    return langMap[browserLang] || 'en' // Default to English if browser lang not supported
  })

  useEffect(() => {
    localStorage.setItem("language", language)
    // Force re-render of entire app when language changes
    document.documentElement.lang = language
  }, [language])

  const setLanguage = (lang: Language) => {
    // Save to localStorage FIRST
    localStorage.setItem("language", lang)
    // Then update state (this triggers useEffect which will re-render all components)
    setLanguageState(lang)
  }

  const t = (key: string): string => {
    // Try current language first, then English fallback, then return key
    return translations[language]?.[key] || translations["en"]?.[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
