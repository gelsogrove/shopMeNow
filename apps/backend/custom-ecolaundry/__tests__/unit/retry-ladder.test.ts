// Unit test for `nextRetryLadderStep` — the 3-strikes ladder primitive.
import { nextRetryLadderStep } from '../../utils/guards/retry-ladder.js'

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'attempts=0 → first-ask, counter advances to 1',
    run: () => {
      let counter = 0
      const step = nextRetryLadderStep(counter, (n) => {
        counter = n
      })
      if (step !== 'first-ask') throw new Error(`expected first-ask, got ${step}`)
      if (counter !== 1) throw new Error(`counter must be 1, got ${counter}`)
    },
  },
  {
    name: 'attempts=1 → reask, counter advances to 2',
    run: () => {
      let counter = 1
      const step = nextRetryLadderStep(counter, (n) => {
        counter = n
      })
      if (step !== 'reask') throw new Error(`expected reask, got ${step}`)
      if (counter !== 2) throw new Error(`counter must be 2, got ${counter}`)
    },
  },
  {
    name: 'attempts=2 → escalate, counter reset to 0',
    run: () => {
      let counter = 2
      const step = nextRetryLadderStep(counter, (n) => {
        counter = n
      })
      if (step !== 'escalate') throw new Error(`expected escalate, got ${step}`)
      if (counter !== 0) throw new Error(`counter must reset to 0 on escalate, got ${counter}`)
    },
  },
  {
    name: 'attempts=5 (overflow) → escalate, counter reset to 0',
    run: () => {
      let counter = 5
      const step = nextRetryLadderStep(counter, (n) => {
        counter = n
      })
      if (step !== 'escalate') throw new Error(`overflow must still escalate, got ${step}`)
      if (counter !== 0) throw new Error(`counter must reset, got ${counter}`)
    },
  },
  {
    name: 'full sequence 0 → 1 → 2 → escalate',
    run: () => {
      let counter = 0
      const set = (n: number) => {
        counter = n
      }
      const a = nextRetryLadderStep(counter, set)
      const b = nextRetryLadderStep(counter, set)
      const c = nextRetryLadderStep(counter, set)
      if (a !== 'first-ask') throw new Error(`step 1 must be first-ask, got ${a}`)
      if (b !== 'reask') throw new Error(`step 2 must be reask, got ${b}`)
      if (c !== 'escalate') throw new Error(`step 3 must be escalate, got ${c}`)
      if (counter !== 0) throw new Error(`final counter must be 0 after escalate, got ${counter}`)
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
