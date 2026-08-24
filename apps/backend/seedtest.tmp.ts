import { prisma } from '@echatbot/database'
const WS = 'cmqcx3fcx0000cgng9dml0qbh'

function res() {
  const r: any = { _status: 0, _body: null }
  r.status = (s: number) => { r._status = s; return r }
  r.json = (b: any) => { r._body = b; return r }
  r.send = () => r
  return r
}
const req = (o: any = {}) => ({ workspaceId: WS, params: {}, body: {}, ...o })

async function main() {
  const { CallingFunctionsController } = require('/Users/gelso/workspace/shopME/apps/backend/src/interfaces/http/controllers/calling-functions.controller')
  const c = new CallingFunctionsController(prisma)

  const check = (label: string, r: any, expected: number) => {
    const ok = r._status === expected
    console.log(`  ${ok ? '✅' : '❌'} ${label}: ${r._status} (expected ${expected})${r._body?.message ? ' — ' + String(r._body.message).slice(0, 70) : ''}`)
  }

  console.log('\n=== GET /functions — moduleBuiltIn flag ===')
  let r = res(); await c.getFunctions(req(), r)
  const fns = r._body?.functions ?? []
  const built = fns.filter((f: any) => f.moduleBuiltIn)
  console.log(`  total rows: ${fns.length}, moduleBuiltIn: ${built.length}`)
  console.log(`  ${built.length === 7 ? '✅' : '❌'} seven built-ins flagged`)
  const withImpact = built.filter((f: any) => f.moduleImpact)
  console.log(`  ${withImpact.length === 7 ? '✅' : '❌'} all carry moduleImpact for the confirm dialog`)

  console.log('\n=== PATCH built-in ===')
  r = res(); await c.updateFunction(req({ params: { functionName: 'save_stay' }, body: { description: 'Live test description' } }), r)
  check('description editable', r, 200)
  r = res(); await c.updateFunction(req({ params: { functionName: 'save_stay' }, body: { isActive: false } }), r)
  check('can be switched off', r, 200)
  r = res(); await c.updateFunction(req({ params: { functionName: 'save_stay' }, body: { isActive: true } }), r)
  check('can be switched back on', r, 200)
  r = res(); await c.updateFunction(req({ params: { functionName: 'save_stay' }, body: { parameters: { type: 'object' } } }), r)
  check('parameters REFUSED', r, 403)
  r = res(); await c.updateFunction(req({ params: { functionName: 'save_stay' }, body: { executionType: 'WEBHOOK' } }), r)
  check('executionType REFUSED', r, 403)

  console.log('\n=== DELETE built-in ===')
  r = res(); await c.deleteFunction(req({ params: { functionName: 'save_stay' } }), r)
  check('delete REFUSED', r, 403)

  console.log('\n=== CREATE with a reserved name ===')
  r = res(); await c.createFunction(req({ body: { functionName: 'save_stay', description: 'x', executionType: 'WEBHOOK' } }), r)
  check('reserved name REFUSED', r, 409)

  console.log('\n=== REINSTALL restores the manifest text ===')
  r = res(); await c.reinstallFunction(req({ params: { functionName: 'save_stay' } }), r)
  check('reinstall ok', r, 200)
  const row = await prisma.workspaceCallingFunction.findFirst({ where: { workspaceId: WS, functionName: 'save_stay' }, select: { description: true } })
  const restored = row?.description?.startsWith('Save what you have learned')
  console.log(`  ${restored ? '✅' : '❌'} description restored from manifest: ${JSON.stringify(row?.description?.slice(0, 55))}`)

  console.log('\n=== the module sees the same rows (getCustomTools path) ===')
  const visible = await prisma.workspaceCallingFunction.findMany({
    where: { workspaceId: WS, isActive: true, executionType: { in: ['WEBHOOK', 'INTERNAL'] } },
    select: { functionName: true },
  })
  console.log('  tools offered to the model:', visible.map(v => v.functionName).sort().join(', '))
}
main().catch(e => console.error('FAIL:', e.message, e.stack?.slice(0, 300))).finally(() => prisma.$disconnect())
