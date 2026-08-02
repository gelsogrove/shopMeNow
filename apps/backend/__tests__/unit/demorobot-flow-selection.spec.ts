/**
 * demorobot — LLM-driven flow selection (start_flow)
 *
 * Andrea 2026-08-02. Flow selection used to be embedding search. In production
 * that scored 0.23-0.31 against a 0.70 threshold — and got WORSE every turn,
 * because it searched the latest message ("IERI", "IMMBOLE") instead of the
 * problem. No flow was ever attached, so the model filled the silence with
 * invented diagnostics ("è la batteria carica?" appears nowhere in any flow,
 * prompt or FAQ).
 *
 * The flows are now listed in the prompt with their ids and the LLM attaches
 * one via start_flow. These tests lock down the two properties that keep that
 * from degrading back into improvisation:
 *
 *   1. The catalogue block always tells the model what it may follow, and that
 *      "nothing matches" means escalate — never invent.
 *   2. start_flow accepts ONLY ids from the list it was given. A hallucinated
 *      or cross-tenant id is refused with instructions, not silently ignored.
 */
import { formatFlowsBlock, nextIntakeStep, startFlow } from "../../custom-demorobot/flow-selection"
import { getState, resetState } from "../../custom-demorobot/state"

const FLOWS = [
  { flowId: "flow-err-001", title: "se un utente ha errore ERROR 001" },
  { flowId: "flow-no-start", title: "Robot does not start", hint: "does not move, dead" },
]

describe("demorobot flow catalogue block", () => {
  it("lists every flow with its id in square brackets", () => {
    const block = formatFlowsBlock(FLOWS)

    // The id must be copyable verbatim into start_flow.
    expect(block).toContain("[flow-err-001]")
    expect(block).toContain("se un utente ha errore ERROR 001")
    expect(block).toContain("[flow-no-start]")
  })

  it("includes the optional hint when a flow has description/keywords", () => {
    expect(formatFlowsBlock(FLOWS)).toContain("does not move, dead")
  })

  it("instructs the model to escalate when nothing matches", () => {
    const block = formatFlowsBlock(FLOWS)

    expect(block).toMatch(/escalate_to_operator/)
    expect(block).toMatch(/NEVER invent diagnostic questions/i)
  })

  describe("grouping by category", () => {
    // Categories give the model a way to narrow down by area before matching a
    // title — the difference between scanning 40 entries and scanning 400.
    const MIXED = [
      { flowId: "f1", title: "ERROR 001", category: "Robotica" },
      { flowId: "f2", title: "Cavo interrotto", category: "Cables" },
      { flowId: "f3", title: "Robot non parte", category: "Robotica" },
    ]

    it("groups flows under their category heading", () => {
      const block = formatFlowsBlock(MIXED)

      expect(block).toContain("**Robotica**")
      expect(block).toContain("**Cables**")
      // Same-category flows stay together under one heading.
      expect(block.split("**Robotica**")[1]).toContain("[f1]")
      expect(block.split("**Robotica**")[1]).toContain("[f3]")
    })

    it("still lists every flow id, whatever the grouping", () => {
      const block = formatFlowsBlock(MIXED)
      for (const f of MIXED) expect(block).toContain(`[${f.flowId}]`)
    })

    it("labels uncategorised flows as the general checks to try before escalating", () => {
      // A flow with no category is the workspace-generic fallback. It must be
      // both reachable AND recognisable as such, so the model runs its basic
      // checks instead of handing a blank case to an operator.
      const block = formatFlowsBlock([...MIXED, { flowId: "f4", title: "Generico" }])

      expect(block).toMatch(/General checks/i)
      expect(block).toMatch(/before escalating/i)
      expect(block).toContain("[f4]")
    })

    it("keeps the list flat when every flow shares one category", () => {
      // A single heading adds nothing but noise and tokens.
      const block = formatFlowsBlock([
        { flowId: "f1", title: "ERROR 001", category: "Robotica" },
        { flowId: "f3", title: "Robot non parte", category: "Robotica" },
      ])

      expect(block).not.toContain("**Robotica**")
      expect(block).toContain("[f1]")
      expect(block).toContain("[f3]")
    })

    it("keeps the list flat when no flow has a category", () => {
      const block = formatFlowsBlock(FLOWS)

      expect(block).not.toMatch(/General checks/i)
      expect(block).toContain("[flow-err-001]")
    })
  })

  it("forbids improvising when the workspace has no flows at all", () => {
    // Empty catalogue is the highest-risk case: with no procedure whatsoever
    // the model has nothing to say and is most tempted to make something up.
    const block = formatFlowsBlock([])

    expect(block).toMatch(/do not invent/i)
    expect(block).toMatch(/escalate_to_operator/)
  })
})

/**
 * Intake questions are dictated by the code, not composed by the LLM.
 *
 * Andrea 2026-08-03: while no flow was attached the model had no script, so it
 * improvised — offering the customer a numbered menu of causes it invented
 * ("il robot si muove ma le lame non girano", "non si accende"). None of those
 * strings exist in any flow, prompt or FAQ.
 *
 * Four prompt rules failed to stop it, because a rule is a request. The fix is
 * structural: the question TEXT is fixed here and the LLM only translates it,
 * so there is no room left to invent options.
 */
