// E2E contract test: simulates the host backend calling `chatbotFn` exactly
// as `CustomClientChatbotService.invoke` would, including a fake
// `retrieveFlow` handler (in production this is wired to the retrieval
// orchestrator in apps/backend/src/application/demorobot).
//
// Run: npm run demo:contract

import { chatbotFn, type ChatbotInput, type RetrievalHandler } from './index.js'

// Fake retrieval: always attaches a small hardcoded flow, simulating what
// findRelevantFlows + compileFlow would produce for a "wifi not connecting"
// diagnostic (analisi.md §6-style).
const fakeCompiledPrompt = `## FLOW: Wifi non si connette

### Q: Il robot è acceso?
- If "Sì" → continue to: "Il led wifi lampeggia?"

### Q: Il led wifi lampeggia?
(collect as: wifiLedBlinking, type: boolean)
- If "Sì" → continue to: "Prova a riavviare il router. Ha funzionato?"
- If "No" → call escalate_to_operator immediately.

### Q: Prova a riavviare il router. Ha funzionato?
(terminal: SELF_SERVICE, allowed tools: remember)
`

const retrieveFlow: RetrievalHandler = async () => {
  return {
    selectedFlowId: 'flow_test_wifi',
    compiledPrompt: fakeCompiledPrompt,
    hash: 'test-hash',
  }
}

const turns: Array<{ msg: string; note?: string }> = [
  { msg: 'hello', note: 'T1: greeting → expects welcome + language patch' },
  { msg: 'my robot wifi light keeps blinking and it wont connect', note: 'T2: problem description → expects flow attach' },
  { msg: 'yes it is on', note: 'T3: answers "robot acceso?"' },
  { msg: 'no it does not blink', note: 'T4: answers "led lampeggia?" → should trigger immediate escalation' },
]

// Andrea 2026-08-07: reproduces a production bug — the bot said "Ho
// registrato il numero di serie" and only afterwards said the serial was
// invalid. remember() correctly rejects a malformed serial without saving it
// (agent.ts serialNumber check), but common.md:14-15 ("NEVER confirm a serial
// is registered unless SESSION STATE says so") was violated: the model
// composed the confirmation sentence in the same turn as the tool call,
// before reacting to its ok:false result. This scenario's bot reply for T2
// must NOT contain a confirmation phrase — it must go straight to the
// invalid-format correction.
const invalidSerialTurns: Array<{ msg: string; note?: string }> = [
  { msg: 'ciao, il mio robot non si accende', note: 'T1: greeting + problem → expects serial number ask' },
  { msg: 'HKA4OB100LQ2605019', note: 'T2: 18-char serial (missing one digit) → must be rejected, NOT confirmed as registered' },
]

// Phrases that would mean the model confirmed the serial before validating
// it — production said "Ho registrato il numero di serie" then, one line
// later, said it was invalid. None of these may appear in a bot reply that
// also rejects the serial as malformed.
const CONFIRMATION_PHRASES = [
  'ho registrato',
  'registrato il numero',
  'i have registered',
  'i\'ve registered',
  'i\'ve saved',
  'i have saved',
]

async function runScenario(
  label: string,
  turns: Array<{ msg: string; note?: string }>,
  sessionId: string,
): Promise<void> {
  console.log(`\n═══════ SCENARIO: ${label} ═══════`)

  const history: ChatbotInput['context']['history'] = []

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    const input: ChatbotInput = {
      userMessage: turn.msg,
      userName: 'Test Customer',
      channel: 'widget',
      config: {
        workspaceId: 'ws_demorobot_test',
        debugChannel: true,
        isPlayground: true,
        handlers: { retrieveFlow },
      },
      context: {
        sessionId,
        history: [...history],
      },
    }

    console.log(`\n──── T${i + 1} ────`)
    if (turn.note) console.log(`# ${turn.note}`)
    console.log(`USER: ${turn.msg}`)

    const output = await chatbotFn(input)

    console.log(`BOT: ${output.reply}`)
    console.log(`  shouldEscalate: ${output.shouldEscalate}`)
    console.log(`  closeChat: ${output.closeChat}`)
    if (output.patches && output.patches.length > 0) console.log(`  patches: ${JSON.stringify(output.patches)}`)
    if (output.escalationSummary) console.log(`  escalationSummary: ${output.escalationSummary}`)
    if (output.meta.debug) console.log(`  debug: ${JSON.stringify(output.meta.debug)}`)
    console.log(`  meta: tokensUsed=${output.meta.tokensUsed} agentChain=${JSON.stringify(output.meta.agentChain)}`)
    if (output.error) console.log(`  ERROR: ${output.error}`)

    const replyLower = (output.reply ?? '').toLowerCase()
    const mentionsConfirmation = CONFIRMATION_PHRASES.some((p) => replyLower.includes(p))
    if (mentionsConfirmation) {
      console.log(`  ⚠️  BUG REPRODUCED: bot confirmed the serial in the same reply — check common.md:14-15`)
    }

    history.push({ role: 'user', content: turn.msg })
    if (output.reply) history.push({ role: 'assistant', content: output.reply })
  }
}

async function main() {
  await runScenario('happy path (wifi flow)', turns, 'session_demorobot_test')
  await runScenario('invalid serial — must reject, not confirm', invalidSerialTurns, 'session_demorobot_invalid_serial')

  console.log('\n══════════ END CONTRACT TEST ══════════')
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
