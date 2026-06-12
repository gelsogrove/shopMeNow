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
    seoTitle: "Smart Push AI - Campagne WhatsApp Intelligenti che Aumentano le Conversioni",
    seoDesc: "L'AI incrocia le esigenze di ogni cliente con le offerte disponibili e decide cosa inviare e quando. Messaggi mirati su WhatsApp, anti-spam intelligente, più conversioni e meno disiscrizioni.",
    seoKeys: "push whatsapp ai, campagne whatsapp, messaggi mirati whatsapp, marketing automation whatsapp, smart push, segmentazione clienti ai, anti-spam whatsapp",
    breadcrumb: "Smart Push AI",
    badge: "Smart Push AI",
    heroTitle: "Vendi di più.\nSenza sembrare spam.",
    heroSub: "Le offerte uguali per tutti annoiano e fanno disiscrivere. La nostra AI fa l'opposto: studia ogni cliente, sceglie l'offerta che desidera davvero e gliela manda nel momento esatto in cui è pronto a comprare. Un messaggio, una vendita — mai un fastidio.",
    cta: "Contattaci",
    ctaSub: "Nessun impegno, ti rispondiamo a breve",
    ctaTitle: "Pronto a far rendere ogni messaggio?",
    howTitle: "Come trasforma le offerte in vendite",
    howSub: "Quattro passi automatici, dal capire il cliente al click su \"compra\".",
    steps: [
      { icon: "🧠", title: "Capisce chi hai davanti", desc: "Legge cronologia acquisti, prodotti visti e conversazioni per sapere cosa desidera davvero ogni cliente. Basta offerte sparate a caso." },
      { icon: "🎯", title: "Sceglie l'offerta che converte", desc: "Incrocia ogni profilo con il tuo catalogo e propone solo ciò che ha reali probabilità di vendere. Zero sprechi, zero messaggi fuori target." },
      { icon: "⏰", title: "Aspetta il momento perfetto", desc: "Invia quando il cliente è attivo e ricettivo, non quando capita. Il timing giusto può raddoppiare le risposte." },
      { icon: "🚫", title: "Protegge la tua reputazione", desc: "Limita frequenza e volume per cliente: chi ha appena ricevuto un messaggio viene lasciato in pace. Il tuo WhatsApp resta un canale che la gente vuole leggere." },
    ],
    featuresTitle: "Tu comandi, l'AI fa il lavoro",
    featuresDesc: "Imposti l'obiettivo, ci pensa l'AI. Scegli quanta libertà darle: dalla proposta che approvi con un tap al pilota automatico completo. Tutto tracciato, tutto sotto controllo.",
    features: [
      "Segmentazione automatica: ogni cliente nel gruppo giusto, senza fogli Excel",
      "L'AI ti suggerisce cosa scrivere a chi — tu approvi e parti",
      "Cap di frequenza anti-spam: mai più clienti infastiditi",
      "Invio all'orario in cui ognuno apre davvero WhatsApp",
      "Decidi tu: proposta da approvare o pilota automatico",
      "Aperture, risposte e vendite tracciate in tempo reale",
    ],
    metricsTitle: "I numeri parlano chiaro",
    metrics: [
      { value: "+35%", label: "Conversioni", sub: "vs. invii uguali per tutti" },
      { value: "-60%", label: "Disiscrizioni", sub: "perché non sembra mai spam" },
      { value: "1:1", label: "Su misura", sub: "un'offerta diversa per ogni persona" },
      { value: "0", label: "Spam", sub: "lo stop automatico ci pensa per te" },
    ],
    useCasesTitle: "Funziona per il tuo business",
    useCases: [
      { icon: "🛍️", title: "E-commerce e negozi", desc: "Riporti a comprare chi ha lasciato il carrello, con l'offerta giusta sul prodotto che ha già guardato. Senza disturbare chi ha appena ordinato." },
      { icon: "🍽️", title: "Ristoranti e food", desc: "Il menù del giorno arriva a chi ha fame proprio a quell'ora. Più coperti, più ordini, zero messaggi ignorati." },
      { icon: "💇", title: "Servizi e saloni", desc: "\"È ora di tornare\": il promemoria giusto al cliente giusto, calibrato su quanto spesso usa il tuo servizio." },
      { icon: "🎟️", title: "Eventi e abbonamenti", desc: "Rinnovi e posti last-minute proposti solo a chi è davvero interessato, nel momento in cui è pronto a dire sì." },
    ],
  },
  en: {
    seoTitle: "Smart Push AI - Intelligent WhatsApp Campaigns that Boost Conversions",
    seoDesc: "AI matches each customer's needs with available offers and decides what to send and when. Targeted WhatsApp messages, smart anti-spam, more conversions and fewer opt-outs.",
    seoKeys: "whatsapp push ai, whatsapp campaigns, targeted whatsapp messages, whatsapp marketing automation, smart push, ai customer segmentation, whatsapp anti-spam",
    breadcrumb: "Smart Push AI",
    badge: "Smart Push AI",
    heroTitle: "Sell more.\nWithout sounding like spam.",
    heroSub: "One-size-fits-all blasts bore people and trigger opt-outs. Our AI does the opposite: it studies each customer, picks the offer they actually want, and sends it the exact moment they're ready to buy. One message, one sale — never an annoyance.",
    cta: "Contact Us",
    ctaSub: "No commitment — we will get back to you shortly",
    ctaTitle: "Ready to make every message pay off?",
    howTitle: "How it turns offers into sales",
    howSub: "Four automatic steps, from understanding the customer to the \"buy\" click.",
    steps: [
      { icon: "🧠", title: "It knows who you're talking to", desc: "It reads purchase history, viewed products, and conversations to know what each customer truly wants. No more offers fired at random." },
      { icon: "🎯", title: "It picks the offer that converts", desc: "It cross-references every profile with your catalog and proposes only what has a real chance to sell. Zero waste, zero off-target messages." },
      { icon: "⏰", title: "It waits for the perfect moment", desc: "It sends when the customer is active and receptive, not whenever is convenient for you. The right timing can double your replies." },
      { icon: "🚫", title: "It protects your reputation", desc: "It caps frequency and volume per customer: anyone who just got a message is left alone. Your WhatsApp stays a channel people want to read." },
    ],
    featuresTitle: "You're in charge, the AI does the work",
    featuresDesc: "Set the goal, the AI handles the rest. You choose how much freedom to give it: from a proposal you approve with one tap to full autopilot. All tracked, all under control.",
    features: [
      "Automatic segmentation: every customer in the right group, no spreadsheets",
      "The AI suggests what to write to whom — you approve and go",
      "Anti-spam frequency cap: never annoy a customer again",
      "Sent at the hour each person actually opens WhatsApp",
      "Your call: a proposal to approve, or full autopilot",
      "Opens, replies, and sales tracked in real time",
    ],
    metricsTitle: "The numbers speak for themselves",
    metrics: [
      { value: "+35%", label: "Conversions", sub: "vs. one-size-fits-all blasts" },
      { value: "-60%", label: "Opt-outs", sub: "because it never feels like spam" },
      { value: "1:1", label: "Tailored", sub: "a different offer for every person" },
      { value: "0", label: "Spam", sub: "the automatic stop handles it for you" },
    ],
    useCasesTitle: "It works for your business",
    useCases: [
      { icon: "🛍️", title: "E-commerce & shops", desc: "Win back customers who left their cart, with the right offer on the product they already viewed. Without bothering those who just ordered." },
      { icon: "🍽️", title: "Restaurants & food", desc: "The daily menu reaches whoever is hungry at that exact hour. More covers, more orders, zero ignored messages." },
      { icon: "💇", title: "Services & salons", desc: "\"Time to come back\": the right reminder to the right customer, tuned to how often they use your service." },
      { icon: "🎟️", title: "Events & memberships", desc: "Renewals and last-minute spots offered only to those genuinely interested, the moment they're ready to say yes." },
    ],
  },
  es: {
    seoTitle: "Smart Push AI - Campañas de WhatsApp Inteligentes que Aumentan las Conversiones",
    seoDesc: "La IA cruza las necesidades de cada cliente con las ofertas disponibles y decide qué enviar y cuándo. Mensajes dirigidos en WhatsApp, anti-spam inteligente, más conversiones y menos bajas.",
    seoKeys: "push whatsapp ia, campañas whatsapp, mensajes dirigidos whatsapp, automatización marketing whatsapp, smart push, segmentación clientes ia, anti-spam whatsapp",
    breadcrumb: "Smart Push AI",
    badge: "Smart Push AI",
    heroTitle: "Vende más.\nSin parecer spam.",
    heroSub: "Los envíos iguales para todos aburren y provocan bajas. Nuestra IA hace lo contrario: estudia a cada cliente, elige la oferta que de verdad quiere y se la envía en el momento exacto en que está listo para comprar. Un mensaje, una venta — nunca una molestia.",
    cta: "Contáctanos",
    ctaSub: "Sin compromiso, te respondemos pronto",
    ctaTitle: "¿Listo para que cada mensaje rinda?",
    howTitle: "Cómo convierte tus ofertas en ventas",
    howSub: "Cuatro pasos automáticos, de entender al cliente al clic en \"comprar\".",
    steps: [
      { icon: "🧠", title: "Sabe con quién habla", desc: "Lee el historial de compras, productos vistos y conversaciones para saber qué desea de verdad cada cliente. Se acabaron las ofertas al azar." },
      { icon: "🎯", title: "Elige la oferta que convierte", desc: "Cruza cada perfil con tu catálogo y propone solo lo que tiene probabilidad real de vender. Cero desperdicio, cero mensajes fuera de objetivo." },
      { icon: "⏰", title: "Espera el momento perfecto", desc: "Envía cuando el cliente está activo y receptivo, no cuando a ti te conviene. El timing correcto puede duplicar las respuestas." },
      { icon: "🚫", title: "Protege tu reputación", desc: "Limita frecuencia y volumen por cliente: a quien acaba de recibir un mensaje se le deja en paz. Tu WhatsApp sigue siendo un canal que la gente quiere leer." },
    ],
    featuresTitle: "Tú mandas, la IA trabaja",
    featuresDesc: "Defines el objetivo y la IA se encarga del resto. Tú eliges cuánta libertad darle: desde una propuesta que apruebas con un toque hasta el piloto automático total. Todo registrado, todo bajo control.",
    features: [
      "Segmentación automática: cada cliente en el grupo correcto, sin hojas de Excel",
      "La IA te sugiere qué escribir a quién — tú apruebas y arranca",
      "Límite de frecuencia anti-spam: nunca más clientes molestos",
      "Enviado a la hora en que cada uno abre de verdad WhatsApp",
      "Tú decides: una propuesta para aprobar o piloto automático",
      "Aperturas, respuestas y ventas medidas en tiempo real",
    ],
    metricsTitle: "Los números hablan claro",
    metrics: [
      { value: "+35%", label: "Conversiones", sub: "frente a envíos iguales para todos" },
      { value: "-60%", label: "Bajas", sub: "porque nunca parece spam" },
      { value: "1:1", label: "A medida", sub: "una oferta distinta para cada persona" },
      { value: "0", label: "Spam", sub: "el freno automático lo hace por ti" },
    ],
    useCasesTitle: "Funciona para tu negocio",
    useCases: [
      { icon: "🛍️", title: "E-commerce y tiendas", desc: "Recupera a quien dejó el carrito, con la oferta correcta sobre el producto que ya miró. Sin molestar a quien acaba de comprar." },
      { icon: "🍽️", title: "Restaurantes y food", desc: "El menú del día llega a quien tiene hambre justo a esa hora. Más mesas, más pedidos, cero mensajes ignorados." },
      { icon: "💇", title: "Servicios y salones", desc: "\"Es hora de volver\": el recordatorio correcto al cliente correcto, ajustado a cuánto usa tu servicio." },
      { icon: "🎟️", title: "Eventos y membresías", desc: "Renovaciones y plazas de última hora ofrecidas solo a quien está realmente interesado, en el momento en que dice sí." },
    ],
  },
  pt: {
    seoTitle: "Smart Push AI - Campanhas de WhatsApp Inteligentes que Aumentam as Conversões",
    seoDesc: "A IA cruza as necessidades de cada cliente com as ofertas disponíveis e decide o que enviar e quando. Mensagens direcionadas no WhatsApp, anti-spam inteligente, mais conversões e menos cancelamentos.",
    seoKeys: "push whatsapp ia, campanhas whatsapp, mensagens direcionadas whatsapp, automação marketing whatsapp, smart push, segmentação clientes ia, anti-spam whatsapp",
    breadcrumb: "Smart Push AI",
    badge: "Smart Push AI",
    heroTitle: "Venda mais.\nSem parecer spam.",
    heroSub: "Os envios iguais para todos aborrecem e geram cancelamentos. A nossa IA faz o contrário: estuda cada cliente, escolhe a oferta que ele realmente quer e envia no momento exato em que está pronto para comprar. Uma mensagem, uma venda — nunca um incómodo.",
    cta: "Fale Connosco",
    ctaSub: "Sem compromisso, respondemos em breve",
    ctaTitle: "Pronto para fazer cada mensagem render?",
    howTitle: "Como transforma ofertas em vendas",
    howSub: "Quatro passos automáticos, de entender o cliente ao clique em \"comprar\".",
    steps: [
      { icon: "🧠", title: "Sabe com quem está a falar", desc: "Lê o histórico de compras, produtos vistos e conversas para saber o que cada cliente realmente quer. Acabaram-se as ofertas ao acaso." },
      { icon: "🎯", title: "Escolhe a oferta que converte", desc: "Cruza cada perfil com o seu catálogo e propõe apenas o que tem real probabilidade de vender. Zero desperdício, zero mensagens fora do alvo." },
      { icon: "⏰", title: "Espera o momento perfeito", desc: "Envia quando o cliente está ativo e recetivo, não quando lhe dá jeito. O timing certo pode duplicar as respostas." },
      { icon: "🚫", title: "Protege a sua reputação", desc: "Limita frequência e volume por cliente: quem acabou de receber uma mensagem é deixado em paz. O seu WhatsApp continua a ser um canal que as pessoas querem ler." },
    ],
    featuresTitle: "Você manda, a IA trabalha",
    featuresDesc: "Define o objetivo e a IA trata do resto. Você decide quanta liberdade dar: de uma proposta que aprova com um toque ao piloto automático total. Tudo registado, tudo sob controlo.",
    features: [
      "Segmentação automática: cada cliente no grupo certo, sem folhas de Excel",
      "A IA sugere o que escrever a quem — você aprova e avança",
      "Limite de frequência anti-spam: nunca mais clientes incomodados",
      "Enviado à hora em que cada um abre mesmo o WhatsApp",
      "Você decide: uma proposta para aprovar ou piloto automático",
      "Aberturas, respostas e vendas medidas em tempo real",
    ],
    metricsTitle: "Os números falam por si",
    metrics: [
      { value: "+35%", label: "Conversões", sub: "vs. envios iguais para todos" },
      { value: "-60%", label: "Cancelamentos", sub: "porque nunca parece spam" },
      { value: "1:1", label: "À medida", sub: "uma oferta diferente para cada pessoa" },
      { value: "0", label: "Spam", sub: "o travão automático trata disso por si" },
    ],
    useCasesTitle: "Funciona para o seu negócio",
    useCases: [
      { icon: "🛍️", title: "E-commerce e lojas", desc: "Recupere quem deixou o carrinho, com a oferta certa sobre o produto que já viu. Sem incomodar quem acabou de comprar." },
      { icon: "🍽️", title: "Restaurantes e food", desc: "O menu do dia chega a quem tem fome exatamente àquela hora. Mais mesas, mais pedidos, zero mensagens ignoradas." },
      { icon: "💇", title: "Serviços e salões", desc: "\"Está na hora de voltar\": o lembrete certo ao cliente certo, ajustado à frequência com que usa o seu serviço." },
      { icon: "🎟️", title: "Eventos e assinaturas", desc: "Renovações e lugares de última hora oferecidos apenas a quem está realmente interessado, no momento em que diz sim." },
    ],
  },
}

export function SmartPushAiPage() {
  const { language } = useLanguage()
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-200">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/smart-push-ai" lang={language} serviceType="WhatsApp Smart Push Campaigns" />
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
                  src="/push1.png"
                  alt="Smart AI push messaging on WhatsApp"
                  className="relative w-full h-auto rounded-3xl shadow-2xl border border-white/10 object-contain"
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

        {/* Features Section */}
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
                  {/* Image */}
                  <div className="relative order-2 lg:order-1">
                    <div className="absolute -inset-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl blur-xl opacity-40" />
                    <img src="/survey-push.png" alt="Smart push campaigns dashboard" className="relative w-full h-auto rounded-2xl shadow-xl border border-white/10 object-contain" />
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
