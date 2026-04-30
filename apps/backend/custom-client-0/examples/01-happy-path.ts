import { chatbotFn } from '../index.js'

async function run(): Promise<void> {
  const result = await chatbotFn({
    userMessage: 'Lavadora 3, he pagado pero no arranca',
    userName: 'Andrea',
    channel: 'playground',
    config: {
      workspaceId: 'workspace-demo',
      welcomeMessage: '¡Hola! Soy el asistente virtual de la lavandería.',
      wipMessage: 'Estamos revisando tu caso...',
      channelActive: true,
      debugChannel: true,
      isPlayground: true,
      language: 'es',
    },
    context: {
      sessionId: 'session-happy-01',
      history: [],
    },
  })

  console.log('=== HAPPY PATH OUTPUT ===')
  console.log(JSON.stringify(result, null, 2))
}

run().catch((error) => {
  console.error('Example failed:', error)
  process.exit(1)
})
