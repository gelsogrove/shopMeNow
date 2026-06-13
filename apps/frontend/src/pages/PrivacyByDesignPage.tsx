import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap, CheckCircle, Eye, Trash2, FileDown, QrCode, Smartphone, ShieldCheck } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { CtaSection } from "@/components/landing/CtaSection"
import { PrivacyDataflowDiagram, type DataflowLabels } from "@/components/landing/PrivacyDataflowDiagram"
import { SecurityLayersDiagram, type SecurityLayersLabels } from "@/components/landing/SecurityLayersDiagram"

type Language = "it" | "en" | "es" | "de"

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
      { icon: "🖥️", title: "Opzione 100% in locale", desc: "Se vuoi il massimo controllo, l'intera AI può girare in locale con modelli open-source come Gemma eseguiti tramite Ollama: nessun dato esce dalla tua infrastruttura. Richiede server performanti dedicati." },
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
      "Opzione 100% in locale: modelli open-source come Gemma eseguiti via Ollama sulla tua infrastruttura, nessun dato verso provider esterni (richiede server performanti)",
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
    dataflow: {
      customer: "Cliente WhatsApp",
      e2e: "Cifratura E2E",
      channel: "canale cifrato",
      instanceTitle: "La tua istanza dedicata",
      instanceSub: "on-premise · i dati restano qui",
      database: "Database",
      knowledgeBase: "Knowledge base",
      rag: "Ricerca RAG sui tuoi sistemi",
      isolation: "Isolamento per workspace",
      contextOut: "solo contesto necessario",
      reply: "risposta",
      llmTitle: "Provider LLM esterno",
      noTraining: "no training",
    },
    layers: {
      heading: "Difesa a più livelli",
      layers: [
        { title: "Trasporto cifrato", sub: "WhatsApp end-to-end", icon: "lock" },
        { title: "Infrastruttura isolata", sub: "On-premise · per workspace", icon: "server" },
        { title: "Accesso protetto", sub: "2FA · rate limiting", icon: "key" },
        { title: "AI sotto controllo", sub: "Spenta sui dati sensibili", icon: "cpu" },
      ],
    },
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
      { icon: "🖥️", title: "100% on-premise option", desc: "If you want maximum control, the entire AI can run locally with open-source models like Gemma via Ollama: no data ever leaves your infrastructure. Requires dedicated high-performance servers." },
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
      "100% local option: open-source models like Gemma running via Ollama on your infrastructure, no data sent to external providers (requires high-performance servers)",
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
    dataflow: {
      customer: "WhatsApp customer",
      e2e: "E2E encryption",
      channel: "encrypted channel",
      instanceTitle: "Your dedicated instance",
      instanceSub: "on-premise · data stays here",
      database: "Database",
      knowledgeBase: "Knowledge base",
      rag: "RAG search on your systems",
      isolation: "Per-workspace isolation",
      contextOut: "only necessary context",
      reply: "reply",
      llmTitle: "External LLM provider",
      noTraining: "no training",
    },
    layers: {
      heading: "Defense in depth",
      layers: [
        { title: "Encrypted transport", sub: "WhatsApp end-to-end", icon: "lock" },
        { title: "Isolated infrastructure", sub: "On-premise · per workspace", icon: "server" },
        { title: "Protected access", sub: "2FA · rate limiting", icon: "key" },
        { title: "AI under control", sub: "Off on sensitive data", icon: "cpu" },
      ],
    },
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
      { icon: "🖥️", title: "Opción 100% en local", desc: "Si quieres el máximo control, toda la IA puede ejecutarse en local con modelos open-source como Gemma mediante Ollama: ningún dato sale de tu infraestructura. Requiere servidores dedicados de alto rendimiento." },
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
      "Opción 100% en local: modelos open-source como Gemma ejecutados vía Ollama en tu infraestructura, sin datos hacia proveedores externos (requiere servidores de alto rendimiento)",
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
    dataflow: {
      customer: "Cliente WhatsApp",
      e2e: "Cifrado E2E",
      channel: "canal cifrado",
      instanceTitle: "Tu instancia dedicada",
      instanceSub: "on-premise · los datos se quedan aquí",
      database: "Base de datos",
      knowledgeBase: "Knowledge base",
      rag: "Búsqueda RAG en tus sistemas",
      isolation: "Aislamiento por workspace",
      contextOut: "solo el contexto necesario",
      reply: "respuesta",
      llmTitle: "Proveedor LLM externo",
      noTraining: "sin training",
    },
    layers: {
      heading: "Defensa en profundidad",
      layers: [
        { title: "Transporte cifrado", sub: "WhatsApp end-to-end", icon: "lock" },
        { title: "Infraestructura aislada", sub: "On-premise · por workspace", icon: "server" },
        { title: "Acceso protegido", sub: "2FA · rate limiting", icon: "key" },
        { title: "IA bajo control", sub: "Apagada en datos sensibles", icon: "cpu" },
      ],
    },
  },
  de: {
    seoTitle: "Privacy by Design - Deine Daten sicher | eChatbot",
    ctaTitle: "Die Privatsphäre deiner Kunden ist geschützt",
    ctaSub: "Fordere eine Demo an und wir zeigen dir genau, wie wir mit Daten umgehen.",
    seoDesc: "On-Premise auf einer dedizierten Instanz, Ende-zu-Ende-verschlüsselte Nachrichten über WhatsApp, KI bei sensiblen Daten deaktiviert, Anti-Missbrauch-Rate-Limiting und minimale Datenerfassung.",
    seoKeys: "privacy whatsapp chatbot, on-premise chatbot, whatsapp ende-zu-ende-verschlüsselung, rate limiting, datenminimierung, datensicherheit e-commerce",
    breadcrumb: "Privacy by Design",
    badge: "Privacy by Design",
    heroTitle: "Privacy by Design,\nnicht nur Worte",
    heroSub: "Keine Marketing-Versprechen. Deine Daten bleiben auf deiner dedizierten Instanz, die Nachrichten reisen Ende-zu-Ende-verschlüsselt über WhatsApp und die KI berührt niemals sensible Daten. Wir erfassen nur, was nötig ist, um deinen Kunden zu antworten.",
    cta: "Demo anfordern",
    principlesTitle: "Wie wir deine Daten schützen",
    principles: [
      { icon: "🏠", title: "On-Premise, dedizierte Instanz", desc: "Deine Datenbank und deine Knowledge Base liegen auf deiner dedizierten Instanz. Um Antworten zu generieren, wird nur der notwendige Kontext an einen externen LLM-Anbieter gesendet, der deine Daten nicht zum Trainieren seiner Modelle nutzt. Die Daten landen weder in einem gemeinsamen Topf noch werden sie an Dritte verkauft." },
      { icon: "🔒", title: "Ende-zu-Ende-Verschlüsselung von WhatsApp", desc: "Die Nachrichten reisen über den verschlüsselten Peer-to-Peer-Kanal von WhatsApp: niemand fängt sie unterwegs ab." },
      { icon: "📲", title: "Verbindung per QR-Code", desc: "Du verbindest deine Nummer, indem du einen QR-Code scannst. Die Zugangsdaten deines WhatsApp werden von uns nicht gespeichert." },
      { icon: "🚦", title: "Anti-Missbrauch-Rate-Limiting", desc: "Webhook, Bestellungen und Checkout sind durch Frequenzlimits gegen Spam, Brute Force und DoS-Angriffe geschützt." },
      { icon: "🤖", title: "KI bei sensiblen Daten ausgeschaltet", desc: "Wenn es um Rechnungen geht oder an einen Operator übergeben wird, schaltet sich die KI ab: sensible Daten gelangen nicht zum Modell." },
      { icon: "🧱", title: "Isolierung pro Workspace", desc: "Jedes Geschäft ist isoliert: kein Datum überschreitet die Grenze von einem Kunden zum anderen." },
      { icon: "🖥️", title: "100%-lokale Option", desc: "Wenn du maximale Kontrolle willst, kann die gesamte KI lokal mit Open-Source-Modellen wie Gemma über Ollama laufen: kein Datum verlässt deine Infrastruktur. Erfordert dedizierte, leistungsstarke Server." },
    ],
    complianceTitle: "Weniger Daten, weniger Risiko",
    complianceDesc: "Wir erfassen nur die Daten, die nötig sind, damit der Dienst funktioniert: die WhatsApp-Nummer des Kunden und das Gespräch. Deine Datenbank und Knowledge Base liegen auf deiner Instanz; um Antworten zu generieren, wird der notwendige Kontext an einen externen LLM-Anbieter gesendet, der ihn nicht zum Trainieren seiner Modelle nutzt. Kein Werbe-Tracking, keine verkauften Profile.",
    complianceItems: [
      { norm: "On-Premise", region: "Deine dedizierte Instanz", status: "✅ Aktiv", features: ["Daten und Knowledge Base in deiner Umgebung", "RAG-Suche läuft auf deinen Systemen", "Antworten über einen externen LLM-Anbieter generiert (kein Training mit deinen Daten)", "Keine an Dritte verkauften Profile", "Löschung auf Anfrage"] },
    ],
    techTitle: "Konkrete Sicherheitsmaßnahmen",
    techFeatures: [
      "Verbindung zu WhatsApp per QR-Code, ohne die Zugangsdaten deiner Nummer zu speichern",
      "Nachrichten Ende-zu-Ende-verschlüsselt durch WhatsApp (Peer-to-Peer)",
      "On-Premise-Hosting auf einer dedizierten Instanz: die Daten bleiben in deiner Umgebung",
      "Datenbank und Knowledge Base on-premise; die KI-Antworten werden von einem externen LLM-Anbieter generiert, der nur den notwendigen Kontext erhält und nicht mit deinen Daten trainiert",
      "Isolierung pro Workspace: jede Abfrage filtert nach Geschäft, keine zwischen Tenants geteilten Daten",
      "Rate Limiting bei Webhook, öffentlichen Bestellungen und Checkout gegen Spam und DoS",
      "KI automatisch deaktiviert bei Rechnungen und Übergabe an einen Operator",
      "Minimale Datenerfassung: nur Nummer und Gespräch, kein Werbe-Tracking",
      "Zwei-Faktor-Authentifizierung (2FA TOTP) für den Zugang zum Dashboard",
      "100%-lokale Option: Open-Source-Modelle wie Gemma über Ollama auf deiner Infrastruktur ausgeführt, keine Daten an externe Anbieter (erfordert leistungsstarke Server)",
    ],
    twoFaTitle: "Zwei-Faktor-Authentifizierung (2FA)",
    twoFaDesc: "Schütze den Zugang zum Dashboard mit der Verifizierung in zwei Schritten. Scanne den QR-Code mit deiner Authenticator-App (Google Authenticator, Authy usw.), um deinem Konto eine zusätzliche Sicherheitsebene hinzuzufügen.",
    twoFaFeatures: [
      { icon: QrCode, label: "Einrichtung mit QR-Code", desc: "Sofortige Einrichtung: scanne den QR-Code mit deiner bevorzugten Authenticator-App, um die 2FA in Sekunden zu aktivieren." },
      { icon: Smartphone, label: "Authenticator-App kompatibel", desc: "Kompatibel mit Google Authenticator, Authy, Microsoft Authenticator und allen Standard-TOTP-Apps." },
      { icon: ShieldCheck, label: "Garantierter Zugangsschutz", desc: "Selbst wenn dein Passwort kompromittiert wird, bleibt dein Konto geschützt. Temporäre 6-stellige Codes mit 30 Sekunden Ablaufzeit." },
    ],
    rightsTitle: "Die Rechte deiner Kunden",
    rights: [
      { icon: Eye, label: "Datenzugriff", desc: "Auf Anfrage kannst du alle Gespräche und Daten eines Kunden abrufen." },
      { icon: Trash2, label: "Löschung", desc: "Die Daten eines Kunden können auf Anfrage gelöscht werden, Gespräche inbegriffen." },
      { icon: FileDown, label: "Export", desc: "Die Gespräche eines Kunden können auf Anfrage exportiert werden." },
    ],
    dataflow: {
      customer: "WhatsApp-Kunde",
      e2e: "E2E-Verschlüsselung",
      channel: "verschlüsselter Kanal",
      instanceTitle: "Deine dedizierte Instanz",
      instanceSub: "On-Premise · Daten bleiben hier",
      database: "Datenbank",
      knowledgeBase: "Knowledge Base",
      rag: "RAG-Suche auf deinen Systemen",
      isolation: "Isolierung pro Workspace",
      contextOut: "nur nötiger Kontext",
      reply: "Antwort",
      llmTitle: "Externer LLM-Anbieter",
      noTraining: "kein Training",
    },
    layers: {
      heading: "Mehrschichtige Verteidigung",
      layers: [
        { title: "Verschlüsselter Transport", sub: "WhatsApp Ende-zu-Ende", icon: "lock" },
        { title: "Isolierte Infrastruktur", sub: "On-Premise · pro Workspace", icon: "server" },
        { title: "Geschützter Zugang", sub: "2FA · Rate Limiting", icon: "key" },
        { title: "KI unter Kontrolle", sub: "Aus bei sensiblen Daten", icon: "cpu" },
      ],
    },
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
                <div className="relative rounded-3xl border border-white/10 bg-slate-900/40 p-4 shadow-2xl">
                  <PrivacyDataflowDiagram labels={t.dataflow as DataflowLabels} />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Privacy pillars */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-white text-center mb-14">{t.principlesTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {t.principles.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.09 }}
                  className="h-full p-6 bg-slate-900/50 backdrop-blur rounded-2xl shadow-2xl border border-white/10 hover:shadow-lg hover:-translate-y-1 transition-all"
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
                <div className="relative rounded-2xl border border-white/10 bg-slate-900/40 p-4 shadow-2xl">
                  <SecurityLayersDiagram labels={t.layers as SecurityLayersLabels} />
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">{t.techTitle}</h2>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {t.techFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
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

        <CtaSection
          title={t.ctaTitle}
          subtitle={t.ctaSub}
          ctaLabel={t.cta}
          gradientClassName="from-green-600 to-emerald-600"
          buttonClassName="text-green-700"
          subtitleClassName="text-green-50"
        />
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
