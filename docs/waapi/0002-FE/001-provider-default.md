# 001-provider-default

## Goal
Set WaAPI as the default provider in onboarding while keeping other providers selectable in Settings and any advanced configuration UI.

## UX Requirements
- New channel onboarding defaults to WaAPI.
- Settings page still allows switching to Meta/UltraMsg (with critical confirmation if leaving WaAPI).
- Provider label should be clear and consistent across UI.

## Example (Critical)
```ts
const defaultProvider: Provider = "waapi";
```

## Edge Cases
- Existing workspaces with `whatsappProvider=meta` should not be auto-changed.
- If provider field is null, default to `waapi` only for new onboarding, not for saved settings.

## Acceptance Criteria
1. Onboarding defaults to WaAPI for new channels.
2. Other providers remain visible and selectable in Settings.
3. Existing provider settings are not overwritten.
4. Build and tests pass.
5. Documentation updated.

## Build/Test/Coverage
- Frontend build succeeds.
- UI test verifies default selection.
