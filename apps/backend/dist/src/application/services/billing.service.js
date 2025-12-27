"use strict";
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
exports.BillingService = void 0;
const database_1 = require("@echatbot/database");
const pricing_repository_1 = require("../../repositories/pricing.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
class BillingService {
    constructor(prisma) {
        this.prisma = prisma;
        this.pricingRepository = new pricing_repository_1.PricingRepository(prisma);
    }
    /**
     * Charge the monthly channel cost on the first day of each month
     */
    chargeMonthlyChannelCost(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Get current price from database
                const monthlyChannelCost = (_a = (yield this.pricingRepository.getValue("MONTHLY_CHANNEL_COST"))) !== null && _a !== void 0 ? _a : 49;
                yield this.prisma.billing.create({
                    data: {
                        workspaceId,
                        amount: monthlyChannelCost,
                        type: database_1.BillingType.MONTHLY_CHANNEL,
                        description: "Monthly channel subscription cost",
                    },
                });
                logger_1.default.info(`Charged monthly channel cost for workspace ${workspaceId}`);
            }
            catch (error) {
                logger_1.default.error(`Failed to charge monthly channel cost for workspace ${workspaceId}`, error);
                throw error;
            }
        });
    }
    /**
     * Track message cost (€0.10) - used for all message interactions
     * This deducts from ALL workspace credits (shared across owner's channels)
     * AND records in billingTransactions for Transaction History
     */
    trackMessage(workspaceId_1, customerId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, customerId, description = "Message interaction", userQuery) {
            var _a;
            try {
                // Get current price from database (fallback to 0.10 for safety)
                const messageCost = (_a = (yield this.pricingRepository.getValue("MESSAGE"))) !== null && _a !== void 0 ? _a : 0.10;
                // Get current total for this customer (for legacy billing table)
                const previousTotal = yield this.getCurrentTotalForCustomer(workspaceId, customerId);
                const currentCharge = messageCost;
                const newTotal = previousTotal + currentCharge;
                // Get workspace and owner info before transaction
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { creditBalance: true, ownerId: true, name: true },
                });
                if (!workspace || !workspace.ownerId) {
                    // No workspace/owner, just create billing record for analytics
                    yield this.prisma.billing.create({
                        data: {
                            workspaceId,
                            customerId,
                            amount: currentCharge,
                            type: database_1.BillingType.MESSAGE,
                            description,
                            userQuery: userQuery || null,
                            previousTotal,
                            currentCharge,
                            newTotal,
                        },
                    });
                    logger_1.default.warn(`[BILLING] ⚠️ Workspace ${workspaceId} has no owner - billing record created but no credit deducted`);
                    return;
                }
                const newBalance = Number(workspace.creditBalance) - messageCost;
                // 🔒 TRANSACTION: Ensure billing, credit deduction, and transaction history are atomic
                // Prevents: credit not deducted but message sent, or inconsistent transaction history
                yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // 1️⃣ Write to legacy billing table (for Analytics)
                    yield tx.billing.create({
                        data: {
                            workspaceId,
                            customerId,
                            amount: currentCharge,
                            type: database_1.BillingType.MESSAGE,
                            description,
                            userQuery: userQuery || null,
                            previousTotal,
                            currentCharge,
                            newTotal,
                        },
                    });
                    // 2️⃣ Update owner's credit balance (shared across all workspaces)
                    yield tx.user.update({
                        where: { id: workspace.ownerId },
                        data: { creditBalance: newBalance },
                    });
                    // 3️⃣ Record in billingTransactions for Transaction History (with channel name)
                    yield tx.billingTransaction.create({
                        data: {
                            userId: workspace.ownerId,
                            workspaceId,
                            type: "MESSAGE",
                            amount: messageCost,
                            description: `WhatsApp message (${workspace.name})`,
                            balanceAfter: newBalance,
                        },
                    });
                }));
                logger_1.default.info(`[BILLING] 💰 Message: €${messageCost.toFixed(2)} deducted from all owner workspaces. New balance: €${newBalance.toFixed(2)}`);
            }
            catch (error) {
                logger_1.default.error(`Failed to charge message cost for workspace ${workspaceId}, customer ${customerId}`, error);
                throw error;
            }
        });
    }
    /**
     * Get billing summary for a workspace
     */
    getBillingSummary(workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, days = 30) {
            try {
                const since = new Date();
                since.setDate(since.getDate() - days);
                const billings = yield this.prisma.billing.findMany({
                    where: {
                        workspaceId,
                        createdAt: {
                            gte: since,
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                const totalCost = billings.reduce((sum, billing) => sum + billing.amount, 0);
                const billingByType = billings.reduce((acc, billing) => {
                    const type = billing.type;
                    if (!acc[type]) {
                        acc[type] = { count: 0, cost: 0 };
                    }
                    acc[type].count += 1;
                    acc[type].cost += billing.amount;
                    return acc;
                }, {});
                return {
                    totalCost,
                    billingByType,
                    recentBilling: billings.slice(0, 50), // Last 50 billing records
                };
            }
            catch (error) {
                logger_1.default.error(`Failed to get billing summary for workspace ${workspaceId}`, error);
                throw error;
            }
        });
    }
    /**
     * Get current total billing cost for a workspace
     */
    getCurrentTotal(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.prisma.billing.aggregate({
                    where: {
                        workspaceId,
                    },
                    _sum: {
                        amount: true,
                    },
                });
                return result._sum.amount
                    ? parseFloat(result._sum.amount.toString())
                    : 0.0;
            }
            catch (error) {
                logger_1.default.error(`Failed to get current total for workspace ${workspaceId}`, error);
                throw error;
            }
        });
    }
    /**
     * Get current total billing cost for a workspace and specific customer
     */
    getCurrentTotalForCustomer(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.prisma.billing.aggregate({
                    where: {
                        workspaceId,
                        customerId,
                    },
                    _sum: {
                        amount: true,
                    },
                });
                return result._sum.amount
                    ? parseFloat(result._sum.amount.toString())
                    : 0.0;
            }
            catch (error) {
                logger_1.default.error(`Failed to get current total for workspace ${workspaceId}, customer ${customerId}`, error);
                throw error;
            }
        });
    }
    /**
     * Get monthly billing breakdown for current month + ALL historical months
     * Returns data organized by calendar months with breakdown by type
     */
    getMonthlyBreakdown(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1; // 1-12
                logger_1.default.info(`[BILLING] 📊 Getting monthly breakdown for workspace ${workspaceId} (all history)`);
                // Get ALL billing records (no date limit)
                const billings = yield this.prisma.billing.findMany({
                    where: {
                        workspaceId,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                });
                logger_1.default.info(`[BILLING] Found ${billings.length} billing records for breakdown`);
                // Group by month
                const monthlyMap = new Map();
                billings.forEach((billing) => {
                    const date = new Date(billing.createdAt);
                    const year = date.getFullYear();
                    const month = date.getMonth() + 1; // 1-12
                    const key = `${year}-${month.toString().padStart(2, "0")}`;
                    if (!monthlyMap.has(key)) {
                        monthlyMap.set(key, {
                            year,
                            month,
                            total: 0,
                            byType: {},
                        });
                    }
                    const monthData = monthlyMap.get(key);
                    monthData.total += billing.amount;
                    const type = billing.type;
                    if (!monthData.byType[type]) {
                        monthData.byType[type] = { count: 0, cost: 0 };
                    }
                    monthData.byType[type].count += 1;
                    monthData.byType[type].cost += billing.amount;
                });
                // Get current month data
                const currentMonthKey = `${currentYear}-${currentMonth.toString().padStart(2, "0")}`;
                const currentMonthData = monthlyMap.get(currentMonthKey) || {
                    year: currentYear,
                    month: currentMonth,
                    total: 0,
                    byType: {},
                };
                // Get history (ALL complete months, excluding current, sorted by date DESC)
                const history = [];
                // Build history from all months in the map except current
                for (const [key, data] of monthlyMap.entries()) {
                    const [year, month] = key.split("-").map(Number);
                    // Skip current month
                    if (year === currentYear && month === currentMonth) {
                        continue;
                    }
                    history.push({
                        year: data.year,
                        month: data.month,
                        monthName: this.getMonthName(data.month),
                        total: data.total,
                        byType: data.byType,
                    });
                }
                // Sort history by date DESC (most recent first)
                history.sort((a, b) => {
                    if (a.year !== b.year)
                        return b.year - a.year;
                    return b.month - a.month;
                });
                logger_1.default.info(`[BILLING] 💰 Current month (${currentMonth}/${currentYear}): €${currentMonthData.total.toFixed(2)}`);
                logger_1.default.info(`[BILLING] 📋 History: ${history.length} months`);
                return {
                    currentMonth: {
                        year: currentMonthData.year,
                        month: currentMonthData.month,
                        monthName: this.getMonthName(currentMonthData.month),
                        total: currentMonthData.total,
                        byType: currentMonthData.byType,
                        isComplete: false, // Current month is never complete
                    },
                    history,
                };
            }
            catch (error) {
                logger_1.default.error(`Failed to get monthly breakdown for workspace ${workspaceId}`, error);
                throw error;
            }
        });
    }
    /**
     * Helper to get month name from month number (1-12)
     */
    getMonthName(month) {
        const months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        return months[month - 1];
    }
    /**
     * Get detailed billing records for a specific month
     */
    getMonthDetail(workspaceId, year, month) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Start and end of the month
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 1);
                logger_1.default.info(`[BILLING] 📋 Getting detail for ${year}-${month} (workspace ${workspaceId})`);
                const billings = yield this.prisma.billing.findMany({
                    where: {
                        workspaceId,
                        createdAt: {
                            gte: startDate,
                            lt: endDate,
                        },
                    },
                    include: {
                        customer: {
                            select: {
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                return billings.map((b) => {
                    var _a, _b;
                    return ({
                        id: b.id,
                        date: b.createdAt,
                        type: b.type,
                        amount: b.amount,
                        description: b.description || "",
                        customerName: ((_a = b.customer) === null || _a === void 0 ? void 0 : _a.name) || null,
                        customerEmail: ((_b = b.customer) === null || _b === void 0 ? void 0 : _b.email) || null,
                    });
                });
            }
            catch (error) {
                logger_1.default.error(`Failed to get month detail for workspace ${workspaceId}, ${year}-${month}`, error);
                throw error;
            }
        });
    }
}
exports.BillingService = BillingService;
//# sourceMappingURL=billing.service.js.map