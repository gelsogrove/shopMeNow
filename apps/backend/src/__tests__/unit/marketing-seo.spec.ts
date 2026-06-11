/**
 * Marketing SEO server-side injection tests.
 *
 * Purpose: pin the behaviour of the per-route SEO meta injection used by the
 * Express SPA fallback (apps/backend/src/seo/marketing-seo.ts). These are pure
 * function tests — no DB, no HTTP — plus one guard that runs the injector against
 * the REAL apps/frontend/index.html so the markers can't silently drift out of
 * sync with the module.
 *
 * WHY this matters: the SPA serves the same index.html for every route; without
 * this injection every marketing URL would expose the homepage <title>/OG to
 * non-JS crawlers (WhatsApp/LinkedIn/Facebook/X previews).
 */

import fs from "fs"
import path from "path"
import {
  MARKETING_SEO,
  SEO_BLOCK_START,
  SEO_BLOCK_END,
  buildFullTitle,
  injectMarketingHead,
  normalizePath,
  renderMarketingHead,
  SITE_URL,
} from "../../seo/marketing-seo"

// A minimal template that mirrors the real index.html SEO block structure.
const TEMPLATE = [
  "<head>",
  "  <meta charset=\"UTF-8\" />",
  `  ${SEO_BLOCK_START}`,
  '  <link rel="canonical" href="https://www.echatbot.ai/" />',
  "  <title>HOMEPAGE TITLE</title>",
  '  <meta name="description" content="HOMEPAGE DESC" />',
  '  <meta property="og:title" content="HOMEPAGE OG" />',
  `  ${SEO_BLOCK_END}`,
  "</head>",
].join("\n")

describe("buildFullTitle — mirrors SEO.tsx exactly", () => {
  it("strips a trailing ' | eChatbot...' suffix and re-appends the canonical suffix", () => {
    // RULE: SEO.tsx removes any '| eChatbot…' tail, then adds the fixed suffix.
    expect(buildFullTitle("Features - AI WhatsApp Chatbot Platform | eChatbot")).toBe(
      "Features - AI WhatsApp Chatbot Platform | eChatbot - AI WhatsApp Chatbot"
    )
  })

  it("appends the suffix when the title has no pipe (mirrors the live client render)", () => {
    // ' - eChatbot' is NOT stripped by SEO.tsx (only the pipe form is), so the
    // server must reproduce the same slightly-redundant title the client ships.
    expect(buildFullTitle("Contact Us - eChatbot")).toBe(
      "Contact Us - eChatbot | eChatbot - AI WhatsApp Chatbot"
    )
  })
})

describe("normalizePath", () => {
  it("drops the query string", () => {
    expect(normalizePath("/features?utm=x")).toBe("/features")
  })

  it("drops a trailing slash but keeps the root", () => {
    expect(normalizePath("/features/")).toBe("/features")
    expect(normalizePath("/")).toBe("/")
  })
})

describe("MARKETING_SEO map integrity", () => {
  it("every entry has a non-empty title and description", () => {
    // GUARD: a new marketing route can't ship without server-side meta.
    for (const [route, meta] of Object.entries(MARKETING_SEO)) {
      expect(route.startsWith("/")).toBe(true)
      expect(meta.title.trim().length).toBeGreaterThan(0)
      expect(meta.description.trim().length).toBeGreaterThan(0)
    }
  })

  it("includes the known public marketing routes", () => {
    // These are the routes wired in apps/frontend/src/App.tsx as public SEO pages.
    const expected = [
      "/features",
      "/human-support",
      "/laundry-service",
      "/franchising",
      "/appointment-booking",
      "/crm-integration",
      "/team-collaboration",
      "/privacy-by-design",
      "/contact",
      "/request-access",
      "/neapolis",
    ]
    for (const route of expected) {
      expect(MARKETING_SEO[route]).toBeDefined()
    }
  })
})

