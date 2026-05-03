# Testing

## Run

```bash
npm run test:agent
```

The runner walks `__tests__/agent/` recursively, picks up every `*.test.spec.ts`, runs each `TestCase` in a fresh agent session, and prints `✓` / `✗` with a per-test latency.

## Layout

```
__tests__/agent/
├── run.ts                 # recursive runner
├── _helpers.ts            # TestCase + assertion helpers
├── 01-welcome.test.spec.ts
├── 02-faq.test.spec.ts
├── 03-mataro.test.spec.ts
├── …
├── locations/
│   ├── alemanya/
│   ├── pineda/
│   └── hortes/
└── cross/
    ├── 01-mataro-doble-cobro.test.spec.ts
    ├── 02-faq-during-flow.test.spec.ts
    ├── 03-multi-context-switch.test.spec.ts
    ├── 04-unknown-location.test.spec.ts
    ├── 05-location-gated-21-24.test.spec.ts
    └── 06-multi-fact-extraction.test.spec.ts
```

Convention: file name = `NN-slug.test.spec.ts` where `NN` is the case number from [`usecases.md`](./usecases.md). Location-specific cases (Caso 21–24) live under `locations/<laundry>/`. Cross-cutting tests live under `cross/`.

## Test shape

```ts
import { type TestCase, expectMentionsAll } from './_helpers.js'

export const tests: TestCase[] = [
  {
    name: 'ES — Caso N short description',
    run: async (ctx) => {
      await ctx.send('first user message')
      const reply = await ctx.send('second user message')
      expectMentionsAll(reply, ['keyword1', 'keyword2'])
    },
  },
]
```

Each `ctx.send` returns the bot reply. Assertions use accent- and case-insensitive substring matching, so tests describe **concepts** not exact wording.

## Assertion helpers (`_helpers.ts`)

| Helper | What it checks |
|---|---|
| `expectMentionsAll(reply, [...tokens])` | Every token must appear (norm = lowercase + accent strip) |
| `expectMentionsNone(reply, [...tokens])` | No token may appear |
| `expectInLanguage(reply, 'es')` | Heuristic language fingerprint |
| `expectAsksForLocation(reply)` | "donde / dove / where" + "lavandería / laundry / …" |
| `expectAsksForMataroStreet(reply)` | "Mataró" + "calle / via / carrer / …" |
| `expectAsksForMachineType(reply)` | "lavadora o secadora" pattern |
| `expectAsksForMachineNumber(reply)` | "número …" |
| `expectAsksAboutDisplay(reply)` | "pantalla / schermo / display" + "qué / cosa / what" |
| `expectAsksAboutPayment(reply)` | "pagado / paid / pagaste / …" |
| `expectAsksAboutChange(reply)` | "cambio / resto" + "devuelto / restituito / returned" |
| `expectWelcome(reply)` | "hola / ciao / hi" + "eco / ecolaundry / asistente" |
| `expectNoWelcome(reply)` | No "soy eco / sono eco / i'm eco" intro |
| `expectLoopback(reply)` | "si / if / se" + "funciona / works / arranca / starts" + ask marker |
| `expectEscalation(reply)` | "operador / revisar / revisión / manual review / …" |
| `expectNoEscalation(reply)` | No "operador / operatore / human support" |
| `expectStateHas(session, {...})` | Session state has these field values |

## Test policy

> **Inside `custom-client-0/`, [`usecases.md`](./usecases.md) is the bible.**

If a test assertion disagrees with the doc, **fix the test to match the doc**, not the other way around. Tests are a derived artifact; the doc is the spec.

## Determinism

The bot uses an LLM (OpenRouter gpt-4o-mini). To keep tests stable we lean on:

- **Deterministic guards** — for any case the doc describes with a canonical reply, the guard pipeline produces it without calling the LLM.
- **Concept-based assertions** — `expectMentionsAll(['revis'])` instead of full-string equality.

If you see a test pass once and fail later with the same code, it's almost always the LLM picking different wording. The fix is to add or extend a deterministic guard.
