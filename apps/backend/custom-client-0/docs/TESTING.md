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
├── 31-codigo-no-doc.test.spec.ts
├── 32-no-local.test.spec.ts
└── locations/
    ├── alemanya/
    │   ├── 21-monedas-secadora.test.spec.ts
    │   └── 23-no-tarjeta.test.spec.ts
    ├── pineda/22-monedas-secadora.test.spec.ts
    └── hortes/24-no-tarjeta.test.spec.ts
```

Convention: file name = `NN-slug.test.spec.ts` where `NN` is the case number from [`docs/01usecases.md`](./01usecases.md). Location-specific cases (Caso 21–24) live under `locations/<laundry>/`.

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

Each `ctx.send` returns the bot reply. Assertions use accent- and case-insensitive substring matching, so tests describe **concepts** not exact wording — that lets the bot evolve without breaking tests for cosmetic changes.

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

## Adding a new test

1. Find the case in [`docs/01usecases.md`](./01usecases.md).
2. Pick the file: existing `NN-slug.test.spec.ts` if Caso N already has tests, otherwise create a new one.
3. Write small dialogs that mirror the doc's `Ejemplo de conversación`.
4. Use `expectMentionsAll` / `expectMentionsNone` with the **canonical phrases** from the doc — not your own paraphrases.
5. Run `npm run test:agent`. The runner picks it up automatically.

## Test policy (Andrea's rule)

> **Inside `custom-client-0/`, [`docs/01usecases.md`](./01usecases.md) is the bible.**

If a test assertion disagrees with the doc, **fix the test to match the doc**, not the other way around. Tests are a derived artifact; the doc is the spec.

## Determinism

The bot uses an LLM (OpenRouter gpt-4o-mini) with `temperature` left at default. Some tests are inherently subject to LLM variation. To keep them stable we lean on:

- **Deterministic guards** — for any case the doc describes with a canonical reply, the guard pipeline produces it without calling the LLM, so the test always matches.
- **Concept-based assertions** — `expectMentionsAll(['revis'])` instead of full-string equality.

If you see a test pass once and fail later with the same code, it's almost always the LLM picking different wording. The fix is to add or extend a deterministic guard.
