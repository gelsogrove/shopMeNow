import { buildChatbotSettingsJson } from '../src/application/services/chatbot-settings-json.service'
import { prisma } from '@echatbot/database'
import { chatbotFn } from '../custom-demosappada/agent.js'

async function main() {
  const ws = await prisma.workspace.findFirst({ where: { slug: 'demosappada' } })
  if (!ws) throw new Error('workspace not found')
  const settings = await buildChatbotSettingsJson(ws as any)
  const faqs = await prisma.fAQ.findMany({
    where: { workspaceId: ws.id, isActive: true },
    orderBy: { order: 'asc' },
    select: { question: true, answer: true, keywords: true },
  })
  const msg = process.argv[2] || 'Ciao'
  const out = await chatbotFn({
    userMessage: msg, userName: '', channel: 'playground',
    config: {
      workspaceId: ws.id, debugChannel: false, isPlayground: true,
      settings: settings as any,
      handlers: {
        getFaqs: async () => faqs as any,
        getCatalogue: async () => {
          const rows = await prisma.products.findMany({
            where: { workspaceId: ws.id, isActive: true }, orderBy: { name: 'asc' },
            select: { name: true, description: true, price: true, link: true, type: true },
          })
          return rows.map((r) => ({
            name: r.name, description: r.description ?? undefined,
            price: r.price != null ? Number(r.price) : undefined,
            link: r.link ?? undefined, type: r.type ?? undefined,
          })) as any
        },
      },
    },
    context: { sessionId: `ask-${Date.now()}`, history: [] },
  })
  console.log(`\n👤 ${msg}\n`)
  console.log(`🤖 ${out.reply ?? '(nessuna risposta)'}\n`)
  console.log(`[lang=${out.language} tokens=${out.meta.tokensUsed}${out.error ? ' error=' + out.error : ''}]`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
