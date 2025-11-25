import { useLanguage } from "@/contexts/LanguageContext"

const flags = {
  it: "🇮🇹",
  en: "🇬🇧",
  es: "🇪🇸",
  pt: "🇵🇹",
}

const languageNames = {
  it: "Italiano",
  en: "English",
  es: "Español",
  pt: "Português",
}

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()

  const handleLanguageChange = (lang: "it" | "en" | "es" | "pt") => {
    console.log(`🌍 LanguageSelector: Changing language from ${language} to ${lang}`)
    
    // setLanguage now handles localStorage save AND page reload
    setLanguage(lang)
  }

  return (
    <div className="flex items-center gap-1">
      {Object.entries(flags).map(([lang, flag]) => (
        <button
          key={lang}
          onClick={() => handleLanguageChange(lang as "it" | "en" | "es" | "pt")}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
            language === lang
              ? "bg-green-500 shadow-md scale-110 ring-2 ring-green-300"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
          title={languageNames[lang as keyof typeof languageNames]}
        >
          <span className="text-base">{flag}</span>
        </button>
      ))}
    </div>
  )
}
