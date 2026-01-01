import { useEffect, useState } from "react"
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Mail,
  MessageSquare,
  Shield,
  Zap,
} from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/lib/toast"
import { useNavigate } from "react-router-dom"

export function LandingPage() {
  const [email, setEmail] = useState("")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const meta = {
      title: "eChatbot | WhatsApp AI per l'e-commerce",
      description:
        "Automatizza vendite, supporto e riattivazione su WhatsApp con un assistente AI pensato per l'e-commerce. Presto online. Entra nella lista early access.",
      keywords:
        "whatsapp ai, ecommerce chatbot, automazione whatsapp, assistente vendite, customer support",
      ogTitle: "eChatbot | WhatsApp AI per l'e-commerce",
      ogDescription:
        "Trasforma WhatsApp nel tuo canale di vendita migliore con conversazioni AI e automazioni.",
    }

    document.title = meta.title
    const upsertMeta = (key: string, content: string, attr = "name") => {
      const selector = `meta[${attr}="${key}"]`
      let tag = document.querySelector<HTMLMetaElement>(selector)
      if (!tag) {
        tag = document.createElement("meta")
        tag.setAttribute(attr, key)
        document.head.appendChild(tag)
      }
      tag.setAttribute("content", content)
    }

    upsertMeta("description", meta.description)
    upsertMeta("keywords", meta.keywords)
    upsertMeta("robots", "index, follow")
    upsertMeta("og:title", meta.ogTitle, "property")
    upsertMeta("og:description", meta.ogDescription, "property")
    upsertMeta("og:type", "website", "property")
  }, [])

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsLoading(true)

    // Simulate API call (replace with actual backend endpoint)
    setTimeout(() => {
      setIsSubscribed(true)
      setIsLoading(false)
      toast.success("Thank you! We'll notify you when we launch.")
      setEmail("")
    }, 1000)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
      `}</style>

      <div
        className="min-h-screen flex flex-col relative overflow-hidden text-slate-900"
        style={{
          fontFamily: '"Plus Jakarta Sans", "Space Grotesk", system-ui, sans-serif',
          background:
            "radial-gradient(circle at top left, rgba(16, 185, 129, 0.18), transparent 45%), radial-gradient(circle at 80% 20%, rgba(34, 197, 94, 0.15), transparent 40%), #f8fafc",
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-40 right-10 h-96 w-96 rounded-full blur-3xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(16, 185, 129, 0.28), rgba(20, 184, 166, 0.18))",
            }}
          />
          <div
            className="absolute -bottom-32 left-10 h-[28rem] w-[28rem] rounded-full blur-3xl"
            style={{
              background:
                "linear-gradient(45deg, rgba(34, 197, 94, 0.25), rgba(132, 204, 22, 0.18))",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(transparent_0,transparent_95%,rgba(15,23,42,0.06)_96%),linear-gradient(90deg,transparent_0,transparent_95%,rgba(15,23,42,0.06)_96%)] bg-[size:80px_80px] opacity-40" />
        </div>

        <header className="relative z-10 w-full px-6 py-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white shadow-md flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="eChatbot Logo"
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">eChatbot</div>
                <div className="text-xs uppercase tracking-[0.3em] text-emerald-600">
                  WhatsApp AI per il commercio
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/auth/login")}
                className="text-sm font-semibold text-slate-700 hover:text-emerald-700"
              >
                Area Admin
              </button>
              <Button
                onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5"
              >
                Lista d'attesa
              </Button>
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 px-6 pb-24 pt-10">
          <div className="max-w-6xl mx-auto grid gap-12 lg:grid-cols-[1.1fr,0.9fr] items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 shadow-sm">
                Lancio in arrivo
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight">
                Trasforma WhatsApp nel tuo canale più veloce
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-lime-500">
                  per generare vendite.
                </span>
              </h1>
              <p className="text-lg text-slate-700 max-w-xl">
                eChatbot è il layer AI per il commercio su WhatsApp. Automatizziamo vendite,
                supporto e riattivazione con un assistente che conosce il catalogo,
                rispetta le policy e fa avanzare ogni lead.
              </p>
              <p className="text-sm text-slate-600 max-w-xl">
                Pensato per team e-commerce che vogliono velocità, coerenza e risultati misurabili
                senza aumentare il personale.
              </p>

              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Risposte in meno di 1 minuto, 24/7
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Qualifica automatica e tagging clienti
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Flussi e-commerce nativi
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Button
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6"
                  onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Richiedi early access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <button
                  onClick={() => navigate("/auth/login")}
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Sei già cliente? Accedi
                </button>
              </div>

              <div className="grid grid-cols-3 gap-6 max-w-xl pt-4 text-left">
                {[
                  { value: "120%", label: "Aumento velocità risposta" },
                  { value: "32%", label: "Conversioni più alte" },
                  { value: "3x", label: "Prima risposta più rapida" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm">
                    <div className="text-2xl font-semibold text-slate-900">{stat.value}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <div className="rounded-[32px] border border-emerald-100 bg-white/80 shadow-2xl p-8 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Demo live</p>
                    <h2 className="text-2xl font-semibold">Commerce Copilot</h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Nuovo lead
                  </span>
                </div>
                <div className="space-y-4">
                  {[
                    {
                      title: "Intento d'ordine rilevato",
                      detail: "Cliente vuole 3x Sneakers nere, taglia 42",
                      icon: MessageSquare,
                    },
                    {
                      title: "Link checkout automatico",
                      detail: "Inviato link pagamento e opzioni spedizione",
                      icon: Zap,
                    },
                    {
                      title: "Follow-up programmato",
                      detail: "Reminder tra 3 ore se non pagato",
                      icon: BarChart3,
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-slate-900 text-white p-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
                    Risultato
                  </p>
                  <p className="text-lg font-semibold">
                    Risposta in 18 secondi. Vendita chiusa in 4 messaggi.
                  </p>
                </div>
              </div>

              <div className="absolute -bottom-6 -left-6 hidden md:block">
                <div className="rounded-2xl bg-white/90 border border-emerald-100 shadow-lg p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-[0.3em]">
                    Settori attivi
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                    <span className="rounded-full border border-slate-200 px-3 py-1">Retail</span>
                    <span className="rounded-full border border-slate-200 px-3 py-1">Beauty</span>
                    <span className="rounded-full border border-slate-200 px-3 py-1">Food</span>
                    <span className="rounded-full border border-slate-200 px-3 py-1">Electronics</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <section className="max-w-6xl mx-auto mt-16 grid gap-6 lg:grid-cols-[1.1fr,0.9fr] items-start">
            <div className="rounded-[32px] border border-emerald-100 bg-white/90 p-8 shadow-lg">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">
                Cosa facciamo
              </p>
              <h2 className="text-3xl font-semibold mt-3">Un team WhatsApp AI dentro un prodotto.</h2>
              <p className="mt-4 text-slate-600">
                Ci colleghiamo al tuo numero WhatsApp e diventiamo la prima linea del commercio:
                rispondiamo alle domande, consigliamo prodotti, creiamo carrelli, inviamo link
                di checkout e passiamo la conversazione al team quando serve.
              </p>
              <div className="mt-6 grid gap-4">
                {[
                  {
                    title: "Automazione vendite",
                    copy: "Qualifica lead, consiglia prodotti e porta al checkout in un'unica chat.",
                  },
                  {
                    title: "Supporto clienti",
                    copy: "Gestisci FAQ, stato ordine e policy con risposte coerenti.",
                  },
                  {
                    title: "Riattivazione e campagne",
                    copy: "Riporta i clienti con follow-up intelligenti e messaggi mirati.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-600 mt-1">{item.copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200/80 bg-slate-900 text-white p-8 shadow-xl">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
                Perché conta
              </p>
              <h2 className="text-3xl font-semibold mt-3">Trasforma le chat in fatturato.</h2>
              <p className="mt-4 text-sm text-slate-300">
                WhatsApp è il canale a più alta intenzione. Ti aiutiamo a catturare la domanda,
                ridurre i tempi di risposta e mantenere ogni conversazione coerente col brand.
              </p>
              <div className="mt-6 grid gap-4 text-sm text-slate-100">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="font-semibold">Risposte istantanee, in ogni fuso</p>
                    <p className="text-xs text-slate-300">
                      L'AI gestisce il primo contatto mentre il team segue i casi complessi.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="font-semibold">Handoff strutturato agli operatori</p>
                    <p className="text-xs text-slate-300">
                      Quando serve, passiamo il contesto completo per chiudere più rapidamente.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="font-semibold">Insight azionabili</p>
                    <p className="text-xs text-slate-300">
                      Monitora conversioni, intenti e richieste principali in tempo reale.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto mt-20 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Assistenza naturale",
                copy: "Flussi conversazionali addestrati su catalogo, policy e tono di voce.",
                icon: MessageSquare,
              },
              {
                title: "Compliance by design",
                copy: "Gestione sicura dei dati, opt-in e pratiche GDPR-ready di default.",
                icon: Shield,
              },
              {
                title: "Analytics di performance",
                copy: "Dashboard live per ricavi, deflection e sentiment clienti.",
                icon: BarChart3,
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="rounded-3xl border border-emerald-100 bg-white/80 p-6 shadow-lg"
              >
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-emerald-700" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{feature.copy}</p>
              </motion.div>
            ))}
          </section>

          <section className="max-w-6xl mx-auto mt-20 grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "Come funziona",
                items: [
                  "Collega il tuo numero WhatsApp Business.",
                  "Importa catalogo, FAQ e policy.",
                  "Lancia e monitora le conversazioni.",
                ],
              },
              {
                title: "Ideale per",
                items: [
                  "Brand e-commerce Retail & DTC.",
                  "Team support ad alto volume.",
                  "Store che fanno campagne WhatsApp.",
                ],
              },
              {
                title: "Sicurezza e compliance",
                items: [
                  "Separazione dati per workspace.",
                  "Flussi di approvazione umana per azioni sensibili.",
                  "Gestione dati conforme al GDPR.",
                ],
              },
            ].map((block) => (
              <div
                key={block.title}
                className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-md"
              >
                <h3 className="text-lg font-semibold">{block.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section
            id="waitlist"
            className="max-w-5xl mx-auto mt-20 rounded-[36px] border border-emerald-100 bg-white/90 p-8 md:p-12 shadow-xl"
          >
            <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr] items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-600">
                  Early access
                </p>
                <h2 className="text-3xl md:text-4xl font-semibold mt-3">
                  Sii tra i primi al lancio.
                </h2>
                <p className="mt-4 text-slate-600">
                  Avrai onboarding prioritario, aggiornamenti pricing e contatto diretto con il
                  team durante il rollout.
                </p>
              </div>
              {!isSubscribed ? (
                <form onSubmit={handleSubscribe} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="nome@azienda.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 rounded-full border-slate-200 bg-white"
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-12 w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {isLoading ? "Ti aggiungiamo..." : "Entra nella lista"}
                  </Button>
                  <p className="text-xs text-slate-500">
                    Zero spam. Solo aggiornamenti prodotto e accesso al lancio.
                  </p>
                </form>
              ) : (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  <p className="mt-3 text-lg font-semibold text-emerald-900">
                    Sei dentro. Ti avvisiamo per primo.
                  </p>
                  <p className="mt-2 text-sm text-emerald-700">
                    Controlla la mail per l'accesso anticipato.
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>

        <footer className="relative z-10 border-t border-slate-200/70 bg-white/70 py-8">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              © {new Date().getFullYear()} eChatbot. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <a href="/privacy" className="text-slate-600 hover:text-emerald-600">
                Privacy Policy
              </a>
              <a href="/terms" className="text-slate-600 hover:text-emerald-600">
                Terms of Service
              </a>
              <a href="/support" className="text-slate-600 hover:text-emerald-600">
                Contact
              </a>
            </div>
          </div>
        </footer>

        <a
          href="https://wa.me/1234567890"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-4 shadow-2xl transition-transform hover:scale-110 z-50 group"
          aria-label="Contact us on WhatsApp"
        >
          <MessageSquare className="h-6 w-6" fill="currentColor" />
          <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Chat with us
          </span>
        </a>
      </div>
    </>
  )
}
