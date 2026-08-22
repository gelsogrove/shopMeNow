import { buildChatbotSettingsJson } from '../src/application/services/chatbot-settings-json.service'
import { prisma } from '@echatbot/database'
import { chatbotFn } from '../custom-demosappada/agent.js'
async function main() {
  const ws = await prisma.workspace.findFirst({ where: { slug: 'demosappada' } })
  const settings = await buildChatbotSettingsJson(ws as any)
  const faqs = await prisma.fAQ.findMany({ where: { workspaceId: ws!.id, isActive: true },
    orderBy: { order: 'asc' }, select: { question: true, answer: true, keywords: true } })
  const c = await prisma.customers.findFirst({ where: { workspaceId: ws!.id, phone: '+390000000010' } })
  const out = await chatbotFn({
    userMessage: 'hola que hago hoy a Sappada?', userName: '', channel: 'widget',
    config: { workspaceId: ws!.id, debugChannel: false, isPlayground: false, settings: settings as any,
      handlers: { getFaqs: async () => faqs as any, getStayProfile: async () => null,
        saveStayProfile: async () => true, savePushConsent: async () => true,
        saveFeedback: async () => true, setCustomerTags: async () => [] } },
    context: { sessionId: `es-${Date.now()}`, customerId: c!.id, phoneNumber: c!.phone!, history: [] },
  })
  const r = out.reply ?? ''
  const body = r.split('d0n2ElZp7aM')[1] ?? r
  console.log(`\n🤖 ${body.trim().slice(0, 350)}\n`)
  console.log('LINGUA DICHIARATA:', out.language)
  console.log('RISPONDE IN ES   :', /cu[aá]nt|est[aá]is|hoy|d[ií]a|tiempo|sois/i.test(body) ? '✅' : '❌ italiano')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
