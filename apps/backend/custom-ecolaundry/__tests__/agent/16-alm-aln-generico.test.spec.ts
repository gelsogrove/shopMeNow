// 16 — Caso 16 La máquina muestra ALM, ALN o un código de alarma similar
//
// Da usecases.md Caso 16 (alineado al Playbook PDF §5.4 ALM/ALN/ALN A/ALN N):
//   "Sembla que la màquina ha detectat una incidència i ho hem de revisar."
//   Escalar: sí, sempre. Cliente NO debe continuar manipulando la máquina.
//
// Differenza con Caso 13 (paraguas): Caso 16 è specifico per la famiglia
// ALM/ALN, normalmente sobre secadora. Reconocimiento robusto: ALN, ALN A,
// ALN N, ALM/A, ALM/E, ALM/VAr.
//
// Differenza con Caso 14 (ALM DOOR): Caso 14 fa retry con istruzione,
// Caso 16 escala direttamente (no manipulación).
//
// Scenari:
//   16.1 — ALN secadora: gather → escalate → name → summary con ALN+location+tipo+numero
//   16.2 — ALM lavadora: variante stesso flow su lavadora
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 5 test → 2.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 16.1 — ALN secadora completo ───────────────────────────────
  {
    name: 'ES — Scenario 16.1: ALN secadora → gather → escalate → name → summary completo',
    run: async (ctx) => {
      // T1 — trigger ALN → bot saluta e chiede location
      const t1 = await ctx.send('La secadora pone ALN')
      expectMentionsAll(t1, ['lavanderia'])
      // T2 — location → bot procede (può chiedere numero o escalare diretto;
      // entrambe valide perché il summary handover finale conterrà comunque
      // location+tipo+numero+ALN, verificato a T finale).
      const t2 = await ctx.send('Alemanya')
      const t2Lower = t2.toLowerCase()
      const asksNumber = /n[uú]mero/.test(t2Lower)
      const escalating = /te\s+llamas|tu\s+nombre|c[oó]mo\s+te|revis|operador/.test(t2Lower)
      if (!asksNumber && !escalating) {
        throw new Error(`Caso 16 T2: bot deve chiedere numero o escalare: ${t2}`)
      }
      // T3 — numero → bot in escalation flow (revis/operador/llamas)
      const t3 = await ctx.send('La 4')
      const t3Lower = t3.toLowerCase()
      const asksName = /te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(t3Lower)
      const mentionsRevision = /revis|operador|asistencia|manualmente/.test(t3Lower)
      if (!asksName && !mentionsRevision) {
        throw new Error(`Caso 16 T3: bot deve essere in escalation flow: ${t3}`)
      }
      // T finale — name → handover summary completo
      const final = await ctx.send('Andrea')
      // Summary deve menzionare nome + location + ALN + tipo macchina + numero
      expectMentionsAll(final, ['Andrea', 'Alemanya', 'ALN', 'secadora', '4'])
      // Garanzie negative
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(final)) {
        throw new Error(`Frase nonsense presente: ${final}`)
      }
    },
  },

  // ── Scenario 16.2 — ALM lavadora variante ───────────────────────────────
  {
    name: 'ES — Scenario 16.2: ALM lavadora → escalation flow simile (revis)',
    run: async (ctx) => {
      await ctx.send('La lavadora me sale ALM')
      await ctx.send('Goya')
      const reply = await ctx.send('La 5')
      expectMentionsAll(reply, ['revis'])
    },
  },
]
