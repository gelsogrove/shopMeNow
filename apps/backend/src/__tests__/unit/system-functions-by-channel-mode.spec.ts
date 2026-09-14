/**
 * Which default tools a workspace is born with, per channelMode.
 *
 * WHY THIS EXISTS (Andrea, 2026-09-14): the Settings page showed a Pro Loco
 * chatbot a pile of tools nobody had asked for — cart, orders, appointment
 * booking — and there was no way to tell, from the UI, which were deliberate.
 * The cause was two places deciding the same thing differently:
 *
 *   workspace.service.ts   → appended APPOINTMENT_FUNCTIONS to EVERY workspace
 *   system-functions-sync  → appended them only when enableCalendarBooking
 *
 * Both now call systemFunctionsFor(). These tests lock the decision so the
 * two can never drift apart again.
 *
 * Every unused tool costs tokens on EVERY model call and gives the LLM one
 * more wrong thing to pick, so "harmless extra tool" is not a thing.
 */
import {
  systemFunctionsFor,
  ECOMMERCE_FUNCTIONS,
  APPOINTMENT_FUNCTIONS,
  ALWAYS_AVAILABLE_FUNCTIONS,
} from "../../constants/system-functions"

const names = (fns: { functionName: string }[]) => fns.map(f => f.functionName).sort()

const ECOMMERCE_NAMES = names(ECOMMERCE_FUNCTIONS)
const APPOINTMENT_NAMES = names(APPOINTMENT_FUNCTIONS)
const ALWAYS_NAMES = names(ALWAYS_AVAILABLE_FUNCTIONS)

// The four modes the ChannelMode enum declares in schema.prisma.
const NON_SELLING_MODES = ["INFORMATIONAL", "FLOW", "PRO_LOCO"]

describe("systemFunctionsFor — defaults depend on the workspace TYPE", () => {
  describe("always-available tools", () => {
    // Language, support, profile and notifications are useful to any chatbot,
    // so every mode gets them regardless of calendar or selling.
    it.each([...NON_SELLING_MODES, "ECOMMERCE"])(
      "%s always includes the always-available tools",
      mode => {
        const result = names(systemFunctionsFor(mode, false))
        ALWAYS_NAMES.forEach(n => expect(result).toContain(n))
      }
    )
  })

  describe("e-commerce tools (catalogue, cart, orders)", () => {
    it("ECOMMERCE gets them", () => {
      const result = names(systemFunctionsFor("ECOMMERCE", false))
      ECOMMERCE_NAMES.forEach(n => expect(result).toContain(n))
    })

    // THE BUG ANDREA REPORTED: a tourist office sells nothing, so offering
    // productSearchAgent / cartManagementAgent / orderTrackingAgent is noise.
    it.each(NON_SELLING_MODES)("%s does NOT get them", mode => {
      const result = names(systemFunctionsFor(mode, false))
      ECOMMERCE_NAMES.forEach(n => expect(result).not.toContain(n))
    })
  })

  describe("appointment tools follow the calendar switch, not the mode", () => {
    // Orthogonal by design: a Pro Loco running guided visits turns the
    // calendar on and gets booking; an e-commerce shop without a calendar
    // does not. Previously the creation seed ignored this flag completely.
    it.each([...NON_SELLING_MODES, "ECOMMERCE"])(
      "%s with calendar ON includes booking tools",
      mode => {
        const result = names(systemFunctionsFor(mode, true))
        APPOINTMENT_NAMES.forEach(n => expect(result).toContain(n))
      }
    )

    it.each([...NON_SELLING_MODES, "ECOMMERCE"])(
      "%s with calendar OFF excludes booking tools",
      mode => {
        const result = names(systemFunctionsFor(mode, false))
        APPOINTMENT_NAMES.forEach(n => expect(result).not.toContain(n))
      }
    )
  })

  describe("the exact sets, so a silent addition breaks a test", () => {
    it("PRO_LOCO with calendar off gets ONLY the always-available tools", () => {
      expect(names(systemFunctionsFor("PRO_LOCO", false))).toEqual(ALWAYS_NAMES)
    })

    it("ECOMMERCE with calendar on gets always + ecommerce + appointments", () => {
      expect(names(systemFunctionsFor("ECOMMERCE", true))).toEqual(
        [...ALWAYS_NAMES, ...ECOMMERCE_NAMES, ...APPOINTMENT_NAMES].sort()
      )
    })

    it("returns no duplicates in any combination", () => {
      for (const mode of [...NON_SELLING_MODES, "ECOMMERCE"]) {
        for (const calendar of [true, false]) {
          const result = names(systemFunctionsFor(mode, calendar))
          expect(result).toEqual([...new Set(result)])
        }
      }
    })

    // A fresh array each call: callers push onto the result, and a shared
    // module-level array would accumulate tools across workspaces.
    it("returns a new array each call", () => {
      const a = systemFunctionsFor("ECOMMERCE", true)
      const b = systemFunctionsFor("ECOMMERCE", true)
      expect(a).not.toBe(b)
      a.push(...ECOMMERCE_FUNCTIONS)
      expect(systemFunctionsFor("ECOMMERCE", true)).toHaveLength(b.length)
    })
  })
})
