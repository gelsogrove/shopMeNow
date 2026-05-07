// Tool schemas exposed to the LLM, plus a re-export of the dispatcher
// implemented in `tool-handlers/`. Adding a new tool:
//   1. Append its schema to `TOOLS` below
//   2. Write the deterministic handler in the relevant `tool-handlers/*.ts`
//   3. Register it in `tool-handlers/index.ts:HANDLERS`
//
// The schemas in this file describe the LLM-facing API; the validation,
// state mutations and side-effects live in `tool-handlers/`.

export { executeTool, KNOWN_TOOLS } from './tool-handlers/index.js'
export type { ToolHandler, ToolResult } from './tool-handlers/index.js'

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
        'Start a deterministic troubleshooting flow declared in json/washer_hs60xx.json or json/dryer_ed340.json. ONLY use a flowId from this allowlist: "non_parte" (machine does not start), "stop_error" (washer only), "post_ciclo" (washer only), "errore_reset" (dryer only). DO NOT pass pendingFlow values like "caso4-…" or "caso7-…" — those are conversation-state markers, not machine flow ids. Requires location + machineType + machineNumber + displayState already captured.',
      parameters: {
        type: 'object',
        properties: {
          flowId: {
            type: 'string',
            enum: ['non_parte', 'stop_error', 'post_ciclo', 'errore_reset'],
            description: 'Machine flow id from json/washer_hs60xx.json or json/dryer_ed340.json. Typically "non_parte".',
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
        'Escalate to a human operator. Produces a structured handover summary attached to the next reply. Call only after gathering minimum required facts (location + tipo if applicable) AND after capturing customerName.',
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
