/**
 * demosappada — the intake state machine (intake-machine.ts)
 *
 * WHAT: nextIntakeStep is the SINGLE authority on which question the guest is
 * asked next. This suite pins the strict-pipeline contract: the first step the
 * profile does not answer is the question of the turn, and it stays the
 * question until answered (contratto.md / Andrea, 2026-08-26: "abbiamo uno
 * state: fino a che non è chiaro e pieno devi far domande").
 *
 * WHY: the machine is pure by design (no I/O, no LLM, no session access) and
 * every regression in this file was a live bug first — a question asked twice,
 * a volunteered fact re-asked, a remote prospect grilled about a stay they do
 * not have. Locking the table's semantics is what keeps the queue and the
 * guards from drifting apart again (iron rule 5: detectors ship with tests).
 */
import {
  INTAKE_STEPS,
  isIntakeStepOpen,
  nextIntakeStep,
} from "../../custom-demosappada/intake-machine"

const ctx = (profile: Record<string, unknown> | null, asked: string[] = [], knownName?: string) => ({
  profile: profile as never,
  asked: new Set(asked),
  knownName,
})

describe("demosappada intake machine — strict pipeline", () => {
  it("opens with the presence question: a brand-new guest is asked WHERE they are first", () => {
    // contratto.md 2026-08-27: "bisogna fare un'altra domanda: Siete già a
    // Sappada?" — the branch question comes before everything else.
    expect(nextIntakeStep(ctx(null))?.key).toBe("location")
    expect(nextIntakeStep(ctx({}))?.key).toBe("location")
  })

  it("keeps the SAME question open until it is answered — asked alone never retires a step", () => {
    // "asked once, never again" buried every question the guest sidestepped
    // (they asked about the rubbish, the machine moved on, the intake closed
    // with holes). The strict pipeline re-dictates the first unanswered step.
    expect(nextIntakeStep(ctx({ presence: "in_loco" }, ["party"]))?.key).toBe("party")
  })

  it("a profile that already carries dates has answered the presence question implicitly", () => {
    // Guests from before the location step existed only ever gave dates while
    // engaged with a stay — asking "siete già a Sappada?" now would be absurd.
    const step = nextIntakeStep(ctx({ departureDate: "2026-08-30" }))
    expect(step?.key).not.toBe("location")
  })

  describe("the remote branch (presence = 'remote')", () => {
    it("asks the ONE remote-needs question and nothing about the stay", () => {
      // contratto.md: "se non sono a Sappada dobbiamo evitare tutte le domande
      // di quanti siete cosa volete fare" — a prospect writing from home gets
      // one "cosa cerchi?" and then free Q&A.
      expect(nextIntakeStep(ctx({ presence: "remote" }))?.key).toBe("remoteNeeds")
    })

    it("closes the intake completely once the remote-needs question was PUT", () => {
      // Satisfied on being put (like consent), so it can never loop.
      expect(nextIntakeStep(ctx({ presence: "remote", remoteNeedsAsked: true }))).toBeNull()
    })

    it("never reaches consent or name for a remote prospect", () => {
      // Every stay step declares relevantWhen: !isRemote — verified on the
      // table itself so a new step cannot forget the guard silently.
      const remote = ctx({ presence: "remote", remoteNeedsAsked: true })
      for (const step of INTAKE_STEPS) {
        if (step.key === "location" || step.key === "remoteNeeds") continue
        expect(isIntakeStepOpen(step.key, remote)).toBe(false)
      }
    })
  })

  describe("the standard flow (presence = 'in_loco')", () => {
    it("a guest who volunteered the headcount is never asked the party question", () => {
      // "siamo due adulti" answers `party` before it was put — asking anyway
      // is the failure the machine exists to prevent. Only the missing HALF
      // (the dates) is asked, by `stay`.
      const step = nextIntakeStep(ctx({ presence: "in_loco", adults: 2 }))
      expect(step?.key).toBe("stay")
    })

    it("a guest who gave only the dates is asked the headcount, not the whole party question again", () => {
      // "ho detto fino a domenica!" (2026-08-25): dates given, so `party` is
      // retired and `headcount` asks the missing number.
      const step = nextIntakeStep(ctx({ presence: "in_loco", departureDate: "2026-08-30" }))
      expect(step?.key).toBe("headcount")
    })

    it("asks childrenAges ONLY when there are children, and 0 children is a real answer", () => {
      // `children: 0` ("no, solo adulti") satisfies composition and must not
      // trigger the ages question — hence !== undefined, never truthiness.
      const base = {
        presence: "in_loco",
        adults: 2,
        departureDate: "2026-08-30",
        constraints: "nessuno",
      }
      expect(nextIntakeStep(ctx({ ...base, children: 0 }))?.key).toBe("interests")
      expect(nextIntakeStep(ctx({ ...base, children: 2 }))?.key).toBe("childrenAges")
    })

    it("consent is unreachable while any data step above it is still open", () => {
      // contratto.md: "quando è chiaro lo salviamo e chiediamo della push
      // notification" — the strict order guarantees the sequence by
      // construction, so consent must never surface early.
      const incomplete = ctx({ presence: "in_loco", adults: 2, departureDate: "2026-08-30" })
      expect(nextIntakeStep(incomplete)?.key).not.toBe("consent")
    })

    it("skips the name question when the host already knows it (widget registration)", () => {
      const full = {
        presence: "in_loco",
        adults: 2,
        children: 0,
        departureDate: "2026-08-30",
        constraints: "nessuno",
        interests: "natura",
        consentAsked: true,
      }
      // Name known → straight to the itinerary offer, the closing step.
      expect(nextIntakeStep(ctx(full, [], "Andrea"))?.key).toBe("itinerary")
      // Name unknown (WhatsApp: no registration form) → it is asked.
      expect(nextIntakeStep(ctx(full))?.key).toBe("name")
    })

    it("returns null — intake complete — once every step is satisfied", () => {
      const done = {
        presence: "in_loco",
        adults: 2,
        children: 0,
        departureDate: "2026-08-30",
        constraints: "nessuno",
        interests: "natura",
        consentAsked: true,
        itinerary: "yes",
      }
      expect(nextIntakeStep(ctx(done, [], "Andrea"))).toBeNull()
    })
  })

  describe("isIntakeStepOpen — the mid-turn recheck", () => {
    it("reports a step closed the moment the profile answers it", () => {
      // Used after mid-turn saves: the question chosen at the top of the turn
      // may have been answered by the save that just happened.
      expect(isIntakeStepOpen("stay", ctx({ presence: "in_loco", adults: 2 }))).toBe(true)
      expect(
        isIntakeStepOpen("stay", ctx({ presence: "in_loco", adults: 2, departureDate: "2026-08-30" })),
      ).toBe(false)
    })

    it("treats an unknown key and a null key as not open", () => {
      expect(isIntakeStepOpen(null, ctx({}))).toBe(false)
      expect(isIntakeStepOpen("nonsense", ctx({}))).toBe(false)
    })
  })
})
