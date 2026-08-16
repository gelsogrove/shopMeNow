/**
 * WhatsAppProviderFactory - Unit Tests
 *
 * WHAT: verifies provider selection and configuration validation for the
 * three supported WhatsApp providers (Meta, UltraMsg, Wasender).
 *
 * WHY: the factory is the single point where every outbound message picks
 * its transport. A wrong selection or a silent pass on missing credentials
 * would break ALL sends for a workspace, so each branch (happy path +
 * misconfiguration throw) must be pinned by a test.
 *
 * Test Coverage:
 * - create(): correct provider per whatsappProvider value (3 tests)
 * - create(): throws on missing credentials per provider (3 tests)
 * - create(): defaults to Meta when whatsappProvider is unset (1 test)
 * - isConfigured(): true/false per provider (3 tests)
 * - getProviderDisplayName(): display names (1 test)
 *
 * Total: 11 tests
 */

import { describe, it, expect, jest } from "@jest/globals"

// Mock the concrete providers: these tests pin the factory's SELECTION logic,
// not the providers' HTTP behavior (covered by their own specs).
jest.mock("../../src/services/whatsapp/meta-whatsapp-provider", () => ({
  MetaWhatsAppProvider: jest.fn().mockImplementation((config: any) => ({
    kind: "meta",
    config,
  })),
}))
jest.mock("../../src/services/whatsapp/ultramsg-whatsapp-provider", () => ({
  UltraMsgWhatsAppProvider: jest.fn().mockImplementation((config: any) => ({
    kind: "ultramsg",
    config,
  })),
}))
jest.mock("../../src/services/whatsapp/wasender-whatsapp-provider", () => ({
  WasenderWhatsAppProvider: jest.fn().mockImplementation((config: any) => ({
    kind: "wasender",
    config,
  })),
}))

import { WhatsAppProviderFactory } from "../../src/services/whatsapp/whatsapp-provider.factory"

const baseWorkspace = { id: "ws1", name: "Test Workspace" }

describe("WhatsAppProviderFactory - Unit Tests", () => {
  describe("create()", () => {
    it("should create Wasender provider when whatsappProvider is 'wasender' and apiKey present", () => {
      const provider: any = WhatsAppProviderFactory.create({
        ...baseWorkspace,
        whatsappProvider: "wasender",
        wasenderApiKey: "wsk_123",
      })
      expect(provider.kind).toBe("wasender")
      expect(provider.config).toEqual({ sessionApiKey: "wsk_123" })
    })

    it("should throw when 'wasender' is selected but session apiKey missing", () => {
      // WHY: sending through Wasender without a session key fails at the
      // provider with an opaque HTTP 401 — the factory must fail fast instead.
      expect(() =>
        WhatsAppProviderFactory.create({
          ...baseWorkspace,
          whatsappProvider: "wasender",
          wasenderApiKey: null,
        })
      ).toThrow("WasenderAPI provider selected but session API key not configured")
    })

    it("should create UltraMsg provider when configured", () => {
      const provider: any = WhatsAppProviderFactory.create({
        ...baseWorkspace,
        whatsappProvider: "ultramsg",
        ultraMsgInstanceId: "instance123",
        ultraMsgToken: "tok_abc",
        ultraMsgApiUrl: "https://api.ultramsg.com",
      })
      expect(provider.kind).toBe("ultramsg")
      expect(provider.config).toEqual({
        instanceId: "instance123",
        token: "tok_abc",
        apiUrl: "https://api.ultramsg.com",
      })
    })

    it("should throw when 'ultramsg' is selected but credentials missing", () => {
      expect(() =>
        WhatsAppProviderFactory.create({
          ...baseWorkspace,
          whatsappProvider: "ultramsg",
          ultraMsgInstanceId: "instance123",
          ultraMsgToken: null, // token missing
        })
      ).toThrow("UltraMsg provider selected but credentials not configured")
    })

    it("should create Meta provider when whatsappProvider is 'meta'", () => {
      const provider: any = WhatsAppProviderFactory.create({
        ...baseWorkspace,
        whatsappProvider: "meta",
        metaPhoneNumberId: "phone_1",
        metaAccessToken: "meta_tok",
      })
      expect(provider.kind).toBe("meta")
      expect(provider.config).toEqual({
        phoneNumberId: "phone_1",
        accessToken: "meta_tok",
      })
    })

    it("should default to Meta when whatsappProvider is not set", () => {
      // WHY: legacy workspaces created before multi-provider support have no
      // whatsappProvider value — they must keep working through Meta.
      const provider: any = WhatsAppProviderFactory.create({
        ...baseWorkspace,
        metaPhoneNumberId: "phone_1",
        metaAccessToken: "meta_tok",
      })
      expect(provider.kind).toBe("meta")
    })

    it("should throw when Meta credentials are missing", () => {
      expect(() =>
        WhatsAppProviderFactory.create({
          ...baseWorkspace,
          whatsappProvider: "meta",
          metaPhoneNumberId: null,
          metaAccessToken: null,
        })
      ).toThrow("Meta provider selected but credentials not configured")
    })
  })

  describe("isConfigured()", () => {
    it("should reflect Wasender configuration state", () => {
      expect(
        WhatsAppProviderFactory.isConfigured({
          whatsappProvider: "wasender",
          wasenderApiKey: "wsk_123",
        })
      ).toBe(true)
      expect(
        WhatsAppProviderFactory.isConfigured({
          whatsappProvider: "wasender",
          wasenderApiKey: null,
        })
      ).toBe(false)
    })

    it("should reflect UltraMsg configuration state (both credentials required)", () => {
      expect(
        WhatsAppProviderFactory.isConfigured({
          whatsappProvider: "ultramsg",
          ultraMsgInstanceId: "i1",
          ultraMsgToken: "t1",
        })
      ).toBe(true)
      // Only one of the two credentials → NOT configured
      expect(
        WhatsAppProviderFactory.isConfigured({
          whatsappProvider: "ultramsg",
          ultraMsgInstanceId: "i1",
          ultraMsgToken: null,
        })
      ).toBe(false)
    })

    it("should reflect Meta configuration state (default provider)", () => {
      expect(
        WhatsAppProviderFactory.isConfigured({
          metaPhoneNumberId: "p1",
          metaAccessToken: "t1",
        })
      ).toBe(true)
      expect(WhatsAppProviderFactory.isConfigured({})).toBe(false)
    })
  })

  describe("getProviderDisplayName()", () => {
    it("should return human-readable names for each provider", () => {
      expect(
        WhatsAppProviderFactory.getProviderDisplayName({ whatsappProvider: "wasender" })
      ).toBe("WasenderAPI")
      expect(
        WhatsAppProviderFactory.getProviderDisplayName({ whatsappProvider: "ultramsg" })
      ).toBe("UltraMsg")
      expect(
        WhatsAppProviderFactory.getProviderDisplayName({ whatsappProvider: "meta" })
      ).toBe("Meta Business API")
      // Unset provider falls back to Meta (legacy workspaces)
      expect(WhatsAppProviderFactory.getProviderDisplayName({})).toBe("Meta Business API")
    })
  })
})
