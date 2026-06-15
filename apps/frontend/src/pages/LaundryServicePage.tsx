import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, ShieldCheck, Server, Puzzle, Users, CheckCircle } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { LandingHero } from "@/components/landing/LandingHero"
import { SectionHeader } from "@/components/landing/SectionHeader"
import { CtaSection } from "@/components/landing/CtaSection"

type Language = "it" | "en" | "es" | "de"

const T = {
  it: {
    seoTitle: "Chatbot WhatsApp per Lavanderie e Franchising - eChatbot",
    seoDesc: "eChatbot è la soluzione AI su misura per lavanderie e franchising: supporto 24/7, traduzione in tempo reale, integrazione con le macchine e campagne di marketing su WhatsApp.",
    seoKeys: "chatbot lavanderia, whatsapp lavanderia, assistente ia lavanderia, supporto clienti lavanderia, franchising lavanderia ai",
    breadcrumb: "Lavanderie e Franchising",
    badge: "Per Franchising",
    heroTitle: "La tua lavanderia in franchising risponde da sola, 24/7, su WhatsApp",
    heroSub: "Risponde ai clienti, prenota consulenze di franchising, sblocca le macchine da remoto e passa a un operatore quando serve. In ogni lingua.",
    cta: "Parliamone",
    ctaSub: "Nessun impegno",
    tryDemo: "Prova la nostra demo →",
    problemsTitle: "I tuoi problemi, le nostre soluzioni",
    problems: [
      {
        num: "1",
        problem: "Dubbi, incidenti e reclami arrivano a qualsiasi ora e restano senza risposta?",
        solutionTitle: "Supporto 24/7",
        solutionDesc: "L'assistente risponde da solo alla maggior parte dei casi su WhatsApp. L'operatore interviene solo quando serve, con un riepilogo già pronto: sede, macchina e problema.",
      },
      {
        num: "2",
        problem: "Clienti stranieri che non capiscono le istruzioni né sanno come chiedere aiuto?",
        solutionTitle: "Traduzione in tempo reale",
        solutionDesc: "Il cliente scrive nella sua lingua, tu rispondi nella tua. La conversazione si traduce in entrambe le direzioni, all'istante. Zero barriere.",
      },
      {
        num: "3",
        problem: "Nessun modo per contattare i tuoi clienti per offrire una promozione?",
        solutionTitle: "Campagne e avvisi via WhatsApp",
        solutionDesc: "Invia offerte e promemoria per sede direttamente al telefono del cliente. Lo stesso canale di supporto diventa un canale che genera vendite.",
      },
      {
        num: "4",
        problem: "Ogni sede ha prezzi e orari diversi e la gestione diventa complicata?",
        solutionTitle: "Risposte personalizzate",
        solutionDesc: "L'IA identifica da quale sede scrive il cliente e risponde con i dati corretti: prezzi, orari e informazioni di quel locale.",
      },
      {
        num: "5",
        problem: "Troppe cose da orchestrare insieme: rispondere, tradurre, fatturare, avvisare…?",
        solutionTitle: "Un'IA che orchestra tutto",
        solutionDesc: "Non è solo un chatbot: è un'IA su misura che risponde, invia fatture, audio e video, traduce, scala a un operatore e, soprattutto, si collega alle tue macchine.",
      },
    ],
    tagline: "Un'unica soluzione: meno lavoro, clienti assistiti, più vendite.",
    securityTitle: "I tuoi dati, sotto il tuo controllo.",
    securityItems: [
      { icon: "shield", title: "Sicurezza dei dati", desc: "L'IA dialoga in modo naturale, ma non è sempre attiva. Quando si raccolgono dati personali, il sistema passa automaticamente da modalità IA a un flusso controllato. Le informazioni sensibili non vengono mai inviate a servizi IA esterni." },
      { icon: "server", title: "On-premise: tutto a casa tua", desc: "Il sistema si installa sui vostri server. Tutto il software gira all'interno dell'azienda, che mantiene il controllo totale delle conversazioni e delle informazioni." },
      { icon: "puzzle", title: "Espandibile alle tue esigenze", desc: "Le funzionalità crescono con te: nuove integrazioni, connessione ai tuoi sistemi e funzioni autonome, secondo quello che il tuo business richiede in ogni momento." },
      { icon: "users", title: "Un progetto che costruiamo insieme", desc: "Non vi adattate a un prodotto rigido: costruiamo il sistema attorno alla vostra realtà. Alleniamo l'IA con i vostri casi reali e la affiniamo nel tempo." },
    ],
    securityTagline: "Fatto su misura. Sicuro, tuo, pensato per il tuo business.",
    translationTitle: "Senza barriere linguistiche.",
    translationDesc: "Il cliente scrive in arabo, l'operatore lavora in italiano. Ogni messaggio si traduce in entrambe le direzioni, in tempo reale — una conversazione naturale anche se parlano lingue diverse.",
    actsTitle: "Non solo risponde: agisce e vende.",
    actsDesc: "Il cliente segnala che la lavatrice non si apre. L'IA si collega alla macchina, la sblocca e conferma. E nella stessa conversazione, presenta la carta fedeltà.",
    campaignsTitle: "Converti avvisi in vendite.",
    campaignsDesc: "Con un clic invii una campagna a tutti i tuoi clienti via WhatsApp: una promozione per gli orari tranquilli, una novità o la carta fedeltà. Il canale di supporto diventa il tuo miglior strumento di marketing.",
    ctaTitle: "Ne parliamo?",
    ctaDesc: "Scopri come eChatbot può trasformare il tuo franchising di lavanderie.",
  },
  en: {
    seoTitle: "WhatsApp Chatbot for Laundry Franchises - eChatbot",
    seoDesc: "eChatbot is the custom AI solution for laundry franchises: 24/7 support, real-time translation, machine integration and WhatsApp marketing campaigns.",
    seoKeys: "laundry chatbot, whatsapp laundry, ai laundry assistant, laundry customer support, laundry franchise ai",
    breadcrumb: "Laundry & Franchises",
    badge: "For Franchises",
    heroTitle: "Your franchise laundromat answers on its own, 24/7, on WhatsApp",
    heroSub: "Answers customers, books franchise consultations, unlocks machines remotely and hands off to an operator when needed. In any language.",
    cta: "Let's Talk",
    ctaSub: "No commitment",
    tryDemo: "Try our demo →",
    problemsTitle: "Your problems, our solutions",
    problems: [
      {
        num: "1",
        problem: "Questions, incidents and complaints coming in at any hour and going unanswered?",
        solutionTitle: "24/7 Support",
        solutionDesc: "The assistant handles most cases on WhatsApp on its own. The operator steps in only when needed, with a ready-made summary: location, machine and issue.",
      },
      {
        num: "2",
        problem: "Foreign customers who don't understand the instructions or know how to ask for help?",
        solutionTitle: "Real-time Translation",
        solutionDesc: "The customer writes in their language, you reply in yours. The conversation is translated in both directions, instantly. Zero barriers.",
      },
      {
        num: "3",
        problem: "No way to reach your customers to offer them a promotion?",
        solutionTitle: "WhatsApp Campaigns & Alerts",
        solutionDesc: "Send offers and reminders by location directly to the customer's phone. The same support channel becomes a channel that generates sales.",
      },
      {
        num: "4",
        problem: "Each location has its own prices and hours and management gets complicated?",
        solutionTitle: "Personalised Responses",
        solutionDesc: "The AI identifies which location the customer is writing from and responds with the correct data: prices, hours and information for that branch.",
      },
      {
        num: "5",
        problem: "Too many things to orchestrate at once: reply, translate, invoice, notify…?",
        solutionTitle: "An AI that orchestrates everything",
        solutionDesc: "It's not just a chatbot: it's a custom AI that replies, sends invoices, audio and video, translates, escalates to an operator and, above all, connects to your machines.",
      },
    ],
    tagline: "One solution: less work, attended customers, more sales.",
    securityTitle: "Your data, under your control.",
    securityItems: [
      { icon: "shield", title: "Data Security", desc: "The AI converses naturally, but it's not always active. Whenever personal data needs to be collected, the system automatically switches from AI mode to a rule-controlled flow. Sensitive information is never sent to external AI services." },
      { icon: "server", title: "On-premise: everything in-house", desc: "The system is installed on your servers. All software runs inside your company, which maintains full control of conversations and information, with no data passing through third parties." },
      { icon: "puzzle", title: "Expandable to your needs", desc: "Features grow with you: new integrations, connections to your systems and autonomous functions, based on what your business needs at any given moment." },
      { icon: "users", title: "A project we build together", desc: "You don't adapt to a rigid product: we build the system around your reality. We train the AI on your real cases and fine-tune it over time." },
    ],
    securityTagline: "Built for you. Secure, yours, and designed for your business.",
    translationTitle: "No language barriers.",
    translationDesc: "The customer writes in Arabic, the operator works in English. Every message is translated in both directions, in real time — a natural conversation even when they speak different languages.",
    actsTitle: "Doesn't just reply: it acts and sells.",
    actsDesc: "The customer reports that the washing machine won't open. The AI connects to the machine, unlocks it and confirms. And in the same conversation, it presents the loyalty card.",
    campaignsTitle: "Turn notifications into sales.",
    campaignsDesc: "With one click you send a campaign to all your customers on WhatsApp: a promotion for quiet hours, a new offer or the loyalty card. The support channel becomes your best marketing tool.",
    ctaTitle: "Shall we talk?",
    ctaDesc: "Discover how eChatbot can transform your laundry franchise.",
  },
  es: {
    seoTitle: "Chatbot WhatsApp para Lavanderías y Franquicias - eChatbot",
    seoDesc: "eChatbot es la solución de IA a medida para lavanderías y franquicias: soporte 24/7, traducción en tiempo real, integración con máquinas y campañas de marketing por WhatsApp.",
    seoKeys: "chatbot lavandería, whatsapp lavandería, asistente ia lavandería, atención al cliente lavandería, franquicia lavandería ia",
    breadcrumb: "Lavanderías y Franquicias",
    badge: "Para Franquicias",
    heroTitle: "Tu lavandería en franquicia atiende sola, 24/7, en WhatsApp",
    heroSub: "Responde a clientes, agenda consultorías de franquicia, desbloquea máquinas en remoto y pasa a un operador cuando hace falta. En cualquier idioma.",
    cta: "¿Lo hablamos?",
    ctaSub: "Sin compromiso",
    tryDemo: "Prueba nuestra demo →",
    problemsTitle: "Tus problemas, nuestras soluciones",
    problems: [
      {
        num: "1",
        problem: "¿Dudas, incidencias y quejas que llegan a cualquier hora y se quedan sin respuesta?",
        solutionTitle: "Soporte 24/7",
        solutionDesc: "El asistente responde solo a la mayoría de los casos en WhatsApp. El operador interviene únicamente cuando hace falta, con un resumen ya preparado: sede, máquina e incidencia.",
      },
      {
        num: "2",
        problem: "¿Clientes extranjeros que no entienden las instrucciones ni saben cómo pedir ayuda?",
        solutionTitle: "Traducción en tiempo real",
        solutionDesc: "El cliente escribe en su idioma, tú respondes en el tuyo. La conversación se traduce en ambas direcciones, al instante. Cero barreras.",
      },
      {
        num: "3",
        problem: "¿Sin forma de contactar a tus clientes para ofrecerles una promoción?",
        solutionTitle: "Campañas y avisos por WhatsApp",
        solutionDesc: "Envía ofertas y recordatorios por sede directamente al móvil del cliente. El mismo canal de soporte se convierte en un canal que genera ventas.",
      },
      {
        num: "4",
        problem: "¿Cada sede tiene sus propios precios y horarios y la gestión se vuelve complicada?",
        solutionTitle: "Respuestas personalizadas",
        solutionDesc: "La IA identifica desde qué sede escribe el cliente y responde con los datos correctos: precios, horarios e información de ese local.",
      },
      {
        num: "5",
        problem: "¿Demasiadas cosas que orquestar a la vez: responder, traducir, facturar, avisar...?",
        solutionTitle: "Una IA que lo orquesta todo",
        solutionDesc: "No es solo un chatbot: es una IA hecha a medida que contesta, envía facturas, audios y vídeos, traduce, escala a un operador y, sobre todo, se conecta a tus máquinas.",
      },
    ],
    tagline: "Una sola solución: menos trabajo, clientes atendidos, más ventas.",
    securityTitle: "Tus datos, bajo tu control.",
    securityItems: [
      { icon: "shield", title: "Seguridad de los datos", desc: "La IA entiende y dialoga de forma natural, pero no está siempre activa. En cuanto hay que recoger datos personales del cliente, el sistema pasa automáticamente de modo IA a un flujo controlado. La información personal nunca se envía a servicios de IA externos." },
      { icon: "server", title: "On-premise: todo en tu casa", desc: "El sistema se instala en vuestros servidores. Todo el software corre dentro de la empresa, que mantiene el control total de las conversaciones y de la información, sin que los datos pasen por terceros." },
      { icon: "puzzle", title: "Ampliable a tus necesidades", desc: "Las funcionalidades crecen contigo: nuevas integraciones, conexión con tus sistemas y funciones autónomas, según lo que tu negocio necesite en cada momento." },
      { icon: "users", title: "Un proyecto que construimos juntos", desc: "No os adaptáis a un producto rígido: construimos el sistema en torno a vuestra realidad. Entrenamos la IA con vuestros casos reales y la afinamos con el tiempo." },
    ],
    securityTagline: "Hecho a tu medida. Seguro, tuyo, y pensado para tu negocio.",
    translationTitle: "Sin barreras de idioma.",
    translationDesc: "El cliente escribe en árabe, el operador trabaja en español. Cada mensaje se traduce en ambas direcciones, en tiempo real — una conversación natural aunque hablen idiomas distintos.",
    actsTitle: "No solo responde: actúa y vende.",
    actsDesc: "El cliente avisa de que la lavadora no se abre. La IA se conecta a la máquina, la desbloquea y confirma. Y en la misma conversación, aprovecha para presentar la tarjeta de fidelización.",
    campaignsTitle: "Convierte avisos en ventas.",
    campaignsDesc: "Con un clic envías una campaña a todos tus clientes por WhatsApp: una promoción para las horas flojas, una novedad o la tarjeta de fidelización. El canal de soporte se convierte en tu mejor herramienta de marketing.",
    ctaTitle: "¿Lo hablamos?",
    ctaDesc: "Descubre cómo eChatbot puede transformar tu franquicia de lavanderías.",
  },
  de: {
    seoTitle: "WhatsApp Chatbot für Wäschereien und Franchises - eChatbot",
    seoDesc: "eChatbot ist die maßgeschneiderte KI-Lösung für Wäschereien und Franchises: Support rund um die Uhr, Echtzeit-Übersetzung, Maschinen-Integration und Marketing-Kampagnen über WhatsApp.",
    seoKeys: "wäscherei chatbot, whatsapp wäscherei, ki wäscherei assistent, wäscherei kundenservice, wäscherei franchise ki",
    breadcrumb: "Wäschereien & Franchises",
    badge: "Für Franchises",
    heroTitle: "Deine Franchise-Wäscherei antwortet von allein, rund um die Uhr, auf WhatsApp",
    heroSub: "Sie antwortet Kunden, bucht Franchise-Beratungen, entsperrt Maschinen aus der Ferne und übergibt bei Bedarf an einen Mitarbeiter. In jeder Sprache.",
    cta: "Sprechen wir darüber",
    ctaSub: "Unverbindlich",
    tryDemo: "Demo ausprobieren →",
    problemsTitle: "Deine Probleme, unsere Lösungen",
    problems: [
      {
        num: "1",
        problem: "Fragen, Störungen und Beschwerden treffen zu jeder Uhrzeit ein und bleiben unbeantwortet?",
        solutionTitle: "Support rund um die Uhr",
        solutionDesc: "Der Assistent bearbeitet die meisten Fälle auf WhatsApp ganz allein. Der Mitarbeiter greift nur ein, wenn es nötig ist, mit einer fertigen Zusammenfassung: Standort, Maschine und Störung.",
      },
      {
        num: "2",
        problem: "Ausländische Kunden, die die Anleitungen nicht verstehen und nicht wissen, wie sie um Hilfe bitten sollen?",
        solutionTitle: "Echtzeit-Übersetzung",
        solutionDesc: "Der Kunde schreibt in seiner Sprache, du antwortest in deiner. Das Gespräch wird in beide Richtungen übersetzt, sofort. Null Barrieren.",
      },
      {
        num: "3",
        problem: "Keine Möglichkeit, deine Kunden zu erreichen, um ihnen eine Aktion anzubieten?",
        solutionTitle: "WhatsApp-Kampagnen & Benachrichtigungen",
        solutionDesc: "Sende Angebote und Erinnerungen pro Standort direkt auf das Handy des Kunden. Derselbe Support-Kanal wird zu einem Kanal, der Verkäufe erzeugt.",
      },
      {
        num: "4",
        problem: "Jeder Standort hat eigene Preise und Öffnungszeiten und die Verwaltung wird kompliziert?",
        solutionTitle: "Personalisierte Antworten",
        solutionDesc: "Die KI erkennt, von welchem Standort der Kunde schreibt, und antwortet mit den richtigen Daten: Preisen, Öffnungszeiten und Informationen zu dieser Filiale.",
      },
      {
        num: "5",
        problem: "Zu viele Dinge gleichzeitig zu koordinieren: antworten, übersetzen, abrechnen, benachrichtigen…?",
        solutionTitle: "Eine KI, die alles orchestriert",
        solutionDesc: "Es ist nicht nur ein Chatbot: Es ist eine maßgeschneiderte KI, die antwortet, Rechnungen, Audio und Video versendet, übersetzt, an einen Mitarbeiter eskaliert und sich vor allem mit deinen Maschinen verbindet.",
      },
    ],
    tagline: "Eine einzige Lösung: weniger Arbeit, betreute Kunden, mehr Umsatz.",
    securityTitle: "Deine Daten, unter deiner Kontrolle.",
    securityItems: [
      { icon: "shield", title: "Datensicherheit", desc: "Die KI führt natürliche Gespräche, ist aber nicht immer aktiv. Sobald personenbezogene Daten des Kunden erfasst werden müssen, wechselt das System automatisch vom KI-Modus in einen kontrollierten Ablauf. Persönliche Informationen werden niemals an externe KI-Dienste gesendet." },
      { icon: "server", title: "On-Premise: alles im eigenen Haus", desc: "Das System wird auf deinen Servern installiert. Die gesamte Software läuft innerhalb des Unternehmens, das die volle Kontrolle über Gespräche und Informationen behält, ohne dass Daten an Dritte gelangen." },
      { icon: "puzzle", title: "Erweiterbar nach deinen Bedürfnissen", desc: "Die Funktionen wachsen mit dir: neue Integrationen, Anbindungen an deine Systeme und autonome Funktionen, je nachdem, was dein Unternehmen gerade braucht." },
      { icon: "users", title: "Ein Projekt, das wir gemeinsam aufbauen", desc: "Du passt dich nicht an ein starres Produkt an: Wir bauen das System rund um deine Realität. Wir trainieren die KI mit deinen echten Fällen und verfeinern sie mit der Zeit." },
    ],
    securityTagline: "Auf dich zugeschnitten. Sicher, deins, und für dein Unternehmen gemacht.",
    translationTitle: "Keine Sprachbarrieren.",
    translationDesc: "Der Kunde schreibt auf Arabisch, der Mitarbeiter arbeitet auf Deutsch. Jede Nachricht wird in beide Richtungen übersetzt, in Echtzeit — ein natürliches Gespräch, auch wenn sie verschiedene Sprachen sprechen.",
    actsTitle: "Antwortet nicht nur: handelt und verkauft.",
    actsDesc: "Der Kunde meldet, dass die Waschmaschine nicht aufgeht. Die KI verbindet sich mit der Maschine, entsperrt sie und bestätigt. Und im selben Gespräch präsentiert sie die Treuekarte.",
    campaignsTitle: "Verwandle Benachrichtigungen in Verkäufe.",
    campaignsDesc: "Mit einem Klick sendest du eine Kampagne an alle deine Kunden auf WhatsApp: eine Aktion für ruhige Zeiten, ein neues Angebot oder die Treuekarte. Der Support-Kanal wird zu deinem besten Marketing-Werkzeug.",
    ctaTitle: "Sprechen wir darüber?",
    ctaDesc: "Entdecke, wie eChatbot deine Wäscherei-Franchise transformieren kann.",
  },
}

