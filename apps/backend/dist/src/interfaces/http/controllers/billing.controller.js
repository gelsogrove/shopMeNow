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
exports.BillingController = void 0;
const database_1 = require("@echatbot/database");
const billing_service_1 = require("../../../application/services/billing.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class BillingController {
    constructor() {
        this.prisma = database_1.prisma;
        this.billingService = new billing_service_1.BillingService(this.prisma);
    }
    /**
     * Get current billing totals for a workspace
     * GET /api/billing/:workspaceId/totals
     */
    getTotals(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { customerId } = req.query;
                if (!workspaceId) {
                    res.status(400).json({
                        success: false,
                        error: "Workspace ID is required",
                    });
                    return;
                }
                let currentTotal;
                if (customerId && typeof customerId === "string") {
                    // Get total for specific customer
                    currentTotal = yield this.billingService.getCurrentTotalForCustomer(workspaceId, customerId);
                }
                else {
                    // Get total for entire workspace
                    currentTotal = yield this.billingService.getCurrentTotal(workspaceId);
                }
                res.json({
                    success: true,
                    data: {
                        workspaceId,
                        customerId: customerId || null,
                        currentTotal: currentTotal.toFixed(2),
                        currency: "EUR",
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error getting billing totals:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get billing totals",
                });
            }
        });
    }
    /**
     * Get detailed billing summary for a workspace
     * GET /api/billing/:workspaceId/summary
     */
    getSummary(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                if (!workspaceId) {
                    res.status(400).json({
                        success: false,
                        error: "Workspace ID is required",
                    });
                    return;
                }
                const summary = yield this.billingService.getBillingSummary(workspaceId);
                res.json({
                    success: true,
                    data: Object.assign(Object.assign({ workspaceId }, summary), { currency: "EUR" }),
                });
            }
            catch (error) {
                logger_1.default.error("Error getting billing summary:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get billing summary",
                });
            }
        });
    }
    /**
     * Get billing history with simple format: current + new = total
     * GET /api/billing/:workspaceId/history
     */
    getHistory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { customerId, limit = 50 } = req.query;
                if (!workspaceId) {
                    res.status(400).json({
                        success: false,
                        error: "Workspace ID is required",
                    });
                    return;
                }
                const whereClause = { workspaceId };
                if (customerId) {
                    whereClause.customerId = customerId;
                }
                // Get all billing records
                const records = yield this.prisma.billing.findMany({
                    where: whereClause,
                    orderBy: { createdAt: "desc" },
                    take: parseInt(limit),
                    include: {
                        customer: {
                            select: {
                                name: true,
                                phone: true,
                            },
                        },
                    },
                });
                // Calculate running total
                let runningTotal = 0;
                const history = records.reverse().map((record) => {
                    const previousTotal = runningTotal;
                    const newCharge = record.amount;
                    runningTotal += newCharge;
                    return {
                        id: record.id,
                        date: record.createdAt,
                        type: record.type,
                        description: record.description,
                        customer: record.customer
                            ? {
                                name: record.customer.name,
                                phone: record.customer.phone,
                            }
                            : null,
                        // Simple format: previous + new = total
                        previousTotal: previousTotal.toFixed(2),
                        newCharge: newCharge.toFixed(2),
                        newTotal: runningTotal.toFixed(2),
                    };
                });
                res.json({
                    success: true,
                    data: {
                        workspaceId,
                        customerId: customerId || null,
                        history: history.reverse(), // Reverse back to show latest first
                        currentTotal: runningTotal.toFixed(2),
                        currency: "EUR",
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error getting billing history:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get billing history",
                });
            }
        });
    }
    /**
     * Get monthly billing breakdown for current month + 12 months history
     * GET /api/billing/:workspaceId/monthly
     */
    getMonthlyBreakdown(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                if (!workspaceId) {
                    res.status(400).json({
                        success: false,
                        error: "Workspace ID is required",
                    });
                    return;
                }
                logger_1.default.info(`[BILLING-CONTROLLER] 📊 Getting monthly breakdown for workspace ${workspaceId}`);
                const breakdown = yield this.billingService.getMonthlyBreakdown(workspaceId);
                res.json({
                    success: true,
                    data: {
                        workspaceId,
                        currentMonth: breakdown.currentMonth,
                        history: breakdown.history,
                        currency: "EUR",
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error getting monthly billing breakdown:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get monthly billing breakdown",
                });
            }
        });
    }
    /**
     * Get detailed billing records for a specific month
     * GET /api/billing/:workspaceId/monthly/:year/:month
     */
    getMonthDetail(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, year, month } = req.params;
                if (!workspaceId || !year || !month) {
                    res.status(400).json({
                        success: false,
                        error: "Workspace ID, year, and month are required",
                    });
                    return;
                }
                const yearNum = parseInt(year);
                const monthNum = parseInt(month);
                if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid year or month",
                    });
                    return;
                }
                logger_1.default.info(`[BILLING-CONTROLLER] 📋 Getting month detail for ${yearNum}-${monthNum} (workspace ${workspaceId})`);
                const details = yield this.billingService.getMonthDetail(workspaceId, yearNum, monthNum);
                res.json({
                    success: true,
                    data: {
                        workspaceId,
                        year: yearNum,
                        month: monthNum,
                        records: details,
                        currency: "EUR",
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error getting month detail:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get month detail",
                });
            }
        });
    }
}
exports.BillingController = BillingController;
//# sourceMappingURL=billing.controller.js.map