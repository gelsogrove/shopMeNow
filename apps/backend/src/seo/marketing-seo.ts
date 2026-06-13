/**
 * Server-side SEO meta injection for public marketing pages.
 *
 * WHY THIS EXISTS
 * The frontend is a Vite + React SPA: every per-page <title>/<meta> is rendered
 * client-side by `react-helmet-async` (see apps/frontend/src/components/SEO.tsx).
 * The Express SPA fallback, however, serves the SAME built `index.html` for every
 * non-API route — and that file carries the HOMEPAGE meta. Crawlers that do NOT
 * execute JavaScript (WhatsApp / LinkedIn / Facebook / X link-preview bots, and
 * search robustness) therefore see the homepage title/description/OG for EVERY
 * marketing URL.
 *
 * This module rewrites the SEO block of `index.html` per route, at request time,
 * with the correct per-page meta — no browser, no build step, no router refactor.
 *
 * LANGUAGE DETECTION
 * The injector reads the Accept-Language header from the request and picks the
 * best matching language among the supported ones (it, en, es, de). This means
 * Italian crawlers see Italian meta, German crawlers see German meta, etc. —
 * improving CTR in each language market without URL restructuring.
 *
 * SOURCE OF TRUTH / SYNC
 * The strings below mirror the `seoTitle/seoDesc/seoKeys` each page component
 * defines per language. When a page's copy changes, update the matching entry here.
 * The unit test pins every English entry to non-empty title+description so a new
 * marketing route can't silently ship without server-side meta.
 *
 * The injected <title> is built with `buildFullTitle`, which mirrors SEO.tsx
 * EXACTLY, so the server-rendered title matches what the client renders after
 * hydration (no flash, no divergence for JS-rendering crawlers).
 */

export const SITE_URL = "https://www.echatbot.ai"
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

export type SeoLang = "it" | "en" | "es" | "de"

export interface MarketingSeoMeta {
  /** Raw page title — same value the page passes to <SEO title=...>. */
  title: string
  /** Meta description — same value the page passes to <SEO description=...>. */
  description: string
  /** Optional comma-separated keywords. */
  keywords?: string
}

/** Route path → SEO meta, keyed by language. */
type MarketingSeoMap = Readonly<Record<string, MarketingSeoMeta>>

// ---------------------------------------------------------------------------
// Per-language SEO maps. Strings mirror the page components exactly.
// ---------------------------------------------------------------------------

