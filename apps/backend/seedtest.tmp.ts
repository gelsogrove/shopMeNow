import { prisma } from '@echatbot/database'
const WS = 'cmqcx3fcx0000cgng9dml0qbh'

async function mn() {
  return prisma.workspaceCallingFunction.findFirst({
    where: { workspaceId: WS, functionName: 'manageNotifications' },
    select: { isActive: true },
  })
}

async function main() {
  const { WorkspaceService } = require('/Users/gelso/workspace/shopME/apps/backend/src/application/services/workspace.service')
  const svc = new WorkspaceService()

  // Clean slate: remove the module rows so save_push_consent is created fresh.
  await prisma.workspaceCallingFunction.deleteMany({
    where: { workspaceId: WS, functionName: { in: ['get_weather','check_accommodation','remember','save_stay','save_itinerary','save_push_consent','save_feedback'] } },
  })
  await prisma.workspaceCallingFunction.upsert({
    where: { workspaceId_functionName: { workspaceId: WS, functionName: 'manageNotifications' } },
    update: { isActive: true },
    create: { workspaceId: WS, functionName: 'manageNotifications', description: 'platform push consent', parameters: {}, isSystemFunction: true, executionType: 'INTERNAL', isActive: true },
  })

  console.log('\n=== D1. manageNotifications active, save_push_consent about to be CREATED ===')
  console.log('before:', JSON.stringify(await mn()))
  await svc.syncModuleToolRows(WS)
  console.log('after :', JSON.stringify(await mn()), '(expected isActive=false)')

  console.log('\n=== D2. admin turns it back ON, then Settings is saved again ===')
  await prisma.workspaceCallingFunction.update({
    where: { workspaceId_functionName: { workspaceId: WS, functionName: 'manageNotifications' } },
    data: { isActive: true },
  })
  await svc.syncModuleToolRows(WS)
  const after = await mn()
  console.log('after re-sync:', JSON.stringify(after))
  console.log(after?.isActive ? '  ✅ admin choice respected (not re-disabled)' : '  ❌ re-disabled behind the admin')
}
main().catch(e => console.error('FAIL:', e.message)).finally(() => prisma.$disconnect())
