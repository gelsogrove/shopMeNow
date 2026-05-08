// Standalone unit test (NO LLM) — utils/flow-engine.ts pure helpers.
//
// SCENARIO:
//   The flow engine is JSON-driven: washer / dryer flows live in
//   json/{washer_hs60xx,dryer_ed340}.json. Most of flow-engine.ts is
//   stateful (startFlow, advanceActiveFlow) or LLM-backed (classifyChoiceViaLLM).
//   This file pins the PURE helpers:
//     - normalizeConfirmation: yes/no detection across languages
//     - mapChoiceDescriptions: parses the prompt for "1. label / 2. label"
//     - currentFlowGroup / currentFlowNode: data lookup
//     - selectInitialStepFromState: dispatches to the right step based on
//       sticky state (display, payment, etc.).
//
// Run with:
//   node --import tsx __tests__/unit/flow-engine.test.ts

import {
  currentFlowGroup,
  currentFlowNode,
  mapChoiceDescriptions,
  normalizeConfirmation,
  selectInitialStepFromState,
} from '../../utils/flow-engine.js'
import { createInitialState } from '../../utils/state.js'
import type { FlowNode, Runtime } from '../../models/index.js'

function makeFlowNode(prompt: string, transitions?: Record<string, string>): FlowNode {
  return {
    type: 'choice',
    prompt,
    transitions: transitions ?? {},
  } as FlowNode
}

