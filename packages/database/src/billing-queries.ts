/**
 * SINGLE SOURCE OF TRUTH for the DB aggregations that feed invoices.
 *
 * Same contract as billing-math.ts: imported by BOTH apps/backend
 * (invoice.service.ts) and apps/scheduler (monthly-billing.job.ts), so the
 * numbers on the live DRAFT invoice and on the month-end finalized invoice
 * can never diverge.
 *
 * Every function takes the Prisma client as an argument so each app passes
 * its own instance (and tests pass their mocks).
 */

import type { PrismaClient } from './generated/prisma/index.js'

export interface ConsumptionBreakdown {
  messages: { count: number; amount: number }
  orders: { count: number; amount: number }
  pushNotifications: { count: number; amount: number }
  adjustments: { count: number; amount: number }
  totalConsumption: number
}

/**
 * Debits actually charged to the owner's credit during the period,
 * broken down by operation type. RECHARGE/BONUS/MONTHLY_FEE are credits
 * or fees, not consumption — they are skipped by the switch.
 */
export async function calculateConsumptionBreakdown(
  db: PrismaClient,
  userId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ConsumptionBreakdown> {
  const transactions = await db.billingTransaction.findMany({
    where: {
      userId,
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      amount: { lt: 0 },
    },
  })

  const breakdown: ConsumptionBreakdown = {
    messages: { count: 0, amount: 0 },
    orders: { count: 0, amount: 0 },
    pushNotifications: { count: 0, amount: 0 },
    adjustments: { count: 0, amount: 0 },
    totalConsumption: 0,
  }

  for (const tx of transactions) {
    const amount = Math.abs(Number(tx.amount))

    switch (tx.type) {
      case 'MESSAGE':
        breakdown.messages.count++
        breakdown.messages.amount += amount
        break
      case 'NEW_ORDER':
        breakdown.orders.count++
        breakdown.orders.amount += amount
        break
      case 'PUSH_NOTIFICATION':
        breakdown.pushNotifications.count++
        breakdown.pushNotifications.amount += amount
        break
      case 'ADJUSTMENT':
        breakdown.adjustments.count++
        breakdown.adjustments.amount += amount
        break
    }
  }

  breakdown.totalConsumption =
    breakdown.messages.amount +
    breakdown.orders.amount +
    breakdown.pushNotifications.amount +
    breakdown.adjustments.amount

  return breakdown
}

/**
 * Money the owner paid in during the period via real recharges.
 * type = RECHARGE only: BONUS gift credits are NEVER invoiced.
 */
export async function getRechargesTotal(
  db: PrismaClient,
  userId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const rechargeSum = await db.billingTransaction.aggregate({
    where: {
      userId,
      type: 'RECHARGE',
      amount: { gt: 0 },
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    _sum: { amount: true },
  })
  return Number(rechargeSum._sum.amount || 0)
}
