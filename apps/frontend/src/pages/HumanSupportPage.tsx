import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Zap, CheckCircle, Clock, Star } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Supporto Umano Human-in-the-Loop - AI + Operatori in Sinergia",
    ctaTitle: "Pronto ad aggiungere il tocco umano?",
    seoDesc: "eChatbot combina AI e operatori umani per offrire un supporto clienti eccezionale. Il chatbot gestisce il 90% delle richieste, gli operatori intervengono quando davvero necessario.",
    seoKeys: "human in the loop, supporto umano chatbot, chatbot operatore umano, handoff whatsapp, customer support ai, live chat whatsapp",
    breadcrumb: "Supporto Umano",
    badge: "Human-in-the-Loop",
    heroTitle: "Il meglio dell'AI.\nIl meglio degli esseri umani.",
    heroSub: "eChatbot non sostituisce le persone — le potenzia. Il chatbot AI gestisce il 90% delle richieste automaticamente. Quando serve l'empatia e il giudizio umano, l'operatore prende il controllo in un clic.",
    cta: "Contattaci",
    ctaSub: "Nessun impegno, ti rispondiamo a breve",
    howTitle: "Come funziona il sistema ibrido",
    howSub: "L'AI lavora instancabilmente 24/7. Gli operatori intervengono dove fanno davvero la differenza.",
    steps: [
      { icon: "🤖", title: "AI risponde automaticamente", desc: "Il chatbot gestisce FAQ, ordini, prenotazioni e richieste standard. Risposta immediata, sempre disponibile, mai stanco." },
      { icon: "🔍", title: "Monitora in tempo reale", desc: "Il sistema analizza ogni conversazione e rileva quando un cliente ha bisogno di attenzione umana: frustrazione, domande complesse, situazioni delicate." },
      { icon: "🤝", title: "Handoff intelligente", desc: "L'operatore umano riceve la conversazione completa con tutto il contesto. Zero ripetizioni per il cliente, massima efficienza per il team." },
      { icon: "⭐", title: "Feedback e miglioramento", desc: "Ogni intervento umano migliora il modello AI. Il sistema impara dai tuoi operatori per gestire situazioni simili in futuro autonomamente." },
    ],
    operatorTitle: "Dashboard Operatori",
    operatorDesc: "Una dashboard intuitiva per il tuo team di supporto. Vedi tutte le conversazioni in corso, quelle in attesa di intervento e quelle gestite dall'AI. Prendi il controllo quando vuoi, ovunque tu sia.",
    operatorFeatures: [
      "Vista unificata di tutte le conversazioni",
      "Notifiche in tempo reale per handoff",
      "Contesto completo della sessione",
      "Risposta rapida da template",
      "Assegnazione conversazioni al team",
      "Analytics per operatore",
    ],
    metricsTitle: "Risultati che parlano chiaro",
    metrics: [
      { value: "90%", label: "Richieste gestite dall'AI", sub: "senza intervento umano" },
      { value: "< 2s", label: "Tempo risposta AI", sub: "24 ore su 24, 7 giorni su 7" },
      { value: "-60%", label: "Costo supporto", sub: "rispetto al solo supporto umano" },
      { value: "+35%", label: "Soddisfazione clienti", sub: "rispetto a soli bot o soli umani" },
    ],
    useCasesTitle: "Quando l'operatore umano fa la differenza",
    useCases: [
      { icon: "😰", title: "Cliente frustrato", desc: "Il sistema rileva segnali di frustrazione e avvisa l'operatore prima che il cliente abbandoni la conversazione." },
      { icon: "💰", title: "Vendita complessa", desc: "Per ordini di alto valore o preventivi personalizzati, un consulente umano chiude la vendita con più efficacia." },
      { icon: "⚖️", title: "Gestione reclami", desc: "I reclami delicati vengono gestiti con l'empatia che solo un essere umano può offrire, salvaguardando la relazione con il cliente." },
      { icon: "🆘", title: "Situazioni eccezionali", desc: "Emergenze, richieste fuori standard, eccezioni alle policy: l'operatore interviene con il potere decisionale necessario." },
    ],
  },
  en: {
    seoTitle: "Human Support Human-in-the-Loop - AI + Human Agents in Synergy",
    ctaTitle: "Ready to add the human touch?",
    seoDesc: "eChatbot combines AI and human operators to offer exceptional customer support. The chatbot handles 90% of requests, operators step in when truly needed.",
    seoKeys: "human in the loop, human chatbot support, chatbot human agent, whatsapp handoff, customer support ai, live chat whatsapp",
    breadcrumb: "Human Support",
    badge: "Human-in-the-Loop",
    heroTitle: "The best of AI.\nThe best of humans.",
    heroSub: "eChatbot doesn't replace people — it empowers them. The AI chatbot handles 90% of requests automatically. When empathy and human judgment are needed, the operator takes control with one click.",
    cta: "Contact Us",
    ctaSub: "No commitment — we will get back to you shortly",
    howTitle: "How the hybrid system works",
    howSub: "AI works tirelessly 24/7. Human operators step in where they make a real difference.",
    steps: [
      { icon: "🤖", title: "AI responds automatically", desc: "The chatbot handles FAQs, orders, bookings and standard requests. Instant response, always available, never tired." },
      { icon: "🔍", title: "Monitors in real time", desc: "The system analyzes each conversation and detects when a customer needs human attention: frustration, complex questions, sensitive situations." },
      { icon: "🤝", title: "Intelligent handoff", desc: "The human operator receives the full conversation with all context. Zero repetitions for the customer, maximum efficiency for the team." },
      { icon: "⭐", title: "Feedback and improvement", desc: "Every human intervention improves the AI model. The system learns from your operators to handle similar situations autonomously in the future." },
    ],
    operatorTitle: "Operator Dashboard",
    operatorDesc: "An intuitive dashboard for your support team. See all ongoing conversations, those waiting for intervention, and those handled by AI. Take control whenever you want, wherever you are.",
    operatorFeatures: [
      "Unified view of all conversations",
      "Real-time notifications for handoffs",
      "Complete session context",
      "Quick response from templates",
      "Conversation assignment to team",
      "Per-operator analytics",
    ],
    metricsTitle: "Results that speak for themselves",
    metrics: [
      { value: "90%", label: "Requests handled by AI", sub: "without human intervention" },
      { value: "< 2s", label: "AI response time", sub: "24 hours a day, 7 days a week" },
      { value: "-60%", label: "Support cost", sub: "compared to human-only support" },
      { value: "+35%", label: "Customer satisfaction", sub: "compared to bots or humans alone" },
    ],
    useCasesTitle: "When a human operator makes the difference",
    useCases: [
      { icon: "😰", title: "Frustrated customer", desc: "The system detects frustration signals and alerts the operator before the customer abandons the conversation." },
      { icon: "💰", title: "Complex sale", desc: "For high-value orders or custom quotes, a human consultant closes the sale more effectively." },
      { icon: "⚖️", title: "Complaint management", desc: "Sensitive complaints are handled with the empathy only a human can offer, safeguarding the customer relationship." },
      { icon: "🆘", title: "Exceptional situations", desc: "Emergencies, out-of-standard requests, policy exceptions: the operator steps in with the necessary decision-making power." },
    ],
  },
  es: {
    seoTitle: "Soporte Humano Human-in-the-Loop - IA + Agentes Humanos en Sinergia",
    ctaTitle: "¿Listo para agregar el toque humano?",
    seoDesc: "eChatbot combina IA y operadores humanos para ofrecer un soporte al cliente excepcional. El chatbot gestiona el 90% de las solicitudes, los operadores intervienen cuando es realmente necesario.",
    seoKeys: "human in the loop, soporte humano chatbot, chatbot agente humano, handoff whatsapp, soporte cliente ai, live chat whatsapp",
    breadcrumb: "Soporte Humano",
    badge: "Human-in-the-Loop",
    heroTitle: "Lo mejor de la IA.\nLo mejor de los humanos.",
    heroSub: "eChatbot no reemplaza a las personas, las potencia. El chatbot AI gestiona el 90% de las solicitudes automáticamente. Cuando se necesita empatía y juicio humano, el operador toma el control con un clic.",
    cta: "Contáctanos",
    ctaSub: "Sin compromiso, te respondemos pronto",
    howTitle: "Cómo funciona el sistema híbrido",
    howSub: "La IA trabaja incansablemente 24/7. Los operadores humanos intervienen donde marcan la diferencia.",
    steps: [
      { icon: "🤖", title: "La IA responde automáticamente", desc: "El chatbot gestiona FAQs, pedidos, reservas y solicitudes estándar. Respuesta inmediata, siempre disponible, nunca cansado." },
      { icon: "🔍", title: "Monitorea en tiempo real", desc: "El sistema analiza cada conversación y detecta cuándo un cliente necesita atención humana: frustración, preguntas complejas, situaciones delicadas." },
      { icon: "🤝", title: "Handoff inteligente", desc: "El operador humano recibe la conversación completa con todo el contexto. Cero repeticiones para el cliente, máxima eficiencia para el equipo." },
      { icon: "⭐", title: "Feedback y mejora", desc: "Cada intervención humana mejora el modelo IA. El sistema aprende de tus operadores para gestionar situaciones similares de forma autónoma en el futuro." },
    ],
    operatorTitle: "Panel de Operadores",
    operatorDesc: "Un panel intuitivo para tu equipo de soporte. Ve todas las conversaciones en curso, las que esperan intervención y las gestionadas por la IA. Toma el control cuando quieras, donde estés.",
    operatorFeatures: [
      "Vista unificada de todas las conversaciones",
      "Notificaciones en tiempo real para handoffs",
      "Contexto completo de la sesión",
      "Respuesta rápida desde plantillas",
      "Asignación de conversaciones al equipo",
      "Analíticas por operador",
    ],
    metricsTitle: "Resultados que hablan por sí solos",
    metrics: [
      { value: "90%", label: "Solicitudes gestionadas por IA", sub: "sin intervención humana" },
      { value: "< 2s", label: "Tiempo respuesta IA", sub: "24 horas al día, 7 días a la semana" },
      { value: "-60%", label: "Coste de soporte", sub: "comparado con solo soporte humano" },
      { value: "+35%", label: "Satisfacción del cliente", sub: "comparado con solo bots o solo humanos" },
    ],
    useCasesTitle: "Cuándo el operador humano marca la diferencia",
    useCases: [
      { icon: "😰", title: "Cliente frustrado", desc: "El sistema detecta señales de frustración y avisa al operador antes de que el cliente abandone la conversación." },
      { icon: "💰", title: "Venta compleja", desc: "Para pedidos de alto valor o presupuestos personalizados, un consultor humano cierra la venta con más eficacia." },
      { icon: "⚖️", title: "Gestión de reclamaciones", desc: "Las reclamaciones delicadas se gestionan con la empatía que solo un ser humano puede ofrecer, salvaguardando la relación con el cliente." },
      { icon: "🆘", title: "Situaciones excepcionales", desc: "Emergencias, solicitudes fuera de estándar, excepciones a las políticas: el operador interviene con el poder de decisión necesario." },
    ],
  },
  pt: {
    seoTitle: "Suporte Humano Human-in-the-Loop - IA + Agentes Humanos em Sinergia",
    ctaTitle: "Pronto para adicionar o toque humano?",
    seoDesc: "O eChatbot combina IA e operadores humanos para oferecer suporte ao cliente excepcional. O chatbot lida com 90% das solicitações, os operadores intervêm quando realmente necessário.",
    seoKeys: "human in the loop, suporte humano chatbot, chatbot agente humano, handoff whatsapp, suporte cliente ai, live chat whatsapp",
    breadcrumb: "Suporte Humano",
    badge: "Human-in-the-Loop",
    heroTitle: "O melhor da IA.\nO melhor dos humanos.",
    heroSub: "O eChatbot não substitui as pessoas — as potencializa. O chatbot AI lida com 90% das solicitações automaticamente. Quando empatia e julgamento humano são necessários, o operador assume o controle com um clique.",
    cta: "Fale Connosco",
    ctaSub: "Sem compromisso, respondemos em breve",
    howTitle: "Como funciona o sistema híbrido",
    howSub: "A IA trabalha incansavelmente 24/7. Os operadores humanos intervêm onde fazem a diferença real.",
    steps: [
      { icon: "🤖", title: "IA responde automaticamente", desc: "O chatbot lida com FAQs, pedidos, reservas e solicitações padrão. Resposta imediata, sempre disponível, nunca cansado." },
      { icon: "🔍", title: "Monitora em tempo real", desc: "O sistema analisa cada conversa e detecta quando um cliente precisa de atenção humana: frustração, perguntas complexas, situações delicadas." },
      { icon: "🤝", title: "Handoff inteligente", desc: "O operador humano recebe a conversa completa com todo o contexto. Zero repetições para o cliente, máxima eficiência para a equipe." },
      { icon: "⭐", title: "Feedback e melhoria", desc: "Cada intervenção humana melhora o modelo de IA. O sistema aprende com seus operadores para lidar com situações semelhantes de forma autônoma no futuro." },
    ],
    operatorTitle: "Dashboard do Operador",
    operatorDesc: "Um dashboard intuitivo para sua equipe de suporte. Veja todas as conversas em andamento, as que aguardam intervenção e as gerenciadas pela IA. Assuma o controle quando quiser, onde quer que esteja.",
    operatorFeatures: [
      "Visão unificada de todas as conversas",
      "Notificações em tempo real para handoffs",
      "Contexto completo da sessão",
      "Resposta rápida de templates",
      "Atribuição de conversas à equipe",
      "Analytics por operador",
    ],
    metricsTitle: "Resultados que falam por si",
    metrics: [
      { value: "90%", label: "Solicitações gerenciadas pela IA", sub: "sem intervenção humana" },
      { value: "< 2s", label: "Tempo resposta IA", sub: "24 horas por dia, 7 dias por semana" },
      { value: "-60%", label: "Custo de suporte", sub: "comparado ao suporte apenas humano" },
      { value: "+35%", label: "Satisfação do cliente", sub: "comparado a bots ou humanos isolados" },
    ],
    useCasesTitle: "Quando o operador humano faz a diferença",
    useCases: [
      { icon: "😰", title: "Cliente frustrado", desc: "O sistema detecta sinais de frustração e alerta o operador antes que o cliente abandone a conversa." },
      { icon: "💰", title: "Venda complexa", desc: "Para pedidos de alto valor ou orçamentos personalizados, um consultor humano fecha a venda com mais eficácia." },
      { icon: "⚖️", title: "Gestão de reclamações", desc: "As reclamações delicadas são tratadas com a empatia que só um ser humano pode oferecer, salvaguardando o relacionamento com o cliente." },
      { icon: "🆘", title: "Situações excepcionais", desc: "Emergências, solicitações fora do padrão, exceções às políticas: o operador intervém com o poder de decisão necessário." },
    ],
  },
}