function makeRuntime(): Runtime {
  // Minimal runtime: flows.washer.non_parte with the canonical step ids.
  return {
    settings: {} as Runtime['settings'],
    locations: {} as Runtime['locations'],
    displayFlows: {} as Runtime['displayFlows'],
    faqs: {},
    nluPatterns: { _schemaVersion: 1, patterns: [] } as Runtime['nluPatterns'],
    flows: {
      washer: {
        non_parte: {
          start: makeFlowNode('start node'),
          case_sel: makeFlowNode('SEL guidance'),
          case_push: makeFlowNode('PUSH guidance'),
          case_door: makeFlowNode('DOOR guidance'),
          pay_help: makeFlowNode('payment help'),
        },
      },
      dryer: {
        non_parte: {
          start: makeFlowNode('dryer start'),
        },
      },
    },
  } as Runtime
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── normalizeConfirmation ─────────────────────────────────────────────────
  {
    name: 'normalizeConfirmation: "yes" → YES',
    run: () => {
      if (normalizeConfirmation('yes') !== 'YES') throw new Error('expected YES')
    },
  },
  {
    name: 'normalizeConfirmation: "sì" → YES (Italian with grave)',
    run: () => {
      if (normalizeConfirmation('sì') !== 'YES') throw new Error('expected YES')
    },
  },
  {
    name: 'normalizeConfirmation: "si" → YES (Spanish/Italian without accent)',
    run: () => {
      if (normalizeConfirmation('si') !== 'YES') throw new Error('expected YES')
    },
  },
  {
    name: 'normalizeConfirmation: "ok" → YES',
    run: () => {
      if (normalizeConfirmation('ok') !== 'YES') throw new Error('expected YES')
    },
  },
  {
    name: 'normalizeConfirmation: "fatto, ora funziona" → YES (multi-word)',
    run: () => {
      if (normalizeConfirmation('fatto, ora funziona') !== 'YES') {
        throw new Error('expected YES')
      }
    },
  },
  {
    name: 'normalizeConfirmation: "no" → NO',
    run: () => {
      if (normalizeConfirmation('no') !== 'NO') throw new Error('expected NO')
    },
  },
  {
    name: 'normalizeConfirmation: "nope" → NO',
    run: () => {
      if (normalizeConfirmation('nope') !== 'NO') throw new Error('expected NO')
    },
  },
  {
    name: 'normalizeConfirmation: "non funziona" → NO (negative narrative)',
    run: () => {
      if (normalizeConfirmation('non funziona') !== 'NO') throw new Error('expected NO')
    },
  },
  {
    name: 'normalizeConfirmation: "not yet" → NO (English narrative)',
    run: () => {
      if (normalizeConfirmation('not yet') !== 'NO') throw new Error('expected NO')
    },
  },
  {
    name: 'normalizeConfirmation: "maybe" → null (ambiguous)',
    run: () => {
      if (normalizeConfirmation('maybe') !== null) throw new Error('expected null')
    },
  },
  {
    name: 'normalizeConfirmation: empty → null',
    run: () => {
      if (normalizeConfirmation('') !== null) throw new Error('expected null')
    },
  },

  // ── mapChoiceDescriptions ─────────────────────────────────────────────────
  {
    name: 'mapChoiceDescriptions: parses numbered options "1. foo\\n2. bar"',
    run: () => {
      const node = makeFlowNode(
        'Choose one:\n1. SEL\n2. PUSH PROG\n3. DOOR',
      )
      const descriptions = mapChoiceDescriptions(node)
      if (descriptions['1'] !== 'SEL') throw new Error(`expected "SEL", got "${descriptions['1']}"`)
      if (descriptions['2'] !== 'PUSH PROG') throw new Error('option 2 mismatch')
      if (descriptions['3'] !== 'DOOR') throw new Error('option 3 mismatch')
    },
  },
  {
    name: 'mapChoiceDescriptions: ignores lines without leading number',
    run: () => {
      const node = makeFlowNode(
        'Header text\n1. first\nplain line\n2. second',
      )
      const descriptions = mapChoiceDescriptions(node)
      if (Object.keys(descriptions).length !== 2) {
        throw new Error(`expected 2 entries, got ${Object.keys(descriptions).length}`)
      }
    },
  },

  // ── currentFlowGroup / currentFlowNode ────────────────────────────────────
  {
    name: 'currentFlowGroup: returns null when no activeFlowId or machineType',
    run: () => {
      const state = createInitialState()
      const rt = makeRuntime()
      if (currentFlowGroup(rt, state) !== null) throw new Error('expected null on empty state')
    },
  },
  {
    name: 'currentFlowGroup: returns washer flow when machineType=washer + activeFlowId set',
    run: () => {
      const state = createInitialState()
      state.machineType = 'washer'
      state.activeFlowId = 'non_parte'
      const flow = currentFlowGroup(makeRuntime(), state)
      if (!flow) throw new Error('expected a flow group')
      if (!flow.case_sel) throw new Error('case_sel missing — wrong flow loaded')
    },
  },
  {
    name: 'currentFlowGroup: returns dryer flow when machineType=dryer',
    run: () => {
      const state = createInitialState()
      state.machineType = 'dryer'
      state.activeFlowId = 'non_parte'
      const flow = currentFlowGroup(makeRuntime(), state)
      if (!flow) throw new Error('expected a flow group')
      // Dryer flow doesn't have case_sel in our minimal fixture.
      if (flow.case_sel) throw new Error('washer flow leaked into dryer state')
    },
  },
  {
    name: 'currentFlowNode: returns the active step',
    run: () => {
      const state = createInitialState()
      state.machineType = 'washer'
      state.activeFlowId = 'non_parte'
      state.activeStepId = 'case_push'
      const node = currentFlowNode(makeRuntime(), state)
      if (!node) throw new Error('expected node')
      if (node.prompt !== 'PUSH guidance') throw new Error('wrong node loaded')
    },
  },

  // ── selectInitialStepFromState ────────────────────────────────────────────
  {
    name: 'selectInitialStepFromState: washer + display=PUSH → case_push',
    run: () => {
      const rt = makeRuntime()
      const state = createInitialState()
      state.machineType = 'washer'
      state.displayState = 'PUSH'
      const flow = rt.flows.washer.non_parte
      const step = selectInitialStepFromState(state, 'non_parte', flow)
      if (step !== 'case_push') throw new Error(`expected case_push, got ${step}`)
    },
  },
  {
    name: 'selectInitialStepFromState: washer + display=SEL → case_sel',
    run: () => {
      const rt = makeRuntime()
      const state = createInitialState()
      state.machineType = 'washer'
      state.displayState = 'SEL'
      const flow = rt.flows.washer.non_parte
      const step = selectInitialStepFromState(state, 'non_parte', flow)
      if (step !== 'case_sel') throw new Error(`expected case_sel, got ${step}`)
    },
  },
  {
    name: 'selectInitialStepFromState: washer + display=DOOR → case_door',
    run: () => {
      const rt = makeRuntime()
      const state = createInitialState()
      state.machineType = 'washer'
      state.displayState = 'DOOR'
      const flow = rt.flows.washer.non_parte
      const step = selectInitialStepFromState(state, 'non_parte', flow)
      if (step !== 'case_door') throw new Error(`expected case_door, got ${step}`)
    },
  },
  {
    name: 'selectInitialStepFromState: paymentCompleted=false → pay_help (highest priority on washer)',
    run: () => {
      const rt = makeRuntime()
      const state = createInitialState()
      state.machineType = 'washer'
      state.paymentCompleted = false
      state.displayState = 'PUSH'  // would otherwise be case_push
      const flow = rt.flows.washer.non_parte
      const step = selectInitialStepFromState(state, 'non_parte', flow)
      if (step !== 'pay_help') {
        throw new Error(`expected pay_help (overrides display), got ${step}`)
      }
    },
  },
]

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
