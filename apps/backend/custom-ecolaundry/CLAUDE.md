# custom-ecolaundry — Orchestration rules (read every turn)

This file is auto-loaded when working under `apps/backend/custom-ecolaundry/`.
Read it BEFORE every change. The rules below are non-negotiable.

> Long-form docs:
> - [`docs/architecture.md`](docs/architecture.md) — full layered design
> - [`docs/contracts.md`](docs/contracts.md) — per-tool validators
> - [`docs/adding-use-cases.md`](docs/adding-use-cases.md) — recipes
> - [`docs/orchestrator.md`](docs/orchestrator.md) — turn pipeline

---

## 🔒 The 8 iron rules — verify on every change

Before I write any code in this module, I must confirm each rule applies:

1. **No patches in `prompts/agent.txt`**. If the LLM behaves wrong, fix it
   in code: a guard, a tool validator, or a post-processor invariant.
   ❌ Adding "DO NOT DO X" to the prompt is forbidden.

2. **Tool refuses, LLM corrects**. Tools validate args + semantics and
   return actionable errors. The LLM reads the error and retries.
   ❌ Trusting the LLM to "remember a rule" is forbidden.

3. **One file = one responsibility**. Files >150 lines mixing concerns
   must be split. Use the cassette structure (`tool-handlers/`,
   `guards/`, detectors, transitions).

4. **State transitions are named & atomic**. All mutations of
   `pendingClosure`, `operatorRequested`, `pendingEscalation`,
   `escalationReason`, `customerNameRequested` go through
   [`utils/state-transitions.ts`](utils/state-transitions.ts):
   - `markResolved(ar)` / `undoResolved(ar)`
   - `escalate(ar, reason)`
   - `requireCustomerName(ar)`
   - `resetPostEscalationFlags(ar)`
   - `resetForNewIncident(ar)`
   ❌ Inline mutations of those fields outside that module are forbidden.

5. **Each detector ships with tests**. Pure helpers in `utils/<name>.ts`
   (e.g. `mixed-signal.ts`, `flow-compatibility.ts`) MUST have a sibling
   `__tests__/unit/<name>.test.ts` covering happy + edge cases.
   100% coverage on the detector itself.

6. **No hardcoded phrase detection for INTENT**. Phrase routing
   (`if user says X then route to Y`) belongs in the LLM. Phrase
   detection in code is allowed ONLY for boundary signals (greeting,
   mixed-signal, contrast connectors).

7. **Settings are law**. `json/settings.json` is the source of truth
   for tenant config (`enabledLanguages`, `defaultLanguage`,
   `maxToolHops`, …). `runtime.ts:validateSettings` fails fast on
   misconfiguration. No code path may produce a reply in a non-allowed
   language.

8. **Multi-language by design**. Every detector covers all 6 supported
   languages (es, it, en, ca, pt, fr). Adding a new language means
   updating each detector's keyword list AND the i18n catalogue, with
   tests.

---

## 🧭 The 5 layers — know which one you're in

```
L1 INPUT SANITISERS   utils/input-sanitize.ts
L2 STATE              utils/state.ts + utils/state-transitions.ts
L3 DETECTORS          utils/<name>.ts (mixed-signal, customer-name, flow-compatibility, contradiction, …)
L4 TOOL CONTRACTS     utils/agent-tools.ts (schemas) + utils/tool-handlers/*.ts (handlers)
L5 OUTPUT POLICIES    agent.ts:polishReplyForTurn (sanitize, invariants, welcome)
```

When asked to "fix" something, I MUST identify the layer first.
Cross-layer code is the smell that produced the bugs the refactor closed.

---

## ✅ Pre-commit checklist (mental, every change)

