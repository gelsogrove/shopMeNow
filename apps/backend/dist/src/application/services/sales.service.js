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
exports.SalesService = void 0;
const sales_entity_1 = require("../../domain/entities/sales.entity");
const sales_repository_1 = require("../../repositories/sales.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service layer for Sales
 * Handles business logic for sales
 */
class SalesService {
    constructor() {
        this.salesRepository = new sales_repository_1.SalesRepository();
    }
    /**
     * Get all sales for a workspace
     */
    getAllForWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.salesRepository.findAll(workspaceId);
            }
            catch (error) {
                logger_1.default.error("Error getting all sales:", error);
                throw error;
            }
        });
    }
    /**
     * Get sales by ID
     */
    getById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.salesRepository.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error getting sales ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create a new sales
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate required fields
                if (!data.firstName ||
                    !data.lastName ||
                    !data.email ||
                    !data.workspaceId) {
                    throw new Error("Missing required fields");
                }
                // Create a sales entity for validation
                const salesToCreate = new sales_entity_1.Sales(data);
                // Validate the sales
                if (!salesToCreate.validate()) {
                    throw new Error("Invalid sales data");
                }
                // Check if a sales with the same email already exists
                const existingSales = yield this.salesRepository.findByEmail(salesToCreate.email, salesToCreate.workspaceId);
                if (existingSales) {
                    throw new Error("A salesperson with this email already exists");
                }
                // Create the sales
                return yield this.salesRepository.create(salesToCreate);
            }
            catch (error) {
                logger_1.default.error("Error creating sales:", error);
                throw error;
            }
        });
    }
    /**
     * Update a sales
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if sales exists
                const existingSales = yield this.salesRepository.findById(id, workspaceId);
                if (!existingSales) {
                    throw new Error("Salesperson not found");
                }
                // Create merged sales for validation
                const salesToUpdate = new sales_entity_1.Sales(Object.assign(Object.assign({}, existingSales), data));
                // If email is changed, check if it's unique
                if (data.email && data.email !== existingSales.email) {
                    const salesWithEmail = yield this.salesRepository.findByEmail(data.email, workspaceId);
                    if (salesWithEmail && salesWithEmail.id !== id) {
                        throw new Error("A salesperson with this email already exists");
                    }
                }
                // Update the sales
                return yield this.salesRepository.update(id, workspaceId, salesToUpdate);
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
                // Check if sales exists
                const sales = yield this.salesRepository.findById(id, workspaceId);
                if (!sales) {
                    throw new Error("Salesperson not found");
                }
                // Check if sales has customers
                const hasCustomers = yield this.salesRepository.hasCustomers(id, workspaceId);
                if (hasCustomers) {
                    throw new Error("Cannot delete salesperson that is assigned to customers");
                }
                // Delete the sales
                return yield this.salesRepository.delete(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error deleting sales ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Check if a sales has customers
     */
    hasCustomers(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.salesRepository.hasCustomers(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error checking if sales ${id} has customers:`, error);
                throw error;
            }
        });
    }
}
exports.SalesService = SalesService;
//# sourceMappingURL=sales.service.js.map