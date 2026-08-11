/**
 * SINGLE SOURCE OF TRUTH for every money calculation on invoices.
 *
 * Imported by BOTH apps that touch invoices:
 *   - apps/backend  → invoice.service.ts (live DRAFT recalculation shown in UI)
 *   - apps/scheduler → monthly-billing.job.ts (month-end charge + finalization)
 *
 * The tax rate is NEVER hardcoded here: it always arrives as an argument,
 * read from users."taxRate" (per-owner, configurable from backoffice).
 * BONUS credits never enter these formulas: recharge totals must be
 * aggregated with type = RECHARGE only.
 */

export const roundMoney = (value: number): number =>
  Math.round(value * 100) / 100

export interface InvoiceTotals {
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
}

/**
 * Invoice totals for a billing period.
 * subtotal = subscription + admin adjustments + recharges made in the period.
 * VAT applies to the positive part of the subtotal only (credit notes can
 * push it below zero; tax is never negative).
 */
export const computeInvoiceTotals = (
  subscriptionAmount: number,
  adjustmentsAmount: number,
  rechargesAmount: number,
  taxRate: number
): InvoiceTotals => {
  const subtotalAmount = roundMoney(
    subscriptionAmount + adjustmentsAmount + rechargesAmount
  )
  const taxAmount = roundMoney(Math.max(subtotalAmount, 0) * taxRate)
  const totalAmount = roundMoney(subtotalAmount + taxAmount)
  return { subtotalAmount, taxAmount, totalAmount }
}

/**
 * The amount the scheduler deducts from the owner's credit at month end:
 * the subscription fee plus VAT on it. Consumption is NOT part of this —
 * it is already deducted from credit live, operation by operation.
 * Recharges are NOT part of this — they were paid when made.
 * The balance MAY go negative ("in rosso"): the deduction always happens.
 */
export const computeMonthlyCharge = (
  monthlyFee: number,
  taxRate: number
): { fee: number; taxAmount: number; chargeAmount: number } => {
  const fee = roundMoney(monthlyFee)
  const taxAmount = roundMoney(Math.max(fee, 0) * taxRate)
  const chargeAmount = roundMoney(fee + taxAmount)
  return { fee, taxAmount, chargeAmount }
}
