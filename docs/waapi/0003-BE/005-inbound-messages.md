# 005-inbound-messages

## Goal
Define and implement inbound message handling for WaAPI **only if** WaAPI provides message webhooks or polling endpoints. This task is intentionally separated from the QR/status webhook to avoid mixing concerns.

## Scope
- Add a dedicated webhook endpoint (or polling job) for inbound messages.
- Map inbound messages to existing conversation/message entities.
- Exclude automation/marketing logic from the inbound handler.

## Event Handling Rules
- Accept only WaAPI message events.
- Reject/ignore unknown event types.
- Deduplicate by external message id to avoid duplicates.

## Critical Code Example
```ts
if (event.type === "message") {
  if (await repo.existsExternalMessage(event.id)) return;
  await repo.saveInboundMessage(event.payload);
}
```

## Exclusions
- No QR/status events here.
- No provider switching or instance deletion here.

## Acceptance Criteria
1. Inbound messages are stored once (deduplicated).
2. Only WaAPI message events are handled.
3. Failures do not impact QR/status webhook.
4. Build and tests pass.
5. Documentation updated.

## Build/Test/Coverage
- Backend build succeeds.
- Tests cover message deduplication and error handling.
