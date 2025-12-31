# TASK06-BE-env-secrets-cleanup

## Description
Ridurre a una sola fonte di verita per le variabili d'ambiente e rimuovere file `.env` duplicati/backup dal repo.

## Example main code
```ts
// apps/backend/package.json (script)
"dev": "dotenv -e ../../.env -- tsnd -r tsconfig-paths/register --transpile-only --respawn src/index.ts"
```

## Related services/models/best practices
- Un solo `.env` locale (non committato) + `.env.example`.
- Preferire config manager (Heroku config, Vault).

## Tests involved
- `packages/database/__tests__/check-env-safety.spec.ts`

## Tests to modify
- Aggiornare test se cambiano variabili richieste o path di `.env`.

## Acceptance criteria
- Un solo `.env` locale usato a runtime.
- `.env` backup rimossi dal repo.
- `.env.example` aggiornato e allineato.

## Verification
- BE build: `cd apps/backend && npm run build`
- BE tests: `cd apps/backend && npm run test`
