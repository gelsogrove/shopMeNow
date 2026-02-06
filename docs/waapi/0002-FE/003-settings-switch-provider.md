# 003-settings-switch-provider

## Goal
Implement a CRITICAL provider switch modal and ensure safe handling of channel CRUD actions in Settings.

## Description
This task covers the **Settings** UX for **provider switching** and the **channel CRUD edge cases** where a user can:
- unsubscribe (disconnect) from WaAPI,
- re-subscribe (reconnect) later,
- delete a channel permanently,
- update channel metadata (including provider).

The flow is **CRITICAL** because switching away from WaAPI must **hard delete** the instance and cannot be recovered.

## Required UX Behaviors
1. **Provider switch (WaAPI → another provider)** must always show a CRITICAL modal.
2. The modal must:
   - require typing `CONFIRM` exactly,
   - state that the WaAPI instance is deleted permanently,
   - state that the user must contact an administrator to re-onboard a new instance if they want WaAPI again,
   - show the channel name/number being affected.
3. **Cancel** closes modal with no side effects.
4. **Confirm** triggers backend deletion + provider update.

## CRUD Coverage in Settings
- **Update** (edit fields without changing provider).
- **Disconnect** (set inactive + delete WaAPI instance).
- **Reconnect** (forces new QR onboarding).
- **Delete channel** (hard delete + WaAPI delete if applicable).

## UI Copy (Exact Text)
**Title:** `Critical action: switch provider`  
**Body:** `This will permanently delete your WaAPI instance. This action cannot be undone. To use WaAPI again, you will need to create a new instance by contacting an administrator.`  
**Input label:** `Type CONFIRM to continue`  
**Primary button:** `Switch Provider`  
**Secondary button:** `Cancel`

## State Transitions (UI-Level)
- `waapi_active` → `switch_provider_pending_confirm` → `switch_provider_confirmed`
- `waapi_active` → `disconnect_pending_confirm` → `disconnected`
- `disconnected` → `reconnect` → `onboarding_qr`

## Frontend API Expectations
- `POST /workspaces/:id/whatsapp/provider/switch` (with target provider)
- `POST /workspaces/:id/waapi/instance/delete` (if separated)
- `GET /workspaces/:id` refresh

## Error Handling
- If delete fails, provider must NOT change.
- Show blocking error banner with retry.
- Log failure with channel id + instance id.

## Acceptance Criteria
1. Switching provider from WaAPI always shows the CRITICAL modal.
2. Confirm button remains disabled until `CONFIRM` is typed exactly.
3. Warning text explicitly states irreversible deletion and need to create a new instance.
4. Cancel closes modal with no side effects.
5. Provider is not changed unless WaAPI instance deletion succeeds.
6. Disconnect and delete channel flows also show a CRITICAL confirmation.
7. Build and tests pass.
8. Documentation updated.

## Build/Test/Coverage
- Frontend build succeeds.
- UI tests cover modal gating, confirm flow, and failure handling.