const securityIcon = (key: string) => {
  if (key === "shield") return <ShieldCheck className="w-6 h-6 text-[#25D366]" />
  if (key === "server") return <Server className="w-6 h-6 text-[#25D366]" />
  if (key === "puzzle") return <Puzzle className="w-6 h-6 text-[#25D366]" />
  return <Users className="w-6 h-6 text-[#25D366]" />
}

export function LaundryServicePage() {
  const { language } = useLanguage()
  const t = T[(language as Language) ?? "en"] ?? T.en

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <SEO
        title={t.seoTitle}
        description={t.seoDesc}
        keywords={t.seoKeys}
        url="/laundry-service"
        lang={language as Language}
        serviceType="WhatsApp AI Chatbot for Laundry Franchises"
      />
      <SiteHeader />

      <main className="min-h-screen bg-[#070d18] text-slate-200">
        <LandingHero
          title={t.heroTitle}
          subtitle={t.heroSub}
          ctaLabel={t.cta}
          image={{ src: "/laundry1.png", alt: "eChatbot AI assistant for laundry services" }}
          imageSide="right"
          buttonClassName="bg-green-600 hover:bg-green-700"
          note={t.ctaSub}
          demoTo="/demo/demowash"
          demoLabel={t.tryDemo}
        />

        {/* Problems → Solutions */}
        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader title={t.problemsTitle} className="mb-12" titleClassName="text-3xl" />
            <div className="space-y-6">
              {t.problems.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.07 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start rounded-2xl border border-white/10 shadow-2xl bg-slate-900/50 backdrop-blur p-6"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex-shrink-0 w-14 h-14 rounded-full bg-green-400/10 text-green-300 font-extrabold text-2xl flex items-center justify-center">{item.num}</span>
                    <p className="text-base font-medium text-slate-100">{item.problem}</p>
                  </div>
                  <div className="flex items-start gap-3 md:border-l md:border-white/10 md:pl-6">
                    <ArrowRight className="hidden md:block w-6 h-6 text-[#25D366] mt-0.5 shrink-0" />
                    <CheckCircle className="w-5 h-5 text-[#25D366] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-white mb-1">{item.solutionTitle}</p>
                      <p className="text-sm text-slate-400">{item.solutionDesc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 to-green-700 text-white px-8 py-10 text-center shadow-xl shadow-green-600/20">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="relative">
                <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <p className="text-xl lg:text-2xl font-bold max-w-2xl mx-auto leading-snug">{t.tagline}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Data & Security */}
        <section className="py-16 lg:py-24 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-12">{t.securityTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {t.securityItems.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className="bg-slate-900/50 backdrop-blur rounded-2xl p-6 border border-white/10 shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {securityIcon(item.icon)}
                    <h3 className="font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 to-green-700 text-white px-8 py-10 text-center shadow-xl shadow-green-600/20">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="relative">
                <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <p className="text-xl lg:text-2xl font-bold max-w-2xl mx-auto leading-snug">{t.securityTagline}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Translation feature */}
        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  {t.translationTitle.split(" ").slice(0, -2).join(" ")}{" "}
                  <span className="text-[#25D366]">{t.translationTitle.split(" ").slice(-2).join(" ")}</span>
                </h2>
                <p className="text-slate-400 leading-relaxed">{t.translationDesc}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 text-sm shadow-xl">
                <div className="flex items-center gap-2 mb-4 text-xs text-amber-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                  Manual Operator Control
                </div>
                <div className="space-y-3">
                  <div className="bg-green-50 rounded-xl p-3 ml-4">
                    <p className="text-right text-xs text-gray-500 mb-1">AR → ES</p>
                    <p className="text-right text-gray-900">ما رقم الغسالة التي لا تعمل؟</p>
                    <p className="text-right text-xs text-gray-500 mt-1">¿Cuál es el número de la lavadora que no funciona?</p>
                  </div>
                  <div className="bg-gray-100 rounded-xl p-3 mr-4">
                    <p className="text-xs text-green-700 font-medium mb-1">OPERATOR</p>
                    <p className="text-xs text-gray-700">Hola, soy Ana, la operadora. Hemos tenido un problema técnico y he reiniciado el sistema. ¿Puedes intentarlo de nuevo, por favor?</p>
                    <p className="text-xs text-gray-400 mt-1 italic">(AI translation)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Acts and sells */}
        <section className="py-16 lg:py-24 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4 text-sm">
                <div className="bg-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="bg-gray-200 rounded-full w-8 h-8 shrink-0"></div>
                    <div className="bg-white rounded-xl p-3 text-xs text-gray-700 max-w-xs shadow-sm">
                      La lavadora no se abre y dentro tiene mi ropa.
                    </div>
                  </div>
                  <div className="flex gap-3 flex-row-reverse">
                    <div className="bg-green-500 rounded-full w-8 h-8 shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
                    <div className="bg-green-50 rounded-xl p-3 text-xs text-gray-700 max-w-xs shadow-sm space-y-1">
                      <p>Entendido. Estoy revisando la lavadora 4.</p>
                      <p className="text-green-700 font-medium">¡Buenas noticias! La lavadora 4 ya se ha desbloqueado correctamente.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 flex-row-reverse">
                    <div className="bg-green-500 rounded-full w-8 h-8 shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-gray-700 max-w-xs shadow-sm">
                      <p className="font-bold text-yellow-700 mb-1">¡NOVEDAD PARA TI!</p>
                      <p>Descubre nuestra tarjeta de fidelización y disfruta de beneficios exclusivos.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  {t.actsTitle.split(":")[0]}:{" "}
                  <span className="text-[#25D366]">{t.actsTitle.split(":")[1]}</span>
                </h2>
                <p className="text-slate-400 leading-relaxed">{t.actsDesc}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Campaigns */}
        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  {t.campaignsTitle.split(" ").slice(0, -2).join(" ")}{" "}
                  <span className="text-[#25D366]">{t.campaignsTitle.split(" ").slice(-2).join(" ")}</span>
                </h2>
                <p className="text-slate-400 leading-relaxed">{t.campaignsDesc}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-6 shadow-xl border border-gray-100">
                <div className="bg-white rounded-xl p-4 flex items-start gap-3 shadow-sm">
                  <div className="bg-green-500 rounded-xl w-10 h-10 shrink-0 flex items-center justify-center text-white font-bold text-xs">WA</div>
                  <div>
                    <p className="text-gray-900 text-xs font-semibold mb-1">John · DemoWash Bot</p>
                    <p className="text-gray-600 text-xs">¡Haz que cada lavado cuente! Consigue nuestra tarjeta de fidelización y disfruta de descuentos exclusivos, regalos y más ventajas.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CtaSection
          title={t.ctaTitle}
          subtitle={t.ctaDesc}
          ctaLabel={t.cta}
          gradientClassName="from-green-600 to-green-700"
          buttonClassName="text-green-700"
        />
      </main>

      <SiteFooter language={language} />
    </>
  )
}
