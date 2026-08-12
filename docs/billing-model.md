# Billing Model — PayPal Collection (2026-08-11, revised 2026-08-12)

Single source of truth for how money moves in eChatbot. Decided by Andrea on
2026-08-11 (month-end PayPal collection) and revised on 2026-08-12
(on-account recharges, €1 anchor neutralized). Replaces both the recurring
per-plan PayPal subscription AND the pay-now recharge checkout.

## The model in one paragraph

Every owner (User) has ONE wallet: `users.creditBalance`, shared across all
their workspaces. Consumption (messages, orders, pushes — prices from
`plan_configurations`) is deducted from the wallet **live** and is therefore
informational on the invoice. Recharges are **on account**: the wallet is
credited immediately, no payment step. On the **1st of the month at 23:30
(Europe/Rome)** the backend scheduler bills the month that just ENDED: one
invoice per owner — subscription fee + recharges of the period + adjustments

- VAT (`users.taxRate`) — collected in **ONE PayPal capture** through the
  owner's mandate. The wallet MAY go negative ("in rosso"); below
  `CREDIT_MIN_THRESHOLD` (-€10, `workspace-access.service.ts`) all the owner's
  chatbots stop responding until they recharge.

## The PayPal mandate (€1 anchor, paid once)

PayPal refuses zero-priced subscription plans, so the mandate is opened
through a shared €1/month "anchor" plan (`eChatbot Monthly Anchor Plan`,
`paypal.routes.ts`). The €1 is the price of the signature, not of the
service:

- **At connect**: the owner approves the anchor subscription and pays €1 once.
- **Right after approval**: the callback revises THAT subscription's price to
  €0.00 (`paypal-anchor.service.ts`, best-effort — never blocks approval), so
  the €1 never recurs on the signature anniversary.
- **The shared PLAN keeps its €1**: new signups still need a priced plan.
- **Backfill**: mandates approved before 2026-08-12 are revised via
  `POST /api/users/admin/billing/zero-anchors` (admin, idempotent — already
  zeroed subscriptions are skipped).

Real collections never use the plan price: the charge writes the invoice
total into the subscription's `outstanding_balance` and captures it
(`paypal-invoice-charge.service.ts`, `PayPal-Request-Id` =
`<invoiceId>:attempt-<n>` for idempotency).

## Recharges — ON ACCOUNT (2026-08-12)

`POST /subscription-billing/recharge` (owner, JWT):

1. Deterministic guard: an approved PayPal mandate
   (`users.paypalSubscriptionId`) is required — 402 otherwise. Without it the
   month-end capture would have nothing to charge against.
2. €10–€1000 (validated in `rechargeOwnerCredit`, the single source).
3. The wallet is credited immediately (`BillingTransaction` type=RECHARGE);
   no money moves. If the balance was below -€10 the chatbots resume.
4. First recharge on FREE_TRIAL auto-upgrades to BASIC (existing rule).
5. The amount enters the month-end invoice and is collected on the 1st.

No exposure cap (Andrea, 2026-08-12): the owner can accumulate any on-account
amount; failed collections surface in the backoffice Collections page.

This replaces the pay-now checkout (Orders v2), removed 2026-08-12 because it
**double-charged**: the owner paid the checkout order AND the same RECHARGE
transaction re-entered the month-end invoice total via
`computeInvoiceTotals`.

## Month cycle

1. **During the month** — consumption debits the wallet live
   (`BillingTransaction`: MESSAGE / NEW_ORDER / PUSH_NOTIFICATION / …). The
   backend keeps a DRAFT invoice for the current month, recalculated on view
   (`recalculateInvoiceTotals`).
2. **1st of the month, 23:30 Europe/Rome** — `apps/backend/src/scheduler.ts`
   → `runMonthEndBilling` (manual trigger:
   `POST /api/users/admin/billing/run-month-end`), always billing the
   PREVIOUS month:
   - applies pending plan changes, pauses expired FREE_TRIALs
   - one invoice per owner: subscription fee (from the `invoice.planType`
     snapshot — the first PARTIAL month pays no fee) + recharges of the
     period + adjustments + VAT
   - the invoice is finalized and NUMBERED regardless of the payment outcome
   - ONE PayPal capture of the total. FAILED invoices surface in Collections:
     1 automatic attempt + 3 manual retries (`MAX_PAYMENT_ATTEMPTS` 4), then
     the operator decides — block, cancel, or grant credit (soft block,
     nothing automatic).
3. Idempotent & re-runnable: invoices unique per (userId, year, month),
   attempts claimed atomically — a re-run never double-charges.

## One formula, everywhere

All invoice math lives in `packages/database/src/billing-math.ts` and
`billing-queries.ts`, imported by backend services:

| Function                                                     | What                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `computeInvoiceTotals(fee, adjustments, recharges, taxRate)` | subtotal + VAT + total of the monthly invoice                                 |
| `getRechargesTotal(db, …)`                                   | recharges in the period — `type = RECHARGE` only, **BONUS is never invoiced** |
| `calculateConsumptionBreakdown(db, …)`                       | per-type usage detail (informational)                                         |

VAT is **per user**: `users.taxRate` (fraction, default 0.22), editable from
the backoffice. No hardcoded rate anywhere in the platform-billing path.

## The invoice document (always English)

PDF (`invoice.service.ts → generateInvoicePdf`): FROM (PlatformConfig
ISSUER\_\* keys) / BILL TO, lines for Subscription fee, Credit recharges during
the period, Adjustments, then Subtotal, `VAT (nn%)`, Total, then an
informational **Usage paid from credit** section. BONUS gift credits never
appear.

## What each surface does

- **Frontend (owner app)**: credit, plan, live draft, Transaction History,
  past invoices + PDF, Recharge Credit (on account — dialog states the amount
  is collected with the monthly invoice).
- **Backoffice (Andrea)**: Clients — plan, VAT, bonus credit, extend trial;
  Collections — invoice archive, retry-charge, run-month-end, zero-anchors.
- **Scheduler (backend web process)**: month-end run only.

## Known leftovers (decided separately, do not silently remove)

- E-commerce ORDER documents (`order-optimization.service.ts`,
  `services/invoice/InvoiceService.ts`) still hardcode IVA 22% — that is the
  end-customer shop domain, not platform billing; needs its own
  per-workspace decision.
