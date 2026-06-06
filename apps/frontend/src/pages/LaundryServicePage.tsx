import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, ShieldCheck, Server, Puzzle, Users, CheckCircle } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Chatbot WhatsApp per Lavanderie e Franchising - eChatbot",
    seoDesc: "eChatbot è la soluzione AI su misura per lavanderie e franchising: supporto 24/7, traduzione in tempo reale, integrazione con le macchine e campagne di marketing su WhatsApp.",
    seoKeys: "chatbot lavanderia, whatsapp lavanderia, assistente ia lavanderia, supporto clienti lavanderia, franchising lavanderia ai",
    breadcrumb: "Lavanderie e Franchising",
    badge: "Per Franchising",
    heroTitle: "I tuoi clienti chiamano a tutte le ore.\nChi risponde?",
    heroSub: "Abbiamo identificato alcuni dettagli che potrebbero cambiare il tuo business.",
    cta: "Parliamone",
    ctaSub: "Nessun impegno",
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
    heroTitle: "Your customers call at all hours.\nWho answers? Who unblocks the machine?",
    heroSub: "We've identified some details that could turn your business around.",
    cta: "Let's Talk",
    ctaSub: "No commitment",
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
    heroTitle: "Tus clientes llaman a todas horas.\n¿Y quién responde? ¿Y quién desbloquea la máquina?",
    heroSub: "Hemos identificado algunos detalles que podrían dar una vuelta a tu negocio.",
    cta: "¿Lo hablamos?",
    ctaSub: "Sin compromiso",
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
  pt: {
    seoTitle: "Chatbot WhatsApp para Lavanderias e Franquias - eChatbot",
    seoDesc: "eChatbot é a solução de IA personalizada para lavanderias e franquias: suporte 24/7, tradução em tempo real, integração com máquinas e campanhas de marketing pelo WhatsApp.",
    seoKeys: "chatbot lavanderia, whatsapp lavanderia, assistente ia lavanderia, atendimento lavanderia, franquia lavanderia ia",
    breadcrumb: "Lavanderias e Franquias",
    badge: "Para Franquias",
    heroTitle: "Os seus clientes ligam a todas as horas.\nQuem responde? Quem desbloqueia a máquina?",
    heroSub: "Identificámos alguns detalhes que podem mudar o seu negócio.",
    cta: "Vamos conversar",
    ctaSub: "Sem compromisso",
    problemsTitle: "Os seus problemas, as nossas soluções",
    problems: [
      {
        num: "1",
        problem: "Dúvidas, incidentes e reclamações chegam a qualquer hora e ficam sem resposta?",
        solutionTitle: "Suporte 24/7",
        solutionDesc: "O assistente responde sozinho à maioria dos casos no WhatsApp. O operador intervém apenas quando necessário, com um resumo já preparado: sede, máquina e incidente.",
      },
      {
        num: "2",
        problem: "Clientes estrangeiros que não entendem as instruções nem sabem como pedir ajuda?",
        solutionTitle: "Tradução em tempo real",
        solutionDesc: "O cliente escreve no seu idioma, você responde no seu. A conversa é traduzida em ambas as direções, instantaneamente. Zero barreiras.",
      },
      {
        num: "3",
        problem: "Sem forma de contactar os seus clientes para lhes oferecer uma promoção?",
        solutionTitle: "Campanhas e avisos pelo WhatsApp",
        solutionDesc: "Envie ofertas e lembretes por sede diretamente para o telemóvel do cliente. O mesmo canal de suporte torna-se um canal que gera vendas.",
      },
      {
        num: "4",
        problem: "Cada sede tem os seus próprios preços e horários e a gestão torna-se complicada?",
        solutionTitle: "Respostas personalizadas",
        solutionDesc: "A IA identifica de qual sede o cliente está a escrever e responde com os dados corretos: preços, horários e informações desse local.",
      },
      {
        num: "5",
        problem: "Demasiadas coisas para orquestrar ao mesmo tempo: responder, traduzir, faturar, avisar…?",
        solutionTitle: "Uma IA que orquestra tudo",
        solutionDesc: "Não é apenas um chatbot: é uma IA feita à medida que responde, envia faturas, áudios e vídeos, traduz, escala para um operador e, acima de tudo, conecta-se às suas máquinas.",
      },
    ],
    tagline: "Uma única solução: menos trabalho, clientes atendidos, mais vendas.",
    securityTitle: "Os seus dados, sob o seu controlo.",
    securityItems: [
      { icon: "shield", title: "Segurança dos dados", desc: "A IA dialoga de forma natural, mas não está sempre ativa. Quando há que recolher dados pessoais do cliente, o sistema passa automaticamente do modo IA para um fluxo controlado. As informações pessoais nunca são enviadas a serviços de IA externos." },
      { icon: "server", title: "On-premise: tudo em sua casa", desc: "O sistema é instalado nos seus servidores. Todo o software corre dentro da empresa, que mantém o controlo total das conversas e da informação, sem que os dados passem por terceiros." },
      { icon: "puzzle", title: "Expansível às suas necessidades", desc: "As funcionalidades crescem consigo: novas integrações, ligação aos seus sistemas e funções autónomas, conforme o que o seu negócio precisar em cada momento." },
      { icon: "users", title: "Um projeto que construímos juntos", desc: "Não se adaptam a um produto rígido: construímos o sistema em torno da sua realidade. Treinamos a IA com os seus casos reais e afinamo-la ao longo do tempo." },
    ],
    securityTagline: "Feito à sua medida. Seguro, seu, e pensado para o seu negócio.",
    translationTitle: "Sem barreiras de idioma.",
    translationDesc: "O cliente escreve em árabe, o operador trabalha em português. Cada mensagem é traduzida em ambas as direções, em tempo real — uma conversa natural mesmo que falem idiomas diferentes.",
    actsTitle: "Não só responde: age e vende.",
    actsDesc: "O cliente avisa que a máquina de lavar não abre. A IA liga-se à máquina, desbloqueia-a e confirma. E na mesma conversa, apresenta o cartão de fidelidade.",
    campaignsTitle: "Converta avisos em vendas.",
    campaignsDesc: "Com um clique envia uma campanha a todos os seus clientes pelo WhatsApp: uma promoção para as horas calmas, uma novidade ou o cartão de fidelidade. O canal de suporte torna-se a sua melhor ferramenta de marketing.",
    ctaTitle: "Vamos conversar?",
    ctaDesc: "Descubra como o eChatbot pode transformar a sua franquia de lavanderias.",
  },
}

