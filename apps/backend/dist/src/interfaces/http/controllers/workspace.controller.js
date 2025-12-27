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
exports.WorkspaceController = void 0;
const database_1 = require("@echatbot/database");
const subscription_billing_service_1 = require("../../../application/services/subscription-billing.service");
const workspace_service_1 = require("../../../application/services/workspace.service");
const workspace_member_service_1 = require("../../../application/services/workspace-member.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
const storage_1 = require("../../../services/storage");
const promises_1 = __importDefault(require("fs/promises"));
// prisma imported
class WorkspaceController {
    constructor() {
        /**
         * Get all workspaces
         * SECURITY: Returns ONLY workspaces the authenticated user has access to
         */
        this.getAllWorkspaces = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // CRITICAL SECURITY: Get userId from authenticated request
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    logger_1.default.error("User ID not found in request - authentication failed");
                    return res.status(401).json({ error: "User not authenticated" });
                }
                logger_1.default.info(`Getting workspaces for user: ${userId}`);
                // WORKSPACE ISOLATION: Fetch ONLY workspaces this user has access to
                const workspaces = yield this.workspaceService.getByUserId(userId);
                // Serialize workspaces to plain objects with all properties
                const serializedWorkspaces = workspaces.map((workspace) => ({
                    id: workspace.id,
                    name: workspace.name,
                    slug: workspace.slug,
                    description: workspace.description,
                    whatsappPhoneNumber: workspace.whatsappPhoneNumber,
                    whatsappApiKey: workspace.whatsappApiKey, // ✅ FIXED: Use whatsappApiKey instead of whatsappApiToken
                    webhookUrl: workspace.webhookUrl,
                    notificationEmail: workspace.notificationEmail,
                    adminEmail: workspace.adminEmail, // Explicitly include adminEmail
                    language: workspace.language,
                    currency: workspace.currency,
                    messageLimit: workspace.messageLimit,
                    blocklist: workspace.blocklist,
                    welcomeMessage: workspace.welcomeMessage,
                    wipMessage: workspace.wipMessage,
                    channelStatus: workspace.channelStatus,
                    challengeStatus: workspace.channelStatus, // 🔄 Alias for frontend compatibility
                    isActive: workspace.isActive,
                    isDelete: workspace.isDelete,
                    url: workspace.url,
                    debugMode: workspace.debugMode,
                    createdAt: workspace.createdAt,
                    updatedAt: workspace.updatedAt,
                    planType: workspace.planType,
                    trialEndsAt: workspace.trialEndsAt,
                    // 🆕 Channel Configuration (Feature 199)
                    sellsProductsAndServices: workspace.sellsProductsAndServices,
                    hasSalesAgents: workspace.hasSalesAgents,
                    hasHumanSupport: workspace.hasHumanSupport,
                    humanSupportInstructions: workspace.humanSupportInstructions,
                    frustrationEscalationInstructions: workspace.frustrationEscalationInstructions, // 🆕 Feature 203
                    operatorContactMethod: workspace.operatorContactMethod,
                    operatorWhatsappNumber: workspace.operatorWhatsappNumber,
                    toneOfVoice: workspace.toneOfVoice,
                    botIdentityResponse: workspace.botIdentityResponse,
                    address: workspace.address,
                    customAiRules: workspace.customAiRules,
                    logoUrl: workspace.logoUrl,
                }));
                return res.json(serializedWorkspaces);
            }
            catch (error) {
                logger_1.default.error("Error fetching workspaces:", error);
                return next(error);
            }
        });
        /**
         * Get a workspace by ID
         */
        this.getWorkspaceById = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                logger_1.default.info(`Getting workspace ${id}`);
                if (!id) {
                    return res.status(400).json({ error: "Workspace ID is required" });
                }
                try {
                    const workspace = yield this.workspaceService.getById(id);
                    if (!workspace) {
                        return res.status(404).json({ message: "Workspace not found" });
                    }
                    // Serialize workspace to plain object with all properties
                    const serializedWorkspace = {
                        id: workspace.id,
                        name: workspace.name,
                        slug: workspace.slug,
                        description: workspace.description,
                        whatsappPhoneNumber: workspace.whatsappPhoneNumber,
                        whatsappApiKey: workspace.whatsappApiKey, // ✅ FIXED: Use whatsappApiKey instead of whatsappApiToken
                        webhookUrl: workspace.webhookUrl,
                        notificationEmail: workspace.notificationEmail,
                        adminEmail: workspace.adminEmail, // Explicitly include adminEmail
                        language: workspace.language,
                        currency: workspace.currency,
                        messageLimit: workspace.messageLimit,
                        blocklist: workspace.blocklist,
                        welcomeMessage: workspace.welcomeMessage,
                        wipMessage: workspace.wipMessage,
                        channelStatus: workspace.channelStatus,
                        challengeStatus: workspace.channelStatus, // 🔄 Alias for frontend compatibility
                        isActive: workspace.isActive,
                        isDelete: workspace.isDelete,
                        url: workspace.url,
                        debugMode: workspace.debugMode,
                        createdAt: workspace.createdAt,
                        updatedAt: workspace.updatedAt,
                        allowedExternalLinks: workspace.allowedExternalLinks,
                        // 🆕 Channel Configuration (Feature 199)
                        sellsProductsAndServices: workspace.sellsProductsAndServices,
                        hasSalesAgents: workspace.hasSalesAgents,
                        hasHumanSupport: workspace.hasHumanSupport,
                        humanSupportInstructions: workspace.humanSupportInstructions,
                        frustrationEscalationInstructions: workspace.frustrationEscalationInstructions, // 🆕 Feature 203
                        operatorContactMethod: workspace.operatorContactMethod,
                        operatorWhatsappNumber: workspace.operatorWhatsappNumber,
                        toneOfVoice: workspace.toneOfVoice,
                        botIdentityResponse: workspace.botIdentityResponse,
                        address: workspace.address,
                        customAiRules: workspace.customAiRules,
                        logoUrl: workspace.logoUrl,
                        // 🆕 Translation Settings
                        translateProductNames: workspace.translateProductNames,
                        translateCategoryNames: workspace.translateCategoryNames,
                        translateServiceNames: workspace.translateServiceNames,
                        catalogBaseLanguage: workspace.catalogBaseLanguage,
                    };
                    return res.json(serializedWorkspace);
                }
                catch (serviceError) {
                    logger_1.default.error(`Service error fetching workspace ${id}:`, serviceError);
                    // Restituisci un errore più specifico basato sull'errore del servizio
                    return res.status(500).json({
                        error: "Failed to retrieve workspace",
                        details: serviceError instanceof Error
                            ? serviceError.message
                            : "Unknown error",
                    });
                }
            }
            catch (error) {
                logger_1.default.error(`Error in workspace controller for ID ${req.params.id}:`, error);
                return next(error);
            }
        });
        /**
         * Create a new workspace
         * CRITICAL: Must create UserWorkspace relation for the creator
         * SECURITY: Only SUPER_ADMIN (owners) or first-time users can create workspaces
         */
        this.createWorkspace = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                logger_1.default.info("Creating new workspace");
                // CRITICAL SECURITY: Get userId from authenticated request
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    logger_1.default.error("User ID not found in request - authentication failed");
                    return res.status(401).json({ error: "User not authenticated" });
                }
                // 🔒 SECURITY CHECK: Verify user can create workspaces
                // Only SUPER_ADMIN (owners) or first-time users can create channels
                const { canCreate, reason, isFirstTimeOwner } = yield workspace_member_service_1.workspaceMemberService.canUserCreateWorkspace(userId);
                if (!canCreate) {
                    logger_1.default.warn(`❌ User ${userId} attempted to create workspace but is not authorized: ${reason}`);
                    return res.status(403).json({
                        error: "Not authorized to create channels",
                        message: reason
                    });
                }
                // 💰 BILLING CHECK: Verify channels limit (skip for first-time owners with no workspace yet)
                if (!isFirstTimeOwner) {
                    // Get user's existing workspaces to check limit
                    const existingWorkspaces = yield this.workspaceService.getByUserId(userId);
                    if (existingWorkspaces && existingWorkspaces.length > 0) {
                        const firstWorkspaceId = existingWorkspaces[0].id;
                        const limitCheck = yield this.billingService.checkPlanLimits(firstWorkspaceId, "channels");
                        if (!limitCheck.withinLimits) {
                            logger_1.default.warn(`❌ User ${userId} exceeded channels limit: ${limitCheck.current}/${limitCheck.max}`);
                            return res.status(403).json({
                                error: "Plan limit reached",
                                message: `Channel limit reached: ${limitCheck.current}/${limitCheck.max}`,
                                code: "CHANNEL_LIMIT_EXCEEDED",
                            });
                        }
                    }
                }
                logger_1.default.info(`✅ User ${userId} authorized to create workspace (firstTimeOwner: ${isFirstTimeOwner})`);
                const workspaceData = req.body;
                // Create workspace with user relation
                const workspace = yield this.workspaceService.create(Object.assign(Object.assign({}, workspaceData), { createdBy: userId }));
                logger_1.default.info(`✅ Workspace created: ${workspace.id} for user ${userId}`);
                return res.status(201).json(workspace);
            }
            catch (error) {
                logger_1.default.error("❌ Error creating workspace:", {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                    body: req.body,
                });
                return next(error);
            }
        });
        /**
         * Update a workspace
         */
        this.updateWorkspace = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceData = req.body;
                logger_1.default.info(`Updating workspace ${id}`);
                logger_1.default.info(`📦 Workspace data received: ${JSON.stringify(workspaceData, null, 2)}`);
                // 🔍 LOG SPECIFICO per whatsappApiKey
                logger_1.default.info("=== WHATSAPP API KEY DEBUG ===");
                logger_1.default.info("whatsappApiKey presente nel body:", workspaceData.whatsappApiKey ? "✅ SÌ" : "❌ NO");
                if (workspaceData.whatsappApiKey) {
                    logger_1.default.info("Lunghezza whatsappApiKey:", workspaceData.whatsappApiKey.length);
                    logger_1.default.info("Primi 10 caratteri:", workspaceData.whatsappApiKey.substring(0, 10) + "...");
                }
                // 🔍 LOG SPECIFICO per Feature 199 fields
                logger_1.default.info("=== FEATURE 199 TOGGLE DEBUG ===");
                logger_1.default.info(`sellsProductsAndServices nel body: ${workspaceData.sellsProductsAndServices} (tipo: ${typeof workspaceData.sellsProductsAndServices})`);
                logger_1.default.info(`hasSalesAgents nel body: ${workspaceData.hasSalesAgents} (tipo: ${typeof workspaceData.hasSalesAgents})`);
                logger_1.default.info(`hasHumanSupport nel body: ${workspaceData.hasHumanSupport} (tipo: ${typeof workspaceData.hasHumanSupport})`);
                logger_1.default.info("operatorContactMethod nel body:", workspaceData.operatorContactMethod);
                const workspace = yield this.workspaceService.update(id, workspaceData);
                if (!workspace) {
                    return res.status(404).json({ message: "Workspace not found" });
                }
                // Serialize workspace to plain object with all properties (same as getWorkspaceById)
                const serializedWorkspace = {
                    id: workspace.id,
                    name: workspace.name,
                    slug: workspace.slug,
                    description: workspace.description,
                    whatsappPhoneNumber: workspace.whatsappPhoneNumber,
                    whatsappApiKey: workspace.whatsappApiKey,
                    webhookUrl: workspace.webhookUrl,
                    notificationEmail: workspace.notificationEmail,
                    adminEmail: workspace.adminEmail,
                    language: workspace.language,
                    currency: workspace.currency,
                    messageLimit: workspace.messageLimit,
                    blocklist: workspace.blocklist,
                    welcomeMessage: workspace.welcomeMessage,
                    wipMessage: workspace.wipMessage,
                    channelStatus: workspace.channelStatus,
                    challengeStatus: workspace.channelStatus, // 🔄 Alias for frontend compatibility
                    isActive: workspace.isActive,
                    isDelete: workspace.isDelete,
                    url: workspace.url,
                    debugMode: workspace.debugMode,
                    createdAt: workspace.createdAt,
                    updatedAt: workspace.updatedAt,
                    allowedExternalLinks: workspace.allowedExternalLinks,
                    // 🆕 Channel Configuration (Feature 199)
                    sellsProductsAndServices: workspace.sellsProductsAndServices,
                    hasSalesAgents: workspace.hasSalesAgents,
                    hasHumanSupport: workspace.hasHumanSupport,
                    humanSupportInstructions: workspace.humanSupportInstructions,
                    frustrationEscalationInstructions: workspace.frustrationEscalationInstructions, // 🆕 Feature 203
                    operatorContactMethod: workspace.operatorContactMethod,
                    operatorWhatsappNumber: workspace.operatorWhatsappNumber,
                    toneOfVoice: workspace.toneOfVoice,
                    botIdentityResponse: workspace.botIdentityResponse,
                    address: workspace.address,
                    customAiRules: workspace.customAiRules,
                    logoUrl: workspace.logoUrl,
                    // 🆕 Translation Settings
                    translateProductNames: workspace.translateProductNames,
                    translateCategoryNames: workspace.translateCategoryNames,
                    translateServiceNames: workspace.translateServiceNames,
                    catalogBaseLanguage: workspace.catalogBaseLanguage,
                };
                logger_1.default.info(`✅ Workspace serialized and ready to return: ${JSON.stringify(serializedWorkspace, null, 2)}`);
                return res.json(serializedWorkspace);
            }
            catch (error) {
                logger_1.default.error(`Error updating workspace ${req.params.id}:`, error);
                return next(error);
            }
        });
        /**
         * Delete a workspace
         * SECURITY: Only the workspace owner (SUPER_ADMIN) can delete a channel
         */
        this.deleteWorkspace = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                // CRITICAL SECURITY: Get userId from authenticated request
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    logger_1.default.error("User ID not found in request - authentication failed");
                    return res.status(401).json({ error: "User not authenticated" });
                }
                logger_1.default.info(`User ${userId} attempting to delete workspace ${id}`);
                // 🔒 SECURITY CHECK: Only SUPER_ADMIN (owner) can delete workspace
                const isSuperAdmin = yield workspace_member_service_1.workspaceMemberService.isSuperAdmin(id, userId);
                if (!isSuperAdmin) {
                    logger_1.default.warn(`❌ User ${userId} attempted to delete workspace ${id} but is not the owner`);
                    return res.status(403).json({
                        error: "Not authorized to delete this channel",
                        message: "Only workspace owners (SUPER_ADMIN) can delete channels"
                    });
                }
                logger_1.default.info(`✅ User ${userId} authorized to delete workspace ${id} (is owner)`);
                const result = yield this.workspaceService.delete(id);
                if (!result) {
                    return res.status(404).json({ message: "Workspace not found" });
                }
                logger_1.default.info(`✅ Workspace ${id} deleted by owner ${userId}`);
                return res.status(204).send();
            }
            catch (error) {
                logger_1.default.error(`Error deleting workspace ${req.params.id}:`, error);
                return next(error);
            }
        });
        /**
         * Upload workspace logo
         * SECURITY: Only SUPER_ADMIN (owner) can upload logo
         */
        this.uploadWorkspaceLogo = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { id } = req.params;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return res.status(401).json({ error: "User not authenticated" });
                }
                // Check if user is SUPER_ADMIN
                const isSuperAdmin = yield workspace_member_service_1.workspaceMemberService.isSuperAdmin(id, userId);
                if (!isSuperAdmin) {
                    return res.status(403).json({ error: "Only workspace owners can upload logo" });
                }
                const file = req.file;
                if (!file) {
                    return res.status(400).json({ error: "No file uploaded" });
                }
                // Get current workspace to check for old logo
                const currentWorkspace = yield database_1.prisma.workspace.findUnique({
                    where: { id },
                    select: { logoKey: true }
                });
                // Delete old logo if exists
                if (currentWorkspace === null || currentWorkspace === void 0 ? void 0 : currentWorkspace.logoKey) {
                    const storage = (0, storage_1.getStorageService)();
                    yield storage.delete(currentWorkspace.logoKey);
                    logger_1.default.info(`Deleted old logo: ${currentWorkspace.logoKey}`);
                }
                // Upload new logo via Storage Service
                const storage = (0, storage_1.getStorageService)();
                const fileBuffer = (_b = file.buffer) !== null && _b !== void 0 ? _b : (file.path ? yield promises_1.default.readFile(file.path) : null);
                if (!fileBuffer) {
                    return res.status(400).json({ error: "Invalid file payload" });
                }
                const uploadedFile = yield storage.upload(fileBuffer, {
                    filename: `${id}-logo-${Date.now()}.${file.originalname.split('.').pop()}`,
                    folder: `workspaces/${id}`,
                    contentType: file.mimetype,
                    isPublic: true
                });
                // Update workspace with new logo URL and key
                const workspace = yield this.workspaceService.update(id, {
                    logoUrl: uploadedFile.url,
                    logoKey: uploadedFile.key
                });
                logger_1.default.info(`✅ Logo uploaded for workspace ${id}: ${uploadedFile.url}`);
                return res.json({ logoUrl: workspace.logoUrl });
            }
            catch (error) {
                logger_1.default.error("Error uploading workspace logo:", error);
                return next(error);
            }
        });
        /**
         * Get badge stats for all user's workspaces
         * Returns counts for: unread messages, operator interventions needed, pending orders
         */
        this.getWorkspaceBadgeStats = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // CRITICAL SECURITY: Get userId from authenticated request
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    logger_1.default.error("User ID not found in request - authentication failed");
                    return res.status(401).json({ error: "User not authenticated" });
                }
                logger_1.default.info(`📊 Getting badge stats for user: ${userId}`);
                // Get all workspaces this user has access to
                const workspaces = yield this.workspaceService.getByUserId(userId);
                const workspaceIds = workspaces.map((w) => w.id);
                if (workspaceIds.length === 0) {
                    return res.json({});
                }
                // Get stats for each workspace in parallel
                const statsPromises = workspaceIds.map((workspaceId) => __awaiter(this, void 0, void 0, function* () {
                    const [unreadMessages, pendingOrders, needsIntervention, blockedUsers, newCustomers] = yield Promise.all([
                        // Count unread incoming messages (from customers)
                        database_1.prisma.message.count({
                            where: {
                                read: false,
                                direction: "INBOUND",
                                chatSession: {
                                    workspaceId,
                                },
                            },
                        }),
                        // Count pending orders
                        database_1.prisma.orders.count({
                            where: {
                                workspaceId,
                                status: "PENDING",
                            },
                        }),
                        // Count customers needing operator intervention
                        // Customers where activeChatbot = false (disabled chatbot, wants human)
                        database_1.prisma.customers.count({
                            where: {
                                workspaceId,
                                activeChatbot: false,
                            },
                        }),
                        // Count blocked/blacklisted customers
                        database_1.prisma.customers.count({
                            where: {
                                workspaceId,
                                isBlacklisted: true,
                            },
                        }),
                        // Count new customers (unregistered - name is "New Customer")
                        database_1.prisma.customers.count({
                            where: {
                                workspaceId,
                                name: "New Customer",
                            },
                        }),
                    ]);
                    return {
                        workspaceId,
                        unreadMessages,
                        pendingOrders,
                        needsIntervention,
                        blockedUsers,
                        newCustomers,
                    };
                }));
                const allStats = yield Promise.all(statsPromises);
                // Convert to a map for easy access
                const statsMap = {};
                allStats.forEach((stat) => {
                    statsMap[stat.workspaceId] = {
                        unreadMessages: stat.unreadMessages,
                        pendingOrders: stat.pendingOrders,
                        needsIntervention: stat.needsIntervention,
                        blockedUsers: stat.blockedUsers,
                        newCustomers: stat.newCustomers,
                    };
                });
                logger_1.default.info(`📊 Badge stats retrieved for ${workspaceIds.length} workspaces`, statsMap);
                return res.json(statsMap);
            }
            catch (error) {
                logger_1.default.error("Error fetching workspace badge stats:", error);
                return next(error);
            }
        });
        this.workspaceService = new workspace_service_1.WorkspaceService();
        this.billingService = new subscription_billing_service_1.SubscriptionBillingService(database_1.prisma);
    }
}
exports.WorkspaceController = WorkspaceController;
//# sourceMappingURL=workspace.controller.js.map