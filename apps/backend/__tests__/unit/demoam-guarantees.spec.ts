/**
 * demoam — locks on the 2026-08-16/17 guarantees.
 *
 * WHAT: unit tests on the PURE mechanisms added while closing the live bugs
 * of those two days, plus source-greps that pin the architectural decisions
 * (CLAUDE.md §1B: "lock it with a test that greps the source, so it cannot
 * creep back in"). No LLM, no DB — every probabilistic layer is out of scope
 * here and covered by the CLI scenarios instead (cli/scenarios/*, each names
 * the CONTRACT.md rule it verifies).
 *
 * WHY each block exists is stated inline with the date and the live failure
 * it prevents from coming back. Test LOGIC is sacred (CLAUDE.md §7A): do not
 * weaken assertions without Andrea's explicit approval.
 */
import fs from "fs"
import path from "path"

import {
  intakeEvidenceOnRecord,
  midIntakePendingQuestion,
  nextPreOperatorAction,
} from "../../custom-demoam/gate.js"
import { resolveGreeting } from "../../custom-demoam/state.js"
import type { SessionState } from "../../custom-demoam/state.js"
import { customerVerbatim } from "../../custom-demoam/briefing.js"
import { renderWorkspaceCopy } from "../../src/application/services/workspace-copy.render"

const AGENT_SOURCE = fs.readFileSync(
  path.join(__dirname, "../../custom-demoam/agent.ts"),
  "utf8",
)

/** All gate questions configured, as the AmRobots workspace has them. */
const QUESTIONS = {
  serialNumber: "To look into this properly, can you give me the serial number?",
  problemDescription: "Can you briefly describe what's happening?",
  problemStartedWhen: "When did you first notice this?",
  name: "What's your name?",
}

describe("demoam pre-operator gate — the name is never skippable (CONTRACT.md 11)", () => {
  // WHY: 2026-08-16, seen live — the name question was uttered as free text
  // during a FAQ detour, counted as "asked", capped by maxAsks, and the
  // escalation went through with "Thank you, ." and a briefing reading
  // "Name: —". The hand-off message is written around the name, so the ask
  // cap must never apply to it.
  const technicalComplete: Partial<SessionState> = {
    serialNumber: "HKA4OB100LQ26050199",
    collectedData: { problemDescription: "ERROR 001", problemStartedWhen: "today" },
  }

  it("keeps asking for the name even after it was requested many times", () => {
    const action = nextPreOperatorAction(
      technicalComplete as SessionState,
      QUESTIONS,
      { name: 99 },
      "technical",
    )
    expect(action.kind).toBe("ask")
    if (action.kind === "ask") {
      expect(action.field).toBe("name")
      // alreadyAsked stays true so the caller tells the model to SAVE the
      // answer sitting in the transcript rather than repeat the question.
      expect(action.alreadyAsked).toBe(true)
    }
  })

  it("still caps TECHNICAL fields at maxAsks — the cap exists so an unanswered checkbox never blocks a human", () => {
    const state: Partial<SessionState> = {
      serialNumber: "HKA4OB100LQ26050199",
      collectedData: { problemStartedWhen: "today" }, // description missing
      name: "Giulia",
    }
    const action = nextPreOperatorAction(
      state as SessionState,
      QUESTIONS,
      { problemDescription: 2 }, // reached maxAsks (default 2)
      "technical",
    )
    // description is capped-out and everything else is answered → escalate.
    expect(action.kind).toBe("escalate")
  })

  it("no_device shape asks ONLY the name (rules 8/10: no serial, no technical checks)", () => {
    const action = nextPreOperatorAction({} as SessionState, QUESTIONS, {}, "no_device")
    expect(action.kind).toBe("ask")
    if (action.kind === "ask") expect(action.field).toBe("name")
  })
})