describe("renderMarketingHead", () => {
  it("emits canonical, title, description and OG/Twitter tags for the route", () => {
    const html = renderMarketingHead("/features", MARKETING_SEO["/features"])
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/features" />`)
    expect(html).toContain(
      "<title>Features - AI WhatsApp Chatbot Platform | eChatbot - AI WhatsApp Chatbot</title>"
    )
    expect(html).toContain('<meta name="description" content="Discover all eChatbot features')
    expect(html).toContain(`<meta property="og:url" content="${SITE_URL}/features" />`)
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
  })

  it("escapes HTML-special characters in attribute values", () => {
    // The franchising title contains '&'; it must be emitted as &amp; inside attrs.
    const html = renderMarketingHead("/franchising", MARKETING_SEO["/franchising"])
    expect(html).toContain("Multi-Location Chains")
    expect(html).toContain("&amp;")
    expect(html).not.toContain('content="WhatsApp Chatbot for Franchises & Multi')
  })

  it("omits the keywords tag when the route has no keywords", () => {
    const html = renderMarketingHead("/neapolis", MARKETING_SEO["/neapolis"])
    expect(html).not.toContain('name="keywords"')
  })
})

describe("injectMarketingHead", () => {
  it("replaces the marker block for a known marketing route", () => {
    const out = injectMarketingHead(TEMPLATE, "/features")
    // Homepage defaults are gone…
    expect(out).not.toContain("HOMEPAGE TITLE")
    expect(out).not.toContain("HOMEPAGE OG")
    // …replaced by the route's meta.
    expect(out).toContain(
      "<title>Features - AI WhatsApp Chatbot Platform | eChatbot - AI WhatsApp Chatbot</title>"
    )
    expect(out).toContain(`<meta property="og:url" content="${SITE_URL}/features" />`)
    // Markers are preserved so the block stays swappable.
    expect(out).toContain(SEO_BLOCK_START)
    expect(out).toContain(SEO_BLOCK_END)
    // Content outside the block is untouched.
    expect(out).toContain('<meta charset="UTF-8" />')
  })

  it("normalizes the path (query + trailing slash) before lookup", () => {
    const out = injectMarketingHead(TEMPLATE, "/contact/?ref=mail")
    expect(out).toContain(
      "<title>Contact Us - eChatbot | eChatbot - AI WhatsApp Chatbot</title>"
    )
  })

  it("returns the template UNCHANGED for the homepage", () => {
    expect(injectMarketingHead(TEMPLATE, "/")).toBe(TEMPLATE)
  })

  it("returns the template UNCHANGED for an unknown / app route", () => {
    expect(injectMarketingHead(TEMPLATE, "/chat")).toBe(TEMPLATE)
    expect(injectMarketingHead(TEMPLATE, "/login")).toBe(TEMPLATE)
  })

  it("returns the template unchanged when the markers are absent", () => {
    const noMarkers = "<head><title>x</title></head>"
    expect(injectMarketingHead(noMarkers, "/features")).toBe(noMarkers)
  })
})

describe("injection against the REAL apps/frontend/index.html", () => {
  // Locate the real template from the backend test's location:
  // apps/backend/src/__tests__/unit → repo root → apps/frontend/index.html
  const indexPath = path.resolve(
    __dirname,
    "../../../../frontend/index.html"
  )

  it("the real index.html still contains both SEO markers", () => {
    const html = fs.readFileSync(indexPath, "utf-8")
    expect(html).toContain(SEO_BLOCK_START)
    expect(html).toContain(SEO_BLOCK_END)
  })

  it("injects a marketing route's title into the real template", () => {
    const html = fs.readFileSync(indexPath, "utf-8")
    const out = injectMarketingHead(html, "/laundry-service")
    expect(out).toContain(
      "<title>WhatsApp Chatbot for Laundry Franchises - eChatbot | eChatbot - AI WhatsApp Chatbot</title>"
    )
    // The homepage's default title must no longer be present.
    expect(out).not.toContain(
      "<title>eChatbot — Custom WhatsApp AI Chatbots for Your Business</title>"
    )
  })

  it("leaves the real template byte-identical for the homepage", () => {
    const html = fs.readFileSync(indexPath, "utf-8")
    expect(injectMarketingHead(html, "/")).toBe(html)
  })
})
