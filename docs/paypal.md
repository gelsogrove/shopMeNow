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

---

# PayPal Billing System (Monthly Invoices)

## Overview

The billing system uses PayPal Subscriptions with **Outstanding Balance** (MIB - Merchant Initiated Billing).
This allows variable monthly charges based on actual usage.

## Billing Flow

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────┐
│  Scheduler  │ ──▶ │ Create PENDING │ ──▶ │ Admin Panel  │ ──▶ │ PayPal API  │
│ (monthly)   │     │    Invoice     │     │ Process Pay  │     │ Capture $   │
└─────────────┘     └───────────────┘     └──────────────┘     └─────────────┘
                                                                      │
                    ┌────────────────┐                                │
                    │ PayPal Webhook │ ◀──────────────────────────────┘
                    │ Update Invoice │
                    └────────────────┘
```

### Step 1: Scheduler Creates Invoices

The `monthly-billing.job.ts` runs on the 1st of each month:

```typescript
// Creates PENDING invoice for each active user
await prisma.monthlyInvoice.upsert({
  where: { userId_periodMonth_periodYear: { userId, periodMonth, periodYear } },
  create: {
    userId,
    periodMonth,
    periodYear,
    totalAmount: calculatedAmount,
    status: 'PENDING',  // NOT yet charged
  },
  update: {
    totalAmount: calculatedAmount,
  },
})
```

**Important:** The scheduler does NOT call PayPal. It only creates PENDING invoices.

### Step 2: Admin Processes Payment

In the **Backoffice → Collections → Previous Month** tab, admin clicks "Process Payment":

```
POST /api/users/admin/invoices/:invoiceId/paypal/process-payment
```

This endpoint:
1. Validates rate limiting (60s between attempts for same invoice)
2. Calls PayPal `POST /v1/billing/subscriptions/{id}/capture`
3. Creates a `PayPalTransaction` record
4. PayPal processes the charge asynchronously

### Step 3: PayPal Webhook Updates Invoice

When PayPal completes the charge, it sends a webhook:

- `PAYMENT.SUCCESS` → Invoice marked `PAID`, transaction status `SUCCESS`
- `PAYMENT.FAILED` → Transaction status `FAILED`, invoice remains `PENDING`

## Rate Limiting & Idempotency

### Rate Limiting (60 seconds)

Prevents double-charging by blocking rapid retries:

```typescript
// In-memory Map tracks last attempt time
const paymentRateLimiter = new Map<string, number>()

// Rejects if less than 60s since last attempt
if (Date.now() - lastAttempt < 60000) {
  throw new Error('Rate limited: wait 60 seconds')
}
```

### Idempotency

PayPal uses `PayPal-Request-Id` header to prevent duplicate captures:

```typescript
headers: {
  'PayPal-Request-Id': `invoice_${invoiceId}_${timestamp}`
}
```

## Database Tables

### PayPalTransaction

Stores all payment attempts (success AND failed):

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Owner being charged |
| invoiceId | UUID | Related invoice (optional) |
| amount | Decimal | Amount in USD |
| currency | String | Always "USD" |
| status | Enum | SUCCESS or FAILED |
| paypalTransactionId | String | PayPal's transaction ID (if success) |
| paypalPayerId | String | PayPal payer ID |
| notes | String | Admin notes or error message |
| adminUserId | UUID | Admin who triggered the payment |
| createdAt | DateTime | When transaction was created |

### MonthlyInvoice Status Flow

```
DRAFT → PENDING → PAID
              ↘ (on failure, stays PENDING, can retry)
```

## Admin UI: Transactions Tab

The **Collections** page includes a **Transactions** tab showing all PayPal payment attempts:

| Column | Description |
|--------|-------------|
| Date | Transaction timestamp |
| User | Owner email and name |
| Invoice | Period (MM/YYYY) and status |
| Amount | USD amount charged |
| Status | SUCCESS (green) or FAILED (red) |
| Notes | Admin notes or error message |

### Visual Distinction

- **SUCCESS**: Green badge with checkmark icon
- **FAILED**: Red badge with alert icon

## Endpoints

### Process Payment (Admin)

```
POST /api/users/admin/invoices/:invoiceId/paypal/process-payment
Body: { notes?: string }
Response: { success: boolean, transactionId?: string, error?: string }
```

### List Transactions (Admin)

```
GET /api/users/admin/paypal/transactions?status=SUCCESS|FAILED&limit=100
Response: Array<{
  id, userId, userEmail, userName, invoiceId, invoicePeriod, invoiceStatus,
  amount, currency, status, notes, adminUserId, createdAt
}>
```

## Webhook Events

| Event | Action |
|-------|--------|
| PAYMENT.SALE.COMPLETED | Invoice → PAID, Transaction → SUCCESS |
| PAYMENT.SALE.DENIED | Transaction → FAILED (invoice stays PENDING) |
| BILLING.SUBSCRIPTION.ACTIVATED | User plan → BASIC (auto-upgrade from FREE) |
| BILLING.SUBSCRIPTION.CANCELLED | User → paypalStatus: 'disconnected' |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No subscription | Returns error, no charge attempted |
| Subscription inactive | Returns error, no charge attempted |
| Rate limited | Returns 429, must wait 60s |
| PayPal API error | Transaction created with FAILED status |
| Webhook verification failed | Event ignored, logged |

## Testing

Run unit tests:

```bash
cd apps/backend
npm run test:unit -- paypal
```

### Test Coverage (48 tests)

**Parameter Validation Tests** (`paypal-parameters-validation.spec.ts`):
- ✅ PayPalTransaction CREATE validation (9 tests)
  - Required: `userId`, `amount`, `currency`, `status`
  - Status must be `SUCCESS` or `FAILED`
  - Amount accepts zero and decimals
  
- ✅ MonthlyInvoice UPDATE validation (5 tests)
  - Status must be valid: `DRAFT`, `PENDING`, `PAID`, `FAILED`, `CANCELLED`
  - `paidAt` must be a Date
  
- ✅ Transaction Response Format (7 tests)
  - Admin transactions list with user/invoice join
  - User transactions list with zero-padded period
  - Handles null user/invoice gracefully
  
- ✅ Process Payment Parameters (4 tests)
  - Required: `invoiceId`, `adminUserId`
  - Optional: `notes`
  
- ✅ Webhook Handler Parameters (5 tests)
  - Required: `subscriptionId`, `paymentAmount`, `paymentTime`
  
- ✅ User PayPal Info Fields (6 tests)
  - Required: `id`, `email`, `paypalStatus`, `isPaymentConnected`
  
- ✅ BillingTransaction Fields (6 tests)
  - Required: `userId`, `type`, `amount`, `balanceAfter`, `description`

**PayPal Config Tests** (`paypal-config.spec.ts`):
- ✅ Environment resolution (sandbox for admin/dev, live otherwise)
- ✅ Config loading for sandbox/live

