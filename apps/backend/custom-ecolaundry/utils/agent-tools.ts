// Tool schemas (JSON exposed to the LLM) + executeTool dispatcher.
//
// Each tool maps to a deterministic mutation of AgentRuntime / SessionState
// (or an invocation of the existing flow engine). The LLM picks WHICH tool
// to call; the side-effects live here.

import type { AgentRuntime } from '../models/index.js'
import { getFaqs, getLocationOverride } from './runtime.js'
import { startFlow, advanceActiveFlow } from './flow-engine.js'
import { logger } from './logger.js'
import { validateCustomerName } from './customer-name.js'
import { detectMixedSignal } from './mixed-signal.js'

// ── Tool definitions (passed to the LLM as JSON schemas) ──────────────────────

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'set_location',
      description:
        'Record the laundry location (pueblo) the customer is at. Use the literal name the customer typed. Do NOT fuzzy-match: "Girona" is not "Goya".',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'The pueblo or town as the customer named it.' },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_location_street',
      description:
        'Record the street within the location. Required ONLY when the location is "Mataró" (which has multiple streets). Other locations do not need this.',
      parameters: {
        type: 'object',
        properties: {
          street: { type: 'string' },
        },
        required: ['street'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_machine_facts',
      description:
        'Record machine type and/or number. Sticky: if the customer corrects later (e.g. "no aspetta è la 5"), call this again to overwrite.',
      parameters: {
        type: 'object',
        properties: {
          machineType: { type: 'string', enum: ['washer', 'dryer'] },
          machineNumber: { type: 'string', description: 'Numeric identifier as a string.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_payment_facts',
      description:
        'Record payment-related facts: paymentCompleted (true/false), paymentMethod (cash/card/code), changeReturned (true/false).',
      parameters: {
        type: 'object',
        properties: {
          paymentCompleted: { type: 'boolean' },
          paymentMethod: { type: 'string', enum: ['cash', 'card', 'code'] },
          changeReturned: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_display_state',
      description:
        'Record the exact display code the customer reports. Use the canonical token (SEL, PUSH, DOOR, ALM, AL001, ALM/E, ALM/DOOR, ALN, BLANK) when it matches; otherwise pass the raw value.',
      parameters: {
        type: 'object',
        properties: {
          displayState: { type: 'string' },
        },
        required: ['displayState'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_machine_flow',
      description:
        'Start the deterministic troubleshooting flow for the current machine. Requires location + machineType + machineNumber + displayState already captured. The flow engine returns the prompt to relay to the customer.',
      parameters: {
        type: 'object',
        properties: {
          flowId: {
            type: 'string',
            description: 'Flow id, typically "non_parte" for "machine does not start".',
          },
        },
        required: ['flowId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'advance_machine_flow',
      description:
        "Advance the currently active flow with the customer's latest reply. Returns the next prompt or a terminal action.",
      parameters: {
        type: 'object',
        properties: {
          userReply: { type: 'string' },
        },
        required: ['userReply'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_faq_override',
      description:
        'Look up an FAQ answer (with optional per-location override). Returns the location-specific text if the active location overrides it, else the base text from json/faqs.json. Always prefer textToUse from the response. Valid keys (camelCase, must match json/faqs.json exactly): washDryTime, openingHours, washerCapacity, detergents, paymentMethods, pricing, appDownload, colorTemperature, greaseStains, mixedColors, machineHygiene, ecoProducts, noFoamNormal, doubleCharge, paidButNotStarting, errorAl001, occupiedMachine, compensationCode, refundRequest, invoiceRequest, loyaltyCard, locationDifferences.',
      parameters: {
        type: 'object',
        properties: {
          faqKey: {
            type: 'string',
            description:
              'One of the keys defined in json/faqs.json (camelCase, e.g. "loyaltyCard", "openingHours", "pricing").',
          },
        },
        required: ['faqKey'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'capture_customer_name',
      description:
        'Record the customer name (first token only). Used at handover time before escalation summary.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_operator',
      description:
        'Escalate to a human operator. Produces a structured handover summary attached to the next reply. Call only after gathering minimum required facts (location + tipo if applicable).',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Short reason in English for the operator log.' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_photo',
      description:
        'Mark that the bot has asked the customer to send a photo of the display (UC17 path). Used when the customer cannot read or describe the display.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_resolved',
      description:
        'Mark the conversation as resolved (customer confirmed the issue is fixed). The bot will close with a short confirmation.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
] as const

// ── Tool execution dispatcher ─────────────────────────────────────────────────

export type ToolResult = { ok: boolean; data?: unknown; error?: string }

/**
 * Allowlist of tool names the dispatcher knows. Built from `TOOLS` so the
 * declared schema and the runtime dispatcher can never drift apart silently —
 * any tool added to one but not the other surfaces immediately.
 */
const KNOWN_TOOLS: ReadonlySet<string> = new Set(
  TOOLS.map((t) => t.function.name),
)

/**
 * Coerce an LLM-provided value to a trimmed non-empty string, or `null` if
 * the value is not a primitive scalar. Numbers/booleans are stringified
 * (LLMs occasionally emit `17` instead of `"17"`); objects, arrays, null
 * and undefined are rejected so a malicious payload like `{nested: "evil"}`
 * cannot slip through `String(v)` as `"[object Object]"`.
 */
function asTrimmedString(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim()
    return t || null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'boolean') {
    return String(value)
  }
  return null
}

/** Strictly-typed boolean check; rejects truthy strings, numbers, etc. */
function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

/** Returns `value` only when it equals one of `allowed`; null otherwise. */
function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

/** Log+return helper: surfaces validation rejects without flooding `info`. */
function rejectInvalidArg(tool: string, field: string, value: unknown, expected: string): ToolResult {
  logger.warn('Tool argument failed validation; rejecting', {
    tool,
    field,
    expected,
    receivedType: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value,
  })
  return { ok: false, error: `${field} must be ${expected}` }
}

export async function executeTool(
  ar: AgentRuntime,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const { runtime, state } = ar
  if (!KNOWN_TOOLS.has(name)) {
    logger.warn('LLM invoked an unknown tool; rejecting', {
      tool: name,
      argsKeys: Object.keys(args),
    })
    return { ok: false, error: `unknown tool ${name}` }
  }
  switch (name) {
    case 'set_location': {
      const v = asTrimmedString(args.location)
      if (!v) return rejectInvalidArg(name, 'location', args.location, 'a non-empty string')
      // Reject sentinel placeholders — the LLM sometimes echoes the prompt's
      // "(unknown)" placeholder back as a location. Only accept values that
      // resolve to a known laundry.
      if (/^\(.*\)$/.test(v) || /^unknown$/i.test(v)) {
        return { ok: false, error: 'location placeholder rejected' }
      }
      const { resolveKnownLocation } = await import('./message-parsing.js')
      const known = resolveKnownLocation(v)
      if (!known) {
        state.locationClarificationCount = (state.locationClarificationCount || 0) + 1
        return { ok: false, error: `unknown location: ${v}` }
      }
      state.location = known
      state.locationClarificationCount = 0
      return { ok: true, data: { location: known } }
    }
    case 'set_location_street': {
      const v = asTrimmedString(args.street)
      if (!v) return rejectInvalidArg(name, 'street', args.street, 'a non-empty string')
      state.locationStreet = v
      state.locationStreetRequested = true
      return { ok: true, data: { street: v } }
    }
    case 'set_machine_facts': {
      const machineType = asEnum(args.machineType, ['washer', 'dryer'] as const)
      const machineNumber = asTrimmedString(args.machineNumber)
      if (args.machineType !== undefined && machineType === null) {
        return rejectInvalidArg(name, 'machineType', args.machineType, '"washer" or "dryer"')
      }
      if (args.machineNumber !== undefined && machineNumber === null) {
        return rejectInvalidArg(name, 'machineNumber', args.machineNumber, 'a non-empty string')
      }
      if (machineType) state.machineType = machineType
      if (machineNumber) state.machineNumber = machineNumber
      return { ok: true, data: { machineType: state.machineType, machineNumber: state.machineNumber } }
    }
    case 'set_payment_facts': {
      const paymentCompleted = asBoolean(args.paymentCompleted)
      const paymentMethod = asTrimmedString(args.paymentMethod)
      if (args.paymentCompleted !== undefined && paymentCompleted === null) {
        return rejectInvalidArg(name, 'paymentCompleted', args.paymentCompleted, 'a boolean')
      }
      if (args.paymentMethod !== undefined && paymentMethod === null) {
        return rejectInvalidArg(name, 'paymentMethod', args.paymentMethod, 'a non-empty string')
      }
      if (paymentCompleted !== null) state.paymentCompleted = paymentCompleted
      if (paymentMethod) state.paymentMethod = paymentMethod
      return { ok: true, data: { paymentCompleted: state.paymentCompleted, paymentMethod: state.paymentMethod } }
    }
    case 'set_display_state': {
      const raw = asTrimmedString(args.displayState)
      if (!raw) return rejectInvalidArg(name, 'displayState', args.displayState, 'a non-empty string')
      // Normalize through extractDisplayState so the LLM can't bypass our
      // canonical token mapping (e.g. it must not record '001' when the
      // canonical token is 'C001' — caso 15).
      const { extractDisplayState } = await import('./intent.js')
      const canonical = extractDisplayState(raw) || raw
      state.displayState = canonical
      return { ok: true, data: { displayState: canonical } }
    }
    case 'start_machine_flow': {
      const flowId = asTrimmedString(args.flowId) ?? 'non_parte'
      if (!state.machineType) return { ok: false, error: 'machineType missing' }
      try {
        const result = startFlow(runtime, state, flowId)
        return {
          ok: true,
          data: {
            stepId: result.stepId,
            prompt: result.prompt,
            isTerminal: result.isTerminal,
            action: result.action,
          },
        }
      } catch (err) {
        logger.warn('start_machine_flow failed', {
          flowId,
          machineType: state.machineType,
          error: err instanceof Error ? err.message : String(err),
        })
        return { ok: false, error: (err as Error).message }
      }
    }
    case 'advance_machine_flow': {
      const userReply = asTrimmedString(args.userReply) ?? ''
      try {
        const result = await advanceActiveFlow(runtime, state, userReply)
        return {
          ok: true,
          data: {
            stepId: result.stepId,
            prompt: result.prompt,
            isTerminal: result.isTerminal,
            action: result.action,
          },
        }
      } catch (err) {
        logger.warn('advance_machine_flow failed', {
          activeFlowId: state.activeFlowId,
          activeStepId: state.activeStepId,
          error: err instanceof Error ? err.message : String(err),
        })
        return { ok: false, error: (err as Error).message }
      }
    }
    case 'apply_faq_override': {
      const key = asTrimmedString(args.faqKey)
      if (!key) return rejectInvalidArg(name, 'faqKey', args.faqKey, 'a non-empty string')
      const override = getLocationOverride(runtime, state.location)
      const overrideAnswer = override?.faqOverrides?.[key]
      // Base FAQs live in a module-level singleton populated by
      // runtime.ts:loadRuntime() → setFaqs(). They are NOT on the Runtime
      // object itself; the previous `runtime.faqs` lookup always returned
      // undefined, so the LLM never received the base text.
      const baseAnswer = getFaqs()[key] || ''
      return {
        ok: true,
        data: {
          faqKey: key,
          locationKey: state.location || null,
          override: overrideAnswer || null,
          base: baseAnswer || null,
          // The agent should prefer override when present
          textToUse: overrideAnswer || baseAnswer || null,
        },
      }
    }
    case 'capture_customer_name': {
      const raw = asTrimmedString(args.name)
      if (!raw) return rejectInvalidArg(name, 'name', args.name, 'a non-empty string')
      const validation = validateCustomerName(raw)
      if (validation.valid === false) {
        return { ok: false, error: validation.reason }
      }
      state.customerName = validation.name
      state.customerNameRequested = false
      return { ok: true, data: { name: validation.name } }
    }
    case 'escalate_to_operator': {
      // Per reglas.md "Datos mínimos en incidencias de máquina": when the
      // incident is machine-related (display set, or customer mentioned a
      // machine problem implicitly), we require local + type + number BEFORE
      // escalating. We refuse the tool call so the LLM has to gather facts
      // first. Non-troubleshooting incidents (datáfono/cámaras/refund/…) are
      // exempt because they have their own escalation path via the guard
      // pipeline.
      if (
        !state.nonTroubleshootingIncident &&
        state.displayState &&
        (!state.location || !state.machineType || !state.machineNumber)
      ) {
        const missing: string[] = []
        if (!state.location) missing.push('location')
        if (!state.machineType) missing.push('machineType')
        if (!state.machineNumber) missing.push('machineNumber')
        return {
          ok: false,
          error: `cannot escalate yet — missing required facts: ${missing.join(', ')}. Ask the customer for them first.`,
        }
      }
      const reason = asTrimmedString(args.reason) ?? 'manual review'
      state.escalationReason = reason
      state.operatorRequested = true
      ar.pendingEscalation = { reason }
      return { ok: true, data: { reason } }
    }
    case 'request_photo': {
      ar.photoRequested = true
      state.photoRequested = true
      return { ok: true, data: {} }
    }
    case 'mark_resolved': {
      // Defensive validation: refuse mark_resolved when the customer's last
      // message contains a "yes BUT new-problem" mixed signal. The LLM is
      // forced to address the new concern instead of closing the case.
      const mixed = detectMixedSignal(state.lastUserMessage)
      if (mixed.detected) {
        logger.warn('mark_resolved blocked: mixed signal in last user message', {
          evidence: mixed.evidence,
          lastUserMessage: state.lastUserMessage,
        })
        return {
          ok: false,
          error: `Mixed signal detected in customer's reply ("${mixed.evidence}"). The customer acknowledged progress AND reported a new concern. Do NOT mark resolved — address the new concern (gather facts, propose canonical fix, or escalate).`,
        }
      }
      ar.resolved = true
      state.pendingClosure = 'resolved'
      return { ok: true, data: {} }
    }
    default:
      return { ok: false, error: `unknown tool ${name}` }
  }
}
