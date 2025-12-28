"use strict";
/**
 * Pricing Controller
 *
 * PUBLIC endpoint for pricing configuration.
 * No authentication required - pricing is public information.
 *
 * 💰 PRICING STRATEGY:
 * 1. Primary: Database pricing (dynamic, can be changed by admin)
 * 2. Fallback: BillingPrices enum (hardcoded defaults)
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
exports.PricingController = void 0;
const billing_prices_enum_1 = require("../../../domain/enums/billing-prices.enum");
const prisma_1 = require("../../../lib/prisma");
const pricing_repository_1 = require("../../../repositories/pricing.repository");
const logger_1 = __importDefault(require("../../../utils/logger"));
class PricingController {
    constructor() {
        this.pricingRepository = new pricing_repository_1.PricingRepository(prisma_1.prisma);
    }
    /**
     * @swagger
     * /api/pricing/config:
     *   get:
     *     summary: Get all pricing configuration
     *     description: Returns all active pricing (plans, usage costs, thresholds). Public endpoint - no auth required.
     *     tags: [Pricing]
     *     responses:
     *       200:
     *         description: Pricing configuration retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 plans:
     *                   type: object
     *                   description: Monthly subscription plans
     *                   example:
     *                     FREE_MONTHLY: 0
     *                     BASIC_MONTHLY: 29
     *                     PREMIUM_MONTHLY: 49
     *                     ENTERPRISE_MONTHLY: 149
     *                     MONTHLY_CHANNEL_COST: 59
     *                 usage:
     *                   type: object
     *                   description: Pay-per-use pricing
     *                   example:
     *                     MESSAGE: 0.15
     *                     NEW_ORDER: 1.50
     *                     PUSH_CAMPAIGN: 1.00
     *                 thresholds:
     *                   type: object
     *                   description: Free tier limits and plan restrictions
     *                   example:
     *                     FREE_MESSAGES: 200
     *                     FREE_PRODUCTS: 50
     *                     FREE_CLIENTS: 50
     *       500:
     *         description: Server error
     */
    getConfig(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("[PricingController] Fetching pricing configuration");
                // Try database first, fallback to enum
                const dbPricing = yield this.pricingRepository.getAllGrouped();
                const enumPricing = (0, billing_prices_enum_1.getAllBillingPrices)();
                // Merge: DB overrides enum (if DB has value, use it, otherwise use enum)
                const merged = {
                    plans: Object.assign({}, dbPricing.plans),
                    usage: Object.assign({}, dbPricing.usage),
                    thresholds: Object.assign({}, dbPricing.thresholds),
                };
                // Add enum values as fallback for missing DB entries
                for (const [key, value] of Object.entries(enumPricing)) {
                    if (key.includes("MONTHLY") || key.includes("PLAN")) {
                        if (!(key in merged.plans)) {
                            merged.plans[key] = value;
                        }
                    }
                    else {
                        if (!(key in merged.usage)) {
                            merged.usage[key] = value;
                        }
                    }
                }
                logger_1.default.info("[PricingController] Pricing configuration retrieved", {
                    planCount: Object.keys(merged.plans).length,
                    usageCount: Object.keys(merged.usage).length,
                    thresholdCount: Object.keys(merged.thresholds).length,
                    source: "DB + Enum fallback",
                });
                return res.status(200).json(merged);
            }
            catch (error) {
                logger_1.default.error("[PricingController] Failed to fetch pricing configuration:", error);
                return res.status(500).json({
                    error: "Failed to fetch pricing configuration",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * @swagger
     * /api/pricing/config/{key}:
     *   get:
     *     summary: Get specific pricing by key
     *     description: Returns a single pricing configuration by key
     *     tags: [Pricing]
     *     parameters:
     *       - in: path
     *         name: key
     *         required: true
     *         schema:
     *           type: string
     *         description: Pricing key (e.g., MESSAGE, BASIC_MONTHLY)
     *     responses:
     *       200:
     *         description: Pricing configuration found
     *       404:
     *         description: Pricing configuration not found
     *       500:
     *         description: Server error
     */
    getByKey(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { key } = req.params;
                logger_1.default.info(`[PricingController] Fetching pricing for key: ${key}`);
                const config = yield this.pricingRepository.getByKey(key);
                if (!config) {
                    return res.status(404).json({
                        error: "Pricing configuration not found",
                        key,
                    });
                }
                return res.status(200).json(config);
            }
            catch (error) {
                logger_1.default.error(`[PricingController] Failed to fetch pricing for key:`, error);
                return res.status(500).json({
                    error: "Failed to fetch pricing configuration",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
}
exports.PricingController = PricingController;
//# sourceMappingURL=pricing.controller.js.map