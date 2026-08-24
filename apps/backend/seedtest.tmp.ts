import { prisma } from '@echatbot/database'
const WS = 'cmqcx3fcx0000cgng9dml0qbh'
const SEEDED = ['get_weather','check_accommodation','remember','save_stay','save_itinerary','save_push_consent','save_feedback']

async function main() {
  const del = await prisma.workspaceCallingFunction.deleteMany({ where: { workspaceId: WS, functionName: { in: SEEDED } } })
  const mn = await prisma.workspaceCallingFunction.deleteMany({ where: { workspaceId: WS, functionName: 'manageNotifications' } })
  await prisma.workspace.update({ where: { id: WS }, data: { customChatbotId: 'demorealestate' } })
  const left = await prisma.workspaceCallingFunction.findMany({ where: { workspaceId: WS }, select: { functionName: true } })
  const ws = await prisma.workspace.findUnique({ where: { id: WS }, select: { customChatbotId: true } })
  console.log(`removed ${del.count} module rows + ${mn.count} manageNotifications`)
  console.log('customChatbotId restored to:', ws?.customChatbotId)
  console.log('rows left in workspace:', left.map(l => l.functionName).join(', ') || '(none)')
}
main().catch(e => console.error('FAIL:', e.message)).finally(() => prisma.$disconnect())
