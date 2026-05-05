# 002-qr-retention

## Goal
Ensure QR data is short-lived and cleaned up to reduce sensitive data retention.

## Flow
1. Track `qr_code_data` updated time.
2. If older than TTL, clear it.
3. UI can request new QR via reconnection flow.

## Critical Code Example
```ts
if (isQrStale(updatedAt)) await repo.clearQrCode(instanceId);
```

## Acceptance Criteria
1. QR data is cleared after TTL.
2. UI can request a fresh QR if needed.
3. Build and tests pass.
4. Documentation updated.

## Build/Test/Coverage
- Scheduler build succeeds.
- Tests cover TTL cleanup.
