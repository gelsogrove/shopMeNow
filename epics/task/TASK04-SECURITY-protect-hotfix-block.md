# TASK07-SECURITY-protect-hotfix-block

## Description
Proteggere l'endpoint HOTFIX di blocco clienti con auth/session middleware o rimuoverlo se non piu' necessario.

## Example main code
```ts
// apps/backend/src/app.ts
app.post(
  "/api/workspaces/:workspaceId/customers/:id/block",
  authMiddleware,
  sessionValidationMiddleware,
  blockCustomerHandler
)
```

## Related services/models/best practices
- Usare sempre auth + session validation per azioni distruttive.
- Aggiungere rate limit su endpoint sensibili.

## Tests involved
- `apps/backend/__tests__/security/session-validation.middleware.test.ts`
- `apps/backend/__tests__/unit/middlewares/auth.middleware.spec.ts`

## Tests to modify
- Aggiungere test security per verificare 401 senza token/session.

## Acceptance criteria
- Endpoint non accessibile senza auth/session.
- Rate limiting attivo se previsto.
- Nessun regression sul flusso admin.

## Verification
- BE build: `cd apps/backend && npm run build`
- BE tests: `cd apps/backend && npm run test:security`
