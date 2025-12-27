"use strict";
/**
 * Pricing Repository
 *
 * Single Source of Truth for all pricing configuration.
 * All BE/FE pricing queries go through this repository.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingRepository = void 0;
class PricingRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Get all active pricing configurations
     */
    getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.pricingConfig.findMany({
                where: { isActive: true },
                orderBy: [{ type: "asc" }, { key: "asc" }],
            });
        });
    }
    /**
     * Get all pricing configurations grouped by type
     * Returns: { plans: {...}, usage: {...}, thresholds: {...} }
     */
    getAllGrouped() {
        return __awaiter(this, void 0, void 0, function* () {
            const all = yield this.getAll();
            const grouped = {
                plans: {},
                usage: {},
                thresholds: {},
            };
            for (const config of all) {
                if (config.type === "PLAN") {
                    grouped.plans[config.key] = config.value;
                }
                else if (config.type === "USAGE") {
                    grouped.usage[config.key] = config.value;
                }
                else if (config.type === "THRESHOLD") {
                    grouped.thresholds[config.key] = config.value;
                }
            }
            return grouped;
        });
    }
    /**
     * Get pricing configurations by type
     */
    getByType(type) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.pricingConfig.findMany({
                where: { type, isActive: true },
                orderBy: { key: "asc" },
            });
        });
    }
    /**
     * Get a single pricing configuration by key
     */
    getByKey(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.pricingConfig.findUnique({
                where: { key },
            });
        });
    }
    /**
     * Get pricing value by key (convenience method)
     * Returns the value or null if not found
     */
    getValue(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = yield this.getByKey(key);
            return (config === null || config === void 0 ? void 0 : config.isActive) ? config.value : null;
        });
    }
    /**
     * Update pricing value by key
     * Note: This updates the current price. Historical billing records are unchanged.
     */
    updateValue(key, newValue) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.pricingConfig.update({
                where: { key },
                data: {
                    value: newValue,
                    updatedAt: new Date(),
                },
            });
        });
    }
    /**
     * Toggle active status of a pricing configuration
     */
    toggleActive(key, isActive) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.pricingConfig.update({
                where: { key },
                data: { isActive },
            });
        });
    }
    /**
     * Create a new pricing configuration
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.pricingConfig.create({
                data: {
                    type: data.type,
                    key: data.key,
                    value: data.value,
                    description: data.description,
                    isActive: true,
                },
            });
        });
    }
    /**
     * Delete a pricing configuration
     */
    delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.prisma.pricingConfig.delete({
                where: { key },
            });
        });
    }
}
exports.PricingRepository = PricingRepository;
//# sourceMappingURL=pricing.repository.js.map