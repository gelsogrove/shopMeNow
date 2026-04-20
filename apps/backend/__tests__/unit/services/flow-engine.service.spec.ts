/**
 * E2 — FlowEngineService Unit Tests
 *
 * WHAT: Tests the deterministic flow execution engine.
 * WHY: FlowEngineService has zero LLM calls — it's pure state machine logic.
 *      Every transition, interrupt, and escalation must be 100% predictable.
 *
 * PRINCIPLE: No mocks needed — FlowEngineService is entirely pure (no I/O).
 */

import { FlowEngineService } from "../../../src/application/services/flow-engine.service"
import { FlowMap, ChatContext, FlowState } from "../../../src/types/flow.types"

// ---------------------------------------------------------------------------
// Shared test FlowMap — a minimal "washing machine flow"
// ---------------------------------------------------------------------------

const TEST_FLOW_MAP: FlowMap = {
  non_parte: {
    step_0: {
      type: "CHOICE",
      prompt: "Is the machine making noise? Reply 1 = Yes, 2 = No",
      transitions: {
        "1": "non_parte.caso_rumore",
        "2": "non_parte.caso_silenzioso",
        YES: "non_parte.caso_rumore",
        NO: "non_parte.caso_silenzioso",
      },
      onInterruptFallback: "Let's finish this first 🔧",
    },
    caso_rumore: {
      type: "ACTION",
      prompt: "Please check the drum. Is there a foreign object? Reply 1 = Yes, 2 = No",
      transitions: {
        "1": "non_parte.handle_escalate",
        "2": "non_parte.step_ok",
      },
      isTerminal: false,
    },
    caso_silenzioso: {
      type: "INFO",
      prompt: "Check if the power cable is plugged in. Resolved? Reply 1 = Yes, 2 = No",
      transitions: {
        "1": "non_parte.step_ok",
        "2": "non_parte.handle_escalate",
      },
      isTerminal: false,
    },
    step_ok: {
      type: "CONFIRMATION",
      prompt: "Great! The issue is resolved 🎉",
      transitions: {},
      isTerminal: true,
      action: "resolve",
    },
    handle_escalate: {
      type: "ACTION",
      prompt: "Connecting you with a technician 🔧",
      transitions: {},
      isTerminal: true,
      action: "escalate",
    },
  },
}

function makeService(): FlowEngineService {
  return new FlowEngineService(TEST_FLOW_MAP)
}

