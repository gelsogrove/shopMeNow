# TASK05-BE-api-versioning-consolidation

## Description
Consolidare l'esposizione API su `/api/v1` e deprecare `/api` per evitare doppia superficie e inconsistenze.

## Example main code
```ts
// apps/backend/src/app.ts
app.use("/api/v1", apiV1Routes)
// optional: alias /api -> /api/v1 (temporary)
```

## Related services/models/best practices
- Evitare route duplicate e legacy non versionate.
- Allineare FE/Backoffice su una sola base URL.

## Tests involved
- `apps/backend/__tests__/unit/routes/route-mounting-order.spec.ts`
- `apps/backend/__tests__/unit/middlewares/auth.middleware.spec.ts`

## Tests to modify
- Test che chiamano `/api` vanno aggiornati a `/api/v1`.
- Aggiornare eventuali FE/backoffice mocks.

## Acceptance criteria
- `/api/v1` e' l'unica base stabile per le API.
- `/api` (se ancora presente) e' solo alias temporaneo e documentato.

## Verification
- BE build: `cd apps/backend && npm run build`
- BE tests: `cd apps/backend && npm run test`


ovviamente il FE va analizzato bene e vanno cambiati i link 
ovunque ripeto ovunque !!!!!
altrimenti non va piu nulla e' imporatnte che il refactor e' e a360 gradi

