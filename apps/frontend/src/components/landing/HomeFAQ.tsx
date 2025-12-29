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
      "Sì, pianifichi broadcast e follow-up automatici con regole su fuso orario, opt-in e prodotti disponibili. Il motore evita l'invio se l'utente sta già parlando con l'operatore.",
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
  return null
}
