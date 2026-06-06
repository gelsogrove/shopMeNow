import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap, CheckCircle, Eye, Trash2, FileDown, QrCode, Smartphone, ShieldCheck } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Breadcrumbs } from "@/components/Breadcrumbs"

type Language = "it" | "en" | "es" | "pt"

const T = {
  it: {
    seoTitle: "Privacy by Design - GDPR Compliance e Sicurezza dei Dati | eChatbot",
    ctaTitle: "La privacy dei tuoi clienti è al sicuro",
    ctaSub: "Richiedi una demo e scopri come eChatbot gestisce i dati.",
    seoDesc: "eChatbot è progettato con Privacy by Design. Conformità GDPR. Crittografia end-to-end, data retention configurabile, diritto all'oblio, esportazione dati su richiesta.",
    seoKeys: "privacy by design gdpr whatsapp chatbot, gdpr compliance chatbot, protezione dati conversazioni whatsapp, sicurezza dati e-commerce",
    breadcrumb: "Privacy by Design",
    badge: "Privacy & GDPR",
    heroTitle: "Privacy by Design\nnon come aggiunta",
    heroSub: "eChatbot è stato progettato con la privacy al centro fin dal primo giorno. I dati dei tuoi clienti sono protetti da zero-knowledge architecture, crittografia end-to-end e controlli granulari di retention. Conformità GDPR inclusa.",
    cta: "Richiedi Demo",
    principlesTitle: "I 7 principi Privacy by Design implementati",
    principles: [
      { icon: "🔒", title: "Proattivo, non reattivo", desc: "La privacy è integrata nel design dell'architettura, non aggiunta dopo. Ogni funzionalità è progettata con la protezione dei dati come requisito fondamentale." },
      { icon: "🌐", title: "Privacy come impostazione predefinita", desc: "Le impostazioni predefinite garantiscono la massima privacy senza azione dell'utente. Nessun dato condiviso senza consenso esplicito." },
      { icon: "🏗️", title: "Privacy integrata nell'architettura", desc: "Non un componente esterno — la privacy è parte integrante del sistema. Isolation workspace garantisce che nessun dato attraversi i confini del tenant." },
      { icon: "✅", title: "Funzionalità completa, win-win", desc: "Privacy e funzionalità coesistono. Non sacrifichiamo features per la privacy, né la privacy per le features." },
      { icon: "📅", title: "Sicurezza end-to-end, ciclo di vita completo", desc: "I dati sono protetti dalla raccolta alla cancellazione. Retention policy configurabile, eliminazione sicura verificabile." },
      { icon: "👁️", title: "Visibilità e trasparenza", desc: "Log di accesso completi, audit trail per ogni operazione sui dati cliente. Il DPO ha accesso a tutto ciò che serve per i controlli." },
    ],
    complianceTitle: "Conformità Normativa",
    complianceItems: [
      { norm: "GDPR", region: "Unione Europea", status: "✅ Conforme", features: ["Consenso granulare", "Diritto all'oblio", "Portabilità dati", "DPA disponibile"] },
    ],
    techTitle: "Misure Tecniche di Sicurezza",
    techFeatures: [
      "Crittografia AES-256 per dati at-rest",
      "TLS 1.3 per dati in transito",
      "Zero-knowledge architecture: nemmeno il nostro staff vede i messaggi",
      "Audit trail immutabile per ogni accesso",
      "Data retention configurabile da 30 giorni a 7 anni",
      "Right to erasure: cancellazione verificabile in <72h",
      "Backup cifrati con chiavi separate per workspace",
      "Penetration testing annuale da terze parti",
    ],
    twoFaTitle: "Autenticazione a Due Fattori (2FA)",
    twoFaDesc: "Proteggi l'accesso alla dashboard con la verifica in due passaggi. Scansiona il QR code con la tua app di autenticazione (Google Authenticator, Authy, ecc.) per aggiungere un livello di sicurezza extra al tuo account.",
    twoFaFeatures: [
      { icon: QrCode, label: "Setup con QR Code", desc: "Configurazione immediata: scansiona il QR code con la tua app di autenticazione preferita per attivare la 2FA in pochi secondi." },
      { icon: Smartphone, label: "App Authenticator compatibile", desc: "Compatibile con Google Authenticator, Authy, Microsoft Authenticator e tutte le app TOTP standard." },
      { icon: ShieldCheck, label: "Protezione accesso garantita", desc: "Anche se la password viene compromessa, il tuo account resta protetto. Codici temporanei a 6 cifre con scadenza di 30 secondi." },
    ],
    rightsTitle: "Diritti degli Interessati",
    rights: [
      { icon: Eye, label: "Accesso ai dati", desc: "Il cliente può richiedere all'azienda l'export completo di tutte le sue conversazioni e dati." },
      { icon: Trash2, label: "Cancellazione (Oblio)", desc: "Implementato: richiesta cancellazione eseguita entro 72h con log di avvenuta eliminazione." },
      { icon: FileDown, label: "Portabilità", desc: "Esportazione in JSON, CSV o XML machine-readable. Compatibile con altri sistemi." },
    ],
  },
  en: {
    seoTitle: "Privacy by Design - GDPR Compliance and Data Security | eChatbot",
    ctaTitle: "Your customers' privacy is protected",
    ctaSub: "Request a demo and discover how eChatbot handles data.",
    seoDesc: "eChatbot is built with Privacy by Design. GDPR compliance. End-to-end encryption, configurable data retention, right to erasure, data export on request.",
    seoKeys: "privacy by design gdpr whatsapp chatbot, gdpr compliance chatbot, whatsapp conversation data protection, e-commerce data security",
    breadcrumb: "Privacy by Design",
    badge: "Privacy & GDPR",
    heroTitle: "Privacy by Design\nnot as an add-on",
    heroSub: "eChatbot was designed with privacy at its core from day one. Your customers' data is protected by zero-knowledge architecture, end-to-end encryption and granular retention controls. GDPR compliance included.",
    cta: "Request Demo",
    principlesTitle: "The 7 Privacy by Design principles implemented",
    principles: [
      { icon: "🔒", title: "Proactive, not reactive", desc: "Privacy is embedded in the architectural design, not bolted on. Every feature is designed with data protection as a core requirement." },
      { icon: "🌐", title: "Privacy as the default", desc: "Default settings ensure maximum privacy without user action. No data shared without explicit consent." },
      { icon: "🏗️", title: "Privacy embedded in design", desc: "Not an add-on — privacy is an integral part of the system. Workspace isolation ensures no data crosses tenant boundaries." },
      { icon: "✅", title: "Full functionality, positive-sum", desc: "Privacy and functionality coexist. We don't sacrifice features for privacy, nor privacy for features." },
      { icon: "📅", title: "End-to-end security, full lifecycle", desc: "Data is protected from collection to deletion. Configurable retention policy, verifiable secure deletion." },
      { icon: "👁️", title: "Visibility and transparency", desc: "Full access logs, audit trail for every operation on customer data. The DPO has access to everything needed for audits." },
    ],
    complianceTitle: "Regulatory Compliance",
    complianceItems: [
      { norm: "GDPR", region: "European Union", status: "✅ Compliant", features: ["Granular consent", "Right to erasure", "Data portability", "DPA available"] },
    ],
    techTitle: "Technical Security Measures",
    techFeatures: [
      "AES-256 encryption for data at-rest",
      "TLS 1.3 for data in transit",
      "Zero-knowledge architecture: even our staff can't read messages",
      "Immutable audit trail for every access",
      "Configurable data retention from 30 days to 7 years",
      "Right to erasure: verifiable deletion within 72h",
      "Encrypted backups with separate keys per workspace",
      "Annual third-party penetration testing",
    ],
    twoFaTitle: "Two-Factor Authentication (2FA)",
    twoFaDesc: "Protect dashboard access with two-step verification. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.) to add an extra layer of security to your account.",
    twoFaFeatures: [
      { icon: QrCode, label: "QR Code Setup", desc: "Instant setup: scan the QR code with your preferred authenticator app to enable 2FA in seconds." },
      { icon: Smartphone, label: "Authenticator App Compatible", desc: "Works with Google Authenticator, Authy, Microsoft Authenticator and all standard TOTP apps." },
      { icon: ShieldCheck, label: "Guaranteed Access Protection", desc: "Even if your password is compromised, your account stays protected. 6-digit temporary codes with 30-second expiry." },
    ],
    rightsTitle: "Data Subject Rights",
    rights: [
      { icon: Eye, label: "Data Access", desc: "Customers can request a complete export of all their conversations and data from the business." },
      { icon: Trash2, label: "Erasure (Right to be Forgotten)", desc: "Implemented: deletion request executed within 72h with log of completed elimination." },
      { icon: FileDown, label: "Portability", desc: "Export in machine-readable JSON, CSV or XML. Compatible with other systems." },
    ],
  },
  es: {
    seoTitle: "Privacy by Design - Cumplimiento GDPR y Seguridad de Datos | eChatbot",
    ctaTitle: "La privacidad de tus clientes está protegida",
    ctaSub: "Solicita una demo y descubre cómo eChatbot gestiona los datos.",
    seoDesc: "eChatbot está construido con Privacy by Design. Cumplimiento GDPR. Cifrado de extremo a extremo, retención de datos configurable, derecho al olvido, exportación de datos a pedido.",
    seoKeys: "privacy by design gdpr chatbot whatsapp, cumplimiento gdpr chatbot, protección datos conversaciones whatsapp, seguridad datos e-commerce",
    breadcrumb: "Privacy by Design",
    badge: "Privacidad & GDPR",
    heroTitle: "Privacy by Design\nno como añadido",
    heroSub: "eChatbot fue diseñado con la privacidad en el centro desde el primer día. Los datos de tus clientes están protegidos por arquitectura zero-knowledge, cifrado de extremo a extremo y controles granulares de retención. Cumplimiento GDPR incluido.",
    cta: "Solicitar Demo",
    principlesTitle: "Los 7 principios de Privacy by Design implementados",
    principles: [
      { icon: "🔒", title: "Proactivo, no reactivo", desc: "La privacidad está integrada en el diseño arquitectónico, no añadida después. Cada funcionalidad se diseña con la protección de datos como requisito fundamental." },
      { icon: "🌐", title: "Privacidad como configuración predeterminada", desc: "Las configuraciones predeterminadas garantizan la máxima privacidad sin acción del usuario. Ningún dato compartido sin consentimiento explícito." },
      { icon: "🏗️", title: "Privacidad integrada en el diseño", desc: "No es un complemento — la privacidad es parte integral del sistema. El aislamiento de workspace garantiza que ningún dato cruce los límites del tenant." },
      { icon: "✅", title: "Funcionalidad completa, suma positiva", desc: "Privacidad y funcionalidad coexisten. No sacrificamos funciones por la privacidad, ni la privacidad por las funciones." },
      { icon: "📅", title: "Seguridad de extremo a extremo, ciclo de vida completo", desc: "Los datos están protegidos desde la recopilación hasta la eliminación. Política de retención configurable, eliminación segura verificable." },
      { icon: "👁️", title: "Visibilidad y transparencia", desc: "Registros de acceso completos, rastro de auditoría para cada operación con datos del cliente. El DPO tiene acceso a todo lo necesario." },
    ],
    complianceTitle: "Cumplimiento Normativo",
    complianceItems: [
      { norm: "GDPR", region: "Unión Europea", status: "✅ Conforme", features: ["Consentimiento granular", "Derecho al olvido", "Portabilidad de datos", "DPA disponible"] },
    ],
    techTitle: "Medidas Técnicas de Seguridad",
    techFeatures: [
      "Cifrado AES-256 para datos at-rest",
      "TLS 1.3 para datos en tránsito",
      "Arquitectura zero-knowledge: ni nuestro personal puede leer los mensajes",
      "Rastro de auditoría inmutable para cada acceso",
      "Retención de datos configurable de 30 días a 7 años",
      "Derecho al olvido: eliminación verificable en <72h",
      "Copias de seguridad cifradas con claves separadas por workspace",
      "Pruebas de penetración anuales por terceros",
    ],
    twoFaTitle: "Autenticación de Dos Factores (2FA)",
    twoFaDesc: "Protege el acceso al panel de control con la verificación en dos pasos. Escanea el código QR con tu app de autenticación (Google Authenticator, Authy, etc.) para añadir una capa extra de seguridad a tu cuenta.",
    twoFaFeatures: [
      { icon: QrCode, label: "Configuración con QR Code", desc: "Configuración inmediata: escanea el código QR con tu app de autenticación preferida para activar la 2FA en segundos." },
      { icon: Smartphone, label: "Compatible con apps Authenticator", desc: "Compatible con Google Authenticator, Authy, Microsoft Authenticator y todas las apps TOTP estándar." },
      { icon: ShieldCheck, label: "Protección de acceso garantizada", desc: "Incluso si tu contraseña se ve comprometida, tu cuenta permanece protegida. Códigos temporales de 6 dígitos con expiración de 30 segundos." },
    ],
    rightsTitle: "Derechos del Interesado",
    rights: [
      { icon: Eye, label: "Acceso a los datos", desc: "El cliente puede solicitar a la empresa la exportación completa de todas sus conversaciones y datos." },
      { icon: Trash2, label: "Supresión (Derecho al olvido)", desc: "Implementado: solicitud de eliminación ejecutada en 72h con registro de eliminación completada." },
      { icon: FileDown, label: "Portabilidad", desc: "Exportación en JSON, CSV o XML machine-readable. Compatible con otros sistemas." },
    ],
  },
  pt: {
    seoTitle: "Privacy by Design - Conformidade GDPR e Segurança de Dados | eChatbot",
    ctaTitle: "A privacidade dos seus clientes está protegida",
    ctaSub: "Solicite uma demo e descubra como o eChatbot gere os dados.",
    seoDesc: "O eChatbot é construído com Privacy by Design. Conformidade GDPR. Criptografia ponta a ponta, retenção de dados configurável, direito ao esquecimento, exportação de dados sob demanda.",
    seoKeys: "privacy by design gdpr chatbot whatsapp, conformidade gdpr chatbot, proteção dados conversas whatsapp, segurança dados e-commerce",
    breadcrumb: "Privacy by Design",
    badge: "Privacidade & GDPR",
    heroTitle: "Privacy by Design\nnão como adicional",
    heroSub: "O eChatbot foi projetado com a privacidade no centro desde o primeiro dia. Os dados dos seus clientes são protegidos por arquitetura zero-knowledge, criptografia ponta a ponta e controles granulares de retenção. Conformidade GDPR incluída.",
    cta: "Solicitar Demo",
    principlesTitle: "Os 7 princípios de Privacy by Design implementados",
    principles: [
      { icon: "🔒", title: "Proativo, não reativo", desc: "A privacidade está integrada no design arquitetural, não adicionada depois. Cada funcionalidade é projetada com proteção de dados como requisito fundamental." },
      { icon: "🌐", title: "Privacidade como configuração padrão", desc: "As configurações padrão garantem máxima privacidade sem ação do usuário. Nenhum dado compartilhado sem consentimento explícito." },
      { icon: "🏗️", title: "Privacidade incorporada no design", desc: "Não é um complemento — a privacidade é parte integrante do sistema. O isolamento do workspace garante que nenhum dado ultrapasse os limites do tenant." },
      { icon: "✅", title: "Funcionalidade completa, soma positiva", desc: "Privacidade e funcionalidade coexistem. Não sacrificamos recursos pela privacidade, nem a privacidade pelos recursos." },
      { icon: "📅", title: "Segurança ponta a ponta, ciclo de vida completo", desc: "Os dados são protegidos desde a coleta até a exclusão. Política de retenção configurável, exclusão segura verificável." },
      { icon: "👁️", title: "Visibilidade e transparência", desc: "Logs de acesso completos, trilha de auditoria para cada operação nos dados do cliente. O DPO tem acesso a tudo que precisa para auditorias." },
    ],
    complianceTitle: "Conformidade Regulatória",
    complianceItems: [
      { norm: "GDPR", region: "União Europeia", status: "✅ Conforme", features: ["Consentimento granular", "Direito ao esquecimento", "Portabilidade de dados", "DPA disponível"] },
    ],
    techTitle: "Medidas Técnicas de Segurança",
    techFeatures: [
      "Criptografia AES-256 para dados at-rest",
      "TLS 1.3 para dados em trânsito",
      "Arquitetura zero-knowledge: nem nossa equipe pode ler as mensagens",
      "Trilha de auditoria imutável para cada acesso",
      "Retenção de dados configurável de 30 dias a 7 anos",
      "Direito ao esquecimento: exclusão verificável em <72h",
      "Backups criptografados com chaves separadas por workspace",
      "Testes de penetração anuais por terceiros",
    ],
    twoFaTitle: "Autenticação de Dois Fatores (2FA)",
    twoFaDesc: "Proteja o acesso ao painel com a verificação em dois passos. Escaneie o código QR com seu app de autenticação (Google Authenticator, Authy, etc.) para adicionar uma camada extra de segurança à sua conta.",
    twoFaFeatures: [
      { icon: QrCode, label: "Configuração com QR Code", desc: "Configuração imediata: escaneie o código QR com seu app de autenticação preferido para ativar a 2FA em segundos." },
      { icon: Smartphone, label: "Compatível com apps Authenticator", desc: "Compatível com Google Authenticator, Authy, Microsoft Authenticator e todos os apps TOTP padrão." },
      { icon: ShieldCheck, label: "Proteção de acesso garantida", desc: "Mesmo que sua senha seja comprometida, sua conta permanece protegida. Códigos temporários de 6 dígitos com expiração de 30 segundos." },
    ],
    rightsTitle: "Direitos dos Titulares dos Dados",
    rights: [
      { icon: Eye, label: "Acesso aos dados", desc: "O cliente pode solicitar à empresa a exportação completa de todas as suas conversas e dados." },
      { icon: Trash2, label: "Exclusão (Direito ao esquecimento)", desc: "Implementado: solicitação de exclusão executada em 72h com registro de exclusão concluída." },
      { icon: FileDown, label: "Portabilidade", desc: "Exportação em JSON, CSV ou XML machine-readable. Compatível com outros sistemas." },
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
    <div className="min-h-screen bg-white">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/privacy-by-design" lang={language} serviceType="Privacy-by-Design Data Protection" />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-slate-50 via-white to-green-50">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t.breadcrumb }]} hideVisual />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              <div>
                <span className="inline-block bg-green-100 text-green-700 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                  {t.badge}
                </span>
                <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight whitespace-pre-line">
                  {t.heroTitle}
                </h1>
                <p className="text-xl text-slate-600 mb-10 leading-relaxed">{t.heroSub}</p>
                <Link to="/contact" className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg">
                  <Zap className="h-5 w-5" />
                  {t.cta}
                </Link>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-green-100 to-slate-100 rounded-3xl blur-xl opacity-40" />
                <img src="/survery-secuiry.png" alt="Privacy Architecture" className="relative w-full h-auto rounded-3xl shadow-2xl border border-white/60 object-contain" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* 7 Principles */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-slate-900 text-center mb-14">{t.principlesTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {t.principles.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.09 }}
                  className="p-6 bg-gradient-to-br from-slate-50 to-green-50 rounded-2xl border border-green-100 hover:shadow-lg hover:-translate-y-1 transition-all"
                >
                  <div className="text-3xl mb-3">{p.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{p.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{p.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-semibold mb-4">
                  <ShieldCheck className="h-4 w-4" /> {t.badge}
                </div>
                <h2 className="text-4xl font-bold text-slate-900 mb-4">{t.complianceTitle}</h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-6 max-w-2xl">
                  {t.heroSub}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {t.complianceItems[0].features.map((f, j) => (
                    <div key={j} className="flex items-start gap-2 text-slate-700 text-sm bg-white/70 border border-green-50 rounded-xl px-3 py-2 shadow-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
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
                    className="bg-white rounded-2xl p-8 shadow-xl border border-green-50 ring-1 ring-green-100/60 hover:-translate-y-1 hover:shadow-2xl transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{c.region}</p>
                        <h3 className="text-2xl font-extrabold text-slate-900">{c.norm}</h3>
                      </div>
                      <span className="text-xs font-semibold text-green-800 bg-green-100 px-3 py-1.5 rounded-full shadow-sm">{c.status}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2">
                      {c.features.map((f, j) => (
                        <div key={j} className="flex items-center gap-2 text-slate-700 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
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
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="relative order-2 lg:order-1">
                <div className="absolute -inset-4 bg-gradient-to-br from-green-100 to-slate-100 rounded-2xl blur-xl opacity-40" />
                <img src="/survery-secuiry.png" alt="Security Architecture" className="relative w-full h-auto rounded-2xl shadow-xl border border-white/60 object-contain" />
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-6">{t.techTitle}</h2>
                <ul className="space-y-3">
                  {t.techFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-700">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-br from-green-600 to-slate-800">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">{t.ctaTitle}</h2>
            <p className="text-xl text-green-200 mb-8">{t.ctaSub}</p>
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