const MARKETING_SEO_IT: MarketingSeoMap = {
  "/features": {
    title: "Funzionalità - Piattaforma AI Chatbot WhatsApp",
    description:
      "Scopri tutte le funzionalità di eChatbot: automazione AI, supporto umano, marketing push, integrazione CRM, e-commerce, privacy e sicurezza. La piattaforma completa per chatbot WhatsApp.",
    keywords:
      "chatbot whatsapp, ai chatbot, automazione customer service, marketing push, crm integration, ecommerce chatbot, human in the loop, privacy gdpr",
  },
  "/human-support": {
    title: "Supporto Umano Human-in-the-Loop - AI + Operatori in Sinergia",
    description:
      "eChatbot combina AI e operatori umani per offrire un supporto clienti eccezionale. Il chatbot gestisce il 90% delle richieste, gli operatori intervengono quando davvero necessario.",
    keywords:
      "human in the loop, supporto umano chatbot, chatbot operatore umano, handoff whatsapp, customer support ai, live chat whatsapp",
  },
  "/laundry-service": {
    title: "Chatbot WhatsApp per Lavanderie e Franchising - eChatbot",
    description:
      "eChatbot è la soluzione AI su misura per lavanderie e franchising: supporto 24/7, traduzione in tempo reale, integrazione con le macchine e campagne di marketing su WhatsApp.",
    keywords:
      "chatbot lavanderia, whatsapp lavanderia, assistente ia lavanderia, supporto clienti lavanderia, franchising lavanderia ai",
  },
  "/franchising": {
    title: "Chatbot WhatsApp per Franchising e Catene Multi-Sede - eChatbot",
    description:
      "Un'unica AI su WhatsApp per tutta la tua rete in franchising. Risponde 24/7, traduce in tempo reale, riconosce la sede e passa all'operatore. Per lavanderie, palestre, hotel, cliniche, autolavaggi e qualsiasi catena multi-sede.",
    keywords:
      "chatbot franchising, whatsapp multi sede, catene franchising, assistente ia franchising, chatbot palestre hotel cliniche, gestione sedi whatsapp",
  },
  "/appointment-booking": {
    title: "Prenotazione Appuntamenti AI - Prenota via WhatsApp con Promemoria Automatici",
    description:
      "eChatbot permette ai tuoi clienti di prenotare appuntamenti direttamente su WhatsApp. Gestione automatica della disponibilità, conferme istantanee e promemoria via WhatsApp. Integrazione Google Calendar.",
    keywords:
      "prenotazione appuntamenti whatsapp, booking chatbot, prenotazione ai, promemoria appuntamento whatsapp, google calendar chatbot, prenotazione automatica",
  },
  "/crm-integration": {
    title: "Integrazione CRM ERP - Connetti eChatbot con i tuoi Sistemi",
    description:
      "Integra eChatbot con Salesforce, HubSpot, Microsoft Dynamics, sistemi ERP, warehouse management e piattaforme di marketing automation. Sincronizzazione dati in tempo reale.",
    keywords:
      "integrazione crm chatbot, salesforce whatsapp, hubspot chatbot, erp chatbot, woocommerce chatbot, prestashop chatbot, magento chatbot, zapier integration",
  },
  "/team-collaboration": {
    title: "Team Collaboration - Gestione Multi-Agente per il Customer Service",
    description:
      "Coordina il tuo team di assistenza con eChatbot. Assegnazione conversazioni, ruoli e permessi, dashboard analytics, escalation ai supervisor, notifiche in tempo reale.",
    keywords:
      "team collaboration chatbot, multi agente whatsapp, gestione team customer service, assegnazione conversazioni, dashboard customer service",
  },
  "/privacy-by-design": {
    title: "Privacy by Design - I tuoi dati al sicuro | eChatbot",
    description:
      "On-premise su istanza dedicata, messaggi cifrati end-to-end da WhatsApp, AI disattivata sui dati sensibili, rate limiting anti-abuso e raccolta minima dei dati.",
    keywords:
      "privacy whatsapp chatbot, on-premise chatbot, cifratura end-to-end whatsapp, rate limiting, minimizzazione dati, sicurezza dati e-commerce",
  },
  "/contact": {
    title: "Contattaci - eChatbot",
    description:
      "Hai domande su eChatbot? Contatta il nostro team. Siamo qui per aiutarti a scegliere il piano giusto e a iniziare con il tuo chatbot WhatsApp.",
    keywords: "contattaci echatbot, supporto echatbot, chatbot whatsapp assistenza",
  },
  "/request-access": {
    title: "Richiedi una demo - eChatbot",
    description:
      "Vuoi vedere eChatbot in azione sul tuo business? Raccontaci il tuo caso d'uso e ti contattiamo entro 24 ore con una demo personalizzata.",
    keywords: "demo chatbot whatsapp, richiedi demo echatbot, demo personalizzata",
  },
  "/smart-push-ai": {
    title: "Smart Push AI - Campagne WhatsApp Intelligenti che Aumentano le Conversioni",
    description:
      "L'AI incrocia le esigenze di ogni cliente con le offerte disponibili e decide cosa inviare e quando. Messaggi mirati su WhatsApp, anti-spam intelligente, più conversioni e meno disiscrizioni.",
    keywords:
      "push whatsapp ai, campagne whatsapp, messaggi mirati whatsapp, marketing automation whatsapp, smart push, segmentazione clienti ai, anti-spam whatsapp",
  },
  "/neapolis": {
    title: "Neapolis × eChatbot.AI Partnership",
    description:
      "eChatbot.AI is looking for partners in the Neapolis network. Custom AI chatbot: development and integration always free, you only pay for plan and LLM usage.",
  },
}

