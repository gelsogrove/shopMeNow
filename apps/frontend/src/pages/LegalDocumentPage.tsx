import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import DOMPurify from "dompurify"
import { ArrowLeft } from "lucide-react"
import { publicApi } from "@/services/publicApi"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { useLanguage } from "@/contexts/LanguageContext"

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

  // Use global language context (stores under key "language" in localStorage)
  const { language } = useLanguage()

  const translations = {
    it: { backToHome: "Torna alla home", notFound: "Documento non trovato", notAvailable: "Il documento richiesto non è disponibile.", loading: "Caricamento..." },
    en: { backToHome: "Back to home", notFound: "Document not found", notAvailable: "The requested document is not available.", loading: "Loading..." },
    es: { backToHome: "Volver al inicio", notFound: "Documento no encontrado", notAvailable: "El documento solicitado no está disponible.", loading: "Cargando..." },
    de: { backToHome: "Zurück zur Startseite", notFound: "Dokument nicht gefunden", notAvailable: "Das angeforderte Dokument ist nicht verfügbar.", loading: "Wird geladen..." },
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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-purple-600 text-lg">{t.loading}</div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-6 py-32 text-center">
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
        <SiteFooter />
      </div>
    )
  }

  const urlMap: Record<string, string> = {
    PRIVACY_POLICY: "/privacy",
    TERMS_OF_SERVICE: "/terms",
    REFUND_POLICY: "/refund",
    GDPR: "/gdpr",
  }

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={`${document.title} | eChatbot`}
        description={`${document.title} - eChatbot WhatsApp e-commerce chatbot platform.`}
        url={urlMap[docType] ?? "/"}
        lang={language}
      />
      <SiteHeader />
      <main className="pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 bg-white rounded-lg shadow-xl p-8 md:p-12 mt-4">
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
      </main>
      <SiteFooter />
    </div>
  )
}
