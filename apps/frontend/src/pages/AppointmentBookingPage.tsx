import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap, CheckCircle } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Prenotazione Appuntamenti AI - Prenota via WhatsApp con Promemoria Automatici",
    seoDesc: "eChatbot permette ai tuoi clienti di prenotare appuntamenti direttamente su WhatsApp. Gestione automatica della disponibilità, conferme istantanee e promemoria via WhatsApp. Integrazione Google Calendar.",
    seoKeys: "prenotazione appuntamenti whatsapp, booking chatbot, prenotazione ai, promemoria appuntamento whatsapp, google calendar chatbot, prenotazione automatica",
    breadcrumb: "Prenotazione Appuntamenti",
    badge: "Appointment Booking",
    heroTitle: "Prenota appuntamenti.\nDirettamente su WhatsApp.",
    heroSub: "I tuoi clienti prenotano, modificano e cancellano appuntamenti in modo naturale via chat. L'AI gestisce disponibilità, conferme e promemoria automatici. Tu ricevi tutto sincronizzato su Google Calendar.",
    cta: "Contattaci",
    ctaSub: "Nessun impegno, ti rispondiamo a breve",
    ctaTitle: "Pronto ad automatizzare le prenotazioni?",
    howTitle: "Come funziona",
    howSub: "Dalla richiesta del cliente alla conferma, tutto automatico.",
    steps: [
      { icon: "💬", title: "Il cliente scrive su WhatsApp", desc: "\"Vorrei prenotare un appuntamento per martedì\". L'AI capisce l'intenzione e mostra le fasce orarie disponibili." },
      { icon: "📅", title: "Scelta data e ora", desc: "Il cliente seleziona giorno e orario tra quelli disponibili. L'AI verifica in tempo reale che lo slot sia libero e conferma immediatamente." },
      { icon: "🔔", title: "Promemoria automatico", desc: "24 ore prima (o quando preferisci), il cliente riceve un promemoria su WhatsApp. Può confermare, riprogrammare o cancellare con un messaggio." },
      { icon: "✅", title: "Sincronizzazione Calendar", desc: "Ogni appuntamento appare automaticamente su Google Calendar con tutti i dettagli. Modifiche e cancellazioni sincronizzate in tempo reale." },
    ],
    featuresTitle: "Dashboard Appuntamenti",
    featuresDesc: "Gestisci tutti gli appuntamenti dal pannello di controllo. Visualizza prenotazioni, modifica la disponibilità, configura i promemoria e monitora le statistiche. Tutto in un unico posto.",
    features: [
      "Calendario visuale con tutti gli appuntamenti",
      "Configurazione orari di apertura personalizzati",
      "Promemoria WhatsApp configurabili (1h, 2h, 24h)",
      "Gestione cancellazioni e riprogrammazioni",
      "Protezione anti-spam per abusi",
      "Statistiche prenotazioni e no-show",
    ],
    metricsTitle: "Risultati concreti",
    metrics: [
      { value: "-70%", label: "No-show", sub: "grazie ai promemoria automatici" },
      { value: "24/7", label: "Disponibilità", sub: "prenotazioni anche fuori orario" },
      { value: "< 30s", label: "Tempo prenotazione", sub: "dal primo messaggio alla conferma" },
      { value: "+40%", label: "Appuntamenti", sub: "aumento medio delle prenotazioni" },
    ],
    useCasesTitle: "Per chi è perfetto",
    useCases: [
      { icon: "💇", title: "Parrucchieri e saloni", desc: "I clienti prenotano tagli, colori e trattamenti direttamente su WhatsApp. Niente più telefonate per fissare un appuntamento." },
      { icon: "🏥", title: "Studi medici e professionisti", desc: "Gestisci visite, consulenze e follow-up. Il paziente riceve promemoria automatici e può riprogrammare facilmente." },
      { icon: "🏋️", title: "Personal trainer e fitness", desc: "Sessioni di allenamento, classi di gruppo e consulenze nutrizionali. I clienti prenotano quando vogliono." },
      { icon: "🔧", title: "Servizi e consulenze", desc: "Idraulici, elettricisti, consulenti: gestisci appuntamenti e sopralluoghi senza perdere tempo al telefono." },
    ],
  },
  en: {
    seoTitle: "AI Appointment Booking - Book via WhatsApp with Automatic Reminders",
    seoDesc: "eChatbot lets your customers book appointments directly on WhatsApp. Automatic availability management, instant confirmations, and WhatsApp reminders. Google Calendar integration.",
    seoKeys: "whatsapp appointment booking, booking chatbot, ai booking, appointment reminder whatsapp, google calendar chatbot, automatic booking",
    breadcrumb: "Appointment Booking",
    badge: "Appointment Booking",
    heroTitle: "Book appointments.\nDirectly on WhatsApp.",
    heroSub: "Your customers book, modify, and cancel appointments naturally via chat. AI manages availability, confirmations, and automatic reminders. You get everything synced to Google Calendar.",
    cta: "Contact Us",
    ctaSub: "No commitment — we will get back to you shortly",
    ctaTitle: "Ready to automate your bookings?",
    howTitle: "How it works",
    howSub: "From customer request to confirmation, fully automatic.",
    steps: [
      { icon: "💬", title: "Customer writes on WhatsApp", desc: "\"I'd like to book an appointment for Tuesday\". The AI understands the intent and shows available time slots." },
      { icon: "📅", title: "Choose date and time", desc: "The customer selects day and time from available slots. AI verifies in real time that the slot is free and confirms immediately." },
      { icon: "🔔", title: "Automatic reminder", desc: "24 hours before (or whenever you prefer), the customer receives a WhatsApp reminder. They can confirm, reschedule, or cancel with a message." },
      { icon: "✅", title: "Calendar sync", desc: "Every appointment automatically appears on Google Calendar with all details. Changes and cancellations are synced in real time." },
    ],
    featuresTitle: "Appointments Dashboard",
    featuresDesc: "Manage all your appointments from the control panel. View bookings, adjust availability, configure reminders, and monitor statistics. All in one place.",
    features: [
      "Visual calendar with all appointments",
      "Custom opening hours configuration",
      "Configurable WhatsApp reminders (1h, 2h, 24h)",
      "Cancellation and rescheduling management",
      "Anti-spam protection against abuse",
      "Booking and no-show statistics",
    ],
    metricsTitle: "Real results",
    metrics: [
      { value: "-70%", label: "No-shows", sub: "thanks to automatic reminders" },
      { value: "24/7", label: "Availability", sub: "bookings even outside hours" },
      { value: "< 30s", label: "Booking time", sub: "from first message to confirmation" },
      { value: "+40%", label: "Appointments", sub: "average increase in bookings" },
    ],
    useCasesTitle: "Perfect for",
    useCases: [
      { icon: "💇", title: "Hair salons & spas", desc: "Customers book cuts, colors, and treatments directly on WhatsApp. No more phone calls to schedule an appointment." },
      { icon: "🏥", title: "Medical offices & professionals", desc: "Manage visits, consultations, and follow-ups. Patients receive automatic reminders and can easily reschedule." },
      { icon: "🏋️", title: "Personal trainers & fitness", desc: "Training sessions, group classes, and nutrition consultations. Clients book whenever they want." },
      { icon: "🔧", title: "Services & consulting", desc: "Plumbers, electricians, consultants: manage appointments and site visits without wasting time on the phone." },
    ],
  },
  es: {
    seoTitle: "Reserva de Citas con IA - Reserva por WhatsApp con Recordatorios Automáticos",
    seoDesc: "eChatbot permite a tus clientes reservar citas directamente en WhatsApp. Gestión automática de disponibilidad, confirmaciones instantáneas y recordatorios por WhatsApp. Integración con Google Calendar.",
    seoKeys: "reserva citas whatsapp, booking chatbot, reserva ia, recordatorio citas whatsapp, google calendar chatbot, reserva automática",
    breadcrumb: "Reserva de Citas",
    badge: "Reserva de Citas",
    heroTitle: "Reserva citas.\nDirectamente en WhatsApp.",
    heroSub: "Tus clientes reservan, modifican y cancelan citas de forma natural por chat. La IA gestiona disponibilidad, confirmaciones y recordatorios automáticos. Tú recibes todo sincronizado en Google Calendar.",
    cta: "Contáctanos",
    ctaSub: "Sin compromiso, te respondemos pronto",
    ctaTitle: "¿Listo para automatizar tus reservas?",
    howTitle: "Cómo funciona",
    howSub: "Desde la solicitud del cliente hasta la confirmación, todo automático.",
    steps: [
      { icon: "💬", title: "El cliente escribe en WhatsApp", desc: "\"Me gustaría reservar una cita para el martes\". La IA entiende la intención y muestra los horarios disponibles." },
      { icon: "📅", title: "Elige fecha y hora", desc: "El cliente selecciona día y hora entre los disponibles. La IA verifica en tiempo real que el slot esté libre y confirma inmediatamente." },
      { icon: "🔔", title: "Recordatorio automático", desc: "24 horas antes (o cuando prefieras), el cliente recibe un recordatorio por WhatsApp. Puede confirmar, reprogramar o cancelar con un mensaje." },
      { icon: "✅", title: "Sincronización Calendar", desc: "Cada cita aparece automáticamente en Google Calendar con todos los detalles. Cambios y cancelaciones sincronizados en tiempo real." },
    ],
    featuresTitle: "Panel de Citas",
    featuresDesc: "Gestiona todas las citas desde el panel de control. Visualiza reservas, ajusta disponibilidad, configura recordatorios y monitorea estadísticas. Todo en un solo lugar.",
    features: [
      "Calendario visual con todas las citas",
      "Configuración de horarios de apertura personalizados",
      "Recordatorios WhatsApp configurables (1h, 2h, 24h)",
      "Gestión de cancelaciones y reprogramaciones",
      "Protección anti-spam contra abusos",
      "Estadísticas de reservas y no-show",
    ],
    metricsTitle: "Resultados concretos",
    metrics: [
      { value: "-70%", label: "No-shows", sub: "gracias a los recordatorios automáticos" },
      { value: "24/7", label: "Disponibilidad", sub: "reservas incluso fuera de horario" },
      { value: "< 30s", label: "Tiempo de reserva", sub: "del primer mensaje a la confirmación" },
      { value: "+40%", label: "Citas", sub: "aumento promedio de reservas" },
    ],
    useCasesTitle: "Perfecto para",
    useCases: [
      { icon: "💇", title: "Peluquerías y salones", desc: "Los clientes reservan cortes, colores y tratamientos directamente en WhatsApp. No más llamadas para fijar una cita." },
      { icon: "🏥", title: "Consultorios y profesionales", desc: "Gestiona visitas, consultas y seguimientos. El paciente recibe recordatorios automáticos y puede reprogramar fácilmente." },
      { icon: "🏋️", title: "Entrenadores y fitness", desc: "Sesiones de entrenamiento, clases grupales y consultas nutricionales. Los clientes reservan cuando quieran." },
      { icon: "🔧", title: "Servicios y consultoría", desc: "Fontaneros, electricistas, consultores: gestiona citas y visitas sin perder tiempo al teléfono." },
    ],
  },
  pt: {
    seoTitle: "Agendamento de Consultas com IA - Agende pelo WhatsApp com Lembretes Automáticos",
    seoDesc: "O eChatbot permite que seus clientes agendem consultas diretamente no WhatsApp. Gestão automática de disponibilidade, confirmações instantâneas e lembretes pelo WhatsApp. Integração com Google Calendar.",
    seoKeys: "agendamento consultas whatsapp, booking chatbot, agendamento ia, lembrete consulta whatsapp, google calendar chatbot, agendamento automático",
    breadcrumb: "Agendamento de Consultas",
    badge: "Agendamento",
    heroTitle: "Agende consultas.\nDiretamente no WhatsApp.",
    heroSub: "Seus clientes agendam, modificam e cancelam consultas de forma natural pelo chat. A IA gerencia disponibilidade, confirmações e lembretes automáticos. Você recebe tudo sincronizado no Google Calendar.",
    cta: "Fale Connosco",
    ctaSub: "Sem compromisso, respondemos em breve",
    ctaTitle: "Pronto para automatizar seus agendamentos?",
    howTitle: "Como funciona",
    howSub: "Da solicitação do cliente à confirmação, tudo automático.",
    steps: [
      { icon: "💬", title: "O cliente escreve no WhatsApp", desc: "\"Gostaria de agendar uma consulta para terça-feira\". A IA entende a intenção e mostra os horários disponíveis." },
      { icon: "📅", title: "Escolha data e hora", desc: "O cliente seleciona dia e hora entre os disponíveis. A IA verifica em tempo real que o slot esteja livre e confirma imediatamente." },
      { icon: "🔔", title: "Lembrete automático", desc: "24 horas antes (ou quando preferir), o cliente recebe um lembrete pelo WhatsApp. Pode confirmar, reagendar ou cancelar com uma mensagem." },
      { icon: "✅", title: "Sincronização Calendar", desc: "Cada consulta aparece automaticamente no Google Calendar com todos os detalhes. Alterações e cancelamentos sincronizados em tempo real." },
    ],
    featuresTitle: "Dashboard de Consultas",
    featuresDesc: "Gerencie todas as consultas pelo painel de controle. Visualize agendamentos, ajuste disponibilidade, configure lembretes e monitore estatísticas. Tudo em um só lugar.",
    features: [
      "Calendário visual com todas as consultas",
      "Configuração de horários de atendimento personalizados",
      "Lembretes WhatsApp configuráveis (1h, 2h, 24h)",
      "Gestão de cancelamentos e reagendamentos",
      "Proteção anti-spam contra abusos",
      "Estatísticas de agendamentos e no-show",
    ],
    metricsTitle: "Resultados concretos",
    metrics: [
      { value: "-70%", label: "No-shows", sub: "graças aos lembretes automáticos" },
      { value: "24/7", label: "Disponibilidade", sub: "agendamentos mesmo fora do horário" },
      { value: "< 30s", label: "Tempo de agendamento", sub: "da primeira mensagem à confirmação" },
      { value: "+40%", label: "Consultas", sub: "aumento médio de agendamentos" },
    ],
    useCasesTitle: "Perfeito para",
    useCases: [
      { icon: "💇", title: "Cabeleireiros e salões", desc: "Os clientes agendam cortes, colorações e tratamentos diretamente no WhatsApp. Sem mais ligações para marcar um horário." },
      { icon: "🏥", title: "Consultórios e profissionais", desc: "Gerencie consultas, atendimentos e retornos. O paciente recebe lembretes automáticos e pode reagendar facilmente." },
      { icon: "🏋️", title: "Personal trainers e fitness", desc: "Sessões de treino, aulas em grupo e consultas nutricionais. Os clientes agendam quando quiserem." },
      { icon: "🔧", title: "Serviços e consultoria", desc: "Encanadores, eletricistas, consultores: gerencie consultas e visitas sem perder tempo ao telefone." },
    ],
  },
}