const MARKETING_SEO_ES: MarketingSeoMap = {
  "/features": {
    title: "Funcionalidades - Plataforma AI Chatbot WhatsApp | eChatbot",
    description:
      "Descubre todas las funcionalidades de eChatbot: automatización IA, soporte humano, marketing push, integración CRM, e-commerce, privacidad y seguridad.",
    keywords:
      "chatbot whatsapp, ai chatbot, automatización customer service, marketing push, integración crm, chatbot ecommerce, human in the loop, privacidad gdpr",
  },
  "/human-support": {
    title: "Soporte Humano Human-in-the-Loop - IA + Agentes Humanos en Sinergia",
    description:
      "eChatbot combina IA y operadores humanos para ofrecer un soporte al cliente excepcional. El chatbot gestiona el 90% de las solicitudes, los operadores intervienen cuando es realmente necesario.",
    keywords:
      "human in the loop, soporte humano chatbot, chatbot agente humano, handoff whatsapp, soporte cliente ai, live chat whatsapp",
  },
  "/laundry-service": {
    title: "Chatbot WhatsApp para Lavanderías y Franquicias - eChatbot",
    description:
      "eChatbot es la solución de IA a medida para lavanderías y franquicias: soporte 24/7, traducción en tiempo real, integración con máquinas y campañas de marketing por WhatsApp.",
    keywords:
      "chatbot lavandería, whatsapp lavandería, asistente ia lavandería, atención al cliente lavandería, franquicia lavandería ia",
  },
  "/franchising": {
    title: "Chatbot WhatsApp para Franquicias y Cadenas Multi-Sede - eChatbot",
    description:
      "Una sola IA en WhatsApp para toda tu red de franquicias. Responde 24/7, traduce en tiempo real, reconoce la sede y pasa a un operador. Para lavanderías, gimnasios, hoteles, clínicas, autolavados y cualquier cadena multi-sede.",
    keywords:
      "chatbot franquicias, whatsapp multi sede, cadenas franquicia, asistente ia franquicia, chatbot gimnasios hoteles clinicas, gestion sedes whatsapp",
  },
  "/appointment-booking": {
    title: "Reserva de Citas con IA - Reserva por WhatsApp con Recordatorios Automáticos",
    description:
      "eChatbot permite a tus clientes reservar citas directamente en WhatsApp. Gestión automática de disponibilidad, confirmaciones instantáneas y recordatorios por WhatsApp. Integración con Google Calendar.",
    keywords:
      "reserva citas whatsapp, booking chatbot, reserva ia, recordatorio citas whatsapp, google calendar chatbot, reserva automática",
  },
  "/crm-integration": {
    title: "Integración CRM ERP - Conecta eChatbot con tus Sistemas",
    description:
      "Integra eChatbot con Salesforce, HubSpot, Microsoft Dynamics, sistemas ERP, gestión de almacenes y plataformas de marketing automation. Sincronización de datos en tiempo real.",
    keywords:
      "integración crm chatbot, salesforce whatsapp, hubspot chatbot, erp chatbot, woocommerce chatbot, prestashop chatbot, magento chatbot, zapier integration",
  },
  "/team-collaboration": {
    title: "Team Collaboration - Gestión Multi-Agente para Atención al Cliente",
    description:
      "Coordina tu equipo de soporte con eChatbot. Asignación de conversaciones, roles y permisos, panel analytics, escalación a supervisores, notificaciones en tiempo real.",
    keywords:
      "colaboración equipo chatbot, multi agente whatsapp, gestión equipo atención cliente, asignación conversaciones, panel customer service",
  },
  "/privacy-by-design": {
    title: "Privacy by Design - Tus datos a salvo | eChatbot",
    description:
      "On-premise en una instancia dedicada, mensajes cifrados de extremo a extremo por WhatsApp, IA desactivada en datos sensibles, rate limiting anti-abuso y recogida mínima de datos.",
    keywords:
      "privacidad chatbot whatsapp, chatbot on-premise, cifrado extremo a extremo whatsapp, rate limiting, minimización de datos, seguridad datos e-commerce",
  },
  "/contact": {
    title: "Contáctanos - eChatbot",
    description:
      "¿Tienes preguntas sobre eChatbot? Contacta a nuestro equipo. Estamos aquí para ayudarte a elegir el plan correcto y empezar con tu chatbot de WhatsApp.",
    keywords: "contactar echatbot, soporte echatbot, ayuda chatbot whatsapp",
  },
  "/request-access": {
    title: "Solicita una demo - eChatbot",
    description:
      "¿Quieres ver eChatbot en acción en tu negocio? Cuéntanos tu caso de uso y te contactamos en 24 horas con una demo personalizada.",
    keywords: "demo chatbot whatsapp, solicitar demo echatbot, demo personalizada",
  },
  "/smart-push-ai": {
    title: "Smart Push AI - Campañas de WhatsApp Inteligentes que Aumentan las Conversiones",
    description:
      "La IA cruza las necesidades de cada cliente con las ofertas disponibles y decide qué enviar y cuándo. Mensajes dirigidos en WhatsApp, anti-spam inteligente, más conversiones y menos bajas.",
    keywords:
      "push whatsapp ia, campañas whatsapp, mensajes dirigidos whatsapp, automatización marketing whatsapp, smart push, segmentación clientes ia, anti-spam whatsapp",
  },
  "/neapolis": {
    title: "Neapolis × eChatbot.AI Partnership",
    description:
      "eChatbot.AI is looking for partners in the Neapolis network. Custom AI chatbot: development and integration always free, you only pay for plan and LLM usage.",
  },
}

