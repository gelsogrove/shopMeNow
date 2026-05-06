# Prompts

The bot uses **one** LLM system prompt on the hot path: `prompts/agent.txt`. Business rules are appended via `{{reglas}}` from `docs/reglas.md`. A handful of secondary `.txt` files in `prompts/` are kept on disk for narrow, well-scoped uses listed in the inventory below — nothing is loaded "just in case".

## Prompt file inventory

| File | Loaded as `runtime.prompts.<key>` | Used by | When it fires |
|---|---|---|---|
| `agent.txt` | (loaded separately by `agent-prompt.ts`) | `agent.ts:agentTurn` → `callAgentLLM` | Every LLM turn — the system prompt for the agent loop. |
| `language.txt` | `runtime.prompts.language` | `utils/llm.ts:detectLanguage` | Language detection fallback when the regex heuristic in `intent.ts` cannot decide. Small prompt, JSON-mode reply. |
| `router.txt` | `runtime.prompts.router` | (no live caller) | Legacy artifact of the pre-agent-loop pipeline. Loaded by `runtime.ts:loadRuntime` but no module currently reads it. Kept for reference when authoring new guards / debugging. |
| `history.txt` | `runtime.prompts.history` | (no live caller) | Same status as `router.txt`. The current agent generates customer-facing text directly via `agent.txt` + tool-call results; this older "history specialist" prompt is no longer in the call graph. |
| `washer.txt` | `runtime.prompts.washer` | (no live caller) | Used to be the washer specialist system prompt. Flow logic now lives in `json/washer_hs60xx.json`; the prompt is retained as textual reference. |
| `dryer.txt` | `runtime.prompts.dryer` | (no live caller) | Same as `washer.txt` for dryer flows. |

`security.txt` and `translation.txt` were removed during the dead-code cleanup. Translation is owned by the upstream chat-engine (and skipped automatically when `workspace.customChatbotId` is set — see `chat-engine.service.ts`), and security checks live in code (`utils/agent-guards.ts`), not as a separate LLM round-trip.

If you add a new prompt file, **document it in this table and wire it into a clear caller**. Untracked prompt files become dead code (see the `prompts/intents-faq/` removal for a recent example).

## Hot path

```
user message
   │
   ▼
autoExtractFacts (deterministic)   ← no prompt
   │
   ▼
runGuardPipeline (deterministic)   ← no prompt; first match wins
   │  (no guard hit)
   ▼
callAgentLLM(messages)             ← system message = prompts/agent.txt
   │                                   + {{reglas}} from docs/reglas.md
   │                                   + {{placeholders}} from sticky state
   ▼
final reply
```

`agent.txt` is the only prompt that touches every customer turn. `language.txt` fires only at the start of a session when the heuristic detector returns null. The other three (`router`, `history`, `washer`, `dryer`) are not in the call graph today — they predate the LLM-as-agent rewrite. We keep them on disk only as documentation for the original pipeline.

## How the system prompt is assembled

`utils/agent-prompt.ts:buildSystemPrompt`:

1. Read `prompts/agent.txt`.
2. Read `docs/reglas.md` (so editing rules takes effect immediately, no restart).
3. Substitute `{{placeholders}}` with sticky facts from session state + tenant config.
4. Pass the result as `system` message to OpenRouter.

## Anatomy of `agent.txt`

| Section | Purpose |
|---|---|
| `LANGUAGE ABSOLUTE` | Hard-pinned language directive — uses `{{language}}` from sticky facts. Includes a WRONG/RIGHT example. |
| `FIRST-TURN WELCOME` | Tells the LLM what to do on turn 1 (welcome rendered server-side). |
| `TONE` | Core behavioural rules (calm, no accusation, no inventing facts). |
| `STICKY FACTS` | Embeds `{{location}}`, `{{machineType}}`, `{{displayState}}`, etc. |
| `LOCATION CONTEXT` | If location is set, embeds the full `{{locationContext}}` JSON. |
| `TOOLS` | Recap of the 12 tools and when to use each. |
| `REGLAS DEL NEGOCIO` | `{{reglas}}` — the entire `docs/reglas.md` is injected here. |

## Editing prompts

- **Tone or behaviour**: edit `agent.txt`.
- **Business rules** (forbidden phrases, escalation criteria): edit `docs/reglas.md`. The LLM picks up the change next turn.
- **Per-tenant welcome**: edit `json/settings.json` (`welcomeMessage`).

## When NOT to use the prompt

If the response should be deterministic (always the same canned text — e.g. Caso 12 horarios, Caso 9 factura), do NOT teach it through the prompt. Add a guard in `utils/agent-guards.ts` and a translation key in `utils/localization.ts`. The guard short-circuits the LLM and produces a 100% deterministic reply.

Rule of thumb:
- **Doc says "the bot must reply X verbatim"** → guard + translation.
- **Doc says "the bot should be calm and ask Y"** → prompt + reglas.

## Multilingual

The system prompt is in English (with Spanish placeholders embedded in examples). The LLM replies in `{{language}}` — locked to `settings.enabledLanguages`. Adding a new tenant language:

1. Add to `settings.enabledLanguages`.
2. Add welcome translation under `settings.welcomeMessage`.
3. Add the language to the `t()` keys in `utils/localization.ts` (75 keys × 6 languages today).
4. Done — `gpt-4o-mini` speaks all of them.
