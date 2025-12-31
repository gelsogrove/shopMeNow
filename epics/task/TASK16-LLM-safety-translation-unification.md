# TASK16-LLM-safety-translation-unification

## Description
Uniformare l'uso di SafetyTranslationAgent e TranslationAgent nei flussi router e chat-engine, evitando bypass non documentati.

## Example main code
```ts
// apps/backend/src/services/llm-router.service.ts
// Apply SafetyTranslationAgent for all final responses
const safetyResult = await this.safetyAgent.process({ ... })
```

## Tests involved
- `apps/backend/__tests__/unit/flows/message-timeline-tracking.spec.ts`

## Tests to modify
- Aggiungere test per verificare che il final response passi da safety/translation.

## Acceptance criteria
- Nessun path di risposta finale salta il layer deciso (safety/translation).
- Debug timeline mostra step coerenti.

## Verification
- BE tests: `cd apps/backend && npm run test:unit`
