# TASK08-SECURITY-remove-public-workspaces

## Description
Rimuovere il mount pubblico di `/workspaces` non autenticato e mantenere solo le route protette sotto `/api`.

## Example main code
```ts
// apps/backend/src/app.ts
// Remove: app.use("/workspaces", workspaceRoutesRoot)
app.use("/api/workspaces", authMiddleware, workspaceRoutes)
```

## Related services/models/best practices
- Mai esporre dati di workspace senza auth.
- Se serve endpoint pubblico, creare DTO con campi safe.

## Tests involved
- `apps/backend/__tests__/security/workspace-isolation-simple.test.ts`
- `apps/backend/__tests__/unit/middlewares/auth.middleware.spec.ts`

## Tests to modify
- Aggiungere test che verifica 401 su `/workspaces/*`.
- Aggiornare eventuali test che usano la route legacy.

## Acceptance criteria
- `/workspaces` non e' accessibile senza auth.
- Nessun campo sensibile esposto in route pubbliche.

## Verification
- BE build: `cd apps/backend && npm run build`
- BE tests: `cd apps/backend && npm run test:security`
