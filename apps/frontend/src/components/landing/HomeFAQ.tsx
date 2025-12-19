import {
  AlertOctagon,
  CalendarClock,
  Headphones,
  PhoneCall,
  PlugZap,
  ShieldCheck,
  Tag,
  Users,
  Workflow,
  Briefcase,
} from "lucide-react"

const faqs = [
  {
    icon: ShieldCheck,
    accent: "from-emerald-50 to-white",
    question: "Come trattate la privacy e i dati sensibili?",
    answer:
      "I dati restano nel workspace: conserviamo le conversazioni in UE, cifriamo tutto in transito e puoi decidere per quanto tempo mantenere lo storico. Il modello usa solo il tuo dataset, nessun training esterno.",
  },
  {
    icon: Users,
    accent: "from-blue-50 to-white",
    question: "Posso invitare colleghi nel mio workspace?",
    answer:
      "Certo. I piani Free e Basic includono 3 membri, Premium e Enterprise non hanno limiti. Ogni ruolo può avere permessi diversi (marketing, supporto, amministrazione).",
  },
  {
    icon: Tag,
    accent: "from-orange-50 to-white",
    question: "Si possono creare offerte, bundle o coupon?",
    answer:
      "Puoi generare listini mirati, applicare coupon temporanei e pubblicarli direttamente in chat. Ogni offerta può avere lingue, canali e disponibilità personalizzate.",
  },
  {
    icon: CalendarClock,
    accent: "from-violet-50 to-white",
    question: "Posso schedulare push o campagne WhatsApp?",
    answer:
      "Sì, pianifichi broadcast e follow-up automatici con regole su fuso orario, opt-in e prodotti disponibili. Il motore evita l’invio se l’utente sta già parlando con l’operatore.",
  },
  {
    icon: Headphones,
    accent: "from-green-50 to-white",
    question: "Il cliente può parlare con un operatore umano?",
    answer:
      "In ogni momento. Il bot riconosce parole chiave o emozioni e passa la conversazione con tutto il contesto, allegati e carrello.",
  },
  {
    icon: PhoneCall,
    accent: "from-cyan-50 to-white",
    question: "Come vengo avvisato quando serve un operatore?",
    answer:
      "Inviamo notifiche via email, push e WhatsApp interno. Puoi anche assegnare turni: il primo agente disponibile riceve un ping diretto.",
  },
  {
    icon: Workflow,
    accent: "from-amber-50 to-white",
    question: "Posso decidere le regole di escalation?",
    answer:
      "Definisci trigger (parole, sentimenti, stato del carrello, VIP flag) e azioni: avviso umano, blocco pagamenti, richiesta di documenti o apertura ticket.",
  },
  {
    icon: PlugZap,
    accent: "from-indigo-50 to-white",
    question: "Come integro il mio CRM o ERP?",
    answer:
      "Con il piano Enterprise creiamo un connettore dedicato (HubSpot, Salesforce, SAP, ecc.). Sincronizziamo contatti, offerte e pipeline senza toccare il tuo stack.",
  },
  {
    icon: AlertOctagon,
    accent: "from-rose-50 to-white",
    question: "Cosa succede quando termino il credito?",
    answer:
      "Avvisiamo molto prima: email, badge in dashboard e messaggi su WhatsApp interno. È previsto un piccolo buffer negativo per non interrompere le chat attive.",
  },
  {
    icon: Briefcase,
    accent: "from-slate-50 to-white",
    question: "Non ho un e-commerce, offro servizi: posso usare eChatbot?",
    answer:
      "Sì. Puoi raccogliere richieste, prenotazioni e preventivi usando form dinamici, allegati e pagamenti link-to-pay. Il bot costruisce ordini anche senza catalogo.",
  },
]

export function HomeFAQ() {
  return (
    <section className="py-20 bg-gradient-to-b from-white via-slate-50 to-white" id="faq">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="grid items-start gap-10 lg:gap-16 lg:grid-cols-[1.15fr,0.85fr]">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-600">
              <span className="h-px w-10 bg-emerald-500" />
              FAQ
            </p>
            <h2 className="mt-4 text-3xl lg:text-4xl font-bold text-slate-900">
              Tutto quello che un founder chiede prima di automatizzare WhatsApp
            </h2>
            <p className="mt-3 text-lg text-slate-600">
              Risposte rapide e senza giri di parole. Sono le domande che riceviamo ogni giorno da ecommerce,
              marketplace e aziende di servizi.
            </p>

            <div className="mt-10 space-y-4">
              {faqs.map(({ icon: Icon, accent, question, answer }) => (
                <div
                  key={question}
                  className="group rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-[0_25px_45px_-40px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-emerald-200"
                >
                  <div className="flex gap-4">
                    <div
                      className={`mt-1 h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center text-emerald-700`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{question}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[40px] bg-gradient-to-br from-slate-900 via-emerald-900 to-emerald-600 p-10 text-white shadow-2xl">
              <p className="text-sm uppercase tracking-[0.4em] text-emerald-200">Hand-off perfetto</p>
              <h3 className="mt-4 text-3xl font-semibold leading-snug">
                Quando il bot passa la chat,
                <br />
                l’operatore trova già tutto pronto.
              </h3>
              <ul className="mt-6 space-y-3 text-sm text-emerald-50">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/30 text-xs font-semibold">
                    1
                  </span>
                  Carrello e offerte in corso.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/30 text-xs font-semibold">
                    2
                  </span>
                  Sentiment e lingua del cliente.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/30 text-xs font-semibold">
                    3
                  </span>
                  Ultime azioni effettuate dal bot.
                </li>
              </ul>
              <button className="mt-8 inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur hover:bg-white/20">
                Contatta un esperto
              </button>
            </div>

            <div className="rounded-[36px] border-2 border-dashed border-slate-200 bg-white/80 p-8 text-center shadow-inner">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.3em]">Area visual</p>
              <p className="mt-2 text-base text-slate-600">
                Qui inseriremo un illustrazione del flusso chat → ordine. Manteniamo lo spazio pronto per quando
                avrai gli asset definitivi.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
