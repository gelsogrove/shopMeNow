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
 * SOURCE OF TRUTH / SYNC
 * The strings below mirror the DEFAULT-LANGUAGE (English) `seoTitle/seoDesc/seoKeys`
 * each page passes to <SEO>. A non-JS crawler always sees the English render
 * (lang="en" in index.html), so English is the correct server-side default. When a
 * page's English SEO copy changes, update the matching entry here. The unit test
 * pins every entry to a non-empty title+description so a new marketing route can't
 * silently ship without server-side meta.
 *
 * The injected <title> is built with `buildFullTitle`, which mirrors SEO.tsx
 * EXACTLY, so the server-rendered title matches what the client renders after
 * hydration (no flash, no divergence for JS-rendering crawlers).
 */

export const SITE_URL = "https://www.echatbot.ai"
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

export interface MarketingSeoMeta {
  /** Raw page title — same value the page passes to <SEO title=...> (English). */
  title: string
  /** Meta description — same value the page passes to <SEO description=...> (English). */
  description: string
  /** Optional comma-separated keywords. */
  keywords?: string
}

/**
 * Route path → English SEO meta. Keys are the exact React Router paths.
 * Only PUBLIC marketing pages are listed; auth/app/protected routes intentionally
 * fall through to the homepage meta (they are noindex-by-nature and not SEO targets).
 *
 * Routes that redirect to "/" (e.g. /pricing, /widget-to-whatsapp) are omitted.
 */
export const MARKETING_SEO: Readonly<Record<string, MarketingSeoMeta>> = {
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
export function renderMarketingHead(path: string, meta: MarketingSeoMeta): string {
  const fullUrl = `${SITE_URL}${path}`
  const fullTitle = buildFullTitle(meta.title)
  const t = escapeAttr(fullTitle)
  const d = escapeAttr(meta.description)
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
    `<meta property="og:locale" content="en_US" />`,
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
 * - Known marketing route → the SEO marker block is replaced with that route's tags.
 * - Unknown route (auth/app/homepage) → template returned UNCHANGED, so it keeps
 *   the default homepage meta exactly as today.
 *
 * Safe to call on a template that lacks the markers: it returns the template
 * unchanged (the replace simply finds no match).
 */
export function injectMarketingHead(template: string, path: string): string {
  const meta = MARKETING_SEO[normalizePath(path)]
  if (!meta) {
    return template
  }
  const block = `${SEO_BLOCK_START}\n${renderMarketingHead(
    normalizePath(path),
    meta
  )}\n    ${SEO_BLOCK_END}`
  return template.replace(SEO_BLOCK_RE, block)
}
