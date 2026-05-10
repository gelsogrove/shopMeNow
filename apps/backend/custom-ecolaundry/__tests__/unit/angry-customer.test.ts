// Standalone unit test (NO LLM) — guardAngryCustomerExplicit boundary
// signal: rage marker + explicit operator request → immediate escalate.
//
// SCENARIO (Andrea, 2026-05-09):
//   In Caso 6 (doble cobro) Scenario 6.2 the customer types
//   "Me habéis cobrado dos veces, estoy MUY enfadado y quiero hablar
//   con un operador AHORA MISMO". The legacy guardAngryCustomerEmpathic
//   regex (siempre falla|estoy harto|...) didn't match this exact wording,
//   so the pipeline fell through to guardForceLocation and the bot replied
//   "¿en qué lavandería estás?" — completely tone-deaf.
//
//   The fix is a boundary-signal guard that fires when BOTH conditions
//   are true:
//     - rage marker (muy enfadado / molesto / cabreado / harto / desastre / …)
//     - explicit operator request (quiero hablar con un operador / agent / …)
//   When both → escalate immediately + requireCustomerName, BEFORE any
//   gather guard. A plain angry message → goes to empathic guard. A
//   plain operator request → goes through the LLM's escalate_to_operator
//   tool with the gentler flow.
//
// Run with:
//   node --import tsx __tests__/unit/angry-customer.test.ts

import { guardAngryCustomerExplicit } from '../../utils/guards/angry-customer.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'ES — "muy enfadado + quiero hablar con un operador" → escalate + requireCustomerName',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(
        ar,
        'Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo',
      )
      if (!out) throw new Error('guard must fire on rage + operator request')
      if (out.reason !== 'angry-customer-explicit-escalate') {
        throw new Error(`expected reason "angry-customer-explicit-escalate", got "${out.reason}"`)
      }
      if (!ar.state.operatorRequested) {
        throw new Error('operatorRequested must be set')
      }
      if (!ar.state.customerNameRequested) {
        throw new Error('customerNameRequested must be set so the bot asks the name')
      }
    },
  },
  {
    name: 'ES — "estoy harto, necesito un humano" → escalate (alt rage marker + alt operator wording)',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(ar, 'Estoy harto de este servicio, necesito un humano')
      if (!out) throw new Error('guard must fire on harto + humano')
      if (!ar.state.operatorRequested) throw new Error('operatorRequested must be set')
    },
  },
  {
    name: 'ES — "esto es un desastre, dejame hablar con el encargado" → escalate',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(
        ar,
        'Esto es un desastre, déjame hablar con el encargado por favor',
      )
      if (!out) throw new Error('guard must fire on desastre + encargado')
    },
  },
  // G9 / F23 (Andrea 2026-05-10 audit) — pure-language inputs.
  // Previous tests used ES-prefixed mixed input ("estoy muy enfadado — I want
  // to speak with a human") which masked the gap that angryMarker was ES-only.
  // angryMarker now covers all 6 langs natively.
  {
    name: 'IT — pure "sono molto arrabbiato, voglio parlare con un operatore" → escalate',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(
        ar,
        'sono molto arrabbiato, voglio parlare con un operatore',
      )
      if (!out) throw new Error('IT pure rage + operator request must fire')
    },
  },
  {
    name: 'EN — pure "I am very angry, I want to speak with a human" → escalate',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(
        ar,
        'I am very angry, I want to speak with a human now',
      )
      if (!out) throw new Error('EN pure rage + operator request must fire')
    },
  },
  {
    name: 'PT — pure "estou muito irritado, quero um operador" → escalate',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(
        ar,
        'estou muito irritado, quero um operador',
      )
      if (!out) throw new Error('PT pure rage + operator request must fire')
    },
  },
  {
    name: 'CA — pure "estic molt enfadat, vull un operador" → escalate',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(
        ar,
        'estic molt enfadat, vull un operador',
      )
      if (!out) throw new Error('CA pure rage + operator request must fire')
    },
  },
  {
    name: 'FR — pure "je suis très en colère, je veux un opérateur" → escalate',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(
        ar,
        'je suis très en colère, je veux un opérateur',
      )
      if (!out) throw new Error('FR pure rage + operator request must fire')
    },
  },
  {
    name: 'NEGATIVE — angry but no operator request → null (defer to empathic guard)',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(ar, 'Estoy muy enfadado, esto es un desastre')
      if (out !== null) {
        throw new Error('must NOT fire without explicit operator request')
      }
      if (ar.state.operatorRequested) {
        throw new Error('operatorRequested must NOT be set when guard skips')
      }
    },
  },
  {
    name: 'NEGATIVE — operator request without rage → null (defer to LLM tool flow)',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(
        ar,
        'Hola, ¿podría hablar con un operador para una consulta?',
      )
      if (out !== null) {
        throw new Error('must NOT fire on polite operator request')
      }
    },
  },
  {
    name: 'NEGATIVE — neutral message → null',
    run: () => {
      const ar = makeAr()
      const out = guardAngryCustomerExplicit(ar, 'La lavadora no funciona, número 5')
      if (out !== null) throw new Error('must NOT fire on neutral message')
    },
  },
  {
    name: 'PRECONDITION — operatorRequested already set → null (escalation in progress)',
    run: () => {
      const ar = makeAr()
      ar.state.operatorRequested = true
      const out = guardAngryCustomerExplicit(
        ar,
        'estoy muy enfadado y quiero hablar con un operador',
      )
      if (out !== null) throw new Error('must skip when escalation already in progress')
    },
  },
  {
    name: 'PRECONDITION — customerNameRequested already set → null',
    run: () => {
      const ar = makeAr()
      ar.state.customerNameRequested = true
      const out = guardAngryCustomerExplicit(
        ar,
        'estoy muy enfadado y quiero hablar con un operador',
      )
      if (out !== null) throw new Error('must skip when name capture is pending')
    },
  },
]

async function main(): Promise<void> {
  await loadTestRuntime()
  let passed = 0
  let failed = 0
  for (const c of cases) {
    try {
      c.run()
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