- [ ] Did I touch `prompts/agent.txt`? If yes, did I add a behavioural
      "DO NOT DO X" rule? **Stop**: it goes in code (rule #1).
- [ ] Did I mutate `pendingClosure`/`operatorRequested`/`pendingEscalation`
      inline? **Stop**: use a transition from `state-transitions.ts`
      (rule #4).
- [ ] Did I add a phrase regex? Is it for INTENT or for a boundary
      signal? Intent goes to the LLM (rule #6).
- [ ] Did I add a detector? Did I write its tests? (rule #5)
- [ ] Did I touch a tool? Did I update [`docs/contracts.md`](docs/contracts.md)?
- [ ] Are the affected files <150 lines? If not, split (rule #3).
- [ ] Does `npm run typecheck` pass?
- [ ] Does `npm run test:unit` pass (all suites)?
- [ ] Multi-language: does my change cover es / it / en / ca / pt / fr? (rule #8)

---

## 🔁 pendingFlow lifecycle — ask vs await phases

Every multi-step `pendingFlow` has TWO phases. The phase is encoded in the
suffix and determines who is in control:

| Suffix | Phase | Who controls | Gather guards may fire? |
|---|---|---|---|
| `-ask-<topic>`   | gathering   | deterministic guards | ✅ yes (still asking facts) |
| `-await-<topic>` | LLM-driven  | LLM tool-call loop | ❌ no (LLM is interpreting reply) |

Examples:
- `caso4-ask-cambio` → bot is asking for missing facts (location/type/number).
  Gather guards (`forceLocation`, `forceMachineType`, …) may still preempt.
- `caso4-await-cambio` → bot just asked "¿la central te ha devuelto el
  cambio?". LLM must read the customer's reply (yes/no) and act. Gather
  guards MUST NOT fire — they would derail the flow (e.g. asking about
  display while the bot is waiting for cambio yes/no).

This is enforced by [`utils/guards/helpers.ts:isAwaitingPendingFlow`](utils/guards/helpers.ts)
+ [`notInActiveSubFlow`](utils/guards/helpers.ts). Every gather guard
already calls `notInActiveSubFlow(ar)` and gets the right behaviour
automatically.

### Convention when adding a new pendingFlow

If your new flow has a phase where the LLM interprets the reply
semantically, name that pendingFlow `<id>-await-<topic>`. The naming
contract is what makes the gather guards step aside.

Anti-pattern: ❌ adding a phase like `caso9-pending-name` instead of
`caso9-await-name`. The guards would not detect it as LLM-controlled.

---

## 📚 FAQ — two-tier knowledge (system + workspace)

The bot has TWO independent FAQ sources. They serve different purposes
and MUST stay separate. Don't merge them.

### Tier 1 — System FAQs (deterministic, key-based)
- **Where**: `json/faqs.json` (file, bundled with the module)
- **Override per pueblo**: `json/locations.json:faqOverrides`
- **Tool**: `apply_faq_override(faqKey)` — the LLM passes a known
  semantic key (e.g. `openingHours`, `washDryTime`) and gets the answer
- **For**: stable, well-defined Q&A that need deterministic mapping
  (FAQ keys are referenced by guards, locations, the LLM prompt)
- **Lifecycle**: changes require a code redeploy (these are part of the
  bot's "system contract")

### Tier 2 — Workspace FAQs (dynamic, prompt-injected)
- **Where**: Postgres `FAQ` table (`workspaceId`, `question`, `answer`,
  `isActive`, `keywords`, `category`, `order`)
- **NO `language` column** — content lives in the workspace's base
  language (es for ecolaundry); the existing `history.txt` translation
  layer handles output to the customer's language
- **Source for the LLM**: a `{{faq}}` block in the system prompt,
  populated per-turn from `ar.runtime.workspaceFaqs`
- **Data flow**: the chat-engine (`apps/backend/src/...`) is the
  ONLY layer that touches Postgres. It calls `WorkspaceFaqService.
  getActiveFaqs(workspaceId)` (5-min in-memory cache, invalidate via
  `POST /api/internal/faq/cache/invalidate`), enforces a token budget
  (`settings.maxFaqInjectionTokens`, default 2000 tokens), and passes
  the result via `ChatbotInput.context.workspaceFaqs`. Custom-ecolaundry
  receives them already loaded — **zero Prisma in this module**
  (iron rule: zero-deps runtime preserved)
- **Tool**: none. The LLM reads them from the prompt directly when no
  `apply_faq_override` key matches the customer's free-form question
- **For**: business-curated content that the PM edits from the backoffice
  without redeploy
- **Lifecycle**: edit in backoffice → invalidate-cache endpoint →
  next turn picks up the change

### Iron rule — `apply_faq_override` first, `{{faq}}` block as fallback
The LLM is instructed to PREFER `apply_faq_override(faqKey)` for any
question that matches a known key. The `{{faq}}` block is the
fallback for free-form questions. This keeps the prompt cache hit rate
high (the system prompt is identical per session; cache invalidates
only when workspace FAQs are edited).

### Adding a new business FAQ — workflow
1. PM creates the row in the backoffice UI → DB INSERT
2. Backoffice triggers cache invalidation → next call to chat-engine
   re-fetches
3. The bot starts using the new content on the next turn — no deploy

### NOT to be done (anti-patterns)
- ❌ Importing Prisma into `custom-ecolaundry/` — chat-engine fetches,
  custom-ecolaundry only renders
- ❌ Adding a `language` column to `FAQ` — translation belongs in
  `prompts/history.txt`, not in storage
- ❌ Using `{{faq}}` for stable system FAQs — those go in
  `json/faqs.json` with a key (Tier 1)
- ❌ Concatenating Tier 1 + Tier 2 in the same data structure — they
  have different lifecycles and access patterns

---

## 🚦 Where to add a behaviour (decision tree)

```
"The bot should not do X."
   │
   ├── X is about the customer-input shape → L1 (input-sanitize)
   ├── X is about state mutation rules → L2 (state-transitions)
   ├── X is about classifying a reply pattern → L3 (new detector + tests)
   ├── X is about an LLM tool call constraint → L4 (tool-handlers/* validator)
   └── X is about the final reply text → L5 (polishReplyForTurn invariant)

"The bot should now support a new feature."
   │
   ├── New display code → json/display-flows.json + i18n keys
   ├── New language → json/i18n/<lang>.json + detector keyword lists
   ├── New tool → agent-tools.ts schema + tool-handlers/<topic>.ts + register
   ├── New required fact for escalation → models/state.ts + state-transitions
   └── New conversational invariant → L5 step in polishReplyForTurn
```

If unsure, read [`docs/adding-use-cases.md`](docs/adding-use-cases.md)
recipe selector. If still unsure, ask Andrea.

---

## 🛑 Anti-patterns I must reject (and call out)

If a request asks me to do any of these, I MUST push back, propose the
correct layer, and only proceed once the user explicitly confirms:

- "Just add a rule to the prompt that says…" (rule #1)
- "Set `state.operatorRequested = true` here directly" (rule #4)
- "Add a regex to match 'ordine' / 'order' for routing" (rule #6)
- "Skip the test, it's a small change" (rule #5)
- "Hardcode this welcome string in the code" (rule #7)
- "Just patch this one case in code, don't generalise" (rule #2)

These were the symptoms behind the bugs the refactor closed. Falling
back to them would re-open the same bug surface.

---

## 📊 Useful commands

```bash
# Run from this directory:
npm run typecheck          # tsc --noEmit -p tsconfig.json
npm run test:unit          # all unit tests (~200 tests, <1s)
npm run demo               # CLI agent loop (needs OPENROUTER_API_KEY)
npm run test:agent         # E2E with LLM (slow, costs $)
```

---

## 🤝 What I always do, on every turn

1. Re-read this file's iron rules.
2. Identify the affected layer(s) before changing anything.
3. Run typecheck + test:unit at the end. Never claim "done" without both green.
4. Update `docs/contracts.md` when touching a tool.
5. When in doubt, ask Andrea — never invent rules.
