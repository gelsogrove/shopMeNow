"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.CustomerService = void 0;
const customer_entity_1 = require("../../domain/entities/customer.entity");
const customer_repository_1 = require("../../repositories/customer.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
const database_1 = require("@echatbot/database");
/**
 * Service layer for Customer
 * Handles business logic for customers
 */
class CustomerService {
    constructor() {
        this.customerRepository = new customer_repository_1.CustomerRepository();
    }
    /**
     * Get all customers for a workspace
     */
    getAllForWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.customerRepository.findAll(workspaceId);
            }
            catch (error) {
                logger_1.default.error("Error getting all customers:", error);
                throw error;
            }
        });
    }
    /**
     * Get active customers for a workspace
     */
    getActiveForWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.customerRepository.findActive(workspaceId);
            }
            catch (error) {
                logger_1.default.error("Error getting active customers:", error);
                throw error;
            }
        });
    }
    /**
     * Get a customer by ID
     */
    getById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.customerRepository.findById(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error getting customer with id ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create a new customer
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate required fields
                if (!data.name || !data.email || !data.workspaceId) {
                    throw new Error("Name, email and workspace ID are required");
                }
                // Create a customer entity for validation
                const customerToCreate = new customer_entity_1.Customer(data);
                // Validate the customer
                if (!customerToCreate.validate()) {
                    throw new Error("Invalid customer data");
                }
                // Check if email is already in use
                const existingCustomerByEmail = yield this.customerRepository.findByEmail(data.email, data.workspaceId);
                if (existingCustomerByEmail) {
                    throw new Error("A customer with this email already exists");
                }
                // Check if phone is already in use (if provided)
                if (data.phone) {
                    const existingCustomerByPhone = yield this.customerRepository.findByPhone(data.phone, data.workspaceId);
                    if (existingCustomerByPhone) {
                        throw new Error("A customer with this phone number already exists");
                    }
                }
                // Create the customer
                return yield this.customerRepository.create(data);
            }
            catch (error) {
                logger_1.default.error("Error creating customer:", error);
                throw error;
            }
        });
    }
    /**
     * Update an existing customer
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Check if customer exists
                const existingCustomer = yield this.customerRepository.findById(id, workspaceId);
                if (!existingCustomer) {
                    throw new Error("Customer not found");
                }
                // Create merged customer for validation if name or email are being updated
                if (data.name !== undefined || data.email !== undefined) {
                    const customerToUpdate = new customer_entity_1.Customer(Object.assign(Object.assign({}, existingCustomer), { name: (_a = data.name) !== null && _a !== void 0 ? _a : existingCustomer.name, email: (_b = data.email) !== null && _b !== void 0 ? _b : existingCustomer.email, workspaceId: existingCustomer.workspaceId }));
                    // Validate the customer
                    if (!customerToUpdate.validate()) {
                        throw new Error("Invalid customer data");
                    }
                }
                // Check email uniqueness if it's being updated
                if (data.email && data.email !== existingCustomer.email) {
                    const customerWithEmail = yield this.customerRepository.findByEmail(data.email, workspaceId);
                    if (customerWithEmail && customerWithEmail.id !== id) {
                        throw new Error("Email is already in use by another customer");
                    }
                }
                // Check phone uniqueness if it's being updated
                if (data.phone && data.phone !== existingCustomer.phone) {
                    const customerWithPhone = yield this.customerRepository.findByPhone(data.phone, workspaceId);
                    if (customerWithPhone && customerWithPhone.id !== id) {
                        throw new Error("Phone number is already in use by another customer");
                    }
                }
                // Update the customer
                return yield this.customerRepository.update(id, workspaceId, data);
            }
            catch (error) {
                logger_1.default.error(`Error updating customer with id ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete a customer
     */
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if customer exists
                const customer = yield this.customerRepository.findById(id, workspaceId);
                if (!customer) {
                    throw new Error("Customer not found");
                }
                // Check if customer has related records
                const hasRelatedRecords = yield this.customerRepository.hasRelatedRecords(id);
                if (hasRelatedRecords) {
                    // Delete related records first
                    yield this.customerRepository.deleteRelatedRecords(id);
                }
                // Delete the customer
                return yield this.customerRepository.hardDelete(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error deleting customer with id ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Soft delete a customer (mark as inactive)
     */
    softDelete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if customer exists
                const customer = yield this.customerRepository.findById(id, workspaceId);
                if (!customer) {
                    throw new Error("Customer not found");
                }
                // Soft delete the customer
                return yield this.customerRepository.softDelete(id, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`Error soft-deleting customer with id ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Block a customer by setting isBlacklisted to true
     */
    blockCustomer(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if customer exists
                const customer = yield this.customerRepository.findById(id, workspaceId);
                if (!customer) {
                    throw new Error("Customer not found");
                }
                // Set isBlacklisted to true
                return yield this.customerRepository.update(id, workspaceId, {
                    isBlacklisted: true,
                });
            }
            catch (error) {
                logger_1.default.error(`Error blocking customer with id ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Unblock a customer by setting isBlacklisted to false
     * Also clears registration attempts to give the user a fresh start
     */
    unblockCustomer(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if customer exists
                const customer = yield this.customerRepository.findById(id, workspaceId);
                if (!customer) {
                    throw new Error("Customer not found");
                }
                // Set isBlacklisted to false
                const updatedCustomer = yield this.customerRepository.update(id, workspaceId, {
                    isBlacklisted: false,
                });
                // 🔄 RESET REGISTRATION ATTEMPTS - Clear attempts when unblocking
                try {
                    const { RegistrationAttemptsService } = yield Promise.resolve().then(() => __importStar(require("./registration-attempts.service")));
                    const registrationAttemptsService = new RegistrationAttemptsService(database_1.prisma);
                    yield registrationAttemptsService.clearAttempts(customer.phone, workspaceId);
                    logger_1.default.info(`[CUSTOMER_SERVICE] Cleared registration attempts for unblocked customer ${customer.phone} in workspace ${workspaceId}`);
                    yield database_1.prisma.$disconnect();
                }
                catch (clearError) {
                    logger_1.default.error(`[CUSTOMER_SERVICE] Error clearing registration attempts for customer ${customer.phone}:`, clearError);
                    // Don't fail the unblock operation if clearing attempts fails
                }
                return updatedCustomer;
            }
            catch (error) {
                logger_1.default.error(`Error unblocking customer with id ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Count unknown customers in a workspace
     */
    countUnknownCustomers(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.customerRepository.countByName("Unknown Customer", workspaceId);
            }
            catch (error) {
                logger_1.default.error("Error counting unknown customers:", error);
                throw error;
            }
        });
    }
}
exports.CustomerService = CustomerService;
// Export a singleton instance for backward compatibility
exports.default = new CustomerService();
//# sourceMappingURL=customer.service.js.map