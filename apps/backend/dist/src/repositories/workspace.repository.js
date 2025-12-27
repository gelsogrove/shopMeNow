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
exports.WorkspaceRepository = void 0;
const database_1 = require("@echatbot/database");
const workspace_entity_1 = require("../domain/entities/workspace.entity");
const logger_1 = __importDefault(require("../utils/logger"));
class WorkspaceRepository {
    constructor(prismaClient) {
        this.prisma = prismaClient || database_1.prisma;
    }
    /**
     * Map database model to domain entity
     */
    mapToDomain(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return workspace_entity_1.Workspace.create({
            id: data.id,
            name: data.name,
            slug: data.slug,
            description: data.description,
            whatsappPhoneNumber: data.whatsappPhoneNumber,
            whatsappApiKey: data.whatsappApiKey, // ✅ FIX: Use whatsappApiKey (new field name)
            whatsappApiToken: data.whatsappApiKey, // ✅ LEGACY: Keep for backward compatibility
            whatsappWebhookUrl: data.whatsappWebhookUrl,
            webhookUrl: data.webhookUrl,
            notificationEmail: data.notificationEmail,
            language: data.language,
            currency: data.currency,
            messageLimit: data.messageLimit,
            blocklist: data.blocklist,
            welcomeMessage: data.welcomeMessage,
            wipMessage: data.wipMessage,
            channelStatus: data.channelStatus,
            isActive: data.isActive,
            isDelete: data.isDelete,
            url: data.url,
            adminEmail: ((_a = data.whatsappSettings) === null || _a === void 0 ? void 0 : _a.adminEmail) || null,
            debugMode: (_b = data.debugMode) !== null && _b !== void 0 ? _b : true,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            afterRegistrationMessages: data.afterRegistrationMessages,
            planType: data.planType || null,
            trialEndsAt: data.trialEndsAt || null,
            allowedExternalLinks: data.allowedExternalLinks || [],
            // 🆕 Channel Configuration (Feature 199)
            sellsProductsAndServices: (_c = data.sellsProductsAndServices) !== null && _c !== void 0 ? _c : true,
            hasSalesAgents: (_d = data.hasSalesAgents) !== null && _d !== void 0 ? _d : false,
            hasHumanSupport: (_e = data.hasHumanSupport) !== null && _e !== void 0 ? _e : true,
            humanSupportInstructions: data.humanSupportInstructions || null,
            operatorContactMethod: data.operatorContactMethod || 'email',
            operatorWhatsappNumber: data.operatorWhatsappNumber || null,
            toneOfVoice: data.toneOfVoice || 'friendly',
            botIdentityResponse: data.botIdentityResponse || null,
            address: data.address || null,
            customAiRules: data.customAiRules || null,
            // 🆕 Logo
            logoUrl: data.logoUrl || null,
            // 🆕 Translation Settings
            translateProductNames: (_f = data.translateProductNames) !== null && _f !== void 0 ? _f : false,
            translateCategoryNames: (_g = data.translateCategoryNames) !== null && _g !== void 0 ? _g : false,
            translateServiceNames: (_h = data.translateServiceNames) !== null && _h !== void 0 ? _h : true,
            catalogBaseLanguage: (_j = data.catalogBaseLanguage) !== null && _j !== void 0 ? _j : "it",
        });
    }
    /**
     * Map domain entity to database model
     */
    mapToDatabase(workspace) {
        return {
            id: workspace.id || undefined,
            name: workspace.name,
            slug: workspace.slug,
            description: workspace.description,
            whatsappPhoneNumber: workspace.whatsappPhoneNumber,
            whatsappApiKey: workspace.whatsappApiKey || workspace.whatsappApiToken, // ✅ FIX: Prefer whatsappApiKey, fallback to whatsappApiToken
            whatsappWebhookUrl: workspace.whatsappWebhookUrl,
            webhookUrl: workspace.webhookUrl,
            notificationEmail: workspace.notificationEmail,
            language: workspace.language,
            currency: workspace.currency,
            messageLimit: workspace.messageLimit,
            blocklist: workspace.blocklist,
            welcomeMessage: workspace.welcomeMessage,
            wipMessage: workspace.wipMessage,
            channelStatus: workspace.channelStatus,
            isActive: workspace.isActive,
            isDelete: workspace.isDelete,
            url: workspace.url,
            debugMode: workspace.debugMode,
            allowedExternalLinks: workspace.allowedExternalLinks || [],
            // 🆕 Channel Configuration (Feature 199)
            sellsProductsAndServices: workspace.sellsProductsAndServices,
            hasSalesAgents: workspace.hasSalesAgents,
            hasHumanSupport: workspace.hasHumanSupport,
            humanSupportInstructions: workspace.humanSupportInstructions,
            operatorContactMethod: workspace.operatorContactMethod,
            operatorWhatsappNumber: workspace.operatorWhatsappNumber,
            toneOfVoice: workspace.toneOfVoice,
            botIdentityResponse: workspace.botIdentityResponse,
            address: workspace.address,
            customAiRules: workspace.customAiRules,
            // 🆕 Logo
            logoUrl: workspace.logoUrl,
            // 🆕 Translation Settings
            translateProductNames: workspace.translateProductNames,
            translateCategoryNames: workspace.translateCategoryNames,
            translateServiceNames: workspace.translateServiceNames,
            catalogBaseLanguage: workspace.catalogBaseLanguage,
        };
    }
    /**
     * Find all active workspaces
     */
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug("Finding all workspaces");
            try {
                const workspaces = yield this.prisma.workspace.findMany({
                    where: {
                        isDelete: false,
                    },
                    include: {
                        whatsappSettings: true,
                    },
                    orderBy: { createdAt: "asc" },
                });
                logger_1.default.debug(`Found ${workspaces.length} workspaces`);
                // 🔍 DEBUG: Log raw sellsProductsAndServices values from Prisma
                workspaces.forEach((ws) => {
                    logger_1.default.info(`🔍 PRISMA RAW - Workspace "${ws.name}": sellsProductsAndServices = ${ws.sellsProductsAndServices} (type: ${typeof ws.sellsProductsAndServices})`);
                });
                // Map workspaces to domain entities
                const mappedWorkspaces = workspaces.map((workspace) => this.mapToDomain(workspace));
                // 🔍 DEBUG: Log mapped sellsProductsAndServices values
                mappedWorkspaces.forEach((ws) => {
                    logger_1.default.info(`🔍 MAPPED - Workspace "${ws.name}": sellsProductsAndServices = ${ws.sellsProductsAndServices} (type: ${typeof ws.sellsProductsAndServices})`);
                });
                return mappedWorkspaces;
            }
            catch (error) {
                logger_1.default.error("Error finding workspaces:", error);
                throw error;
            }
        });
    }
    /**
     * Find a workspace by ID
     */
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Finding workspace by ID: ${id}`);
            try {
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id },
                    include: {
                        whatsappSettings: true,
                        agentConfigs: true, // 🔧 FIX: Include agentConfigs for LLM settings
                    },
                });
                if (!workspace) {
                    logger_1.default.debug(`Workspace with ID ${id} not found`);
                    return null;
                }
                logger_1.default.debug(`Found workspace with ID ${id}`);
                try {
                    const domainWorkspace = this.mapToDomain(workspace);
                    domainWorkspace.agentConfigs = workspace.agentConfigs || [];
                    return domainWorkspace;
                }
                catch (error) {
                    // If mapping fails but it's a deleted workspace, return a simplified version
                    // This preserves compatibility with the test that expects to find deleted workspaces
                    if (workspace.isDelete) {
                        logger_1.default.debug(`Returning simplified version of deleted workspace ${id}`);
                        return workspace_entity_1.Workspace.create({
                            id: workspace.id,
                            name: workspace.name || "Deleted Workspace", // Ensure name is never empty
                            slug: workspace.slug || "deleted-workspace",
                            isDelete: true,
                            isActive: false,
                            language: "ENG",
                            createdAt: workspace.createdAt || new Date(),
                            updatedAt: workspace.updatedAt || new Date(),
                            currency: "EUR",
                            channelStatus: false,
                            description: null,
                            messageLimit: 50,
                            blocklist: "",
                            url: null,
                            welcomeMessage: null,
                            wipMessage: null,
                            afterRegistrationMessages: null,
                            debugMode: true,
                            adminEmail: null,
                            whatsappPhoneNumber: null,
                            whatsappApiKey: null,
                            whatsappApiToken: null,
                            whatsappWebhookUrl: null,
                            notificationEmail: null,
                            webhookUrl: null,
                        });
                    }
                    else {
                        throw error;
                    }
                }
            }
            catch (error) {
                logger_1.default.error(`Error finding workspace with ID ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find a workspace by slug
     */
    findBySlug(slug) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Finding workspace by slug: ${slug}`);
            try {
                const workspace = yield this.prisma.workspace.findFirst({
                    where: { slug },
                });
                if (!workspace) {
                    logger_1.default.debug(`Workspace with slug ${slug} not found`);
                    return null;
                }
                logger_1.default.debug(`Found workspace with slug ${slug}`);
                return this.mapToDomain(workspace);
            }
            catch (error) {
                logger_1.default.error(`Error finding workspace with slug ${slug}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find a workspace by WhatsApp phone number (channel number)
     * This allows the backend to determine workspace from the incoming message's channel
     */
    findByWhatsAppPhoneNumber(phoneNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!phoneNumber) {
                logger_1.default.debug("findByWhatsAppPhoneNumber: Empty phone number provided");
                return null;
            }
            // Normalize phone number (remove spaces, ensure format)
            const normalizedPhone = phoneNumber.trim();
            logger_1.default.debug(`🔍 Finding workspace by WhatsApp phone number: ${normalizedPhone}`);
            try {
                const workspace = yield this.prisma.workspace.findFirst({
                    where: {
                        whatsappPhoneNumber: normalizedPhone,
                        isDelete: false,
                        isActive: true,
                    },
                    include: {
                        whatsappSettings: true,
                        agentConfigs: true,
                    },
                });
                if (!workspace) {
                    logger_1.default.debug(`⚠️ No active workspace found for WhatsApp phone: ${normalizedPhone}`);
                    return null;
                }
                logger_1.default.debug(`✅ Found workspace: ${workspace.name} (${workspace.id}) for phone: ${normalizedPhone}`);
                const domainWorkspace = this.mapToDomain(workspace);
                domainWorkspace.agentConfigs = workspace.agentConfigs || [];
                return domainWorkspace;
            }
            catch (error) {
                logger_1.default.error(`Error finding workspace by WhatsApp phone ${normalizedPhone}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find workspaces by user ID
     */
    findByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Finding workspaces for user ${userId}`);
            try {
                const user = yield this.prisma.user.findUnique({
                    where: { id: userId },
                    include: {
                        workspaces: {
                            include: {
                                workspace: true,
                            },
                            orderBy: {
                                workspace: {
                                    createdAt: 'asc',
                                },
                            },
                        },
                    },
                });
                if (!user || !user.workspaces) {
                    logger_1.default.debug(`No workspaces found for user ${userId}`);
                    return [];
                }
                // Filter only non-deleted workspaces
                const workspaces = user.workspaces
                    .map((uw) => uw.workspace)
                    .filter((workspace) => !workspace.isDelete);
                logger_1.default.debug(`Found ${workspaces.length} workspaces for user ${userId}`);
                // 🔍 DEBUG: Log raw sellsProductsAndServices values from Prisma (findByUserId)
                workspaces.forEach((ws) => {
                    logger_1.default.info(`🔍 PRISMA RAW (findByUserId) - Workspace "${ws.name}": sellsProductsAndServices = ${ws.sellsProductsAndServices} (type: ${typeof ws.sellsProductsAndServices})`);
                });
                const mappedWorkspaces = workspaces.map((workspace) => this.mapToDomain(workspace));
                // 🔍 DEBUG: Log mapped sellsProductsAndServices values (findByUserId)
                mappedWorkspaces.forEach((ws) => {
                    logger_1.default.info(`🔍 MAPPED (findByUserId) - Workspace "${ws.name}": sellsProductsAndServices = ${ws.sellsProductsAndServices} (type: ${typeof ws.sellsProductsAndServices})`);
                });
                return mappedWorkspaces;
            }
            catch (error) {
                logger_1.default.error(`Error finding workspaces for user ${userId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create a new workspace
     */
    create(workspace) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Creating new workspace: ${workspace.name}`);
            try {
                const data = this.mapToDatabase(workspace);
                const createdWorkspace = yield this.prisma.workspace.create({
                    data,
                });
                logger_1.default.debug(`Created workspace with ID ${createdWorkspace.id}`);
                return this.mapToDomain(createdWorkspace);
            }
            catch (error) {
                logger_1.default.error("Error creating workspace:", error);
                throw error;
            }
        });
    }
    /**
     * Update an existing workspace
     */
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            logger_1.default.debug(`Updating workspace with ID ${id}`);
            logger_1.default.debug(`📥 Raw data received in repository.update: ${JSON.stringify(data, null, 2)}`);
            // 🔍 LOG FEATURE 199
            logger_1.default.debug("=== FEATURE 199 REPOSITORY DEBUG ===");
            logger_1.default.debug(`sellsProductsAndServices ricevuto: ${data.sellsProductsAndServices} (tipo: ${typeof data.sellsProductsAndServices})`);
            logger_1.default.debug(`hasSalesAgents ricevuto: ${data.hasSalesAgents} (tipo: ${typeof data.hasSalesAgents})`);
            logger_1.default.debug(`hasHumanSupport ricevuto: ${data.hasHumanSupport} (tipo: ${typeof data.hasHumanSupport})`);
            try {
                const existingWorkspace = yield this.prisma.workspace.findUnique({
                    where: { id },
                    include: { whatsappSettings: true },
                });
                if (!existingWorkspace) {
                    logger_1.default.debug(`Workspace with ID ${id} not found for update`);
                    return null;
                }
                logger_1.default.debug(`💾 BEFORE UPDATE - Current DB state: ${JSON.stringify({
                    name: existingWorkspace.name,
                    whatsappPhoneNumber: existingWorkspace.whatsappPhoneNumber,
                    whatsappApiKey: existingWorkspace.whatsappApiKey,
                    adminEmail: (_a = existingWorkspace.whatsappSettings) === null || _a === void 0 ? void 0 : _a.adminEmail,
                    isActive: existingWorkspace.isActive,
                    debugMode: existingWorkspace.debugMode,
                }, null, 2)}`);
                // Ensure whatsappApiToken/whatsappApiKey is mapped correctly for Prisma
                const dbData = Object.assign({}, data);
                // 🔄 Map challengeStatus → channelStatus (frontend uses different name than DB)
                if (dbData.challengeStatus !== undefined) {
                    dbData.channelStatus = dbData.challengeStatus;
                    delete dbData.challengeStatus;
                }
                // Remove 'id' if present - shouldn't update primary key
                if (dbData.id !== undefined) {
                    delete dbData.id;
                }
                // Handle both whatsappApiToken (old) and whatsappApiKey (new) fields
                if (dbData.whatsappApiToken !== undefined) {
                    dbData.whatsappApiKey = dbData.whatsappApiToken;
                    delete dbData.whatsappApiToken;
                }
                // If whatsappApiKey is sent directly, keep it as is (no transformation needed)
                // Prisma schema uses whatsappApiKey field
                // Handle adminEmail - should be saved in whatsappSettings, not workspace
                let adminEmail;
                if (dbData.adminEmail !== undefined) {
                    adminEmail = dbData.adminEmail;
                    delete dbData.adminEmail;
                }
                // Handle JSON fields - ensure they are properly formatted
                if (dbData.welcomeMessage &&
                    typeof dbData.welcomeMessage === "object") {
                    dbData.welcomeMessage = dbData.welcomeMessage;
                }
                if (dbData.wipMessage && typeof dbData.wipMessage === "object") {
                    dbData.wipMessage = dbData.wipMessage;
                }
                logger_1.default.debug(`📝 Data prepared for Prisma update (workspace ${id}): ${JSON.stringify(dbData, null, 2)}`);
                logger_1.default.debug(`📧 AdminEmail to update: ${adminEmail}`);
                // 🔍 LOG FEATURE 199 AFTER TRANSFORMATION
                logger_1.default.debug("=== FEATURE 199 AFTER TRANSFORMATION ===");
                logger_1.default.debug(`sellsProductsAndServices in dbData: ${dbData.sellsProductsAndServices}`);
                logger_1.default.debug(`hasSalesAgents in dbData: ${dbData.hasSalesAgents}`);
                logger_1.default.debug(`hasHumanSupport in dbData: ${dbData.hasHumanSupport}`);
                // Prepare the exact data object for Prisma
                const prismaUpdateData = Object.assign(Object.assign({}, dbData), (adminEmail !== undefined && {
                    whatsappSettings: {
                        upsert: {
                            create: {
                                phoneNumber: data.whatsappPhoneNumber ||
                                    dbData.whatsappPhoneNumber ||
                                    "placeholder",
                                apiKey: dbData.whatsappApiKey ||
                                    data.whatsappApiToken ||
                                    "placeholder",
                                adminEmail: adminEmail,
                            },
                            update: {
                                phoneNumber: data.whatsappPhoneNumber || dbData.whatsappPhoneNumber,
                                apiKey: dbData.whatsappApiKey || data.whatsappApiToken,
                                adminEmail: adminEmail,
                            },
                        },
                    },
                }));
                logger_1.default.debug(`🔧 EXACT Prisma update data: ${JSON.stringify(prismaUpdateData, null, 2)}`);
                logger_1.default.info(`🚀 Calling Prisma.workspace.update with ID: ${id}`);
                const updatedWorkspace = yield this.prisma.workspace.update({
                    where: { id },
                    data: prismaUpdateData,
                    include: {
                        whatsappSettings: true,
                    },
                });
                logger_1.default.debug(`✅ Prisma update completed for workspace ${id}`);
                logger_1.default.debug(`✅ AFTER UPDATE - New DB state: ${JSON.stringify({
                    name: updatedWorkspace.name,
                    whatsappPhoneNumber: updatedWorkspace.whatsappPhoneNumber,
                    whatsappApiKey: updatedWorkspace.whatsappApiKey,
                    adminEmail: (_b = updatedWorkspace.whatsappSettings) === null || _b === void 0 ? void 0 : _b.adminEmail,
                    isActive: updatedWorkspace.isActive,
                    debugMode: updatedWorkspace.debugMode,
                    sellsProductsAndServices: updatedWorkspace.sellsProductsAndServices,
                    hasSalesAgents: updatedWorkspace.hasSalesAgents,
                    hasHumanSupport: updatedWorkspace.hasHumanSupport,
                    updatedAt: updatedWorkspace.updatedAt,
                }, null, 2)}`);
                // 🔍 LOG FEATURE 199 FINAL
                logger_1.default.debug("=== FEATURE 199 FINAL DB VALUES ===");
                logger_1.default.debug(`sellsProductsAndServices DB finale: ${updatedWorkspace.sellsProductsAndServices}`);
                logger_1.default.debug(`hasSalesAgents DB finale: ${updatedWorkspace.hasSalesAgents}`);
                logger_1.default.debug(`hasHumanSupport DB finale: ${updatedWorkspace.hasHumanSupport}`);
                try {
                    const domainEntity = this.mapToDomain(updatedWorkspace);
                    logger_1.default.debug(`🔄 Mapped to domain entity: ${JSON.stringify(domainEntity, null, 2)}`);
                    return domainEntity;
                }
                catch (error) {
                    logger_1.default.error(`❌ Error mapping workspace to domain entity:`, error);
                    // If mapping fails but it's a deleted workspace, return a simplified version
                    if (updatedWorkspace.isDelete) {
                        logger_1.default.debug(`Returning simplified version of deleted workspace ${id}`);
                        return workspace_entity_1.Workspace.create({
                            id: updatedWorkspace.id,
                            name: updatedWorkspace.name || "Deleted Workspace", // Ensure name is never empty
                            slug: updatedWorkspace.slug || "deleted-workspace",
                            isDelete: true,
                            isActive: false,
                            language: "ENG",
                            createdAt: updatedWorkspace.createdAt || new Date(),
                            updatedAt: updatedWorkspace.updatedAt || new Date(),
                            currency: "EUR",
                            channelStatus: false,
                            description: null,
                            messageLimit: 50,
                            blocklist: "",
                            url: null,
                            welcomeMessage: null,
                            wipMessage: null,
                            afterRegistrationMessages: null,
                            debugMode: true,
                            adminEmail: null,
                            whatsappPhoneNumber: null,
                            whatsappApiKey: null,
                            whatsappApiToken: null,
                            whatsappWebhookUrl: null,
                            notificationEmail: null,
                            webhookUrl: null,
                        });
                    }
                    throw error;
                }
            }
            catch (error) {
                logger_1.default.error(`Error updating workspace with ID ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Update agent status (enable/disable) for a workspace
     * Used for Feature 199: Auto-disable e-commerce agents when sellsProductsAndServices = false
     */
    updateAgentStatus(workspaceId, agentType, isActive) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Updating agent status for workspace ${workspaceId}: ${agentType} = ${isActive}`);
            try {
                const result = yield this.prisma.agentConfig.updateMany({
                    where: {
                        workspaceId,
                        type: agentType, // AgentType enum
                    },
                    data: {
                        isActive,
                    },
                });
                logger_1.default.info(`✅ Updated ${result.count} agent(s) for workspace ${workspaceId}`);
                return result.count > 0;
            }
            catch (error) {
                logger_1.default.error(`Error updating agent status:`, error);
                throw error;
            }
        });
    }
    /**
     * Soft-delete a workspace (mark as deleted with deletedAt timestamp)
     * Hard-delete happens after 90 days via scheduler
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`Soft-deleting workspace with ID ${id}`);
            try {
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id },
                });
                if (!workspace) {
                    logger_1.default.debug(`Workspace with ID ${id} not found for deletion`);
                    return false;
                }
                // Soft-delete: set deletedAt and isDelete flag
                yield this.prisma.workspace.update({
                    where: { id },
                    data: {
                        isDelete: true, // Legacy flag for backward compatibility
                        deletedAt: new Date(), // New soft-delete timestamp
                    },
                });
                logger_1.default.info(`Soft-deleted workspace ${id} (will be hard-deleted after 90 days)`);
                return true;
            }
            catch (error) {
                logger_1.default.error(`Error soft-deleting workspace with ID ${id}:`, error);
                throw error;
            }
        });
    }
}
exports.WorkspaceRepository = WorkspaceRepository;
//# sourceMappingURL=workspace.repository.js.map