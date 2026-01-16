# PayPal Connect (Owner OAuth)

This document explains how PayPal Connect works in this project, how to configure it in local/dev (sandbox) and production (live), and how we keep the data secure.

## Goal
Each workspace owner connects their own PayPal account. At the end of the month, the platform can charge the owner via PayPal. Only the owner can connect/disconnect.

## Payment Gating (isPaymentConnected)
We store `isPaymentConnected` on the **User** model to represent whether billing actions are allowed.
When `isPaymentConnected` is false, the platform **blocks**:
- Plan upgrades/downgrades
- Credit recharge
- Team member invitations
- New channel creation

The PayPal status endpoint returns this flag so the frontend can disable UI actions.

## Environments
We select the PayPal environment per user:
- `isDeveloperUser = true` or `isPlatformAdmin = true` → **sandbox**
- all other users → **live**

## Required env vars
Add these to your `.env` (local) and your server environment (production). Never commit real values.

```
PAYPAL_CLIENT_ID_SANDBOX=...
PAYPAL_CLIENT_SECRET_SANDBOX=...
PAYPAL_CLIENT_ID_LIVE=...
PAYPAL_CLIENT_SECRET_LIVE=...
PAYPAL_REDIRECT_URI_SANDBOX=   # Optional. Default: {APP_URL}/api/v1/paypal/callback
PAYPAL_REDIRECT_URI_LIVE=      # Optional. Default: {APP_URL}/api/v1/paypal/callback
PAYPAL_REDIRECT_URI=           # Fallback if env-specific values are empty
PAYPAL_PLAN_ID_SANDBOX=        # Optional. If empty, backend auto-creates a $1 monthly anchor plan
PAYPAL_PLAN_ID_LIVE=           # Optional. If empty, backend auto-creates a $1 monthly anchor plan
PAYPAL_TOKEN_ENCRYPTION_KEY=   # 32+ chars. Used to encrypt tokens at rest.
APP_URL=http://localhost:3001  # Backend public URL (for callback)
FRONTEND_URL=http://localhost:3000
```

## Flow (Owner Connect)
1) Owner clicks **Connect PayPal** in Workspace Selection.
2) Backend creates a PayPal OAuth URL:
   - `POST /api/paypal/connect-url`
3) Owner completes PayPal login and grants access.
4) PayPal redirects to backend callback:
   - `GET /api/paypal/callback`
5) Backend exchanges `code` → tokens, fetches user info, **creates a PayPal Subscription v2 (anchor $1 plan, MIB outstanding balance)** in the correct env (sandbox for dev/admin, live otherwise).
6) We store:
   - `paypalStatus`, `paypalMerchantId`, `paypalEmail`, `paypalEnvironment`, `paypalConnectedAt`
   - `metadata.paypalSubscriptionId`, `metadata.paypalSubscriptionStatus`, `metadata.paypalPlanId`
   - encrypted tokens: `paypalAccessTokenEncrypted`, `paypalRefreshTokenEncrypted`
7) Backend redirects user back to:
   - `/workspace-selection?paypal=connected`

## Endpoints
Owner-only (requires auth + owner role):
- `GET /api/paypal/status` → current PayPal status and owner data
- `GET /api/paypal/config` → config status (configured + env)
- `POST /api/paypal/connect-url` → start OAuth flow
- `POST /api/paypal/disconnect` → disconnect and remove tokens

Admin-only (backoffice maintenance + charges):
- `PUT /api/v1/admin/:userId/paypal` → update PayPal fields and `isPaymentConnected`
- `POST /api/users/admin/invoices/:invoiceId/paypal/mock-payment` → admin-triggered charge (uses **sandbox** when owner is dev/admin, **live** otherwise). Currency: USD. Captures outstanding balance on the stored Subscription ID.

Public (PayPal webhook):
- `POST /api/paypal/webhook` → verifies signature and accepts PayPal events

## Security
- Tokens are encrypted at rest with `PAYPAL_TOKEN_ENCRYPTION_KEY`.
- OAuth callback validates the `state` token to prevent CSRF.
- Only workspace owners (SUPER_ADMIN) can connect/disconnect.
- No tokens are ever sent to the frontend.

## Local Sandbox Setup
1) Go to https://developer.paypal.com/
2) Create a **Sandbox REST App**
3) Copy the Sandbox `Client ID` and `Secret` into `.env`
4) Ensure `APP_URL` is `http://localhost:3001`
5) Mark your user as **Developer** or **Platform Admin** to force sandbox
6) Open the app and click **Connect**

## Webhook Setup
Create one webhook per environment and add the ID to env:
- `PAYPAL_WEBHOOK_ID_SANDBOX`
- `PAYPAL_WEBHOOK_ID_LIVE`

The backend verifies every webhook event using PayPal's
`/v1/notifications/verify-webhook-signature` endpoint.

## Production Setup
1) Create a **Live** app in PayPal.
2) Add live credentials as server env vars.
3) Create a Live product + plan (or let the backend auto-create) and set `PAYPAL_PLAN_ID_LIVE`.
4) Set `APP_URL` to your public backend URL.
5) Developer/admin users remain sandbox even in production.

## Notes
- If credentials are missing, the Connect button is disabled and shows a warning.
- Webhooks are not required for the OAuth connect flow. They are needed later for automated payouts/charges.
