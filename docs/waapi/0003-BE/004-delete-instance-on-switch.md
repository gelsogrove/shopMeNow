# 004-delete-instance-on-switch

## Goal
When a user confirms provider switch away from WaAPI, delete the WaAPI instance permanently and clear provider metadata. This is the most critical flow.

## Flow
1. User confirms with `CONFIRM`.
2. Backend calls WaAPI delete instance.
3. If successful, clear WaAPI fields and update provider.
4. If deletion fails, do not change provider.

## Critical Code Example
```ts
await waapi.deleteInstance(instanceId);
await repo.clearProviderInstance(channelId);
```

## Edge Cases
- WaAPI deletion returns error: keep provider as WaAPI and show error.
- Instance already deleted: treat as success and proceed.

## Acceptance Criteria
1. Delete call is executed only after CRITICAL confirmation.
2. WaAPI instance deletion is logged and retried on transient failure.
3. Channel history is preserved.
4. Provider only switches after delete succeeds.
5. Build and tests pass.
6. Documentation updated.

## Build/Test/Coverage
- Backend build succeeds.
- Integration tests cover provider switch and instance deletion.
