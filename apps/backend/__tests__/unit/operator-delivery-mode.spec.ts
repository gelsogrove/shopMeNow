/**
 * Operator delivery mode (all / random / single)
 *
 * Andrea 2026-08-02: `operatorDeliveryMode`, `operatorEmails` and
 * `operatorWhatsappNumbers` were written into the generated settings.json but
 * NO code ever read them — every escalation went to one address, whatever the
 * workspace had configured. Multi-operator routing existed only on paper.
 *
 * These tests pin the selection rules:
 *   - 'all'      → everyone configured is notified
 *   - 'random'   → exactly one, drawn from the configured list
 *   - no list    → fall back to the single legacy field (existing workspaces
 *                  must keep working untouched)
 *   - nothing    → no recipients, and the caller skips the send
 *
 * Selection is tested directly rather than through applyEscalationNotification,
 * which would need Prisma, SMTP and the WhatsApp sender stood up for what is a
 * pure decision.
 */
import { selectOperatorRecipientsForTest as select } from "../../src/application/services/custom-client-chatbot.service"

const LIST = ["ops1@example.com", "ops2@example.com", "ops3@example.com"]

describe("selectOperatorRecipients", () => {
  describe("mode 'all'", () => {
    it("returns every configured operator", () => {
      expect(select(LIST, "fallback@example.com", "all")).toEqual(LIST)
    })

    it("is the default for an unset mode", () => {
      // An unconfigured workspace must not silently notify only one person.
      expect(select(LIST, null, null)).toEqual(LIST)
    })

    it("is the default for an unrecognised mode", () => {
      // Erring towards more people seeing an escalation beats dropping it.
      expect(select(LIST, null, "something-else")).toEqual(LIST)
    })
  })

  describe("mode 'random'", () => {
    it("returns exactly one operator", () => {
      expect(select(LIST, null, "random")).toHaveLength(1)
    })

    it("always picks from the configured list", () => {
      // Run enough times that a value from outside the list would surface.
      for (let i = 0; i < 50; i++) {
        const [picked] = select(LIST, "fallback@example.com", "random")
        expect(LIST).toContain(picked)
      }
    })

    it("spreads across the list rather than always picking the first", () => {
      const seen = new Set<string>()
      for (let i = 0; i < 100; i++) seen.add(select(LIST, null, "random")[0])
      // The point of 'random' is load spreading; a constant pick fails here.
      expect(seen.size).toBeGreaterThan(1)
    })
  })

  describe("fallback to the legacy single field", () => {
    it("uses the singular value when no list is configured", () => {
      expect(select([], "legacy@example.com", "all")).toEqual(["legacy@example.com"])
    })

    it("uses the singular value when the list is null", () => {
      expect(select(null, "legacy@example.com", "random")).toEqual(["legacy@example.com"])
    })

    it("prefers the list over the singular value when both exist", () => {
      expect(select(LIST, "legacy@example.com", "all")).toEqual(LIST)
    })
  })

  describe("nothing configured", () => {
    it("returns no recipients", () => {
      // The caller logs a warning and skips the send rather than throwing.
      expect(select([], null, "all")).toEqual([])
      expect(select(null, undefined, "random")).toEqual([])
    })
  })

  describe("input hygiene", () => {
    it("drops blank and whitespace-only entries", () => {
      expect(select(["  ", "", "ops@example.com"], null, "all")).toEqual(["ops@example.com"])
    })

    it("trims surrounding whitespace", () => {
      expect(select(["  ops@example.com  "], null, "all")).toEqual(["ops@example.com"])
    })

    it("falls back when the list holds only blanks", () => {
      expect(select(["  ", ""], "legacy@example.com", "all")).toEqual(["legacy@example.com"])
    })
  })
})