export function HumanSupportPage() {
  const { language } = useLanguage()
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-200">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/human-support" lang={language} serviceType="Human-in-the-Loop Customer Support" />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="pt-24 pb-16 lg:pt-32 lg:pb-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
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
                  src="/humansupporto.png"
                  alt="Human support collaborating with AI"
                  className="relative w-full max-h-[320px] rounded-3xl shadow-2xl border border-white/60 object-cover"
                />
              </div>
              <div className="order-1 lg:order-2">
                <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight whitespace-pre-line">
                  {t.heroTitle}
                </h1>
                <p className="text-xl text-slate-400 mb-10 leading-relaxed">{t.heroSub}</p>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
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
                  className="text-center p-6 bg-slate-900/40 rounded-2xl border border-white/10"
                >
                  <div className="text-4xl font-bold text-green-600 mb-2">{m.value}</div>
                  <div className="font-semibold text-white mb-1">{m.label}</div>
                  <div className="text-sm text-slate-500">{m.sub}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-20">
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
                  className="bg-slate-900/50 rounded-2xl p-6 shadow-lg border border-white/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="text-4xl mb-4">{step.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Operator Dashboard Section */}
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
                  {/* Operator dashboard image */}
                  <div className="relative order-2 lg:order-1">
                    <div className="absolute -inset-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl blur-xl opacity-40" />
                    <img src="/survey-support.png" alt="Operator Dashboard" className="relative w-full h-auto rounded-2xl shadow-xl border border-white/60 object-contain" />
                  </div>
                  <div className="space-y-6 order-1 lg:order-2">
                    <h2 className="text-3xl lg:text-4xl font-bold text-white">{t.operatorTitle}</h2>
                    <p className="text-lg text-slate-400 leading-relaxed">{t.operatorDesc}</p>
                    <ul className="space-y-3">
                      {t.operatorFeatures.map((f, i) => (
                        <li key={i} className="flex items-center gap-3 text-slate-300">
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
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
        <section className="py-20">
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
                  className="flex gap-6 p-6 bg-slate-900/50 rounded-2xl shadow-md border border-white/10 hover:shadow-lg transition-all"
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
            <Link to="/contact" className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 text-green-600 font-semibold px-10 py-5 rounded-2xl shadow-lg text-lg transition-all">
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
