// 14 — Caso 14 La lavadora muestra ALM DOOR
//
// Da usecases.md Caso 14 (alineado al Playbook PDF §5.4 ALM DOOR):
//   Differenza chiave con Caso 2 (DOOR simple): retry esplicito con
//   istruzione "abrir + revisar prendas atrapadas + cerrar bien" + loopback
//   "¿el mensaje ha desaparecido?". Solo se NO desaparece → escalate.
//   Reconocimiento robusto: ALM DOOR / ALM/DOOR / ALMDOOR.
//
// Scenari:
//   14.1 — Happy: ALM DOOR → istruzione → "Sí ha desaparecido" → resolved
//   14.2 — Escalation: ALM DOOR → istruzione → "No desaparece" → escalate
//          → name → desactivado + summary che menziona ALM DOOR
//
// CONSOLIDATED LAYOUT (Andrea, 2026-05-09): un test per percorso, asserzioni
// step-by-step inline. 5 test → 2.

import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  // ── Scenario 14.1 — Happy Path completo ─────────────────────────────────
  {
    name: 'ES — Scenario 14.1: happy path completo → ALM DOOR istruzione → "Sí ha desaparecido" → resolved',
    run: async (ctx) => {
      // T1 — trigger ALM DOOR → bot saluta e chiede location
      const t1 = await ctx.send('La lavadora no funciona y pone ALM DOOR')
      expectMentionsAll(t1, ['lavanderia'])
      // T2 — location → bot chiede numero (machineType inferito da "lavadora")
      const t2 = await ctx.send('Goya')
      if (!/n[uú]mero/i.test(t2)) {
        throw new Error(`Caso 14 T2: bot deve chiedere numero: ${t2}`)
      }
      // T3 — numero → bot dà istruzione (puerta + prendas atrapadas + cerrar)
      const t3 = await ctx.send('La 6')
      expectMentionsAll(t3, ['puerta', 'prend', 'cierr'])
      // T4 — cliente conferma di aver fatto il check (risposta ambigua,
      // bot può fare re-ask generico o loopback specifico — entrambi OK)
      await ctx.send('Ya lo he hecho')
      // T5 — cliente conferma esplicito → resolved (closure positiva:
      // accetta wording "perfect" o "genial" + marker resuelt)
      const final = await ctx.send('Sí, ha desaparecido')
      const finalLower = final.toLowerCase()
      if (!/perfect|genial/.test(finalLower)) {
        throw new Error(`Caso 14 closure: bot deve dire "perfecto"/"genial": ${final}`)
      }
      if (!/resuelt|comenzad|correctament/.test(finalLower)) {
        throw new Error(`Caso 14 closure: bot deve confermare resoluzione: ${final}`)
      }
    },
  },

  // ── Scenario 14.2 — Escalation completo ─────────────────────────────────
  {
    name: 'ES — Scenario 14.2: "No desaparece" → escalate → name → desactivado + summary ALM DOOR',
    run: async (ctx) => {
      await ctx.send('La lavadora no funciona y pone ALM DOOR')
      await ctx.send('Goya')
      await ctx.send('La 6')
      await ctx.send('Ya lo he hecho')
      // Cliente: messaggio NON desaparece → bot escala con "revisar" + nome
      const escalate = await ctx.send('No, no desaparece')
      expectMentionsAll(escalate, ['revis', 'llamas'])
      // T finale — name → handover summary
      const final = await ctx.send('Andrea')
      // Summary deve menzionare nome + location + numero + display ALM DOOR
      expectMentionsAll(final, ['Andrea', 'Goya', '6'])
      const finalLower = final.toLowerCase()
      if (!/alm.*door|door.*alm|puerta/.test(finalLower)) {
        throw new Error(`Caso 14 summary non menziona ALM DOOR né puerta: ${final}`)
      }
      // Garanzie negative: niente template buggati
      if (/n[uú]mero\s+n[uú]mero/i.test(final)) {
        throw new Error(`Bug "número número" presente: ${final}`)
      }
      if (/seleccion[oó]\s+el\s+programa\s+pero\s+problema\s+t[eé]cnico/i.test(final)) {
        throw new Error(`Frase nonsense presente: ${final}`)
      }
    },
  },
]
