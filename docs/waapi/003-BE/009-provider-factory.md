# 009-provider-factory

## Goal
Update the `WhatsAppProviderFactory` to support the new `waapi` provider type.

## Scope
1. Update `apps/backend/src/services/whatsapp/whatsapp-provider.factory.ts`.
2. Update `apps/scheduler/src/services/whatsapp/whatsapp-provider.factory.ts` (Mirror copy).
3. Add `waapi` case in switch statement.
4. Instantiate `WaapiWhatsAppProvider` with credentials from Workspace (consolidating fields if task 003-consolidation is done).

## Updates
```typescript
case 'waapi':
  if (!workspace.waapiInstanceId || !workspace.waapiApiKey) {
    throw new Error('Missing WaAPI credentials');
  }
  return new WaapiWhatsAppProvider(workspace.waapiInstanceId, workspace.waapiApiKey);
```

## Acceptance Criteria
1. `getProvider(workspace)` returns `WaapiWhatsAppProvider` when `whatsappProvider === 'waapi'`.
2. Throws error if credentials missing.
3. Both Backend and Scheduler factories are updated.
