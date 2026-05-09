# Branch-Router Architecture (target)

> Status: **DESIGN — not yet implemented**. This document describes the
> target architecture decided with Andrea on 2026-05-08. The migration
> from the current guard-pipeline to this design is tracked as a multi-
> phase refactor; see [§ Migration plan](#migration-plan) at the bottom.

## Why we are changing

The current architecture (guard pipeline + sequential regex matching) has
two structural debts:

1. **Intent classification via regex** (rule #6 exemption documented in
   [`CLAUDE.md`](../CLAUDE.md)). Each FAQ topic has a multilingual regex
   pattern that needs manual extension every time a new phrasing or
   language appears (e.g. "che orari avete?" did not match the original
   ES-only `HORARIOS_TOPIC` regex).
2. **No clear separation between branches**. The current pipeline mixes
   greeting / FAQ / machine-trouble / invoice / loyalty / escalation
   guards in a single ordered list. Adding a new branch means inserting
   yet another guard and hoping the order is right.

The target architecture replaces the regex-based classification with a
**single LLM router call at turn 1** and cleanly separates each branch
into its own module with per-language data files.

## High-level shape

```
┌─────────────────────────────────────────────────────────────────────┐
│ Turn 1 — branch dispatch                                            │
│                                                                     │
│   customer message                                                  │
│       │                                                             │
│       ▼                                                             │
│   utils/router.ts                                                   │
│   classifyMessageBranch(message, customerLang)                      │
│       │                                                             │
│       ▼  (single LLM call, ~500ms)                                  │
│   { branch: "greeting" | "faq" | "trouble-machine" |                │
│              "invoice" | "loyalty" | "escalation" | "unknown",      │
│     details?: { faqKey?: string, displayHint?: string, ... }        │
│   }                                                                 │
│       │                                                             │
│       ▼                                                             │
│   branchDispatcher(branch, message, state)                          │
│       │                                                             │
│       ▼                                                             │
│   utils/branches/<branch>/handler.ts                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Turn 2+ — sticky branch                                             │
│                                                                     │
│   state.activeBranch is sticky after T1.                            │
│   No more router calls. The branch handler keeps control until      │
│   it explicitly hands off (mark_resolved, escalate_to_operator,     │
│   or topic-switch detected).                                        │
│                                                                     │
│   Topic switch detection: a turn-N message that doesn't fit the     │
│   active branch (semantic mismatch) re-runs the router exactly      │
│   once. Otherwise the branch handler stays in control with its      │
│   deterministic state machine.                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## File layout

```
utils/
├── router.ts                          ← single-call LLM classifier
├── branches/
│   ├── index.ts                       ← branch dispatcher
│   ├── greeting/
│   │   ├── handler.ts                 ← welcome + open question
│   │   ├── es.json                    ← {welcomeText, openQuestion, ...}
│   │   ├── it.json
│   │   ├── en.json
│   │   ├── ca.json
│   │   ├── pt.json
│   │   └── fr.json
│   ├── faq/
│   │   ├── handler.ts                 ← apply_faq_override + answer
│   │   ├── es.json                    ← FAQ keys + per-lang triggers
│   │   ├── it.json
│   │   └── (idem 4 langs)
│   ├── trouble-machine/
│   │   ├── handler.ts                 ← gather → flow → resolution
│   │   ├── gather-state-machine.ts    ← location → tipo → numero → display
│   │   ├── es.json                    ← reply strings per step + hints
│   │   ├── (idem 5 langs)
│   ├── invoice/
│   │   ├── handler.ts                 ← 8-step invoice gather
│   │   ├── es.json                    ← invoice strings
│   │   ├── (idem 5 langs)
│   ├── loyalty/
│   │   ├── handler.ts                 ← buy + recharge
│   │   ├── es.json
│   │   └── (idem 5 langs)
│   └── escalation/
│       ├── handler.ts                 ← cameras / ajax / refund / fraud
│       └── (per-lang as above)
```

## Router contract

```ts
// utils/router.ts

export type Branch =
  | 'greeting'
  | 'faq'
  | 'trouble-machine'
  | 'invoice'
  | 'loyalty'
  | 'escalation'
  | 'unknown'

export interface RouterDecision {
  branch: Branch
  /** Customer language as detected by the router (one of 6 supported). */
  language: 'es' | 'it' | 'en' | 'ca' | 'pt' | 'fr'
  /** Branch-specific hints captured during classification. */
  details: {
    faqKey?: string                // for branch="faq"
    displayHint?: string           // for branch="trouble-machine" (e.g. "PUSH PROG")
    locationHint?: string          // for branch="trouble-machine"
    incidentType?: string          // for branch="escalation"
  }
}

/** Single LLM call. Cached per session: at T1 the result becomes the
 *  active branch; subsequent turns stay in that branch until a topic
 *  switch is detected. */
export async function classifyMessageBranch(
  message: string,
  prevState: SessionState,
): Promise<RouterDecision>
```

The router uses a **dedicated minimal prompt** (≤ 50 lines, not the full
agent prompt) to keep the call fast and cheap.

## Branch handler contract

```ts
// utils/branches/<branch>/handler.ts

export interface BranchInput {
  message: string
  state: SessionState
  routerDetails: RouterDecision['details']
  i18n: BranchI18n          // resolved per customer language
}

export interface BranchOutput {
  reply: string
  stateMutations: Partial<SessionState>
  /** Branch keeps control next turn unless this is set. */
  handoff?: 'resolved' | 'escalate' | 'topic-switch'
}

export type BranchHandler = (input: BranchInput) => Promise<BranchOutput>
```

Each branch loads its language file at module level:

```ts
// utils/branches/greeting/handler.ts
import esStrings from './es.json' with { type: 'json' }
import itStrings from './it.json' with { type: 'json' }
// ...
const STRINGS = { es: esStrings, it: itStrings, /* ... */ }

export const greetingHandler: BranchHandler = async ({ state, i18n }) => {
  return {
    reply: `${i18n.welcome}\n\n${i18n.openQuestion}`,
    stateMutations: {},
  }
}
```

## Topic-switch protocol

```
Turn N (active branch = "trouble-machine"):
  customer: "ah perdona, prima volevo solo sapere gli orari"
       ↓
  branch handler reads message + active state
       ↓
  detects semantic mismatch (current branch is gathering machine facts,
  but the message is a clear FAQ topic)
       ↓
  returns { handoff: 'topic-switch' }
       ↓
  agentTurn() re-invokes the router → new branch="faq"
       ↓
  faq handler answers + flags state to remember to RESUME the previous
  branch on the next turn ("after I answer this FAQ, I should go back
  to gathering machine facts").
```

## When does the router fire?

Andrea (2026-05-08) decision: **only on turn 1** (and after session reset).

```
Turn 1               → Router LLM classifies → state.activeBranch = X
Turn 2..N            → No router. state.activeBranch sticky. Branch X handler in control.
Session expire (1h)  → State reset. Next message restarts the router.
Topic switch in T2+  → Branch handler returns { handoff: 'topic-switch' }, the
                       agent loop re-invokes the router exactly ONCE, then the
                       previous branch is preserved in state.previousBranch so
                       the conversation can resume after the off-topic answer.
```

This is the right tradeoff between cost/latency and architectural cleanness:
- One LLM router call per session (not per turn)
- Determinism after T1 keeps latency < 100ms per turn
- Topic-switch is rare in practice; a single re-classification absorbs it

## Mix regex + LLM (rule of thumb)

```
L1  REGEX boundary signals          → instant, deterministic
    (pure greeting, mataró street, mixed-signal markers)

L2  LLM router (T1 only)            → ~500ms, ~$0.0005, runs once per session
    Decides: branch + customer language + minimal hints

L3  Branch handler — deterministic  → < 100ms per turn
    State machine + per-language JSON (no regex on free text!)

L4  LLM inside branch (rare)        → only for yes/no semantic interpretation
    e.g. "did the central return the change?" — yes/no in 6 languages
```

## Migration plan (feature-flagged)

To avoid breaking the working pipeline, the new architecture ships behind
a flag in `settings.json`. When `useBranchRouter: true` the dispatcher
runs; otherwise the legacy guard pipeline keeps working unchanged.

**Related opt-in flag** (since 2026-05-10): `naturalRephrase` (default
`false`). Independent from `useBranchRouter`. When true, every guard
outcome is passed through `utils/agent-rephrase.ts` for LLM tone-polish.
Both flags can be toggled independently. See `docs/settings.md` and
CLAUDE.md *"Test deterministic vs production polished"*.

**Per-LLM temperatures** (configurable in `settings.json`):
- `routerTemperature` (default `0`): T1 branch classifier — keep low,
  it's a discrete routing task.
- `rephraseTemperature` (default `0.4`): rephrase polish — moderate,
  generative but constrained.
- `agentTemperature` (default `0.3`): main turn LLM (legacy).

**Known issue if you enable `useBranchRouter: true` today** (Andrea,
2026-05-10 sweep): `json/faqs.json:pricing` exposes hardcoded prices
that the legacy `guardPricingDeflect` correctly avoids. The branch
FAQ handler bypasses the deflect → violates Playbook PDF §5.10 *"si
no hi ha certesa, derivar a revisió"*. Must be fixed (drop the
hardcoded prices, defer to manual review) before promoting the flag.
Tracked in CLAUDE.md *"Architectural fixes log"*.

| Phase | Scope | Status |
|---|---|---|
| A — Router + dispatcher + flag | Router, branch dispatcher, settings flag, `state.activeBranch`/`state.previousBranch` fields | ✅ done |
| B — Greeting + FAQ branch (full POC) | `branches/greeting/`, `branches/faq/` with 6 per-lang JSON files; FAQ handler reads `json/faqs.json` + `locations.json:faqOverrides` | ✅ done |
| C — Trouble-machine branch (thin) | Handler seeds `state.location` / `state.displayState` from router hints, then `delegate-to-legacy`. Routing T1 multilingual; gather + display flow still on legacy pipeline | ✅ done (thin) |
| D — Invoice + Loyalty branches (thin) | Handlers set `pendingFlow="invoice-ask-location"` (caso 9) / no-op (loyalty) and `delegate-to-legacy`. Routing T1 multilingual; legacy guards drive the multi-step gather | ✅ done (thin) |
| E — Escalation branch (thin) | Handler seeds `state.nonTroubleshootingIncident` from router `incidentType` hint, `delegate-to-legacy`. Routing T1 multilingual; legacy `guardEscalateNonTroubleshooting` + per-incident guards run the rest | ✅ done (thin) |
| F — Topic-switch protocol | Detect mid-conversation topic change, re-router with previousBranch save | ⏳ next session |
| G — Promote thin handlers to full | Move gather state machine + display flow + invoice flow + loyalty + escalation logic INTO the branches/ tree, drop the legacy guards | ⏳ later (incremental, branch-by-branch) |
| H — Flip flag default | `useBranchRouter: true` becomes default once topic-switch is implemented and at least one full handler (G) is migrated | ⏳ later |
| I — Remove legacy pipeline | Delete old guards + rule #6 exemption from CLAUDE.md once all branches are full | ⏳ later |

### What "thin" means (phases C/D/E)

Each thin handler owns the routing benefit (T1 LLM picks the branch
across 6 languages) and seeds sticky state from the router hints, then
returns `handoff: 'delegate-to-legacy'`. The dispatcher returns
`handled: false` so `agentTurn` falls through to the existing guard
pipeline + LLM loop. Crucially, `state.activeBranch` stays set, so
subsequent turns DO NOT re-run the router — the same branch handler
fires (and again delegates) until the legacy pipeline closes the case.

## Acceptance criteria

The refactor is "done" when:

1. ✅ All 374 existing unit tests pass
2. ✅ All 46 agent E2E tests pass (full run, not random sample)
3. ✅ Adding a new language = adding 1 file per branch, no code changes
4. ✅ Adding a new FAQ = adding 1 entry to `branches/faq/<lang>.json`, no code changes
5. ✅ Rule #6 exemption removed from CLAUDE.md (FAQ topic regex eliminated)
6. ✅ Average LLM cost per turn < current (router is light, T2+ deterministic)

## Risks and trade-offs

| Risk | Mitigation |
|---|---|
| Router LLM misclassifies → wrong branch | Topic-switch protocol re-invokes router on mismatch detection |
| Router latency at T1 (~500ms) | Single small prompt; cached per session; T1 is the welcome turn anyway |
| Migration breaks 32 use cases | Phase-by-phase migration with full test re-run after each phase |
| Agent behaviour drift after migration | Agent E2E tests pin the 46 canonical conversations |