const MARKETING_SEO_DE: MarketingSeoMap = {
  "/features": {
    title: "Funktionen - KI WhatsApp Chatbot Plattform | eChatbot",
    description:
      "Entdecke alle Funktionen von eChatbot: KI-Automatisierung, menschlicher Support, Push-Marketing, CRM-Integration, E-Commerce, Datenschutz und Sicherheit.",
    keywords:
      "whatsapp chatbot, ki chatbot, customer service automatisierung, push-marketing, crm integration, ecommerce chatbot, human in the loop, datenschutz dsgvo",
  },
  "/human-support": {
    title: "Menschlicher Support Human-in-the-Loop - KI + menschliche Agenten im Zusammenspiel",
    description:
      "eChatbot kombiniert KI und menschliche Mitarbeiter für außergewöhnlichen Kundensupport. Der Chatbot bearbeitet 90% der Anfragen, die Mitarbeiter greifen ein, wenn es wirklich nötig ist.",
    keywords:
      "human in the loop, menschlicher chatbot support, chatbot menschlicher agent, whatsapp handoff, kundensupport ai, live chat whatsapp",
  },
  "/laundry-service": {
    title: "WhatsApp Chatbot für Wäschereien und Franchises - eChatbot",
    description:
      "eChatbot ist die maßgeschneiderte KI-Lösung für Wäschereien und Franchises: Support rund um die Uhr, Echtzeit-Übersetzung, Maschinen-Integration und Marketing-Kampagnen über WhatsApp.",
    keywords:
      "wäscherei chatbot, whatsapp wäscherei, ki wäscherei assistent, wäscherei kundenservice, wäscherei franchise ki",
  },
  "/franchising": {
    title: "WhatsApp-Chatbot für Franchising und Multi-Standort-Ketten - eChatbot",
    description:
      "Eine einzige KI auf WhatsApp für dein gesamtes Franchise-Netzwerk. Antwortet 24/7, übersetzt in Echtzeit, erkennt den Standort und übergibt an einen Mitarbeiter. Für Wäschereien, Fitnessstudios, Hotels, Kliniken, Autowaschanlagen und jede Multi-Standort-Kette.",
    keywords:
      "franchising chatbot, whatsapp multi standort, franchise ketten, ki assistent franchise, chatbot fitnessstudio hotel klinik, standortverwaltung whatsapp",
  },
  "/appointment-booking": {
    title: "KI-Terminbuchung - Buche per WhatsApp mit automatischen Erinnerungen",
    description:
      "eChatbot ermöglicht es deinen Kunden, Termine direkt über WhatsApp zu buchen. Automatische Verwaltung der Verfügbarkeit, sofortige Bestätigungen und Erinnerungen per WhatsApp. Google Calendar Integration.",
    keywords:
      "whatsapp terminbuchung, booking chatbot, ki terminbuchung, terminerinnerung whatsapp, google calendar chatbot, automatische terminbuchung",
  },
  "/crm-integration": {
    title: "CRM-ERP-Integration - Verbinde eChatbot mit deinen Systemen",
    description:
      "Integriere eChatbot mit Salesforce, HubSpot, Microsoft Dynamics, ERP-Systemen, Lagerverwaltung und Marketing-Automation-Plattformen. Datensynchronisation in Echtzeit.",
    keywords:
      "crm chatbot integration, salesforce whatsapp, hubspot chatbot, erp chatbot, woocommerce chatbot, prestashop chatbot, magento chatbot, zapier integration",
  },
  "/team-collaboration": {
    title: "Team Collaboration - Multi-Agenten-Verwaltung für den Customer Service",
    description:
      "Koordiniere dein Support-Team mit eChatbot. Zuweisung von Konversationen, Rollen und Berechtigungen, Analytics-Dashboard, Eskalation an Supervisoren, Benachrichtigungen in Echtzeit.",
    keywords:
      "team-zusammenarbeit chatbot, multi agent whatsapp, customer service team verwaltung, zuweisung konversationen, customer service dashboard",
  },
  "/privacy-by-design": {
    title: "Privacy by Design - Deine Daten sicher | eChatbot",
    description:
      "On-Premise auf einer dedizierten Instanz, Ende-zu-Ende-verschlüsselte Nachrichten über WhatsApp, KI bei sensiblen Daten deaktiviert, Anti-Missbrauch-Rate-Limiting und minimale Datenerfassung.",
    keywords:
      "privacy whatsapp chatbot, on-premise chatbot, whatsapp ende-zu-ende-verschlüsselung, rate limiting, datenminimierung, datensicherheit e-commerce",
  },
  "/contact": {
    title: "Kontakt - eChatbot",
    description:
      "Hast du Fragen zu eChatbot? Kontaktiere unser Team. Wir helfen dir, den richtigen Plan zu wählen und mit deinem WhatsApp-Chatbot zu starten.",
    keywords: "kontakt echatbot, echatbot support, whatsapp chatbot hilfe",
  },
  "/request-access": {
    title: "Demo anfragen - eChatbot",
    description:
      "Willst du eChatbot in Aktion für dein Business sehen? Erzähl uns von deinem Anwendungsfall und wir melden uns innerhalb von 24 Stunden mit einer maßgeschneiderten Demo.",
    keywords: "whatsapp chatbot demo, demo anfragen echatbot, individuelle demo",
  },
  "/smart-push-ai": {
    title: "Smart Push AI - Intelligente WhatsApp-Kampagnen, die deine Conversions steigern",
    description:
      "Die KI gleicht die Bedürfnisse jedes Kunden mit den verfügbaren Angeboten ab und entscheidet, was wann gesendet wird. Gezielte WhatsApp-Nachrichten, intelligenter Anti-Spam, mehr Conversions und weniger Abmeldungen.",
    keywords:
      "whatsapp push ki, whatsapp kampagnen, gezielte whatsapp nachrichten, whatsapp marketing automation, smart push, ki kundensegmentierung, whatsapp anti-spam",
  },
  "/neapolis": {
    title: "Neapolis × eChatbot.AI Partnership",
    description:
      "eChatbot.AI is looking for partners in the Neapolis network. Custom AI chatbot: development and integration always free, you only pay for plan and LLM usage.",
  },
}

