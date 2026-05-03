import { createAgentSession, agentTurn } from './agent.ts'

const cases = [
  { name: 'CASO 25 — cliente enfadado', msgs: ['¡Esto siempre falla! ¡Quiero una solución ya!', 'Goya', 'Lavadora', 'Andrea'] },
  { name: 'CASO 26 — devolución', msgs: ['Quiero que me devolváis el dinero ahora mismo', 'Quiero la devolución ya', 'Andrea'] },
  { name: 'CASO 27 — compensación', msgs: ['Quiero una secadora gratis por las molestias', 'Pero quiero que me lo confirmes ya', 'Andrea'] },
  { name: 'CASO 28 — contradictorio', msgs: ['Me cobró dos veces, aunque creo que también pagué en efectivo, pero no sé si llegó a arrancar', 'No lo sé bien', 'Andrea'] },
  { name: 'CASO 29 — cámaras', msgs: ['Mirad las cámaras porque yo he pagado', 'Vale', 'Andrea'] },
]

for (const c of cases) {
  console.log('\n' + '═'.repeat(70))
  console.log('  ' + c.name)
  console.log('═'.repeat(70))
  const s = await createAgentSession()
  for (const msg of c.msgs) {
    console.log(`\n[USER] ${msg}`)
    console.log(`[BOT]  ${await agentTurn(s, msg)}`)
  }
}
