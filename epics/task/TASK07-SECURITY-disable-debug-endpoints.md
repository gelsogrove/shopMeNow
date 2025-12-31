# TASK10-SECURITY-disable-debug-endpoints

## Description
Disabilitare endpoint di test/debug in produzione e ridurre debug info nelle risposte 4xx.

## Example main code
```ts
// apps/backend/src/app.ts
if (process.env.NODE_ENV !== "production") {
  app.post("/api/test/json-parser", jsonParserTestHandler)
}
```

## Related services/models/best practices
- Debug endpoints solo in dev.
- Messaggi errore generici in prod; dettagli nei log.

## Tests involved
- `apps/backend/__tests__/unit/middlewares/*`

## Tests to modify
- Aggiornare test che dipendono da endpoint test.
- Aggiornare test che aspettano debug info in 4xx.

## Acceptance criteria
- Debug endpoints non esposti in prod.
- Risposte 4xx non includono header/param sensibili.

## Verification
- BE build: `cd apps/backend && npm run build`
- BE tests: `cd apps/backend && npm run test`