/**
 * English SEO map — also the canonical fallback for unknown languages.
 * The unit test pins every entry here to non-empty title+description.
 */
export const MARKETING_SEO: MarketingSeoMap = {
  "/features": {
    title: "Features - AI WhatsApp Chatbot Platform | eChatbot",
    description:
      "Discover all eChatbot features: AI automation, human support, push marketing, CRM integration, e-commerce, privacy and security. The complete platform for WhatsApp chatbots.",
    keywords:
      "whatsapp chatbot, ai chatbot, customer service automation, push marketing, crm integration, ecommerce chatbot, human in the loop, privacy gdpr",
  },
  "/human-support": {
    title: "Human Support Human-in-the-Loop - AI + Human Agents in Synergy",
    description:
      "eChatbot combines AI and human operators to offer exceptional customer support. The chatbot handles 90% of requests, operators step in when truly needed.",
    keywords:
      "human in the loop, human chatbot support, chatbot human agent, whatsapp handoff, customer support ai, live chat whatsapp",
  },
  "/laundry-service": {
    title: "WhatsApp Chatbot for Laundry Franchises - eChatbot",
    description:
      "eChatbot is the custom AI solution for laundry franchises: 24/7 support, real-time translation, machine integration and WhatsApp marketing campaigns.",
    keywords:
      "laundry chatbot, whatsapp laundry, ai laundry assistant, laundry customer support, laundry franchise ai",
  },
  "/franchising": {
    title: "WhatsApp Chatbot for Franchises & Multi-Location Chains - eChatbot",
    description:
      "One AI on WhatsApp for your whole franchise network. Answers 24/7, translates in real time, detects the location and hands off to an operator. For laundries, gyms, hotels, clinics, car washes and any multi-location chain.",
    keywords:
      "franchise chatbot, multi location whatsapp, franchise chains, franchise ai assistant, gym hotel clinic chatbot, location management whatsapp",
  },
  "/appointment-booking": {
    title: "AI Appointment Booking - Book via WhatsApp with Automatic Reminders",
    description:
      "eChatbot lets your customers book appointments directly on WhatsApp. Automatic availability management, instant confirmations, and WhatsApp reminders. Google Calendar integration.",
    keywords:
      "whatsapp appointment booking, booking chatbot, ai booking, appointment reminder whatsapp, google calendar chatbot, automatic booking",
  },
  "/crm-integration": {
    title: "CRM ERP Integration - Connect eChatbot with Your Systems",
    description:
      "Integrate eChatbot with Salesforce, HubSpot, Microsoft Dynamics, ERP systems, warehouse management and marketing automation platforms. Real-time data synchronization.",
    keywords:
      "crm chatbot integration, salesforce whatsapp, hubspot chatbot, erp chatbot, woocommerce chatbot, prestashop chatbot, magento chatbot, zapier integration",
  },
  "/team-collaboration": {
    title: "Team Collaboration - Multi-Agent Management for Customer Service",
    description:
      "Coordinate your customer support team with eChatbot. Conversation assignment, roles and permissions, analytics dashboard, escalation to supervisors, real-time notifications.",
    keywords:
      "team collaboration chatbot, multi agent whatsapp, customer service team management, conversation assignment, customer service dashboard",
  },
  "/privacy-by-design": {
    title: "Privacy by Design - GDPR Compliance and Data Security | eChatbot",
    description:
      "eChatbot is built with Privacy by Design. GDPR compliance. End-to-end encryption, configurable data retention, right to erasure, data export on request.",
    keywords:
      "privacy by design gdpr whatsapp chatbot, gdpr compliance chatbot, whatsapp conversation data protection, e-commerce data security",
  },
  "/contact": {
    title: "Contact Us - eChatbot",
    description:
      "Have questions about eChatbot? Contact our team. We're here to help you choose the right plan and get started with your WhatsApp chatbot.",
    keywords: "contact echatbot, echatbot support, whatsapp chatbot help",
  },
  "/request-access": {
    title: "Request a demo - eChatbot",
    description:
      "Want to see eChatbot in action for your business? Tell us about your use case and we'll get back within 24 hours with a tailored demo.",
    keywords: "whatsapp chatbot demo, request demo echatbot, custom demo",
  },
  "/smart-push-ai": {
    title: "Smart Push AI - Intelligent WhatsApp Campaigns that Boost Conversions",
    description:
      "AI matches each customer's needs with available offers and decides what to send and when. Targeted WhatsApp messages, smart anti-spam, more conversions and fewer opt-outs.",
    keywords:
      "whatsapp push ai, whatsapp campaigns, targeted whatsapp messages, whatsapp marketing automation, smart push, ai customer segmentation, whatsapp anti-spam",
  },
  "/neapolis": {
    title: "Neapolis × eChatbot.AI Partnership",
    description:
      "eChatbot.AI is looking for partners in the Neapolis network. Custom AI chatbot: development and integration always free, you only pay for plan and LLM usage.",
  },
}

