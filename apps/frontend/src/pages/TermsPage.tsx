import { useLanguage } from "@/contexts/LanguageContext"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

export function TermsPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-xl p-8 md:p-12">
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t("forgotPassword.backToLogin")}</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {t("terms.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("terms.lastUpdate")}: November 24, 2025
          </p>
        </div>

        {/* Intro */}
        <p className="text-gray-700 mb-8 leading-relaxed">
          {t("terms.intro")}
        </p>

        {/* Sections */}
        <div className="space-y-8">
          {/* Section 1 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.acceptance.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.acceptance.desc")}
            </p>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.services.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.services.desc")}
            </p>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.account.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.account.desc")}
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.conduct.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.conduct.desc")}
            </p>
          </div>

          {/* Section 5 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.payment.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.payment.desc")}
            </p>
          </div>

          {/* Section 6 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.ip.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.ip.desc")}
            </p>
          </div>

          {/* Section 7 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.termination.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.termination.desc")}
            </p>
          </div>

          {/* Section 8 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.limitation.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.limitation.desc")}
            </p>
          </div>

          {/* Section 9 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.changes.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.changes.desc")}
            </p>
          </div>

          {/* Section 10 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("terms.contact.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("terms.contact.desc")}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            © 2025 eChatbot. {t("footer.rights")}
          </p>
        </div>
      </div>
    </div>
  )
}
