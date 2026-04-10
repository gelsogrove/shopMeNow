/**
 * Widget & WhatsApp Registration Guard Tests
 *
 * BUSINESS RULES (Andrea):
 * - Unregistered users can ALWAYS chat and ask FAQ/general questions
 * - Restricted actions (orders, cart, appointments) → show [LINK_REGISTRATION]
 * - Chat is NEVER blocked regardless of message count
 * - listAvailableSlots is public — anyone can browse available slots
 * - Widget and WhatsApp share the same guard logic for functions
 */

import { describe, it, expect, beforeEach } from "@jest/globals"
import { RegistrationPromptService } from "../../../src/services/registration-prompt.service"

// ─── RegistrationPromptService ──────────────────────────────────────────────

describe("RegistrationPromptService", () => {
  let service: RegistrationPromptService

  beforeEach(() => {
    service = new RegistrationPromptService()
  })

  describe("getPromptLevel", () => {
    it("should return 0 for registered users regardless of message count", () => {
      // RULE: Registered users never see registration prompts
      expect(service.getPromptLevel(0, true)).toBe(0)
      expect(service.getPromptLevel(6, true)).toBe(0)
      expect(service.getPromptLevel(20, true)).toBe(0)
    })

    it("should return 0 for first 5 messages (unregistered)", () => {
      // RULE: First 5 messages are free — no nudge yet
      expect(service.getPromptLevel(0, false)).toBe(0)
      expect(service.getPromptLevel(5, false)).toBe(0)
    })

    it("should return level 1 at messages 6-8", () => {
      expect(service.getPromptLevel(6, false)).toBe(1)
      expect(service.getPromptLevel(8, false)).toBe(1)
    })

    it("should return level 2 at messages 9-11", () => {
      expect(service.getPromptLevel(9, false)).toBe(2)
      expect(service.getPromptLevel(11, false)).toBe(2)
    })

    it("should return level 3 at message 12+", () => {
      // RULE: No level 4 / no block threshold — max is 3
      expect(service.getPromptLevel(12, false)).toBe(3)
      expect(service.getPromptLevel(50, false)).toBe(3)
    })
  })

  describe("getPromptText — no blocking language", () => {
    it("should not contain blocking language in any level", () => {
      // RULE: Chat is NEVER blocked — prompts must not say otherwise
      const forbidden = ["BLOCKED", "blocked", "block", "15 messages", "blocked for security"]

      for (const level of [1, 2, 3]) {
        const text = service.getPromptText(level)
        for (const word of forbidden) {
          expect(text).not.toContain(word)
        }
      }
    })

    it("should include [LINK_REGISTRATION] token in levels 1-3", () => {
      // RULE: Every invite must include the registration link token
      expect(service.getPromptText(1)).toContain("[LINK_REGISTRATION]")
      expect(service.getPromptText(2)).toContain("[LINK_REGISTRATION]")
      expect(service.getPromptText(3)).toContain("[LINK_REGISTRATION]")
    })

    it("should return empty string for level 0", () => {
      expect(service.getPromptText(0)).toBe("")
    })
  })

  describe("shouldBlockUser — always false", () => {
    it("should NEVER block users regardless of message count or registration status", () => {
      // RULE: Andrea: 'non blocchiamo la chat'
      // shouldBlockUser is deprecated and always returns false
      expect(service.shouldBlockUser(0, false)).toBe(false)
      expect(service.shouldBlockUser(15, false)).toBe(false)
      expect(service.shouldBlockUser(100, false)).toBe(false)
      expect(service.shouldBlockUser(15, true)).toBe(false)
    })
  })
})

// ─── FunctionExecutor registration guard — appointment functions ─────────────

// We test the guard logic directly (constants are exported indirectly via behaviour)
// by instantiating FunctionExecutor with a minimal Prisma mock.

const mockPrisma = {
  workspace: {
    findFirst: jest.fn().mockResolvedValue({
      id: "ws-test",
      name: "TestWorkspace",
      sellsProductsAndServices: true,
    }),
  },
  customers: { findFirst: jest.fn().mockResolvedValue(null) },
  callingFunction: { findMany: jest.fn().mockResolvedValue([]) },
  workspaceCallingFunction: { findMany: jest.fn().mockResolvedValue([]) },
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
  PrismaClient: jest.fn(() => mockPrisma),
}))

import { FunctionExecutor } from "../../../src/services/function-executor.service"

describe("FunctionExecutor — Registration Guard for Appointments", () => {
  let executor: FunctionExecutor

  beforeEach(() => {
    executor = new FunctionExecutor(mockPrisma as any)
    jest.clearAllMocks()
  })

  const appointmentProtected = [
    { name: "bookAppointment", args: { serviceId: "svc-1", date: "2026-04-15", time: "10:00" } },
    { name: "cancelAppointment", args: { appointmentId: "apt-1" } },
    { name: "rescheduleAppointment", args: { appointmentId: "apt-1", date: "2026-04-16", time: "11:00" } },
    { name: "getCustomerAppointments", args: {} },
  ]

  appointmentProtected.forEach(({ name, args }) => {
    it(`should block '${name}' for unregistered WhatsApp users`, async () => {
      // SCENARIO: WhatsApp visitor (isActive=false) tries to book/cancel/view appointments
      // RULE: Appointments require registration on WhatsApp → return REGISTRATION_REQUIRED with link
      const context = {
        workspaceId: "ws-test",
        customerId: "cust-anon",
        customerIsActive: false,
        sellsProductsAndServices: true,
        channel: "whatsapp", // WhatsApp: registration guard applies
      }

      const result = await executor.execute(name, args, context)

      expect(result.success).toBe(false)
      expect(result.error).toBe("REGISTRATION_REQUIRED")
      expect(result.data.message).toContain("[LINK_REGISTRATION]")
      expect(result.data.requiresRegistration).toBe(true)
    })

    it(`should allow '${name}' for widget users (no registration required on widget)`, async () => {
      // SCENARIO: Widget visitor tries to book — widget users are always treated as registered
      // RULE: Widget channel bypasses the registration guard entirely
      const context = {
        workspaceId: "ws-test",
        customerId: "cust-widget",
        customerIsActive: false, // not "registered" in DB but widget doesn't care
        sellsProductsAndServices: true,
        channel: "widget", // Widget: registration guard SKIPPED
      }

      const result = await executor.execute(name, args, context)

      expect(result.error).not.toBe("REGISTRATION_REQUIRED")
    })
  })

  it("should allow 'listAvailableSlots' for unregistered users", async () => {
    // SCENARIO: Anyone can browse available time slots before deciding to register
    // RULE: listAvailableSlots is public — no registration required
    const context = {
      workspaceId: "ws-test",
      customerId: "cust-anon",
      customerIsActive: false,
      sellsProductsAndServices: true,
    }

    const result = await executor.execute("listAvailableSlots", { serviceId: "svc-1" }, context)

    // Guard must NOT block with REGISTRATION_REQUIRED
    expect(result.error).not.toBe("REGISTRATION_REQUIRED")
  })
})

// ─── Widget: no blocking on message count ────────────────────────────────────

describe("Widget channel — no message-count block", () => {
  it("shouldBlockUser always returns false for any message count", () => {
    // RULE: Andrea: 'non blocchiamo la chat' — widget chat stays open forever
    // The widget controller must NEVER call shouldBlockUser to blacklist a customer
    const service = new RegistrationPromptService()

    const counts = [0, 5, 14, 15, 16, 50, 100]
    counts.forEach(count => {
      expect(service.shouldBlockUser(count, false)).toBe(false)
    })
  })
})