export function AppointmentBookingPage() {
  const { language } = useLanguage()
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-200">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/appointment-booking" lang={language} serviceType="WhatsApp Appointment Booking" />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="pt-24 pb-16 lg:pt-32 lg:pb-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} hideVisual />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              {/* Hero image */}
              <div className="relative order-2 lg:order-1">
                <div className="absolute -inset-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl blur-xl opacity-40" />
                <img
                  src="/booking.png"
                  alt="AI appointment booking on WhatsApp"
                  className="relative w-full max-h-[320px] rounded-3xl shadow-2xl border border-white/10 object-cover"
                />
              </div>
              <div className="order-1 lg:order-2">
                <span className="inline-block bg-green-400/10 text-green-300 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                  {t.badge}
                </span>
                <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight whitespace-pre-line">
                  {t.heroTitle}
                </h1>
                <p className="text-xl text-slate-400 mb-10 leading-relaxed">{t.heroSub}</p>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-3 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
                  style={{ background: '#25D366' }}
                >
                  <Zap className="h-5 w-5" />
                  {t.cta}
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Metrics */}
        <section className="py-16 border-y border-white/10">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white text-center mb-12">{t.metricsTitle}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {t.metrics.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center p-6 bg-slate-900/50 backdrop-blur rounded-2xl border border-white/10"
                >
                  <div className="text-4xl font-bold mb-2" style={{ color: '#25D366' }}>{m.value}</div>
                  <div className="font-semibold text-white mb-1">{m.label}</div>
                  <div className="text-sm text-slate-400">{m.sub}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-20 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">{t.howTitle}</h2>
              <p className="text-xl text-slate-400 max-w-3xl mx-auto">{t.howSub}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {t.steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-slate-900/50 backdrop-blur rounded-2xl p-6 shadow-2xl border border-white/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="text-4xl mb-4">{step.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Dashboard Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              className="group relative"
              initial={{ opacity: 0, x: -80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.65 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl sm:rotate-1 scale-[1.01] group-hover:rotate-2 transition-transform duration-500" />
              <div className="relative bg-slate-900/50 backdrop-blur rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl border border-white/10 hover:-translate-y-1 transition-all duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  {/* Dashboard image */}
                  <div className="relative order-2 lg:order-1">
                    <div className="absolute -inset-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl blur-xl opacity-40" />
                    <img src="/booking.png" alt="Appointments dashboard" className="relative w-full h-auto rounded-2xl shadow-xl border border-white/10 object-contain" />
                  </div>
                  <div className="space-y-6 order-1 lg:order-2">
                    <h2 className="text-3xl lg:text-4xl font-bold text-white">{t.featuresTitle}</h2>
                    <p className="text-lg text-slate-400 leading-relaxed">{t.featuresDesc}</p>
                    <ul className="space-y-3">
                      {t.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-3 text-slate-300">
                          <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#25D366' }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-20 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-white text-center mb-12">{t.useCasesTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {t.useCases.map((uc, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex gap-6 p-6 bg-slate-900/50 backdrop-blur rounded-2xl shadow-2xl border border-white/10 hover:shadow-lg transition-all"
                >
                  <div className="text-4xl flex-shrink-0">{uc.icon}</div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{uc.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{uc.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-green-500 to-emerald-600">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">{t.ctaTitle}</h2>
            <p className="text-xl text-green-100 mb-8">{t.ctaSub}</p>
            <Link to="/contact" className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 font-semibold px-10 py-5 rounded-2xl shadow-lg text-lg transition-all" style={{ color: '#25D366' }}>
              <Zap className="h-6 w-6" />
              {t.cta}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
