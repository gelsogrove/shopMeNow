import { describe, it, expect } from "vitest"
import { isPublicGuardExemptPath, PUBLIC_PATH_PREFIXES } from "../../src/App"

// Regression test for the demowash "/demo/<slug> redirects to /" bug.
//
// WHAT: TokenExpiryGuard runs globally on every route. It calls
//   storage.isTokenExpired(), which returns `true` whenever the main-app JWT
//   is missing. Public demo/operator pages authenticate with their OWN token
//   (playgroundToken / token-in-URL), NOT the main-app JWT — so for those
//   visitors isTokenExpired() is always true and the guard would bounce them
//   to "/" the instant the page mounts.
//
// WHY: isPublicGuardExemptPath() is the exemption the guard consults before
//   redirecting. These assertions pin the exact public-route contract so a
//   future edit that drops a prefix (re-introducing the redirect bug) fails
//   here instead of silently breaking the live demo.
describe("isPublicGuardExemptPath — TokenExpiryGuard exemptions", () => {
  it("exempts the demowash demo route (the original regression)", () => {
    expect(isPublicGuardExemptPath("/demo/demowash")).toBe(true)
    expect(isPublicGuardExemptPath("/demo/demowash/kanban")).toBe(true)
  })

  it("exempts every public standalone route family", () => {
    // ecolaundry demo, operator dashboard and support chat are all public,
    // token-less-from-the-main-app pages and must be skipped too.
    expect(isPublicGuardExemptPath("/demo/ecolaundry")).toBe(true)
    expect(isPublicGuardExemptPath("/support-chat")).toBe(true)
    expect(isPublicGuardExemptPath("/operator-dashboard")).toBe(true)
  })

  it("does NOT exempt authenticated app routes — the guard must still police them", () => {
    expect(isPublicGuardExemptPath("/chat")).toBe(false)
    expect(isPublicGuardExemptPath("/analytics")).toBe(false)
    expect(isPublicGuardExemptPath("/workspace-selection")).toBe(false)
    expect(isPublicGuardExemptPath("/")).toBe(false)
  })

  it("does NOT exempt look-alike paths that merely contain a prefix mid-string", () => {
    // startsWith — not includes — so a path like "/not/demo/x" stays policed.
    expect(isPublicGuardExemptPath("/not/demo/x")).toBe(false)
    expect(isPublicGuardExemptPath("/fake-support-chat")).toBe(false)
  })

  it("keeps the exemption list to the known public route families", () => {
    expect(PUBLIC_PATH_PREFIXES).toEqual([
      "/demo/",
      "/support-chat",
      "/operator-dashboard",
    ])
  })
})
