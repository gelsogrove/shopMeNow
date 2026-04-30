import { chatbotFn } from '../index.js'

async function run(): Promise<void> {
  const result = await chatbotFn({
    userMessage: 'La lavadora muestra AL001 después del pago',
    userName: 'Andrea',
    channel: 'whatsapp',
    config: {
      workspaceId: 'workspace-demo',
      welcomeMessage: '¡Hola! Soy el asistente virtual de la lavandería.',
      wipMessage: 'Estamos revisando tu caso...',
      channelActive: true,
      debugChannel: true,
      isPlayground: false,
      language: 'es',
    },
    context: {
      sessionId: 'session-escalation-01',
      history: [],
      phoneNumber: '+34600000000',
    },
  })

  console.log('=== ESCALATION OUTPUT ===')
  console.log(JSON.stringify(result, null, 2))
}

run().catch((error) => {
  console.error('Example failed:', error)
  process.exit(1)
})
