import { useLanguage } from "@/contexts/LanguageContext"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"

export function RefundPolicy() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Refund Policy | eChatbot"
        description="eChatbot refund and cancellation policy. 14-day money back guarantee, cancellation terms and procedures."
        url="/refund"
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

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {t("refund.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("refund.lastUpdate")}: November 24, 2025
          </p>
        </div>

        {/* Intro */}
        <p className="text-gray-700 mb-8 leading-relaxed">
          {t("refund.intro")}
        </p>

        {/* Sections */}
        <div className="space-y-8">
          {/* Section 1 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("refund.eligibility.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("refund.eligibility.desc")}
            </p>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("refund.process.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("refund.process.desc")}
            </p>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("refund.proration.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("refund.proration.desc")}
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("refund.nonrefundable.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("refund.nonrefundable.desc")}
            </p>
          </div>

          {/* Section 5 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("refund.cancellation.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("refund.cancellation.desc")}
            </p>
          </div>

          {/* Section 6 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("refund.chargeback.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("refund.chargeback.desc")}
            </p>
          </div>

          {/* Section 7 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("refund.data.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("refund.data.desc")}
            </p>
          </div>

          {/* Section 8 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("refund.appeal.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("refund.appeal.desc")}
            </p>
          </div>

          {/* Section 9 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {t("refund.contact.title")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("refund.contact.desc")}
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
      </main>
      <SiteFooter />
    </div>
  )
}
