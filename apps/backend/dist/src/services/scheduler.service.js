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
exports.SchedulerService = void 0;
const database_1 = require("@echatbot/database");
const billing_service_1 = require("../application/services/billing.service");
const logger_1 = __importDefault(require("../utils/logger"));
const campaign_scheduler_service_1 = require("./campaign-scheduler.service");
class SchedulerService {
    constructor() {
        this.CHECK_INTERVAL = 5 * 60 * 1000; // 5 minuti
        this.URL_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 ora
        this.BILLING_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 ore
        this.ANALYTICS_CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 giorni (weekly cleanup)
        this.prisma = database_1.prisma;
        this.billingService = new billing_service_1.BillingService(this.prisma);
        this.campaignScheduler = new campaign_scheduler_service_1.CampaignScheduler(this.prisma);
    }
    /**
     * Aggiorna lo stato delle offerte scadute
     */
    updateExpiredOffers() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            try {
                // Trova e aggiorna tutte le offerte scadute che sono ancora attive
                const result = yield this.prisma.offers.updateMany({
                    where: {
                        isActive: true,
                        endDate: { lt: now },
                    },
                    data: {
                        isActive: false,
                    },
                });
                if (result.count > 0) {
                    logger_1.default.info(`Updated ${result.count} expired offers`);
                }
            }
            catch (error) {
                logger_1.default.error("Error updating expired offers:", error);
            }
        });
    }
    /**
     * Pulisce le URL scadute e vecchie
     */
    cleanupUrls() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 ora fa
                const result = yield this.prisma.shortUrls.deleteMany({
                    where: {
                        OR: [
                            // Elimina URL scadute
                            {
                                expiresAt: {
                                    lt: new Date(),
                                },
                            },
                            // Elimina URL più vecchie di 1 ora
                            {
                                createdAt: {
                                    lt: oneHourAgo,
                                },
                            },
                        ],
                    },
                });
                if (result.count > 0) {
                    logger_1.default.info(`🧹 Scheduled cleanup: removed ${result.count} old/expired short URLs`);
                }
            }
            catch (error) {
                logger_1.default.error("Error cleaning up URLs:", error);
            }
        });
    }
    /**
     * Verifica se è necessario addebitare il costo mensile del canale per i workspace attivi
     * L'addebito di €19 viene effettuato una volta al mese per ogni workspace
     */
    trackMonthlyChannelCost() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Ottiene tutti i workspace attivi (esclude soft-deleted)
                const workspaces = yield this.prisma.workspace.findMany({
                    where: {
                        isActive: true,
                        deletedAt: null, // Exclude soft-deleted workspaces from billing
                    },
                });
                const today = new Date();
                const currentMonth = today.getMonth();
                const currentYear = today.getFullYear();
                // Verifica se è già stato effettuato un addebito questo mese per ogni workspace
                for (const workspace of workspaces) {
                    // Controlla se esiste già un addebito per questo mese
                    const existingCharge = yield this.prisma.billing.findFirst({
                        where: {
                            workspaceId: workspace.id,
                            type: database_1.BillingType.MONTHLY_CHANNEL,
                            createdAt: {
                                gte: new Date(currentYear, currentMonth, 1),
                                lt: new Date(currentYear, currentMonth + 1, 1),
                            },
                        },
                    });
                    // Se non esiste un addebito per questo mese, effettua l'addebito
                    if (!existingCharge) {
                        yield this.billingService.chargeMonthlyChannelCost(workspace.id);
                        logger_1.default.info(`Monthly channel cost charged for workspace ${workspace.id}`);
                    }
                }
            }
            catch (error) {
                logger_1.default.error("Error tracking monthly channel cost:", error);
            }
        });
    }
    /**
     * 📊 Cleanup old product search analytics data (older than 6 months)
     *
     * Runs weekly to maintain database performance and comply with data retention policy.
     * Deletes ProductSearch records older than 6 months while maintaining workspace isolation.
     */
    cleanupOldAnalytics() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                const result = yield this.prisma.productSearch.deleteMany({
                    where: {
                        createdAt: {
                            lt: sixMonthsAgo,
                        },
                    },
                });
                if (result.count > 0) {
                    logger_1.default.info(`📊 Analytics cleanup: removed ${result.count} product search records older than 6 months`);
                }
                else {
                    logger_1.default.debug("📊 Analytics cleanup: no old records to remove");
                }
            }
            catch (error) {
                logger_1.default.error("❌ Error cleaning up old analytics data:", error);
            }
        });
    }
    /**
     * Inizia il processo di aggiornamento periodico
     */
    startScheduledTasks() {
        // Esegui immediatamente al primo avvio
        this.updateExpiredOffers();
        this.cleanupUrls();
        this.trackMonthlyChannelCost();
        this.cleanupOldAnalytics(); // 🆕 Cleanup analytics on startup
        // Imposta gli intervalli per le esecuzioni successive
        setInterval(() => {
            this.updateExpiredOffers();
        }, this.CHECK_INTERVAL);
        setInterval(() => {
            this.cleanupUrls();
        }, this.URL_CLEANUP_INTERVAL);
        // Verifica giornaliera per l'addebito mensile
        setInterval(() => {
            this.trackMonthlyChannelCost();
        }, this.BILLING_CHECK_INTERVAL);
        // 📊 Cleanup analytics settimanale (ogni 7 giorni)
        setInterval(() => {
            this.cleanupOldAnalytics();
        }, this.ANALYTICS_CLEANUP_INTERVAL);
        // Start campaign scheduler (runs daily at 10:00 AM)
        this.campaignScheduler.start();
        logger_1.default.info("Scheduler service started - managing offers, URLs cleanup, monthly billing, analytics cleanup (6 months), and campaign scheduler");
    }
}
exports.SchedulerService = SchedulerService;
//# sourceMappingURL=scheduler.service.js.map