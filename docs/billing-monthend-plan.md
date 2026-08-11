# Month-End Billing & Collections — Attack Plan

> Status: PHASES 2–4 largely IMPLEMENTED on 2026-08-11 (same session, on Andrea's order).
> See §8 for what shipped and what remains. Decisions resolved by Andrea in-session:
> currency = EUR; first partial month pays NO subscription fee (invoice.planType
> snapshot); job = 1st of month 23:30 Europe/Rome, always bills the PREVIOUS month;
> invoice is issued and numbered even when the charge FAILS (soft block, operator
> retries from Collections: 1 automatic + 3 manual attempts).
> Date: 2026-08-11. Author: Claude (session with Andrea).
> Scope: single monthly invoice (subscription + recharges), automatic month-end PayPal charge,
> soft-block collections flow operated from the backoffice Collections page.

---

## 1. The Contract (as defined by Andrea, verified against code)

1. **Recharge = instant credit, no immediate payment.** The owner clicks "recharge €10" and the
   wallet is credited immediately. No PayPal checkout at recharge time. The platform knowingly
   extends credit ("andiamo anche in perdita, lo so").
2. **Consumption burns the wallet in real time** (messages, orders, pushes). Soft stop when the
   balance would go below **−€10** (`CREDIT_MIN_THRESHOLD`) — already implemented in
   `deductCredit` (subscription-billing.repository.ts:289).
3. **One invoice per owner per month**: `subscription fee + sum of recharges` (+ bonus shown but
   NOT charged, see §5). Consumption appears only as informational detail (`creditUsage`), it is
   **not** an invoice line — the customer already "bought" it via recharges.
4. **One automatic PayPal transaction** at month end for the invoice total.
   Example: 3 recharges of €10 + €60 subscription → invoice €90 (+VAT per client) → single
   PayPal capture of the total.
5. **On failure: soft block.** Nothing automatic. The invoice goes `FAILED` and is highlighted in
   the backoffice **Collections** page. The operator manually retries (max **3** attempts,
   tracked), then decides: **block** the account, **cancel** the invoice, or **grant credit**.
6. **Invoices always in English.** Currency: **EUR** (see open decision §7.1 — Andrea assumed USD,
   code is EUR everywhere).
7. **VAT is per client**, managed by the platform admin in backoffice ClientsPage
   (`User.taxRate`, default 0.22, can be 0 for foreign clients). NOT self-service.

---

## 2. What already exists and matches the contract ✅

| Piece | Where | State |
|---|---|---|
| `MonthlyInvoice` schema | schema.prisma:1528 | Complete: `UNIQUE(userId, periodYear, periodMonth)`, `paymentRetryCount`, statuses `DRAFT/PENDING/PAID/FAILED/CANCELLED`, `planType` snapshot, `paypalTransactions` relation |
| Invoice total = subscription + adjustments + **recharges** | invoice.service.ts `recalculateInvoiceTotals` → `computeInvoiceTotals` (packages/database/billing-math) | Matches contract — consumption is NOT billed |
| Fiscal numbering | invoice.service.ts:73-124 | `YYYY-NNNN`, per-year sequence, `SELECT FOR UPDATE` lock — safe under concurrency |
| Per-client VAT | `User.taxRate` + admin-user-plan.routes.ts:115 + ClientsPage | Working; invoice reads it |
| Invoice PDF | invoice.service.ts:691+ | English ("INVOICE"), issuer data from PlatformConfig (editable in backoffice) |
| Admin API suite | admin-invoice-core / -paypal / -adjustments / -credit-notes routes | List, PDF, details, update status, delete, **mark paid manually**, **cancel + block workspace** |
| Collections page | backoffice CollectionsPage.tsx (1965 lines) | FAILED/PENDING badges, retry-count display in cancel modal, recharges drill-down modal, paid history |
| PayPal mandate flow | paypal.routes.ts `createSubscription` | Subscription with €1.00 EUR anchor plan, `auto_bill_outstanding: true` — this IS the mandate for automatic charging |
| Outstanding-balance capture | paypal.routes.ts `captureOutstandingBalance` | **Written but DEAD CODE — zero callers** (see §3.1) |
| Payment webhook | paypal-billing.service.ts `handlePaymentSuccess` | Marks invoice PAID (but fragile matching, see §3.3) |
| Soft stop at −€10 | subscription-billing.repository.ts:289 | Working |
| Scheduler infra | scheduler.ts (node-cron) | Running, but only 2 conversation-cleanup jobs |

---

## 3. Bugs & gaps found (360° review) 🐛

### 3.1 The charge never happens — dead code
`captureOutstandingBalance` (paypal.routes.ts:226) has **no callers**. There is no endpoint and
no job that actually collects the invoice. The whole month-end revenue path is unwired.

### 3.2 The scheduler comment lies
subscription-billing.repository.ts:496 says *"Scheduler runs at 23:30 on the 1st of each month"*.
**No such job exists.** scheduler.ts only has conversation cleanup (every 5 min + weekly).
`nextBillingDate` is set but nothing ever reads it to act.

### 3.3 Webhook matches invoice BY AMOUNT — wrong-invoice risk
`handlePaymentSuccess` picks the invoice whose total matches the payment amount, and **falls back
to the oldest pending invoice** when nothing matches. Two invoices with equal totals, or a partial
payment, can mark the wrong invoice PAID. Fix: carry `invoiceId` in the capture's `custom_id` and
match on it; never fall back silently.

### 3.4 First-invoice trap (Andrea: "occhio alla logica della prima fattura")
`recalculateInvoiceTotals` reads the **current** `user.planType` instead of the invoice's
`planType` snapshot. Consequences:
- Invoice created during FREE_TRIAL → `subscriptionAmount = 0`; the user's first recharge
  auto-upgrades them to BASIC (`rechargeOwnerCredit`), and the next recalculation silently
  rewrites the fee retroactively for the whole month.
- A user upgrading on the 28th gets the full month's fee of the new plan.
Fix: snapshot the fee at finalization using `invoice.planType`, and apply the first-invoice rule
chosen in §7.2.

### 3.5 Recharge flow contradicts the contract
The immediate-capture checkout (`paypal-checkout.service.ts`, added 2026-08-11) collects money at
recharge time. Under the contract this becomes double billing (recharges are collected again in
the month-end transaction). It must be replaced by: instant wallet credit + accrual on the
invoice, guarded by an active PayPal mandate (§7.5).

### 3.6 Currency inconsistencies
- Code and schema are **EUR** everywhere (`currency_code: "EUR"`, `@default("EUR")`,
  `RECHARGE_MIN_EUR`).
- But `rechargeOwnerCredit` error strings say **"$10"/"$1000"**
  (subscription-billing.service.ts:609-613), and the deploy doc mentions "anchor $1, USD".
- Andrea assumed the platform was in dollars — it is not. Decision §7.1.

### 3.7 Italian in a customer-facing error (Rule 15)
`deductCredit` returns `"Credito esaurito. Saldo: …"` (subscription-billing.repository.ts:296).
Must be English (the LLM translates for end customers; owners see English UI).

### 3.8 Live webhooks cannot be verified
`PAYPAL_WEBHOOK_ID_LIVE` is **missing** on Heroku (only the sandbox one is set). In live,
`verifyWebhookSignature` always fails → payments would never be auto-marked PAID.

### 3.9 Sandbox credentials broken
`invalid_client` on the sandbox pair (admin users are routed to sandbox via
`resolvePayPalEnvironment`). Blocks all end-to-end testing by Andrea. Live pair was updated and
verified OK on 2026-08-11 (release v1156 — confirm it went live).

### 3.10 Pause semantics — confirm intended
`resolveSubscriptionAmount`: paused **before** period start → fee 0; paused **mid-month** → FULL
fee. Confirm this is the desired behavior (§7.4).

### 3.11 Two invoice systems — keep them separate
- Platform invoices (`monthlyInvoice`, English) — this plan.
- Customer-order invoices (`services/invoice/InvoiceService.ts`) — hardcoded Italian
  ("FATTURA", it-IT dates). Different domain (end-customer orders). Flagged for a separate
  cleanup; NOT touched by this plan.

### 3.12 BillingPage FE shows the old model
"Next monthly charge €73.20" (subscription + taxes only). Must show: subscription + recharges of
the current period + VAT — i.e. the real amount that will be charged.

---

## 4. Architecture of the missing pieces

### 4.1 Month-end job (scheduler.ts)
```
cron: 30 23 1 * *   (1st of month, 23:30 — TZ decision §7.6)
for each owner with an active plan (paginate, workspace-agnostic):
  1. getOrCreateCurrentInvoice(previous month)   // idempotent via UNIQUE
  2. recalculateInvoiceTotals                     // fee from invoice.planType snapshot (§3.4 fix)
  3. finalizeInvoice: DRAFT → PENDING + ensureInvoiceNumber
  4. chargeInvoice (4.2)
Job is re-runnable: crash mid-way → next run skips PAID/CANCELLED, retries PENDING/FAILED-eligible.
Every step logged; summary log line with counts (created/charged/failed).
```

### 4.2 Charge executor (new service, single responsibility — Rule 16.3)
```
chargeInvoice(invoiceId):
  - guard: status ∈ {PENDING, FAILED}, paymentRetryCount < 3 (DB-enforced)
  - guard: user has active mandate (paypalSubscriptionId + status ACTIVE)
  - PayPal capture OUTSTANDING_BALANCE for invoice.totalAmount
      headers: PayPal-Request-Id = invoiceId:attemptN   // PayPal-side idempotency
      custom_id: invoiceId                               // webhook matching (§3.3 fix)
  - on COMPLETED → markInvoicePaid(+paypalTransactionId) + billingTransaction INVOICE_PAID
  - on failure  → markInvoiceFailed + paymentRetryCount++ + reason in adminNotes
  - state transitions atomic (prisma $transaction), status re-checked inside the tx
```

### 4.3 Operator flow (Collections page — soft block, human decides)
New/verified admin endpoints (all `isPlatformAdmin`-only, audited):
- `POST /admin/invoices/:id/retry-charge` — calls 4.2; 409 if retryCount ≥ 3 or status not
  retryable; button disabled in UI at 3 attempts.
- `POST /admin/invoices/:id/mark-paid` — exists (manual override).
- `POST /admin/invoices/:id/cancel` — exists, with optional `blockWorkspace`.
- Grant credit — via existing adjustments/credit-notes routes; surfaced as an action in the
  FAILED row so the operator has all four choices in one place: **Retry / Mark paid / Grant
  credit / Cancel(+Block)**.
Blocking is NEVER automatic. Consumption soft-stops on its own at −€10 regardless.

### 4.4 Recharge rework (contract §1)
- `POST /subscription-billing/recharge` → validates €10–€1000, **guards active mandate**,
  credits wallet instantly (`addCredit RECHARGE`), no PayPal call.
- The immediate-capture checkout endpoints are removed (or kept dormant behind the decision §7.5).
- FE BillingSection: recharge becomes one click + confirm; copy explains "added to your monthly
  invoice".

### 4.5 Bonus on the invoice (Andrea: "occhio ai bonus")
`INITIAL_CREDIT` and promotional `ADJUSTMENT`s are **gifted**, never collected:
- Excluded from the charged total (verify `computeInvoiceTotals` treats promo adjustments as
  non-charged; negative adjustments = discounts are fine).
- Shown on the PDF and detail view as an informational line: `Bonus credit (not charged)`.
- Tax applies only to charged amounts.

### 4.6 Invoice detail (Andrea: "solo ricariche e subscription, eventualmente bonus")
PDF + FE detail lines:
```
Subscription <PLAN> <Month YYYY>        €60.00
Recharge 2026-08-03                     €10.00
Recharge 2026-08-14                     €10.00
Recharge 2026-08-27                     €10.00
[Bonus credit (not charged)             €5.00]   ← only if present
Subtotal                                €90.00
VAT (22%)                               €19.80   ← per-client taxRate, can be 0%
TOTAL                                   €109.80
```
Consumption breakdown stays available in the FE drill-down (informational), not on the fiscal
document.

---

## 5. Security checklist (per layer)

**Charge path**
- Idempotency: DB `UNIQUE(userId, year, month)` + status-transition guard inside a transaction +
  `PayPal-Request-Id` per attempt. A double-fired cron or double-clicked Retry cannot charge twice.
- Server-side truth only: invoice state changes exclusively from PayPal API responses/webhooks,
  never from FE-supplied data.
- Webhook: signature verification (exists) + `custom_id = invoiceId` matching; on mismatch log
  and hold for operator, never auto-apply to "oldest pending" (§3.3).
- Mandate revocation: handle `BILLING.SUBSCRIPTION.CANCELLED` webhook → flag user
  `DISCONNECTED`, surface in Collections, stop scheduling charges for them.

**Authorization**
- All Collections/admin endpoints: `isPlatformAdmin` only; every action audited
  (`adminMarkedById`, `adminMarkedAt`, reason in `adminNotes`).
- Owner endpoints keep `ensureOwner` (SUPER_ADMIN membership).
- `taxRate` stays admin-only. It must NOT become editable in `/profile` (an owner could zero
  their own VAT). Read-only display in profile is acceptable.
- Rate-limit the retry endpoint; retryCount enforced in DB, not only in UI.

**Data**
- No card/PSP data stored beyond PayPal ids (already true).
- Amounts always `Decimal`, arithmetic in billing-math (already true) — no float math in new code.
- Workspace isolation N/A here (billing is owner-level by design, Feature 198) — but every
  workspace-scoped query keeps `workspaceId` per Rule 2.

**Language**
- All new UI/API/PDF strings in English (Rule 15). Fix §3.7.

---

## 6. Work plan (phases, each shippable)

| Phase | Content | Touches |
|---|---|---|
| **0 — Unblock env** | Fix sandbox PayPal credentials; set `PAYPAL_WEBHOOK_ID_LIVE`; confirm release v1156 active | Heroku config only |
| **1 — Contract in code** | Recharge without capture + mandate guard; EUR/English string fixes (§3.6, §3.7); bonus lines (§4.5); invoice detail layout (§4.6) | BE service + FE BillingSection + PDF |
| **2 — Month-end engine** | Cron job (§4.1); charge executor (§4.2); webhook `custom_id` fix (§3.3); first-invoice fee snapshot (§3.4 per decision §7.2) | scheduler.ts, new service, paypal-billing.service |
| **3 — Collections flow** | Retry endpoint (max 3); grant-credit action wired into FAILED rows; UI clarity pass on CollectionsPage (1965 lines — split into components, Rule 12/16.3); FE BillingPage "next charge" fix (§3.12) | Admin routes + backoffice |
| **4 — Hardening** | Mandate-revocation webhook; audit trail review; rate limits; unit tests for: charge idempotency, retry cap, first-invoice fee, bonus exclusion, VAT 0% | BE + tests |
| **5 — Docs** | Update docs/PRD.md billing section to this contract; keep this file in sync | docs |

Rules honored: tests-first behavior definitions (Rule 7A), unit tests only (7B), no prompt
patches — everything deterministic code (16), DB-first config (1), English UI (15), no git
operations by the assistant.

---

## 7. Open decisions — Andrea must choose

1. **Currency**: code is EUR end-to-end. Stay EUR (recommended — no migration, no FX risk) or
   switch to USD (big migration: schema defaults, PayPal, PDFs, history)?
2. **First invoice** when a user upgrades mid-month (incl. trial→BASIC on first recharge):
   a) fee starts from the first FULL month — partial month pays recharges only (**recommended**:
   simplest, customer-friendly, kills §3.4 retroactivity), b) pro-rata daily, c) full fee
   regardless of upgrade day.
