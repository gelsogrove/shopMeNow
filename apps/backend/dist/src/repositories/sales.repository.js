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
exports.SalesRepository = void 0;
const sales_entity_1 = require("../domain/entities/sales.entity");
const prisma_1 = require("../lib/prisma");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Implementation of Sales Repository using Prisma
 */
class SalesRepository {
    /**
     * Find all sales in a workspace
     */
    findAll(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sales = yield prisma_1.prisma.sales.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                    orderBy: {
                        firstName: "asc",
                    },
                });
                return sales ? sales.map((sale) => new sales_entity_1.Sales(sale)) : [];
            }
            catch (error) {
                logger_1.default.error("Error finding sales:", error);
                return [];
            }
        });
    }
    /**
     * Find a single sales by ID and workspace
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sales = yield prisma_1.prisma.sales.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                });
                return sales ? new sales_entity_1.Sales(sales) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding sales ${id}:`, error);
                return null;
            }
        });
    }
    /**
     * Find a sales by email within a workspace
     */
    findByEmail(email, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sales = yield prisma_1.prisma.sales.findFirst({
                    where: {
                        email,
                        workspaceId,
                    },
                });
                return sales ? new sales_entity_1.Sales(sales) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding sales by email ${email}:`, error);
                return null;
            }
        });
    }
    /**
     * Create a new sales
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sales = yield prisma_1.prisma.sales.create({
                    data: data,
                });
                return new sales_entity_1.Sales(sales);
            }
            catch (error) {
                logger_1.default.error("Error creating sales:", error);
                throw error;
            }
        });
    }
    /**
     * Update an existing sales
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma_1.prisma.sales.updateMany({
                    where: {
                        id,
                        workspaceId,
                    },
                    data: data,
                });
                // Get updated sales
                return this.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error updating sales ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete a sales
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield prisma_1.prisma.sales.deleteMany({
                    where: {
                        id,
                        workspaceId,
                    },
                });
                return result && result.count > 0;
            }
            catch (error) {
                logger_1.default.error(`Error deleting sales ${id}:`, error);
                return false;
            }
        });
    }
    /**
     * Check if a sales has associated customers
     */
    hasCustomers(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customers = yield prisma_1.prisma.customers.findMany({
                    where: {
                        salesId: id,
                        workspaceId,
                    },
                    take: 1,
                });
                return customers.length > 0;
            }
            catch (error) {
                logger_1.default.error(`Error checking customers for sales ${id}:`, error);
                return false;
            }
        });
    }
}
exports.SalesRepository = SalesRepository;
//# sourceMappingURL=sales.repository.js.map