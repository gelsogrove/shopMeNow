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
exports.CustomerRepository = void 0;
const customer_entity_1 = require("../domain/entities/customer.entity");
const prisma_1 = require("../lib/prisma");
const logger_1 = __importDefault(require("../utils/logger"));
const phone_normalizer_1 = require("../utils/phone-normalizer");
/**
 * Implementation of Customer Repository using Prisma
 */
class CustomerRepository {
    /**
     * Convert Prisma model to domain entity
     */
    toDomainEntity(customerData) {
        return new customer_entity_1.Customer({
            id: customerData.id,
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            address: customerData.address,
            company: customerData.company,
            discount: customerData.discount,
            language: customerData.language,
            currency: customerData.currency,
            notes: customerData.notes,
            serviceIds: customerData.serviceIds,
            isBlacklisted: customerData.isBlacklisted,
            isActive: customerData.isActive,
            workspaceId: customerData.workspaceId,
            last_privacy_version_accepted: customerData.last_privacy_version_accepted,
            privacy_accepted_at: customerData.privacy_accepted_at,
            push_notifications_consent: customerData.push_notifications_consent,
            push_notifications_consent_at: customerData.push_notifications_consent_at,
            createdAt: customerData.createdAt,
            updatedAt: customerData.updatedAt,
            activeChatbot: customerData.activeChatbot,
            invoiceAddress: customerData.invoiceAddress,
            salesId: customerData.salesId,
            feedbacks: customerData.feedbacks || [],
        });
    }
    /**
     * Find all customers in a workspace
     */
    findAll(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customers = yield prisma_1.prisma.customers.findMany({
                    where: { workspaceId },
                    orderBy: { createdAt: "desc" },
                });
                return customers
                    ? customers.map((customer) => this.toDomainEntity(customer))
                    : [];
            }
            catch (error) {
                logger_1.default.error("Error finding all customers:", error);
                return [];
            }
        });
    }
    /**
     * Find all active customers in a workspace
     */
    findActive(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customers = yield prisma_1.prisma.customers.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                    orderBy: { createdAt: "desc" },
                    include: {
                        feedbacks: {
                            orderBy: { createdAt: "desc" },
                            take: 1,
                        },
                    },
                });
                return customers
                    ? customers.map((customer) => this.toDomainEntity(customer))
                    : [];
            }
            catch (error) {
                logger_1.default.error("Error finding active customers:", error);
                return [];
            }
        });
    }
    /**
     * Find a single customer by ID and workspace
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customer = yield prisma_1.prisma.customers.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                });
                return customer ? this.toDomainEntity(customer) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding customer ${id}:`, error);
                return null;
            }
        });
    }
    /**
     * Find a customer by email
     */
    findByEmail(email, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customer = yield prisma_1.prisma.customers.findFirst({
                    where: {
                        email,
                        workspaceId,
                    },
                });
                return customer ? this.toDomainEntity(customer) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding customer by email ${email}:`, error);
                return null;
            }
        });
    }
    /**
     * Find a customer by phone
     */
    findByPhone(phone, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const normalizedPhone = (0, phone_normalizer_1.normalizePhone)(phone);
                // Try with normalized phone first
                let customer = yield prisma_1.prisma.customers.findFirst({
                    where: {
                        phone: normalizedPhone,
                        workspaceId,
                    },
                });
                // If not found and original differs, try original
                if (!customer && normalizedPhone !== phone) {
                    customer = yield prisma_1.prisma.customers.findFirst({
                        where: {
                            phone: phone,
                            workspaceId,
                        },
                    });
                }
                return customer ? this.toDomainEntity(customer) : null;
            }
            catch (error) {
                logger_1.default.error(`Error finding customer by phone ${phone}:`, error);
                return null;
            }
        });
    }
    /**
     * Create a new customer
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const normalizedPhone = data.phone ? (0, phone_normalizer_1.normalizePhone)(data.phone) : undefined;
                const customerData = {
                    name: data.name,
                    email: data.email,
                    phone: normalizedPhone,
                    address: data.address,
                    company: data.company,
                    discount: data.discount,
                    language: data.language,
                    currency: data.currency,
                    notes: data.notes,
                    serviceIds: data.serviceIds || [],
                    isBlacklisted: data.isBlacklisted || false,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    workspaceId: data.workspaceId,
                    last_privacy_version_accepted: data.last_privacy_version_accepted,
                    privacy_accepted_at: data.privacy_accepted_at,
                    push_notifications_consent: data.push_notifications_consent || false,
                    push_notifications_consent_at: data.push_notifications_consent_at,
                    activeChatbot: data.activeChatbot !== undefined ? data.activeChatbot : true,
                    invoiceAddress: data.invoiceAddress,
                };
                const customer = yield prisma_1.prisma.customers.create({
                    data: customerData,
                });
                return this.toDomainEntity(customer);
            }
            catch (error) {
                // P2002: Unique constraint violation (phone or email already exists)
                if (error.code === "P2002") {
                    logger_1.default.error(`CustomerRepository.create: Unique constraint violation for phone ${data.phone} or email ${data.email}`, error);
                    // Fetch the existing customer using normalized phone
                    const normalizedPhoneSearch = data.phone ? (0, phone_normalizer_1.normalizePhone)(data.phone) : undefined;
                    const existingCustomer = yield prisma_1.prisma.customers.findFirst({
                        where: {
                            OR: [
                                { phone: normalizedPhoneSearch, workspaceId: data.workspaceId },
                                { email: data.email, workspaceId: data.workspaceId },
                            ],
                        },
                    });
                    if (existingCustomer) {
                        logger_1.default.info(`CustomerRepository.create: ✅ Returning existing customer ${existingCustomer.id}`);
                        return this.toDomainEntity(existingCustomer);
                    }
                    // Should never reach here
                    logger_1.default.error("CustomerRepository.create: CRITICAL - Customer not found after P2002 error");
                    throw new Error("Numero di telefono o email già registrati nel sistema");
                }
                // Different error, rethrow
                logger_1.default.error("Error creating customer:", error);
                throw error;
            }
        });
    }
    /**
     * Update a customer record
     * @param id Customer ID
     * @param workspaceId Workspace ID
     * @param data Customer data to update
     * @returns Updated customer record
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Verify customer belongs to this workspace
                const existing = yield this.findById(id, workspaceId);
                if (!existing) {
                    return null;
                }
                // Manually map fields that can be updated, excluding workspaceId and id
                const updateData = {};
                if (data.name !== undefined)
                    updateData.name = data.name;
                if (data.email !== undefined)
                    updateData.email = data.email;
                if (data.phone !== undefined)
                    updateData.phone = (0, phone_normalizer_1.normalizePhone)(data.phone);
                if (data.address !== undefined)
                    updateData.address = data.address;
                if (data.company !== undefined)
                    updateData.company = data.company;
                if (data.discount !== undefined)
                    updateData.discount = data.discount;
                if (data.language !== undefined)
                    updateData.language = data.language;
                if (data.currency !== undefined)
                    updateData.currency = data.currency;
                if (data.notes !== undefined)
                    updateData.notes = data.notes;
                if (data.serviceIds !== undefined)
                    updateData.serviceIds = data.serviceIds;
                if (data.isBlacklisted !== undefined)
                    updateData.isBlacklisted = data.isBlacklisted;
                if (data.isActive !== undefined)
                    updateData.isActive = data.isActive;
                if (data.last_privacy_version_accepted !== undefined)
                    updateData.last_privacy_version_accepted =
                        data.last_privacy_version_accepted;
                if (data.privacy_accepted_at !== undefined)
                    updateData.privacy_accepted_at = data.privacy_accepted_at;
                if (data.push_notifications_consent !== undefined)
                    updateData.push_notifications_consent = data.push_notifications_consent;
                if (data.push_notifications_consent_at !== undefined)
                    updateData.push_notifications_consent_at =
                        data.push_notifications_consent_at;
                if (data.activeChatbot !== undefined)
                    updateData.activeChatbot = data.activeChatbot;
                if (data.invoiceAddress !== undefined)
                    updateData.invoiceAddress = data.invoiceAddress;
                if (data.salesId !== undefined)
                    updateData.salesId = data.salesId;
                // Debug log
                logger_1.default.info("=== REPOSITORY UPDATE DEBUG ===");
                logger_1.default.info("data.salesId:", data.salesId);
                logger_1.default.info("updateData.salesId:", updateData.salesId);
                logger_1.default.info("Full updateData:", updateData);
                logger_1.default.info("==============================");
                // Update the customer record
                const updatedCustomer = yield prisma_1.prisma.customers.update({
                    where: { id },
                    data: updateData,
                });
                logger_1.default.info("=== PRISMA UPDATE RESULT ===");
                logger_1.default.info("updatedCustomer.salesId:", updatedCustomer.salesId);
                logger_1.default.info("===========================");
                // Convert to domain entity
                return this.toDomainEntity(updatedCustomer);
            }
            catch (error) {
                logger_1.default.error(`Error updating customer ${id}:`, error);
                return null;
            }
        });
    }
    /**
     * Soft delete a customer (mark as inactive)
     */
    softDelete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma_1.prisma.customers.update({
                    where: {
                        id,
                        workspaceId,
                    },
                    data: {
                        isActive: false,
                    },
                });
                return true;
            }
            catch (error) {
                logger_1.default.error(`Error soft-deleting customer ${id}:`, error);
                return false;
            }
        });
    }
    /**
     * Hard delete a customer (remove from database)
     */
    hardDelete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // First check if the customer exists
                const customer = yield prisma_1.prisma.customers.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                });
                if (!customer) {
                    return false;
                }
                // Delete the customer
                yield prisma_1.prisma.customers.delete({
                    where: {
                        id,
                    },
                });
                return true;
            }
            catch (error) {
                logger_1.default.error(`Error hard-deleting customer ${id}:`, error);
                return false;
            }
        });
    }
    /**
     * Count customers with a specific name in a workspace
     */
    countByName(name, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield prisma_1.prisma.customers.count({
                    where: {
                        name,
                        workspaceId,
                        isActive: true,
                    },
                });
                return count;
            }
            catch (error) {
                logger_1.default.error(`Error counting customers with name ${name}:`, error);
                throw error;
            }
        });
    }
    /**
     * Check if customer has related records (orders, chat sessions)
     */
    hasRelatedRecords(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check for orders
                const ordersCount = yield prisma_1.prisma.orders.count({
                    where: { customerId: id },
                });
                // Check for chat sessions
                const chatSessionsCount = yield prisma_1.prisma.chatSession.count({
                    where: { customerId: id },
                });
                return ordersCount > 0 || chatSessionsCount > 0;
            }
            catch (error) {
                logger_1.default.error(`Error checking if customer ${id} has related records:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete related records before deleting the customer
     */
    deleteRelatedRecords(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Starting to delete related records for customer ${id}`);
                // Delete messages from chat sessions
                yield prisma_1.prisma.message.deleteMany({
                    where: {
                        chatSession: {
                            customerId: id,
                        },
                    },
                });
                // Delete chat sessions
                yield prisma_1.prisma.chatSession.deleteMany({
                    where: { customerId: id },
                });
                // Delete order items first (RESTRICT constraint on orderId)
                yield prisma_1.prisma.orderItems.deleteMany({
                    where: {
                        order: {
                            customerId: id,
                        },
                    },
                });
                // Delete credit notes (cascade from orders)
                yield prisma_1.prisma.creditNote.deleteMany({
                    where: {
                        order: {
                            customerId: id,
                        },
                    },
                });
                // Delete payment details (cascade from orders)
                yield prisma_1.prisma.paymentDetails.deleteMany({
                    where: {
                        order: {
                            customerId: id,
                        },
                    },
                });
                // Delete orders
                yield prisma_1.prisma.orders.deleteMany({
                    where: { customerId: id },
                });
                logger_1.default.info(`Successfully deleted all related records for customer ${id}`);
            }
            catch (error) {
                logger_1.default.error(`Error deleting related records for customer ${id}:`, error);
                throw error;
            }
        });
    }
}
exports.CustomerRepository = CustomerRepository;
//# sourceMappingURL=customer.repository.js.map