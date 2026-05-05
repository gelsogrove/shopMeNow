# WaAPI Work Index

## Execution Order (Recommended)
1. **DB**: add WaAPI fields + **consolidation** (Task 003).
2. **BE Refactor**: Extract base webhook logic (Task 000).
3. **BE**: WaAPI client, webhook handler, lifecycle, **send message** (Task 007), **gate** (Task 008), **factory** (Task 009).
4. **FE**: **Wizard** (Task 008), Polling (Task 006), Settings switch.
5. **Scheduler**: status reconciliation, QR retention.

## Task Map (By Epic)
### 0001-DB
- 001-schema.md
- 002-migrations.md
- **003-consolidation.md** (NEW)

### 0002-FE
- 001-provider-default.md
- 002-onboarding-qr.md
- 003-settings-switch-provider.md
- 004-channel-crud.md
- 005-provider-isolation.md
- **006-qr-polling.md** (NEW)
- **008-channel-wizard.md** (NEW)

### 0003-BE
- **000-refactor-webhook-base.md** (NEW - Pre-req)
- 001-waapi-client.md
- 002-webhook-handler.md
- 003-instance-lifecycle.md
- 004-delete-instance-on-switch.md
- 005-inbound-messages.md
- 006-provider-isolation.md
- **007-waapi-send-message.md** (NEW)
- **008-subscription-gate.md** (NEW)
- **009-provider-factory.md** (NEW)
- **010-queue-cleanup.md** (NEW)

### 0004-schedule
- 001-reconcile-status.md
- 002-qr-retention.md

## Dependencies
- BE Refactor (Task 000) blocks Webhook Handler.
- Subscription Gate (Task 008) blocks Lifecycle.
- Factory (Task 009) & Send (Task 007) required for full functionality.
