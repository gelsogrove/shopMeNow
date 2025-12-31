# TASK04-FE-routing-cleanup

## Description
Pulire rotte duplicate e componenti non usati per ridurre ambiguita e codice morto.

## Example main code
```tsx
// apps/frontend/src/App.tsx
<Route path="/" element={<RootPage />} />
```

## Related services/models/best practices
- Un solo route per "/".
- Rimuovere componenti importati ma non montati.
- Eliminare file .bak e pagine debug non raggiungibili.

## Tests involved
- `apps/frontend/__tests__/pages/WorkspaceSelectionPage.spec.tsx`
- `apps/frontend/__tests__/pages/LoginPage.returnUrl.spec.tsx`

## Tests to modify
- Aggiornare test che aspettano redirect o routing legacy.

## Acceptance criteria
- Nessun duplicato di route "/".
- Componenti non usati rimossi o montati correttamente.
- Build FE senza warning di import inutili.

## Verification
- FE build: `cd apps/frontend && npm run build`
- FE tests: `cd apps/frontend && npm run test`
