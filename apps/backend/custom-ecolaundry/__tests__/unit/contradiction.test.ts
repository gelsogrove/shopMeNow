// Standalone unit test (NO LLM) for utils/contradiction.ts.
// Run: node --import tsx __tests__/unit/contradiction.test.ts

import {
  detectResolutionEscalationContradiction,
  stripResolutionSentences,
} from '../../utils/contradiction.js'

let pass = 0
let fail = 0

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    pass += 1
  } else {
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`)
    fail += 1
  }
}

console.log('contradiction')

// Detection
const c1 = detectResolutionEscalationContradiction(
  'Perfecto, incidencia resuelta. Sin embargo, vamos a revisar tu caso manualmente.',
)
check('ES — detects resolution + escalation in same reply', c1.detected)

const c2 = detectResolutionEscalationContradiction(
  'Perfetto, incidenza risolta. Tuttavia controlleremo il tuo caso manualmente.',
)
check('IT — detects contradiction', c2.detected)

const c3 = detectResolutionEscalationContradiction(
  'All fixed. Just to be safe we will review your case manually.',
)
check('EN — detects contradiction', c3.detected)

const c4 = detectResolutionEscalationContradiction('Perfecto, incidencia resuelta.')
check('ES — pure resolution → NOT a contradiction', !c4.detected)

const c5 = detectResolutionEscalationContradiction('Vamos a revisar tu caso manualmente.')
check('ES — pure escalation → NOT a contradiction', !c5.detected)

const c6 = detectResolutionEscalationContradiction('')
check('empty reply → NOT a contradiction', !c6.detected)

const c7 = detectResolutionEscalationContradiction('Te ayudo. ¿Dónde estás?')
check('neutral reply → NOT a contradiction', !c7.detected)

// Strip behaviour
const stripped = stripResolutionSentences(
  'Perfecto, incidencia resuelta. Sin embargo, el sonido raro puede ser preocupante. Vamos a revisar tu caso manualmente.',
)
check(
  'strip removes the resolution sentence',
  !/incidencia\s+resuelta/i.test(stripped),
  `got: ${stripped}`,
)
check(
  'strip keeps the escalation sentence',
  /revisar\s+tu\s+caso/i.test(stripped),
  `got: ${stripped}`,
)
check(
  'strip keeps the non-resolution context',
  /sonido\s+raro/i.test(stripped),
  `got: ${stripped}`,
)

const noChange = stripResolutionSentences('Vamos a revisar tu caso manualmente.')
check(
  'strip is a no-op when no resolution sentence is present',
  noChange === 'Vamos a revisar tu caso manualmente.',
)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
