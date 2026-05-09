// 07 — Caso 7 He pagado pero no he podido usar el servicio
//
// Da usecases.md Caso 7 (alineado al Playbook PDF §5.4, Andrea 2026-05-09):
// gather order = lavandería → tipo → número → PANTALLA. Cambio NO è un
// passo forzato; il display flow gestisce il resto (PUSH/SEL/DOOR/AL001/…).
//
// Scenari:
//   7.1 — Happy: trigger → gather → pantalla "PUSH PROG" → istruzione → resolved
//   7.2 — Escalación: PUSH PROG → istruzione → "no arranca" → re-ask codice
//          → "se ha bloqueado" → escalate → name → "desactivado" + summary
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. Eliminato il pattern "1 test = 1 turno" (9 test → 2).

import { type TestCase, expectMentionsAll, expectEscalation } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 7.1 — Happy Path completo ───────────────────────────────────
  {
    name: 'ES — Scenario 7.1: happy path completo → gather → pantalla PUSH PROG → istruzione → resolved',
    run: async (ctx) => {
      // T1 — trigger
      await ctx.send('He pagado y no he podido usar la máquina')
      // T2 — location → bot chiede tipo macchina
      const t2 = await ctx.send('Pineda')
      if (!/lavadora|secadora/i.test(t2)) {
        throw new Error(`Caso 7 T2: bot deve chiedere tipo macchina: ${t2}`)
      }
      // T3 — tipo → bot chiede numero
      const t3 = await ctx.send('Lavadora')
      if (!/n[uú]mero/i.test(t3)) {
        throw new Error(`Caso 7 T3: bot deve chiedere numero: ${t3}`)
      }
      // T4 — numero → bot chiede pantalla (alineado al PDF §5.4)
      const t4 = await ctx.send('5')
      if (!/pantalla|display|qu[eé]\s+aparece|c[oó]digo/i.test(t4)) {
        throw new Error(`Caso 7 T4: bot deve chiedere pantalla dopo numero (PDF §5.4): ${t4}`)
      }
      // Bot non deve forzare la domanda cambio prima di pantalla.
      if (/cambio/i.test(t4)) {
        throw new Error(`Caso 7 T4: bot NON deve forzare la domanda cambio prima di pantalla: ${t4}`)
      }
      // T5 — pantalla "PUSH PROG" → istruzione (4 programmi + loopback)
      const t5 = await ctx.send('PUSH PROG')
      const t5Lower = t5.toLowerCase()
      if (!/puls/.test(t5Lower) || !/program/.test(t5Lower)) {
        throw new Error(`Scenario 7.1 T5: bot deve dare istruzione "pulsa programa" dopo PUSH PROG: ${t5}`)
      }
      // T6 — cliente conferma → resolved
      const final = await ctx.send('Ahora sí')
      const finalLower = final.toLowerCase()
      if (!/perfecto|perfect/.test(finalLower)) {
        throw new Error(`Scenario 7.1: bot deve chiudere con "perfecto": ${final}`)
      }
    },
  },

  // ── Scenario 7.2 — Escalation completo ──────────────────────────────────
  {
    name: 'ES — Scenario 7.2: "no arranca" → re-ask codice → escalate → name → desactivado + summary',
    run: async (ctx) => {
      await ctx.send('He pagado y no he podido usar la máquina')
      await ctx.send('Pineda')
      await ctx.send('Lavadora')
      await ctx.send('5')
      // PUSH PROG → istruzione
      const t5 = await ctx.send('PUSH PROG')
      if (!/puls.*program|program.*puls/i.test(t5)) {
        throw new Error(`Scenario 7.2: bot deve dare istruzione dopo PUSH PROG: ${t5}`)
      }
      // Cliente: macchina non parte
      let reply = await ctx.send('no arranca')
      const reaskLower = reply.toLowerCase()
      // Phase B: bot deve chiedere codice esatto OPPURE escalare diretto
      const asksCode = /c[oó]digo|pantalla|aparece/.test(reaskLower)
      const escalatesDirect = /operador|revisi[oó]n|asistencia/.test(reaskLower)
      if (!asksCode && !escalatesDirect) {
        throw new Error(`Scenario 7.2: bot non chiede codice né escala dopo "no arranca": ${reply}`)
      }
      // Se Phase B re-ask: cliente descrive il blocco → escalate
      if (asksCode) {
        reply = await ctx.send('se ha bloqueado')
      }
      // Bot deve aver chiesto il nome (escalation in corso)
      if (!/te\s+llamas|tu\s+nombre|c[oó]mo\s+te/.test(reply.toLowerCase())) {
        reply = await ctx.send('se ha bloqueado')
      }
      expectEscalation(reply)
      // T finale — name → handover summary + desactivado
      const final = await ctx.send('Luis')
      const finalLower = final.toLowerCase()
      if (!/desactivado/.test(finalLower)) {
        throw new Error(`Scenario 7.2 final: NON contiene "desactivado": ${final}`)
      }
      if (!/operador/.test(finalLower)) {
        throw new Error(`Scenario 7.2 final: NON menziona "operador": ${final}`)
      }
      // Summary handover deve contenere nome + location + numero + display
      expectMentionsAll(final, ['Luis', 'Pineda', '5'])
      if (!/PUSH|push/i.test(final)) {
        throw new Error(`Scenario 7.2: summary non menziona display PUSH: ${final}`)
      }
      // Garanzie negative
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" in summary: ${final}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(final)) {
        throw new Error(`Frase nonsense presente: ${final}`)
      }
    },
  },
]
