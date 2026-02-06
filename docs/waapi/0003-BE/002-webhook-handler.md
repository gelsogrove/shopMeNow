# 002-webhook-handler

## Goal
Implement the WaAPI webhook endpoint to handle QR and status events safely and idempotently.

## Supported Events
- `qr` (store base64 data URL short-term)
- `authenticated`
- `ready`
- `disconnected`
- `auth_failure`

## Security Requirements
- **Signature validation**: if WaAPI provides a webhook signature header, validate it. If not available, validate by instance id + workspace mapping.
- **Allowlist**: only accept events for instances that belong to the workspace.
- **Rate limiting**: protect the webhook endpoint to avoid abuse.
- **PII handling**: do not log QR base64 or phone numbers in full; mask sensitive fields.
- **Idempotency**: repeated events must be safe.

## Webhook Registration (Generation)
When an instance is created, immediately set the webhook URL and events via `updateInstance`:

```ts
await waapi.updateInstance(instanceId, {
  webhook_url: appWebhookUrl,
  webhook_events: ["qr", "authenticated", "ready", "disconnected", "auth_failure"],
});
```

## Critical Code Example
```ts
switch (event.type) {
  case "qr":
    await repo.updateInstance({ id, qrCodeData: event.qr });
    break;
  case "ready":
    await repo.updateInstance({ id, status: "ready" });
    break;
}
```

## Idempotency
- Webhook may be retried. Ensure updates are safe and do not create duplicate side effects.
- Store last event timestamp if needed.

## Security
- Verify webhook source if WaAPI provides signatures.
- Reject requests without workspace matching instance id.

## Message Reception (Scope & Exclusions)
This webhook handler should **not** process inbound messages unless WaAPI explicitly documents message events for the same endpoint.
- If WaAPI provides message webhooks, implement **separate** handler(s) and routing.
- Exclude: marketing/automation logic from this handler.
- Only update instance status and QR info here.

## Acceptance Criteria
1. Webhook accepts WaAPI payloads and updates instance status.
2. QR data is stored as ephemeral data only.
3. Unknown events do not break processing.
4. Webhook is idempotent.
5. Build and tests pass.
6. Documentation updated.

## Build/Test/Coverage
- Backend build succeeds.
- Webhook handler tests cover all event types.
