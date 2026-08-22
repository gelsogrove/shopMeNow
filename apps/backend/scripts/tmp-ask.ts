import { buildChatbotSettingsJson } from '../src/application/services/chatbot-settings-json.service'
import { prisma } from '@echatbot/database'
import { chatbotFn } from '../custom-demosappada/agent.js'
async function main() {
  const ws = await prisma.workspace.findFirst({ where: { slug: 'demosappada' } })
  const settings = await buildChatbotSettingsJson(ws as any)
  const faqs = await prisma.fAQ.findMany({ where: { workspaceId: ws!.id, isActive: true },
    orderBy: { order: 'asc' }, select: { question: true, answer: true, keywords: true } })
  const c = await prisma.customers.findFirst({ where: { workspaceId: ws!.id, phone: '+390000000021' } })
  const handlers = {
    getFaqs: async () => faqs as any,
    getStayProfile: async () => null,
    saveStayProfile: async () => true, savePushConsent: async () => true,
    saveFeedback: async () => true, setCustomerTags: async () => [],
  }
  for (const msg of ['quanto costa il biglietto della funivia del Monte Ferro?', 'qual è il numero della farmacia?']) {
    const out = await chatbotFn({
      userMessage: msg, userName: '', channel: 'widget',
      config: { workspaceId: ws!.id, debugChannel: false, isPlayground: false, settings: settings as any, handlers: handlers as any },
      context: { sessionId: `g-${Date.now()}-${msg.length}`, customerId: c!.id, phoneNumber: c!.phone!, history: [] },
    })
    const body = (out.reply ?? '').split('d0n2ElZp7aM')[1] ?? out.reply ?? ''
    console.log(`\n${'─'.repeat(58)}\n👤 ${msg}\n🤖 ${body.trim()}`)
    const soloDomanda = body.trim().endsWith('?') && body.trim().length < 180 && !/\d/.test(body)
    console.log(`   → risponde alla domanda: ${soloDomanda ? '❌ la ignora' : '✅'}`)
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
