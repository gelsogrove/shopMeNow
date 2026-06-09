import { useState, type FormEvent } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import { CheckCircle, Send } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/services/api"

// Sales-led demo request form. Replaces the old self-service Sign Up
// path: visitors land here from every "Get started / Inizia ora" CTA,
// fill in 5 fields, the backend mails the lead to the sales inbox and
// a manual onboarding follows. No account is created from this page.

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Richiedi una demo - eChatbot",
    seoDesc:
      "Vuoi vedere eChatbot in azione sul tuo business? Raccontaci il tuo caso d'uso e ti contattiamo entro 24 ore con una demo personalizzata.",
    seoKeys: "demo chatbot whatsapp, richiedi demo echatbot, demo personalizzata",
    badge: "Richiedi una demo",
    heroTitle: "Parliamo del tuo business",
    heroSub:
      "Niente registrazione self-service: ogni cliente parte da un'analisi su misura. Lasciaci qualche informazione e organizziamo una demo dedicata.",
    formTitle: "Richiedi accesso",
    formSubtitle:
      "Cinque informazioni rapide. Ti contattiamo entro 24 ore (giorni lavorativi).",
    name: "Nome e cognome",
    namePlaceholder: "Es. Mario Rossi",
    email: "Email aziendale",
    emailPlaceholder: "nome@azienda.com",
    company: "Azienda",
    companyPlaceholder: "Nome dell'azienda",
    industry: "Settore",
    industryPlaceholder: "Es. lavanderie, palestre, e-commerce…",
    volume: "Volume stimato di messaggi/mese",
    volumePlaceholder: "Es. 1.000 / 5.000 / 20.000+",
    notes: "Note (facoltativo)",
    notesPlaceholder: "Raccontaci il tuo caso d'uso o le tue esigenze…",
    send: "Invia richiesta",
    sending: "Invio in corso…",
    successTitle: "Richiesta ricevuta!",
    successDesc:
      "Grazie. Ti rispondiamo entro 24 ore lavorative con i prossimi passi.",
    genericError: "Qualcosa è andato storto. Riprova tra poco.",
  },
  en: {
    seoTitle: "Request a demo - eChatbot",
    seoDesc:
      "Want to see eChatbot in action for your business? Tell us about your use case and we'll get back within 24 hours with a tailored demo.",
    seoKeys: "whatsapp chatbot demo, request demo echatbot, custom demo",
    badge: "Request a demo",
    heroTitle: "Let's talk about your business",
    heroSub:
      "No self-service sign-up: every customer starts with a tailored analysis. Leave us a few details and we'll arrange a dedicated demo.",
    formTitle: "Request access",
    formSubtitle:
      "Five quick fields. We'll reply within 24 business hours.",
    name: "Full name",
    namePlaceholder: "e.g. Mario Rossi",
    email: "Business email",
    emailPlaceholder: "name@company.com",
    company: "Company",
    companyPlaceholder: "Company name",
    industry: "Industry",
    industryPlaceholder: "e.g. laundromats, gyms, e-commerce…",
    volume: "Estimated messages/month",
    volumePlaceholder: "e.g. 1,000 / 5,000 / 20,000+",
    notes: "Notes (optional)",
    notesPlaceholder: "Tell us about your use case or needs…",
    send: "Send request",
    sending: "Sending…",
    successTitle: "Request received!",
    successDesc:
      "Thanks. We'll reply within 24 business hours with next steps.",
    genericError: "Something went wrong. Please try again shortly.",
  },
  es: {
    seoTitle: "Solicita una demo - eChatbot",
    seoDesc:
      "¿Quieres ver eChatbot en acción en tu negocio? Cuéntanos tu caso de uso y te contactamos en 24 horas con una demo personalizada.",
    seoKeys: "demo chatbot whatsapp, solicitar demo echatbot, demo personalizada",
    badge: "Solicita una demo",
    heroTitle: "Hablemos de tu negocio",
    heroSub:
      "Sin registro self-service: cada cliente empieza con un análisis a medida. Déjanos algunos datos y organizamos una demo dedicada.",
    formTitle: "Solicitar acceso",
    formSubtitle:
      "Cinco campos rápidos. Te respondemos en 24 horas laborables.",
    name: "Nombre y apellido",
    namePlaceholder: "Ej. Mario Rossi",
    email: "Email empresarial",
    emailPlaceholder: "nombre@empresa.com",
    company: "Empresa",
    companyPlaceholder: "Nombre de la empresa",
    industry: "Sector",
    industryPlaceholder: "Ej. lavanderías, gimnasios, e-commerce…",
    volume: "Volumen estimado de mensajes/mes",
    volumePlaceholder: "Ej. 1.000 / 5.000 / 20.000+",
    notes: "Notas (opcional)",
    notesPlaceholder: "Cuéntanos tu caso de uso o tus necesidades…",
    send: "Enviar solicitud",
    sending: "Enviando…",
    successTitle: "¡Solicitud recibida!",
    successDesc:
      "Gracias. Te respondemos en 24 horas laborables con los siguientes pasos.",
    genericError: "Algo ha ido mal. Inténtalo de nuevo en un momento.",
  },
  pt: {
    seoTitle: "Solicita uma demo - eChatbot",
    seoDesc:
      "Queres ver o eChatbot em ação no teu negócio? Conta-nos o teu caso de uso e respondemos em 24 horas com uma demo personalizada.",
    seoKeys: "demo chatbot whatsapp, pedir demo echatbot, demo personalizada",
    badge: "Solicita uma demo",
    heroTitle: "Falemos do teu negócio",
    heroSub:
      "Sem registo self-service: cada cliente começa com uma análise à medida. Deixa-nos algumas informações e organizamos uma demo dedicada.",
    formTitle: "Pedir acesso",
    formSubtitle:
      "Cinco campos rápidos. Respondemos em 24 horas úteis.",
    name: "Nome completo",
    namePlaceholder: "Ex. Mario Rossi",
    email: "Email empresarial",
    emailPlaceholder: "nome@empresa.com",
    company: "Empresa",
    companyPlaceholder: "Nome da empresa",
    industry: "Setor",
    industryPlaceholder: "Ex. lavandarias, ginásios, e-commerce…",
    volume: "Volume estimado de mensagens/mês",
    volumePlaceholder: "Ex. 1.000 / 5.000 / 20.000+",
    notes: "Notas (opcional)",
    notesPlaceholder: "Conta-nos o teu caso de uso ou as tuas necessidades…",
    send: "Enviar pedido",
    sending: "A enviar…",
    successTitle: "Pedido recebido!",
    successDesc:
      "Obrigado. Respondemos em 24 horas úteis com os próximos passos.",
    genericError: "Algo correu mal. Tenta novamente daqui a pouco.",
  },
} as const

