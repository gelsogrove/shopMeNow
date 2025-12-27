"use strict";
/**
 * VariableResolverService - Collect all variables for prompt templates
 *
 * Single Responsibility: Gather all 35+ variables from database.
 * Variables come from: workspace config, customer data, dynamic content.
 *
 * @architecture Part of PromptBuilder system
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
exports.VariableResolverService = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
class VariableResolverService {
    constructor(prisma) {
        this.prisma = prisma;
        logger_1.default.info("✅ VariableResolverService initialized");
    }
    /**
     * Resolve all variables needed for a specific agent
     *
     * @param agentType - Which agent needs variables
     * @param workspaceId - Workspace to get data from
     * @param customerId - Customer context (optional)
     * @returns All resolved variables
     */
    resolve(agentType, workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`🔍 Resolving variables for ${agentType}`, { workspaceId, customerId });
            const variables = {};
            // Always load workspace config
            yield this.loadWorkspaceConfig(workspaceId, variables);
            // Load customer context if customerId provided
            if (customerId) {
                yield this.loadCustomerContext(workspaceId, customerId, variables);
            }
            // Load agent-specific dynamic data
            yield this.loadDynamicData(agentType, workspaceId, customerId, variables);
            logger_1.default.info(`✅ Resolved ${Object.keys(variables).length} variables for ${agentType}`);
            return variables;
        });
    }
    /**
     * Load workspace configuration variables
     */
    loadWorkspaceConfig(workspaceId, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    name: true,
                    url: true,
                    language: true,
                    currency: true,
                    toneOfVoice: true,
                    botIdentityResponse: true,
                    welcomeMessage: true,
                    wipMessage: true,
                    sellsProductsAndServices: true,
                    hasHumanSupport: true,
                    hasSalesAgents: true,
                    humanSupportInstructions: true,
                    frustrationEscalationInstructions: true, // 🆕 Feature 203
                    operatorContactMethod: true,
                    operatorWhatsappNumber: true,
                    allowedExternalLinks: true,
                    customAiRules: true,
                    notificationEmail: true,
                    address: true,
                },
            });
            if (!workspace) {
                throw new Error(`Workspace not found: ${workspaceId}`);
            }
            variables.workspaceName = workspace.name || "";
            variables.workspaceUrl = workspace.url || "";
            variables.language = workspace.language || "ITA";
            variables.currency = workspace.currency || "EUR";
            variables.toneOfVoice = workspace.toneOfVoice || "friendly";
            variables.botIdentityResponse = workspace.botIdentityResponse || "";
            variables.welcomeMessage = typeof workspace.welcomeMessage === 'string'
                ? workspace.welcomeMessage
                : JSON.stringify(workspace.welcomeMessage || "");
            variables.wipMessage = typeof workspace.wipMessage === 'string'
                ? workspace.wipMessage
                : JSON.stringify(workspace.wipMessage || "");
            variables.sellsProductsAndServices = (_a = workspace.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true;
            variables.hasHumanSupport = (_b = workspace.hasHumanSupport) !== null && _b !== void 0 ? _b : true;
            variables.hasSalesAgents = (_c = workspace.hasSalesAgents) !== null && _c !== void 0 ? _c : false;
            variables.humanSupportInstructions = workspace.humanSupportInstructions || "";
            variables.frustrationEscalationInstructions = workspace.frustrationEscalationInstructions || ""; // 🆕 Feature 203
            variables.operatorContactMethod = workspace.operatorContactMethod || "email";
            variables.operatorWhatsappNumber = workspace.operatorWhatsappNumber || "";
            variables.allowedExternalLinks = Array.isArray(workspace.allowedExternalLinks)
                ? workspace.allowedExternalLinks.join("\n")
                : "";
            variables.customAiRules = workspace.customAiRules || "";
            variables.adminEmail = workspace.notificationEmail || "";
            variables.address = workspace.address || "";
        });
    }
    /**
     * Load customer context variables
     */
    loadCustomerContext(workspaceId, customerId, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const customer = yield this.prisma.customers.findFirst({
                where: { id: customerId, workspaceId },
                include: { sales: true },
            });
            if (!customer) {
                logger_1.default.warn(`Customer not found: ${customerId}`);
                variables.customerName = "Customer";
                variables.customerEmail = "";
                variables.customerPhone = "";
                variables.customerDiscount = 0;
                variables.pushNotificationsConsent = false;
                variables.languageUser = variables.language || "it";
                return;
            }
            variables.customerName = customer.name || "Customer";
            variables.customerEmail = customer.email || "";
            variables.customerPhone = customer.phone || "";
            variables.customerDiscount = customer.discount || 0;
            variables.pushNotificationsConsent = (_a = customer.push_notifications_consent) !== null && _a !== void 0 ? _a : false;
            variables.languageUser = this.getLanguageDisplayName(customer.language || variables.language || "it");
            // Sales agent info
            if (customer.sales) {
                variables.agentName = `${customer.sales.firstName || ""} ${customer.sales.lastName || ""}`.trim();
                variables.agentPhone = customer.sales.phone || "";
                variables.agentEmail = customer.sales.email || "";
            }
            else {
                variables.agentName = "Not assigned";
                variables.agentPhone = "";
                variables.agentEmail = "";
            }
            // Last order
            const lastOrder = yield this.prisma.orders.findFirst({
                where: { customerId: customer.id },
                orderBy: { createdAt: "desc" },
                select: { orderCode: true },
            });
            variables.lastOrderCode = (lastOrder === null || lastOrder === void 0 ? void 0 : lastOrder.orderCode) || "";
        });
    }
    /**
     * Load dynamic data based on agent type
     */
    loadDynamicData(agentType, workspaceId, customerId, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            const typeKey = String(agentType);
            // Product Search needs: PRODUCTS, SERVICES, CATEGORIES, OFFERS
            if (typeKey === "PRODUCT_SEARCH") {
                const [products, services, categories, offers] = yield Promise.all([
                    this.getActiveProducts(workspaceId, variables.customerDiscount || 0),
                    this.getActiveServices(workspaceId),
                    this.getActiveCategories(workspaceId),
                    this.getActiveOffers(workspaceId),
                ]);
                variables.products = products;
                variables.services = services;
                variables.categories = categories;
                variables.offers = offers;
                variables.productsCount = products.split("\n").filter(l => l.trim()).length;
                variables.offersActive = offers.length > 0;
            }
            // Order Tracking needs: lastOrder
            if (typeKey === "ORDER_TRACKING" && customerId) {
                variables.lastOrder = yield this.getLastOrderDetails(workspaceId, customerId);
            }
            // Router needs to know what's available AND have FAQ content
            if (typeKey === "ROUTER") {
                const [faqContent, faqCount, productsCount, offersCount] = yield Promise.all([
                    this.getActiveFaqs(workspaceId), // 🆕 Load actual FAQ content for Router
                    this.prisma.fAQ.count({ where: { workspaceId, isActive: true } }),
                    this.prisma.products.count({ where: { workspaceId, isActive: true } }),
                    this.prisma.offers.count({ where: { workspaceId, isActive: true } }),
                ]);
                variables.faq = faqContent; // 🆕 FAQ content for template {{faq}}
                variables.faqCount = faqCount;
                variables.productsCount = productsCount;
                variables.offersActive = offersCount > 0;
            }
        });
    }
    /**
     * Get active products formatted for prompt
     */
    getActiveProducts(workspaceId, discount) {
        return __awaiter(this, void 0, void 0, function* () {
            const products = yield this.prisma.products.findMany({
                where: { workspaceId, isActive: true },
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    price: true,
                    description: true,
                    category: { select: { name: true } },
                },
                take: 100, // Limit to avoid huge prompts
            });
            if (products.length === 0)
                return "No products available.";
            return products.map(p => {
                var _a;
                const discountedPrice = discount > 0
                    ? (Number(p.price) * (1 - discount / 100)).toFixed(2)
                    : Number(p.price).toFixed(2);
                return `- ${p.name} (${p.sku}): €${discountedPrice} - ${((_a = p.category) === null || _a === void 0 ? void 0 : _a.name) || "Uncategorized"}`;
            }).join("\n");
        });
    }
    /**
     * Get active services formatted for prompt
     */
    getActiveServices(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const services = yield this.prisma.services.findMany({
                where: { workspaceId, isActive: true },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    price: true,
                    description: true,
                },
                take: 50,
            });
            if (services.length === 0)
                return "No services available.";
            return services.map(s => `- ${s.name} (${s.code}): €${Number(s.price).toFixed(2)}`).join("\n");
        });
    }
    /**
     * Get active categories formatted for prompt
     */
    getActiveCategories(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const categories = yield this.prisma.categories.findMany({
                where: { workspaceId, isActive: true },
                select: { name: true },
            });
            if (categories.length === 0)
                return "No categories.";
            return categories.map(c => `- ${c.name}`).join("\n");
        });
    }
    /**
     * Get active offers formatted for prompt
     */
    getActiveOffers(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const offers = yield this.prisma.offers.findMany({
                where: {
                    workspaceId,
                    isActive: true,
                    startDate: { lte: now },
                    endDate: { gte: now },
                },
                select: {
                    name: true,
                    discountPercent: true,
                    description: true,
                },
                take: 20,
            });
            if (offers.length === 0)
                return "No active offers.";
            return offers.map(o => `- ${o.name}: ${o.discountPercent}% off - ${o.description || ""}`).join("\n");
        });
    }
    /**
     * Get last order details for customer
     */
    getLastOrderDetails(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield this.prisma.orders.findFirst({
                where: { customerId, workspaceId },
                orderBy: { createdAt: "desc" },
                include: {
                    items: {
                        include: { product: true },
                    },
                },
            });
            if (!order)
                return "No previous orders.";
            const items = order.items.map(i => { var _a; return `- ${((_a = i.product) === null || _a === void 0 ? void 0 : _a.name) || "Item"} x${i.quantity}: €${Number(i.unitPrice).toFixed(2)}`; }).join("\n");
            return `Order: ${order.orderCode}
Date: ${order.createdAt.toLocaleDateString()}
Status: ${order.status}
Total: €${Number(order.totalAmount).toFixed(2)}
Items:
${items}`;
        });
    }
    /**
     * Convert language code to display name
     */
    getLanguageDisplayName(code) {
        const map = {
            it: "Italian",
            en: "English",
            es: "Spanish",
            fr: "French",
            de: "German",
            pt: "Portuguese",
            ITA: "Italian",
            ENG: "English",
            SPA: "Spanish",
            FRA: "French",
            DEU: "German",
            POR: "Portuguese",
        };
        return map[code] || code;
    }
    /**
     * Get active FAQs formatted for prompt
     * Used by Router to answer FAQ questions directly
     */
    getActiveFaqs(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const faqs = yield this.prisma.fAQ.findMany({
                where: { workspaceId, isActive: true },
                select: {
                    question: true,
                    answer: true,
                },
                take: 50, // Limit to avoid huge prompts
            });
            if (faqs.length === 0)
                return "No FAQs available.";
            return faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
        });
    }
}
exports.VariableResolverService = VariableResolverService;
//# sourceMappingURL=variable-resolver.service.js.map