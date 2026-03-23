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
import { roundMoney } from '../../utils/money'

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

interface AdjustmentData {
  id: string
  amount: number
  reason: string | null
  createdAt: Date
}

interface InvoiceData {
  id: string
  userId: string
  invoiceNumber: string | null
  periodStart: Date
  periodEnd: Date
  periodMonth: number
  periodYear: number
  subscriptionAmount: number
  creditUsage: number
  creditDebt: number
  creditNotesTotal: number
  adjustmentsTotal: number
  subtotalAmount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  status: InvoiceStatus
  paidAt: Date | null
  planType: PlanType
  itemsBreakdown: ConsumptionBreakdown
  creditNotes: CreditNoteData[]
  adjustments: AdjustmentData[]
  createdAt: Date
  updatedAt: Date
}

export class InvoiceService {
  private readonly TAX_RATE = 0.22

  private formatInvoiceNumber(issuedAt: Date, sequence: number): string {
    const datePart = issuedAt.toISOString().slice(0, 10).replace(/-/g, '')
    return `${datePart}-${String(sequence).padStart(4, '0')}`
  }

  private async nextInvoiceSequence(tx: typeof prisma): Promise<number> {
    const result = await tx.$queryRaw<{ value: bigint }[]>`SELECT nextval('invoice_number_seq') AS value`
    const value = result?.[0]?.value ?? 0
    return Number(value)
  }

