import { prisma } from '@echatbot/database'

const WS = 'cmqcx3fcx0000cgng9dml0qbh'

async function rows() {
  return prisma.workspaceCallingFunction.findMany({
    where: { workspaceId: WS },
    select: { functionName: true, isActive: true, executionType: true, isSystemFunction: true, description: true },
    orderBy: { functionName: 'asc' },
  })
}

async function main() {
  const { WorkspaceService } = require('/Users/gelso/workspace/shopME/apps/backend/src/application/services/workspace.service')
  const svc = new WorkspaceService()

  console.log('\n=== A. module WITHOUT manifest (demorealestate) ===')
  await svc.syncModuleToolRows(WS)
  console.log('rows after sync:', (await rows()).length, '(expected 0)')

  console.log('\n=== B. switch workspace to demosappada, then sync ===')
  await prisma.workspace.update({ where: { id: WS }, data: { customChatbotId: 'demosappada' } })
  await svc.syncModuleToolRows(WS)
  const seeded = await rows()
  console.log('rows:', seeded.length)
  for (const r of seeded) console.log(`  ${r.functionName.padEnd(20)} active=${r.isActive} type=${r.executionType} system=${r.isSystemFunction}`)

  console.log('\n=== C. admin edits a description, then Settings is saved again ===')
  await prisma.workspaceCallingFunction.update({
    where: { workspaceId_functionName: { workspaceId: WS, functionName: 'save_stay' } },
    data: { description: 'EDITED BY ADMIN' },
  })
  await svc.syncModuleToolRows(WS)
  const after = (await rows()).find(r => r.functionName === 'save_stay')
  console.log('save_stay description after re-sync:', JSON.stringify(after?.description))
  console.log(after?.description === 'EDITED BY ADMIN' ? '  ✅ admin edit survived' : '  ❌ OVERWRITTEN')

  console.log('\n=== D. supersedes: manageNotifications ===')
  const mn = await prisma.workspaceCallingFunction.findFirst({
    where: { workspaceId: WS, functionName: 'manageNotifications' },
    select: { isActive: true },
  })
  console.log('manageNotifications row:', mn ? `isActive=${mn.isActive}` : 'not present in this workspace')
}
main().catch(e => { console.error('FAIL:', e.message) }).finally(() => prisma.$disconnect())
