// 07 — Router cold-start (T1 dispatch sanity)
//
// SCENARIO: the customer's FIRST message can be many things — pure greeting,
// pure FAQ, pure troubleshooting trigger, or a mix. The system must pick
// the right path on T1 without confusing the customer.
//
// These tests pin "cold-start" routing DECISIONS — they assert that the
// bot picks the right INTENT path on a fresh session. They are language-
// agnostic on the input side but assert ES output (current tenant scope,
// CLAUDE.md rule #8 ES-first exemption).
//
// DEDUP RULE (Andrea): a behaviour is tested in ONE place. We do NOT
// re-test here things already covered elsewhere:
//   • Bare "hola" greeting + welcome rendering        → 01-welcome.test
//   • Welcome on greeting+troubleshoot ("hola, ...")  → 01-welcome.test
//   • Pure troubleshoot "la lavadora no funciona"     → covered by every
//                                                       Caso 1-7 spec via
//                                                       its T1 trigger
//   • FAQ "qué horarios" mid-flow / context switch    → 26-context-switch
// What this file UNIQUELY pins:
//   • Pure FAQ as the FIRST message (no prior context).
//   • Mixed greeting+FAQ (does the bot resolve the FAQ or ignore it?).
//   • Mixed greeting+invoice (does the bot enter Caso 9 flow on T1?).
//   • Cross-language input on ES tenant (input recognised, output ES).
//   • Bare "ok" / no-trigger input (does NOT escalate prematurely).
//
// IMPORTANT: these tests document T1 routing only. They do NOT exercise
// the branch router code path (gated by settings.useBranchRouter=false).
// When the branch router is activated, these same tests should keep
// passing — they assert the CONTRACT, not the implementation.

import { type TestCase, expectMentionsNone } from './../_helpers.js'

export const tests: TestCase[] = [
  // ── Pure FAQ as first message (no prior context) ─────────────────────────
  {
    name: 'cold-start — pure FAQ "qué horarios" → answer with hours (no troubleshooting question)',
    run: async (ctx) => {
      const reply = await ctx.send('¿Qué horarios tenéis?')
      const lower = reply.toLowerCase()
      const hasHours = /8[:.\s]*0?0|22[:.\s]*0?0|horario/i.test(lower)
      if (!hasHours) {
        throw new Error(`expected hours info, got: ${reply}`)
      }
      // Must NOT ask "where is the laundry" / "what does the display show" —
      // this is FAQ, not troubleshooting.
      expectMentionsNone(reply, [
        'en qu[eé] lavander[ií]a est[aá]s',
        'qu[eé] aparece en la pantalla',
      ])
    },
  },

  // ── Mixed: greeting + FAQ in one message ─────────────────────────────────
  {
    name: 'cold-start — mixed "hola, ¿a qué hora abrís?" → resolves FAQ in same turn',
    run: async (ctx) => {
      const reply = await ctx.send('hola, ¿a qué hora abrís?')
      const lower = reply.toLowerCase()
      const hasHours = /8[:.\s]*0?0|22[:.\s]*0?0|horario/i.test(lower)
      if (!hasHours) {
        throw new Error(`expected hours info on greeting+FAQ mix, got: ${reply}`)
      }
    },
  },

  // ── Mixed: greeting + invoice trigger (enter Caso 9 flow) ────────────────
  {
    name: 'cold-start — mixed "hola, quiero una factura" → starts invoice flow on T1',
    run: async (ctx) => {
      const reply = await ctx.send('hola, quiero una factura')
      const lower = reply.toLowerCase()
      // Caso 9 invoice flow starts by asking laundry. Greeting is allowed.
      const asksLaundry = /lavander[ií]a/.test(lower)
      if (!asksLaundry) {
        throw new Error(`expected invoice flow start (asks laundry), got: ${reply}`)
      }
    },
  },

  // ── Multilingual input, ES output (tenant lock) ──────────────────────────
  {
    name: 'cold-start — IT input "ciao non funziona" → bot replies in ES (tenant lock)',
    run: async (ctx) => {
      const reply = await ctx.send('ciao, la lavatrice non funziona')
      const lower = reply.toLowerCase()
      // Tenant is ES-only (settings.enabledLanguages=["es"]). Bot must reply
      // in Spanish even if the customer typed Italian.
      const isSpanish = /\b(hola|asistente|lavander[ií]a|d[oó]nde|est[aá]s|por favor)\b/.test(lower)
      const isItalian = /\b(ciao|sono|assistente|lavanderia|dove|sei|aiut[oa])\b/.test(lower)
      if (!isSpanish || isItalian) {
        throw new Error(`tenant ES — reply must be in Spanish, got: ${reply}`)
      }
    },
  },

  // ── Defensive: very short, non-trigger input ─────────────────────────────
  {
    name: 'cold-start — bare "ok" → bot does NOT escalate prematurely',
    run: async (ctx) => {
      const reply = await ctx.send('ok')
      const lower = reply.toLowerCase()
      // Must NOT escalate on a meaningless input.
      const escalates = /vamos\s+a\s+revisar|operador\s+revisar|asistencia\s+manual/i.test(lower)
      if (escalates) {
        throw new Error(`bare "ok" must NOT trigger escalation, got: ${reply}`)
      }
    },
  },
]
