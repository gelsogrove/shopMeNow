"use strict";
/**
 * OpenAI Agents SDK - Support Tools
 *
 * Tools for customer support: FAQ, human handoff, services.
 *
 * @architecture Clean Architecture - Tools layer
 * @security ALL queries filtered by workspaceId
 * @critical NO hardcoded data - all from database
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
exports.supportTools = exports.getCustomerProfileTool = exports.updateCustomerProfileTool = exports.requestHumanSupportTool = exports.getServicesTool = exports.getFAQCategoriesTool = exports.searchFAQsTool = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const fuse_js_1 = __importDefault(require("fuse.js"));
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Search FAQs
 */
exports.searchFAQsTool = (0, agents_1.tool)({
    name: "search_faqs",
    description: `Search frequently asked questions for answers.
    Use this when the customer asks a general question that might be in the FAQ.`,
    parameters: zod_1.z.object({
        query: zod_1.z.string().describe("Search query or question"),
        category: zod_1.z.string().optional().describe("FAQ category to filter by"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ query, category }, { context }) {
        const ctx = context;
        try {
            logger_1.default.info(`❓ [searchFAQs] Query: "${query}", Category: ${category || "all"}`);
            const whereClause = {
                workspaceId: ctx.workspaceId,
                isActive: true,
            };
            if (category) {
                whereClause.category = category;
            }
            const faqs = yield ctx.prisma.fAQ.findMany({
                where: whereClause,
                orderBy: { order: "asc" },
            });
            if (faqs.length === 0) {
                return {
                    success: true,
                    data: [],
                    message: "Nessuna FAQ disponibile",
                };
            }
            // Fuzzy search
            const fuse = new fuse_js_1.default(faqs, {
                keys: [
                    { name: "question", weight: 0.6 },
                    { name: "answer", weight: 0.3 },
                    { name: "keywords", weight: 0.1 },
                ],
                threshold: 0.4,
                ignoreLocation: true,
                includeScore: true,
            });
            const searchResults = fuse.search(query);
            const results = searchResults.slice(0, 5).map(({ item }) => ({
                id: item.id,
                question: item.question,
                answer: item.answer,
                category: item.category || undefined,
            }));
            return {
                success: true,
                data: results,
                message: results.length > 0
                    ? `Trovate ${results.length} FAQ pertinenti`
                    : "Nessuna FAQ corrispondente trovata",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [searchFAQs] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nella ricerca FAQ",
            };
        }
    }),
});
/**
 * Get all FAQ categories
 */
exports.getFAQCategoriesTool = (0, agents_1.tool)({
    name: "get_faq_categories",
    description: `Get list of FAQ categories.
    Use this to help the customer browse FAQs by topic.`,
    parameters: zod_1.z.object({}),
    execute: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { context }) {
        const ctx = context;
        try {
            const faqs = yield ctx.prisma.fAQ.findMany({
                where: {
                    workspaceId: ctx.workspaceId,
                    isActive: true,
                    category: { not: null },
                },
                select: { category: true },
                distinct: ["category"],
            });
            const categories = faqs
                .map((f) => f.category)
                .filter((c) => c !== null);
            return {
                success: true,
                data: categories,
                message: `${categories.length} categorie FAQ disponibili`,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getFAQCategories] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero categorie FAQ",
            };
        }
    }),
});
/**
 * Get available services
 */
exports.getServicesTool = (0, agents_1.tool)({
    name: "get_services",
    description: `Get list of available services.
    Use this when the customer asks about services offered.`,
    parameters: zod_1.z.object({}),
    execute: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { context }) {
        const ctx = context;
        try {
            const services = yield ctx.prisma.services.findMany({
                where: {
                    workspaceId: ctx.workspaceId,
                    isActive: true,
                },
                orderBy: { name: "asc" },
            });
            const results = services.map((s) => ({
                id: s.id,
                code: s.code,
                name: s.name,
                description: s.description,
                price: s.price,
                duration: s.duration,
                imageUrl: s.imageUrl,
            }));
            return {
                success: true,
                data: results,
                message: results.length > 0
                    ? `${results.length} servizi disponibili`
                    : "Nessun servizio disponibile",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getServices] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero servizi",
            };
        }
    }),
});
/**
 * Request human support
 */
