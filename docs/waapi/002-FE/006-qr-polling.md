# 006-qr-polling

## Goal
Implement a polling mechanism in the Frontend Wizard to check for QR code updates and status changes during onboarding.

## Mechanism
- **Endpoint**: `GET /api/workspaces/:id/waapi/status` (lightweight status check).
- **Interval**: Poll every 3 seconds while in "Onboarding" step.
- **Stop Conditions**:
  - Status becomes `ready` or `authenticated`.
  - Error occurs.
  - User leaves page.
  - Timeout (e.g., 2 minutes).

## UI Feedback
- While polling: Show "Waiting for QR..." or the QR image if `qrCodeData` is present.
- If `qrCodeData` changes between polls, update the image.

## Acceptance Criteria
1. Frontend polls backend every 3s.
2. Updates QR image automatically without refresh.
3. Redirects/Advances wizard when status becomes `ready`.
4. Polling stops on unmount.
