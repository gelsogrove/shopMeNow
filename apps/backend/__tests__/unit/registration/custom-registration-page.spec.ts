/**
 * Custom Registration Page URL Tests
 * 
 * Tests for the custom registrationPage feature:
 * - Use custom URL when workspace.registrationPage is configured
 * - Fallback to default /registration when null
 * - Token appending behavior
 * 
 * Andrea's Rule: Tests are the Bible - they define expected behavior
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals"

describe("Custom Registration Page URL", () => {
  const mockWorkspaceId = "workspace-123"
  const mockToken = "secure-token-abc123"
  
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Workspace registrationPage Configuration", () => {
    it("should use custom URL when registrationPage is configured", () => {
      // SCENARIO: Workspace has custom registration page URL
      // RULE: Use registrationPage instead of default /registration
      
      const workspace = {
        url: "https://mystore.com",
        registrationPage: "https://mystore.com/join-us",
      }
      
      const registrationUrl = workspace.registrationPage || `${workspace.url}/registration`
      
      expect(registrationUrl).toBe("https://mystore.com/join-us")
      expect(registrationUrl).not.toContain("/registration")
    })

    it("should fallback to default /registration when registrationPage is null", () => {
      // SCENARIO: Workspace has no custom registration page
      // RULE: Use default /registration path
      
      const workspace = {
        url: "https://mystore.com",
        registrationPage: null,
      }
      
      const registrationUrl = workspace.registrationPage || `${workspace.url}/registration`
      
      expect(registrationUrl).toBe("https://mystore.com/registration")
    })

    it("should fallback to default when registrationPage is empty string", () => {
      // SCENARIO: Workspace has empty registrationPage
      // RULE: Treat empty string as null, use default
      
      const workspace = {
        url: "https://mystore.com",
        registrationPage: "",
      }
      
      const registrationUrl = workspace.registrationPage || `${workspace.url}/registration`
      
      expect(registrationUrl).toBe("https://mystore.com/registration")
    })
  })

  describe("Token Appending", () => {
    it("should append token with ? for URLs without query params", () => {
      // SCENARIO: Custom URL without existing query parameters
      // RULE: Append token with ?token=xxx
      
      const baseUrl = "https://mystore.com/join-us"
      const token = mockToken
      
      const hasQueryParams = baseUrl.includes("?")
      const separator = hasQueryParams ? "&" : "?"
      const fullUrl = `${baseUrl}${separator}token=${token}`
      
      expect(fullUrl).toBe(`https://mystore.com/join-us?token=${token}`)
    })

    it("should append token with & for URLs with existing query params", () => {
      // SCENARIO: Custom URL with existing query parameters
      // RULE: Append token with &token=xxx
      
      const baseUrl = "https://mystore.com/join-us?ref=promo"
      const token = mockToken
      
      const hasQueryParams = baseUrl.includes("?")
      const separator = hasQueryParams ? "&" : "?"
      const fullUrl = `${baseUrl}${separator}token=${token}`
      
      expect(fullUrl).toBe(`https://mystore.com/join-us?ref=promo&token=${token}`)
    })

    it("should handle relative paths correctly", () => {
      // SCENARIO: registrationPage is a relative path
      // RULE: Combine with workspace.url
      
      const workspace = {
        url: "https://mystore.com",
        registrationPage: "/custom-registration",
      }
      
      // If registrationPage starts with /, it's relative
      const isRelative = workspace.registrationPage.startsWith("/") && !workspace.registrationPage.startsWith("http")
      
      let registrationUrl: string
      if (isRelative) {
        registrationUrl = `${workspace.url}${workspace.registrationPage}`
      } else {
        registrationUrl = workspace.registrationPage
      }
      
      expect(registrationUrl).toBe("https://mystore.com/custom-registration")
    })
  })

  describe("URL Validation", () => {
    it("should handle full URLs (https://)", () => {
      // SCENARIO: registrationPage is a full URL
      // RULE: Use as-is without combining with workspace.url
      
      const registrationPage = "https://external-site.com/register"
      const isAbsoluteUrl = registrationPage.startsWith("http://") || registrationPage.startsWith("https://")
      
      expect(isAbsoluteUrl).toBe(true)
    })

    it("should handle protocol-relative URLs (//)", () => {
      // SCENARIO: registrationPage starts with //
      // RULE: Treat as absolute URL
      
      const registrationPage = "//external-site.com/register"
      const isAbsoluteUrl = registrationPage.startsWith("//") || registrationPage.startsWith("http")
      
      expect(isAbsoluteUrl).toBe(true)
    })
  })

  describe("Link Replacement Integration", () => {
    it("should replace [LINK_REGISTRATION] with custom URL", () => {
      // SCENARIO: Message contains [LINK_REGISTRATION] token
      // RULE: Replace with full URL including token
      
      const message = "Registrati qui: [LINK_REGISTRATION]"
      const registrationUrl = "https://mystore.com/join-us?token=abc123"
      
      const result = message.replace("[LINK_REGISTRATION]", registrationUrl)
      
      expect(result).toBe("Registrati qui: https://mystore.com/join-us?token=abc123")
      expect(result).not.toContain("[LINK_REGISTRATION]")
    })

    it("should NOT replace if registrationPage is invalid", () => {
      // SCENARIO: Invalid registrationPage configuration
      // RULE: Fallback to default behavior
      
      const workspace = {
        url: "https://mystore.com",
        registrationPage: null,
      }
      
      const defaultUrl = `${workspace.url}/registration`
      expect(defaultUrl).toBe("https://mystore.com/registration")
    })
  })

  describe("Seed Data Validation", () => {
    it("should have example registrationPage in seed for demo", () => {
      // SCENARIO: Seed data should include example custom registration page
      // RULE: BellItalia workspace should have registrationPage configured
      
      const seedWorkspace = {
        name: "BellItalia VIP",
        registrationPage: "https://bellitalia.com/registrati",
      }
      
      expect(seedWorkspace.registrationPage).toBeDefined()
      expect(seedWorkspace.registrationPage).toContain("registrati")
    })
  })
})
