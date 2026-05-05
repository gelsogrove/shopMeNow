# 000-refactor-webhook-base

## Goal
Extract common logic from `MetaWebhookController` and `UltraMsgWebhookController` into a shared service or base class BEFORE implementing WaAPI webhook. This prevents triplicating 800+ lines of critical logic.

## Common Logic to Extract
- **Customer Lookup**: Finding/Creating customer by phone number.
- **Locking**: `await this.lockRequest(phoneNumber)` mechanism.
- **Rate Limiting**: Token bucket checks.
- **Message Deduplication**: Checking `existsExternalMessage`.
- **Chat Engine Routing**: Passing message to `llmRouter.handleMessage`.
- **Queueing**: Creating `ConversationMessage` and `WhatsappChannelQueue` entries.
- **Response Handling**: The "immediate 200 OK" pattern.

## Proposed Structure
`InboundMessagePipeline` (Service)
  - `process(workspaceId: string, payload: StandardizedPayload)`

Each controller:
1. Validates signature/auth.
2. Normalizes provider-specific payload to `StandardizedPayload`.
3. Calls `pipeline.process()`.

## Acceptance Criteria
1. `MetaWebhookController` uses the shared pipeline.
2. `UltraMsgWebhookController` uses the shared pipeline.
3. No checking logic is duplicated.
4. Existing tests pass (refactor only).
