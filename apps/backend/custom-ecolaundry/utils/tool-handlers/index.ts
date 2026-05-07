// Tool dispatcher. Maps an LLM-supplied tool name to a deterministic handler
// from the cassette modules. Adding a new tool means: declare its schema in
// `../agent-tools.ts:TOOLS`, write the handler in the right module, then
// register it in `HANDLERS` below. The KNOWN_TOOLS set is derived so any
// schema/handler drift surfaces immediately.

import { logger } from '../logger.js'
import { setLocation, setLocationStreet } from './location.js'
import {
  setDisplayState,
  setMachineFacts,
  setPaymentFacts,
} from './machine.js'
import { advanceMachineFlow, startMachineFlow } from './flow.js'
import { applyFaqOverride } from './faq.js'
import { captureCustomerName } from './customer.js'
import {
  escalateToOperator,
  markResolved,
  requestPhoto,
} from './closure.js'
import type { ToolHandler, ToolResult } from './types.js'
import type { AgentRuntime } from '../../models/index.js'

const HANDLERS: Record<string, ToolHandler> = {
  set_location: setLocation,
  set_location_street: setLocationStreet,
  set_machine_facts: setMachineFacts,
  set_payment_facts: setPaymentFacts,
  set_display_state: setDisplayState,
  start_machine_flow: startMachineFlow,
  advance_machine_flow: advanceMachineFlow,
  apply_faq_override: applyFaqOverride,
  capture_customer_name: captureCustomerName,
  escalate_to_operator: escalateToOperator,
  request_photo: requestPhoto,
  mark_resolved: markResolved,
}

/** Allowlist of tool names known to the dispatcher. */
export const KNOWN_TOOLS: ReadonlySet<string> = new Set(Object.keys(HANDLERS))

/**
 * Run the tool requested by the LLM. Unknown tools are rejected with a
 * warning (a sign of prompt injection or model drift); known tools delegate
 * to their typed handler. Each handler validates its own args and returns
 * a `ToolResult` that the agent loop forwards back to the LLM.
 */
export async function executeTool(
  ar: AgentRuntime,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const handler = HANDLERS[name]
  if (!handler) {
    logger.warn('LLM invoked an unknown tool; rejecting', {
      tool: name,
      argsKeys: Object.keys(args),
    })
    return { ok: false, error: `unknown tool ${name}` }
  }
  return handler(ar, args)
}

export type { ToolHandler, ToolResult } from './types.js'
