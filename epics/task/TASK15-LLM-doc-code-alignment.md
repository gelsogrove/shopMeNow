# TASK15-LLM-doc-code-alignment

## Description
Allineare documentazione e codice sul router flow (validation-only, safety/translation). Decidere se implementare la validazione router o aggiornare i documenti.

## Example main code
```ts
// apps/backend/src/services/llm-router.service.ts
// Option A: implement validation-only and add router validation step
const validationResult = validateSubAgentResponse(...)
```

## Tests involved
- `apps/backend/__tests__/unit/flows/message-timeline-tracking.spec.ts`

## Tests to modify
- Aggiornare test timeline se si aggiunge un nuovo step di validazione.

## Acceptance criteria
- Documentazione multi-agent coerente con il codice reale.
- O il validation-only e' implementato e testato, oppure la doc lo descrive come non attivo.
- Timeline debug riflette il flusso reale.

## Verification
- BE tests: `cd apps/backend && npm run test:unit`
