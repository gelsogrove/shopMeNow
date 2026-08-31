/**
 * Outbound Link Guard — unit tests
 *
 * WHAT: verifies the deterministic security layer that strips unauthorized
 * URLs from OUTBOUND bot messages before they reach the customer.
 *
 * WHY: the LLM-based SecurityAgent is probabilistic and fails OPEN (on JSON
 * parse errors it allows the message). Andrea's requirement: a link whose
 * domain is not in workspace.allowedExternalLinks must NEVER go out. That
 * guarantee has to live in code (iron rule #16), so this guard runs on every
 * channel (widget, WhatsApp, playground) inside ChatEngine.routeMessage.
 *
 * Matching semantics mirror SecurityAgent.isAllowedUrl so the two layers
 * never disagree: exact hostname, www-equivalence, and path-prefix entries
 * with trailing wildcard (e.g. "echatbot.ai/s/*").
 */

import {
  INTERNAL_ALLOWED_DOMAINS,
  findUnauthorizedUrls,
  isUrlAllowed,
  sanitizeOutboundLinks,
} from "../../application/chat-engine/outbound-link-guard"

describe("isUrlAllowed", () => {
  const allowed = ["stripe.com", "www.paypal.com", "echatbot.ai/s/*"]

  it("allows an exact hostname match", () => {
    // WHY: the base case — a workspace listing "stripe.com" expects payment
    // links to that domain to pass.
    expect(isUrlAllowed("https://stripe.com/pay/123", allowed)).toBe(true)
  })

  it("allows the www variant of a bare-domain entry", () => {
    // WHY: the LLM often emits www. links even when the config lists the bare
    // domain; blocking those would be a false positive visible to customers.
    expect(isUrlAllowed("https://www.stripe.com/pay/123", allowed)).toBe(true)
  })

  it("allows the bare-domain variant of a www entry", () => {
    // WHY: symmetric case — config says "www.paypal.com", link is bare.
    expect(isUrlAllowed("https://paypal.com/checkout", allowed)).toBe(true)
  })

  it("blocks a subdomain of an allowed domain", () => {
    // WHY: same semantics as SecurityAgent — "stripe.com" does NOT authorize
    // "evil.stripe.com.attacker.io" nor arbitrary subdomains. Only the exact
    // host (and its www twin) is trusted.
    expect(isUrlAllowed("https://evil.stripe.com/pay", allowed)).toBe(false)
  })

  it("blocks a domain that merely CONTAINS an allowed domain", () => {
    // WHY: classic phishing pattern — "stripe.com.evil.io" would pass a naive
    // substring check (the old test suite proved includes() is exploitable).
    expect(isUrlAllowed("https://stripe.com.evil.io/pay", allowed)).toBe(false)
  })

  it("matches path-prefix entries with trailing wildcard", () => {
    // WHY: platform short links are configured as "echatbot.ai/s/*" — any
    // short code under that path must pass.
    expect(isUrlAllowed("https://echatbot.ai/s/p3vN8s", allowed)).toBe(true)
    expect(isUrlAllowed("https://www.echatbot.ai/s/p3vN8s", allowed)).toBe(true)
  })

  it("blocks an unrelated domain", () => {
    expect(isUrlAllowed("https://malicious-site.com/phish", allowed)).toBe(false)
  })

  it("blocks an unparseable URL", () => {
    // WHY: fail-safe — if we cannot even parse it, it must not go out.
    expect(isUrlAllowed("https://", allowed)).toBe(false)
  })
})

describe("findUnauthorizedUrls", () => {
  // WHAT: the FAIL-CLOSED companion of sanitizeOutboundLinks — reports which
  // URLs violate the allow-list instead of stripping them, so the caller can
  // BLOCK (queue send of push campaigns) or REJECT (campaign creation).
  //
  // WHY: chat replies degrade gracefully (strip the link, keep the answer),
  // but a marketing push without its link is broken — Andrea, 2026-08-31:
  // external content must never leave the channel, and the LLM SecurityAgent
  // is fail-open, so this is the deterministic guarantee (CLAUDE.md §16).
  const allowed = ["visitsappada.it"]

  it("returns empty for a message whose links are all allowed (workspace list + internal domains)", () => {
    const msg =
      "Scopri gli eventi: https://visitsappada.it/eventi e il tuo profilo https://echatbot.ai/customer-profile"
    expect(findUnauthorizedUrls(msg, allowed)).toEqual([])
  })

  it("returns every unauthorized URL, in order, leaving the allowed ones out", () => {
    const msg =
      "Offerta: https://visitsappada.it/offerte ma anche https://evil.example.com/a e https://phish.io/b"
    expect(findUnauthorizedUrls(msg, allowed)).toEqual([
      "https://evil.example.com/a",
      "https://phish.io/b",
    ])
  })

  it("returns empty for a message with no URLs and for an empty message", () => {
    expect(findUnauthorizedUrls("Nessun link qui", allowed)).toEqual([])
    expect(findUnauthorizedUrls("", allowed)).toEqual([])
  })
})

