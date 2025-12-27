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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceService = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../utils/logger"));
exports.workspaceService = {
    getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return database_1.prisma.workspace.findMany({
                where: {
                    isDelete: false,
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    whatsappPhoneNumber: true,
                    whatsappApiKey: true,
                    createdAt: true,
                    updatedAt: true,
                    isActive: true,
                    isDelete: true,
                    currency: true,
                    language: true,
                    messageLimit: true,
                    channelStatus: true,
                    wipMessage: true,
                    // blocklist: true, // REMOVED: field no longer exists
                    url: true,
                    welcomeMessage: true,
                    allowedExternalLinks: true, // 🛡️ Security
                    // 🆕 Channel Configuration (Feature 199)
                    sellsProductsAndServices: true,
                    hasSalesAgents: true,
                    hasHumanSupport: true,
                    humanSupportInstructions: true,
                    operatorContactMethod: true,
                    operatorWhatsappNumber: true,
                    toneOfVoice: true,
                    botIdentityResponse: true,
                    address: true,
                    customAiRules: true,
                    // 🆕 Translation Settings
                    translateProductNames: true,
                    translateCategoryNames: true,
                    translateServiceNames: true,
                    catalogBaseLanguage: true,
                },
            });
        });
    },
    getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Query per il workspace
            const workspace = yield database_1.prisma.workspace.findUnique({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    whatsappPhoneNumber: true,
                    whatsappApiKey: true,
                    createdAt: true,
                    updatedAt: true,
                    isActive: true,
                    isDelete: true,
                    currency: true,
                    language: true,
                    messageLimit: true,
                    channelStatus: true,
                    wipMessage: true,
                    // blocklist: true, // REMOVED: field no longer exists
                    url: true,
                    welcomeMessage: true,
                    allowedExternalLinks: true, // 🛡️ Security
                    // 🆕 Channel Configuration (Feature 199)
                    sellsProductsAndServices: true,
                    hasSalesAgents: true,
                    hasHumanSupport: true,
                    humanSupportInstructions: true,
                    operatorContactMethod: true,
                    operatorWhatsappNumber: true,
                    toneOfVoice: true,
                    botIdentityResponse: true,
                    address: true,
                    customAiRules: true,
                    // 🆕 Translation Settings
                    translateProductNames: true,
                    translateCategoryNames: true,
                    translateServiceNames: true,
                    catalogBaseLanguage: true,
                },
            });
            if (!workspace)
                return null;
            // 2. Query SEPARATA per agentConfigs con FILTRO ESPLICITO per workspaceId
            const agentConfigs = yield database_1.prisma.agentConfig.findMany({
                where: {
                    workspaceId: id, // ← FILTRO ESPLICITO per workspaceId!
                    isActive: true,
                },
                select: {
                    id: true,
                    model: true,
                    temperature: true,
                    maxTokens: true,
                    systemPrompt: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { updatedAt: "desc" },
                take: 1,
            });
            // 🚨 CRITICAL DEBUG: Log what we found
            logger_1.default.info(`🔍 WORKSPACE.SERVICE: Loading AgentConfigs for workspace ${id}`);
            logger_1.default.info(`📋 Found ${agentConfigs.length} active AgentConfigs:`);
            agentConfigs.forEach((config, index) => {
                var _a;
                logger_1.default.info(`  [${index}] ID: ${(_a = config.id) === null || _a === void 0 ? void 0 : _a.substring(0, 8)}..., Model: ${config.model}, Temp: ${config.temperature}, Updated: ${config.updatedAt}`);
            });
            // 3. Combina i risultati
            return Object.assign(Object.assign({}, workspace), { agentConfigs });
        });
    },
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return database_1.prisma.workspace.create({
                data: Object.assign(Object.assign({}, data), { slug: data.name.toLowerCase().replace(/\s+/g, "-"), isDelete: false }),
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    whatsappPhoneNumber: true,
                    whatsappApiKey: true,
                    createdAt: true,
                    updatedAt: true,
                    isActive: true,
                    isDelete: true,
                    currency: true,
                    language: true,
                    messageLimit: true,
                    channelStatus: true,
                    wipMessage: true,
                    // blocklist: true, // REMOVED: field no longer exists
                    url: true,
                    welcomeMessage: true,
                },
            });
        });
    },
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Separate fields that shouldn't go to Prisma directly
            const _a = data, { adminEmail, challengeStatus, id: _id } = _a, // Remove id if present (shouldn't update primary key)
            workspaceData = __rest(_a, ["adminEmail", "challengeStatus", "id"]);
            // 🔄 Map challengeStatus → channelStatus (frontend uses different name than DB)
            if (challengeStatus !== undefined) {
                workspaceData.channelStatus = challengeStatus;
            }
            // 🔍 LOG DETTAGLIATO per debug
            logger_1.default.info("=== WORKSPACE UPDATE DEBUG ===");
            logger_1.default.info("Workspace ID:", id);
            logger_1.default.info("Data received:", JSON.stringify(data, null, 2));
            logger_1.default.info("challengeStatus from frontend:", challengeStatus);
            logger_1.default.info("channelStatus mapped to:", workspaceData.channelStatus);
            logger_1.default.info("whatsappApiKey in data:", data.whatsappApiKey ? "✅ PRESENTE" : "❌ ASSENTE");
            logger_1.default.info("Final workspaceData for Prisma:", JSON.stringify(workspaceData, null, 2));
            // Update workspace data
            const updatedWorkspace = yield database_1.prisma.workspace.update({
                where: { id },
                data: Object.assign(Object.assign({}, workspaceData), { slug: workspaceData.name
                        ? workspaceData.name.toLowerCase().replace(/\s+/g, "-")
                        : undefined }),
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    whatsappPhoneNumber: true,
                    whatsappApiKey: true,
                    createdAt: true,
                    updatedAt: true,
                    isActive: true,
                    isDelete: true,
                    currency: true,
                    language: true,
                    messageLimit: true,
                    channelStatus: true,
                    wipMessage: true,
                    // blocklist: true, // REMOVED: field no longer exists
                    url: true,
                    welcomeMessage: true,
                    allowedExternalLinks: true, // 🛡️ Security
                    // 🆕 Channel Configuration (Feature 199)
                    sellsProductsAndServices: true,
                    hasSalesAgents: true,
                    hasHumanSupport: true,
                    humanSupportInstructions: true,
                    operatorContactMethod: true,
                    operatorWhatsappNumber: true,
                    toneOfVoice: true,
                    botIdentityResponse: true,
                    address: true,
                    customAiRules: true,
                    // 🆕 Translation Settings
                    translateProductNames: true,
                    translateCategoryNames: true,
                    translateServiceNames: true,
                    catalogBaseLanguage: true,
                },
            });
            // 🔍 LOG RISULTATO UPDATE
            logger_1.default.info("=== WORKSPACE AFTER UPDATE ===");
            logger_1.default.info("Updated whatsappApiKey:", updatedWorkspace.whatsappApiKey ? "✅ SALVATA" : "❌ NULL");
            logger_1.default.info("Updated workspace:", JSON.stringify(updatedWorkspace, null, 2));
            // Update adminEmail in WhatsappSettings if provided
            if (adminEmail !== undefined) {
                yield database_1.prisma.whatsappSettings.upsert({
                    where: {
                        workspaceId: id,
                    },
                    create: {
                        workspaceId: id,
                        phoneNumber: updatedWorkspace.whatsappPhoneNumber || "",
                        apiKey: updatedWorkspace.whatsappApiKey || "",
                        adminEmail: adminEmail,
                    },
                    update: {
                        adminEmail: adminEmail,
                    },
                });
            }
            // Return workspace with adminEmail included
            const whatsappSettings = yield database_1.prisma.whatsappSettings.findUnique({
                where: { workspaceId: id },
            });
            return Object.assign(Object.assign({}, updatedWorkspace), { adminEmail: (whatsappSettings === null || whatsappSettings === void 0 ? void 0 : whatsappSettings.adminEmail) || null });
        });
    },
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            // Soft-delete: set deletedAt instead of isDelete
            // Record will be hard-deleted after 90 days by scheduler
            return database_1.prisma.workspace.update({
                where: { id },
                data: {
                    isDelete: true, // Legacy flag (keep for backward compatibility)
                    deletedAt: new Date(), // New soft-delete timestamp
                },
            });
        });
    },
    /**
     * Get active prompt content for a workspace from agent_configs table
     * 🔒 SECURITY: This reads from the unified agent_configs table (single source of truth)
     * @param workspaceId string
     * @returns string | null
     */
    getActivePromptByWorkspaceId(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const agentConfig = yield database_1.prisma.agentConfig.findFirst({
                where: { workspaceId, isActive: true },
                orderBy: { createdAt: "desc" },
            });
            return (agentConfig === null || agentConfig === void 0 ? void 0 : agentConfig.systemPrompt) || null;
        });
    },
    /**
     * Get workspace URL or return default localhost
     * @param workspaceId string
     * @returns string
     */
    getWorkspaceURL(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield database_1.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { url: true },
            });
            return (workspace === null || workspace === void 0 ? void 0 : workspace.url) || "http://localhost:3000";
        });
    },
};
//# sourceMappingURL=workspace.service.js.map