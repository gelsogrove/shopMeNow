import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap, CheckCircle, UserCheck, MessageSquare } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Team Collaboration - Gestione Multi-Agente per il Customer Service",
    ctaTitle: "Pronto a potenziare il tuo team?",
    ctaSub: "Inizia gratis, senza carta di credito.",
    seoDesc: "Coordina il tuo team di assistenza con eChatbot. Assegnazione conversazioni, ruoli e permessi, dashboard analytics, escalation ai supervisor, notifiche in tempo reale.",
    seoKeys: "team collaboration chatbot, multi agente whatsapp, gestione team customer service, assegnazione conversazioni, dashboard customer service",
    breadcrumb: "Team Collaboration",
    badge: "Team",
    heroTitle: "Un team coordinato\nper ogni cliente",
    heroSub: "Con eChatbot puoi gestire un team completo di operatori su WhatsApp. L'AI gestisce le richieste semplici, e assegna automaticamente le conversazioni complesse all'operatore giusto, con il contesto già pronto.",
    cta: "Prova Gratis",
    rolesTitle: "Ruoli e permessi granulari",
    rolesSub: "Ogni membro del team ha accesso esattamente a ciò di cui ha bisogno",
    roles: [
      { name: "Admin", icon: "👑", color: "purple", perms: ["Configura workspace e canali", "Gestisce utenti e ruoli", "Accede a tutti gli analytics", "Configura regole AI", "Esporta dati e report"] },
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
    dashDesc: "Il Manager o il Supervisor vede in un'unica schermata: conversazioni attive, operatori disponibili, tempi di risposta, SLA e notifiche urgenti.",
    dashFeatures: ["Mappa in tempo reale di tutte le chat aperte", "Indicatori di carico per ogni operatore", "Alert automatici per SLA a rischio", "Storico completo delle conversazioni", "Metriche di soddisfazione per operatore", "Esportazione report CSV/PDF"],
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
    ctaSub: "Start free, no credit card required.",
    seoDesc: "Coordinate your customer support team with eChatbot. Conversation assignment, roles and permissions, analytics dashboard, escalation to supervisors, real-time notifications.",
    seoKeys: "team collaboration chatbot, multi agent whatsapp, customer service team management, conversation assignment, customer service dashboard",
    breadcrumb: "Team Collaboration",
    badge: "Team",
    heroTitle: "A coordinated team\nfor every customer",
    heroSub: "With eChatbot you can manage a full team of operators on WhatsApp. AI handles simple requests and automatically assigns complex conversations to the right operator, with context already prepared.",
    cta: "Try Free",
    rolesTitle: "Granular roles and permissions",
    rolesSub: "Each team member gets access to exactly what they need",
    roles: [
      { name: "Admin", icon: "👑", color: "purple", perms: ["Configure workspace and channels", "Manage users and roles", "Access all analytics", "Configure AI rules", "Export data and reports"] },
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
    dashDesc: "The Manager or Supervisor sees in a single screen: active conversations, available operators, response times, SLAs and urgent notifications.",
    dashFeatures: ["Real-time map of all open chats", "Load indicators per operator", "Automatic alerts for at-risk SLAs", "Complete conversation history", "Satisfaction metrics per operator", "CSV/PDF report export"],
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
    ctaSub: "Empieza gratis, sin tarjeta de crédito.",
    seoDesc: "Coordina tu equipo de soporte con eChatbot. Asignación de conversaciones, roles y permisos, panel analytics, escalación a supervisores, notificaciones en tiempo real.",
    seoKeys: "colaboración equipo chatbot, multi agente whatsapp, gestión equipo atención cliente, asignación conversaciones, panel customer service",
    breadcrumb: "Team Collaboration",
    badge: "Equipo",
    heroTitle: "Un equipo coordinado\npara cada cliente",
    heroSub: "Con eChatbot puedes gestionar un equipo completo de operadores en WhatsApp. La IA gestiona las solicitudes simples y asigna automáticamente las conversaciones complejas al operador adecuado, con el contexto ya listo.",
    cta: "Prueba Gratis",
    rolesTitle: "Roles y permisos granulares",
    rolesSub: "Cada miembro del equipo tiene acceso exactamente a lo que necesita",
    roles: [
      { name: "Admin", icon: "👑", color: "purple", perms: ["Configura workspace y canales", "Gestiona usuarios y roles", "Accede a todos los analytics", "Configura reglas de IA", "Exporta datos y reportes"] },
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
    dashDesc: "El Manager o Supervisor ve en una única pantalla: conversaciones activas, operadores disponibles, tiempos de respuesta, SLA y notificaciones urgentes.",
    dashFeatures: ["Mapa en tiempo real de todos los chats abiertos", "Indicadores de carga por operador", "Alertas automáticas para SLA en riesgo", "Historial completo de conversaciones", "Métricas de satisfacción por operador", "Exportación de reportes CSV/PDF"],
    metricsTitle: "Resultados medibles",
    metrics: [
      { value: "45%", label: "reducción en el tiempo de primera respuesta" },
      { value: "3×", label: "más conversaciones gestionadas por operador" },
      { value: "92%", label: "satisfacción media del cliente" },
      { value: "0", label: "conversaciones perdidas por overflow" },
    ],
  },
  pt: {
    seoTitle: "Team Collaboration - Gestão Multi-Agente para Atendimento ao Cliente",
    ctaTitle: "Pronto para potencializar sua equipe?",
    ctaSub: "Comece grátis, sem cartão de crédito.",
    seoDesc: "Coordene sua equipe de suporte com o eChatbot. Atribuição de conversas, funções e permissões, painel de analytics, escalação para supervisores, notificações em tempo real.",
    seoKeys: "colaboração equipe chatbot, multi agente whatsapp, gestão equipe atendimento cliente, atribuição conversas, painel customer service",
    breadcrumb: "Team Collaboration",
    badge: "Equipe",
    heroTitle: "Uma equipe coordenada\npara cada cliente",
    heroSub: "Com o eChatbot você pode gerenciar uma equipe completa de operadores no WhatsApp. A IA gerencia as solicitações simples e atribui automaticamente as conversas complexas ao operador certo, com o contexto já preparado.",
    cta: "Experimente Grátis",
    rolesTitle: "Funções e permissões granulares",
    rolesSub: "Cada membro da equipe tem acesso exatamente ao que precisa",
    roles: [
      { name: "Admin", icon: "👑", color: "purple", perms: ["Configura workspace e canais", "Gerencia usuários e funções", "Acessa todos os analytics", "Configura regras de IA", "Exporta dados e relatórios"] },
      { name: "Manager", icon: "🎯", color: "blue", perms: ["Monitora todas as conversas", "Atribui e reatribui chats", "Acessa analytics da equipe", "Gerencia escalações", "Supervisiona qualidade"] },
      { name: "Operator", icon: "💬", color: "green", perms: ["Gerencia conversas atribuídas", "Responde aos clientes", "Cria pedidos e orçamentos", "Atualiza dados do cliente", "Solicita escalação"] },
    ],
    flowTitle: "Como funciona a atribuição",
    flowSteps: [
      { num: "01", title: "Cliente escreve no WhatsApp", desc: "A mensagem chega ao workspace do eChatbot. A IA analisa o conteúdo e a prioridade." },
      { num: "02", title: "IA gerencia ou atribui", desc: "Se a solicitação é simples, a IA responde de forma autônoma. Caso contrário, avalia disponibilidade e habilidades dos operadores." },
      { num: "03", title: "Notificação ao operador", desc: "O operador recebe notificação no navegador com o contexto completo: histórico do cliente, solicitação atual, prioridade." },
      { num: "04", title: "Handoff com contexto", desc: "O operador vê toda a conversa anterior. O cliente não precisa repetir nada." },
    ],
    dashTitle: "Dashboard Manager em tempo real",
    dashDesc: "O Manager ou Supervisor vê em uma única tela: conversas ativas, operadores disponíveis, tempos de resposta, SLAs e notificações urgentes.",
    dashFeatures: ["Mapa em tempo real de todos os chats abertos", "Indicadores de carga por operador", "Alertas automáticos para SLAs em risco", "Histórico completo de conversas", "Métricas de satisfação por operador", "Exportação de relatórios CSV/PDF"],
    metricsTitle: "Resultados mensuráveis",
    metrics: [
      { value: "45%", label: "redução no tempo de primeira resposta" },
      { value: "3×", label: "mais conversas gerenciadas por operador" },
      { value: "92%", label: "satisfação média do cliente" },
      { value: "0", label: "conversas perdidas por overflow" },
    ],
  },
}

const roleColors: Record<string, string> = {
  purple: "from-purple-50 to-purple-100 border-purple-200",
  blue: "from-blue-50 to-blue-100 border-blue-200",
  green: "from-green-50 to-green-100 border-green-200",
}

export function TeamCollaborationPage() {
  const [language, setLanguage] = useState<Language>("it")
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
    const browserLang = navigator.language.slice(0, 2)
    if (["it", "en", "es", "pt"].includes(browserLang)) setLanguage(browserLang as Language)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/team-collaboration" lang={language} />
      <SiteHeader language={language} onLanguageChange={setLanguage} />

      <main>
        {/* Hero */}
        <section className="pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-purple-50 via-white to-violet-50">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} hideVisual />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              <div>
                <span className="inline-block bg-purple-100 text-purple-700 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                  {t.badge}
                </span>
                <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight whitespace-pre-line">
                  {t.heroTitle}
                </h1>
                <p className="text-xl text-slate-600 mb-10 leading-relaxed">{t.heroSub}</p>
                <Link to="/" className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg">
                  <Zap className="h-5 w-5" />
                  {t.cta}
                </Link>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-violet-100 rounded-3xl rotate-1 scale-105 opacity-60" />
                <img
                  src="/survey-support.png"
                  alt="Team support dashboard"
                  className="relative w-full h-auto rounded-3xl shadow-2xl border border-white/60 object-contain"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Metrics */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">{t.metricsTitle}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {t.metrics.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.85 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-100"
                >
                  <div className="text-4xl font-extrabold text-purple-600 mb-2">{m.value}</div>
                  <div className="text-sm text-slate-600 leading-tight">{m.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-4xl font-bold text-slate-900 mb-4">{t.rolesTitle}</h2>
              <p className="text-xl text-slate-600">{t.rolesSub}</p>
            </div>
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
                  <h3 className="text-2xl font-bold text-slate-900 mb-5">{role.name}</h3>
                  <ul className="space-y-2.5">
                    {role.perms.map((p, j) => (
                      <li key={j} className="flex items-center gap-2.5 text-slate-700 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Flow */}
        <section className="py-20 bg-white">
          <div className="max-w-5xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-slate-900 text-center mb-14">{t.flowTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {t.flowSteps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative p-8 bg-white rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all"
                >
                  <div className="text-5xl font-extrabold text-purple-100 absolute top-4 right-6">{step.num}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 pr-12">{step.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Section */}
        <section className="py-20 bg-gradient-to-b from-purple-50 to-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-6">{t.dashTitle}</h2>
                <p className="text-lg text-slate-600 mb-6 leading-relaxed">{t.dashDesc}</p>
                <ul className="space-y-3">
                  {t.dashFeatures.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle className="h-5 w-5 text-purple-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-violet-100 rounded-2xl rotate-1 scale-105 opacity-60" />
                <img
                  src="/survey-agent.png"
                  alt="Manager dashboard real-time view"
                  className="relative w-full h-auto rounded-2xl shadow-2xl border border-white/60 object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-purple-600 to-violet-700">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">{t.ctaTitle}</h2>
            <p className="text-xl text-purple-100 mb-8">{t.ctaSub}</p>
            <Link to="/" className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 text-purple-600 font-semibold px-10 py-5 rounded-2xl shadow-lg text-lg transition-all">
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
