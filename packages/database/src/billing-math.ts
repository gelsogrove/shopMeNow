/**
 * SINGLE SOURCE OF TRUTH for every money calculation on invoices.
 *
 * Imported by apps/backend → invoice.service.ts (live DRAFT recalculation
 * shown in the UI) and month-end-billing.service.ts (month-end finalization
 * + PayPal collection — the wallet-deduction model was retired 2026-08-11).
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

