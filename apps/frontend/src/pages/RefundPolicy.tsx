import { useEffect, useState } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"

interface LegalDocument {
  type: string
  title: string
  content: string
  isActive: boolean
}

export function RefundPolicy() {
  const { language, t } = useLanguage()
  const [doc, setDoc] = useState<LegalDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/legal-documents/REFUND_POLICY?lang=${language}`)
      .then((res) => {
        if (!res.ok) throw new Error("Document not found")
        return res.json()
      })
      .then((data: LegalDocument) => setDoc(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [language])

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Refund Policy | eChatbot"
        description="eChatbot refund and cancellation policy. 14-day money back guarantee, cancellation terms and procedures."
        keywords="echatbot refund policy, money back guarantee, cancellation policy, whatsapp chatbot refund"
        url="/refund"
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
          <span>{t("forgotPassword.backToLogin")}</span>
        </Link>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-red-500">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && doc && (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                {doc.title}
              </h1>
            </div>

            {/* Content from DB (HTML) */}
            <div
              className="prose prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: doc.content }}
            />

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500 text-center">
                © 2025 eChatbot. {t("footer.rights")}
              </p>
            </div>
          </>
        )}

      </div>
      </main>
      <SiteFooter />
    </div>
  )
}
