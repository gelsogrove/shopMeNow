import { prisma } from '@echatbot/database'
import { formatStayBlock } from '../custom-demosappada/agent.js'
async function main() {
  const ws = await prisma.workspace.findFirst({ where: { slug: 'demosappada' } })
  const c = await prisma.customers.findFirst({ where: { workspaceId: ws!.id, phone: '+390000000070' } })
  console.log(formatStayBlock(c!.stayProfile as any, new Date()))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e.message); process.exit(1) })