const SEO_BY_LANG: Record<SeoLang, MarketingSeoMap> = {
  it: MARKETING_SEO_IT,
  es: MARKETING_SEO_ES,
  de: MARKETING_SEO_DE,
  en: MARKETING_SEO,
}

const OG_LOCALE: Record<SeoLang, string> = {
  it: "it_IT",
  es: "es_ES",
  de: "de_DE",
  en: "en_US",
}

/**
 * Parse the Accept-Language header and return the best supported language.
 * Supported: it, en, es, de. Falls back to "en".
 *
 * Handles the standard format: "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
 */
export function pickSeoLang(acceptLanguage: string | undefined): SeoLang {
  if (!acceptLanguage) return "en"
  const supported: SeoLang[] = ["it", "es", "de", "en"]
  // Parse each token, e.g. "it-IT;q=0.9" → { lang: "it", q: 0.9 }
  const tokens = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=")
      const base = tag.split("-")[0].toLowerCase()
      return { lang: base, q: q ? parseFloat(q) : 1.0 }
    })
    .sort((a, b) => b.q - a.q)

  for (const { lang } of tokens) {
    if ((supported as string[]).includes(lang)) return lang as SeoLang
  }
  return "en"
}

/**
 * Mirror of SEO.tsx `fullTitle` logic, byte-for-byte: strip a trailing
 * ` | eChatbot...` suffix from the raw title, then append the canonical suffix.
 * Keeping this identical to the client guarantees the server-rendered <title>
 * matches the hydrated one.
 */
