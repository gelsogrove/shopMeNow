import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap, CheckCircle, Eye, Trash2, FileDown, QrCode, Smartphone, ShieldCheck } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Privacy by Design - I tuoi dati al sicuro | eChatbot",
    ctaTitle: "La privacy dei tuoi clienti è al sicuro",
    ctaSub: "Richiedi una demo e ti mostriamo esattamente come trattiamo i dati.",
    seoDesc: "On-premise su istanza dedicata, messaggi cifrati end-to-end da WhatsApp, AI disattivata sui dati sensibili, rate limiting anti-abuso e raccolta minima dei dati.",
    seoKeys: "privacy whatsapp chatbot, on-premise chatbot, cifratura end-to-end whatsapp, rate limiting, minimizzazione dati, sicurezza dati e-commerce",
    breadcrumb: "Privacy by Design",
    badge: "Privacy by Design",
    heroTitle: "Privacy by design,\nnon a parole",
    heroSub: "Niente promesse di marketing. I tuoi dati restano sulla tua istanza dedicata, i messaggi viaggiano cifrati end-to-end su WhatsApp e l'AI non tocca mai i dati sensibili. Raccogliamo solo ciò che serve per rispondere ai tuoi clienti.",
    cta: "Richiedi Demo",
    principlesTitle: "Come proteggiamo i tuoi dati",
    principles: [
      { icon: "🏠", title: "On-premise, istanza dedicata", desc: "Database e knowledge base risiedono sulla tua istanza dedicata. Per generare le risposte, solo il contesto necessario viene inviato a un provider LLM esterno che non usa i tuoi dati per addestrare i suoi modelli. I dati non finiscono in un calderone condiviso né vengono venduti a terzi." },
      { icon: "🔒", title: "Cifratura end-to-end di WhatsApp", desc: "I messaggi viaggiano sul canale peer-to-peer cifrato di WhatsApp: nessuno li intercetta in transito." },
      { icon: "📲", title: "Connessione via QR code", desc: "Colleghi il tuo numero scansionando un QR code. Le credenziali del tuo WhatsApp non vengono memorizzate da noi." },
      { icon: "🚦", title: "Rate limiting anti-abuso", desc: "Webhook, ordini e checkout sono protetti da limiti di frequenza contro spam, brute force e attacchi DoS." },
      { icon: "🤖", title: "AI spenta sui dati sensibili", desc: "Quando si parla di fatture o si passa a un operatore, l'AI si disattiva: i dati sensibili non passano dal modello." },
      { icon: "🧱", title: "Isolamento per workspace", desc: "Ogni attività è isolata: nessun dato attraversa i confini tra un cliente e l'altro." },
    ],
    complianceTitle: "Meno dati, meno rischi",
    complianceDesc: "Raccogliamo solo i dati necessari a far funzionare il servizio: il numero WhatsApp del cliente e la conversazione. Database e knowledge base risiedono sulla tua istanza; per generare le risposte, il contesto necessario viene inviato a un provider LLM esterno che non lo usa per addestrare i suoi modelli. Niente tracciamenti pubblicitari, niente profili venduti.",
    complianceItems: [
      { norm: "On-premise", region: "La tua istanza dedicata", status: "✅ Attivo", features: ["Dati e knowledge base sul tuo ambiente", "Ricerca RAG eseguita sui tuoi sistemi", "Risposte generate da un provider LLM esterno (no training sui tuoi dati)", "Nessun profilo venduto a terzi", "Cancellazione su richiesta"] },
    ],
    techTitle: "Misure di sicurezza concrete",
    techFeatures: [
      "Connessione a WhatsApp tramite QR code, senza memorizzare le credenziali del tuo numero",
      "Messaggi cifrati end-to-end da WhatsApp (peer-to-peer)",
      "Hosting on-premise su istanza dedicata: i dati restano nel tuo ambiente",
      "Database e knowledge base on-premise; le risposte AI sono generate da un provider LLM esterno che riceve solo il contesto necessario e non addestra sui tuoi dati",
      "Isolamento per workspace: ogni query filtra per attività, nessun dato condiviso tra tenant",
      "Rate limiting su webhook, ordini pubblici e checkout contro spam e DoS",
      "AI disattivata automaticamente su fatture e passaggio a operatore",
      "Raccolta minima dei dati: solo numero e conversazione, niente tracciamenti pubblicitari",
      "Autenticazione a due fattori (2FA TOTP) per l'accesso alla dashboard",
    ],
    twoFaTitle: "Autenticazione a Due Fattori (2FA)",
    twoFaDesc: "Proteggi l'accesso alla dashboard con la verifica in due passaggi. Scansiona il QR code con la tua app di autenticazione (Google Authenticator, Authy, ecc.) per aggiungere un livello di sicurezza extra al tuo account.",
    twoFaFeatures: [
      { icon: QrCode, label: "Setup con QR Code", desc: "Configurazione immediata: scansiona il QR code con la tua app di autenticazione preferita per attivare la 2FA in pochi secondi." },
      { icon: Smartphone, label: "App Authenticator compatibile", desc: "Compatibile con Google Authenticator, Authy, Microsoft Authenticator e tutte le app TOTP standard." },
      { icon: ShieldCheck, label: "Protezione accesso garantita", desc: "Anche se la password viene compromessa, il tuo account resta protetto. Codici temporanei a 6 cifre con scadenza di 30 secondi." },
    ],
    rightsTitle: "I diritti dei tuoi clienti",
    rights: [
      { icon: Eye, label: "Accesso ai dati", desc: "Su richiesta puoi recuperare tutte le conversazioni e i dati di un cliente." },
      { icon: Trash2, label: "Cancellazione", desc: "I dati di un cliente possono essere cancellati su richiesta, conversazioni incluse." },
      { icon: FileDown, label: "Esportazione", desc: "Le conversazioni di un cliente possono essere esportate su richiesta." },
    ],
  },
  en: {
    seoTitle: "Privacy by Design - Your Data Kept Safe | eChatbot",
    ctaTitle: "Your customers' privacy is protected",
    ctaSub: "Request a demo and we'll show you exactly how we handle data.",
    seoDesc: "On-premise on a dedicated instance, messages end-to-end encrypted by WhatsApp, AI disabled on sensitive data, anti-abuse rate limiting and minimal data collection.",
    seoKeys: "privacy whatsapp chatbot, on-premise chatbot, whatsapp end-to-end encryption, rate limiting, data minimization, e-commerce data security",
    breadcrumb: "Privacy by Design",
    badge: "Privacy by Design",
    heroTitle: "Privacy by design,\nnot just words",
    heroSub: "No marketing promises. Your data stays on your dedicated instance, messages travel end-to-end encrypted on WhatsApp, and the AI never touches sensitive data. We only collect what's needed to answer your customers.",
    cta: "Request Demo",
    principlesTitle: "How we protect your data",
    principles: [
      { icon: "🏠", title: "On-premise, dedicated instance", desc: "Your database and knowledge base live on your dedicated instance. To generate replies, only the necessary context is sent to an external LLM provider that does not use your data to train its models. Data is never pooled with others or sold to third parties." },
      { icon: "🔒", title: "WhatsApp end-to-end encryption", desc: "Messages travel on WhatsApp's encrypted peer-to-peer channel: no one intercepts them in transit." },
      { icon: "📲", title: "QR code connection", desc: "You link your number by scanning a QR code. Your WhatsApp credentials are never stored by us." },
      { icon: "🚦", title: "Anti-abuse rate limiting", desc: "Webhook, orders and checkout are protected by frequency limits against spam, brute force and DoS attacks." },
      { icon: "🤖", title: "AI off on sensitive data", desc: "When invoices come up or a chat is handed to a human, the AI switches off: sensitive data never reaches the model." },
      { icon: "🧱", title: "Per-workspace isolation", desc: "Every business is isolated: no data crosses the boundary from one customer to another." },
    ],
    complianceTitle: "Less data, less risk",
    complianceDesc: "We only collect the data needed to run the service: the customer's WhatsApp number and the conversation. Your database and knowledge base live on your instance; to generate replies, the necessary context is sent to an external LLM provider that does not use it to train its models. No ad tracking, no profiles sold.",
    complianceItems: [
      { norm: "On-premise", region: "Your dedicated instance", status: "✅ Active", features: ["Data and knowledge base in your environment", "RAG search runs on your systems", "Replies generated via an external LLM provider (no training on your data)", "No profiles sold to third parties", "Deletion on request"] },
    ],
    techTitle: "Concrete security measures",
    techFeatures: [
      "WhatsApp connection via QR code, without storing your number's credentials",
      "Messages end-to-end encrypted by WhatsApp (peer-to-peer)",
      "On-premise hosting on a dedicated instance: data stays in your environment",
      "Database and knowledge base on-premise; AI replies are generated by an external LLM provider that receives only the necessary context and does not train on your data",
      "Per-workspace isolation: every query filters by business, no data shared across tenants",
      "Rate limiting on webhook, public orders and checkout against spam and DoS",
      "AI automatically disabled on invoices and operator handoff",
      "Minimal data collection: only number and conversation, no ad tracking",
      "Two-factor authentication (2FA TOTP) for dashboard access",
    ],
    twoFaTitle: "Two-Factor Authentication (2FA)",
    twoFaDesc: "Protect dashboard access with two-step verification. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.) to add an extra layer of security to your account.",
    twoFaFeatures: [
      { icon: QrCode, label: "QR Code Setup", desc: "Instant setup: scan the QR code with your preferred authenticator app to enable 2FA in seconds." },
      { icon: Smartphone, label: "Authenticator App Compatible", desc: "Works with Google Authenticator, Authy, Microsoft Authenticator and all standard TOTP apps." },
      { icon: ShieldCheck, label: "Guaranteed Access Protection", desc: "Even if your password is compromised, your account stays protected. 6-digit temporary codes with 30-second expiry." },
    ],
    rightsTitle: "Your customers' rights",
    rights: [
      { icon: Eye, label: "Data access", desc: "On request you can retrieve all of a customer's conversations and data." },
      { icon: Trash2, label: "Erasure", desc: "A customer's data can be deleted on request, conversations included." },
      { icon: FileDown, label: "Export", desc: "A customer's conversations can be exported on request." },
    ],
  },
  es: {
    seoTitle: "Privacy by Design - Tus datos a salvo | eChatbot",
    ctaTitle: "La privacidad de tus clientes está protegida",
    ctaSub: "Solicita una demo y te mostramos exactamente cómo tratamos los datos.",
    seoDesc: "On-premise en una instancia dedicada, mensajes cifrados de extremo a extremo por WhatsApp, IA desactivada en datos sensibles, rate limiting anti-abuso y recogida mínima de datos.",
    seoKeys: "privacidad chatbot whatsapp, chatbot on-premise, cifrado extremo a extremo whatsapp, rate limiting, minimización de datos, seguridad datos e-commerce",
    breadcrumb: "Privacy by Design",
    badge: "Privacy by Design",
    heroTitle: "Privacy by design,\nno solo palabras",
    heroSub: "Sin promesas de marketing. Tus datos quedan en tu instancia dedicada, los mensajes viajan cifrados de extremo a extremo en WhatsApp y la IA nunca toca datos sensibles. Solo recogemos lo necesario para responder a tus clientes.",
    cta: "Solicitar Demo",
    principlesTitle: "Cómo protegemos tus datos",
    principles: [
      { icon: "🏠", title: "On-premise, instancia dedicada", desc: "Tu base de datos y tu knowledge base residen en tu instancia dedicada. Para generar las respuestas, solo se envía el contexto necesario a un proveedor LLM externo que no usa tus datos para entrenar sus modelos. Los datos no se mezclan con otros ni se venden a terceros." },
      { icon: "🔒", title: "Cifrado de extremo a extremo de WhatsApp", desc: "Los mensajes viajan por el canal cifrado peer-to-peer de WhatsApp: nadie los intercepta en tránsito." },
      { icon: "📲", title: "Conexión por código QR", desc: "Conectas tu número escaneando un código QR. Nosotros no almacenamos las credenciales de tu WhatsApp." },
      { icon: "🚦", title: "Rate limiting anti-abuso", desc: "Webhook, pedidos y checkout están protegidos por límites de frecuencia contra spam, fuerza bruta y ataques DoS." },
      { icon: "🤖", title: "IA apagada en datos sensibles", desc: "Cuando se trata de facturas o se pasa a un operador, la IA se desactiva: los datos sensibles no pasan por el modelo." },
      { icon: "🧱", title: "Aislamiento por workspace", desc: "Cada negocio está aislado: ningún dato cruza los límites de un cliente a otro." },
    ],
    complianceTitle: "Menos datos, menos riesgo",
    complianceDesc: "Solo recogemos los datos necesarios para que el servicio funcione: el número de WhatsApp del cliente y la conversación. Tu base de datos y knowledge base residen en tu instancia; para generar las respuestas, se envía el contexto necesario a un proveedor LLM externo que no lo usa para entrenar sus modelos. Sin rastreo publicitario, sin perfiles vendidos.",
    complianceItems: [
      { norm: "On-premise", region: "Tu instancia dedicada", status: "✅ Activo", features: ["Datos y knowledge base en tu entorno", "Búsqueda RAG ejecutada en tus sistemas", "Respuestas generadas vía un proveedor LLM externo (sin entrenar con tus datos)", "Sin perfiles vendidos a terceros", "Eliminación a petición"] },
    ],
    techTitle: "Medidas de seguridad concretas",
    techFeatures: [
      "Conexión a WhatsApp por código QR, sin almacenar las credenciales de tu número",
      "Mensajes cifrados de extremo a extremo por WhatsApp (peer-to-peer)",
      "Hosting on-premise en instancia dedicada: los datos quedan en tu entorno",
      "Base de datos y knowledge base on-premise; las respuestas de IA las genera un proveedor LLM externo que recibe solo el contexto necesario y no entrena con tus datos",
      "Aislamiento por workspace: cada consulta filtra por negocio, sin datos compartidos entre tenants",
      "Rate limiting en webhook, pedidos públicos y checkout contra spam y DoS",
      "IA desactivada automáticamente en facturas y paso a operador",
      "Recogida mínima de datos: solo número y conversación, sin rastreo publicitario",
      "Autenticación de dos factores (2FA TOTP) para el acceso al panel",
    ],
    twoFaTitle: "Autenticación de Dos Factores (2FA)",
    twoFaDesc: "Protege el acceso al panel de control con la verificación en dos pasos. Escanea el código QR con tu app de autenticación (Google Authenticator, Authy, etc.) para añadir una capa extra de seguridad a tu cuenta.",
    twoFaFeatures: [
      { icon: QrCode, label: "Configuración con QR Code", desc: "Configuración inmediata: escanea el código QR con tu app de autenticación preferida para activar la 2FA en segundos." },
      { icon: Smartphone, label: "Compatible con apps Authenticator", desc: "Compatible con Google Authenticator, Authy, Microsoft Authenticator y todas las apps TOTP estándar." },
      { icon: ShieldCheck, label: "Protección de acceso garantizada", desc: "Incluso si tu contraseña se ve comprometida, tu cuenta permanece protegida. Códigos temporales de 6 dígitos con expiración de 30 segundos." },
    ],
    rightsTitle: "Los derechos de tus clientes",
    rights: [
      { icon: Eye, label: "Acceso a los datos", desc: "A petición puedes recuperar todas las conversaciones y datos de un cliente." },
      { icon: Trash2, label: "Supresión", desc: "Los datos de un cliente pueden eliminarse a petición, conversaciones incluidas." },
      { icon: FileDown, label: "Exportación", desc: "Las conversaciones de un cliente pueden exportarse a petición." },
    ],
  },
  pt: {
    seoTitle: "Privacy by Design - Os teus dados em segurança | eChatbot",
    ctaTitle: "A privacidade dos seus clientes está protegida",
    ctaSub: "Solicite uma demo e mostramos-lhe exatamente como tratamos os dados.",
    seoDesc: "On-premise numa instância dedicada, mensagens cifradas ponta a ponta pelo WhatsApp, IA desativada em dados sensíveis, rate limiting anti-abuso e recolha mínima de dados.",
    seoKeys: "privacidade chatbot whatsapp, chatbot on-premise, cifragem ponta a ponta whatsapp, rate limiting, minimização de dados, segurança dados e-commerce",
    breadcrumb: "Privacy by Design",
    badge: "Privacy by Design",
    heroTitle: "Privacy by design,\nnão só palavras",
    heroSub: "Sem promessas de marketing. Os teus dados ficam na tua instância dedicada, as mensagens viajam cifradas ponta a ponta no WhatsApp e a IA nunca toca em dados sensíveis. Só recolhemos o necessário para responder aos teus clientes.",
    cta: "Solicitar Demo",
    principlesTitle: "Como protegemos os teus dados",
    principles: [
      { icon: "🏠", title: "On-premise, instância dedicada", desc: "A tua base de dados e a tua knowledge base residem na tua instância dedicada. Para gerar as respostas, apenas o contexto necessário é enviado a um fornecedor LLM externo que não usa os teus dados para treinar os seus modelos. Os dados não se misturam com outros nem são vendidos a terceiros." },
      { icon: "🔒", title: "Cifragem ponta a ponta do WhatsApp", desc: "As mensagens viajam pelo canal cifrado peer-to-peer do WhatsApp: ninguém as interceta em trânsito." },
      { icon: "📲", title: "Ligação por código QR", desc: "Ligas o teu número lendo um código QR. As credenciais do teu WhatsApp não são guardadas por nós." },
      { icon: "🚦", title: "Rate limiting anti-abuso", desc: "Webhook, pedidos e checkout estão protegidos por limites de frequência contra spam, força bruta e ataques DoS." },
      { icon: "🤖", title: "IA desligada em dados sensíveis", desc: "Quando se fala de faturas ou se passa a um operador, a IA desativa-se: os dados sensíveis não passam pelo modelo." },
      { icon: "🧱", title: "Isolamento por workspace", desc: "Cada negócio está isolado: nenhum dado atravessa os limites de um cliente para outro." },
    ],
    complianceTitle: "Menos dados, menos risco",
    complianceDesc: "Só recolhemos os dados necessários para o serviço funcionar: o número de WhatsApp do cliente e a conversa. A tua base de dados e knowledge base residem na tua instância; para gerar as respostas, o contexto necessário é enviado a um fornecedor LLM externo que não o usa para treinar os seus modelos. Sem rastreio publicitário, sem perfis vendidos.",
    complianceItems: [
      { norm: "On-premise", region: "A tua instância dedicada", status: "✅ Ativo", features: ["Dados e knowledge base no teu ambiente", "Pesquisa RAG executada nos teus sistemas", "Respostas geradas via um fornecedor LLM externo (sem treino com os teus dados)", "Sem perfis vendidos a terceiros", "Eliminação a pedido"] },
    ],
    techTitle: "Medidas de segurança concretas",
    techFeatures: [
      "Ligação ao WhatsApp por código QR, sem guardar as credenciais do teu número",
      "Mensagens cifradas ponta a ponta pelo WhatsApp (peer-to-peer)",
      "Alojamento on-premise em instância dedicada: os dados ficam no teu ambiente",
      "Base de dados e knowledge base on-premise; as respostas de IA são geradas por um fornecedor LLM externo que recebe apenas o contexto necessário e não treina com os teus dados",
      "Isolamento por workspace: cada consulta filtra por negócio, sem dados partilhados entre tenants",
      "Rate limiting em webhook, pedidos públicos e checkout contra spam e DoS",
      "IA desativada automaticamente em faturas e passagem para operador",
      "Recolha mínima de dados: apenas número e conversa, sem rastreio publicitário",
      "Autenticação de dois fatores (2FA TOTP) para o acesso ao painel",
    ],
    twoFaTitle: "Autenticação de Dois Fatores (2FA)",
    twoFaDesc: "Proteja o acesso ao painel com a verificação em dois passos. Escaneie o código QR com o seu app de autenticação (Google Authenticator, Authy, etc.) para adicionar uma camada extra de segurança à sua conta.",
    twoFaFeatures: [
      { icon: QrCode, label: "Configuração com QR Code", desc: "Configuração imediata: escaneie o código QR com o seu app de autenticação preferido para ativar a 2FA em segundos." },
      { icon: Smartphone, label: "Compatível com apps Authenticator", desc: "Compatível com Google Authenticator, Authy, Microsoft Authenticator e todos os apps TOTP padrão." },
      { icon: ShieldCheck, label: "Proteção de acesso garantida", desc: "Mesmo que a sua senha seja comprometida, a sua conta permanece protegida. Códigos temporários de 6 dígitos com expiração de 30 segundos." },
    ],
    rightsTitle: "Os direitos dos teus clientes",
    rights: [
      { icon: Eye, label: "Acesso aos dados", desc: "A pedido podes recuperar todas as conversas e dados de um cliente." },
      { icon: Trash2, label: "Eliminação", desc: "Os dados de um cliente podem ser eliminados a pedido, conversas incluídas." },
      { icon: FileDown, label: "Exportação", desc: "As conversas de um cliente podem ser exportadas a pedido." },
    ],
  },
}

