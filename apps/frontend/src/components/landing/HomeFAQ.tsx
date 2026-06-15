import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import {
  CalendarClock,
  ChevronDown,
  Database,
  FolderSync,
  Headphones,
  PhoneCall,
  PlugZap,
  ShieldCheck,
  Video,
  Workflow,
} from "lucide-react"
import { useState } from "react"
import { Helmet } from "react-helmet-async"

const FAQ_ITEMS = [
  { key: 1, icon: ShieldCheck, accent: "bg-emerald-400/10 text-emerald-300" },
  { key: 2, icon: CalendarClock, accent: "bg-violet-400/10 text-violet-300" },
  { key: 3, icon: Headphones, accent: "bg-green-400/10 text-green-300" },
  { key: 4, icon: PhoneCall, accent: "bg-cyan-400/10 text-cyan-300" },
  { key: 5, icon: Workflow, accent: "bg-amber-400/10 text-amber-300" },
  { key: 6, icon: PlugZap, accent: "bg-indigo-400/10 text-indigo-300" },
  { key: 7, icon: Video, accent: "bg-blue-400/10 text-blue-300" },
  { key: 8, icon: Database, accent: "bg-teal-400/10 text-teal-300" },
  { key: 9, icon: FolderSync, accent: "bg-rose-400/10 text-rose-300" },
]

export function HomeFAQ() {
  const { t } = useLanguage()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = FAQ_ITEMS.map((item) => ({
    ...item,
    question: t(`homeFaq.q${item.key}`),
    answer: t(`homeFaq.a${item.key}`),
  }))

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }

  return (
    <section id="faq" className="py-20">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-3xl lg:text-4xl font-bold text-white">
              {t("homeFaq.title")}
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              {t("homeFaq.subtitle")}
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-3">
            {faqs.map((faq, index) => {
              const Icon = faq.icon
              const isOpen = openIndex === index
              return (
                <div
                  key={faq.key}
                  className="bg-slate-900/50 backdrop-blur rounded-2xl border border-white/10 hover:border-green-400/30 transition-colors duration-300"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-4 px-6 py-5 text-left"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${faq.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 text-lg font-semibold text-white">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pl-20 text-slate-300 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
