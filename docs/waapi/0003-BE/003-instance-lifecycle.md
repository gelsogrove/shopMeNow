# 003-instance-lifecycle

## Goal
Implement backend lifecycle for WaAPI instance creation, webhook configuration, and status retrieval.

## Flow
1. Validate `wa_number`.
2. Create instance via WaAPI.
3. Immediately update instance with webhook URL + events.
4. Store instance metadata.
5. Expose status to frontend.

## Critical Code Example
```ts
await waapi.updateInstance(instanceId, {
  webhook_url: appWebhookUrl,
  webhook_events: ["qr", "authenticated", "ready", "disconnected", "auth_failure"],
});
```

## Edge Cases
- If updateInstance fails, mark instance as `setup_failed` and surface error in UI.
- If number missing, reject before any API call.

## Acceptance Criteria
1. Instance created only when phone number is present.
2. Webhook URL and events are set on creation.
3. Status can be fetched and synchronized.
4. Build and tests pass.
5. Documentation updated.

## Build/Test/Coverage
- Backend build succeeds.
- Unit tests cover create/update/retrieve flows.
