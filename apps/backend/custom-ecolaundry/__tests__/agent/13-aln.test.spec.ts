// 13 — Caso 13 Escalado por código de alarma o incoherencia
//
// Da usecases.md Caso 13 (caso "paraguas" per alarmi/incoerenze generiche;
// Più specifici: Caso 14 ALM DOOR, Caso 15 001, Caso 16 ALM/ALN secadora,
// Caso 18 numerico, Caso 30 no documentado):
//
// Gather completo prima di escalare: location → tipo → numero → display.
// Reply di escalación con "revisión manual" + petición del nombre.
// Il bot NUNCA confronta al cliente: tono "lo revisamos para ayudarte".
//
// Allineato al PDF Playbook §6 (regle de possible frau o incoherència):
// "Necessitem revisar aquest cas manualment" + no confrontar.
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 5 test → 1 (eliminato il pattern "1 test = 1 turno").

import { type TestCase, expectMentionsAll, expectStateHas } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso 13 ALN: happy path completo → gather → escalate "revisar" + nome → state popolato',
    run: async (ctx) => {
      // T1 — trigger ALN → bot saluta e chiede location (NON escala subito)
      const t1 = await ctx.send('He pagado y ahora sale ALN')
      // Welcome + ask location ("En qué lavandería estás" — il bot non
      // necessariamente usa la parola "dónde", basta che chieda la location).
      expectMentionsAll(t1, ['hola', 'lavander'])
      // T2 — location → bot chiede tipo macchina
      const t2 = await ctx.send('Goya')
      expectMentionsAll(t2, ['lavadora', 'secadora'])
      // T3 — tipo → bot chiede numero
      const t3 = await ctx.send('lavadora')
      expectMentionsAll(t3, ['numero'])
      // T4 — numero → bot escala con "revisar" + chiede nome
      const t4 = await ctx.send('5')
      expectMentionsAll(t4, ['revis', 'llamas'])
      // T5 — nome → handover. State popolato con tutti i dati raccolti.
      await ctx.send('Andrea')
      expectStateHas(ctx.session, {
        location: 'Goya',
        machineType: 'washer',
        machineNumber: '5',
        displayState: 'ALN',
        customerName: 'Andrea',
      })
    },
  },
]
