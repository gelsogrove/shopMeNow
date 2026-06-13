import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { LandingHero } from "@/components/landing/LandingHero"
import { MetricsSection } from "@/components/landing/MetricsSection"
import { SectionHeader } from "@/components/landing/SectionHeader"
import { StepCardGrid } from "@/components/landing/StepCardGrid"
import { UseCaseGrid } from "@/components/landing/UseCaseGrid"
import { FeatureChecklist } from "@/components/landing/FeatureChecklist"
import { CtaSection } from "@/components/landing/CtaSection"

type Language = "it" | "en" | "es" | "de"

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
  de: {
    seoTitle: "KI-Terminbuchung - Buche per WhatsApp mit automatischen Erinnerungen",
    seoDesc: "eChatbot ermöglicht es deinen Kunden, Termine direkt über WhatsApp zu buchen. Automatische Verwaltung der Verfügbarkeit, sofortige Bestätigungen und Erinnerungen per WhatsApp. Google Calendar Integration.",
    seoKeys: "whatsapp terminbuchung, booking chatbot, ki terminbuchung, terminerinnerung whatsapp, google calendar chatbot, automatische terminbuchung",
    breadcrumb: "Terminbuchung",
    badge: "Terminbuchung",
    heroTitle: "Buche Termine.\nDirekt über WhatsApp.",
    heroSub: "Deine Kunden buchen, ändern und stornieren Termine ganz natürlich per Chat. Die KI verwaltet Verfügbarkeit, Bestätigungen und automatische Erinnerungen. Du bekommst alles synchronisiert im Google Calendar.",
    cta: "Kontaktiere uns",
    ctaSub: "Unverbindlich, wir melden uns in Kürze bei dir",
    ctaTitle: "Bereit, deine Terminbuchungen zu automatisieren?",
    howTitle: "So funktioniert es",
    howSub: "Von der Kundenanfrage bis zur Bestätigung, alles automatisch.",
    steps: [
      { icon: "💬", title: "Der Kunde schreibt auf WhatsApp", desc: "\"Ich möchte einen Termin für Dienstag buchen\". Die KI versteht die Absicht und zeigt die verfügbaren Zeitfenster an." },
      { icon: "📅", title: "Datum und Uhrzeit wählen", desc: "Der Kunde wählt Tag und Uhrzeit aus den verfügbaren Slots. Die KI prüft in Echtzeit, ob der Slot frei ist, und bestätigt sofort." },
      { icon: "🔔", title: "Automatische Erinnerung", desc: "24 Stunden vorher (oder wann immer du möchtest) erhält der Kunde eine Erinnerung auf WhatsApp. Er kann mit einer Nachricht bestätigen, verschieben oder stornieren." },
      { icon: "✅", title: "Calendar-Synchronisierung", desc: "Jeder Termin erscheint automatisch im Google Calendar mit allen Details. Änderungen und Stornierungen werden in Echtzeit synchronisiert." },
    ],
    featuresTitle: "Termin-Dashboard",
    featuresDesc: "Verwalte alle Termine über das Kontrollpanel. Sieh dir Buchungen an, passe die Verfügbarkeit an, konfiguriere Erinnerungen und überwache Statistiken. Alles an einem Ort.",
    features: [
      "Visueller Kalender mit allen Terminen",
      "Konfiguration individueller Öffnungszeiten",
      "Konfigurierbare WhatsApp-Erinnerungen (1h, 2h, 24h)",
      "Verwaltung von Stornierungen und Verschiebungen",
      "Anti-Spam-Schutz gegen Missbrauch",
      "Statistiken zu Buchungen und No-Shows",
    ],
    metricsTitle: "Konkrete Ergebnisse",
    metrics: [
      { value: "-70%", label: "No-Shows", sub: "dank automatischer Erinnerungen" },
      { value: "24/7", label: "Verfügbarkeit", sub: "Buchungen auch außerhalb der Öffnungszeiten" },
      { value: "< 30s", label: "Buchungszeit", sub: "von der ersten Nachricht bis zur Bestätigung" },
      { value: "+40%", label: "Termine", sub: "durchschnittlicher Anstieg der Buchungen" },
    ],
    useCasesTitle: "Perfekt für",
    useCases: [
      { icon: "💇", title: "Friseure und Salons", desc: "Kunden buchen Schnitte, Färbungen und Behandlungen direkt über WhatsApp. Keine Anrufe mehr, um einen Termin zu vereinbaren." },
      { icon: "🏥", title: "Arztpraxen und Fachleute", desc: "Verwalte Besuche, Beratungen und Nachsorgen. Der Patient erhält automatische Erinnerungen und kann ganz einfach umbuchen." },
      { icon: "🏋️", title: "Personal Trainer und Fitness", desc: "Trainingseinheiten, Gruppenkurse und Ernährungsberatungen. Die Kunden buchen, wann immer sie wollen." },
      { icon: "🔧", title: "Dienstleistungen und Beratung", desc: "Klempner, Elektriker, Berater: Verwalte Termine und Vor-Ort-Besichtigungen, ohne Zeit am Telefon zu verlieren." },
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
        <LandingHero
          breadcrumb={t.breadcrumb}
          badge={t.badge}
          title={t.heroTitle}
          subtitle={t.heroSub}
          ctaLabel={t.cta}
          image={{ src: "/booking.png", alt: "AI appointment booking on WhatsApp" }}
          imageClassName="w-full max-h-[320px] rounded-3xl shadow-2xl border border-white/10 object-cover"
        />

        <MetricsSection title={t.metricsTitle} metrics={t.metrics} />

        {/* How it Works */}
        <section className="py-20 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <SectionHeader title={t.howTitle} subtitle={t.howSub} />
            <StepCardGrid steps={t.steps} />
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
                    <FeatureChecklist items={t.features} />
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
            <UseCaseGrid items={t.useCases} />
          </div>
        </section>

        <CtaSection
          title={t.ctaTitle}
          subtitle={t.ctaSub}
          ctaLabel={t.cta}
          gradientClassName="from-green-500 to-emerald-600"
          buttonClassName="text-[#25D366]"
        />
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
