// Standalone unit test (NO LLM) for utils/flow-compatibility.ts.
// Run: node --import tsx __tests__/unit/flow-compatibility.test.ts

import { checkFlowCompatibility } from '../../utils/flow-compatibility.js'
import type { FlowMap } from '../../models/index.js'

const washer: FlowMap = {
  _principle: {} as never,
  non_parte: {} as never,
  stop_error: {} as never,
  post_ciclo: {} as never,
}
const dryer: FlowMap = {
  _principle: {} as never,
  non_parte: {} as never,
  errore_reset: {} as never,
}
const flows = { washer, dryer }

let pass = 0
let fail = 0

function check(label: string, valid: boolean, reasonContains?: string): void {
  void label
  void valid
  void reasonContains
}

function assert(label: string, actual: { valid: boolean; reason?: string }, expectedValid: boolean, reasonContains?: string): void {
  const okValid = actual.valid === expectedValid
  const okReason = !reasonContains || (actual.reason ?? '').toLowerCase().includes(reasonContains.toLowerCase())
  if (okValid && okReason) {
    console.log(`  ✓ ${label}`)
    pass += 1
  } else {
    console.log(`  ✗ ${label}\n      got: ${JSON.stringify(actual)}`)
    fail += 1
  }
}

console.log('flow-compatibility')

// Valid pairs
assert(
  'washer + non_parte → valid',
  checkFlowCompatibility({ flowId: 'non_parte', machineType: 'washer', flows }),
  true,
)
assert(
  'washer + stop_error → valid',
  checkFlowCompatibility({ flowId: 'stop_error', machineType: 'washer', flows }),
  true,
)
assert(
  'dryer + errore_reset → valid',
  checkFlowCompatibility({ flowId: 'errore_reset', machineType: 'dryer', flows }),
  true,
)

// Wrong machine — flow exists on the OTHER machine
assert(
  'dryer + stop_error → invalid (washer-only)',
  checkFlowCompatibility({ flowId: 'stop_error', machineType: 'dryer', flows }),
  false,
  'washer',
)
assert(
  'washer + errore_reset → invalid (dryer-only)',
  checkFlowCompatibility({ flowId: 'errore_reset', machineType: 'washer', flows }),
  false,
  'dryer',
)

// Flow not in any machine
assert(
  'washer + caso5-al001 → invalid (display-flow id, not machine flow)',
  checkFlowCompatibility({ flowId: 'caso5-al001', machineType: 'washer', flows }),
  false,
  'not a registered machine flow',
)
assert(
  'dryer + nonsense → invalid (unknown)',
  checkFlowCompatibility({ flowId: 'banana', machineType: 'dryer', flows }),
  false,
  'not a registered machine flow',
)

// machineType missing
assert(
  'empty machineType → invalid',
  checkFlowCompatibility({ flowId: 'non_parte', machineType: '', flows }),
  false,
  'machinetype missing',
)

// Empty flowId
assert(
  'empty flowId → invalid',
  checkFlowCompatibility({ flowId: '', machineType: 'washer', flows }),
  false,
  'flowid is empty',
)
assert(
  'whitespace-only flowId → invalid',
  checkFlowCompatibility({ flowId: '   ', machineType: 'washer', flows }),
  false,
  'flowid is empty',
)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
