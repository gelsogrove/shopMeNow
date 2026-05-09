// Standalone unit test (NO LLM) — agent-welcome merge logic.
//
// SCENARIO (Andrea, 2026-05-09):
//   The settings.json welcome ("👋 Hola, soy el asistente virtual...")
//   is prepended to T1 replies. The LLM, primed by prompt examples
//   like "Tranquilo, te ayudo, ...", was producing replies starting
//   with another 👋 — and the merge used `\n\n` so the customer saw a
//   stacked, two-paragraph hello with two waving hands.
//
//   The merge now strips leading opening-context emojis from the reply
//   and joins with a single space so the welcome and the first sentence
//   of the reply read as ONE paragraph. Internal `\n\n` paragraph
//   breaks of the reply (e.g. PUSH PROG instruction list) are preserved.
//
// Run with:
//   node --import tsx __tests__/unit/agent-welcome.test.ts

import { mergeWelcomeWithReply } from '../../utils/agent-welcome.js'

interface Case {
  name: string
  run: () => void
}

const WELCOME = '👋 Hola, soy el asistente virtual de la lavandería.'

const cases: Case[] = [
  {
    // REGRESSION: the original bug Andrea reported. Before the fix the
    // customer saw two 👋 stacked across two paragraphs.
    name: 'merge: welcome + reply starting with 👋 → single 👋 + inline join',
    run: () => {
      const reply = '👋 Tranquilo, te ayudo. ¿Dónde está la lavandería?'
      const out = mergeWelcomeWithReply(WELCOME, reply)
      // Exactly one 👋 in the output (counted by surrogate-pair-aware split).
      const wavingCount = [...out].filter((c) => c === '👋').length
      if (wavingCount !== 1) {
        throw new Error(`expected exactly 1 👋, got ${wavingCount}: ${out}`)
      }
      // Single paragraph (no `\n\n` between welcome and reply).
      if (/\n\n/.test(out)) {
        throw new Error(`merged output must be a single paragraph, got: ${out}`)
      }
      // Both pieces are present, in order.
      if (!out.startsWith(WELCOME)) {
        throw new Error(`welcome must lead the merged output: ${out}`)
      }
      if (!out.includes('Tranquilo, te ayudo. ¿Dónde está la lavandería?')) {
        throw new Error(`reply body must be preserved (sans leading 👋): ${out}`)
      }
    },
  },
  {
    name: 'merge: reply with no leading emoji → space-joined as-is',
    run: () => {
      const reply = '¿En qué lavandería estás ahora mismo?'
      const out = mergeWelcomeWithReply(WELCOME, reply)
      const expected = `${WELCOME} ¿En qué lavandería estás ahora mismo?`
      if (out !== expected) throw new Error(`expected "${expected}", got "${out}"`)
    },
  },
  {
    name: 'merge: reply starting with 🙂 → emoji stripped',
    run: () => {
      const reply = '🙂 Cuéntame, ¿qué número de lavadora es?'
      const out = mergeWelcomeWithReply(WELCOME, reply)
      // One 👋 (from welcome), zero 🙂.
      if ([...out].filter((c) => c === '🙂').length !== 0) {
        throw new Error(`leading 🙂 must be stripped: ${out}`)
      }
      if (!out.includes('Cuéntame, ¿qué número de lavadora es?')) {
        throw new Error(`reply body must survive: ${out}`)
      }
    },
  },
  {
    name: 'merge: reply with multiple leading emojis → all stripped',
    run: () => {
      const reply = '👋 🙂 Hola, soy también un asistente.'
      const out = mergeWelcomeWithReply(WELCOME, reply)
      // Welcome's 👋 only. None of the reply's emojis remain at start.
      const wavingCount = [...out].filter((c) => c === '👋').length
      if (wavingCount !== 1) {
        throw new Error(`expected exactly 1 👋, got ${wavingCount}: ${out}`)
      }
      if (!out.includes('Hola, soy también un asistente.')) {
        throw new Error(`text body must survive: ${out}`)
      }
    },
  },
  {
    name: 'merge: internal \\n\\n paragraph breaks of reply preserved',
    run: () => {
      // PUSH PROG-style multi-paragraph reply: the merge MUST NOT collapse
      // internal paragraph breaks; only the welcome→reply seam is inline.
      const reply = 'Pulsa un botón.\n\nProgramas:\n**60º**\n**40º**\n\nDespués dime si arranca.'
      const out = mergeWelcomeWithReply(WELCOME, reply)
      if (!/\*\*60º\*\*/.test(out)) throw new Error('bold must survive')
      if (!/\n\nProgramas:/.test(out)) {
        throw new Error('internal paragraph break before list must survive')
      }
      if (!/\n\nDespués dime/.test(out)) {
        throw new Error('internal paragraph break before loopback must survive')
      }
    },
  },
  {
    name: 'merge: empty reply → returns welcome alone',
    run: () => {
      const out = mergeWelcomeWithReply(WELCOME, '')
      if (out !== WELCOME) throw new Error(`empty reply must return welcome alone, got: "${out}"`)
    },
  },
  {
    name: 'merge: reply that is JUST emojis → returns welcome alone',
    run: () => {
      const out = mergeWelcomeWithReply(WELCOME, '👋 🙂')
      if (out !== WELCOME) {
        throw new Error(`emoji-only reply collapses to welcome alone, got: "${out}"`)
      }
    },
  },
  {
    name: 'merge: leading whitespace stripped from reply',
    run: () => {
      const out = mergeWelcomeWithReply(WELCOME, '   ¿Dónde estás?')
      if (out !== `${WELCOME} ¿Dónde estás?`) {
        throw new Error(`leading whitespace must be trimmed: "${out}"`)
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
