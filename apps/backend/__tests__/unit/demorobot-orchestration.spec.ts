/**
 * demorobot — request orchestration and the no-hardcoded-copy rule
 *
 * Andrea 2026-08-03. Two properties are pinned here, both learned the hard way
 * in production over 2026-08-02/03:
 *
 * ORCHESTRATION — the order a request is handled in:
 *   1. a FAQ answers it            → reply from the FAQ, no intake
 *   2. a flow matches              → start_flow, then follow its steps
 *   3. neither                     → collect the case (problem, serial, when),
 *                                    run the general flow if one exists, ask
 *                                    for the name, hand over to an operator
 *
 * NO HARDCODED COPY — every customer-facing sentence comes from configuration.
 * The module used to carry the hand-off message pre-translated into eight
 * languages, and an intake question containing "19 characters starting with
 * HK" — AmRobots' own domain baked into a shared module. Both are forbidden by
 * CLAUDE.md §1 (no hardcoded data, no hardcoded translations).
 *
 * What stays in code is the MECHANISM: while intake is incomplete the question
 * text is fixed and the model only translates it, so it cannot improvise a
 * menu of invented causes (which is exactly what it did). The wording is
 * configurable; the guarantee is not.
 */
import fs from "fs"
import path from "path"

import { formatIntakeBlock, nextIntakeStep } from "../../custom-demorobot/flow-selection"

const MODULE_DIR = path.join(__dirname, "..", "..", "custom-demorobot")

const QUESTIONS = {
  serialNumber: "What is your robot's serial number?",
  problemDescription: "What exactly is happening? Describe it in your own words.",
  problemStartedWhen: "When did it start — today, yesterday, or a while ago?",
}

describe("demorobot request orchestration", () => {
  describe("intake runs only for technical problems", () => {
    it("tells the model to skip intake when a FAQ answers the question", () => {
      // Without this the bot demands a serial number before answering
      // "what are your opening hours?" — intake must not hijack a FAQ.
      const block = formatIntakeBlock(nextIntakeStep({}, QUESTIONS))

      expect(block).toMatch(/a FAQ answers what the customer asked/i)
      expect(block).toMatch(/no intake/i)
    })

    it("tells the model to skip intake when the message is not a fault report", () => {
      const block = formatIntakeBlock(nextIntakeStep({}, QUESTIONS))

      expect(block).toMatch(/not reporting a fault/i)
    })

    it("tells the model to start a matching flow instead of continuing intake", () => {
      const block = formatIntakeBlock(nextIntakeStep({}, QUESTIONS))

      expect(block).toMatch(/call start_flow/i)
    })

    it("tells the model to escalate immediately on an emergency", () => {
      // Nothing may delay reaching a human — not even data collection.
      const block = formatIntakeBlock(nextIntakeStep({}, QUESTIONS))

      expect(block).toMatch(/emergency — escalate immediately/i)
    })
  })

  describe("the dictated question", () => {
    it("gives the model one exact question and forbids adding to it", () => {
      const block = formatIntakeBlock(nextIntakeStep({}, QUESTIONS))!

      expect(block).toContain(QUESTIONS.serialNumber)
      expect(block).toMatch(/Do NOT add other questions/i)
      expect(block).toMatch(/do NOT offer options or possible causes/i)
      expect(block).toMatch(/multiple-choice/i)
    })

    it("names the remember() key so the answer is actually saved", () => {
      const block = formatIntakeBlock(nextIntakeStep({ serialNumber: "HK1" }, QUESTIONS))!

      // Saving is what stops the same question being asked twice.
      expect(block).toContain("remember({key:'problemDescription'")
    })

    it("produces no block once intake is complete", () => {
      // Intake over: flows, FAQ and the operating rules take it from here.
      const step = nextIntakeStep(
        {
          serialNumber: "HK1",
          collectedData: { problemDescription: "non taglia", problemStartedWhen: "oggi" },
        },
        QUESTIONS,
      )

      expect(formatIntakeBlock(step)).toBeNull()
    })
  })
})

describe("demorobot carries no hardcoded customer-facing copy", () => {
  const sources = ["agent.ts", "flow-selection.ts", "state.ts"].map((f) =>
    fs.readFileSync(path.join(MODULE_DIR, f), "utf8"),
  )
  // Comments explain WHY copy was removed and legitimately quote the old
  // strings; only executable lines are checked.
  const code = sources
    .join("\n")
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
    .join("\n")

  it("has no pre-translated sentences", () => {
    // The regression: HANDOFF_MESSAGES held the same apology in en/it/es/da/
    // fr/de/pt/ca. Translation is the LLM's job — the module ships one string
    // and the model renders it in the customer's language.
    expect(code).not.toMatch(/Mi dispiace, non riesco/i)
    expect(code).not.toMatch(/Lo siento, no puedo resolverlo/i)
    expect(code).not.toMatch(/Es tut mir leid/i)
    expect(code).not.toMatch(/HANDOFF_MESSAGES/)
  })

  it("has no tenant-specific domain knowledge", () => {
    // "19 characters starting with HK" is AmRobots' serial format. A second
    // customer with different serials would have needed a code change.
    expect(code).not.toMatch(/19 characters/i)
    expect(code).not.toMatch(/starts with HK/i)
  })

  it("keeps the intake wording in settings.json, not in the code", () => {
    const settings = JSON.parse(fs.readFileSync(path.join(MODULE_DIR, "settings.json"), "utf8"))

    expect(settings.intakeQuestions).toBeDefined()
    expect(settings.intakeQuestions.serialNumber).toBeTruthy()
    expect(settings.intakeQuestions.problemDescription).toBeTruthy()
    expect(settings.intakeQuestions.problemStartedWhen).toBeTruthy()
  })

  it("keeps the guard messages in settings.json, not in the code", () => {
    const settings = JSON.parse(fs.readFileSync(path.join(MODULE_DIR, "settings.json"), "utf8"))

    expect(settings.rateLimitedMessage).toBeTruthy()
    expect(settings.sessionTooLongMessage).toBeTruthy()
    // And the literals are gone from the source.
    expect(code).not.toContain("'You are sending messages too quickly")
    expect(code).not.toContain("'This conversation has become too long")
  })

  it("asks nothing at all when no wording is configured", () => {
    // Fails safe towards silence: an unconfigured workspace must not fall back
    // to the module's own English.
    expect(nextIntakeStep({}, undefined)).toBeNull()
    expect(nextIntakeStep({}, {})).toBeNull()
    expect(formatIntakeBlock(null)).toBeNull()
  })
})
