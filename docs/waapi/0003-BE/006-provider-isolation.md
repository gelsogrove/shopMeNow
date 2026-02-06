# 006-provider-isolation

## Goal
Ensure strict isolation between WaAPI, Meta, and UltraMsg fields and secrets. Switching provider must clean up the previous provider data.

## Scope
- Clear provider-specific fields on switch.
- Ensure webhooks are routed to the correct provider handlers.
- Prevent accidental cross-provider configuration usage.

## Critical Code Example
```ts
if (nextProvider === "waapi") {
  clearMetaFields();
  clearUltraMsgFields();
}
```

## Edge Cases
- Switching from WaAPI to Meta must delete WaAPI instance first.
- Switching from Meta to WaAPI must not retain Meta tokens.

## Acceptance Criteria
1. Provider switch clears fields for the previous provider.
2. Webhook handlers reject mismatched provider payloads.
3. No cross-provider tokens are stored.
4. Build and tests pass.
5. Documentation updated.

## Build/Test/Coverage
- Backend build succeeds.
- Tests cover provider switch cleanup.
