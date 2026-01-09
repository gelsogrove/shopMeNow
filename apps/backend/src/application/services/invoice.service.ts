/**
 * Invoice Service
 * Feature 197: Monthly Invoice Management
 * 
 * Handles creation, retrieval, and management of monthly invoices.
 * Invoices are per OWNER (User), not per Workspace (Feature 198).
 * 
 * Key responsibilities:
 * - Create/update draft invoice for current month
 * - Calculate consumption breakdown from BillingTransactions
 * - Finalize invoice at month end
 * - Generate invoice data for display
 */

import { prisma, InvoiceStatus, PlanType, TransactionType, SubscriptionStatus } from '@echatbot/database'
import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'
import logger from '../../utils/logger'

interface ConsumptionBreakdown {
  messages: { count: number; amount: number }
  orders: { count: number; amount: number }
  pushNotifications: { count: number; amount: number }
  adjustments: { count: number; amount: number }
  totalConsumption: number
}

interface CreditNoteData {
  id: string
  amount: number
  reason: string | null
  createdAt: Date
}

interface InvoiceData {
  id: string
  userId: string
  periodStart: Date
  periodEnd: Date
  periodMonth: number
  periodYear: number
  subscriptionAmount: number
  creditUsage: number
  creditDebt: number
  creditNotesTotal: number
  subtotalAmount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  status: InvoiceStatus
  paidAt: Date | null
  planType: PlanType
  itemsBreakdown: ConsumptionBreakdown
  creditNotes: CreditNoteData[]
  createdAt: Date
  updatedAt: Date
}

export class InvoiceService {
  private readonly TAX_RATE = 0.22

  private resolveLogoPath(): string | null {
    const candidates = [
      path.resolve(process.cwd(), 'apps/backend/public/logo.png'),
      path.resolve(process.cwd(), 'public/logo.png'),
    ]

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }

