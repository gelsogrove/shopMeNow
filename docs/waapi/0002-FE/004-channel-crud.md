# 004-channel-crud

## Goal
Ensure full channel CRUD for WaAPI, with mandatory phone number and support for reconnecting after deletion.

## CRUD Actions
- **Create**: requires `wa_number` and sets provider to WaAPI by default.
- **Update**: edit metadata (name/phone), no provider change.
- **Delete**: hard delete channel and WaAPI instance.
- **Reconnect**: start onboarding again for deleted/disconnected channels.

## Critical Code Example
```tsx
if (!waNumber) return setError("Phone number is required");
```

## UX Expectations
- Show required phone input on create.
- Show status badges for `ready`, `authenticated`, `disconnected`.
- Show reconnect CTA when status is `disconnected` or channel deleted.

## Edge Cases
- User deletes channel then immediately recreates: ensure old instance is deleted.
- Update while status is `disconnected`: allow edit but warn that QR is needed.

## Acceptance Criteria
1. Create requires phone number for WaAPI channels.
2. Update preserves history and metadata.
3. Delete triggers backend deletion and removes UI entry.
4. Reconnect is possible after deletion via onboarding.
5. Build and tests pass.
6. Documentation updated.

## Build/Test/Coverage
- Frontend build succeeds.
- UI tests cover create/update/delete/reconnect.