export function PrivacyByDesignPage() {
  const { language } = useLanguage()
  const t = T[language]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-200">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/privacy-by-design" lang={language} serviceType="Privacy-by-Design Data Protection" />
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
              <div>
                <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight whitespace-pre-line">
                  {t.heroTitle}
                </h1>
                <p className="text-xl text-slate-400 mb-10 leading-relaxed">{t.heroSub}</p>
                <Link to="/contact" className="inline-flex items-center gap-3 bg-[#25D366] hover:bg-green-400 text-slate-950 font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg">
                  <Zap className="h-5 w-5" />
                  {t.cta}
                </Link>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl blur-xl opacity-40" />
                <img src="/survery-secuiry.png" alt="Privacy Architecture" className="relative w-full h-auto rounded-3xl shadow-2xl border border-white/10 object-contain" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Privacy pillars */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-white text-center mb-14">{t.principlesTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {t.principles.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.09 }}
                  className="p-6 bg-slate-900/50 backdrop-blur rounded-2xl shadow-2xl border border-white/10 hover:shadow-lg hover:-translate-y-1 transition-all"
                >
                  <div className="text-3xl mb-3">{p.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{p.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Data minimization / On-premise */}
        <section className="py-20 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-400/10 text-green-300 text-sm font-semibold mb-4">
                  <ShieldCheck className="h-4 w-4" /> {t.badge}
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">{t.complianceTitle}</h2>
                <p className="text-lg text-slate-400 leading-relaxed mb-6 max-w-2xl">
                  {t.complianceDesc}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {t.complianceItems[0].features.map((f, j) => (
                    <div key={j} className="flex items-start gap-2 text-slate-300 text-sm bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 shadow-sm">
                      <CheckCircle className="h-4 w-4 text-[#25D366] mt-0.5" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {t.complianceItems.map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="bg-slate-900/50 backdrop-blur rounded-2xl p-8 shadow-2xl border border-white/10 hover:-translate-y-1 hover:shadow-2xl transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{c.region}</p>
                        <h3 className="text-2xl font-extrabold text-white">{c.norm}</h3>
                      </div>
                      <span className="text-xs font-semibold text-green-300 bg-green-400/10 px-3 py-1.5 rounded-full shadow-sm">{c.status}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2">
                      {c.features.map((f, j) => (
                        <div key={j} className="flex items-center gap-2 text-slate-300 text-sm">
                          <CheckCircle className="h-4 w-4 text-[#25D366] flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Technical measures */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="relative order-2 lg:order-1">
                <div className="absolute -inset-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl blur-xl opacity-40" />
                <img src="/survery-secuiry.png" alt="Security Architecture" className="relative w-full h-auto rounded-2xl shadow-2xl border border-white/10 object-contain" />
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">{t.techTitle}</h2>
                <ul className="space-y-3">
                  {t.techFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-300">
                      <CheckCircle className="h-5 w-5 text-[#25D366] flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 2FA */}
        <section className="py-20 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">{t.twoFaTitle}</h2>
              <p className="text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">{t.twoFaDesc}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.twoFaFeatures.map((f, i) => {
                const Icon = f.icon
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="p-6 bg-slate-900/50 backdrop-blur rounded-2xl shadow-2xl border border-white/10 hover:-translate-y-1 transition-all"
                  >
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-green-400/10 text-[#25D366] mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{f.label}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Data subject rights */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-white text-center mb-14">{t.rightsTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.rights.map((r, i) => {
                const Icon = r.icon
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="p-6 bg-slate-900/50 backdrop-blur rounded-2xl shadow-2xl border border-white/10 hover:-translate-y-1 transition-all"
                  >
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-green-400/10 text-[#25D366] mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{r.label}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{r.desc}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-green-600 to-emerald-600">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">{t.ctaTitle}</h2>
            <p className="text-xl text-green-50 mb-8">{t.ctaSub}</p>
            <Link to="/contact" className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 text-green-700 font-semibold px-10 py-5 rounded-2xl shadow-lg text-lg transition-all">
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
