// Standalone unit test (NO LLM) — output invariants (L5).
//
// SCENARIO:
//   The LLM is multi-language and occasionally produces replies that
//   violate documented behaviour: evasive "no tengo la información",
//   location parroting ("estás en Goya"), standalone "¿has pagado?".
//   These bugs used to be patched in prompts/agent.txt. Per iron rule
//   #1 the patches now live as deterministic invariants in
//   utils/output-invariants.ts. This file pins their contracts.
//
// Run with:
//   node --import tsx __tests__/unit/output-invariants.test.ts

import {
  applyOutputInvariants,
  stripEvasivePhrases,
  stripLocationParroting,
  stripStandalonePaymentQuestion,
} from '../../utils/output-invariants.js'

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ── stripEvasivePhrases ──────────────────────────────────────────────────
  {
    name: 'stripEvasivePhrases: ES "no tengo la información" removed',
    run: () => {
      const r = stripEvasivePhrases('No tengo la información sobre eso. Vamos a revisarlo.')
      if (/no tengo la informaci[oó]n/i.test(r)) {
        throw new Error(`evasive phrase not stripped: ${r}`)
      }
      if (!/revisarlo/.test(r)) throw new Error('rest of reply must survive')
    },
  },
  {
    name: 'stripEvasivePhrases: ES "no lo sé" removed (without "bien" qualifier)',
    run: () => {
      const r = stripEvasivePhrases('No lo sé. Pasamos tu caso a revisión.')
      if (/no\s+lo\s+s[eé](?!\s+bien)/i.test(r)) throw new Error(`not stripped: ${r}`)
    },
  },
  {
    name: 'stripEvasivePhrases: ES "no lo sé bien" preserved (legitimate uncertainty)',
    run: () => {
      const r = stripEvasivePhrases('No lo sé bien, voy a revisar.')
      if (!/no lo s[eé] bien/i.test(r)) {
        throw new Error('legitimate "no lo sé bien" must NOT be stripped')
      }
    },
  },
  {
    name: 'stripEvasivePhrases: EN "I don\'t have that information" removed',
    run: () => {
      const r = stripEvasivePhrases("I don't have that information. Let me check.")
      if (/i don'?t have/i.test(r)) throw new Error(`not stripped: ${r}`)
      if (!/check/.test(r)) throw new Error('rest of reply must survive')
    },
  },
  {
    name: 'stripEvasivePhrases: IT "non lo so" removed',
    run: () => {
      const r = stripEvasivePhrases('Non lo so. Verifichiamo insieme.')
      if (/non lo so(?!\s+bene)/i.test(r)) throw new Error(`not stripped: ${r}`)
    },
  },
  {
    name: 'stripEvasivePhrases: PT "não tenho essa informação" removed',
    run: () => {
      const r = stripEvasivePhrases('Não tenho essa informação. Vamos verificar.')
      if (/n[ãa]o tenho.+informa[çc][ãa]o/i.test(r)) throw new Error(`not stripped: ${r}`)
    },
  },
  {
    name: 'stripEvasivePhrases: empty reply after strip → falls back to original',
    run: () => {
      // If the entire reply was evasive, we keep the original to avoid
      // sending an empty message to the customer.
      const original = 'no tengo la información'
      const r = stripEvasivePhrases(original)
      if (r !== original) {
        throw new Error(`empty-after-strip must fall back to original; got: "${r}"`)
      }
    },
  },
  {
    name: 'stripEvasivePhrases: clean reply unchanged',
    run: () => {
      const original = 'Perfecto, vamos a revisar tu caso.'
      const r = stripEvasivePhrases(original)
      if (r !== original) throw new Error(`clean reply mutated: "${r}"`)
    },
  },
  {
    // REGRESSION: paragraph breaks (\n\n) used to be collapsed into a
    // single space by the old `\s{2,}` step, silently destroying the
    // PUSH PROG / SEL / DOOR multi-paragraph instructions. The post-fix
    // collapse only touches spaces/tabs.
    name: 'stripEvasivePhrases: paragraph breaks (\\n\\n) preserved on clean reply',
    run: () => {
      const original = 'Pulsa un botón.\n\nProgramas:\n**60º**\n**40º**\n\nDespués dime si arranca.'
      const r = stripEvasivePhrases(original)
      if (!/Pulsa un botón\.\n\nProgramas:/.test(r)) {
        throw new Error(`paragraph break before list lost: "${r}"`)
      }
      if (!/\*\*40º\*\*\n\nDespués dime/.test(r)) {
        throw new Error(`paragraph break before loopback lost: "${r}"`)
      }
    },
  },
  {
    name: 'stripEvasivePhrases: triple+ newlines collapsed to double',
    run: () => {
      const r = stripEvasivePhrases('Línea uno.\n\n\n\nLínea dos.')
      if (!/uno\.\n\nLínea dos/.test(r)) {
        throw new Error(`triple newlines must collapse to double, got: "${r}"`)
      }
      if (/\n{3,}/.test(r)) throw new Error('reply still contains 3+ newlines')
    },
  },
  {
    name: 'stripEvasivePhrases: trailing spaces before newline cleaned',
    run: () => {
      const r = stripEvasivePhrases('Línea uno.   \n\nLínea dos.')
      if (!/uno\.\n\nLínea dos/.test(r)) {
        throw new Error(`trailing spaces before \\n must be cleaned: "${r}"`)
      }
    },
  },
  {
    // After stripping an evasive phrase, the surrounding paragraph break
    // must remain intact so the rest of the reply stays readable.
    name: 'stripEvasivePhrases: evasive removed but paragraph structure preserved',
    run: () => {
      const original = 'No tengo la información sobre el precio.\n\nPasamos tu caso a revisión.'
      const r = stripEvasivePhrases(original)
      if (/no tengo la información/i.test(r)) throw new Error('evasive must be stripped')
      if (!/Pasamos tu caso a revisión/.test(r)) throw new Error('rest must survive')
    },
  },

  // ── stripLocationParroting ───────────────────────────────────────────────
  {
    name: 'stripLocationParroting: ES "estás en Goya" stripped when location known',
    run: () => {
      const r = stripLocationParroting('Perfecto. Estás en Goya. ¿Qué número?', 'Goya')
      if (/est[áa]s en Goya/i.test(r)) throw new Error(`parroting not stripped: ${r}`)
      if (!/qué número|que numero/i.test(r)) throw new Error('rest must survive')
    },
  },
  {
    name: 'stripLocationParroting: ES "te encuentras en Pineda" stripped',
    run: () => {
      const r = stripLocationParroting('Te encuentras en Pineda. Cuéntame el problema.', 'Pineda')
      if (/te encuentras/i.test(r)) throw new Error(`not stripped: ${r}`)
    },
  },
  {
    name: 'stripLocationParroting: only runs when location is known',
    run: () => {
      // Without a known location, we cannot safely strip — the LLM might
      // legitimately repeat the customer's words.
      const original = 'Estás en Goya. ¿Qué número?'
      const r = stripLocationParroting(original, null)
      if (r !== original) throw new Error(`should be a no-op when location is null`)
    },
  },
  {
    name: 'stripLocationParroting: clean reply unchanged',
    run: () => {
      const original = 'Cuéntame, ¿qué número de máquina es?'
      const r = stripLocationParroting(original, 'Goya')
      if (r !== original) throw new Error(`clean reply mutated: "${r}"`)
    },
  },

  // ── stripStandalonePaymentQuestion ───────────────────────────────────────
  {
    name: 'stripStandalonePaymentQuestion: ES "¿Has pagado?" removed',
    run: () => {
      const r = stripStandalonePaymentQuestion('Perfecto. ¿Has pagado? Cuéntame el display.')
      if (/¿\s*has pagado\?/i.test(r)) throw new Error(`payment Q not stripped: ${r}`)
      if (!/display/i.test(r)) throw new Error('rest must survive')
    },
  },
  {
    name: 'stripStandalonePaymentQuestion: ES "¿Has podido realizar el pago?" removed',
    run: () => {
      const r = stripStandalonePaymentQuestion('Gracias. ¿Has podido realizar el pago? ¿Y la pantalla?')
      if (/has podido (pagar|realizar el pago)/i.test(r)) {
        throw new Error(`compound payment Q not stripped: ${r}`)
      }
    },
  },
  {
    name: 'stripStandalonePaymentQuestion: IT "hai pagato?" removed',
    run: () => {
      const r = stripStandalonePaymentQuestion('Ok. Hai pagato? Dimmi il display.')
      if (/hai (gi[àa] )?pagato\??/i.test(r)) throw new Error(`not stripped: ${r}`)
    },
  },
  {
    name: 'stripStandalonePaymentQuestion: EN "have you paid?" removed',
    run: () => {
      const r = stripStandalonePaymentQuestion('Got it. Have you paid? What does the screen show?')
      if (/have you (already )?paid\??/i.test(r)) throw new Error(`not stripped: ${r}`)
    },
  },
  {
    name: 'stripStandalonePaymentQuestion: declarative "has pagado y" preserved (not a question)',
    run: () => {
      // Statement, not a question — must not be stripped.
      const original = 'Perfecto, has pagado y ahora vamos al siguiente paso.'
      const r = stripStandalonePaymentQuestion(original)
      if (r !== original) {
        throw new Error(`declarative "has pagado" wrongly stripped: "${r}"`)
      }
    },
  },

  // ── applyOutputInvariants (composite) ────────────────────────────────────
  {
    name: 'applyOutputInvariants: composes all 3 in order',
    run: () => {
      // Include a sentence that survives all 3 strips so we can verify
      // the composite shape without tripping the empty-fallback safeguard.
      const reply =
        'Estás en Goya. No tengo la información sobre el display. ¿Has pagado? ¿Qué aparece en la pantalla?'
      const r = applyOutputInvariants(reply, { location: 'Goya' })
      if (/est[áa]s en Goya/i.test(r)) throw new Error('parroting not stripped')
      if (/no tengo la informaci[oó]n/i.test(r)) throw new Error('evasive not stripped')
      if (/¿\s*has pagado\?/i.test(r)) throw new Error('payment Q not stripped')
      if (!/qu[eé] aparece/i.test(r)) throw new Error('legitimate sentence must survive')
    },
  },
  {
    name: 'applyOutputInvariants: empty-after-strip falls back to original (no empty replies sent)',
    run: () => {
      // Defensive contract: if every invariant fires and nothing remains,
      // we must NOT send an empty message to the customer — the chain
      // returns the closest non-empty intermediate (or the original).
      const reply = '¿Has pagado?'
      const r = applyOutputInvariants(reply, { location: 'Goya' })
      if (r.trim() === '') throw new Error('must never produce empty reply')
    },
  },
  {
    name: 'applyOutputInvariants: clean reply unchanged',
    run: () => {
      const original = 'Perfecto, ¿qué número de máquina es?'
      const r = applyOutputInvariants(original, { location: 'Goya' })
      if (r !== original) throw new Error(`clean reply mutated: "${r}"`)
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
