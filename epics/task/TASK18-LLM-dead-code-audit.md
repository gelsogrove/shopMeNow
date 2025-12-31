# TASK18-LLM-dead-code-audit

## Description
Rimuovere o reintrodurre correttamente codice morto nel flow LLM (es. checkFAQ non usato), evitando branch non raggiungibili.

## Example main code
```ts
// apps/backend/src/services/llm-router.service.ts
// Remove unused checkFAQ() or wire it as delegatable function
```

## Tests involved
- `apps/backend/__tests__/unit/router/*`

## Tests to modify
- Aggiornare test router se cambia la logica di FAQ/fast-path.

## Acceptance criteria
- Nessun metodo non utilizzato nel flow principale.
- Logica FAQ documentata e testata.

## Verification
- BE tests: `cd apps/backend && npm run test:unit`