export function buildFullTitle(title: string): string {
  const cleanTitle = title.replace(/\s*\|\s*eChatbot.*$/i, "").trim()
  return `${cleanTitle} | eChatbot - AI WhatsApp Chatbot`
}

/** Escape a string for safe insertion inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Normalize a request path: drop query/hash and any trailing slash (except root). */
export function normalizePath(path: string): string {
  const noQuery = path.split("?")[0].split("#")[0]
  if (noQuery.length > 1 && noQuery.endsWith("/")) {
    return noQuery.slice(0, -1)
  }
  return noQuery
}

/**
 * Render the SEO <head> block (between the index.html markers) for a known
 * marketing route. Produces title + description + keywords + canonical + robots
 * + Open Graph + Twitter, matching the tag set SEO.tsx emits client-side.
 */
export function renderMarketingHead(
  path: string,
  meta: MarketingSeoMeta,
  lang: SeoLang = "en"
): string {
  const fullUrl = `${SITE_URL}${path}`
  const fullTitle = buildFullTitle(meta.title)
  const t = escapeAttr(fullTitle)
  const d = escapeAttr(meta.description)
  const locale = OG_LOCALE[lang]
  const lines: string[] = [
    `<link rel="canonical" href="${fullUrl}" />`,
    `<title>${escapeAttr(fullTitle)}</title>`,
    `<meta name="title" content="${t}" />`,
    `<meta name="description" content="${d}" />`,
  ]
  if (meta.keywords) {
    lines.push(`<meta name="keywords" content="${escapeAttr(meta.keywords)}" />`)
  }
  lines.push(
    `<meta name="author" content="eChatbot" />`,
    `<meta name="robots" content="index, follow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${fullUrl}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${DEFAULT_OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:site_name" content="eChatbot" />`,
    `<meta property="og:locale" content="${locale}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:url" content="${fullUrl}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />`
  )
  return lines.map((l) => `    ${l}`).join("\n")
}

/** Markers in index.html that delimit the swappable SEO block. */
export const SEO_BLOCK_START = "<!-- SEO:START -->"
export const SEO_BLOCK_END = "<!-- SEO:END -->"
const SEO_BLOCK_RE = /<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/

/**
 * Inject per-route marketing meta into an index.html template.
 *
 * - Known marketing route → the SEO marker block is replaced with that route's tags
 *   in the detected language (from Accept-Language header).
 * - Unknown route (auth/app/homepage) → template returned UNCHANGED, so it keeps
 *   the default homepage meta exactly as today.
 *
 * Safe to call on a template that lacks the markers: it returns the template
 * unchanged (the replace simply finds no match).
 */
export function injectMarketingHead(
  template: string,
  path: string,
  acceptLanguage?: string
): string {
  const normalizedPath = normalizePath(path)
  const lang = pickSeoLang(acceptLanguage)
  const langMap = SEO_BY_LANG[lang]
  const meta = langMap[normalizedPath] ?? MARKETING_SEO[normalizedPath]
  if (!meta) {
    return template
  }
  const block = `${SEO_BLOCK_START}\n${renderMarketingHead(
    normalizedPath,
    meta,
    lang
  )}\n    ${SEO_BLOCK_END}`
  return template.replace(SEO_BLOCK_RE, block)
}
