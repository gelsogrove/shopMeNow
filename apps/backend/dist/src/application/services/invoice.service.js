"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceService = exports.InvoiceService = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../utils/logger"));
class InvoiceService {
    /**
     * Get plan monthly fee from database (PlanConfiguration table)
     * NO HARDCODED VALUES - everything from database
     */
    getPlanMonthlyFee(planType) {
        return __awaiter(this, void 0, void 0, function* () {
            const planConfig = yield database_1.prisma.planConfiguration.findUnique({
                where: { planType: planType },
                select: { monthlyFee: true },
            });
            return planConfig ? Number(planConfig.monthlyFee) : 0;
        });
    }
    /**
     * Get or create the current month's draft invoice for an owner
     */
    getOrCreateCurrentInvoice(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const periodMonth = now.getMonth() + 1; // 1-12
            const periodYear = now.getFullYear();
            // Try to find existing invoice for this month
            let invoice = yield database_1.prisma.monthlyInvoice.findUnique({
                where: {
                    userId_periodYear_periodMonth: {
                        userId,
                        periodYear,
                        periodMonth,
                    },
                },
            });
            if (!invoice) {
                // Get user's plan type
                const user = yield database_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: { planType: true, creditBalance: true },
                });
                if (!user) {
                    throw new Error('User not found');
                }
                // Get plan monthly fee from database (NO HARDCODED VALUES)
                const monthlyFee = yield this.getPlanMonthlyFee(user.planType);
                // Calculate period dates
                const periodStart = new Date(periodYear, periodMonth - 1, 1, 0, 0, 0);
                const periodEnd = new Date(periodYear, periodMonth, 0, 23, 59, 59); // Last day of month
                // Create draft invoice
                invoice = yield database_1.prisma.monthlyInvoice.create({
                    data: {
                        userId,
                        periodStart,
                        periodEnd,
                        periodMonth,
                        periodYear,
                        subscriptionAmount: monthlyFee,
                        creditUsage: 0,
                        creditDebt: 0,
                        totalAmount: monthlyFee,
                        status: 'DRAFT',
                        planType: user.planType,
                        itemsBreakdown: {
                            messages: { count: 0, amount: 0 },
                            orders: { count: 0, amount: 0 },
                            pushNotifications: { count: 0, amount: 0 },
                            adjustments: { count: 0, amount: 0 },
                            totalConsumption: 0,
                        }, // Cast to any for Prisma JSON compatibility
                    },
                });
                logger_1.default.info(`[Invoice] Created draft invoice for user ${userId} - ${periodMonth}/${periodYear}`);
            }
            // Calculate current consumption from transactions
            const consumption = yield this.calculateConsumption(userId, invoice.periodStart, invoice.periodEnd);
            // Update invoice with current consumption
            const updatedInvoice = yield database_1.prisma.monthlyInvoice.update({
                where: { id: invoice.id },
                data: {
                    creditUsage: consumption.totalConsumption,
                    itemsBreakdown: consumption, // Cast to any for Prisma JSON compatibility
                    totalAmount: Number(invoice.subscriptionAmount) + consumption.totalConsumption,
                },
            });
            return this.mapToInvoiceData(updatedInvoice);
        });
    }
    /**
     * Calculate consumption breakdown from BillingTransactions
     */
    calculateConsumption(userId, periodStart, periodEnd) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get all debit transactions for this period
            const transactions = yield database_1.prisma.billingTransaction.findMany({
                where: {
                    userId,
                    createdAt: {
                        gte: periodStart,
                        lte: periodEnd,
                    },
                    amount: { lt: 0 }, // Only debit transactions
                },
            });
            // Calculate breakdown by type
            const breakdown = {
                messages: { count: 0, amount: 0 },
                orders: { count: 0, amount: 0 },
                pushNotifications: { count: 0, amount: 0 },
                adjustments: { count: 0, amount: 0 },
                totalConsumption: 0,
            };
            for (const tx of transactions) {
                const amount = Math.abs(Number(tx.amount));
                switch (tx.type) {
                    case 'MESSAGE':
                        breakdown.messages.count++;
                        breakdown.messages.amount += amount;
                        break;
                    case 'NEW_ORDER':
                        breakdown.orders.count++;
                        breakdown.orders.amount += amount;
                        break;
                    case 'PUSH_NOTIFICATION':
                        breakdown.pushNotifications.count++;
                        breakdown.pushNotifications.amount += amount;
                        break;
                    case 'ADJUSTMENT':
                        breakdown.adjustments.count++;
                        breakdown.adjustments.amount += amount;
                        break;
                    // Skip other types like RECHARGE, MONTHLY_FEE, etc.
                }
            }
            breakdown.totalConsumption =
                breakdown.messages.amount +
                    breakdown.orders.amount +
                    breakdown.pushNotifications.amount +
                    breakdown.adjustments.amount;
            return breakdown;
        });
    }
    /**
     * Get all invoices for an owner (paginated)
     */
    getInvoicesForOwner(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 12) {
            const skip = (page - 1) * limit;
            const [invoices, total] = yield Promise.all([
                database_1.prisma.monthlyInvoice.findMany({
                    where: { userId },
                    orderBy: [
                        { periodYear: 'desc' },
                        { periodMonth: 'desc' },
                    ],
                    skip,
                    take: limit,
                }),
                database_1.prisma.monthlyInvoice.count({ where: { userId } }),
            ]);
            return {
                invoices: invoices.map(this.mapToInvoiceData),
                total,
            };
        });
    }
    /**
     * Get a specific invoice by ID
     */
    getInvoiceById(invoiceId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const invoice = yield database_1.prisma.monthlyInvoice.findFirst({
                where: {
                    id: invoiceId,
                    userId, // Security: ensure owner owns this invoice
                },
            });
            return invoice ? this.mapToInvoiceData(invoice) : null;
        });
    }
    /**
     * Finalize invoice at month end (called by scheduler)
     * Changes status from DRAFT to PENDING
     */
    finalizeInvoice(invoiceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const invoice = yield database_1.prisma.monthlyInvoice.findUnique({
                where: { id: invoiceId },
            });
            if (!invoice) {
                throw new Error('Invoice not found');
            }
            if (invoice.status !== 'DRAFT') {
                logger_1.default.warn(`[Invoice] Attempted to finalize non-draft invoice ${invoiceId}`);
                return;
            }
            // Recalculate final consumption
            const consumption = yield this.calculateConsumption(invoice.userId, invoice.periodStart, invoice.periodEnd);
            // Get user's credit debt (if negative balance)
            const user = yield database_1.prisma.user.findUnique({
                where: { id: invoice.userId },
                select: { creditBalance: true },
            });
            const creditDebt = user ? Math.max(0, -Number(user.creditBalance)) : 0;
            const totalAmount = Number(invoice.subscriptionAmount) + consumption.totalConsumption + creditDebt;
            yield database_1.prisma.monthlyInvoice.update({
                where: { id: invoiceId },
                data: {
                    creditUsage: consumption.totalConsumption,
                    creditDebt,
                    totalAmount,
                    itemsBreakdown: consumption, // Cast to any for Prisma JSON compatibility
                    status: 'PENDING',
                },
            });
            logger_1.default.info(`[Invoice] Finalized invoice ${invoiceId} - Total: €${totalAmount.toFixed(2)}`);
        });
    }
    /**
     * Mark invoice as paid
     */
    markInvoicePaid(invoiceId, paypalTransactionId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.prisma.monthlyInvoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'PAID',
                    paidAt: new Date(),
                    paypalTransactionId,
                },
            });
            logger_1.default.info(`[Invoice] Marked invoice ${invoiceId} as PAID`);
        });
    }
    /**
     * Mark invoice as failed
     */
    markInvoiceFailed(invoiceId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.prisma.monthlyInvoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'FAILED',
                },
            });
            logger_1.default.info(`[Invoice] Marked invoice ${invoiceId} as FAILED`);
        });
    }
    /**
     * Map Prisma model to InvoiceData interface
     */
    mapToInvoiceData(invoice) {
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
            totalAmount: Number(invoice.totalAmount),
            status: invoice.status,
            paidAt: invoice.paidAt,
            planType: invoice.planType,
            itemsBreakdown: invoice.itemsBreakdown,
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt,
        };
    }
}
exports.InvoiceService = InvoiceService;
// Singleton instance
exports.invoiceService = new InvoiceService();
//# sourceMappingURL=invoice.service.js.map