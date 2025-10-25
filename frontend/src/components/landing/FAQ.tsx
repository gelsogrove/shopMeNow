import { useLanguage } from "@/contexts/LanguageContext"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

export function FAQ() {
  const { t } = useLanguage()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      question: t("faq.1.question"),
      answer: t("faq.1.answer"),
    },
    {
      question: t("faq.2.question"),
      answer: t("faq.2.answer"),
    },
    {
      question: t("faq.3.question"),
      answer: t("faq.3.answer"),
    },
    {
      question: t("faq.4.question"),
      answer: t("faq.4.answer"),
    },
    {
      question: t("faq.5.question"),
      answer: t("faq.5.answer"),
    },
    {
      question: t("faq.6.question"),
      answer: t("faq.6.answer"),
    },
    {
      question: t("faq.7.question"),
      answer: t("faq.7.answer"),
    },
    {
      question: t("faq.8.question"),
      answer: t("faq.8.answer"),
    },
    {
      question: t("faq.9.question"),
      answer: t("faq.9.answer"),
    },
    {
      question: t("faq.10.question"),
      answer: t("faq.10.answer"),
    },
  ]

  return (
    <div className="py-16 bg-gradient-to-br from-white via-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            {t("faq.title")}
          </h2>
          <p className="text-lg text-gray-600">{t("faq.subtitle")}</p>
        </div>

        <div className="grid gap-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden transition-all hover:border-blue-400"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left"
              >
                <h3 className="text-lg font-semibold text-gray-900 pr-8">
                  {faq.question}
                </h3>
                <ChevronDown
                  className={`w-5 h-5 text-blue-600 flex-shrink-0 transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? "max-h-96" : "max-h-0"
                }`}
              >
                <div className="px-6 pb-5 pt-2">
                  <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Decorative Image */}
        <div className="mt-12 flex justify-center">
          <div className="relative w-full max-w-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-green-400 rounded-2xl blur-3xl opacity-20"></div>
            <div className="relative bg-white rounded-2xl p-8 border-2 border-gray-200">
              <div className="flex items-center justify-center gap-4">
                <div className="text-6xl">💬</div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">
                    {t("faq.cta.title")}
                  </h4>
                  <p className="text-gray-600">{t("faq.cta.subtitle")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