    return null
  }

  /**
   * Determine subscription fee for a billing period based on pause status.
   * - If paused before the period starts: no monthly fee.
   * - If paused within the period: charge full monthly fee.
   */
  private resolveSubscriptionAmount(
    subscriptionStatus: SubscriptionStatus | string,
    pausedAt: Date | null,
    periodStart: Date,
    monthlyFee: number
  ): number {
    if (subscriptionStatus !== "PAUSED") {
      return monthlyFee
    }

    if (!pausedAt) {
      return 0
    }

    return pausedAt <= periodStart ? 0 : monthlyFee
  }

  /**
   * Determine effective consumption window for paused users.
   * - If paused before period start: skip consumption.
   * - If paused within the period: cap consumption at pausedAt.
   */
  private resolveConsumptionEnd(
    subscriptionStatus: SubscriptionStatus | string,
    pausedAt: Date | null,
    periodStart: Date,
    periodEnd: Date
  ): Date | null {
    if (subscriptionStatus !== "PAUSED" || !pausedAt) {
      return periodEnd
    }

    if (pausedAt <= periodStart) {
      return null
    }

    return pausedAt < periodEnd ? pausedAt : periodEnd
  }

  /**
   * Get plan monthly fee from database (PlanConfiguration table)
   * NO HARDCODED VALUES - everything from database
   */
  private async getPlanMonthlyFee(planType: string): Promise<number> {
    const planConfig = await prisma.planConfiguration.findUnique({
      where: { planType: planType as any },
      select: { monthlyFee: true },
    })
    return planConfig ? Number(planConfig.monthlyFee) : 0
  }

  /**
   * Get or create the current month's draft invoice for an owner
   */
  async getOrCreateCurrentInvoice(userId: string): Promise<InvoiceData> {
    const now = new Date()
    const periodMonth = now.getMonth() + 1 // 1-12
    const periodYear = now.getFullYear()
    
    // Try to find existing invoice for this month
    let invoice = await prisma.monthlyInvoice.findUnique({
      where: {
        userId_periodYear_periodMonth: {
          userId,
          periodYear,
          periodMonth,
        },
      },
    })
    
    if (!invoice) {
      // Get user's plan type
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { planType: true, creditBalance: true, subscriptionStatus: true, pausedAt: true },
      })
      
      if (!user) {
        throw new Error('User not found')
      }
      
      // Get plan monthly fee from database (NO HARDCODED VALUES)
      const monthlyFee = await this.getPlanMonthlyFee(user.planType)
      const periodStart = new Date(periodYear, periodMonth - 1, 1, 0, 0, 0)
      const subscriptionAmount = this.resolveSubscriptionAmount(
        user.subscriptionStatus,
        user.pausedAt,
        periodStart,
        monthlyFee
      )
      
      // Calculate period dates
      const periodEnd = new Date(periodYear, periodMonth, 0, 23, 59, 59) // Last day of month
      
      // Create draft invoice
      invoice = await prisma.monthlyInvoice.create({
        data: {
          userId,
          periodStart,
          periodEnd,
          periodMonth,
          periodYear,
          subscriptionAmount,
          creditUsage: 0,
          creditDebt: 0,
          creditNotesTotal: 0,
          subtotalAmount: 0,
          taxRate: this.TAX_RATE,
          taxAmount: 0,
          totalAmount: subscriptionAmount,
          status: 'DRAFT',
          planType: user.planType,
          itemsBreakdown: {
            messages: { count: 0, amount: 0 },
            orders: { count: 0, amount: 0 },
            pushNotifications: { count: 0, amount: 0 },
            adjustments: { count: 0, amount: 0 },
            totalConsumption: 0,
          } as any, // Cast to any for Prisma JSON compatibility
        },
      })
      
      logger.info(`[Invoice] Created draft invoice for user ${userId} - ${periodMonth}/${periodYear}`)
    }
    
    const updatedInvoice = await this.recalculateInvoiceTotals(invoice.id)
    const creditNotes = await this.getCreditNotes(invoice.id)

    return this.mapToInvoiceData(updatedInvoice, creditNotes)
  }
  
  /**
   * Calculate consumption breakdown from BillingTransactions
   */
  async calculateConsumption(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ConsumptionBreakdown> {
    // Get all debit transactions for this period
    const transactions = await prisma.billingTransaction.findMany({
      where: {
        userId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        amount: { lt: 0 }, // Only debit transactions
      },
    })
    
    // Calculate breakdown by type
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
        // Skip other types like RECHARGE, MONTHLY_FEE, etc.
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
   * Get all invoices for an owner (paginated)
   */
  async getInvoicesForOwner(
    userId: string,
    page: number = 1,
    limit: number = 12
  ): Promise<{ invoices: InvoiceData[]; total: number }> {
    const skip = (page - 1) * limit
    
    const [invoices, total] = await Promise.all([
      prisma.monthlyInvoice.findMany({
        where: { userId },
        orderBy: [
          { periodYear: 'desc' },
          { periodMonth: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.monthlyInvoice.count({ where: { userId } }),
    ])
    
    return {
      invoices: invoices.map((invoice) => this.mapToInvoiceData(invoice)),
      total,
    }
  }
  
  /**
   * Get a specific invoice by ID
   */
  async getInvoiceById(invoiceId: string, userId: string): Promise<InvoiceData | null> {
    const invoice = await prisma.monthlyInvoice.findFirst({
      where: {
        id: invoiceId,
        userId, // Security: ensure owner owns this invoice
      },
    })
    
    if (!invoice) {
      return null
    }

    const creditNotes = await this.getCreditNotes(invoice.id)
    return this.mapToInvoiceData(invoice, creditNotes)
  }
  
  /**
   * Finalize invoice at month end (called by scheduler)
   * Changes status from DRAFT to PENDING
   */
  async finalizeInvoice(invoiceId: string): Promise<void> {
    const invoice = await prisma.monthlyInvoice.findUnique({
      where: { id: invoiceId },
    })

    if (!invoice) {
      throw new Error('Invoice not found')
    }

    if (invoice.status !== 'DRAFT') {
      logger.warn(`[Invoice] Attempted to finalize non-draft invoice ${invoiceId}`)
      return
    }

    const updatedInvoice = await this.recalculateInvoiceTotals(invoiceId)

    await prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: { status: 'PENDING' },
    })

    logger.info(`[Invoice] Finalized invoice ${invoiceId} - Total: €${updatedInvoice.totalAmount.toFixed(2)}`)
  }
  
  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(invoiceId: string, paypalTransactionId?: string): Promise<void> {
    await prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paypalTransactionId,
      },
    })
    
    logger.info(`[Invoice] Marked invoice ${invoiceId} as PAID`)
  }
  
  /**
   * Mark invoice as failed
   */
  async markInvoiceFailed(invoiceId: string): Promise<void> {
    await prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'FAILED',
      },
    })
    
    logger.info(`[Invoice] Marked invoice ${invoiceId} as FAILED`)
  }
  
  /**
   * Map Prisma model to InvoiceData interface
   */
  private mapToInvoiceData(invoice: any, creditNotes: CreditNoteData[] = []): InvoiceData {
    return {
      id: invoice.id,
      userId: invoice.userId,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      periodMonth: invoice.periodMonth,
      periodYear: invoice.periodYear,
      subscriptionAmount: Number(invoice.subscriptionAmount),
      creditUsage: Number(invoice.creditUsage),
      creditDebt: Number(invoice.creditDebt),
      creditNotesTotal: Number(invoice.creditNotesTotal ?? 0),
      subtotalAmount: Number(invoice.subtotalAmount ?? 0),
      taxRate: Number(invoice.taxRate ?? this.TAX_RATE),
      taxAmount: Number(invoice.taxAmount ?? 0),
      totalAmount: Number(invoice.totalAmount),
      status: invoice.status,
      paidAt: invoice.paidAt,
      planType: invoice.planType,
      itemsBreakdown: invoice.itemsBreakdown as ConsumptionBreakdown,
      creditNotes,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    }
  }

  private async getCreditNotes(invoiceId: string): Promise<CreditNoteData[]> {
    const notes = await prisma.invoiceCreditNote.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        reason: true,
        createdAt: true,
      },
    })

    return notes.map((note) => ({
      id: note.id,
      amount: Number(note.amount),
      reason: note.reason,
      createdAt: note.createdAt,
    }))
  }

  private async getRechargeTotal(userId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    const rechargeSum = await prisma.billingTransaction.aggregate({
      where: {
        userId,
        type: "RECHARGE",
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

  private async getTransactionTotal(userId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    const total = await prisma.billingTransaction.aggregate({
      where: {
        userId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        type: {
          not: "INVOICE_PAID",
        },
      },
      _sum: { amount: true },
    })
    return Number(total._sum.amount || 0)
  }

  async recalculateInvoiceTotals(invoiceId: string) {
    const invoice = await prisma.monthlyInvoice.findUnique({
      where: { id: invoiceId },
    })

    if (!invoice) {
      throw new Error('Invoice not found')
    }

    const user = await prisma.user.findUnique({
      where: { id: invoice.userId },
      select: { planType: true, creditBalance: true, subscriptionStatus: true, pausedAt: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const monthlyFee = await this.getPlanMonthlyFee(user.planType)
    const subscriptionAmount = this.resolveSubscriptionAmount(
      user.subscriptionStatus,
      user.pausedAt,
      invoice.periodStart,
      monthlyFee
    )
    const consumptionEnd = this.resolveConsumptionEnd(
      user.subscriptionStatus,
      user.pausedAt,
      invoice.periodStart,
      invoice.periodEnd
    )
    const consumption = consumptionEnd
      ? await this.calculateConsumption(
          invoice.userId,
          invoice.periodStart,
          consumptionEnd
        )
      : {
          messages: { count: 0, amount: 0 },
          orders: { count: 0, amount: 0 },
          pushNotifications: { count: 0, amount: 0 },
          adjustments: { count: 0, amount: 0 },
          totalConsumption: 0,
        }

    const creditDebt = Number(user.creditBalance) < 0 ? Math.abs(Number(user.creditBalance)) : 0
    const creditNotesTotal = await prisma.invoiceCreditNote.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    })
    const creditNotesAmount = Number(creditNotesTotal._sum.amount || 0)

    const subtotalAmount =
      Number(subscriptionAmount) + consumption.totalConsumption + creditDebt - creditNotesAmount
    const taxableBase = Math.max(subtotalAmount, 0)
    const taxAmount = taxableBase * this.TAX_RATE
    const totalAmount = subtotalAmount + taxAmount

    return prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: {
        subscriptionAmount,
        creditUsage: consumption.totalConsumption,
        creditDebt,
        creditNotesTotal: creditNotesAmount,
        subtotalAmount,
        taxRate: this.TAX_RATE,
        taxAmount,
        totalAmount,
        itemsBreakdown: consumption as any,
      },
    })
  }

  async generateInvoicePdf(invoiceId: string): Promise<Buffer> {
    await this.recalculateInvoiceTotals(invoiceId)

    const invoice = await prisma.monthlyInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            companyName: true,
            vatNumber: true,
            billingAddress: true,
            billingPhone: true,
          },
        },
      },
    })

    if (!invoice) {
      throw new Error('Invoice not found')
    }

    const creditNotes = await this.getCreditNotes(invoiceId)
    const planConfig = await prisma.planConfiguration.findUnique({
      where: { planType: invoice.planType },
      select: { displayName: true },
    })
    const planName = planConfig?.displayName || invoice.planType
    const rechargeTotal = await this.getRechargeTotal(
      invoice.userId,
      invoice.periodStart,
      invoice.periodEnd
    )
    const transactionTotal = await this.getTransactionTotal(
      invoice.userId,
      invoice.periodStart,
      invoice.periodEnd
    )
    const breakdown = (invoice.itemsBreakdown || {
      messages: { count: 0, amount: 0 },
      orders: { count: 0, amount: 0 },
      pushNotifications: { count: 0, amount: 0 },
      adjustments: { count: 0, amount: 0 },
      totalConsumption: 0,
    }) as ConsumptionBreakdown
    const logoPath = this.resolveLogoPath()

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const pageWidth = doc.page.width
      const margin = 50
      const contentWidth = pageWidth - margin * 2
      let yPos = margin

      if (logoPath) {
        try {
          doc.image(logoPath, margin, yPos, { width: 80, height: 80 })
        } catch (error) {
          logger.warn('[Invoice] Logo load failed', error)
        }
      }

      const rightX = pageWidth - margin - 220
      doc.fontSize(14).font('Helvetica-Bold').text('eChatbot', rightX, yPos, { width: 220, align: 'right' })
      yPos += 20
      doc.fontSize(9).font('Helvetica').text('eChatbot HQ', rightX, yPos, { width: 220, align: 'right' })
      yPos += 14
      doc.text('hello@echatbot.ai', rightX, yPos, { width: 220, align: 'right' })
      yPos += 30

      yPos = Math.max(yPos, margin + 100)
      doc.fontSize(22).font('Helvetica-Bold').text('INVOICE', margin, yPos, { align: 'center' })
      yPos += 40

      const invoiceNumber = `INV-${invoice.periodYear}${String(invoice.periodMonth).padStart(2, '0')}`
      doc.fontSize(10).font('Helvetica')
      doc.text('Invoice No: ', margin, yPos, { continued: true }).font('Helvetica-Bold').text(invoiceNumber)
      yPos += 14
      doc.font('Helvetica').text('Period: ', margin, yPos, { continued: true }).font('Helvetica-Bold').text(
        `${String(invoice.periodMonth).padStart(2, '0')}/${invoice.periodYear}`
      )
      yPos += 14
      doc.font('Helvetica').text('Status: ', margin, yPos, { continued: true }).font('Helvetica-Bold').text(invoice.status)
      yPos += 24

      doc.rect(margin, yPos, contentWidth, 80).fillAndStroke('#f8f9fa', '#e5e7eb')
      yPos += 12
      doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text('BILL TO', margin + 12, yPos)
      yPos += 18

      const customerName =
        invoice.user?.companyName ||
        `${invoice.user?.firstName || ''} ${invoice.user?.lastName || ''}`.trim() ||
        invoice.user?.email ||
        'Customer'
      doc.fontSize(10).font('Helvetica').text(customerName, margin + 12, yPos)
      yPos += 14
      if (invoice.user?.billingAddress) {
        doc.text(invoice.user.billingAddress, margin + 12, yPos)
        yPos += 14
      }
      if (invoice.user?.vatNumber) {
        doc.text(`VAT: ${invoice.user.vatNumber}`, margin + 12, yPos)
        yPos += 14
      }
      if (invoice.user?.billingPhone) {
        doc.text(`Phone: ${invoice.user.billingPhone}`, margin + 12, yPos)
        yPos += 14
      }

      yPos += 20
      doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text('DETAILS', margin, yPos)
      yPos += 18

      const addLine = (label: string, amount: number, isCredit = false) => {
        doc.fontSize(10).font('Helvetica').text(label, margin, yPos, { width: 340 })
        const formatted = `${isCredit ? '-' : ''}€${amount.toFixed(2)}`
        doc.font('Helvetica-Bold').text(formatted, pageWidth - margin - 100, yPos, {
          width: 100,
          align: 'right',
        })
        yPos += 16
      }

      addLine(`Subscription fee (${planName})`, Number(invoice.subscriptionAmount))
      addLine('Usage (messages, orders, pushes)', Number(invoice.creditUsage))
      if (Number(invoice.creditDebt) > 0) {
        addLine('Credit debt', Number(invoice.creditDebt))
      }
      creditNotes.forEach((note) => {
        addLine(`Credit note: ${note.reason || 'Adjustment'}`, note.amount, true)
      })

      yPos += 10
      doc.fontSize(10).font('Helvetica-Bold').text('USAGE BREAKDOWN', margin, yPos)
      yPos += 16
      addLine(`Messages (${breakdown.messages.count})`, breakdown.messages.amount)
      addLine(`Orders (${breakdown.orders.count})`, breakdown.orders.amount)
      addLine(`Push notifications (${breakdown.pushNotifications.count})`, breakdown.pushNotifications.amount)
      addLine(`Adjustments (${breakdown.adjustments.count})`, breakdown.adjustments.amount)
      addLine('Recharges (period)', rechargeTotal)
      addLine('Transactions total (period)', transactionTotal)

      yPos += 10
      doc.moveTo(margin, yPos).lineTo(pageWidth - margin, yPos).stroke('#e5e7eb')
      yPos += 12
      addLine('Subtotal', Number(invoice.subtotalAmount))
      addLine(`VAT (${(Number(invoice.taxRate) * 100).toFixed(0)}%)`, Number(invoice.taxAmount))
      yPos += 6
      doc.fontSize(12).font('Helvetica-Bold')
      doc.text('Total', margin, yPos)
      doc.text(`€${Number(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 100, yPos, {
        width: 100,
        align: 'right',
      })

      doc.end()
    })
  }
}

// Singleton instance
export const invoiceService = new InvoiceService()
