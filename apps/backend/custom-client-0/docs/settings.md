# Settings & tenant configuration

Everything that varies per tenant lives in `json/`. The code is identical across tenants.

## `json/settings.json` — tenant lock

```json
{
  "enabledLanguages": ["es"],
  "defaultLanguage": "es",
  "chatbotName": "Eco",
  "welcomeMessage": {
    "es": "Hola, soy el asistente virtual de la lavandería. ¿Cómo puedo ayudarte?",
    "it": "Ciao, sono l'assistente virtuale della lavanderia. Come posso aiutarti?"
  }
}
```

| Field | Type | Default | Purpose |
|---|---|---|---|
| `enabledLanguages` | `string[]` | — | Hard tenant lock. If the customer types in a language that is NOT in this list, we fall back to `defaultLanguage`. |
| `defaultLanguage` | `string` | — | Fallback language. |
| `chatbotName` | `string` | `"Eco"` | Used inside `{{chatbotName}}` placeholders in prompts. |
| `companyName` | `string` | `"Ecolaundry"` | Tenant brand name, used in escalation summaries. |
| `model` | `string` | env `LLM_MODEL` | OpenRouter model id (e.g. `"openai/gpt-4o-mini"`). |
| `agentTemperature` | `number` | `0.3` | LLM sampling temperature. |
| `agentMaxTokens` | `number` | `800` | Max tokens per LLM call. |
| `maxToolHops` | `number` | `6` | Hard cap on tool-call iterations per turn. |
| `tone` | `string` | — | Free-form tone description injected into the system prompt. |
| `supportEmails.invoice` | `string` | — | Email for invoice requests (Caso 9). |
| `supportEmails.support` | `string` | — | General support email. |
| `refundFormUrl` | `string` | — | Public URL for the refund form (Caso 6/26). |
| `allowedExternalLinks` | `string` | — | Comma-separated whitelisted domains the bot may mention. |
| `welcomeMessage` | `Record<lang, string>` | — | Per-language welcome rendered on the very first turn (only when the customer hasn't already given operational facts). |
| `locationCarryOverMs` | `number` | `3600000` (1 h) | How long (ms) to carry a customer's last known laundromat location forward into a cold-start session. Beyond this window the bot re-asks location. |
| `sessionIdleTtlMs` | `number` | `1800000` (30 min) | In-process session cache TTL (ms). Sessions idle longer than this are evicted to keep memory bounded. |

## `json/locations.json` — laundries metadata + per-location overrides

```json
{
  "locations": {
    "Goya": {
      "displayName": "Calle Goya (Madrid)",
      "metadata": {
        "dryerMinutesIncreaseIssue": false,
        "cardPaymentUnreliable": false
      },
      "faqOverrides": {
        "buy-loyalty-card": "En Calle Goya (Madrid), …"
      }
    }
  }
}
```

**Fields actually read by the chatbot**:

| Field | Used for |
|---|---|
| Top-level keys (`Goya`, `Pineda`, …) | Resolved by `resolveKnownLocation` to validate customer input. Add an entry → also add the name to `KNOWN_LOCATIONS` in `utils/message-parsing.ts` (single source of truth for the validator). |
| `displayName` | Shown in the operator handover summary. |
| `metadata.dryerMinutesIncreaseIssue` | Caso 21/22 — true means the location has the "monedas no suman" pattern documented; false means we tell the customer "no tenemos registrado este tipo de incidencia". |
| `metadata.cardPaymentUnreliable` | Caso 23/24 — same gating logic for "no tarjeta". |
| `faqOverrides[faqKey]` | Replaces base FAQ text from `faqs.json`. Used by `guardCaso10Tarjeta` and tool `apply_faq_override`. |

Other fields (`pueblo`, `calle`, `flowOverrides`, `escalationRules`, `metadata.hours`, …) are part of the type but currently only injected in the LLM system prompt as `{{locationContext}}` JSON. They serve as documentation for the LLM. Editing them changes what the LLM sees but doesn't affect the deterministic guards.

**To add a laundry**:
1. Add an entry under `locations` in `json/locations.json`.
2. Add the name to `KNOWN_LOCATIONS` in `utils/message-parsing.ts`.
3. (Optional) set `metadata.dryerMinutesIncreaseIssue` / `metadata.cardPaymentUnreliable` if relevant.
4. (Optional) add `faqOverrides` for location-specific FAQ replies.

## `json/faqs.json` — base FAQ catalogue

Plain key → text. Used by `guardCaso10Tarjeta` (`loyaltyCard` key) and by the LLM tool `apply_faq_override`.

## `json/washer_hs60xx.json` / `dryer_ed340.json` — flow trees

Decision trees opened by `start_machine_flow`. Each flow has steps with `prompt`, `action`, `next` transitions, `loopback`, `escalate`. Tweak prompts here when you want to refine machine-specific instructions without touching guards.

## `prompts/agent.txt` — system prompt template

Long template with `{{placeholders}}` substituted at every turn:

| Placeholder | Source |
|---|---|
| `{{chatbotName}}` | `settings.json` |
| `{{welcomeBlock}}` | composed from `settings.welcomeMessage` |
| `{{language}}` | `state.language` (LOCKED if customer language ∉ `enabledLanguages`) |
| `{{location}}` / `{{locationStreet}}` | sticky facts |
| `{{machineType}}` / `{{machineNumber}}` / `{{displayState}}` | sticky facts |
| `{{paymentCompleted}}` / `{{paymentMethod}}` | sticky facts |
| `{{activeFlowId}}` / `{{activeStepId}}` | flow engine state |
| `{{customerName}}` | sticky fact |
| `{{turnCount}}` | session counter |
| `{{locationsList}}` | comma-joined keys of `locations.json` |
| `{{locationContext}}` | full JSON of the matching location override |
| `{{reglas}}` | **the entire `docs/reglas.md` file**, injected verbatim |

The `{{reglas}}` injection is what guarantees the LLM follows business rules even on edge cases the guards don't cover. Editing `docs/reglas.md` propagates immediately on next turn — no restart needed.

## How configuration changes propagate

| You edit … | Bot picks it up after … |
|---|---|
| `settings.json` | Restart |
| `locations.json` / `faqs.json` / `washer_hs60xx.json` / `dryer_ed340.json` | Restart |
| `docs/reglas.md` | **Next turn** — re-read at every `loadPromptBundle` call |
| `prompts/agent.txt` | Restart |
| `utils/localization.ts` | Restart (or `tsx` hot-reload in dev) |
| `utils/agent-guards.ts` | Restart |
