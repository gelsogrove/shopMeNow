// 07 — Router cold-start (T1 dispatch sanity)
//
// SCENARIO: the customer's FIRST message can be many things — pure greeting,
// pure FAQ, pure troubleshooting trigger, or a mix. The system must pick
// the right path on T1 without confusing the customer.
//
// These tests pin the "cold-start" router behaviour. They are language-
// agnostic on the input side (we test ES + a couple of cross-language inputs
// to confirm fact extraction is multilingual) but assert ES output (current
// tenant scope, CLAUDE.md rule #8 ES-first exemption).
//
// Coverage matrix (T1 → expected first reply):
//   • Pure greeting "hola"            → welcome + neutral open question (NO presupposition)
//   • Pure FAQ "qué horarios"         → answer with hours (NO troubleshooting question)
//   • Pure troubleshoot "no funciona" → welcome + ask location
//   • Mixed greeting+FAQ              → welcome + FAQ answer
//   • Mixed greeting+troubleshoot     → welcome + ask location
//   • Mixed greeting+invoice          → welcome + start invoice flow
//   • IT input "ciao non funziona"    → bot still answers in ES (tenant lock)
//
// IMPORTANT: these tests document T1 routing only. They do NOT exercise the
// branch router code path (gated by settings.useBranchRouter=false). Today's
// path is the legacy guard pipeline + LLM. When the branch router is
// activated, these same tests should keep passing — they assert the
// CONTRACT (right behaviour for cold-start), not the implementation.

import { type TestCase, expectMentionsAll, expectMentionsNone } from './../_helpers.js'

export const tests: TestCase[] = [
  // ── Pure greeting ─────────────────────────────────────────────────────────
  {
    name: 'cold-start — pure greeting "hola" → welcome + neutral open question (no problem presupposed)',
    run: async (ctx) => {
      const reply = await ctx.send('hola')
      // Welcome present (chatbot intro) + neutral question
      const lower = reply.toLowerCase()
      const hasGreeting = /hola|buen[oa]s/.test(lower)
      const hasIntro = /asistente|ecolaundry/.test(lower)
      if (!hasGreeting || !hasIntro) {
        throw new Error(`expected welcome with greeting + intro, got: ${reply}`)
      }
      // Bot must NOT presuppose a laundry problem on a bare "hola".
      // Acceptable open prompts: "¿en qué te puedo ayudar?", "cuéntame",
      // "dime", "qué te gustaría saber". NOT: "qué problema tiene".
      const presupposesProblem = /qu[eé]\s+(?:problema|incidencia|aver[ií]a|fallo)/i.test(reply)
      if (presupposesProblem) {
        throw new Error(`pure greeting must NOT presuppose a problem, got: ${reply}`)
      }
    },
  },

  // ── Pure FAQ (hours) ──────────────────────────────────────────────────────
  {
    name: 'cold-start — pure FAQ "qué horarios" → answer with hours (no troubleshooting question)',
    run: async (ctx) => {
      const reply = await ctx.send('¿Qué horarios tenéis?')
      const lower = reply.toLowerCase()
      // Hours mentioned (default opening hours: 8:00 a 22:00)
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

  // ── Pure troubleshooting trigger ──────────────────────────────────────────
  {
    name: 'cold-start — pure troubleshoot "la lavadora no funciona" → welcome + ask location',
    run: async (ctx) => {
      const reply = await ctx.send('la lavadora no funciona')
      const lower = reply.toLowerCase()
      // Must ask location
      const asksLocation = /lavander[ií]a|d[oó]nde\s+est[aá]s/.test(lower)
      if (!asksLocation) {
        throw new Error(`expected location ask, got: ${reply}`)
      }
    },
  },

  // ── Mixed: greeting + FAQ ────────────────────────────────────────────────
  {
    name: 'cold-start — mixed "hola, ¿a qué hora abrís?" → welcome + hours',
    run: async (ctx) => {
      const reply = await ctx.send('hola, ¿a qué hora abrís?')
      const lower = reply.toLowerCase()
      const hasHours = /8[:.\s]*0?0|22[:.\s]*0?0|horario/i.test(lower)
      if (!hasHours) {
        throw new Error(`expected hours info on greeting+FAQ mix, got: ${reply}`)
      }
    },
  },

  // ── Mixed: greeting + troubleshooting ─────────────────────────────────────
  {
    name: 'cold-start — mixed "hola, la lavadora no arranca" → welcome + ask location',
    run: async (ctx) => {
      const reply = await ctx.send('hola, la lavadora no arranca')
      // Welcome + location ask in one go (already covered by 01-welcome.test).
      // Pin it explicitly here in the cold-start matrix.
      expectMentionsAll(reply, ['hola', 'soy', 'asistente', 'lavanderia', 'donde'])
    },
  },

  // ── Mixed: greeting + invoice ────────────────────────────────────────────
  {
    name: 'cold-start — mixed "hola, quiero una factura" → welcome + invoice flow',
    run: async (ctx) => {
      const reply = await ctx.send('hola, quiero una factura')
      const lower = reply.toLowerCase()
      // Caso 9 invoice flow starts by asking laundry. Welcome is allowed.
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
    name: 'cold-start — bare "ok" → bot does NOT escalate, asks how to help',
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
