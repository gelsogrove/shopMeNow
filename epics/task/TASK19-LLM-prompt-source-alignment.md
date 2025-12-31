# TASK19-LLM-prompt-source-alignment

## Description
Allineare la fonte dei prompt (DB vs file templates) con PRD/architecture e rimuovere ambiguita.

## Example main code
```ts
// apps/backend/src/application/services/template-loader.service.ts
// Option A: load prompt from DB for agentType
```

## Tests involved
- `apps/backend/__tests__/unit/agents/*`

## Tests to modify
- Aggiornare test se la fonte dei prompt cambia (DB vs file).

## Acceptance criteria
- PRD/architecture riflettono la fonte reale dei prompt.
- Nessun prompt usato da sorgenti doppie o non documentate.

## Verification
- BE tests: `cd apps/backend && npm run test:unit`
