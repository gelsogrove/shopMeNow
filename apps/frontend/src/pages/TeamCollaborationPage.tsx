import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { LandingHero } from "@/components/landing/LandingHero"
import { MetricsSection } from "@/components/landing/MetricsSection"
import { SectionHeader } from "@/components/landing/SectionHeader"
import { FeatureChecklist } from "@/components/landing/FeatureChecklist"
import { CtaSection } from "@/components/landing/CtaSection"

type Language = "it" | "en" | "es" | "de"

const T = {
  it: {
    seoTitle: "Team Collaboration - Gestione Multi-Agente per il Customer Service",
    ctaTitle: "Pronto a potenziare il tuo team?",
    ctaSub: "Nessun impegno, ti rispondiamo a breve.",
    seoDesc: "Coordina il tuo team di assistenza con eChatbot. Assegnazione conversazioni, ruoli e permessi, dashboard analytics, escalation ai supervisor, notifiche in tempo reale.",
    seoKeys: "team collaboration chatbot, multi agente whatsapp, gestione team customer service, assegnazione conversazioni, dashboard customer service",
    breadcrumb: "Team Collaboration",
    badge: "Team",
    heroTitle: "Un team coordinato\nper ogni cliente",
    heroSub: "Con eChatbot puoi gestire un team completo di operatori su WhatsApp. L'AI gestisce le richieste semplici, e assegna automaticamente le conversazioni complesse all'operatore giusto, con il contesto già pronto.",
    cta: "Contattaci",
    rolesTitle: "Ruoli e permessi granulari",
    rolesSub: "Ogni membro del team ha accesso esattamente a ciò di cui ha bisogno",
    roles: [
      { name: "Admin", icon: "👑", color: "purple", perms: ["Configura workspace e canali", "Gestisce utenti e ruoli", "Accede a tutti gli analytics", "Configura regole AI", "Gestisce abbonamento e fatturazione"] },
      { name: "Manager", icon: "🎯", color: "blue", perms: ["Monitora tutte le conversazioni", "Assegna e riassegna chat", "Accede agli analytics di team", "Gestisce escalation", "Supervisiona qualità"] },
      { name: "Operator", icon: "💬", color: "green", perms: ["Gestisce le conversazioni assegnate", "Risponde ai clienti", "Crea ordini e preventivi", "Aggiorna dati cliente", "Chiede escalation"] },
    ],
    flowTitle: "Come funziona l'assegnazione",
    flowSteps: [
      { num: "01", title: "Cliente scrive su WhatsApp", desc: "Il messaggio arriva al workspace eChatbot. L'AI analizza il contenuto e la priorità." },
      { num: "02", title: "AI gestisce o assegna", desc: "Se la richiesta è semplice, l'AI risponde autonomamente. Altrimenti valuta disponibilità e competenze degli operatori." },
      { num: "03", title: "Notifica all'operatore", desc: "L'operatore riceve notifica su browser con il pieno contesto: storia cliente, richiesta attuale, priorità." },
      { num: "04", title: "Handoff con contesto", desc: "L'operatore vede tutta la conversazione precedente. Il cliente non deve ripetere nulla." },
    ],
    dashTitle: "Dashboard Manager in tempo reale",
    dashDesc: "Il Manager o il Supervisor vede in un'unica schermata: conversazioni attive, operatori disponibili, clienti in coda e notifiche urgenti.",
    dashFeatures: ["Coda clienti in attesa con riassunti AI", "Assegnazione cliente a operatore con un click", "Storico completo di ogni conversazione", "Contesto cliente pronto per l'operatore", "Notifiche browser per nuove richieste", "Escalation AI → operatore senza interruzioni"],
    metricsTitle: "Risultati misurabili",
    metrics: [
      { value: "45%", label: "riduzione tempo first response" },
      { value: "3×", label: "più conversazioni gestite per operatore" },
      { value: "92%", label: "soddisfazione clienti media" },
      { value: "0", label: "conversazioni perse per overflow" },
    ],
  },
  en: {
    seoTitle: "Team Collaboration - Multi-Agent Management for Customer Service",
    ctaTitle: "Ready to empower your team?",
    ctaSub: "No commitment — we will get back to you shortly.",
    seoDesc: "Coordinate your customer support team with eChatbot. Conversation assignment, roles and permissions, analytics dashboard, escalation to supervisors, real-time notifications.",
    seoKeys: "team collaboration chatbot, multi agent whatsapp, customer service team management, conversation assignment, customer service dashboard",
    breadcrumb: "Team Collaboration",
    badge: "Team",
    heroTitle: "A coordinated team\nfor every customer",
    heroSub: "With eChatbot you can manage a full team of operators on WhatsApp. AI handles simple requests and automatically assigns complex conversations to the right operator, with context already prepared.",
    cta: "Contact Us",
    rolesTitle: "Granular roles and permissions",
    rolesSub: "Each team member gets access to exactly what they need",
    roles: [
      { name: "Admin", icon: "👑", color: "purple", perms: ["Configure workspace and channels", "Manage users and roles", "Access all analytics", "Configure AI rules", "Manage subscription and billing"] },
      { name: "Manager", icon: "🎯", color: "blue", perms: ["Monitor all conversations", "Assign and reassign chats", "Access team analytics", "Manage escalations", "Supervise quality"] },
      { name: "Operator", icon: "💬", color: "green", perms: ["Manage assigned conversations", "Reply to customers", "Create orders and quotes", "Update customer data", "Request escalation"] },
    ],
    flowTitle: "How assignment works",
    flowSteps: [
      { num: "01", title: "Customer writes on WhatsApp", desc: "The message arrives at the eChatbot workspace. AI analyzes content and priority." },
      { num: "02", title: "AI handles or assigns", desc: "If the request is simple, AI responds autonomously. Otherwise it evaluates operators' availability and skills." },
      { num: "03", title: "Operator notification", desc: "The operator receives a browser notification with full context: customer history, current request, priority." },
      { num: "04", title: "Handoff with context", desc: "The operator sees the entire previous conversation. The customer doesn't have to repeat anything." },
    ],
    dashTitle: "Real-time Manager Dashboard",
    dashDesc: "The Manager or Supervisor sees in a single screen: active conversations, available operators, waiting queue and urgent notifications.",
    dashFeatures: ["Customer waiting queue with AI summaries", "Assign customer to operator with one click", "Complete history of every conversation", "Customer context ready for the operator", "Browser notifications for new requests", "AI → operator escalation without interruption"],
    metricsTitle: "Measurable results",
    metrics: [
      { value: "45%", label: "reduction in first response time" },
      { value: "3×", label: "more conversations handled per operator" },
      { value: "92%", label: "average customer satisfaction" },
      { value: "0", label: "conversations lost to overflow" },
    ],
  },
  es: {
    seoTitle: "Team Collaboration - Gestión Multi-Agente para Atención al Cliente",
    ctaTitle: "¿Listo para potenciar tu equipo?",
    ctaSub: "Sin compromiso, te respondemos pronto.",
    seoDesc: "Coordina tu equipo de soporte con eChatbot. Asignación de conversaciones, roles y permisos, panel analytics, escalación a supervisores, notificaciones en tiempo real.",
    seoKeys: "colaboración equipo chatbot, multi agente whatsapp, gestión equipo atención cliente, asignación conversaciones, panel customer service",
    breadcrumb: "Team Collaboration",
    badge: "Equipo",
    heroTitle: "Un equipo coordinado\npara cada cliente",
    heroSub: "Con eChatbot puedes gestionar un equipo completo de operadores en WhatsApp. La IA gestiona las solicitudes simples y asigna automáticamente las conversaciones complejas al operador adecuado, con el contexto ya listo.",
    cta: "Contáctanos",
    rolesTitle: "Roles y permisos granulares",
    rolesSub: "Cada miembro del equipo tiene acceso exactamente a lo que necesita",
    roles: [
      { name: "Admin", icon: "👑", color: "purple", perms: ["Configura workspace y canales", "Gestiona usuarios y roles", "Accede a todos los analytics", "Configura reglas de IA", "Gestiona suscripción y facturación"] },
      { name: "Manager", icon: "🎯", color: "blue", perms: ["Monitorea todas las conversaciones", "Asigna y reasigna chats", "Accede a analytics de equipo", "Gestiona escalaciones", "Supervisa calidad"] },
      { name: "Operator", icon: "💬", color: "green", perms: ["Gestiona conversaciones asignadas", "Responde a clientes", "Crea pedidos y presupuestos", "Actualiza datos del cliente", "Solicita escalación"] },
    ],
    flowTitle: "Cómo funciona la asignación",
    flowSteps: [
      { num: "01", title: "Cliente escribe en WhatsApp", desc: "El mensaje llega al workspace de eChatbot. La IA analiza el contenido y la prioridad." },
      { num: "02", title: "IA gestiona o asigna", desc: "Si la solicitud es simple, la IA responde de forma autónoma. De lo contrario, evalúa disponibilidad y habilidades de los operadores." },
      { num: "03", title: "Notificación al operador", desc: "El operador recibe notificación en el navegador con el contexto completo: historial del cliente, solicitud actual, prioridad." },
      { num: "04", title: "Handoff con contexto", desc: "El operador ve toda la conversación anterior. El cliente no tiene que repetir nada." },
    ],
    dashTitle: "Panel Manager en tiempo real",
    dashDesc: "El Manager o Supervisor ve en una única pantalla: conversaciones activas, operadores disponibles, cola de espera y notificaciones urgentes.",
    dashFeatures: ["Cola de clientes en espera con resúmenes de IA", "Asignación de cliente a operador con un clic", "Historial completo de cada conversación", "Contexto del cliente listo para el operador", "Notificaciones del navegador para nuevas solicitudes", "Escalación IA → operador sin interrupciones"],
    metricsTitle: "Resultados medibles",
    metrics: [
      { value: "45%", label: "reducción en el tiempo de primera respuesta" },
      { value: "3×", label: "más conversaciones gestionadas por operador" },
      { value: "92%", label: "satisfacción media del cliente" },
      { value: "0", label: "conversaciones perdidas por overflow" },
    ],
  },
  de: {
    seoTitle: "Team Collaboration - Multi-Agenten-Verwaltung für den Customer Service",
    ctaTitle: "Bereit, dein Team zu stärken?",
    ctaSub: "Unverbindlich, wir antworten dir in Kürze.",
    seoDesc: "Koordiniere dein Support-Team mit eChatbot. Zuweisung von Konversationen, Rollen und Berechtigungen, Analytics-Dashboard, Eskalation an Supervisoren, Benachrichtigungen in Echtzeit.",
    seoKeys: "team-zusammenarbeit chatbot, multi agent whatsapp, customer service team verwaltung, zuweisung konversationen, customer service dashboard",
    breadcrumb: "Team Collaboration",
    badge: "Team",
    heroTitle: "Ein koordiniertes Team\nfür jeden Kunden",
    heroSub: "Mit eChatbot kannst du ein komplettes Team von Operatoren auf WhatsApp verwalten. Die KI bearbeitet einfache Anfragen und weist komplexe Konversationen automatisch dem richtigen Operator zu, mit bereits vorbereitetem Kontext.",
    cta: "Kontaktiere uns",
    rolesTitle: "Granulare Rollen und Berechtigungen",
    rolesSub: "Jedes Teammitglied erhält genau den Zugriff, den es braucht",
    roles: [
      { name: "Admin", icon: "👑", color: "purple", perms: ["Workspace und Kanäle konfigurieren", "Benutzer und Rollen verwalten", "Auf alle Analytics zugreifen", "KI-Regeln konfigurieren", "Abonnement und Abrechnung verwalten"] },
      { name: "Manager", icon: "🎯", color: "blue", perms: ["Alle Konversationen überwachen", "Chats zuweisen und neu zuweisen", "Auf Team-Analytics zugreifen", "Eskalationen verwalten", "Qualität überwachen"] },
      { name: "Operator", icon: "💬", color: "green", perms: ["Zugewiesene Konversationen verwalten", "Kunden antworten", "Bestellungen und Angebote erstellen", "Kundendaten aktualisieren", "Eskalation anfordern"] },
    ],
    flowTitle: "So funktioniert die Zuweisung",
    flowSteps: [
      { num: "01", title: "Kunde schreibt auf WhatsApp", desc: "Die Nachricht erreicht den eChatbot-Workspace. Die KI analysiert Inhalt und Priorität." },
      { num: "02", title: "KI bearbeitet oder weist zu", desc: "Ist die Anfrage einfach, antwortet die KI eigenständig. Andernfalls prüft sie Verfügbarkeit und Fähigkeiten der Operatoren." },
      { num: "03", title: "Benachrichtigung an den Operator", desc: "Der Operator erhält eine Browser-Benachrichtigung mit vollständigem Kontext: Kundenhistorie, aktuelle Anfrage, Priorität." },
      { num: "04", title: "Handoff mit Kontext", desc: "Der Operator sieht die gesamte vorherige Konversation. Der Kunde muss nichts wiederholen." },
    ],
    dashTitle: "Manager-Dashboard in Echtzeit",
    dashDesc: "Der Manager oder Supervisor sieht auf einem einzigen Bildschirm: aktive Konversationen, verfügbare Operatoren, Warteschlange und dringende Benachrichtigungen.",
    dashFeatures: ["Warteschlange wartender Kunden mit KI-Zusammenfassungen", "Kunde mit einem Klick einem Operator zuweisen", "Vollständige Historie jeder Konversation", "Kundenkontext bereit für den Operator", "Browser-Benachrichtigungen für neue Anfragen", "Eskalation KI → Operator ohne Unterbrechung"],
    metricsTitle: "Messbare Ergebnisse",
    metrics: [
      { value: "45%", label: "weniger Zeit bis zur ersten Antwort" },
      { value: "3×", label: "mehr Konversationen pro Operator bearbeitet" },
      { value: "92%", label: "durchschnittliche Kundenzufriedenheit" },
      { value: "0", label: "durch Überlastung verlorene Konversationen" },
    ],
  },
}

