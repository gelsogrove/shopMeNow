# WaAPI Work Index

## Execution Order (Recommended)
1. **DB**: add WaAPI fields + indexes
2. **BE**: WaAPI client + webhook handler + lifecycle + delete-on-switch
3. **FE**: onboarding QR + settings switch + CRUD + provider isolation
4. **Scheduler**: status reconciliation + QR TTL cleanup

## Task Map (By Epic)
### 0001-DB
- 001-schema.md
- 002-migrations.md

### 0002-FE
- 001-provider-default.md
- 002-onboarding-qr.md
- 003-settings-switch-provider.md
- 004-channel-crud.md
- 005-provider-isolation.md

### 0003-BE
- 001-waapi-client.md
- 002-webhook-handler.md
- 003-instance-lifecycle.md
- 004-delete-instance-on-switch.md
- 005-inbound-messages.md
- 006-provider-isolation.md

### 0004-schedule
- 001-reconcile-status.md
- 002-qr-retention.md

## Dependencies
- FE onboarding depends on BE webhook + instance lifecycle.
- Settings switch depends on BE delete instance flow.
- Scheduler jobs depend on BE retrieve instance support.
