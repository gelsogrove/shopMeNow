# TASK13-TEST-e2e-smoke

## Description
Definire una smoke suite E2E minima per login -> workspace -> chat e redirect root vs landing flag.

## Example main code
```ts
// e2e/smoke.spec.ts (esempio)
// 1. Login
// 2. Select workspace
// 3. Open chat
```

## Related services/models/best practices
- E2E ridotte ma stabili per flussi critici.
- Usare dati seed e ambienti isolati.

## Tests involved
- Nuova suite E2E (tool da decidere: Playwright/Cypress).

## Tests to modify
- Nessuno esistente; aggiunta di nuova suite.

## Acceptance criteria
- E2E smoke verde su CI.
- Copertura dei flussi base e redirect.

## Verification
- E2E run: comando definito in base al tool scelto.