describe("demoam intake invariant — midIntakePendingQuestion (CONTRACT.md 2/3/7)", () => {
  // WHY: 2026-08-16, seen live — mid-intake turns ended in bare
  // acknowledgements ("Ho salvato il numero di serie.") or invented
  // diagnoses ("il ronzio viene dalle lame") instead of the next gate
  // question. When this predicate is non-null the reply IS the dictated
  // question; these tests pin exactly when it may and may not fire.

  it("stays null when nothing is on record — a complaint or pure FAQ chat must never trip it", () => {
    expect(midIntakePendingQuestion({} as SessionState, QUESTIONS)).toBeNull()
  })

  it("stays null while a flow node is pending — the flow machinery owns those turns", () => {
    const state: Partial<SessionState> = {
      serialNumber: "HKA4OB100LQ26050199",
      currentNodeId: "n1",
    }
    expect(midIntakePendingQuestion(state as SessionState, QUESTIONS)).toBeNull()
  })

  it("dictates the next missing question once an intake fact is on record", () => {
    const state: Partial<SessionState> = { serialNumber: "HKA4OB100LQ26050199" }
    expect(midIntakePendingQuestion(state as SessionState, QUESTIONS)).toBe(
      QUESTIONS.problemDescription,
    )
  })

  it("a serial exhausted after 3 failed attempts counts as intake started", () => {
    const state: Partial<SessionState> = { serialNumberExhausted: true }
    expect(midIntakePendingQuestion(state as SessionState, QUESTIONS)).toBe(
      QUESTIONS.problemDescription,
    )
  })

  it("stays null when intake is complete — the post-intake obligation takes over from there", () => {
    const state: Partial<SessionState> = {
      serialNumber: "HKA4OB100LQ26050199",
      collectedData: { problemDescription: "ERROR 001", problemStartedWhen: "today" },
    }
    expect(midIntakePendingQuestion(state as SessionState, QUESTIONS)).toBeNull()
  })
})

describe("workspace copy rendering — renderWorkspaceCopy (CONTRACT.md 19, CLAUDE.md 1A)", () => {
  // WHY: 2026-08-17, seen live — "Ciao! Mi chiamo {{chatbotName}} e sono
  // l'assistente digitale di {{companyName}}" reached a customer verbatim.
  // The old greeting hop had been filling the placeholders from prompt
  // context as a side effect; no code ever substituted them.
  const workspace = { name: "AmRobots", chatbotName: "SofIA", termsAndConditions: "T&C text" }

  it("substitutes workspace identity placeholders, case-insensitively and with inner spaces", () => {
    expect(
      renderWorkspaceCopy("Ciao! Sono {{chatbotName}} di {{ CompanyName }}.", workspace),
    ).toBe("Ciao! Sono SofIA di AmRobots.")
  })

  it("NEVER touches {{customerName}} — that is per-customer and resolved by the module at runtime", () => {
    expect(renderWorkspaceCopy("Bentornato {{customerName}}!", workspace)).toBe(
      "Bentornato {{customerName}}!",
    )
  })

  it("substitutes {{termsAndConditions}} and passes undefined through untouched", () => {
    expect(renderWorkspaceCopy("Leggi: {{termsAndConditions}}", workspace)).toBe("Leggi: T&C text")
    expect(renderWorkspaceCopy(undefined, workspace)).toBeUndefined()
  })
})

describe("welcome-back threshold — resolveGreeting (CONTRACT.md 16/32)", () => {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000
  const base = { historyLength: 4, hasKnownName: true, nowMs: 10_000_000_000, staleMs: TWO_HOURS_MS }

  it("under the threshold the conversation just continues — no greeting", () => {
    expect(resolveGreeting({ ...base, lastMessageAtMs: base.nowMs - (TWO_HOURS_MS - 1000) })).toBe("none")
  })

  it("past the threshold the customer is greeted as returning", () => {
    expect(resolveGreeting({ ...base, lastMessageAtMs: base.nowMs - (TWO_HOURS_MS + 1000) })).toBe("returning")
  })

  it("a NEW chat from a known customer is welcome-back immediately (rule 16), regardless of the clock", () => {
    expect(resolveGreeting({ ...base, historyLength: 0, lastMessageAtMs: undefined })).toBe("returning")
  })

  it("agent.ts pins the threshold at exactly two hours (rule 32)", () => {
    expect(AGENT_SOURCE).toContain("2 * 60 * 60 * 1000")
  })
})

describe("operator briefing — the customer's words, never the model's (CONTRACT.md 2)", () => {
  // WHY: 2026-08-17, seen live — for a customer asking how to change the
  // BLADES, the model-authored Summary in the operator briefing contained a
  // fully invented nine-step guide to replacing the WHEELS. Verbatim quotes
  // cannot invent, by construction.
  const history = [
    { role: "assistant", content: "Ciao! Come posso aiutarti?" },
    { role: "user", content: "  ho una domanda\n come cambio   le lame? " },
    { role: "tool", content: '{"ok":true}' },
    { role: "user", content: "Pino" },
  ]

  it("picks only the customer's messages, whitespace-collapsed, in order", () => {
    expect(customerVerbatim(history)).toEqual(["ho una domanda come cambio le lame?", "Pino"])
  })

  it("clips a rambling message at the cap with an ellipsis instead of dropping it", () => {
    const long = "x".repeat(400)
    const [clipped] = customerVerbatim([{ role: "user", content: long }])
    expect(clipped).toHaveLength(301) // 300 + ellipsis
    expect(clipped.endsWith("…")).toBe(true)
  })

  it("keeps only the last N messages so the briefing stays readable", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ role: "user", content: `msg ${i}` }))
    expect(customerVerbatim(many, 5)).toEqual(["msg 4", "msg 5", "msg 6", "msg 7", "msg 8"])
  })

  it("the briefing renders the verbatim section and the model-authored Summary section is gone", () => {
    expect(AGENT_SOURCE).toContain("**Customer said (verbatim)**")
    expect(AGENT_SOURCE).not.toContain("'**Summary**'")
  })
})

