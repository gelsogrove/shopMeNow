import { useLanguage } from "@/contexts/LanguageContext"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

export function PrivacyPage() {
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
            {t("privacy.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("privacy.lastUpdate")}: November 24, 2025
          </p>
        </div>

        {/* Intro */}
        <p className="text-gray-700 mb-8 leading-relaxed">
          {t("privacy.intro")}
        </p>

        {/* Sections */}
        <div className="space-y-8">
          {/* Section 1 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("privacy.collection.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("privacy.collection.desc")}
            </p>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("privacy.usage.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("privacy.usage.desc")}
            </p>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("privacy.sharing.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("privacy.sharing.desc")}
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("privacy.security.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("privacy.security.desc")}
            </p>
          </div>

          {/* Section 5 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("privacy.rights.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("privacy.rights.desc")}
            </p>
          </div>

          {/* Section 6 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("privacy.cookies.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("privacy.cookies.desc")}
            </p>
          </div>

          {/* Section 7 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("privacy.contact.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("privacy.contact.desc")}
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
