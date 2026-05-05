# 002-onboarding-qr

## Goal
Implement WaAPI onboarding: create instance, render QR, handle webhook events, and guide user to a ready state. Phone number is mandatory.

## UX Steps
1. User enters WhatsApp number (required) and optional display name.
2. On submit, backend creates instance and sets webhook.
3. UI listens for `qr` webhook event and renders QR (base64 image).
4. Status updates (`authenticated`, `ready`, `disconnected`) update UI.
5. If disconnected or deleted, user can reconnect by starting onboarding again.

## Critical Code Example
```tsx
{qrCodeData && <img src={qrCodeData} alt="WhatsApp QR" />}
```

## Required UI Copy
- Header: `Connect WhatsApp`
- Hint: `Use a number that can receive WhatsApp messages`
- Status states: `Waiting for scan`, `Authenticated`, `Ready`, `Disconnected`

## Edge Cases
- QR expires: show `Regenerate QR` button.
- Webhook delays: show loading state and allow retry.
- Invalid number format: block submission.

## Acceptance Criteria
1. Phone number is required before onboarding continues.
2. QR appears within onboarding and updates on new `qr` events.
3. Status updates are visible and accurate.
4. Reconnect flow is accessible after disconnect/delete.
5. Build and tests pass.
6. Documentation updated.

## Build/Test/Coverage
- Frontend build succeeds.
- UI tests cover QR render, status transitions, and validation.
