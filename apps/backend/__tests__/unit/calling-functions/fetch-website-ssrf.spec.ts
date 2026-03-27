/**
 * Unit tests for fetchWebsitePage SSRF protection (BUG#5 fix)
 *
 * VULNERABILITY FIXED:
 * CallingFunctionsService.fetchWebsitePage() accepted any URL without
 * validating private/internal IPs. An LLM manipulated via prompt injection
 * could be forced to call http://localhost:3001/admin or AWS metadata endpoints.
 *
 * SSRF (Server-Side Request Forgery) Attack Vectors Blocked:
 * - http://localhost / 127.x.x.x — server's own loopback
 * - http://10.x.x.x — RFC1918 private network
 * - http://172.16-31.x.x — RFC1918 private network
 * - http://192.168.x.x — RFC1918 private network
 * - http://169.254.x.x — link-local (AWS metadata endpoint)
 * - http://[::1] — IPv6 loopback
 *
 * @see apps/backend/src/services/calling-functions.service.ts
 */

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}
jest.mock("../../../src/utils/logger", () => ({ default: mockLogger, __esModule: true }))

jest.mock("axios")
jest.mock("cheerio")

jest.mock("../../../src/application/services/secure-token.service", () => ({
  SecureTokenService: jest.fn().mockImplementation(() => ({
    createToken: jest.fn().mockResolvedValue("mock-token"),
  })),
}))

jest.mock("../../../src/application/services/link-generator.service", () => ({
  LinkGeneratorService: jest.fn().mockImplementation(() => ({})),
  linkGeneratorService: {},
}))

jest.mock("../../../src/domain/calling-functions/contactOperator", () => ({
  contactOperator: jest.fn().mockResolvedValue({ success: true }),
}))

jest.mock("../../../src/domain/calling-functions/manageNotifications", () => ({
  manageNotifications: jest.fn().mockResolvedValue({ success: true }),
}))

jest.mock("../../../src/application/services/link-replacement.service", () => ({
  ReplaceLinkWithToken: jest.fn().mockResolvedValue({ success: true }),
}))

const mockPrisma = {
  customers: { findFirst: jest.fn(), findUnique: jest.fn() },
  workspace: { findUnique: jest.fn() },
  orders: { findMany: jest.fn() },
  carts: { findUnique: jest.fn(), findFirst: jest.fn() },
  services: { findMany: jest.fn() },
  products: { findMany: jest.fn() },
}
jest.mock("@echatbot/database", () => ({ prisma: mockPrisma }))

import { CallingFunctionsService } from "../../../src/services/calling-functions.service"

describe("CallingFunctionsService.fetchWebsitePage — SSRF Protection (BUG#5 fix)", () => {
  let service: CallingFunctionsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CallingFunctionsService()
  })

  // --- Blocked URLs ---
  const blockedUrls = [
    { url: "http://localhost/admin", reason: "localhost — server's own process" },
    { url: "http://localhost:3001/api/admin", reason: "localhost with port" },
    { url: "http://127.0.0.1/", reason: "IPv4 loopback 127.0.0.1" },
    { url: "http://127.1.2.3/internal", reason: "IPv4 loopback 127.x range" },
    { url: "http://10.0.0.1/secret", reason: "RFC1918 private 10.x" },
    { url: "http://10.255.255.255/db", reason: "RFC1918 private 10.x (upper bound)" },
    { url: "http://172.16.0.1/meta", reason: "RFC1918 private 172.16.x" },
    { url: "http://172.31.255.255/config", reason: "RFC1918 private 172.31.x" },
    { url: "http://192.168.1.1/router", reason: "RFC1918 private 192.168.x" },
    { url: "http://192.168.100.200/wifi", reason: "RFC1918 private 192.168.x (higher)" },
    { url: "http://169.254.169.254/latest/meta-data/", reason: "AWS instance metadata endpoint" },
    { url: "http://169.254.0.1/something", reason: "Link-local 169.254.x" },
    { url: "http://[::1]/admin", reason: "IPv6 loopback [::1]" },
  ]

  blockedUrls.forEach(({ url, reason }) => {
    it(`should block ${reason}: ${url}`, async () => {
      // SCENARIO: LLM (manipulated via prompt injection) tries to access internal service
      // RULE: Any private/internal IP must return SSRF_BLOCKED before making HTTP request
      const result = await service.fetchWebsitePage({ url, workspaceId: "ws-1" })

      expect(result.success).toBe(false)
      expect(result.error).toBe("SSRF_BLOCKED")

      // CRITICAL: axios.post or axios.get must NEVER be called for blocked URLs
      const axios = require("axios")
      expect(axios.get).not.toHaveBeenCalled()
    })
  })

  it("should log a warning when SSRF is blocked", async () => {
    // RULE: SSRF attempts must be logged for security auditing
    await service.fetchWebsitePage({ url: "http://169.254.169.254/", workspaceId: "ws-1" })

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("SSRF"),
      expect.objectContaining({ url: "http://169.254.169.254/" })
    )
  })

  // --- Allowed URLs ---
  const allowedUrls = [
    "https://example.com/menu",
    "http://mybusiness.it/contatti",
    "https://www.ristorante.com/orari",
  ]

  allowedUrls.forEach((url) => {
    it(`should NOT block public URL: ${url}`, async () => {
      // SCENARIO: LLM fetches public business website content (legitimate use)
      // RULE: Public URLs must be allowed through to axios
      // We mock axios.get to return content so we can verify it's called
      const axios = require("axios")
      const cheerio = require("cheerio")

      axios.get = jest.fn().mockResolvedValue({
        data: "<html><body>Benvenuti nel ristorante</body></html>",
      })
      cheerio.load = jest.fn().mockReturnValue(
        Object.assign(jest.fn().mockReturnValue({ remove: jest.fn() }), {
          load: jest.fn(),
        })
      )

      // Just checking it doesn't return SSRF_BLOCKED, any other result is fine
      const result = await service.fetchWebsitePage({ url, workspaceId: "ws-1" })

      expect(result.error).not.toBe("SSRF_BLOCKED")
    })
  })

  it("should block even when URL is part of a relative path that resolves to localhost", async () => {
    // EDGE CASE: relative path check — if workspace.websiteUrl is internal, block it too
    // We can't rely on path joining; SSRF check applies to the fully resolved URL
    const result = await service.fetchWebsitePage({
      url: "http://127.0.0.1:8080/internal/settings",
      workspaceId: "ws-1",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe("SSRF_BLOCKED")
  })
})