function activeContext(overrides: Partial<FlowState> = {}): ChatContext {
  return {
    flowState: {
      flowId: "non_parte",
      currentNodeId: "non_parte.step_0",
      flowStatus: "ACTIVE",
      interruptCount: 0,
      lastInterruptType: null,
      lastValidStepAt: new Date().toISOString(),
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// startFlow
// ---------------------------------------------------------------------------

describe("FlowEngineService › startFlow", () => {
  it("should initialise flowState and return first node prompt", () => {
    // SCENARIO: FlowAgentLLM calls startFlow("non_parte") for the first time
    // RULE: flowState must be ACTIVE and point to step_0
    const svc = makeService()
    const ctx: ChatContext = {}

    const { responseText, context } = svc.startFlow("non_parte", ctx)

    expect(responseText).toBe(TEST_FLOW_MAP.non_parte.step_0.prompt)
    expect(context.flowState?.flowId).toBe("non_parte")
    expect(context.flowState?.currentNodeId).toBe("non_parte.step_0")
    expect(context.flowState?.flowStatus).toBe("ACTIVE")
    expect(context.flowState?.interruptCount).toBe(0)
  })

  it("should throw if flowId does not exist", () => {
    // SCENARIO: LLM hallucinates a flow name that isn't in FlowNodeConfig
    // RULE: Must throw to prevent silent failures
    const svc = makeService()
    expect(() => svc.startFlow("ghost_flow", {})).toThrow(`Flow "ghost_flow" not found`)
  })
})

// ---------------------------------------------------------------------------
// handleMessage — CHOICE node transitions
// ---------------------------------------------------------------------------

describe("FlowEngineService › CHOICE node transitions", () => {
  it("should advance to caso_rumore when user replies '1'", () => {
    // SCENARIO: User at step_0 types "1" (Yes, machine makes noise)
    // RULE: MATCH classification → look up transition "1"
    const svc = makeService()
    const ctx = activeContext()

    const result = svc.handleMessage("1", ctx)

    expect(result.responseText).toBe(TEST_FLOW_MAP.non_parte.caso_rumore.prompt)
    expect(result.nextNodeId).toBe("non_parte.caso_rumore")
    expect(result.flowStatus).toBe("ACTIVE")
    expect(result.shouldCallOperator).toBe(false)
    expect(ctx.flowState?.currentNodeId).toBe("non_parte.caso_rumore")
  })

  it("should advance to caso_silenzioso when user replies '2'", () => {
    // SCENARIO: User at step_0 types "2" (No noise)
    // RULE: MATCH classification → look up transition "2"
    const svc = makeService()
    const ctx = activeContext()

    const result = svc.handleMessage("2", ctx)

    expect(result.nextNodeId).toBe("non_parte.caso_silenzioso")
    expect(result.flowStatus).toBe("ACTIVE")
  })

  it("should advance on 'yes' (normalised to YES key)", () => {
    // SCENARIO: User types "yes" instead of "1"
    // RULE: normalizeInput maps yes/sì/ok → "YES" key in transitions
    const svc = makeService()
    const ctx = activeContext()

    const result = svc.handleMessage("yes", ctx)

    expect(result.nextNodeId).toBe("non_parte.caso_rumore")
  })
})

// ---------------------------------------------------------------------------
// handleMessage — terminal node (COMPLETED)
// ---------------------------------------------------------------------------

describe("FlowEngineService › terminal nodes", () => {
  it("should set flowStatus=COMPLETED when reaching step_ok", () => {
    // SCENARIO: User resolves issue via caso_silenzioso → step_ok
    // RULE: isTerminal=true AND no handle_escalate → COMPLETED
    const svc = makeService()
    const ctx = activeContext({ currentNodeId: "non_parte.caso_silenzioso" })

    const result = svc.handleMessage("1", ctx)

    expect(result.nextNodeId).toBe("non_parte.step_ok")
    expect(result.flowStatus).toBe("COMPLETED")
    expect(result.shouldCallOperator).toBe(false)
  })

  it("should set flowStatus=ESCALATED when reaching handle_escalate", () => {
    // SCENARIO: User needs technician — caso_rumore path leads to handle_escalate
    // RULE: action:"escalate" on terminal node → shouldCallOperator=true + ESCALATED
    const svc = makeService()
    const ctx = activeContext({ currentNodeId: "non_parte.caso_rumore" })

    const result = svc.handleMessage("1", ctx)

    expect(result.nextNodeId).toBe("non_parte.handle_escalate")
    expect(result.flowStatus).toBe("ESCALATED")
    expect(result.shouldCallOperator).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// handleMessage — HARD_BREAK
// ---------------------------------------------------------------------------

describe("FlowEngineService › HARD_BREAK", () => {
  it("should escalate immediately when user says 'operator'", () => {
    // SCENARIO: User abandons flow mid-way by typing "operator"
    // RULE: HARD_BREAK overrides any node logic → immediate escalation
    const svc = makeService()
    const ctx = activeContext()

    const result = svc.handleMessage("operator", ctx)

    expect(result.flowStatus).toBe("ESCALATED")
    expect(result.shouldCallOperator).toBe(true)
    expect(ctx.flowState?.flowStatus).toBe("ESCALATED")
  })

  it("should escalate on 'assistenza' (Italian escalation word)", () => {
    // SCENARIO: Italian customer asks for help mid-flow
    // RULE: HARD_BREAK regex is multilingual — "assistenza" triggers escalation
    const svc = makeService()
    const ctx = activeContext()

    const result = svc.handleMessage("assistenza", ctx)

    expect(result.flowStatus).toBe("ESCALATED")
    expect(result.shouldCallOperator).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// handleMessage — SOFT_BREAK
// ---------------------------------------------------------------------------

describe("FlowEngineService › SOFT_BREAK", () => {
  it("should pause flow when user types 'stop'", () => {
    // SCENARIO: User types "stop" — they want to take a break
    // RULE: SOFT_BREAK → flowStatus=PAUSED, currentNodeId unchanged (resumable)
    const svc = makeService()
    const ctx = activeContext()

    const result = svc.handleMessage("stop", ctx)

    expect(result.flowStatus).toBe("PAUSED")
    expect(result.shouldCallOperator).toBe(false)
    expect(ctx.flowState?.flowStatus).toBe("PAUSED")
    expect(ctx.flowState?.currentNodeId).toBe("non_parte.step_0") // unchanged
  })
})

// ---------------------------------------------------------------------------
// handleMessage — INTERRUPT_FAQ
// ---------------------------------------------------------------------------

describe("FlowEngineService › INTERRUPT_FAQ", () => {
  it("should NOT escalate on first FAQ interrupt (interruptCount < 3)", () => {
    // SCENARIO: User asks off-topic question while in the flow (below soft limit)
    // RULE: Return onInterruptFallback prompt but stay ACTIVE — below INTERRUPT_SOFT_LIMIT
    const svc = makeService()
    const ctx = activeContext()

    const result = svc.handleMessage("quanto costa?", ctx)

    expect(result.flowStatus).toBe("ACTIVE")
    expect(result.shouldCallOperator).toBe(false)
    expect(ctx.flowState?.interruptCount).toBe(1)
  })

  it("should push redirect message when interruptCount reaches SOFT_LIMIT (3)", () => {
    // SCENARIO: User keeps interrupting — 3rd attempt hits soft limit
    // RULE: interruptCount >= 3 → tell user to finish the flow first
    const svc = makeService()
    const ctx = activeContext({ interruptCount: 2 })

    const result = svc.handleMessage("how much does it cost?", ctx)

    expect(result.responseText).toContain("machine issue first")
    expect(result.flowStatus).toBe("ACTIVE")
    expect(ctx.flowState?.interruptCount).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// handleMessage — AMBIGUOUS
// ---------------------------------------------------------------------------

describe("FlowEngineService › AMBIGUOUS input", () => {
  it("should ask clarification on first ambiguous input", () => {
    // SCENARIO: User types random text that doesn't match any pattern
    // RULE: AMBIGUOUS → ask for clarification, currentNodeId unchanged
    const svc = makeService()
    const ctx = activeContext()

    const result = svc.handleMessage("bla bla bla", ctx)

    expect(result.flowStatus).toBe("ACTIVE")
    expect(result.shouldCallOperator).toBe(false)
    expect(ctx.flowState?.interruptCount).toBe(1)
  })

  it("should escalate after 4 ambiguous inputs (HARD_LIMIT)", () => {
    // SCENARIO: User keeps sending gibberish — hits hard limit (4)
    // RULE: interruptCount >= INTERRUPT_HARD_LIMIT (4) → escalate
    const svc = makeService()
    const ctx = activeContext({ interruptCount: 3 })

    const result = svc.handleMessage("zzzzzz", ctx)

    expect(result.flowStatus).toBe("ESCALATED")
    expect(result.shouldCallOperator).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// handleMessage — AMBIGUOUS on CONFIRMATION nodes
// ---------------------------------------------------------------------------

describe("FlowEngineService › AMBIGUOUS on CONFIRMATION node", () => {
  // Build a service with a CONFIRMATION node that has YES/NO transitions
  const CONFIRM_FLOW_MAP: FlowMap = {
    non_parte: {
      ...TEST_FLOW_MAP.non_parte,
      step_confirm: {
        type: "CONFIRMATION",
        prompt: "Did you complete the payment? Reply Yes or No.",
        transitions: {
          YES: "non_parte.step_ok",
          NO: "non_parte.handle_escalate",
        },
        onInterruptFallback: "Did you complete the payment? Reply Yes or No.",
      },
    },
  }

  function makeConfirmService() {
    return new FlowEngineService(CONFIRM_FLOW_MAP)
  }

  function confirmContext(overrides: Partial<FlowState> = {}): ChatContext {
    return {
      flowState: {
        flowId: "non_parte",
        currentNodeId: "non_parte.step_confirm",
        flowStatus: "ACTIVE",
        interruptCount: 0,
        lastInterruptType: null,
        lastValidStepAt: new Date().toISOString(),
        ...overrides,
      },
    }
  }

  it("should return isAmbiguousChoice=true for 'bene' on CONFIRMATION node", () => {
    // SCENARIO: User says "bene" (Italian for "good/ok") on a YES/NO confirmation node
    // RULE: CONFIRMATION + AMBIGUOUS → trigger Sub-LLM path (isAmbiguousChoice)
    //       so the Sub-LLM can classify "bene" → YES transition
    //       instead of looping with re-prompt + eventually escalating
    const svc = makeConfirmService()
    const ctx = confirmContext()

    const result = svc.handleMessage("bene", ctx)

    expect(result.isAmbiguousChoice).toBe(true)
    expect(result.ambiguousInput).toBe("bene")
    expect(result.choiceTransitionDescriptions).toBeDefined()
    expect(result.choiceTransitionDescriptions!["YES"]).toContain("agrees")
    expect(result.flowStatus).toBe("ACTIVE")
    expect(result.shouldCallOperator).toBe(false)
  })

  it("should return isAmbiguousChoice=true for 'fatto grazie' on CONFIRMATION node", () => {
    // SCENARIO: User confirms with a multi-word phrase not in the MATCH list
    // RULE: CONFIRMATION + AMBIGUOUS → isAmbiguousChoice path
    const svc = makeConfirmService()
    const ctx = confirmContext()

    const result = svc.handleMessage("fatto grazie", ctx)

    expect(result.isAmbiguousChoice).toBe(true)
    expect(result.ambiguousInput).toBe("fatto grazie")
    expect(result.flowStatus).toBe("ACTIVE")
  })

  it("'hecho' IS in MATCH list → classified as YES → advances to step_ok (terminal → COMPLETED)", () => {
    // SCENARIO: Spanish user says "hecho" (done) — it's in normalizeInput → "YES"
    // RULE: exact MATCH ("hecho" → YES) → applyTransition directly, NOT ambiguous path
    //       step_ok is terminal with action="resolve" → flowStatus=COMPLETED, nextNodeId=null
    const svc = makeConfirmService()
    const ctx = confirmContext()

    const result = svc.handleMessage("hecho", ctx)

    // "hecho" is in the MATCH/normalizeInput list → classified directly as YES → step_ok (terminal)
    expect(result.flowStatus).toBe("COMPLETED")
    expect(result.isAmbiguousChoice).toBeFalsy()
    expect(result.nextNodeId).toBe("non_parte.step_ok")
  })

  it("should NOT escalate immediately on first ambiguous input to CONFIRMATION node", () => {
    // SCENARIO: User sends ambiguous text on a CONFIRMATION node
    // RULE: Must NOT escalate on first ambiguous — should use isAmbiguousChoice path instead
    const svc = makeConfirmService()
    const ctx = confirmContext()

    const result = svc.handleMessage("mi sembra di si", ctx)

    expect(result.shouldCallOperator).toBe(false)
    expect(result.flowStatus).toBe("ACTIVE")
    expect(result.isAmbiguousChoice).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TTL reset
// ---------------------------------------------------------------------------

describe("FlowEngineService › TTL reset", () => {
  it("should reset interruptCount after 30+ minutes of inactivity", () => {
    // SCENARIO: User came back after 35 minutes with a junk message
    // RULE: TTL expired → interruptCount reset to 0 before processing
    const svc = makeService()
    const expiredTs = new Date(Date.now() - 31 * 60 * 1000).toISOString() // 31 min ago
    const ctx = activeContext({ interruptCount: 3, lastValidStepAt: expiredTs })

    const result = svc.handleMessage("bla bla", ctx)

    // After TTL reset interruptCount was 0, then incremented to 1 → should NOT escalate
    expect(result.flowStatus).toBe("ACTIVE")
    expect(ctx.flowState?.interruptCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("FlowEngineService › error handling", () => {
  it("should throw if handleMessage is called with no active flowState", () => {
    // SCENARIO: FlowWorkspaceStrategy accidentally calls handleMessage without initialising flow
    // RULE: Guard at top of handleMessage → explicit error
    const svc = makeService()

    expect(() => svc.handleMessage("1", {})).toThrow("no active flow in context")
  })
})
