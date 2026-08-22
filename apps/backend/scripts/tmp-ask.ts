import { buildChatbotSettingsJson } from '../src/application/services/chatbot-settings-json.service'
import { prisma } from '@echatbot/database'
import { chatbotFn } from '../custom-demosappada/agent.js'
async function main() {
  const ws = await prisma.workspace.findFirst({ where: { slug: 'demosappada' } })
  const settings = await buildChatbotSettingsJson(ws as any)
  const faqs = await prisma.fAQ.findMany({ where: { workspaceId: ws!.id, isActive: true },
    orderBy: { order: 'asc' }, select: { question: true, answer: true, keywords: true } })
  const c = await prisma.customers.findFirst({ where: { workspaceId: ws!.id, phone: '+390000000010' } })
  for (const [msg, expect] of [['hola que hago hoy a Sappada?','es'], ['Guten Tag, was kann man heute machen?','de']] as const) {
    const out = await chatbotFn({
      userMessage: msg, userName: '', channel: 'widget',
      config: { workspaceId: ws!.id, debugChannel: false, isPlayground: false, settings: settings as any,
        handlers: { getFaqs: async () => faqs as any, getStayProfile: async () => null,
          saveStayProfile: async () => true, savePushConsent: async () => true,
          saveFeedback: async () => true, setCustomerTags: async () => [] } },
      context: { sessionId: `L-${Date.now()}-${expect}`, customerId: c!.id, phoneNumber: c!.phone!, history: [] },
    })
    const body = (out.reply ?? '').split('d0n2ElZp7aM')[1] ?? out.reply ?? ''
    console.log(`\n👤 ${msg}\n🤖 ${body.trim().slice(0, 260)}`)
    const italiano = /\b(siete|quanto|giorno|oggi|sereno|dimmi)\b/i.test(body)
    console.log(`   atteso=${expect} dichiarato=${out.language} → ${italiano ? '❌ italiano' : '✅ lingua giusta'}`)
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