exports.requestHumanSupportTool = (0, agents_1.tool)({
    name: "request_human_support",
    description: `Request to speak with a human operator.
    Use this when the customer explicitly asks to speak with a person/human/operator,
    or when the conversation requires human intervention.`,
    parameters: zod_1.z.object({
        reason: zod_1.z.string().describe("Reason for requesting human support"),
        urgency: zod_1.z.enum(["low", "medium", "high"]).default("medium").describe("Urgency level"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ reason, urgency }, { context }) {
        const ctx = context;
        try {
            logger_1.default.info(`👤 [requestHumanSupport] Customer: ${ctx.customerId}, Reason: ${reason}`);
            // Get workspace settings for human support
            const workspace = yield ctx.prisma.workspace.findUnique({
                where: { id: ctx.workspaceId },
                select: {
                    hasHumanSupport: true,
                    humanSupportInstructions: true,
                    operatorContactMethod: true,
                    operatorWhatsappNumber: true,
                    notificationEmail: true,
                },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.hasHumanSupport)) {
                return {
                    success: false,
                    error: "Human support not available",
                    message: "Il supporto umano non è disponibile per questo canale. Posso aiutarti in altro modo?",
                };
            }
            // Create support ticket/notification
            // In a real implementation, this would:
            // 1. Send notification to operator (email/WhatsApp)
            // 2. Create a support ticket in the system
            // 3. Queue the customer for human callback
            const ticketId = `TKT-${Date.now()}`;
            // Log the support request
            yield ctx.prisma.agentConversationLog.create({
                data: {
                    workspaceId: ctx.workspaceId,
                    customerId: ctx.customerId,
                    conversationId: ctx.conversationId,
                    messageId: ticketId,
                    step: 1,
                    agentType: "HUMAN_SUPPORT",
                    agentAction: "request_handoff",
                    inputMessage: reason,
                    llmResponse: `Human support requested. Ticket: ${ticketId}`,
                    hasError: false,
                },
            });
            let responseMessage = workspace.humanSupportInstructions
                || "La tua richiesta è stata inoltrata a un operatore. Sarai contattato al più presto.";
            if (workspace.operatorContactMethod === "whatsapp" && workspace.operatorWhatsappNumber) {
                responseMessage += ` Puoi anche contattare direttamente: ${workspace.operatorWhatsappNumber}`;
            }
            return {
                success: true,
                data: {
                    success: true,
                    ticketId,
                    message: responseMessage,
                    estimatedWaitTime: urgency === "high" ? "5-10 minuti" : "15-30 minuti",
                },
                message: responseMessage,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [requestHumanSupport] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nella richiesta di supporto umano",
            };
        }
    }),
});
/**
 * Update customer profile
 */
exports.updateCustomerProfileTool = (0, agents_1.tool)({
    name: "update_customer_profile",
    description: `Update customer profile information.
    Use this when the customer wants to update their email, phone, name, or address.`,
    parameters: zod_1.z.object({
        name: zod_1.z.string().optional().describe("Customer name"),
        email: zod_1.z.string().email().optional().describe("Customer email"),
        phone: zod_1.z.string().optional().describe("Customer phone"),
        address: zod_1.z.string().optional().describe("Customer address"),
        language: zod_1.z.string().optional().describe("Preferred language code (ENG, ITA, ESP, POR)"),
    }),
    execute: (_a, _b) => __awaiter(void 0, [_a, _b], void 0, function* ({ name, email, phone, address, language }, { context }) {
        const ctx = context;
        try {
            // Verify customer exists and belongs to workspace
            const customer = yield ctx.prisma.customers.findFirst({
                where: {
                    id: ctx.customerId,
                    workspaceId: ctx.workspaceId,
                },
            });
            if (!customer) {
                return {
                    success: false,
                    error: "Customer not found",
                    message: "Profilo cliente non trovato",
                };
            }
            const updateData = {};
            if (name)
                updateData.name = name;
            if (email)
                updateData.email = email;
            if (phone)
                updateData.phone = phone;
            if (address)
                updateData.address = address;
            if (language)
                updateData.language = language;
            if (Object.keys(updateData).length === 0) {
                return {
                    success: false,
                    error: "No fields to update",
                    message: "Nessun dato da aggiornare",
                };
            }
            yield ctx.prisma.customers.update({
                where: { id: ctx.customerId },
                data: updateData,
            });
            const updatedFields = Object.keys(updateData).join(", ");
            return {
                success: true,
                data: true,
                message: `Profilo aggiornato: ${updatedFields}`,
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [updateCustomerProfile] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nell'aggiornamento del profilo",
            };
        }
    }),
});
/**
 * Get customer profile
 */
exports.getCustomerProfileTool = (0, agents_1.tool)({
    name: "get_customer_profile",
    description: `Get current customer profile information.
    Use this when the customer asks about their account details or profile.`,
    parameters: zod_1.z.object({}),
    execute: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { context }) {
        const ctx = context;
        try {
            const customer = yield ctx.prisma.customers.findFirst({
                where: {
                    id: ctx.customerId,
                    workspaceId: ctx.workspaceId,
                },
                select: {
                    name: true,
                    email: true,
                    phone: true,
                    address: true,
                    language: true,
                    discount: true,
                    createdAt: true,
                },
            });
            if (!customer) {
                return {
                    success: false,
                    error: "Customer not found",
                    message: "Profilo non trovato",
                };
            }
            return {
                success: true,
                data: {
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone || "Non specificato",
                    address: customer.address || "Non specificato",
                    language: customer.language,
                    discount: customer.discount ? `${customer.discount}%` : "Nessuno",
                    memberSince: customer.createdAt.toLocaleDateString("it-IT"),
                },
                message: "Profilo cliente recuperato",
            };
        }
        catch (error) {
            logger_1.default.error(`❌ [getCustomerProfile] Error:`, error);
            return {
                success: false,
                error: error.message,
                message: "Errore nel recupero del profilo",
            };
        }
    }),
});
// Export all support tools
exports.supportTools = [
    exports.searchFAQsTool,
    exports.getFAQCategoriesTool,
    exports.getServicesTool,
    exports.requestHumanSupportTool,
    exports.updateCustomerProfileTool,
    exports.getCustomerProfileTool,
];
//# sourceMappingURL=support.tools.js.map