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
  de: {
    seoTitle: "Smart Push AI - Intelligente WhatsApp-Kampagnen, die deine Conversions steigern",
    seoDesc: "Die KI gleicht die Bedürfnisse jedes Kunden mit den verfügbaren Angeboten ab und entscheidet, was wann gesendet wird. Gezielte WhatsApp-Nachrichten, intelligenter Anti-Spam, mehr Conversions und weniger Abmeldungen.",
    seoKeys: "whatsapp push ki, whatsapp kampagnen, gezielte whatsapp nachrichten, whatsapp marketing automation, smart push, ki kundensegmentierung, whatsapp anti-spam",
    breadcrumb: "Smart Push AI",
    badge: "Smart Push AI",
    heroTitle: "Verkaufe mehr.\nOhne wie Spam zu wirken.",
    heroSub: "Einheitsnachrichten für alle langweilen und führen zu Abmeldungen. Unsere KI macht das Gegenteil: Sie studiert jeden Kunden, wählt das Angebot, das er wirklich will, und sendet es genau im richtigen Moment, in dem er bereit ist zu kaufen. Eine Nachricht, ein Verkauf — niemals eine Belästigung.",
    cta: "Kontaktiere uns",
    ctaSub: "Unverbindlich, wir melden uns in Kürze",
    ctaTitle: "Bereit, jede Nachricht rentabel zu machen?",
    howTitle: "So macht sie aus Angeboten Verkäufe",
    howSub: "Vier automatische Schritte, vom Verstehen des Kunden bis zum Klick auf \"Kaufen\".",
    steps: [
      { icon: "🧠", title: "Sie weiß, mit wem sie spricht", desc: "Sie liest Kaufhistorie, angesehene Produkte und Gespräche, um zu wissen, was jeder Kunde wirklich will. Schluss mit zufällig verschickten Angeboten." },
      { icon: "🎯", title: "Sie wählt das Angebot, das konvertiert", desc: "Sie gleicht jedes Profil mit deinem Katalog ab und schlägt nur vor, was eine echte Verkaufschance hat. Null Streuverlust, null Nachrichten am Ziel vorbei." },
      { icon: "⏰", title: "Sie wartet auf den perfekten Moment", desc: "Sie sendet, wenn der Kunde aktiv und empfänglich ist, nicht wann es dir gerade passt. Das richtige Timing kann deine Antworten verdoppeln." },
      { icon: "🚫", title: "Sie schützt deinen Ruf", desc: "Sie begrenzt Frequenz und Volumen pro Kunde: Wer gerade eine Nachricht bekommen hat, wird in Ruhe gelassen. Dein WhatsApp bleibt ein Kanal, den die Leute lesen wollen." },
    ],
    featuresTitle: "Du hast das Sagen, die KI macht die Arbeit",
    featuresDesc: "Du legst das Ziel fest, die KI kümmert sich um den Rest. Du entscheidest, wie viel Freiheit du ihr gibst: von einem Vorschlag, den du mit einem Tipp freigibst, bis zum vollen Autopiloten. Alles getrackt, alles unter Kontrolle.",
    features: [
      "Automatische Segmentierung: jeder Kunde in der richtigen Gruppe, ohne Excel-Tabellen",
      "Die KI schlägt vor, was du wem schreiben sollst — du gibst frei und los geht's",
      "Anti-Spam-Frequenzlimit: nie wieder genervte Kunden",
      "Gesendet zu der Uhrzeit, zu der jeder WhatsApp wirklich öffnet",
      "Du entscheidest: ein Vorschlag zum Freigeben oder voller Autopilot",
      "Öffnungen, Antworten und Verkäufe in Echtzeit gemessen",
    ],
    metricsTitle: "Die Zahlen sprechen für sich",
    metrics: [
      { value: "+35%", label: "Conversions", sub: "ggü. Einheitsnachrichten für alle" },
      { value: "-60%", label: "Abmeldungen", sub: "weil es nie wie Spam wirkt" },
      { value: "1:1", label: "Maßgeschneidert", sub: "ein anderes Angebot für jede Person" },
      { value: "0", label: "Spam", sub: "der automatische Stopp erledigt das für dich" },
    ],
    useCasesTitle: "Es funktioniert für dein Geschäft",
    useCases: [
      { icon: "🛍️", title: "E-Commerce & Shops", desc: "Hol dir Kunden zurück, die ihren Warenkorb verlassen haben, mit dem richtigen Angebot zum bereits angesehenen Produkt. Ohne die zu stören, die gerade bestellt haben." },
      { icon: "🍽️", title: "Restaurants & Food", desc: "Das Tagesmenü erreicht genau die, die zu dieser Uhrzeit Hunger haben. Mehr Gäste, mehr Bestellungen, null ignorierte Nachrichten." },
      { icon: "💇", title: "Dienstleistungen & Salons", desc: "\"Zeit für deinen nächsten Termin\": die richtige Erinnerung an den richtigen Kunden, abgestimmt darauf, wie oft er deinen Service nutzt." },
      { icon: "🎟️", title: "Events & Mitgliedschaften", desc: "Verlängerungen und Last-Minute-Plätze nur denen angeboten, die wirklich interessiert sind, genau im Moment, in dem sie Ja sagen." },
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
        <LandingHero
          breadcrumb={t.breadcrumb}
          badge={t.badge}
          title={t.heroTitle}
          subtitle={t.heroSub}
          ctaLabel={t.cta}
          image={{ src: "/push1.png", alt: "Smart AI push messaging on WhatsApp" }}
        />

        <MetricsSection title={t.metricsTitle} metrics={t.metrics} />

        {/* How it Works */}
        <section className="py-20 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <SectionHeader title={t.howTitle} subtitle={t.howSub} />
            <StepCardGrid steps={t.steps} />
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
