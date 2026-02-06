# 001-reconcile-status

## Goal
Scheduled job to reconcile instance status and mark disconnected channels for UI and alerts.

## Flow
1. Fetch all active WaAPI instances.
2. For each instance, call retrieve status.
3. Update local status if changed.
4. Flag disconnected instances.

## Critical Code Example
```ts
const status = await waapi.retrieveInstance(instanceId);
await repo.updateInstance({ id: instanceId, status: status.state });
```

## Edge Cases
- Rate limits: batch requests and backoff.
- Instance missing: mark as disconnected and alert.

## Acceptance Criteria
1. Job runs on schedule without impacting production traffic.
2. Disconnected instances are flagged within one cycle.
3. Build and tests pass.
4. Documentation updated.

## Build/Test/Coverage
- Scheduler build succeeds.
- Unit tests cover reconciliation logic.
