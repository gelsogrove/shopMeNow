# TASK09-SECURITY-uploads-access-control

## Description
Separare file pubblici e privati in `/uploads` e servire i file sensibili solo tramite endpoint autenticati o URL firmati.

## Example main code
```ts
// apps/backend/src/app.ts
// Public assets only
app.use("/public", express.static(publicUploadsPath))
```

## Related services/models/best practices
- Usare storage service con signed URLs per file privati.
- Evitare exposure diretta di cartelle con dati sensibili.

## Tests involved
- `apps/backend/__tests__/unit/controllers/*` (se tocca controller file)

## Tests to modify
- Aggiungere test che verifica accesso negato a file privati.

## Acceptance criteria
- File privati non accessibili senza auth.
- Asset pubblici accessibili solo da path dedicato.

## Verification
- BE build: `cd apps/backend && npm run build`
- BE tests: `cd apps/backend && npm run test`