3. **The €1 mandate anchor**: PayPal's subscription anchor charges €1/month by itself. Show it on
   the invoice as a €1 credit line, absorb it silently, or set the anchor to the plan fee and
   capture only recharges as outstanding balance?
4. **Pause mid-month = full fee** (§3.10): confirm or switch to pro-rata/zero.
5. **Recharge without mandate**: block the recharge button until PayPal is connected
   (recommended — no exposure without a way to collect) or allow and chase later?
6. **Timezone** for the month-end run: Europe/Rome 23:30 on the 1st (matches existing
   `nextBillingDate` convention) — confirm.

---

---

## 8. Implementation log — 2026-08-11

**Shipped (all typechecked; backend 3517 unit tests green, scheduler 200 green):**

- `services/paypal-invoice-charge.service.ts` (NEW) — the only invoice collector.
  Atomic attempt claim (`updateMany` on status+retryCount), `PayPal-Request-Id`
  per attempt, `MAX_PAYMENT_ATTEMPTS = 4` (1 scheduler + 3 operator), zero-total
  invoices closed without PayPal, no-mandate failures recorded WITHOUT consuming
  retry budget. Records `PayPalTransaction` (+`adminUserId` audit) and
  `INVOICE_PAID` billing transaction.
- `services/month-end-billing.service.ts` (NEW) — bills the PREVIOUS month
  (year-rollover tested), finalize → ensureInvoiceNumber → charge (invoice issued
  even on FAILED charge), per-owner error isolation, re-runnable. Ports pending
  plan changes + trial expiration→pause from the retired scheduler job.
