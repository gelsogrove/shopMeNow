# Prompts

The bot uses **one** LLM system prompt. It lives in `prompts/agent.txt`. Business rules are appended via `{{reglas}}` from `docs/reglas.md`.

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
