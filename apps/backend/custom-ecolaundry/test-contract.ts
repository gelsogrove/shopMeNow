// E2E contract test: simulates the host backend (Express) calling
// `chatbotFn` exactly as `CustomClientChatbotService.invoke` would.
//
// Run: npm run demo:contract

import { chatbotFn, type ChatbotInput } from './index.js'

const turns: Array<{ msg: string; note?: string }> = [
  { msg: 'ciao', note: 'T1: greeting → expects reply + language patch' },
  { msg: 'sono Mario Rossi e voglio la fattura', note: 'T2: name + intent → expects name patch + invoice flow start' },
  { msg: 'Acme SRL', note: 'T3: companyName captured' },
  { msg: '8 €', note: 'T4: amount' },
  { msg: 'oggi', note: 'T5: date "today"' },
  { msg: 'mario@acme.it', note: 'T6: email (PII pre-scan should redact)' },
  { msg: 'CIF B12345678', note: 'T7: note with CIF (PII pre-scan should redact)' },
]

const session = {
  workspaceId: 'ws_test',
  sessionId: 'session_+34612345678',
  customerId: 'cust_test_001',
  phoneNumber: '+34612345678',
}

const history: ChatbotInput['context']['history'] = []

async function main() {
  console.log('═══════ CONTRACT TEST: chatbotFn invocations ═══════')

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    const input: ChatbotInput = {
      userMessage: turn.msg,
      userName: 'Mario Rossi',
      channel: 'whatsapp',
      config: {
        workspaceId: session.workspaceId,
        debugChannel: false,
        isPlayground: false,
      },
      context: {
        sessionId: session.sessionId,
        customerId: session.customerId,
        phoneNumber: session.phoneNumber,
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
    if (output.patches && output.patches.length > 0) {
      console.log(`  patches: ${JSON.stringify(output.patches)}`)
    }
    if (output.escalationSummary) {
      console.log(`  escalationSummary: ${output.escalationSummary}`)
    }
    if (output.notificationEmails) {
      console.log(`  notificationEmails: ${output.notificationEmails}`)
    }
    console.log(`  meta: tokensUsed=${output.meta.tokensUsed} agentChain=${JSON.stringify(output.meta.agentChain)}`)
    if (output.error) console.log(`  ERROR: ${output.error}`)

    // The host would persist these to its DB:
    //   - patches → UPDATE Customers WHERE id = customerId
    //   - reply → INSERT ConversationMessage (role='assistant')
    //   - userMessage → INSERT ConversationMessage (role='user')
    //   - if shouldEscalate → trigger operator notification
    //   - if closeChat → mark session as closed in ChatSession
    //
    // Then it would replay them next turn via context.history:
    history.push({ role: 'user', content: turn.msg })
    if (output.reply) history.push({ role: 'assistant', content: output.reply })
  }

  console.log('\n══════════ END CONTRACT TEST ══════════')
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