- `scheduler.ts` — month-end job cron `30 23 1 * *` Europe/Rome; **startScheduler()
  is now actually called from index.ts (it never was — no cron job ever ran)**;
  stopScheduler on SIGTERM.
- Admin endpoints (auth + platformAdmin): `POST /users/admin/invoices/:id/retry-charge`
  (409 when not eligible) and `POST /users/admin/billing/run-month-end`.
- Webhook `handlePaymentSuccess`: exact-amount match ONLY — the blind
  fallback-to-oldest is gone; unmatched payments are logged for Collections.
- First-invoice rule: fee read from `invoice.planType` snapshot (upgrade mid-month
  → no retroactive fee; fee starts with the first full month).
- Dead code removed: OAuth `/connect-url` flow (+jwt/encryptSecret helpers),
  `captureOutstandingBalance` route copy, `apps/scheduler` monthly-billing job
  (wallet-deduction model — would have double-billed the fee) + its npm script,
  exports and tests, `computeMonthlyCharge` + its tests.
- Language/currency: deductCredit message → English; `$` → `€` in service strings
  and 3 test assertions; invoice+credit-note PDF dates → en-GB; PDF footer
  "deducted from prepaid credit balance" → "charged automatically via PayPal";
  Deploy doc "anchor $1, USD" → "anchor €1, EUR".
- `/profile` empty-form bug: `useCurrentUser` was `enabled: !!storage.getUser()` —
  permanently disabled after any 401 cleared the cache. Now token-gated.
- New specs: `paypal-invoice-charge.service.spec.ts` (8) and
  `month-end-billing.service.spec.ts` (7).

**Still open (needs Andrea / next session):**

1. Recharge flow still captures immediately (checkout) — the contract wants
   instant credit + collection at month end. Blocked on decision §7.5 (mandate
   guard) — switching without the mandate guard means credit with no way to collect.
2. Collections FE: wire the Retry button to `retry-charge`, show attempt counter
   vs MAX (4), grant-credit action in FAILED rows; split the 1965-line page.
3. The €1 mandate anchor (§7.3) — PayPal charges it monthly on its own; decide
   whether to show it on the invoice.
4. Mandate-revocation webhook (BILLING.SUBSCRIPTION.CANCELLED) → surface in
   Collections.
5. Sandbox PayPal credentials still `invalid_client` on Heroku;
   `PAYPAL_WEBHOOK_ID_LIVE` still missing.
6. BillingPage FE "Next monthly charge" still shows the old fee-only model.
7. PRD billing section not yet updated to this contract.
