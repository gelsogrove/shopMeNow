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
exports.usageService = void 0;
const database_1 = require("@echatbot/database");
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
exports.usageService = {
    /**
     * Track LLM usage - add 0.5 cents for each LLM response
     * This is called ONLY for registered users when LLM returns a message
     */
    trackUsage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                logger_1.default.info(`[USAGE-TRACKING] 💰 Adding usage record for workspace ${data.workspaceId}, client ${data.clientId}`);
                // Verify that the client (customer) exists and is registered
                const customer = yield database_1.prisma.customers.findUnique({
                    where: { id: data.clientId },
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        workspaceId: true,
                    },
                });
                if (!customer) {
                    logger_1.default.warn(`[USAGE-TRACKING] ❌ Customer ${data.clientId} not found - no usage tracked`);
                    return;
                }
                if (customer.workspaceId !== data.workspaceId) {
                    logger_1.default.warn(`[USAGE-TRACKING] ❌ Customer ${data.clientId} belongs to different workspace - no usage tracked`);
                    return;
                }
                // Create usage record with €0.005 cost per LLM or operator response (0.5 centesimi)
                yield database_1.prisma.usage.create({
                    data: {
                        workspaceId: data.workspaceId,
                        clientId: data.clientId,
                        price: data.price || config_1.config.llm.defaultPrice, // Default LLM price from configuration
                    },
                });
                logger_1.default.info(`[USAGE-TRACKING] ✅ Usage recorded: €${(_a = data.price) !== null && _a !== void 0 ? _a : config_1.config.llm.defaultPrice} for customer ${customer.name} (${customer.phone})`);
            }
            catch (error) {
                logger_1.default.error(`[USAGE-TRACKING] ❌ Error tracking usage:`, error);
                // Don't throw error to avoid disrupting the main LLM flow
            }
        });
    },
    /**
     * Get usage statistics for dashboard
     */
    getUsageStats(query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, startDate, endDate, clientId } = query;
                // Default to last 30 days if no date range provided
                const end = endDate || new Date();
                const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                logger_1.default.info(`[USAGE-STATS] 📊 Getting usage stats for workspace ${workspaceId} from ${start} to ${end}`);
                const whereClause = {
                    workspaceId,
                    createdAt: {
                        gte: start,
                        lte: end,
                    },
                };
                if (clientId) {
                    whereClause.clientId = clientId;
                }
                // Get all usage records for the period
                const usageRecords = yield database_1.prisma.usage.findMany({
                    where: whereClause,
                    include: {
                        customer: {
                            select: {
                                name: true,
                                phone: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                // Calculate total cost and messages
                const totalCost = usageRecords.reduce((sum, record) => sum + record.price, 0);
                const totalMessages = usageRecords.length;
                // Calculate daily usage
                const dailyUsageMap = new Map();
                usageRecords.forEach((record) => {
                    const dateKey = record.createdAt.toISOString().split("T")[0];
                    const existing = dailyUsageMap.get(dateKey) || { cost: 0, messages: 0 };
                    dailyUsageMap.set(dateKey, {
                        cost: existing.cost + record.price,
                        messages: existing.messages + 1,
                    });
                });
                const dailyUsage = Array.from(dailyUsageMap.entries())
                    .map(([date, data]) => (Object.assign({ date }, data)))
                    .sort((a, b) => a.date.localeCompare(b.date));
                // Calculate top clients
                const clientUsageMap = new Map();
                usageRecords.forEach((record) => {
                    const existing = clientUsageMap.get(record.clientId) || {
                        clientName: record.customer.name,
                        clientPhone: record.customer.phone,
                        cost: 0,
                        messages: 0,
                    };
                    clientUsageMap.set(record.clientId, Object.assign(Object.assign({}, existing), { cost: existing.cost + record.price, messages: existing.messages + 1 }));
                });
                const topClients = Array.from(clientUsageMap.entries())
                    .map(([clientId, data]) => (Object.assign({ clientId }, data)))
                    .sort((a, b) => b.cost - a.cost)
                    .slice(0, 10);
                // Calculate peak hours (0-23)
                const hourlyUsageMap = new Map();
                usageRecords.forEach((record) => {
                    const hour = record.createdAt.getHours();
                    const existing = hourlyUsageMap.get(hour) || { messages: 0, cost: 0 };
                    hourlyUsageMap.set(hour, {
                        messages: existing.messages + 1,
                        cost: existing.cost + record.price,
                    });
                });
                const peakHours = Array.from(hourlyUsageMap.entries())
                    .map(([hour, data]) => (Object.assign({ hour }, data)))
                    .sort((a, b) => b.messages - a.messages);
                // Calculate monthly comparison (current vs previous month)
                const now = new Date();
                const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                const [currentMonthUsage, previousMonthUsage] = yield Promise.all([
                    database_1.prisma.usage.aggregate({
                        where: {
                            workspaceId,
                            createdAt: {
                                gte: currentMonthStart,
                                lte: now,
                            },
                        },
                        _sum: { price: true },
                    }),
                    database_1.prisma.usage.aggregate({
                        where: {
                            workspaceId,
                            createdAt: {
                                gte: previousMonthStart,
                                lte: previousMonthEnd,
                            },
                        },
                        _sum: { price: true },
                    }),
                ]);
                const currentMonth = currentMonthUsage._sum.price || 0;
                const previousMonth = previousMonthUsage._sum.price || 0;
                const growth = previousMonth > 0
                    ? ((currentMonth - previousMonth) / previousMonth) * 100
                    : 0;
                const monthlyComparison = {
                    currentMonth,
                    previousMonth,
                    growth,
                };
                logger_1.default.info(`[USAGE-STATS] ✅ Stats calculated: €${totalCost.toFixed(4)} total, ${totalMessages} messages`);
                return {
                    totalCost,
                    totalMessages,
                    dailyUsage,
                    topClients,
                    peakHours,
                    monthlyComparison,
                };
            }
            catch (error) {
                logger_1.default.error(`[USAGE-STATS] ❌ Error getting usage stats:`, error);
                throw new Error(`Failed to get usage statistics: ${error.message}`);
            }
        });
    },
    /**
     * Get usage summary for a specific period
     */
    getUsageSummary(workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, days = 30) {
            try {
                const endDate = new Date();
                const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                const result = yield database_1.prisma.usage.aggregate({
                    where: {
                        workspaceId,
                        createdAt: {
                            gte: startDate,
                            lte: endDate,
                        },
                    },
                    _sum: { price: true },
                    _count: true,
                });
                const totalCost = result._sum.price || 0;
                const totalMessages = result._count || 0;
                const averageDailyCost = totalCost / days;
                const averageDailyMessages = totalMessages / days;
                return {
                    totalCost,
                    totalMessages,
                    averageDailyCost,
                    averageDailyMessages,
                };
            }
            catch (error) {
                logger_1.default.error(`[USAGE-SUMMARY] ❌ Error getting usage summary:`, error);
                throw new Error(`Failed to get usage summary: ${error.message}`);
            }
        });
    },
};
//# sourceMappingURL=usage.service.js.map