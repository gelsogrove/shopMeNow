import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import DOMPurify from "dompurify"
import { ArrowLeft } from "lucide-react"
import { publicApi } from "@/services/publicApi"

interface LegalDocument {
  type: string
  title: string
  content: string
  isActive: boolean
}

interface LegalDocumentPageProps {
  docType: "GDPR" | "PRIVACY_POLICY" | "TERMS_OF_SERVICE" | "REFUND_POLICY"
}

export function LegalDocumentPage({ docType }: LegalDocumentPageProps) {
  const [document, setDocument] = useState<LegalDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Detect user language: localStorage > browser > default to English
  const getUserLanguage = (): string => {
    const savedLang = localStorage.getItem("userLanguage")
    if (savedLang && ["it", "en", "es", "pt"].includes(savedLang)) {
      return savedLang
    }
    
    const browserLang = navigator.language.slice(0, 2).toLowerCase()
    if (["it", "en", "es", "pt"].includes(browserLang)) {
      return browserLang
    }
    
    return "en" // Default to English
  }

  const [language] = useState<string>(getUserLanguage())

  const translations = {
    it: { backToHome: "Torna alla home", notFound: "Documento non trovato", notAvailable: "Il documento richiesto non è disponibile.", loading: "Caricamento..." },
    en: { backToHome: "Back to home", notFound: "Document not found", notAvailable: "The requested document is not available.", loading: "Loading..." },
    es: { backToHome: "Volver al inicio", notFound: "Documento no encontrado", notAvailable: "El documento solicitado no está disponible.", loading: "Cargando..." },
    pt: { backToHome: "Voltar ao início", notFound: "Documento não encontrado", notAvailable: "O documento solicitado não está disponível.", loading: "Carregando..." },
  }

  const t = translations[language as keyof typeof translations] || translations.en

  useEffect(() => {
    fetchDocument()
  }, [docType, language])

  const fetchDocument = async () => {
    try {
      setIsLoading(true)
      
      // Legal documents are GLOBAL to eCHATBOT platform (not workspace-specific)
      // Note: api client already has baseURL="/api/v1", so we just need the path
      const response = await publicApi.get(
        `/legal-documents/${docType}?lang=${language}`
      )

      setDocument(response.data)
    } catch (error) {
      console.error("Error fetching legal document:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-purple-600 text-lg">{t.loading}</div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full bg-white rounded-lg shadow-xl p-8 md:p-12">
          <h1 className="text-2xl font-bold text-gray-900">{t.notFound}</h1>
          <p className="text-gray-600 mt-4">{t.notAvailable}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mt-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.backToHome}</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-xl p-8 md:p-12">
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToHome}</span>
        </Link>

        {/* Content */}
        <div
          className="prose prose-gray max-w-none text-gray-700 leading-relaxed space-y-8"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(document.content),
          }}
        />

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            © 2025 eChatbot. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    </div>
  )
}
