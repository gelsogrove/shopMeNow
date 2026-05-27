# Tool contracts

Each tool exposed to the LLM is a **contract**. The runtime validates the
call before executing it and returns an actionable error when the call
violates the contract — the LLM reads the error and retries correctly.

This file documents every tool's contract: its inputs, the validations it
runs, the state mutations it performs, and the error messages the LLM may
see. When you add or change a tool, update this file.

> Architectural background: see [`docs/architecture.md`](architecture.md).
> Iron rule **#2**: *tool refuses, LLM corrects*.

---

## set_location

**Schema**: `{ location: string }`
**Handler**: [`utils/tool-handlers/location.ts:setLocation`](../utils/tool-handlers/location.ts)

| Validation | Action on failure |
|---|---|
| `location` is a non-empty string | error: `location must be a non-empty string` |
| Not a sentinel placeholder (`(unknown)`, `(name)`) | error: `location placeholder rejected` |
| Resolves to a known laundry via `resolveKnownLocation` | error: `unknown location: <value>` (and `state.locationClarificationCount++`) |

**On success**: `state.location = <resolved canonical name>`,
`state.locationClarificationCount = 0`.

---

## set_location_street

**Schema**: `{ street: string }`
**Handler**: [`utils/tool-handlers/location.ts:setLocationStreet`](../utils/tool-handlers/location.ts)

| Validation | Action on failure |
|---|---|
| `street` is a non-empty string | error: `street must be a non-empty string` |

**On success**: `state.locationStreet = <value>`,
`state.locationStreetRequested = true`.

---

## set_machine_facts

**Schema**: `{ machineType?: 'washer' | 'dryer', machineNumber?: string }`
**Handler**: [`utils/tool-handlers/machine.ts:setMachineFacts`](../utils/tool-handlers/machine.ts)

| Validation | Action on failure |
|---|---|
| If `machineType` provided → must equal `'washer'` or `'dryer'` | error: `machineType must be "washer" or "dryer"` |
| If `machineNumber` provided → must be a non-empty string (number coerced) | error: `machineNumber must be a non-empty string` |

**On success**: each provided field overwrites the corresponding
`state.machineType` / `state.machineNumber`. Fields not provided are
left unchanged (sticky behaviour).

---

## set_payment_facts

**Schema**: `{ paymentCompleted?: boolean, paymentMethod?: string }`
**Handler**: [`utils/tool-handlers/machine.ts:setPaymentFacts`](../utils/tool-handlers/machine.ts)

| Validation | Action on failure |
|---|---|
| If `paymentCompleted` provided → must be a strict `boolean` | error: `paymentCompleted must be a boolean` |
| If `paymentMethod` provided → must be a non-empty string | error: `paymentMethod must be a non-empty string` |

**On success**: corresponding state fields are updated.

---

## set_display_state

**Schema**: `{ displayState: string }`
**Handler**: [`utils/tool-handlers/machine.ts:setDisplayState`](../utils/tool-handlers/machine.ts)

| Validation | Action on failure |
|---|---|
| `displayState` is a non-empty string | error: `displayState must be a non-empty string` |

**On success**: the value is normalised through `intent.ts:extractDisplayState`
(canonical token mapping, e.g. `001` → `C001` for caso 15) before storage.

---

## start_machine_flow

**Schema**: `{ flowId: string }`
**Handler**: [`utils/tool-handlers/flow.ts:startMachineFlow`](../utils/tool-handlers/flow.ts)
**Detector**: [`utils/flow-compatibility.ts:checkFlowCompatibility`](../utils/flow-compatibility.ts)

| Validation | Action on failure |
|---|---|
| `state.machineType` is set | error: `machineType missing — capture it via set_machine_facts before starting a flow` |
| `flowId` exists in `runtime.flows[machineType]` | error: `Flow "<id>" is declared only for <other>, not for <current>. For <current> alarms not in the catalog, escalate to operator.` (or "not a registered machine flow" with available alternatives) |
| `flow-engine.startFlow` accepts the flow | error: bubbled up from the engine |

**On success**: returns `{stepId, prompt, isTerminal, action}` from the
flow engine for the LLM to relay to the customer.

---

## advance_machine_flow

**Schema**: `{ userReply: string }`
**Handler**: [`utils/tool-handlers/flow.ts:advanceMachineFlow`](../utils/tool-handlers/flow.ts)

