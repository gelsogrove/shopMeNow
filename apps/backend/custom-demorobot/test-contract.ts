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

const session = {
  workspaceId: 'ws_demorobot_test',
  sessionId: 'session_demorobot_test',
}

const history: ChatbotInput['context']['history'] = []

async function main() {
  console.log('═══════ CONTRACT TEST: demoRobot chatbotFn invocations ═══════')

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    const input: ChatbotInput = {
      userMessage: turn.msg,
      userName: 'Test Customer',
      channel: 'widget',
      config: {
        workspaceId: session.workspaceId,
        debugChannel: true,
        isPlayground: true,
        handlers: { retrieveFlow },
      },
      context: {
        sessionId: session.sessionId,
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

    history.push({ role: 'user', content: turn.msg })
    if (output.reply) history.push({ role: 'assistant', content: output.reply })
  }

  console.log('\n══════════ END CONTRACT TEST ══════════')
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
