// Unit tests for guardAlmDisambiguation (utils/guards/alm-disambiguation.ts).
//
// The guard intercepts displayState='ALM' when machine facts are known,
// shows the washerCaseAlm disambiguation list, and clears displayState
// so the next turn can route the specific sub-type.
//
// Run with:
//   node --import tsx __tests__/unit/alm-disambiguation.test.ts

import { guardAlmDisambiguation } from '../../utils/guards/alm-disambiguation.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import type { Runtime, Settings } from '../../models/runtime.js'

function makeAr(overrides: Partial<ReturnType<typeof createInitialState>> = {}): AgentRuntime {
  const settings: Settings = {
    enabledLanguages: ['es', 'it', 'ca'],
    defaultLanguage: 'es',
    maxToolHops: 6,
    discountCodePrefix: 'SAU',
  }
  return {
    state: {
      ...createInitialState(),
      location: 'Goya',
      machineNumber: '3',
      machineType: 'washer',
      language: 'es',
      ...overrides,
    },
    runtime: {
      settings,
      prompts: {},
      flows: { washer: {}, dryer: {} },
      regressions: [],
      locations: { locations: {} },
      displayFlows: { flows: [] },
      nluPatterns: { intents: [], topics: [], displayCodes: [] },
    } as unknown as Runtime,
    pendingEscalation: null,
    resolved: false,
  } as unknown as AgentRuntime
}

interface Case { name: string; run: () => void }

const cases: Case[] = [
  {
    name: 'ALM + facts known → shows disambiguation list and clears displayState',
    run: () => {
      const ar = makeAr({ displayState: 'ALM' })
      const result = guardAlmDisambiguation(ar)
      if (!result) throw new Error('Expected outcome, got null')
      if (result.reason !== 'alm-disambiguation') throw new Error(`Wrong reason: ${result.reason}`)
      if (ar.state.displayState !== '') throw new Error('displayState should be cleared')
    },
  },
  {
    name: 'ALM/DOOR → guard does not fire (specific sub-type handled by display-flow)',
    run: () => {
      const ar = makeAr({ displayState: 'ALM/DOOR' })
      const result = guardAlmDisambiguation(ar)
      if (result !== null) throw new Error('Should return null for ALM/DOOR')
    },
  },
  {
    name: 'ALM but location missing → guard does not fire (facts not gathered yet)',
    run: () => {
      const ar = makeAr({ displayState: 'ALM', location: '' })
      const result = guardAlmDisambiguation(ar)
      if (result !== null) throw new Error('Should return null when location missing')
    },
  },
  {
    name: 'ALM but machineNumber missing → guard does not fire',
    run: () => {
      const ar = makeAr({ displayState: 'ALM', machineNumber: '' })
      const result = guardAlmDisambiguation(ar)
      if (result !== null) throw new Error('Should return null when machineNumber missing')
    },
  },
  {
    name: 'ALM but activeFlowId set → guard does not fire (specific flow takes priority)',
    run: () => {
      const ar = makeAr({ displayState: 'ALM', activeFlowId: 'some-other-flow' })
      const result = guardAlmDisambiguation(ar)
      if (result !== null) throw new Error('Should return null when activeFlowId is set')
    },
  },
  {
    name: 'no displayState → guard does not fire',
    run: () => {
      const ar = makeAr({ displayState: '' })
      const result = guardAlmDisambiguation(ar)
      if (result !== null) throw new Error('Should return null when no displayState')
    },
  },
]

async function main(): Promise<void> {
  let passed = 0; let failed = 0
  const failures: Array<{ name: string; reason: string }> = []
  for (const c of cases) {
    try {
      c.run()
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      failures.push({ name: c.name, reason })
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
