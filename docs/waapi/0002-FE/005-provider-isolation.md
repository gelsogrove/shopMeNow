# 005-provider-isolation

## Goal
Ensure the UI never mixes fields between WaAPI, Meta, and UltraMsg. Switching provider must clear the previous provider fields in the form state.

## Scope
- Reset provider-specific inputs on switch.
- Show only fields for selected provider.
- Prevent stale values from being sent to API.

## Critical Code Example
```tsx
if (provider === "waapi") resetMetaFields();
if (provider === "meta") resetWaapiFields();
```

## Edge Cases
- User switches provider and cancels: restore original values.
- User switches provider and confirms: clear previous provider fields.

## Acceptance Criteria
1. Provider switch clears previous provider fields in UI state.
2. Only selected provider fields are visible/editable.
3. No stale provider data is sent to backend.
4. Build and tests pass.
5. Documentation updated.

## Build/Test/Coverage
- Frontend build succeeds.
- UI tests cover provider switch reset behavior.