| Validation | Action on failure |
|---|---|
| `flow-engine.advanceActiveFlow` accepts the input | error: bubbled up from the engine |

**On success**: returns `{stepId, prompt, isTerminal, action}` from the
flow engine.

---

## apply_faq_override

**Schema**: `{ faqKey: string }`
**Handler**: [`utils/tool-handlers/faq.ts:applyFaqOverride`](../utils/tool-handlers/faq.ts)

| Validation | Action on failure |
|---|---|
| `faqKey` is a non-empty string | error: `faqKey must be a non-empty string` |

**On success**: returns `{faqKey, locationKey, override, base, textToUse}`.
The LLM should use `textToUse` (override if present, else base, else null).

---

## capture_customer_name

**Schema**: `{ name: string }`
**Handler**: [`utils/tool-handlers/customer.ts:captureCustomerName`](../utils/tool-handlers/customer.ts)
**Detector**: [`utils/customer-name.ts:validateCustomerName`](../utils/customer-name.ts)

| Validation | Action on failure |
|---|---|
| `name` is a non-empty string | error: `name must be a non-empty string` |
| First word is not a confirmation/ack ("si", "ok", "vale", "gracias", …) | error: `"<name>" looks like a confirmation, not a name. Ask the customer their name explicitly.` |
| First word is not pure digits and >= 2 chars | error: `"<name>" is not a valid name.` |

**On success**: `state.customerName = <first word>`,
`state.customerNameRequested = false`.

---

## escalate_to_operator

**Schema**: `{ reason: string }`
**Handler**: [`utils/tool-handlers/closure.ts:escalateToOperator`](../utils/tool-handlers/closure.ts)

| Validation | Action on failure |
|---|---|
| If machine incident (display set, no nonTroubleshootingIncident): location + machineType + machineNumber MUST be captured | error: `cannot escalate yet — missing required facts: <list>. Ask the customer for them first.` |
| `customerName` MUST be captured | error: `cannot escalate yet — customerName is unknown. Ask the customer "what is your name?" (in their language), then call capture_customer_name with the reply, then retry escalate_to_operator.` (also sets `state.customerNameRequested = true`) |

**On success**: applies `escalate(ar, reason)` transition →
`state.escalationReason`, `state.operatorRequested = true`,
`ar.pendingEscalation = {reason}`.

> The 2-turn protocol the LLM must follow is **enforced** by the
> "customerName unknown" rejection. The LLM does not need a prompt rule
> to remember it: the contract makes it impossible to escalate without
> a captured name.

---

## mark_resolved

**Schema**: `{}` (no parameters)
**Handler**: [`utils/tool-handlers/closure.ts:markResolved`](../utils/tool-handlers/closure.ts)
**Detector**: [`utils/mixed-signal.ts:detectMixedSignal`](../utils/mixed-signal.ts)

| Validation | Action on failure |
|---|---|
| `state.lastUserMessage` does NOT contain a mixed-signal pattern (contrast connector + complaint keyword) | error: `Mixed signal detected in customer's reply ("<evidence>"). The customer acknowledged progress AND reported a new concern. Do NOT mark resolved — address the new concern (gather facts, propose canonical fix, or escalate).` |

**On success**: applies `markResolved(ar)` transition →
`ar.resolved = true`, `state.pendingClosure = 'resolved'`.

> The mixed-signal exception is **enforced** at the tool boundary, not by
> a prompt rule. The LLM cannot accidentally close a case where the
> customer said "yes BUT…".

---

## request_photo

**Schema**: `{}` (no parameters)
**Handler**: [`utils/tool-handlers/closure.ts:requestPhoto`](../utils/tool-handlers/closure.ts)

No validation. Idempotent: sets `ar.photoRequested = true` and
`state.photoRequested = true`.

---

## Reply-side invariant: no contradiction

Even if the LLM produces a reply that mixes a closure marker
("incidencia resuelta") and an escalation marker ("vamos a revisar tu
caso manualmente"), the post-processor applies
[`enforceNoContradiction`](../agent.ts) before returning to the customer:

1. Detect the contradiction via
   `contradiction.ts:detectResolutionEscalationContradiction`.
2. Strip the resolution sentence(s) from the reply.
3. Undo the closure side-effect via `state-transitions.ts:undoResolved` so
   `state.pendingClosure='resolved'` doesn't poison the next turn.
4. Log a `warn` for observability.

This protects the customer from contradictory text and protects the next
turn from corrupted state.