describe("demorobot intake questions", () => {
  // Wording comes from the workspace, never from the module: "19 characters
  // starting with HK" was AmRobots' domain hardcoded into the code.
  const QUESTIONS = {
    serialNumber: "What is your robot's serial number?",
    problemDescription: "What exactly is happening? Describe it in your own words.",
    problemStartedWhen: "When did it start — today, yesterday, or a while ago?",
  }

  it("asks for the serial number first", () => {
    const step = nextIntakeStep({}, QUESTIONS)

    expect(step?.field).toBe("serialNumber")
    expect(step?.question).toMatch(/serial number/i)
  })

  it("asks what is happening once the serial is known", () => {
    const step = nextIntakeStep({ serialNumber: "HKA4OB100LQ26050197" }, QUESTIONS)

    expect(step?.field).toBe("problemDescription")
  })

  it("keeps the problem question OPEN, never a list of guesses", () => {
    // The exact regression: a multiple-choice menu of invented symptoms.
    const step = nextIntakeStep({ serialNumber: "HK123" }, QUESTIONS)

    expect(step?.question).toMatch(/in your own words/i)
    expect(step?.question).not.toMatch(/blade|battery|charger|1\.|2\./i)
  })

  it("asks when it started once the problem is described", () => {
    const step = nextIntakeStep(
      { serialNumber: "HK123", collectedData: { problemDescription: "non taglia" } },
      QUESTIONS,
    )

    expect(step?.field).toBe("problemStartedWhen")
  })

  it("returns null once every detail is collected", () => {
    // Intake over: the flow (or the escalation) takes it from here.
    const step = nextIntakeStep(
      { serialNumber: "HK123", collectedData: { problemDescription: "non taglia", problemStartedWhen: "oggi" } },
      QUESTIONS,
    )

    expect(step).toBeNull()
  })

  it("never re-asks something already answered", () => {
    // The customer opened with the serial number: skip straight past it.
    const step = nextIntakeStep({ serialNumber: "HK123" }, QUESTIONS)

    expect(step?.field).not.toBe("serialNumber")
  })

  it("asks nothing when the workspace configured no questions", () => {
    // No hardcoded copy anywhere: an unconfigured workspace simply has no
    // intake question to ask, rather than emitting the module's own English.
    expect(nextIntakeStep({}, undefined)).toBeNull()
    expect(nextIntakeStep({}, {})).toBeNull()
  })

  it("asks the three questions in a stable order", () => {
    const order: string[] = []
    const state: { serialNumber?: string; collectedData?: Record<string, unknown> } = {}

    for (let i = 0; i < 3; i++) {
      const step = nextIntakeStep(state as never, QUESTIONS)
      if (!step) break
      order.push(step.field)
      if (step.field === "serialNumber") state.serialNumber = "HK123"
      else state.collectedData = { ...(state.collectedData ?? {}), [step.field]: "x" }
    }

    expect(order).toEqual(["serialNumber", "problemDescription", "problemStartedWhen"])
  })
})

describe("demorobot start_flow tool", () => {
  const sessionId = "sess-flow-1"
  const baseCtx = {
    sessionId,
    workspaceId: "ws-1",
    availableFlows: FLOWS,
    loadFlow: async () => ({ compiledPrompt: "## FLOW\n### Q: il robot e' attivo?", hash: "h1" }),
  }

  beforeEach(() => {
    resetState(sessionId)
  })

  it("attaches the flow when the id is in the catalogue", async () => {
    const result = await startFlow(baseCtx, { flowId: "flow-err-001" })

    expect(result.ok).toBe(true)
    const state = getState(sessionId)
    expect(state.activeFlowId).toBe("flow-err-001")
    // The compiled prompt becomes the ACTIVE FLOW block on the next hop.
    expect(state.activeFlowPromptSnapshot).toContain("il robot e' attivo?")
  })

  it("refuses an id that is not in the catalogue", async () => {
    // The obvious failure mode: the model invents a plausible-looking id.
    const result = await startFlow(baseCtx, { flowId: "flow-battery-check" })

    expect(result.ok).toBe(false)
    expect(result.error).toBe("unknown_flow_id")
    expect(getState(sessionId).activeFlowId).toBeUndefined()
  })

  it("tells the model the valid ids and to escalate when refusing", async () => {
    const result = await startFlow(baseCtx, { flowId: "nope" })

    // Tool refuses, LLM corrects — the refusal has to be actionable.
    expect(result.instruction).toContain("flow-err-001")
    expect(result.instruction).toMatch(/escalate_to_operator/)
    expect(result.instruction).toMatch(/never invent/i)
  })

  it("refuses a flow whose compiled prompt is empty", async () => {
    // Production had a flow ("err 02") with a 0-character compiledPrompt.
    // Attaching it would hand the model a blank script to fill in.
    const ctx = { ...baseCtx, loadFlow: async () => ({ compiledPrompt: "", hash: "h" }) }

    const result = await startFlow(ctx, { flowId: "flow-err-001" })

    expect(result.ok).toBe(false)
    expect(result.error).toBe("flow_unavailable")
    expect(getState(sessionId).activeFlowId).toBeUndefined()
  })

  it("refuses when the flow cannot be loaded at all", async () => {
    const ctx = { ...baseCtx, loadFlow: async () => null }

    const result = await startFlow(ctx, { flowId: "flow-err-001" })

    expect(result.ok).toBe(false)
    expect(result.instruction).toMatch(/escalate_to_operator/)
  })

  it("does not throw when the loader fails, and still refuses", async () => {
    const ctx = {
      ...baseCtx,
      loadFlow: async () => {
        throw new Error("db down")
      },
    }

    const result = await startFlow(ctx, { flowId: "flow-err-001" })

    // A database problem must degrade to escalation, never to improvisation.
    expect(result.ok).toBe(false)
    expect(getState(sessionId).activeFlowId).toBeUndefined()
  })

  it("requires a flowId", async () => {
    const result = await startFlow(baseCtx, {})

    expect(result.ok).toBe(false)
  })
})