const securityIcon = (key: string) => {
  if (key === "shield") return <ShieldCheck className="w-6 h-6 text-green-600" />
  if (key === "server") return <Server className="w-6 h-6 text-green-600" />
  if (key === "puzzle") return <Puzzle className="w-6 h-6 text-green-600" />
  return <Users className="w-6 h-6 text-green-600" />
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

      <main>
        {/* Hero */}
        <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-green-50 via-white to-green-50 overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} />
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* Left: text */}
              <div>
                <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-6">
                  {t.badge}
                </span>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-4xl lg:text-5xl font-bold leading-tight mb-6 whitespace-pre-line text-slate-900"
                >
                  {t.heroTitle}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-lg text-slate-600 mb-8 max-w-xl"
                >
                  {t.heroSub}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex flex-col sm:flex-row gap-4"
                >
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl transition-colors"
                  >
                    {t.cta} <ArrowRight className="w-5 h-5" />
                  </Link>
                  <p className="self-center text-sm text-slate-500">{t.ctaSub}</p>
                </motion.div>
              </div>
              {/* Right: illustration */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="hidden lg:block"
              >
                <img
                  src="/laundry1.png"
                  alt="eChatbot AI assistant for laundry services"
                  className="w-full h-auto rounded-3xl shadow-2xl border border-gray-100"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Problems → Solutions */}
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">{t.problemsTitle}</h2>
            <div className="space-y-6">
              {t.problems.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.07 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start rounded-2xl border border-gray-100 shadow-sm bg-white p-6"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center">{item.num}</span>
                    <p className="text-base font-medium text-gray-800">{item.problem}</p>
                  </div>
                  <div className="flex items-start gap-3 md:border-l md:border-gray-100 md:pl-6">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-gray-900 mb-1">{item.solutionTitle}</p>
                      <p className="text-sm text-gray-600">{item.solutionDesc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-10 bg-green-600 text-white rounded-2xl px-8 py-5 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <p className="font-semibold">{t.tagline}</p>
            </div>
          </div>
        </section>

        {/* Data & Security */}
        <section className="py-16 lg:py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-12">{t.securityTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {t.securityItems.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {securityIcon(item.icon)}
                    <h3 className="font-bold text-gray-900">{item.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-10 bg-green-600 text-white rounded-2xl px-8 py-5 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <p className="font-semibold">{t.securityTagline}</p>
            </div>
          </div>
        </section>

        {/* Translation feature */}
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {t.translationTitle.split(" ").slice(0, -2).join(" ")}{" "}
                  <span className="text-green-600">{t.translationTitle.split(" ").slice(-2).join(" ")}</span>
                </h2>
                <p className="text-gray-600 leading-relaxed">{t.translationDesc}</p>
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
        <section className="py-16 lg:py-24 bg-gray-50">
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
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {t.actsTitle.split(":")[0]}:{" "}
                  <span className="text-green-600">{t.actsTitle.split(":")[1]}</span>
                </h2>
                <p className="text-gray-600 leading-relaxed">{t.actsDesc}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Campaigns */}
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {t.campaignsTitle.split(" ").slice(0, -2).join(" ")}{" "}
                  <span className="text-green-600">{t.campaignsTitle.split(" ").slice(-2).join(" ")}</span>
                </h2>
                <p className="text-gray-600 leading-relaxed">{t.campaignsDesc}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-6 shadow-xl border border-gray-100">
                <div className="bg-white rounded-xl p-4 flex items-start gap-3 shadow-sm">
                  <div className="bg-green-500 rounded-xl w-10 h-10 shrink-0 flex items-center justify-center text-white font-bold text-xs">WA</div>
                  <div>
                    <p className="text-gray-900 text-xs font-semibold mb-1">John · EcoWash Bot</p>
                    <p className="text-gray-600 text-xs">¡Haz que cada lavado cuente! Consigue nuestra tarjeta de fidelización y disfruta de descuentos exclusivos, regalos y más ventajas.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 lg:py-24 bg-gradient-to-br from-green-600 to-green-700 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold mb-4">{t.ctaTitle}</h2>
            <p className="text-green-100 text-lg mb-8">{t.ctaDesc}</p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-green-700 font-bold px-10 py-4 rounded-xl transition-colors text-lg"
            >
              {t.cta} <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </>
  )
}
