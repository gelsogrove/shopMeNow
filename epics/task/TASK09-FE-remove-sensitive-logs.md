# TASK02-FE-remove-sensitive-logs

## Description
Rimuovere log sensibili lato frontend (token, payload JWT) e introdurre log level configurabile per evitare debug in produzione.

## Example main code
```ts
// apps/frontend/src/services/api.ts
if (import.meta.env.VITE_LOG_LEVEL === "debug") {
  logger.info("API request", { url: config.url })
}
```

## Related services/models/best practices
- Non loggare token o payload in produzione.
- Usare log level controllato da env.

## Tests involved
- `apps/frontend/__tests__/services/api.interceptors.spec.ts`

## Tests to modify
- Aggiornare snapshot/asserzioni legate ai log (se presenti).

## Acceptance criteria
- Nessun log di token/payload JWT in produzione.
- Log verbose solo se `VITE_LOG_LEVEL=debug`.

## Verification
- FE build: `cd apps/frontend && npm run build`
- FE tests: `cd apps/frontend && npm run test`