describe("sanitizeOutboundLinks", () => {
  it("returns the message untouched when it contains no URLs", () => {
    const msg = "Ciao! Il tuo ordine è confermato."
    const result = sanitizeOutboundLinks(msg, [])
    expect(result.message).toBe(msg)
    expect(result.removedUrls).toEqual([])
  })

  it("returns the message untouched when all URLs are allowed", () => {
    // WHY: no-op path must be byte-identical — the guard must never corrupt
    // legitimate replies (rule 13: don't touch what works).
    const msg = "Paga qui: https://stripe.com/pay/123 grazie!"
    const result = sanitizeOutboundLinks(msg, ["stripe.com"])
    expect(result.message).toBe(msg)
    expect(result.removedUrls).toEqual([])
  })

  it("always allows platform-internal domains without workspace config", () => {
    // WHY: short links / registration / cart links are generated by the
    // platform itself — stripping them would break core flows (registration,
    // checkout) on every workspace with an empty allowedExternalLinks.
    const msg = "Registrati: https://echatbot.ai/registration/abc123"
    const result = sanitizeOutboundLinks(msg, [])
    expect(result.message).toBe(msg)
    expect(result.removedUrls).toEqual([])
  })

  it("removes an unauthorized URL and reports it", () => {
    // WHY: the core requirement — "non possono uscire link che non sono
    // autorizzati". The URL disappears, the rest of the sentence survives.
    const msg = "Guarda qui: https://malicious-site.com/phish per maggiori info"
    const result = sanitizeOutboundLinks(msg, ["stripe.com"])
    expect(result.message).not.toContain("malicious-site.com")
    expect(result.message).toContain("per maggiori info")
    expect(result.removedUrls).toEqual(["https://malicious-site.com/phish"])
  })

  it("removes only the unauthorized URLs in a mixed message", () => {
    // WHY: one bad link must not nuke the good ones — the customer still
    // needs the legitimate payment link.
    const msg =
      "Paga su https://stripe.com/pay/1 oppure https://evil.io/pay adesso"
    const result = sanitizeOutboundLinks(msg, ["stripe.com"])
    expect(result.message).toContain("https://stripe.com/pay/1")
    expect(result.message).not.toContain("evil.io")
    expect(result.removedUrls).toEqual(["https://evil.io/pay"])
  })

  it("injects NO replacement text for removed links", () => {
    // WHY: rule 1A — no hardcoded customer-facing copy in code, in any
    // language. Silence over untranslated English: the link is dropped,
    // nothing is written in its place.
    const msg = "Clicca https://evil.io/x"
    const result = sanitizeOutboundLinks(msg, [])
    expect(result.message).toBe("Clicca")
  })

  it("collapses double spaces left by a removed mid-sentence URL", () => {
    // WHY: readability — "vai su  e conferma" (double space) looks broken;
    // the guard tidies whitespace so the remaining sentence stays clean.
    const msg = "Vai su https://evil.io/x e conferma"
    const result = sanitizeOutboundLinks(msg, [])
    expect(result.message).toBe("Vai su e conferma")
  })

  it("handles multiline messages, checking every line", () => {
    // WHY: bot replies are frequently multi-line (lists, order summaries) —
    // the regex must catch URLs on any line, not only the first.
    const msg = "Riga 1 https://echatbot.ai/cart/9\nRiga 2 https://evil.io/y"
    const result = sanitizeOutboundLinks(msg, [])
    expect(result.message).toContain("https://echatbot.ai/cart/9")
    expect(result.message).not.toContain("evil.io")
  })

  it("exposes the platform-internal domain list", () => {
    // WHY: lock the invariant that echatbot.ai is always trusted — if someone
    // empties this list, registration/cart links break platform-wide.
    expect(INTERNAL_ALLOWED_DOMAINS).toContain("echatbot.ai")
  })
})
