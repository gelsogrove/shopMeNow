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
exports.CustomersController = void 0;
const database_1 = require("@echatbot/database");
const billing_service_1 = require("../../../application/services/billing.service");
const customer_service_1 = require("../../../application/services/customer.service");
const push_messaging_service_1 = require("../../../services/push-messaging.service");
const websocket_service_1 = require("../../../services/websocket.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
// prisma imported
class CustomersController {
    constructor() {
        this.pushMessagingService = push_messaging_service_1.pushMessagingService;
        this.customerService = new customer_service_1.CustomerService();
        this.billingService = new billing_service_1.BillingService(database_1.prisma);
    }
    getCustomersForWorkspace(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const customers = yield this.customerService.getActiveForWorkspace(workspaceId);
                res.json({ data: customers });
            }
            catch (error) {
                logger_1.default.error("Error getting customers:", error);
                next(error);
            }
        });
    }
    getCustomerById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, workspaceId } = req.params;
                const customer = yield this.customerService.getById(id, workspaceId);
                if (!customer) {
                    return res.status(404).json({ message: "Customer not found" });
                }
                res.json(customer);
            }
            catch (error) {
                const id = req.params.id;
                logger_1.default.error(`Error getting customer ${id}:`, error);
                next(error);
            }
        });
    }
    createCustomer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { name, email, phone, address, company, discount, language, notes, serviceIds, isActive, last_privacy_version_accepted, push_notifications_consent, gdprConsent, pushNotificationsConsent, activeChatbot, isBlacklisted, invoiceAddress, salesId, } = req.body;
                const customerData = {
                    name,
                    email,
                    phone,
                    address,
                    company,
                    discount,
                    language,
                    notes,
                    serviceIds,
                    workspaceId,
                    isActive: isActive !== undefined ? isActive : true,
                    activeChatbot: activeChatbot !== undefined ? activeChatbot : true,
                    isBlacklisted: isBlacklisted !== undefined ? isBlacklisted : false,
                    last_privacy_version_accepted: gdprConsent
                        ? "v1.0"
                        : last_privacy_version_accepted,
                    push_notifications_consent: pushNotificationsConsent !== undefined
                        ? pushNotificationsConsent
                        : push_notifications_consent || false,
                    push_notifications_consent_at: pushNotificationsConsent || push_notifications_consent
                        ? new Date()
                        : undefined,
                    privacy_accepted_at: gdprConsent
                        ? new Date()
                        : last_privacy_version_accepted
                            ? new Date()
                            : undefined,
                    invoiceAddress,
                    salesId: salesId || undefined,
                };
                const customer = yield this.customerService.create(customerData);
                res.status(201).json(customer);
            }
            catch (error) {
                logger_1.default.error("Error creating customer:", error);
                if (error.message === "A customer with this email already exists" ||
                    error.message === "A customer with this phone number already exists" ||
                    error.message === "Invalid customer data") {
                    return res.status(400).json({ message: error.message });
                }
                next(error);
            }
        });
    }
    updateCustomer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, workspaceId } = req.params;
                logger_1.default.info("=== CONTROLLER RAW BODY ===");
                logger_1.default.info("typeof req.body:", typeof req.body);
                logger_1.default.info("req.body:", req.body);
                logger_1.default.info("req.body.salesId:", req.body.salesId);
                logger_1.default.info("'salesId' in req.body:", "salesId" in req.body);
                logger_1.default.info("Object.keys(req.body):", Object.keys(req.body));
                logger_1.default.info("===========================");
                const { name, email, phone, address, isActive, company, discount, language, notes, serviceIds, last_privacy_version_accepted, push_notifications_consent, gdprConsent, pushNotificationsConsent, activeChatbot, invoiceAddress, isBlacklisted, salesId, } = req.body;
                logger_1.default.info("=== AFTER DESTRUCTURING ===");
                logger_1.default.info("salesId variable:", salesId);
                logger_1.default.info("typeof salesId:", typeof salesId);
                logger_1.default.info("salesId === undefined:", salesId === undefined);
                logger_1.default.info("salesId === null:", salesId === null);
                logger_1.default.info("===========================");
                // Get original customer data to compare changes
                const originalCustomer = yield this.customerService.getById(id, workspaceId);
                if (!originalCustomer) {
                    return res.status(404).json({ message: "Customer not found" });
                }
                // Validate required fields if attempting to update them
                if (name !== undefined && (!name || name.trim() === "")) {
                    return res.status(400).json({ message: "Name is required" });
                }
                if (email !== undefined && (!email || email.trim() === "")) {
                    return res.status(400).json({ message: "Email is required" });
                }
                // If no valid update fields are provided, return 400
                if (Object.keys(req.body).length === 0) {
                    return res
                        .status(400)
                        .json({ message: "No valid update data provided" });
                }
                // Prepare update data with only defined values
                const customerData = {};
                if (name !== undefined)
                    customerData.name = name;
                if (email !== undefined)
                    customerData.email = email;
                if (phone !== undefined)
                    customerData.phone = phone;
                if (address !== undefined)
                    customerData.address = address;
                if (isActive !== undefined)
                    customerData.isActive = isActive;
                // 🔄 AUTO-ACTIVATE: If customer was inactive (temporary from new channel)
                // and is being updated with a valid name, activate them automatically
                // Note: Only require valid name - email can still be temporary
                if (originalCustomer.isActive === false &&
                    isActive === undefined &&
                    name !== undefined &&
                    name.trim() !== "" &&
                    name !== "New Customer") {
                    customerData.isActive = true;
                    logger_1.default.info(`Auto-activating customer ${id} - valid name provided`);
                }
                if (company !== undefined)
                    customerData.company = company;
                if (discount !== undefined)
                    customerData.discount = discount;
                if (language !== undefined)
                    customerData.language = language;
                if (notes !== undefined)
                    customerData.notes = notes;
                if (serviceIds !== undefined)
                    customerData.serviceIds = serviceIds;
                if (last_privacy_version_accepted !== undefined) {
                    customerData.last_privacy_version_accepted =
                        last_privacy_version_accepted;
                    customerData.privacy_accepted_at = new Date();
                }
                if (gdprConsent !== undefined) {
                    customerData.last_privacy_version_accepted = gdprConsent
                        ? "v1.0"
                        : undefined;
                    customerData.privacy_accepted_at = gdprConsent ? new Date() : undefined;
                }
                if (push_notifications_consent !== undefined) {
                    customerData.push_notifications_consent = push_notifications_consent;
                    if (push_notifications_consent) {
                        customerData.push_notifications_consent_at = new Date();
                    }
                }
                if (pushNotificationsConsent !== undefined) {
                    customerData.push_notifications_consent = pushNotificationsConsent;
                    if (pushNotificationsConsent) {
                        customerData.push_notifications_consent_at = new Date();
                    }
                }
                if (activeChatbot !== undefined)
                    customerData.activeChatbot = activeChatbot;
                if (invoiceAddress !== undefined)
                    customerData.invoiceAddress = invoiceAddress;
                if (isBlacklisted !== undefined)
                    customerData.isBlacklisted = isBlacklisted;
                if (salesId !== undefined)
                    customerData.salesId = salesId;
                logger_1.default.info("=== UPDATE CUSTOMER DEBUG ===");
                logger_1.default.info("salesId from req.body:", salesId);
                logger_1.default.info("salesId in customerData:", customerData.salesId);
                logger_1.default.info("Updating customer with data:", Object.assign({ id,
                    workspaceId }, customerData));
                logger_1.default.info("=============================");
                const updatedCustomer = yield this.customerService.update(id, workspaceId, customerData);
                // 🔔 CRITICAL: Notify WebSocket clients if customer blocked/unblocked
                if (isBlacklisted !== undefined &&
                    originalCustomer.isBlacklisted !== isBlacklisted) {
                    const eventName = isBlacklisted ? "user-blocked" : "user-unblocked";
                    websocket_service_1.websocketService.notifyUserBlocked(workspaceId, {
                        customerId: id,
                        customerName: updatedCustomer.name || "Unknown",
                        customerPhone: updatedCustomer.phone || "",
                        isBlacklisted: isBlacklisted,
                        timestamp: new Date().toISOString(),
                    });
                    logger_1.default.info(`[CUSTOMER-UPDATE] 🔔 WebSocket ${eventName} event sent for customer ${id}`);
                }
                // 🔔 Feature 127: Notify WebSocket clients if chatbot enabled/disabled
                if (activeChatbot !== undefined &&
                    originalCustomer.activeChatbot !== activeChatbot) {
                    // Emit chat-updated event to refresh customer list UI
                    websocket_service_1.websocketService.notifyChatUpdated(workspaceId, {
                        customerId: id,
                        customerName: updatedCustomer.name || "Unknown",
                        activeChatbot: activeChatbot,
                        timestamp: new Date().toISOString(),
                    });
                    logger_1.default.info(`[CUSTOMER-UPDATE] 🔔 WebSocket chat-updated event sent for customer ${id} (chatbot: ${activeChatbot})`);
                }
                // Handle automatic push messages for relevant changes
                yield this.handleAutomaticPushMessages(originalCustomer, updatedCustomer);
                res.json({ data: updatedCustomer });
            }
            catch (error) {
                logger_1.default.error("Error updating customer:", error);
                next(error);
            }
        });
    }
    /**
     * Handle automatic push messages when customer data changes
     *
     * 🚨 DISABLED: All notifications now handled via /push/system-notification
     *    with frontend confirmation popup (Feature 127)
     *    - Discount notifications: via popup confirmation
     *    - Chatbot reactivation: via popup confirmation
     *    - Account activation: via popup confirmation
     */
    handleAutomaticPushMessages(originalCustomer, updatedCustomer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if chatbot status changed - LOG ONLY (notification handled by frontend popup)
                if (originalCustomer.activeChatbot !== updatedCustomer.activeChatbot) {
                    logger_1.default.info(`Customer chatbot status changed from ${originalCustomer.activeChatbot} to ${updatedCustomer.activeChatbot}`, {
                        customerId: updatedCustomer.id,
                        workspaceId: updatedCustomer.workspaceId,
                    });
                    // 🚨 DISABLED: Push notification now handled by frontend confirmation popup
                    // The frontend will show a dialog asking admin if they want to notify the customer
                    // If confirmed, it calls POST /push/system-notification with CHATBOT_REACTIVATED type
                    if (!originalCustomer.activeChatbot && updatedCustomer.activeChatbot) {
                        logger_1.default.info(`[PUSH-DISABLED] Chatbot reactivation for customer ${updatedCustomer.id} - notification handled by frontend popup`);
                    }
                }
            }
            catch (error) {
                logger_1.default.error("Error handling automatic push messages:", error);
                // Don't throw error - automatic push failures shouldn't break customer update
            }
        });
    }
    deleteCustomer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, workspaceId } = req.params;
                logger_1.default.info("Starting customer deletion process:", { id, workspaceId });
                try {
                    const success = yield this.customerService.delete(id, workspaceId);
                    if (!success) {
                        return res.status(404).json({ message: "Customer not found" });
                    }
                    logger_1.default.info("Customer deletion completed successfully");
                    return res.status(204).send();
                }
                catch (error) {
                    if (error.message === "Customer not found") {
                        return res.status(404).json({ message: "Customer not found" });
                    }
                    throw error;
                }
            }
            catch (error) {
                logger_1.default.error("Error deleting customer:", error);
                // Send a more detailed error response
                res.status(500).json({
                    message: "Failed to delete customer",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Block a customer (set isBlacklisted to true)
     */
    blockCustomer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, workspaceId } = req.params;
                // Rileva se si tratta dell'endpoint alternativo con 'bloc'
                const isAlternativeEndpoint = req.originalUrl.includes("/bloc") && !req.originalUrl.includes("/block");
                logger_1.default.info("⛔ Blocking customer API call received:", {
                    id,
                    workspaceId,
                    originalUrl: req.originalUrl,
                    method: req.method,
                    path: req.path,
                    params: req.params,
                    route: req.route,
                    isAlternativeEndpoint,
                });
                try {
                    const customer = yield this.customerService.blockCustomer(id, workspaceId);
                    logger_1.default.info("Customer blocked successfully");
                    return res.status(200).json({
                        message: "Customer blocked successfully",
                        customer,
                    });
                }
                catch (error) {
                    if (error.message === "Customer not found") {
                        return res.status(404).json({ message: "Customer not found" });
                    }
                    throw error;
                }
            }
            catch (error) {
                logger_1.default.error("Error blocking customer:", error);
                next(error);
            }
        });
    }
    /**
     * Unblock a customer (set isBlacklisted to false)
     */
    unblockCustomer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, workspaceId } = req.params;
                logger_1.default.info("✅ Unblocking customer API call received:", {
                    id,
                    workspaceId,
                    originalUrl: req.originalUrl,
                    method: req.method,
                    path: req.path,
                    params: req.params,
                    route: req.route,
                });
                try {
                    const customer = yield this.customerService.unblockCustomer(id, workspaceId);
                    // Note: NEW_CUSTOMER billing (€1.00) is now tracked at registration time
                    // not when admin unblocks, since new users are no longer blocked by default
                    logger_1.default.info("Customer unblocked successfully");
                    return res.status(200).json({
                        message: "Customer unblocked successfully",
                        customer,
                    });
                }
                catch (error) {
                    if (error.message === "Customer not found") {
                        return res.status(404).json({ message: "Customer not found" });
                    }
                    throw error;
                }
            }
            catch (error) {
                logger_1.default.error("Error unblocking customer:", error);
                next(error);
            }
        });
    }
    /**
     * 🗑️ Delete a registration attempt (blocked unregistered user)
     */
    deleteRegistrationAttempt(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, attemptId } = req.params;
                logger_1.default.info(`🗑️ Deleting registration attempt: ${attemptId} in workspace: ${workspaceId}`);
                // Verify the attempt exists and belongs to this workspace
                const attempt = yield database_1.prisma.registrationAttempts.findFirst({
                    where: {
                        id: attemptId,
                        workspaceId,
                    },
                });
                if (!attempt) {
                    return res.status(404).json({
                        success: false,
                        error: "Registration attempt not found",
                    });
                }
                // Delete the attempt
                yield database_1.prisma.registrationAttempts.delete({
                    where: { id: attemptId },
                });
                logger_1.default.info(`✅ Registration attempt deleted: ${attemptId}`);
                return res.json({
                    success: true,
                    message: "Registration attempt deleted successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Error deleting registration attempt:", error);
                next(error);
            }
        });
    }
    /**
     * Count all "Unknown Customer" records in a workspace
     */
    countUnknownCustomers(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const count = yield this.customerService.countUnknownCustomers(workspaceId);
                res.json({ count });
            }
            catch (error) {
                logger_1.default.error("Error counting unknown customers:", error);
                next(error);
            }
        });
    }
    /**
     * TASK 3: Operator Control Release Mechanism
     *
     * Endpoint specifico per gestire il controllo del chatbot.
     * Permette agli operatori di rilasciare/riprendere il controllo AI.
     *
     * PUT /api/workspaces/:workspaceId/customers/:customerId/chatbot-control
     * Body: { activeChatbot: boolean, reason?: string }
     */
    updateChatbotControl(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            try {
                const { customerId, workspaceId } = req.params;
                const { activeChatbot, reason } = req.body;
                // Validazione input
                if (typeof activeChatbot !== "boolean") {
                    return res.status(400).json({
                        message: "activeChatbot must be a boolean value",
                    });
                }
                logger_1.default.info(`[TASK3] CHATBOT_CONTROL_CHANGE_REQUEST: customer-${customerId} activeChatbot=${activeChatbot} in workspace-${workspaceId}`, {
                    customerId,
                    workspaceId,
                    activeChatbot,
                    reason: reason || "No reason provided",
                    requestedBy: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) || "unknown", // Compatibility with different token formats
                });
                // Verifica che il customer esista
                const existingCustomer = yield this.customerService.getById(customerId, workspaceId);
                if (!existingCustomer) {
                    logger_1.default.warn(`[TASK3] CHATBOT_CONTROL_CHANGE_FAILED: customer-${customerId} not found in workspace-${workspaceId}`);
                    return res.status(404).json({ message: "Customer not found" });
                }
                // Aggiorna solo il campo activeChatbot
                const updateData = {
                    activeChatbot,
                    // Aggiungiamo metadata per tracking
                    chatbotControlChangedAt: new Date(),
                    chatbotControlChangedBy: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id) || ((_d = req.user) === null || _d === void 0 ? void 0 : _d.userId) || "unknown",
                    chatbotControlChangeReason: reason || null,
                };
                const updatedCustomer = yield this.customerService.update(customerId, workspaceId, updateData);
                // Logging dettagliato per audit
                logger_1.default.info(`[TASK3] CHATBOT_CONTROL_CHANGED: customer-${customerId} activeChatbot=${activeChatbot} by user-${((_e = req.user) === null || _e === void 0 ? void 0 : _e.id) || ((_f = req.user) === null || _f === void 0 ? void 0 : _f.userId) || "unknown"}`, {
                    customerId,
                    workspaceId,
                    previousState: existingCustomer.activeChatbot,
                    newState: activeChatbot,
                    reason: reason || "No reason provided",
                    changedBy: ((_g = req.user) === null || _g === void 0 ? void 0 : _g.id) || ((_h = req.user) === null || _h === void 0 ? void 0 : _h.userId) || "unknown",
                    timestamp: new Date().toISOString(),
                });
                // Risposta con informazioni utili
                res.json({
                    success: true,
                    customer: {
                        id: updatedCustomer.id,
                        name: updatedCustomer.name,
                        phone: updatedCustomer.phone,
                        activeChatbot: updatedCustomer.activeChatbot,
                    },
                    change: {
                        previousState: existingCustomer.activeChatbot,
                        newState: activeChatbot,
                        reason: reason || null,
                        changedAt: new Date().toISOString(),
                        changedBy: ((_j = req.user) === null || _j === void 0 ? void 0 : _j.id) || ((_k = req.user) === null || _k === void 0 ? void 0 : _k.userId) || "unknown",
                    },
                    message: activeChatbot
                        ? "Chatbot control activated - AI will handle messages"
                        : "Chatbot control deactivated - Manual operator control active",
                });
            }
            catch (error) {
                logger_1.default.error(`[TASK3] CHATBOT_CONTROL_CHANGE_ERROR: customer-${req.params.customerId}:`, error);
                if (error.message === "Customer not found") {
                    return res.status(404).json({ message: "Customer not found" });
                }
                next(error);
            }
        });
    }
    /**
     * Check if phone number already exists in workspace
     * Used for frontend real-time validation
     */
    checkPhoneExists(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { phone } = req.query;
                if (!phone || typeof phone !== "string") {
                    return res.status(400).json({ error: "Phone number is required" });
                }
                const existingCustomer = yield database_1.prisma.customers.findFirst({
                    where: {
                        phone: phone,
                        workspaceId,
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                });
                res.json({
                    exists: !!existingCustomer,
                    customer: existingCustomer || null,
                });
            }
            catch (error) {
                logger_1.default.error("Error checking phone existence:", error);
                next(error);
            }
        });
    }
    /**
     * Check if email already exists in workspace
     * Used for frontend real-time validation
     */
    checkEmailExists(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { email } = req.query;
                if (!email || typeof email !== "string") {
                    return res.status(400).json({ error: "Email is required" });
                }
                const existingCustomer = yield database_1.prisma.customers.findFirst({
                    where: {
                        email: email,
                        workspaceId,
                    },
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                });
                res.json({
                    exists: !!existingCustomer,
                    customer: existingCustomer || null,
                });
            }
            catch (error) {
                logger_1.default.error("Error checking email existence:", error);
                next(error);
            }
        });
    }
}
exports.CustomersController = CustomersController;
//# sourceMappingURL=customers.controller.js.map