# Billing Model — Credit Wallet (2026-08-11)

Single source of truth for how money moves in eChatbot. Decided by Andrea on
2026-08-11, replacing the previous split model (PayPal recurring subscription +
separate credit). **PayPal no longer collects the subscription** — it exists
only to top up credit.

## The model in one paragraph

Every owner (User) has ONE wallet: `users.creditBalance`, shared across all
their workspaces. Consumption (messages €/msg, orders, pushes, reminders —
prices from `plan_configurations`) is deducted from the wallet **live**,
operation by operation. The subscription fee (`plan_configurations.monthlyFee`
+ VAT at `users.taxRate`) is deducted from the wallet **once a month** by the
scheduler. The wallet MAY go negative ("in rosso"); below
`CREDIT_MIN_THRESHOLD` (**-€10**, `workspace-access.service.ts`) all the
owner's chatbots stop responding until they recharge. Recharges are one-off
PayPal payments that top up the wallet.

## One formula, everywhere

All invoice math lives in `packages/database/src/billing-math.ts` and
`billing-queries.ts`, imported by BOTH apps:

| Function | What | Used by |
|---|---|---|
| `computeInvoiceTotals(fee, adjustments, recharges, taxRate)` | subtotal + VAT + total of the monthly invoice | backend `invoice.service.ts` (live DRAFT) + scheduler (finalization) |
| `computeMonthlyCharge(fee, taxRate)` | fee + VAT on the fee = what is deducted from the wallet | scheduler |
| `calculateConsumptionBreakdown(db, …)` | per-type usage detail (messages/orders/pushes/adjustments) | both |
| `getRechargesTotal(db, …)` | recharges in the period — `type = RECHARGE` only, **BONUS is never invoiced** | both |

VAT is **per user**: `users.taxRate` (fraction, default 0.22), editable from
the backoffice (Clients → VAT chip next to the plan badge,
`PATCH /api/users/admin/:userId/tax-rate`). No hardcoded rate anywhere in the
platform-billing path.

## Month cycle

1. **During the month** — consumption debits the wallet live
   (`BillingTransaction`: MESSAGE / NEW_ORDER / PUSH_NOTIFICATION /
   APPOINTMENT_REMINDER). The backend keeps a DRAFT invoice for the current
   month, recalculated on every view (`recalculateInvoiceTotals`), so the app
   always shows the up-to-date "Next monthly charge".
2. **1st of the month, 00:05** — `apps/scheduler` `monthly-billing.job.ts`
   (not yet deployed; will run scheduled) for each ACTIVE owner:
   - applies pending plan changes (scheduled downgrades)
   - skips PAUSED and FREE_TRIAL owners (expired trials get paused)
   - deducts `computeMonthlyCharge(monthlyFee, taxRate)` from the wallet
     (negative allowed) and writes a MONTHLY_FEE transaction (visible in
     Transaction History)
   - finalizes the closed month's invoice as **PAID** with subscription, VAT,
     usage breakdown, recharges — archived, viewable and downloadable as PDF
   - sets `nextBillingDate`
3. **Invoice number** (`YYYY-NNNN`, `invoice_year_sequences`) is assigned
   lazily on first PDF download of a PAID invoice. Download filename is
   `invoice-<number>.pdf`.

## The invoice document (always English)

PDF (`invoice.service.ts → generateInvoicePdf`): FROM (PlatformConfig ISSUER_*
keys) / BILL TO, lines for Subscription fee, Recharges, Adjustments, Subtotal,
`VAT (nn%)`, Total, then an informational **USAGE PAID FROM CREDIT** section
(messages/orders/pushes with counts) and `Payment: deducted from prepaid
credit balance`. BONUS gift credits never appear.

## What each surface does

- **Frontend (owner app)**: sees credit, plan, live draft ("Next monthly
  charge"), Transaction History, past invoices + PDF, Recharge Credit
  (PayPal). Cannot change plan (removed 2026-08-11).
- **Backoffice (Andrea)**: Clients page — change plan, change VAT rate, bonus
  credit, extend trial; Collections — invoice archive.
- **Scheduler**: month-end charge + invoice finalization only.

## Known leftovers (decided separately, do not silently remove)

- The PayPal **recurring subscription** machinery (outstanding balance,
  "Process Payment" in Collections, PAYMENT_FAILED status, payment
  failure/reset endpoints, invoice statuses PENDING/FAILED) is obsolete under
  this model and pending cleanup with Andrea's approval.
- E-commerce ORDER documents (`order-optimization.service.ts`,
  `services/invoice/InvoiceService.ts`) still hardcode IVA 22% — that is the
  end-customer shop domain, not platform billing; needs its own per-workspace
  decision.
