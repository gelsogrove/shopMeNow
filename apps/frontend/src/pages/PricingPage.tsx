import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap, HelpCircle, ChevronDown, ChevronUp } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { PricingPlans } from "@/components/landing/PricingPlans"

type Language = "it" | "en" | "es" | "pt"

type FAQ = { q: string; a: string }

const T: Record<Language, {
  seoTitle: string; seoDesc: string; seoKeys: string; breadcrumb: string
  badge: string; heroTitle: string; heroSub: string
  faqTitle: string; faqs: FAQ[]
  ctaTitle: string; ctaSub: string; cta: string
}> = {
  it: {
    seoTitle: "Prezzi e Piani - eChatbot WhatsApp E-Commerce Chatbot",
    seoDesc: "Scopri i piani eChatbot. Inizia gratis con il trial, poi scegli il piano adatto alla tua azienda. Prezzi trasparenti, senza costi nascosti, cancellazione in qualsiasi momento.",
    seoKeys: "prezzi chatbot whatsapp, piani echatbot, chatbot ecommerce prezzo, abbonamento chatbot whatsapp, costo chatbot intelligente",
    breadcrumb: "Prezzi",
    badge: "Pricing",
    heroTitle: "Piani semplici\nsenza sorprese",
    heroSub: "Inizia gratis con il trial. Scala quando vuoi. Prezzi trasparenti, senza setup fee, senza contratti annuali obbligatori.",
    faqTitle: "Domande Frequenti",
    faqs: [
      { q: "Posso cancellare in qualsiasi momento?", a: "Sì. Puoi cancellare il tuo piano in qualsiasi momento direttamente dal pannello eChatbot. Non ci sono penali o costi di uscita. L'account rimane attivo fino alla fine del periodo già pagato." },
      { q: "Il trial include tutte le funzionalità?", a: "Sì, il trial gratuito include accesso completo a tutte le funzionalità del piano scelto. Puoi testare chatbot AI, gestione ordini, analytics e integrazioni senza limite." },
      { q: "Come funziona la fatturazione?", a: "La fatturazione è mensile a partire dal credito disponibile nel tuo account. Puoi ricaricare il credito quando vuoi. Ricevi fattura elettronica per ogni addebito." },
      { q: "Posso passare a un piano superiore in corso d'opera?", a: "Sì, l'upgrade è immediato. La differenza viene calcolata pro-rata per il mese in corso, quindi paghi solo i giorni rimanenti al nuovo piano." },
      { q: "Quanti messaggi WhatsApp sono inclusi?", a: "Il numero di messaggi dipende dal piano scelto. Ogni piano include un costo per messaggio gestito dall'AI. Puoi monitorare il consumo in tempo reale dall'analytics dashboard." },
      { q: "Supportate più canali WhatsApp per workspace?", a: "Sì, puoi aggiungere più numeri WhatsApp Business API allo stesso workspace. Il costo aggiuntivo per canale è indicato nella pagina di configurazione canali." },
      { q: "I dati sono al sicuro? GDPR?", a: "Assolutamente sì. eChatbot è conforme GDPR, DSGVO e LGPD. I dati sono cifrati AES-256 at-rest e in transito con TLS 1.3. Zero-knowledge architecture. Vedi la pagina Privacy by Design per tutti i dettagli." },
      { q: "Cosa succede se supero i limiti del piano?", a: "Il sistema ti notifica quando sei vicino ai limiti. Puoi fare upgrade in qualsiasi momento o acquistare credito aggiuntivo. Non vengono mai bloccati i messaggi senza preavviso." },
    ],
    ctaTitle: "Inizia oggi, gratis",
    ctaSub: "Nessuna carta di credito richiesta per il trial.",
    cta: "Inizia il Trial Gratuito",
  },
  en: {
    seoTitle: "Pricing Plans - eChatbot WhatsApp E-Commerce Chatbot",
    seoDesc: "Discover eChatbot plans. Start free with a trial, then choose the plan that fits your business. Transparent pricing, no hidden fees, cancel anytime.",
    seoKeys: "whatsapp chatbot price, echatbot plans, ecommerce chatbot price, whatsapp chatbot subscription, intelligent chatbot cost",
    breadcrumb: "Pricing",
    badge: "Pricing",
    heroTitle: "Simple plans\nno surprises",
    heroSub: "Start free with a trial. Scale when you want. Transparent pricing, no setup fee, no mandatory annual contracts.",
    faqTitle: "Frequently Asked Questions",
    faqs: [
      { q: "Can I cancel at any time?", a: "Yes. You can cancel your plan at any time directly from the eChatbot panel. There are no penalties or exit costs. The account remains active until the end of the already paid period." },
      { q: "Does the trial include all features?", a: "Yes, the free trial includes full access to all features of the chosen plan. You can test AI chatbot, order management, analytics and integrations without any limit." },
      { q: "How does billing work?", a: "Billing is monthly starting from the available credit in your account. You can top up credit whenever you want. You receive an electronic invoice for each charge." },
      { q: "Can I upgrade mid-month?", a: "Yes, the upgrade is immediate. The difference is calculated pro-rata for the current month, so you only pay the remaining days at the new plan rate." },
      { q: "How many WhatsApp messages are included?", a: "The number of messages depends on the chosen plan. Each plan includes a per-message cost managed by AI. You can monitor consumption in real time from the analytics dashboard." },
      { q: "Do you support multiple WhatsApp channels per workspace?", a: "Yes, you can add multiple WhatsApp Business API numbers to the same workspace. The additional cost per channel is shown on the channel configuration page." },
      { q: "Is data secure? GDPR?", a: "Absolutely yes. eChatbot is GDPR, DSGVO and LGPD compliant. Data is encrypted AES-256 at-rest and in transit with TLS 1.3. Zero-knowledge architecture. See the Privacy by Design page for full details." },
      { q: "What happens if I exceed plan limits?", a: "The system notifies you when you're close to limits. You can upgrade at any time or purchase additional credit. Messages are never blocked without notice." },
    ],
    ctaTitle: "Start today, free",
    ctaSub: "No credit card required for the trial.",
    cta: "Start Free Trial",
  },
  es: {
    seoTitle: "Planes y Precios - eChatbot WhatsApp E-Commerce Chatbot",
    seoDesc: "Descubre los planes de eChatbot. Empieza gratis con el trial, luego elige el plan adecuado para tu empresa. Precios transparentes, sin costes ocultos, cancela en cualquier momento.",
    seoKeys: "precio chatbot whatsapp, planes echatbot, precio chatbot ecommerce, suscripción chatbot whatsapp, coste chatbot inteligente",
    breadcrumb: "Precios",
    badge: "Precios",
    heroTitle: "Planes simples\nsin sorpresas",
    heroSub: "Empieza gratis con el trial. Escala cuando quieras. Precios transparentes, sin cuota de configuración, sin contratos anuales obligatorios.",
    faqTitle: "Preguntas Frecuentes",
    faqs: [
      { q: "¿Puedo cancelar en cualquier momento?", a: "Sí. Puedes cancelar tu plan en cualquier momento directamente desde el panel de eChatbot. No hay penalizaciones ni costes de salida. La cuenta permanece activa hasta el final del período ya pagado." },
      { q: "¿El trial incluye todas las funcionalidades?", a: "Sí, el trial gratuito incluye acceso completo a todas las funcionalidades del plan elegido. Puedes probar el chatbot IA, gestión de pedidos, analytics e integraciones sin límite." },
      { q: "¿Cómo funciona la facturación?", a: "La facturación es mensual a partir del crédito disponible en tu cuenta. Puedes recargar crédito cuando quieras. Recibes factura electrónica por cada cargo." },
      { q: "¿Puedo pasar a un plan superior a mitad de período?", a: "Sí, el upgrade es inmediato. La diferencia se calcula de forma prorrateada para el mes en curso, por lo que solo pagas los días restantes al nuevo plan." },
      { q: "¿Cuántos mensajes de WhatsApp están incluidos?", a: "El número de mensajes depende del plan elegido. Cada plan incluye un coste por mensaje gestionado por la IA. Puedes monitorear el consumo en tiempo real desde el dashboard de analytics." },
      { q: "¿Soportan múltiples canales de WhatsApp por workspace?", a: "Sí, puedes agregar múltiples números de WhatsApp Business API al mismo workspace. El coste adicional por canal se indica en la página de configuración de canales." },
      { q: "¿Los datos están seguros? ¿GDPR?", a: "Absolutamente sí. eChatbot es conforme con GDPR, DSGVO y LGPD. Los datos están cifrados AES-256 at-rest y en tránsito con TLS 1.3. Arquitectura zero-knowledge. Ver la página de Privacy by Design para todos los detalles." },
      { q: "¿Qué ocurre si supero los límites del plan?", a: "El sistema te notifica cuando estás cerca de los límites. Puedes hacer upgrade en cualquier momento o comprar crédito adicional. Nunca se bloquean mensajes sin previo aviso." },
    ],
    ctaTitle: "Empieza hoy, gratis",
    ctaSub: "No se requiere tarjeta de crédito para el trial.",
    cta: "Iniciar Trial Gratuito",
  },
  pt: {
    seoTitle: "Planos e Preços - eChatbot WhatsApp E-Commerce Chatbot",
    seoDesc: "Descubra os planos do eChatbot. Comece grátis com o trial, depois escolha o plano adequado para a sua empresa. Preços transparentes, sem taxas ocultas, cancele a qualquer momento.",
    seoKeys: "preço chatbot whatsapp, planos echatbot, preço chatbot ecommerce, assinatura chatbot whatsapp, custo chatbot inteligente",
    breadcrumb: "Preços",
    badge: "Preços",
    heroTitle: "Planos simples\nsem surpresas",
    heroSub: "Comece grátis com o trial. Escale quando quiser. Preços transparentes, sem taxa de configuração, sem contratos anuais obrigatórios.",
    faqTitle: "Perguntas Frequentes",
    faqs: [
      { q: "Posso cancelar a qualquer momento?", a: "Sim. Pode cancelar o seu plano a qualquer momento diretamente do painel eChatbot. Não há penalidades ou custos de saída. A conta permanece ativa até ao final do período já pago." },
      { q: "O trial inclui todas as funcionalidades?", a: "Sim, o trial gratuito inclui acesso completo a todas as funcionalidades do plano escolhido. Pode testar o chatbot IA, gestão de pedidos, analytics e integrações sem qualquer limite." },
      { q: "Como funciona a faturação?", a: "A faturação é mensal a partir do crédito disponível na sua conta. Pode recarregar crédito sempre que quiser. Recebe fatura eletrónica por cada cobrança." },
      { q: "Posso fazer upgrade a meio do período?", a: "Sim, o upgrade é imediato. A diferença é calculada pro-rata para o mês em curso, pelo que paga apenas os dias restantes ao novo plano." },
      { q: "Quantas mensagens do WhatsApp estão incluídas?", a: "O número de mensagens depende do plano escolhido. Cada plano inclui um custo por mensagem gerida pela IA. Pode monitorizar o consumo em tempo real a partir do dashboard de analytics." },
      { q: "Suportam múltiplos canais WhatsApp por workspace?", a: "Sim, pode adicionar múltiplos números de WhatsApp Business API ao mesmo workspace. O custo adicional por canal é indicado na página de configuração de canais." },
      { q: "Os dados estão seguros? LGPD/GDPR?", a: "Absolutamente sim. O eChatbot está em conformidade com GDPR, DSGVO e LGPD. Os dados são criptografados AES-256 at-rest e em trânsito com TLS 1.3. Arquitetura zero-knowledge. Veja a página Privacy by Design para todos os detalhes." },
      { q: "O que acontece se eu exceder os limites do plano?", a: "O sistema notifica-o quando está perto dos limites. Pode fazer upgrade a qualquer momento ou comprar crédito adicional. As mensagens nunca são bloqueadas sem aviso prévio." },
    ],
    ctaTitle: "Comece hoje, grátis",
    ctaSub: "Não é necessário cartão de crédito para o trial.",
    cta: "Iniciar Trial Gratuito",
  },
}

function FAQItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-900 pr-4">{faq.q}</span>
        {open ? <ChevronUp className="h-5 w-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
          {faq.a}
        </div>
      )}
    </div>
  )
}

export function PricingPage() {
  const [language, setLanguage] = useState<Language>("it")
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
    const browserLang = navigator.language.slice(0, 2)
    if (["it", "en", "es", "pt"].includes(browserLang)) setLanguage(browserLang as Language)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/pricing" lang={language} />
      <SiteHeader language={language} onLanguageChange={setLanguage} />

      <main>
        {/* Hero */}
        <section className="pt-24 pb-10 lg:pt-32 lg:pb-16 bg-gradient-to-br from-green-50 via-white to-emerald-50">
          <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} hideVisual />
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-block bg-green-100 text-green-700 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                {t.badge}
              </span>
              <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight whitespace-pre-line">
                {t.heroTitle}
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed">{t.heroSub}</p>
            </motion.div>
          </div>
        </section>

        {/* Pricing Plans Component (dynamic from DB) */}
        <section className="py-4">
          <PricingPlans />
        </section>

        {/* FAQ */}
        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-6 lg:px-8">
            <div className="flex items-center gap-3 justify-center mb-12">
              <HelpCircle className="h-8 w-8 text-green-500" />
              <h2 className="text-4xl font-bold text-slate-900">{t.faqTitle}</h2>
            </div>
            <div className="space-y-3">
              {t.faqs.map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <FAQItem faq={faq} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-green-600 to-emerald-700">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">{t.ctaTitle}</h2>
            <p className="text-xl text-green-100 mb-8">{t.ctaSub}</p>
            <Link to="/" className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 text-green-600 font-semibold px-10 py-5 rounded-2xl shadow-lg text-lg transition-all">
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