describe("escalate shape — evidence beats declaration (CONTRACT.md 11)", () => {
  // WHY: 2026-08-17, seen live (es conversation) — the model declares
  // `reason` fresh on every escalate call and flip-flopped mid-case: the
  // first call's no_device reason made the gate ask ONLY the name, the
  // second call's technical reason forced the flow after — so the name
  // landed BEFORE the technical checks. With intake facts on record there
  // IS a device being diagnosed: the shape must be technical regardless of
  // the declared reason.
  it("intakeEvidenceOnRecord is true for serial, exhausted serial, or a saved description — false otherwise", () => {
    expect(intakeEvidenceOnRecord({} as never)).toBe(false)
    expect(intakeEvidenceOnRecord({ serialNumber: "HKA4OB100LQ26050199" } as never)).toBe(true)
    expect(intakeEvidenceOnRecord({ serialNumberExhausted: true } as never)).toBe(true)
    expect(intakeEvidenceOnRecord({ collectedData: { problemDescription: "ERROR 001" } } as never)).toBe(true)
  })

  it("the escalate handler derives the shape from evidence, not from the model's reason alone", () => {
    expect(AGENT_SOURCE).toContain("intakeEvidenceOnRecord(state) ? 'technical' : caseShapeFor(reason)")
  })
})

describe("problem description — informativeness is judged, not measured (CONTRACT.md 7)", () => {
  // WHY: 2026-08-17, seen live — "no me funciona el Robot" is 24 characters
  // of nothing: it passed the length-only guard, intake completed on zero
  // information, and a flow got attached by guesswork (the bot asserted a
  // noise nobody reported). The guard now consults an isolated yes/no judge
  // (fail-open) on top of the length fast-path.
  it("the guard accepts an injected judge and awaits its verdict", () => {
    const GUARDS_SOURCE = fs.readFileSync(
      path.join(__dirname, "../../custom-demoam/content-guards.ts"),
      "utf8",
    )
    expect(GUARDS_SOURCE).toContain("isInformative?: (text: string) => Promise<boolean>")
    expect(AGENT_SOURCE).toContain("descriptionDescribesSymptom")
  })
})

describe("architectural locks — source greps (CLAUDE.md 1B pattern)", () => {
  it("the context-bearing greeting hop cannot come back — greetings go through the isolated translation call", () => {
    // WHY: 2026-08-17 — told to "only translate", the greeting hop answered
    // the customer's question inside the greeting (invented warranty apology
    // + staged hand-over riding on "Bentornato Pinotto").
    expect(AGENT_SOURCE).not.toContain("greetingOnlyHop")
    expect(AGENT_SOURCE).toContain("const withGreeting")
  })

  it("running out of tool hops re-asks the pending question — it NEVER escalates", () => {
    // WHY: 2026-08-16 — "grazie mille, gentilissima!" burned 6 hops retrying
    // a rejected FAQ, then the exhausted-hops fallback disabled the chat and
    // paged an operator over a thank-you.
    expect(AGENT_SOURCE).toContain("re-asking the pending question")
    expect(AGENT_SOURCE).not.toContain("without a final reply — escalating")
  })

  it("the FAQ-verify hop has all three declared outcomes, each with a mechanical consequence", () => {
    // WHY: 2026-08-17 — with only two classes, "a question no FAQ covers"
    // was inexpressible: it got squeezed into technical_problem_intake and a
    // customer asking about warranty coverage was walked into intake instead
    // of rule 8's hand-over.
    expect(AGENT_SOURCE).toContain("'question_no_faq'")
    expect(AGENT_SOURCE).toContain("'technical_problem_intake'")
    expect(AGENT_SOURCE).toContain("'greeting_or_smalltalk'")
  })
})