  async ensureInvoiceNumber(invoiceId: string, issuedAt: Date): Promise<string> {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        select: { invoiceNumber: true },
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      if (invoice.invoiceNumber) {
        return invoice.invoiceNumber
      }

      const sequence = await this.nextInvoiceSequence(tx as typeof prisma)
      const invoiceNumber = this.formatInvoiceNumber(issuedAt, sequence)

      const updated = await tx.monthlyInvoice.update({
        where: { id: invoiceId },
        data: { invoiceNumber },
      })

      return updated.invoiceNumber as string
    })
  }

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
    const [creditNotes, adjustments] = await Promise.all([
      this.getCreditNotes(invoice.id),
      this.getAdjustments(invoice.id),
    ])

    return this.mapToInvoiceData(updatedInvoice, creditNotes, adjustments)
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
        include: {
          creditNotes: {
            select: {
              id: true,
              amount: true,
              reason: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.monthlyInvoice.count({ where: { userId } }),
    ])

    return {
      invoices: invoices.map((invoice) =>
        this.mapToInvoiceData(
          invoice,
          (invoice.creditNotes || []).map((note) => ({
            id: note.id,
            amount: Number(note.amount),
            reason: note.reason ?? null,
            createdAt: note.createdAt,
          }))
        )
      ),
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

    const [creditNotes, adjustments] = await Promise.all([
      this.getCreditNotes(invoice.id),
      this.getAdjustments(invoice.id),
    ])
    return this.mapToInvoiceData(invoice, creditNotes, adjustments)
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
    const paidAt = new Date()

    await prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt,
        paypalTransactionId,
      },
    })

    await this.ensureInvoiceNumber(invoiceId, paidAt)
    
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
  private mapToInvoiceData(
    invoice: any,
    creditNotes: CreditNoteData[] = [],
    adjustments: AdjustmentData[] = []
  ): InvoiceData {
    const adjustmentsTotal = adjustments.reduce((sum, adj) => sum + Number(adj.amount), 0)
    return {
      id: invoice.id,
      userId: invoice.userId,
      invoiceNumber: invoice.invoiceNumber ?? null,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      periodMonth: invoice.periodMonth,
      periodYear: invoice.periodYear,
      subscriptionAmount: Number(invoice.subscriptionAmount),
      creditUsage: Number(invoice.creditUsage),
      creditDebt: Number(invoice.creditDebt),
      creditNotesTotal: Number(invoice.creditNotesTotal ?? 0),
      adjustmentsTotal,
      subtotalAmount: Number(invoice.subtotalAmount ?? 0),
      taxRate: Number(invoice.taxRate ?? this.TAX_RATE),
      taxAmount: Number(invoice.taxAmount ?? 0),
      totalAmount: Number(invoice.totalAmount),
      status: invoice.status,
      paidAt: invoice.paidAt,
      planType: invoice.planType,
      itemsBreakdown: invoice.itemsBreakdown as ConsumptionBreakdown,
      creditNotes,
      adjustments,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    }
  }

  private async getAdjustments(invoiceId: string): Promise<AdjustmentData[]> {
    const invoiceAdjustment = (prisma as any).invoiceAdjustment
    if (!invoiceAdjustment) {
      return []
    }

    let adjustments: Array<{
      id: string
      amount: number
      reason: string | null
      createdAt: Date
    }> = []
    try {
      adjustments = await invoiceAdjustment.findMany({
        where: { invoiceId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          reason: true,
          createdAt: true,
        },
      })
    } catch (error: any) {
      if (error?.code === 'P2021') {
        return []
      }
      throw error
    }

    return adjustments.map((adj) => ({
      id: adj.id,
      amount: Number(adj.amount),
      reason: adj.reason,
      createdAt: adj.createdAt,
    }))
  }

  private async getCreditNotes(invoiceId: string): Promise<CreditNoteData[]> {
    const invoiceCreditNote = (prisma as any).invoiceCreditNote
    if (!invoiceCreditNote) {
      return []
    }

    let notes: Array<{
      id: string
      amount: number
      reason: string | null
      createdAt: Date
    }> = []
    try {
      notes = await invoiceCreditNote.findMany({
        where: { invoiceId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          reason: true,
          createdAt: true,
        },
      })
    } catch (error: any) {
      if (error?.code === 'P2021') {
        return []
      }
      throw error
    }

    return notes.map((note) => ({
      id: note.id,
      amount: Number(note.amount),
      reason: note.reason,
      createdAt: note.createdAt,
    }))
  }

  private async getRechargeTotal(userId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    const billingTransaction = (prisma as any).billingTransaction
    if (!billingTransaction?.aggregate) {
      return 0
    }

    const rechargeSum = await billingTransaction.aggregate({
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
    const invoiceAdjustment = (prisma as any).invoiceAdjustment
    const invoiceCreditNote = (prisma as any).invoiceCreditNote
    const [creditNotesTotal, adjustmentsTotal, rechargeTotal] = await Promise.all([
      invoiceCreditNote?.aggregate
        ? invoiceCreditNote.aggregate({
            where: { invoiceId },
            _sum: { amount: true },
          }).catch((error: any) => {
            if (error?.code === 'P2021') {
              return { _sum: { amount: 0 } }
            }
            throw error
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      invoiceAdjustment
        ? invoiceAdjustment.aggregate({
            where: { invoiceId },
            _sum: { amount: true },
          }).catch((error: any) => {
            if (error?.code === 'P2021') {
              return { _sum: { amount: 0 } }
            }
            throw error
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      this.getRechargeTotal(invoice.userId, invoice.periodStart, invoice.periodEnd),
    ])
    const creditNotesAmount =
      invoice.status === "PAID" ? Number(creditNotesTotal._sum.amount || 0) : 0
    const adjustmentsAmount = Number(adjustmentsTotal._sum.amount || 0)
    const rechargesAmount = Number(rechargeTotal || 0)

    const subtotalRaw =
      Number(subscriptionAmount) +
      adjustmentsAmount +
      rechargesAmount
    const subtotalAmount = roundMoney(subtotalRaw)
    const taxableBase = Math.max(subtotalAmount, 0)
    const taxAmount = roundMoney(taxableBase * this.TAX_RATE)
    const totalAmount = roundMoney(subtotalAmount + taxAmount)

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

    let invoice = await prisma.monthlyInvoice.findUnique({
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

    if (invoice.status === 'PAID' && !invoice.invoiceNumber) {
      const issuedAt = invoice.paidAt ?? invoice.createdAt
      const assigned = await this.ensureInvoiceNumber(invoice.id, issuedAt)
      invoice = { ...invoice, invoiceNumber: assigned }
    }

    const [creditNotes, adjustments] = await Promise.all([
      this.getCreditNotes(invoiceId),
      this.getAdjustments(invoiceId),
    ])
    const planConfig = await prisma.planConfiguration.findUnique({
      where: { planType: invoice.planType },
      select: { displayName: true },
    })
    const planName = planConfig?.displayName || invoice.planType
    const logoPath = this.resolveLogoPath()
    
    // Pre-calculate recharge total before entering Promise constructor
    const rechargesTotal = await this.getRechargeTotal(
      invoice.userId,
      invoice.periodStart,
      invoice.periodEnd
    )

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const pageWidth = doc.page.width
      const margin = 50
      const contentWidth = pageWidth - margin * 2
      const issuer = {
        name: 'eChatbot S.r.l.',
        address: 'Via Roma 123, 00100 Roma, Italia',
        vat: 'IT12345678901',
        email: 'hello@echatbot.ai',
        phone: '+39 06 1234567',
      }
      const formatDate = (value: Date) => value.toLocaleDateString('it-IT')
      const invoiceNumber = invoice.invoiceNumber || 'UNASSIGNED'
      const periodLabel = `${String(invoice.periodMonth).padStart(2, '0')}/${invoice.periodYear}`
      const periodRange = `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
      let yPos = margin

      if (logoPath) {
        try {
          doc.image(logoPath, margin, yPos, { width: 72, height: 72 })
        } catch (error) {
          logger.warn('[Invoice] Logo load failed', error)
        }
      }

      const rightX = pageWidth - margin - 220
      doc.fontSize(18).font('Helvetica-Bold').text('Invoice', rightX, yPos, { width: 220, align: 'right' })
      yPos += 24
      doc.fontSize(10).font('Helvetica').text(`Invoice No: ${invoiceNumber}`, rightX, yPos, {
        width: 220,
        align: 'right',
      })
      yPos += 14
      doc.text(`Issued: ${formatDate(invoice.paidAt ?? invoice.createdAt)}`, rightX, yPos, {
        width: 220,
        align: 'right',
      })
      yPos += 14
      doc.text(`Period: ${periodLabel}`, rightX, yPos, { width: 220, align: 'right' })
      yPos += 14
      doc.text(`Status: ${invoice.status}`, rightX, yPos, { width: 220, align: 'right' })
      yPos += 26

      const customerName =
        invoice.user?.companyName ||
        `${invoice.user?.firstName || ''} ${invoice.user?.lastName || ''}`.trim() ||
        invoice.user?.email ||
        'Customer'
      const customerAddress = invoice.user?.billingAddress || 'Via Roma 123, 00100 Roma, Italia'
      const customerVat = invoice.user?.vatNumber || 'IT00000000000'
      const customerPhone = invoice.user?.billingPhone || '+39 06 0000000'

      const columnGap = 20
      const columnWidth = (contentWidth - columnGap) / 2
      const leftX = margin
      const rightColX = margin + columnWidth + columnGap

      const blockY = yPos
      doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text('FROM', leftX, blockY)
      doc.fontSize(10).font('Helvetica').text(issuer.name, leftX, blockY + 14)
      doc.text(issuer.address, leftX, blockY + 28)
      doc.text(`VAT: ${issuer.vat}`, leftX, blockY + 42)
      doc.text(`Email: ${issuer.email}`, leftX, blockY + 56)
      doc.text(`Phone: ${issuer.phone}`, leftX, blockY + 70)

      doc.fontSize(10).font('Helvetica-Bold').text('BILL TO', rightColX, blockY)
      doc.fontSize(10).font('Helvetica').text(customerName, rightColX, blockY + 14)
      doc.text(customerAddress, rightColX, blockY + 28, { width: columnWidth })
      doc.text(`VAT: ${customerVat}`, rightColX, blockY + 42)
      doc.text(`Phone: ${customerPhone}`, rightColX, blockY + 56)

      yPos = blockY + 100
      doc.moveTo(margin, yPos).lineTo(pageWidth - margin, yPos).stroke('#e5e7eb')
      yPos += 18
      doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text('DETAILS', margin, yPos)
      yPos += 18

      const lineGap = 18
      const addLine = (label: string, amount: number, isCredit = false) => {
        doc.fontSize(10).font('Helvetica').text(label, margin, yPos, { width: 340 })
        const formatted = `${isCredit ? '-' : ''}$${amount.toFixed(2)}`
        doc.font('Helvetica').text(formatted, pageWidth - margin - 100, yPos, {
          width: 100,
          align: 'right',
        })
        yPos += lineGap
        doc.moveTo(margin, yPos - 6).lineTo(pageWidth - margin, yPos - 6).stroke('#eef2f7')
      }

      addLine(`Subscription fee (${planName})`, Number(invoice.subscriptionAmount))
      if (Number(rechargesTotal) > 0) {
        addLine('Recharges', Number(rechargesTotal))
      }
      adjustments.forEach((adj) => {
        const label = `Adjustment: ${adj.reason || 'Manual adjustment'}`
        const isCredit = Number(adj.amount) < 0
        addLine(label, Math.abs(Number(adj.amount)), isCredit)
      })
      yPos += 10
      doc.moveTo(margin, yPos).lineTo(pageWidth - margin, yPos).stroke('#e5e7eb')
      yPos += 12
      addLine('Subtotal', Number(invoice.subtotalAmount))
      addLine(`Tax (${(Number(invoice.taxRate) * 100).toFixed(0)}%)`, Number(invoice.taxAmount))
      yPos += 6
      doc.fontSize(12).font('Helvetica-Bold')
      doc.text('Total', margin, yPos)
      doc.text(`$${Number(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 100, yPos, {
        width: 100,
        align: 'right',
      })
      yPos += 24
      doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      doc.text(`Invoice covers ${periodRange}`, margin, yPos)

      doc.end()
    })
  }

  async generateCreditNotePdf(noteId: string): Promise<Buffer> {
    const note = await prisma.invoiceCreditNote.findUnique({
      where: { id: noteId },
      include: {
        invoice: {
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
        },
      },
    })

    if (!note || !note.invoice) {
      throw new Error('Credit note not found')
    }

    const invoice = note.invoice

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const logoPath = this.resolveLogoPath()
      const issuer = {
        name: 'eChatbot S.r.l.',
        address: 'Via Roma 123, 00100 Roma, Italia',
        vat: 'IT12345678901',
        email: 'hello@echatbot.ai',
        phone: '+39 06 1234567',
      }
      const formatDate = (value: Date) => value.toLocaleDateString('it-IT')
      const pageWidth = doc.page.width
      const margin = 50

      if (logoPath) {
        doc.image(logoPath, margin, 45, { width: 72, height: 72 })
      }

      const headerRightX = pageWidth - margin - 220
      doc.fontSize(18).font('Helvetica-Bold').text('Credit note', headerRightX, 50, {
        width: 220,
        align: 'right',
      })
      doc.fontSize(10).font('Helvetica').text(`Note ID: ${note.id}`, headerRightX, 74, {
        width: 220,
        align: 'right',
      })
      doc.text(`Issued: ${formatDate(note.createdAt)}`, headerRightX, 88, {
        width: 220,
        align: 'right',
      })

      let yPos = 130

      doc.fontSize(11).font('Helvetica-Bold').text('BILL TO', margin, yPos)
      yPos += 16
      doc.fontSize(10).font('Helvetica').text(
        invoice.user?.companyName ||
          `${invoice.user?.firstName || ''} ${invoice.user?.lastName || ''}`.trim() ||
          invoice.user?.email ||
          'Customer',
        margin,
        yPos
      )
      yPos += 14
      const customerAddress = invoice.user?.billingAddress || 'Via Roma 123, 00100 Roma, Italia'
      const customerVat = invoice.user?.vatNumber || 'IT00000000000'
      const customerPhone = invoice.user?.billingPhone || '+39 06 0000000'
      doc.text(customerAddress, margin, yPos)
      yPos += 14
      doc.text(`VAT: ${customerVat}`, margin, yPos)
      yPos += 14
      doc.text(`Phone: ${customerPhone}`, margin, yPos)
      yPos += 20

      const issuerX = pageWidth - margin - 220
      doc.fontSize(11).font('Helvetica-Bold').text('ISSUER', issuerX, 130, { width: 220, align: 'right' })
      doc.fontSize(10).font('Helvetica').text(issuer.name, issuerX, 146, { width: 220, align: 'right' })
      doc.text(issuer.address, issuerX, 160, { width: 220, align: 'right' })
      doc.text(`VAT: ${issuer.vat}`, issuerX, 174, { width: 220, align: 'right' })
      doc.text(`Email: ${issuer.email}`, issuerX, 188, { width: 220, align: 'right' })
      doc.text(`Phone: ${issuer.phone}`, issuerX, 202, { width: 220, align: 'right' })

      yPos += 10
      doc.fontSize(11).font('Helvetica-Bold').text('DETAILS', margin, yPos)
      yPos += 18

      const relatedInvoiceNumber = invoice.invoiceNumber || `${invoice.periodMonth}/${invoice.periodYear}`
      doc.fontSize(10).font('Helvetica').text(
        `Related invoice: ${relatedInvoiceNumber}`,
        margin,
        yPos
      )
      yPos += 16
      doc.text(`Reason: ${note.reason || 'Adjustment'}`, margin, yPos)
      yPos += 24

      const formatted = `-$${Number(note.amount).toFixed(2)}`
      doc.fontSize(12).font('Helvetica-Bold').text('Total credit', margin, yPos)
      doc.text(formatted, pageWidth - margin - 100, yPos, { width: 100, align: 'right' })

      doc.end()
    })
  }

  /**
   * Delete an invoice by ID (Admin only)
   * Prisma schema handles cascading deletes for adjustments and credit notes.
   * PayPalTransaction relation is SetNull.
   */
  async deleteInvoice(invoiceId: string): Promise<void> {
    const invoice = await prisma.monthlyInvoice.findUnique({
      where: { id: invoiceId },
    })

    if (!invoice) {
        throw new Error('Invoice not found')
    }

    await prisma.monthlyInvoice.delete({
      where: { id: invoiceId },
    })

    logger.info(`[Invoice] Deleted invoice ${invoiceId} for user ${invoice.userId}`)
  }
}

// Singleton instance
export const invoiceService = new InvoiceService()
