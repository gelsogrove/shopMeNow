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

import { prisma, InvoiceStatus, PlanType, TransactionType, SubscriptionStatus, computeInvoiceTotals, calculateConsumptionBreakdown, getRechargesTotal } from '@echatbot/database'
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
  // Format: YYYY-NNNN (e.g. 2026-0001). Sequence resets to 1 each year.
  private formatInvoiceNumber(year: number, sequence: number): string {
    return `${year}-${String(sequence).padStart(4, '0')}`
  }

  /**
   * Atomically increment and return the next invoice sequence for a given year.
   * Uses SELECT FOR UPDATE on invoice_year_sequences to prevent duplicate numbers
   * under concurrent load.
   */
  private async nextInvoiceSequence(tx: typeof prisma, year: number): Promise<number> {
    // Upsert the row for this year, then lock it and increment
    await tx.$executeRaw`
      INSERT INTO invoice_year_sequences (year, last_value)
      VALUES (${year}, 0)
      ON CONFLICT (year) DO NOTHING
    `
    const result = await tx.$queryRaw<{ last_value: number }[]>`
      UPDATE invoice_year_sequences
      SET last_value = last_value + 1
      WHERE year = ${year}
      RETURNING last_value
    `
    return result[0].last_value
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

      const year = issuedAt.getFullYear()
      const sequence = await this.nextInvoiceSequence(tx as typeof prisma, year)
      const invoiceNumber = this.formatInvoiceNumber(year, sequence)

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
    return this.getOrCreateInvoiceForPeriod(userId, now.getFullYear(), now.getMonth() + 1)
  }

  /**
   * Get or create the invoice for an arbitrary period.
   * Used by the month-end scheduler, which on the 1st bills the PREVIOUS
   * month — an owner who never opened the billing page during that month has
   * no DRAFT invoice yet, so it must be creatable after the period has ended.
   */
  async getOrCreateInvoiceForPeriod(
    userId: string,
    periodYear: number,
    periodMonth: number
  ): Promise<InvoiceData> {
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
        select: { planType: true, creditBalance: true, subscriptionStatus: true, pausedAt: true, taxRate: true },
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
          taxRate: Number(user.taxRate),
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
    return calculateConsumptionBreakdown(prisma, userId, periodStart, periodEnd)
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
      taxRate: Number(invoice.taxRate ?? 0),
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
    if (!(prisma as any).billingTransaction?.aggregate) {
      return 0 // partial prisma mock in unit tests
    }
    return getRechargesTotal(prisma, userId, periodStart, periodEnd)
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
      select: { planType: true, creditBalance: true, subscriptionStatus: true, pausedAt: true, taxRate: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // FIRST-INVOICE RULE (Andrea, 2026-08-11): the fee comes from the plan
    // snapshotted on the invoice at creation (invoice.planType), NOT from the
    // user's current plan. An owner who upgrades mid-month (incl. the
    // FREE_TRIAL → BASIC auto-upgrade on first recharge) is NOT charged the
    // fee retroactively for that partial month — the fee starts with the
    // first full month on the new plan.
    const monthlyFee = await this.getPlanMonthlyFee(invoice.planType)
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

    const userTaxRate = Number(user.taxRate)
    const { subtotalAmount, taxAmount, totalAmount } = computeInvoiceTotals(
      Number(subscriptionAmount),
      adjustmentsAmount,
      rechargesAmount,
      userTaxRate
    )

    return prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: {
        subscriptionAmount,
        creditUsage: consumption.totalConsumption,
        creditDebt,
        creditNotesTotal: creditNotesAmount,
        subtotalAmount,
        taxRate: userTaxRate,
        taxAmount,
        totalAmount,
        itemsBreakdown: consumption as any,
      },
    })
  }

  /**
   * Load issuer company data from PlatformConfig (TEXT type).
   * Keys: ISSUER_NAME, ISSUER_ADDRESS, ISSUER_VAT, ISSUER_EMAIL, ISSUER_PHONE.
   * Update these in the backoffice before going live — no redeploy needed.
   */
  private async getIssuerConfig(): Promise<{
    name: string
    address: string
    vat: string
    email: string
    phone: string
  }> {
    const keys = ['ISSUER_NAME', 'ISSUER_ADDRESS', 'ISSUER_VAT', 'ISSUER_EMAIL', 'ISSUER_PHONE']
    const rows = await prisma.platformConfig.findMany({
      where: { key: { in: keys }, isActive: true },
      select: { key: true, value: true },
    })
    const map = new Map(rows.map((r) => [r.key, r.value]))

    return {
      name:    map.get('ISSUER_NAME')    ?? 'eChatbot S.r.l.',
      address: map.get('ISSUER_ADDRESS') ?? '',
      vat:     map.get('ISSUER_VAT')     ?? '',
      email:   map.get('ISSUER_EMAIL')   ?? '',
      phone:   map.get('ISSUER_PHONE')   ?? '',
    }
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
    const issuer = await this.getIssuerConfig()

    // Pre-calculate recharge total before entering Promise constructor
    const rechargesTotal = await this.getRechargeTotal(
      invoice.userId,
      invoice.periodStart,
      invoice.periodEnd
    )

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const pageWidth = doc.page.width
      const margin = 50
      const contentWidth = pageWidth - margin * 2
      const rightEdge = pageWidth - margin

      const INK = '#0f172a'
      const MUTED = '#64748b'
      const FAINT = '#94a3b8'
      const ACCENT = '#16a34a'
      const ROW_ALT = '#f8fafc'
      const LINE = '#e2e8f0'

      const formatDate = (value: Date) => value.toLocaleDateString('en-GB')
      const formatEur = (amount: number, isCredit = false) =>
        `${isCredit ? '-' : ''}€${amount.toFixed(2)}`

      const invoiceNumber = invoice.invoiceNumber || 'DRAFT'
      const periodLabel = `${String(invoice.periodMonth).padStart(2, '0')}/${invoice.periodYear}`
      const periodRange = `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`

      // ── Header band ─────────────────────────────────────────────────────
      doc.rect(0, 0, pageWidth, 118).fill(INK)
      if (logoPath) {
        try {
          doc.image(logoPath, margin, 28, { width: 62, height: 62 })
        } catch (error) {
          logger.warn('[Invoice] Logo load failed', error)
        }
      }
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15)
      doc.text(issuer.name, logoPath ? margin + 76 : margin, 40)
      doc.fillColor(FAINT).font('Helvetica').fontSize(8.5)
      if (issuer.address) doc.text(issuer.address, logoPath ? margin + 76 : margin, 60)
      if (issuer.vat) doc.text(`VAT ${issuer.vat}`, logoPath ? margin + 76 : margin, 72)

      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(26)
      doc.text('INVOICE', rightEdge - 220, 34, { width: 220, align: 'right' })
      doc.fillColor('#4ade80').font('Helvetica-Bold').fontSize(12)
      doc.text(`No. ${invoiceNumber}`, rightEdge - 220, 66, { width: 220, align: 'right' })
      doc.fillColor(FAINT).font('Helvetica').fontSize(9)
      doc.text(`Period ${periodLabel}  ·  Issued ${formatDate(invoice.paidAt ?? invoice.createdAt)}`, rightEdge - 260, 84, { width: 260, align: 'right' })

      // Status pill
      const statusText = invoice.status
      const pillW = doc.widthOfString(statusText) + 22
      const pillX = rightEdge - pillW
      const pillColor = invoice.status === 'PAID' ? ACCENT : invoice.status === 'DRAFT' ? '#d97706' : MUTED
      doc.roundedRect(pillX, 98, pillW, 15, 7.5).fill(pillColor)
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
      doc.text(statusText, pillX, 102, { width: pillW, align: 'center' })

      let yPos = 142

      // ── FROM / BILL TO cards ────────────────────────────────────────────
      const customerName =
        invoice.user?.companyName ||
        `${invoice.user?.firstName || ''} ${invoice.user?.lastName || ''}`.trim() ||
        invoice.user?.email ||
        'Customer'

      const cardGap = 16
      const cardW = (contentWidth - cardGap) / 2
      const cardH = 92
      const leftX = margin
      const rightColX = margin + cardW + cardGap

      const drawParty = (x: number, title: string, lines: string[]) => {
        doc.roundedRect(x, yPos, cardW, cardH, 8).fill(ROW_ALT)
        doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8.5)
        doc.text(title, x + 14, yPos + 12)
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5)
        doc.text(lines[0] || '', x + 14, yPos + 26, { width: cardW - 28 })
        doc.fillColor(MUTED).font('Helvetica').fontSize(9)
        let ly = yPos + 42
        for (const line of lines.slice(1)) {
          if (!line) continue
          doc.text(line, x + 14, ly, { width: cardW - 28, height: 12, ellipsis: true })
          ly += 13
        }
      }

      drawParty(leftX, 'FROM', [
        issuer.name,
        issuer.address,
        issuer.vat ? `VAT ${issuer.vat}` : '',
        issuer.email,
        issuer.phone,
      ])
      drawParty(rightColX, 'BILL TO', [
        customerName,
        invoice.user?.billingAddress || '',
        invoice.user?.vatNumber ? `VAT ${invoice.user.vatNumber}` : '',
        invoice.user?.email || '',
        invoice.user?.billingPhone || '',
      ])

      yPos += cardH + 26

      // ── Charges table ───────────────────────────────────────────────────
      const amountColW = 110
      const rowH = 22

      const tableHeader = (title: string) => {
        doc.roundedRect(margin, yPos, contentWidth, rowH, 6).fill(INK)
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
        doc.text(title, margin + 14, yPos + 7)
        doc.text('AMOUNT', rightEdge - amountColW - 14, yPos + 7, { width: amountColW, align: 'right' })
        yPos += rowH
      }

      let rowIndex = 0
      const tableRow = (label: string, amount: number, isCredit = false) => {
        if (rowIndex % 2 === 1) {
          doc.rect(margin, yPos, contentWidth, rowH).fill(ROW_ALT)
        }
        doc.fillColor(INK).font('Helvetica').fontSize(9.5)
        doc.text(label, margin + 14, yPos + 7, { width: contentWidth - amountColW - 40 })
        doc.fillColor(isCredit ? ACCENT : INK)
        doc.text(formatEur(amount, isCredit), rightEdge - amountColW - 14, yPos + 7, {
          width: amountColW,
          align: 'right',
        })
        yPos += rowH
        rowIndex++
      }

      tableHeader('DESCRIPTION')
      tableRow(`Subscription fee — ${planName} plan (${periodLabel})`, Number(invoice.subscriptionAmount))
      if (Number(rechargesTotal) > 0) {
        tableRow('Credit recharges during the period', Number(rechargesTotal))
      }
      adjustments.forEach((adj) => {
        tableRow(`Adjustment — ${adj.reason || 'manual'}`, Math.abs(Number(adj.amount)), Number(adj.amount) < 0)
      })
      doc.moveTo(margin, yPos).lineTo(rightEdge, yPos).lineWidth(0.5).stroke(LINE)

      // ── Totals box (right aligned) ──────────────────────────────────────
      yPos += 14
      const totalsW = 230
      const totalsX = rightEdge - totalsW
      const totalLine = (label: string, value: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 9.5)
        doc.fillColor(bold ? INK : MUTED)
        doc.text(label, totalsX, yPos, { width: totalsW - amountColW, align: 'left' })
        doc.fillColor(bold ? ACCENT : INK)
        doc.text(value, totalsX + totalsW - amountColW, yPos, { width: amountColW, align: 'right' })
        yPos += bold ? 20 : 16
      }
      totalLine('Subtotal', formatEur(Number(invoice.subtotalAmount)))
      totalLine(`VAT (${(Number(invoice.taxRate) * 100).toFixed(0)}%)`, formatEur(Number(invoice.taxAmount)))
      doc.moveTo(totalsX, yPos + 1).lineTo(rightEdge, yPos + 1).lineWidth(1).stroke(INK)
      yPos += 8
      totalLine('TOTAL', formatEur(Number(invoice.totalAmount)), true)

      // ── Usage section (informational, already paid from credit) ─────────
      const breakdown = invoice.itemsBreakdown as unknown as ConsumptionBreakdown | null
      if (breakdown && Number(breakdown.totalConsumption) > 0) {
        yPos += 16
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(10)
        doc.text('Usage paid from credit', margin, yPos)
        doc.fillColor(FAINT).font('Helvetica').fontSize(8)
        doc.text('Already deducted from your prepaid balance during the period — not added to this invoice total.', margin, yPos + 14)
        yPos += 30
        rowIndex = 0
        const usageRow = (label: string, count: number, amount: number) => {
          if (count > 0) tableRow(`${label} (${count})`, amount)
        }
        usageRow('Messages', breakdown.messages.count, Number(breakdown.messages.amount))
        usageRow('Orders', breakdown.orders.count, Number(breakdown.orders.amount))
        usageRow('Push notifications', breakdown.pushNotifications.count, Number(breakdown.pushNotifications.amount))
        usageRow('Usage adjustments', breakdown.adjustments.count, Number(breakdown.adjustments.amount))
        doc.moveTo(margin, yPos).lineTo(rightEdge, yPos).lineWidth(0.5).stroke(LINE)
        yPos += 8
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5)
        doc.text('Total usage', margin + 14, yPos)
        doc.text(formatEur(Number(breakdown.totalConsumption)), rightEdge - amountColW - 14, yPos, {
          width: amountColW,
          align: 'right',
        })
        yPos += 24
      }

      // ── Footer ──────────────────────────────────────────────────────────
      const footerY = Math.max(yPos + 24, doc.page.height - 72)
      doc.moveTo(margin, footerY).lineTo(rightEdge, footerY).lineWidth(0.5).stroke(LINE)
      doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      const footerParts = [
        invoice.status === 'PAID' ? 'Payment: charged automatically via PayPal' : null,
        `Invoice covers ${periodRange}`,
        issuer.email || null,
      ].filter(Boolean)
      doc.text(footerParts.join('   ·   '), margin, footerY + 10, { width: contentWidth, align: 'center' })

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
    const issuer = await this.getIssuerConfig()
    const logoPath = this.resolveLogoPath()

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const formatDate = (value: Date) => value.toLocaleDateString('en-GB')
      const pageWidth = doc.page.width
      const margin = 50

      if (logoPath) {
        doc.image(logoPath, margin, 45, { width: 72, height: 72 })
      }

      const headerRightX = pageWidth - margin - 220
      doc.fontSize(18).font('Helvetica-Bold').text('Credit note', headerRightX, 50, { width: 220, align: 'right' })
      doc.fontSize(10).font('Helvetica').text(`Note ID: ${note.id}`, headerRightX, 74, { width: 220, align: 'right' })
      doc.text(`Issued: ${formatDate(note.createdAt)}`, headerRightX, 88, { width: 220, align: 'right' })

      let yPos = 130

      const customerName =
        invoice.user?.companyName ||
        `${invoice.user?.firstName || ''} ${invoice.user?.lastName || ''}`.trim() ||
        invoice.user?.email ||
        'Customer'

      doc.fontSize(11).font('Helvetica-Bold').text('BILL TO', margin, yPos)
      yPos += 16
      doc.fontSize(10).font('Helvetica').text(customerName, margin, yPos)
      yPos += 14
      if (invoice.user?.billingAddress) {
        doc.text(invoice.user.billingAddress, margin, yPos)
        yPos += 14
      }
      if (invoice.user?.vatNumber) {
        doc.text(`VAT: ${invoice.user.vatNumber}`, margin, yPos)
        yPos += 14
      }
      if (invoice.user?.billingPhone) {
        doc.text(`Phone: ${invoice.user.billingPhone}`, margin, yPos)
        yPos += 14
      }
      yPos += 6

      const issuerX = pageWidth - margin - 220
      doc.fontSize(11).font('Helvetica-Bold').text('ISSUER', issuerX, 130, { width: 220, align: 'right' })
      doc.fontSize(10).font('Helvetica').text(issuer.name, issuerX, 146, { width: 220, align: 'right' })
      if (issuer.address) doc.text(issuer.address, issuerX, 160, { width: 220, align: 'right' })
      if (issuer.vat)     doc.text(`VAT: ${issuer.vat}`, issuerX, 174, { width: 220, align: 'right' })
      if (issuer.email)   doc.text(`Email: ${issuer.email}`, issuerX, 188, { width: 220, align: 'right' })
      if (issuer.phone)   doc.text(`Phone: ${issuer.phone}`, issuerX, 202, { width: 220, align: 'right' })

      yPos += 10
      doc.fontSize(11).font('Helvetica-Bold').text('DETAILS', margin, yPos)
      yPos += 18

      const relatedInvoiceNumber = invoice.invoiceNumber || `${invoice.periodMonth}/${invoice.periodYear}`
      doc.fontSize(10).font('Helvetica').text(`Related invoice: ${relatedInvoiceNumber}`, margin, yPos)
      yPos += 16
      doc.text(`Reason: ${note.reason || 'Adjustment'}`, margin, yPos)
      yPos += 24

      doc.fontSize(12).font('Helvetica-Bold').text('Total credit', margin, yPos)
      doc.text(`-€${Number(note.amount).toFixed(2)}`, pageWidth - margin - 100, yPos, { width: 100, align: 'right' })

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