export default function RequestAccessPage() {
  const { language } = useLanguage()
  const t = T[(language as Language) in T ? (language as Language) : "en"]

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    industry: "",
    monthlyVolume: "",
    notes: "",
    // Honeypot — must remain empty. Hidden from real users via CSS and
    // aria-hidden; bots that auto-fill every input will give themselves
    // away by typing here.
    website: "",
  })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    setError(null)
    setSending(true)
    try {
      await api.post("/request-access", form)
      setDone(true)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || t.genericError
      setError(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#070d18] text-slate-200">
      <SEO
        title={t.seoTitle}
        description={t.seoDesc}
        keywords={t.seoKeys}
        url="/request-access"
        robots="index, follow"
      />
      <SiteHeader />

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-[#25D366]/15 text-[#25D366] text-xs font-semibold tracking-wider uppercase mb-4">
            {t.badge}
          </span>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight"
          >
            {t.heroTitle}
          </motion.h1>
          <p className="mt-4 text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            {t.heroSub}
          </p>
        </section>

        <section className="max-w-xl mx-auto px-4 sm:px-6 pb-24">
          <div className="bg-slate-900/50 backdrop-blur border border-white/10 rounded-2xl shadow-2xl p-7 sm:p-9">
            {done ? (
              <div className="text-center py-6">
                <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  {t.successTitle}
                </h2>
                <p className="text-slate-400 leading-relaxed">{t.successDesc}</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    {t.formTitle}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {t.formSubtitle}
                  </p>
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {/* Honeypot — visually & semantically hidden, but
                      autocomplete-off so password managers leave it alone.
                      Bots that fill every <input> will populate it. */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: "-10000px",
                      width: 1,
                      height: 1,
                      overflow: "hidden",
                    }}
                  >
                    <label htmlFor="ra-website">Website</label>
                    <input
                      id="ra-website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={update("website")}
                    />
                  </div>

                  <Field
                    label={t.name}
                    placeholder={t.namePlaceholder}
                    value={form.name}
                    onChange={update("name")}
                    required
                  />
                  <Field
                    label={t.email}
                    placeholder={t.emailPlaceholder}
                    value={form.email}
                    onChange={update("email")}
                    type="email"
                    required
                  />
                  <Field
                    label={t.company}
                    placeholder={t.companyPlaceholder}
                    value={form.company}
                    onChange={update("company")}
                    required
                  />
                  <Field
                    label={t.industry}
                    placeholder={t.industryPlaceholder}
                    value={form.industry}
                    onChange={update("industry")}
                    required
                  />
                  <Field
                    label={t.volume}
                    placeholder={t.volumePlaceholder}
                    value={form.monthlyVolume}
                    onChange={update("monthlyVolume")}
                    required
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300" htmlFor="ra-notes">
                      {t.notes}
                    </label>
                    <textarea
                      id="ra-notes"
                      value={form.notes}
                      onChange={update("notes")}
                      placeholder={t.notesPlaceholder}
                      rows={4}
                      className="w-full resize-y rounded-md border border-white/10 bg-slate-900/60 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2.5">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-[#25D366] hover:bg-[#1fb855] text-slate-950 py-3 text-base font-semibold rounded-xl shadow-md flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      t.sending
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {t.send}
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (e: { target: { value: string } }) => void
  type?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-300">
        {label}
        {required && <span className="text-[#25D366] ml-0.5">*</span>}
      </label>
      <Input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="h-11 text-base bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500"
      />
    </div>
  )
}
