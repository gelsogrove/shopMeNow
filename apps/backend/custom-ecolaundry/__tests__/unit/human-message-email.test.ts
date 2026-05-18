// Standalone unit test (NO LLM) for utils/human-message-email.ts
// Run: node --import tsx __tests__/unit/human-message-email.test.ts

import {
  parseRecipients,
  buildEmailHtml,
  sendHumanMessageEmail,
  type HumanMessageEmailData,
} from '../../utils/human-message-email.js'

let pass = 0
let fail = 0

function check(label: string, cond: boolean): void {
  if (cond) {
    console.log(`  ✓ ${label}`)
    pass++
  } else {
    console.log(`  ✗ ${label}`)
    fail++
  }
}

async function checkAsync(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    console.log(`  ✓ ${label}`)
    pass++
  } catch (err) {
    console.log(`  ✗ ${label}: ${err}`)
    fail++
  }
}

// ── parseRecipients ───────────────────────────────────────────────────────────

console.log('\nparseRecipients')

check('undefined → empty array', parseRecipients(undefined).length === 0)
check('empty string → empty array', parseRecipients('').length === 0)
check('whitespace only → empty array', parseRecipients('   ').length === 0)
check('single email', parseRecipients('gelsogrove@gmail.com').join('') === 'gelsogrove@gmail.com')
check('multiple emails comma-separated', JSON.stringify(parseRecipients('a@x.com, b@y.com, c@z.com')) === JSON.stringify(['a@x.com', 'b@y.com', 'c@z.com']))
check('trims whitespace', parseRecipients('  a@x.com  ,  b@y.com  ')[0] === 'a@x.com')
check('filters entries without @', parseRecipients('valid@x.com, notanemail, other@y.com').length === 2)

// ── buildEmailHtml ────────────────────────────────────────────────────────────

console.log('\nbuildEmailHtml')

const sampleData: HumanMessageEmailData = {
  summary: 'Cliente Mario a Goya, lavadora 5, display AL001. Vuole parlare con operatore.',
  history: [
    { role: 'user', content: 'Hola, la lavadora no funciona' },
    { role: 'assistant', content: '¿En qué lavandería estás?' },
    { role: 'user', content: 'En Goya' },
    { role: 'assistant', content: 'Perfecto. ¿Qué número tiene la máquina?' },
    { role: 'user', content: 'La 5' },
  ],
  customerName: 'Mario Rossi',
  companyName: 'Ecolaundry',
  timestamp: 'El lunes 18 de mayo a las 10:30',
}

const html = buildEmailHtml(sampleData)

check('contains company name', html.includes('Ecolaundry'))
check('contains customer name in alert banner', html.includes('Mario Rossi'))
check('contains summary text', html.includes('Cliente Mario a Goya'))
check('contains timestamp', html.includes('El lunes 18 de mayo a las 10:30'))
check('contains user message in history', html.includes('la lavadora no funciona'))
check('contains assistant message in history', html.includes('¿En qué lavandería estás?'))
check('has valid HTML structure', html.includes('<!DOCTYPE html>') && html.includes('</html>'))
check('has body tag', html.includes('<body') && html.includes('</body>'))
check('has left-align for user bubbles', html.includes('text-align:left'))
check('has right-align for assistant bubbles', html.includes('text-align:right'))

// XSS escaping
const xssData: HumanMessageEmailData = {
  ...sampleData,
  customerName: '<script>alert("xss")</script>',
  summary: 'Test & <b>bold</b>',
}
const xssHtml = buildEmailHtml(xssData)
check('escapes <script> tag', !xssHtml.includes('<script>') && xssHtml.includes('&lt;script&gt;'))
check('escapes & and <b>', xssHtml.includes('&amp;') && xssHtml.includes('&lt;b&gt;'))

// Empty history
const emptyHtml = buildEmailHtml({ ...sampleData, history: [] })
check('shows fallback when history is empty', emptyHtml.includes('No hay historial disponible'))

// ── sendHumanMessageEmail — skip logic ────────────────────────────────────────

console.log('\nsendHumanMessageEmail — skip logic')

await checkAsync('silently skips when notificationEmails is undefined', async () => {
  // RULE: no recipients → no send, no error
  await sendHumanMessageEmail(sampleData, undefined)
})

await checkAsync('silently skips when notificationEmails is empty string', async () => {
  await sendHumanMessageEmail(sampleData, '')
})

await checkAsync('silently skips when SMTP env vars are missing', async () => {
  // RULE: recipients configured but SMTP not set → warn + skip, no throw
  const savedUser = process.env.SMTP_USER
  const savedPass = process.env.SMTP_PASS
  delete process.env.SMTP_USER
  delete process.env.SMTP_PASS
  try {
    await sendHumanMessageEmail(sampleData, 'gelsogrove@gmail.com')
  } finally {
    if (savedUser) process.env.SMTP_USER = savedUser
    if (savedPass) process.env.SMTP_PASS = savedPass
  }
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nhuman-message-email: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
