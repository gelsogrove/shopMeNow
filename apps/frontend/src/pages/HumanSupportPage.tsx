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
    realTitle: "Come lavoriamo davvero",
    realSub: "Non slide, ma il prodotto reale: ecco cosa vede l'operatore quando l'AI passa la mano.",
    handoff: {
      tag: "Dal bot all'operatore",
      title: "Un riassunto strutturato, prima del passaggio",
      desc: "Quando il caso richiede l'intervento umano, la conversazione passa a un operatore. Prima del passaggio, l'operatore riceve un riepilogo interno completo: tutto il contesto, già pronto. Il cliente continua a vedere solo le risposte normali.",
      points: [
        "Data, ora e sede del cliente",
        "Macchina coinvolta e numero di serie",
        "Lingua della conversazione",
        "Riassunto del dialogo e azione suggerita",
        "Interno — mai visibile al cliente",
      ],
    },
    multilingual: {
      tag: "Gestione multilingua",
      title: "Operatore e cliente, lingue diverse, zero barriere",
      desc: "Nell'esempio il cliente scrive in arabo mentre l'operatore lavora in spagnolo. Ogni messaggio viene tradotto automaticamente in entrambe le direzioni. Con il Controllo Manuale l'AI viene disattivata: i messaggi vengono salvati ma il bot non risponde più.",
      points: [
        "Traduzione automatica bidirezionale",
        "L'operatore scrive nella sua lingua",
        "Controllo manuale: AI disattivata su richiesta",
        "Conversazione naturale anche tra lingue diverse",
      ],
    },
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
    realTitle: "How we actually work",
    realSub: "Not slides, but the real product: here's what the operator sees when the AI hands over.",
    handoff: {
      tag: "From bot to operator",
      title: "A structured summary, before the handoff",
      desc: "When a case requires human intervention, the conversation moves to an operator. Before the handoff, the operator receives a full internal summary: all the context, ready to go. The customer keeps seeing only the normal replies.",
      points: [
        "Date, time and customer location",
        "Machine involved and serial number",
        "Conversation language",
        "Dialogue summary and suggested action",
        "Internal — never visible to the customer",
      ],
    },
    multilingual: {
      tag: "Multilingual handling",
      title: "Operator and customer, different languages, zero barriers",
      desc: "In this example the customer writes in Arabic while the operator works in Spanish. Every message is automatically translated in both directions. With Manual Control the AI is disabled: messages are saved but the bot no longer replies.",
      points: [
        "Automatic two-way translation",
        "The operator writes in their own language",
        "Manual control: AI disabled on demand",
        "Natural conversation even across languages",
      ],
    },
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
    realTitle: "Cómo trabajamos de verdad",
    realSub: "No son diapositivas, es el producto real: esto es lo que ve el operador cuando la IA cede el control.",
    handoff: {
      tag: "Del bot al operador",
      title: "Un resumen estructurado, antes del traspaso",
      desc: "Cuando el caso requiere intervención humana, la conversación pasa a un operador. Antes del traspaso, el operador recibe un resumen interno completo: todo el contexto, listo. El cliente sigue viendo únicamente las respuestas normales.",
      points: [
        "Fecha, hora y sede del cliente",
        "Máquina implicada y número de serie",
        "Idioma de la conversación",
        "Resumen del diálogo y acción sugerida",
        "Interno — nunca visible para el cliente",
      ],
    },
    multilingual: {
      tag: "Gestión multilingüe",
      title: "Operador y cliente, idiomas distintos, cero barreras",
      desc: "En el ejemplo el cliente escribe en árabe mientras el operador trabaja en español. Cada mensaje se traduce automáticamente en ambas direcciones. Con el Control Manual la IA se desactiva: los mensajes se guardan pero el bot ya no responde.",
      points: [
        "Traducción automática bidireccional",
        "El operador escribe en su propio idioma",
        "Control manual: IA desactivada bajo demanda",
        "Conversación natural incluso entre idiomas distintos",
      ],
    },
  },
  de: {
    seoTitle: "Menschlicher Support Human-in-the-Loop - KI + menschliche Agenten im Zusammenspiel",
    ctaTitle: "Bereit, die menschliche Note hinzuzufügen?",
    seoDesc: "eChatbot kombiniert KI und menschliche Mitarbeiter für außergewöhnlichen Kundensupport. Der Chatbot bearbeitet 90% der Anfragen, die Mitarbeiter greifen ein, wenn es wirklich nötig ist.",
    seoKeys: "human in the loop, menschlicher chatbot support, chatbot menschlicher agent, whatsapp handoff, kundensupport ai, live chat whatsapp",
    breadcrumb: "Menschlicher Support",
    badge: "Human-in-the-Loop",
    heroTitle: "Das Beste der KI.\nDas Beste der Menschen.",
    heroSub: "eChatbot ersetzt Menschen nicht — er stärkt sie. Der KI-Chatbot bearbeitet 90% der Anfragen automatisch. Wenn Empathie und menschliches Urteilsvermögen gefragt sind, übernimmt der Mitarbeiter mit einem Klick die Kontrolle.",
    cta: "Kontaktiere uns",
    ctaSub: "Unverbindlich — wir melden uns in Kürze bei dir",
    howTitle: "So funktioniert das hybride System",
    howSub: "Die KI arbeitet unermüdlich rund um die Uhr. Menschliche Mitarbeiter greifen dort ein, wo sie einen echten Unterschied machen.",
    steps: [
      { icon: "🤖", title: "KI antwortet automatisch", desc: "Der Chatbot bearbeitet FAQs, Bestellungen, Buchungen und Standardanfragen. Sofortige Antwort, immer verfügbar, nie müde." },
      { icon: "🔍", title: "Überwacht in Echtzeit", desc: "Das System analysiert jede Konversation und erkennt, wann ein Kunde menschliche Aufmerksamkeit braucht: Frustration, komplexe Fragen, heikle Situationen." },
      { icon: "🤝", title: "Intelligente Übergabe", desc: "Der menschliche Mitarbeiter erhält die vollständige Konversation mit dem gesamten Kontext. Keine Wiederholungen für den Kunden, maximale Effizienz für das Team." },
      { icon: "⭐", title: "Feedback und Verbesserung", desc: "Jeder menschliche Eingriff verbessert das KI-Modell. Das System lernt von deinen Mitarbeitern, um ähnliche Situationen künftig eigenständig zu bewältigen." },
    ],
    operatorTitle: "Mitarbeiter-Dashboard",
    operatorDesc: "Ein intuitives Dashboard für dein Support-Team. Sieh alle laufenden Konversationen, jene, die auf einen Eingriff warten, und jene, die von der KI bearbeitet werden. Übernimm die Kontrolle, wann immer du willst, wo immer du bist.",
    operatorFeatures: [
      "Einheitliche Übersicht aller Konversationen",
      "Echtzeit-Benachrichtigungen für Übergaben",
      "Vollständiger Sitzungskontext",
      "Schnelle Antwort aus Vorlagen",
      "Zuweisung von Konversationen an das Team",
      "Analytics pro Mitarbeiter",
    ],
    metricsTitle: "Ergebnisse, die für sich sprechen",
    metrics: [
      { value: "90%", label: "Von der KI bearbeitete Anfragen", sub: "ohne menschlichen Eingriff" },
      { value: "< 2s", label: "KI-Antwortzeit", sub: "24 Stunden am Tag, 7 Tage die Woche" },
      { value: "-60%", label: "Support-Kosten", sub: "im Vergleich zu rein menschlichem Support" },
      { value: "+35%", label: "Kundenzufriedenheit", sub: "im Vergleich zu Bots oder Menschen allein" },
    ],
    useCasesTitle: "Wann ein menschlicher Mitarbeiter den Unterschied macht",
    useCases: [
      { icon: "😰", title: "Frustrierter Kunde", desc: "Das System erkennt Anzeichen von Frustration und alarmiert den Mitarbeiter, bevor der Kunde die Konversation abbricht." },
      { icon: "💰", title: "Komplexer Verkauf", desc: "Bei hochwertigen Bestellungen oder individuellen Angeboten schließt ein menschlicher Berater den Verkauf wirkungsvoller ab." },
      { icon: "⚖️", title: "Beschwerdemanagement", desc: "Heikle Beschwerden werden mit der Empathie behandelt, die nur ein Mensch bieten kann, und wahren so die Kundenbeziehung." },
      { icon: "🆘", title: "Außergewöhnliche Situationen", desc: "Notfälle, ungewöhnliche Anfragen, Ausnahmen von Richtlinien: Der Mitarbeiter greift mit der nötigen Entscheidungsbefugnis ein." },
    ],
    realTitle: "Wie wir wirklich arbeiten",
    realSub: "Keine Folien, sondern das echte Produkt: Das sieht der Mitarbeiter, wenn die KI übergibt.",
    handoff: {
      tag: "Vom Bot zum Mitarbeiter",
      title: "Eine strukturierte Zusammenfassung, vor der Übergabe",
      desc: "Wenn ein Fall menschliches Eingreifen erfordert, geht die Konversation an einen Mitarbeiter über. Vor der Übergabe erhält der Mitarbeiter eine vollständige interne Zusammenfassung: der gesamte Kontext, sofort einsatzbereit. Der Kunde sieht weiterhin nur die normalen Antworten.",
      points: [
        "Datum, Uhrzeit und Standort des Kunden",
        "Betroffene Maschine und Seriennummer",
        "Sprache der Konversation",
        "Zusammenfassung des Dialogs und vorgeschlagene Aktion",
        "Intern — für den Kunden niemals sichtbar",
      ],
    },
    multilingual: {
      tag: "Mehrsprachige Bearbeitung",
      title: "Mitarbeiter und Kunde, verschiedene Sprachen, null Barrieren",
      desc: "In diesem Beispiel schreibt der Kunde auf Arabisch, während der Mitarbeiter auf Spanisch arbeitet. Jede Nachricht wird automatisch in beide Richtungen übersetzt. Mit der manuellen Steuerung wird die KI deaktiviert: Nachrichten werden gespeichert, aber der Bot antwortet nicht mehr.",
      points: [
        "Automatische Übersetzung in beide Richtungen",
        "Der Mitarbeiter schreibt in seiner eigenen Sprache",
        "Manuelle Steuerung: KI auf Wunsch deaktiviert",
        "Natürliche Konversation auch über Sprachen hinweg",
      ],
    },
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
        <LandingHero
          title={t.heroTitle}
          subtitle={t.heroSub}
          ctaLabel={t.cta}
          image={{ src: "/humansupporto.png", alt: "Human support collaborating with AI" }}
          imageClassName="w-full max-h-[320px] rounded-3xl shadow-2xl border border-white/60 object-cover"
          buttonClassName="bg-green-600 hover:bg-green-700"
        />

        <MetricsSection title={t.metricsTitle} metrics={t.metrics} variant="green" />

        {/* How it Works */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <SectionHeader title={t.howTitle} subtitle={t.howSub} />
            <StepCardGrid steps={t.steps} variant="plain" />
          </div>
        </section>

        {/* Real product showcase — screenshots that show how we actually work */}
        <section className="py-20 bg-white/[0.02] border-y border-white/10">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <SectionHeader title={t.realTitle} subtitle={t.realSub} />

            {/* Handoff: bot → operator with structured internal summary */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24"
            >
              <div className="relative order-2 lg:order-1">
                <div className="absolute -inset-4 bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-3xl blur-xl opacity-50" />
                <img
                  src="/human-handoff.png"
                  alt="WhatsApp handoff with structured Human Support message for the operator"
                  className="relative w-full h-auto rounded-2xl shadow-2xl border border-white/10 object-contain"
                />
              </div>
              <div className="order-1 lg:order-2 space-y-6">
                <span className="inline-block bg-amber-400/10 text-amber-300 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full">
                  {t.handoff.tag}
                </span>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">{t.handoff.title}</h3>
                <p className="text-lg text-slate-400 leading-relaxed">{t.handoff.desc}</p>
                <FeatureChecklist items={t.handoff.points} iconClassName="text-amber-400" />
              </div>
            </motion.div>

            {/* Multilingual operator control */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              <div className="space-y-6">
                <span className="inline-block bg-emerald-400/10 text-emerald-300 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full">
                  {t.multilingual.tag}
                </span>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">{t.multilingual.title}</h3>
                <p className="text-lg text-slate-400 leading-relaxed">{t.multilingual.desc}</p>
                <FeatureChecklist items={t.multilingual.points} iconClassName="text-emerald-400" />
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-emerald-500/20 to-green-500/10 rounded-3xl blur-xl opacity-50" />
                <img
                  src="/operator-multilingual.png"
                  alt="Manual operator control with automatic two-way translation between Arabic and Spanish"
                  className="relative w-full h-auto rounded-2xl shadow-2xl border border-white/10 object-contain"
                />
              </div>
            </motion.div>
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
                    <FeatureChecklist items={t.operatorFeatures} iconClassName="text-green-500" />
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
            <UseCaseGrid items={t.useCases} variant="plain" />
          </div>
        </section>

        <CtaSection
          title={t.ctaTitle}
          subtitle={t.ctaSub}
          ctaLabel={t.cta}
          gradientClassName="from-green-500 to-emerald-600"
        />
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