const roleColors: Record<string, string> = {
  purple: "from-green-500/20 to-emerald-500/10 border-white/10",
  blue: "from-green-500/20 to-emerald-500/10 border-white/10",
  green: "from-green-500/20 to-emerald-500/10 border-white/10",
}

export function TeamCollaborationPage() {
  const { language } = useLanguage()
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-200">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/team-collaboration" lang={language} serviceType="Team Collaboration" />
      <SiteHeader />

      <main>
        <LandingHero
          title={t.heroTitle}
          subtitle={t.heroSub}
          ctaLabel={t.cta}
          image={{ src: "/team.png", alt: "Team collaboration illustration" }}
          imageSide="right"
          glow="tilt"
          buttonClassName="bg-[#25D366] hover:bg-[#1fb855]"
        />

        <MetricsSection title={t.metricsTitle} metrics={t.metrics} variant="compact" />

        {/* Roles */}
        <section className="py-20 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <SectionHeader title={t.rolesTitle} subtitle={t.rolesSub} className="mb-14" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {t.roles.map((role, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className={`bg-gradient-to-br ${roleColors[role.color]} rounded-2xl p-8 border hover:shadow-lg transition-all`}
                >
                  <div className="text-4xl mb-3">{role.icon}</div>
                  <h3 className="text-2xl font-bold text-white mb-5">{role.name}</h3>
                  <FeatureChecklist items={role.perms} iconClassName="h-4 w-4 text-[#25D366]" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Flow */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-white text-center mb-14">{t.flowTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {t.flowSteps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative p-8 bg-slate-900/50 backdrop-blur rounded-2xl shadow-2xl border border-white/10 hover:shadow-xl hover:-translate-y-1 transition-all"
                >
                  <div className="text-5xl font-extrabold text-[#25D366]/20 absolute top-4 right-6">{step.num}</div>
                  <h3 className="text-xl font-bold text-white mb-3 pr-12">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Section */}
        <section className="py-20 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">{t.dashTitle}</h2>
                <p className="text-lg text-slate-400 mb-6 leading-relaxed">{t.dashDesc}</p>
                <FeatureChecklist items={t.dashFeatures} />
              </div>
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl rotate-1 scale-105 opacity-60" />
                <img
                  src="/panelcontro.png"
                  alt="Manager dashboard real-time view"
                  className="relative w-full h-auto rounded-2xl shadow-2xl border border-white/10 object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        <CtaSection title={t.ctaTitle} subtitle={t.ctaSub} ctaLabel={t.cta} />
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
