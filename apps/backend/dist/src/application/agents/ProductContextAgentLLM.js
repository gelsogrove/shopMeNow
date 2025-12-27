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
exports.ProductContextAgentLLM = void 0;
const axios_1 = __importDefault(require("axios"));
const template_loader_service_1 = require("../services/template-loader.service");
const prompt_processor_service_1 = require("../../services/prompt-processor.service");
const logger_1 = __importDefault(require("../../utils/logger"));
const pricing_1 = require("@shared/pricing");
const formatProductPrice = (value) => (0, pricing_1.formatRoundedCurrency)(value !== null && value !== void 0 ? value : 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useSmartRound: true,
    step: pricing_1.DEFAULT_ROUNDING_STEP,
});
class ProductContextAgentLLM {
    constructor(prisma) {
        this.prisma = prisma;
        this.templateLoader = template_loader_service_1.TemplateLoaderService.getInstance(prisma);
        this.promptProcessor = new prompt_processor_service_1.PromptProcessorService();
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        if (!this.openRouterApiKey) {
            throw new Error("OPENROUTER_API_KEY is required for ProductContextAgentLLM");
        }
    }
    /**
     * Get relative image path (frontend will resolve with IMG_BASE_URL)
     */
    getFullImageUrl(imageUrl) {
        if (!imageUrl)
            return "N/A";
        // If already absolute URL, extract just the path
        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
            try {
                const url = new URL(imageUrl);
                return url.pathname; // Extract /uploads/products/...
            }
            catch (_a) {
                return imageUrl;
            }
        }
        // Ensure path starts with /
        return imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    }
    handleQuestion(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            const start = Date.now();
            try {
                logger_1.default.info("🧀 ProductContextAgentLLM: handling question", {
                    workspaceId: input.workspaceId,
                    customerId: input.customerId,
                    productId: (_a = input.product) === null || _a === void 0 ? void 0 : _a.id,
                });
                if (!input.product || !input.product.name) {
                    throw new Error("Product data is required for ProductContextAgentLLM");
                }
                const template = yield this.templateLoader.loadAndRenderTemplate("PRODUCT_CONTEXT", input.workspaceId);
                const workspaceName = ((_b = input.workspaceInfo) === null || _b === void 0 ? void 0 : _b.name) ||
                    ((_c = (yield this.prisma.workspace.findUnique({
                        where: { id: input.workspaceId },
                        select: { name: true },
                    }))) === null || _c === void 0 ? void 0 : _c.name) ||
                    "Il nostro shop";
                const customerDataForPrompt = {
                    nameUser: input.customerName || "Cliente",
                    email: "",
                    phone: "",
                    discountUser: input.customerDiscount || 0,
                    companyName: workspaceName,
                    lastordercode: "",
                    languageUser: input.customerLanguage || "it",
                    agentName: "Non assegnato",
                    agentPhone: "N/A",
                    agentEmail: "N/A",
                    botIdentityResponse: ((_d = input.workspaceInfo) === null || _d === void 0 ? void 0 : _d.botIdentityResponse) || "",
                };
                const workspaceConfig = {
                    customAiRules: ((_e = input.workspaceInfo) === null || _e === void 0 ? void 0 : _e.customAiRules) || "",
                    botIdentityResponse: ((_f = input.workspaceInfo) === null || _f === void 0 ? void 0 : _f.botIdentityResponse) || "",
                    sellsProductsAndServices: (_h = (_g = input.workspaceInfo) === null || _g === void 0 ? void 0 : _g.sellsProductsAndServices) !== null && _h !== void 0 ? _h : true,
                    address: ((_j = input.workspaceInfo) === null || _j === void 0 ? void 0 : _j.address) || "",
                };
                const processedPrompt = yield this.promptProcessor.preProcessPrompt(template, input.workspaceId, customerDataForPrompt, {
                    faqs: "",
                    products: "",
                    categories: "",
                    services: "",
                    offers: "",
                }, undefined, workspaceConfig);
                const finalPrompt = this.injectProductData(processedPrompt, input.product);
                const messages = [
                    { role: "system", content: finalPrompt },
                ];
                if ((_k = input.conversationHistory) === null || _k === void 0 ? void 0 : _k.length) {
                    input.conversationHistory.slice(-4).forEach((msg) => {
                        messages.push({
                            role: msg.role,
                            content: msg.content.slice(0, 500),
                        });
                    });
                }
                messages.push({
                    role: "user",
                    content: input.question,
                });
                const response = yield axios_1.default.post(`${this.openRouterBaseUrl}/chat/completions`, {
                    model: "openai/gpt-4o-mini",
                    temperature: 0.2,
                    messages,
                }, {
                    headers: {
                        Authorization: `Bearer ${this.openRouterApiKey}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 1000 * 20,
                });
                let content = ((_q = (_p = (_o = (_m = (_l = response.data) === null || _l === void 0 ? void 0 : _l.choices) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.message) === null || _p === void 0 ? void 0 : _p.content) === null || _q === void 0 ? void 0 : _q.trim()) || "";
                const usage = (_r = response.data) === null || _r === void 0 ? void 0 : _r.usage;
                // Post-process: ensure img tag is complete
                // LLM sometimes outputs: URL" alt="Name" /> instead of <img src="URL" alt="Name" />
                const fullImageUrl = this.getFullImageUrl(input.product.imageUrl);
                logger_1.default.info("🖼️ ProductContextAgent: Checking image URL", {
                    fullImageUrl,
                    hasUrlInContent: content.includes(fullImageUrl),
                    contentPreview: content.substring(0, 300),
                });
                if (fullImageUrl !== "N/A" && content.includes(fullImageUrl)) {
                    // Check if it's already correct (has <img src=" before URL)
                    const correctPattern = `<img src="${fullImageUrl}"`;
                    if (!content.includes(correctPattern)) {
                        logger_1.default.info("🔧 Img tag is malformed, attempting fix...");
                        // Replace the broken pattern: URL" alt="X" /> → <img src="URL" alt="X" />
                        // Match: URL followed by " alt=" and anything until />
                        const escapedUrl = fullImageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const brokenPattern = new RegExp(`${escapedUrl}"\\s*alt="([^"]*)"\\s*/>`, 'g');
                        const newContent = content.replace(brokenPattern, `<img src="${fullImageUrl}" alt="$1" />`);
                        if (newContent !== content) {
                            content = newContent;
                            logger_1.default.info("✅ Fixed malformed img tag in ProductContextAgent response");
                        }
                        else {
                            // Try simpler approach: just wrap the URL with img tag if it appears on its own line
                            const simplePattern = new RegExp(`^(${escapedUrl})`, 'gm');
                            content = content.replace(simplePattern, `<img src="$1" alt="${input.product.name}" />`);
                            logger_1.default.info("✅ Applied simple img tag wrapper");
                        }
                    }
                }
                return {
                    success: true,
                    output: content,
                    tokensUsed: (usage === null || usage === void 0 ? void 0 : usage.total_tokens) || 0,
                    executionTimeMs: Date.now() - start,
                    systemPrompt: finalPrompt,
                    model: "openai/gpt-4o-mini",
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;
                logger_1.default.error("❌ ProductContextAgentLLM failed", {
                    error: errorMessage,
                    stack: errorStack,
                    workspaceId: input.workspaceId,
                    productId: (_s = input.product) === null || _s === void 0 ? void 0 : _s.id,
                    productName: (_t = input.product) === null || _t === void 0 ? void 0 : _t.name,
                });
                return {
                    success: false,
                    output: "Mi dispiace, non riesco a recuperare altre informazioni su questo prodotto in questo momento.",
                    tokensUsed: 0,
                    executionTimeMs: Date.now() - start,
                };
            }
        });
    }
    injectProductData(prompt, product) {
        var _a, _b, _c, _d, _e;
        const replaceAll = (text, key, value) => text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "N/A");
        const formatList = (items) => items && items.length ? items.join(", ") : "N/A";
        const facts = [];
        if (product.description)
            facts.push(`Descrizione: ${product.description}`);
        if (product.region)
            facts.push(`Origine: ${product.region}`);
        if (product.format)
            facts.push(`Formato: ${product.format}`);
        if ((_a = product.certifications) === null || _a === void 0 ? void 0 : _a.length)
            facts.push(`Certificazioni: ${product.certifications.join(", ")}`);
        if (product.transportType)
            facts.push(`Trasporto: ${product.transportType}`);
        if ((_b = product.ingredients) === null || _b === void 0 ? void 0 : _b.length)
            facts.push(`Ingredienti: ${product.ingredients.join(", ")}`);
        if ((_c = product.tags) === null || _c === void 0 ? void 0 : _c.length)
            facts.push(`Note: ${product.tags.join(", ")}`);
        if (product.storageInfo)
            facts.push(`Conservazione: ${product.storageInfo}`);
        if ((_d = product.allergens) === null || _d === void 0 ? void 0 : _d.length)
            facts.push(`Allergeni: ${product.allergens.join(", ")}`);
        if ((_e = product.pairingSuggestions) === null || _e === void 0 ? void 0 : _e.length)
            facts.push(`Abbinamenti consigliati: ${product.pairingSuggestions.join(", ")}`);
        const formattedFacts = facts.length > 0
            ? `\n## 📌 DETTAGLI DISPONIBILI\n${facts.map((item) => `- ${item}`).join("\n")}`
            : "\n## 📌 DETTAGLI DISPONIBILI\n- Nessun dettaglio aggiuntivo fornito dal catalogo.";
        let result = prompt;
        result = replaceAll(result, "PRODUCT_NAME", product.name || "Prodotto");
        result = replaceAll(result, "PRODUCT_DESCRIPTION", product.description || "N/A");
        const priceText = typeof product.price === "number" && Number.isFinite(product.price)
            ? formatProductPrice(product.price)
            : "N/A";
        result = replaceAll(result, "PRODUCT_PRICE", priceText);
        result = replaceAll(result, "PRODUCT_REGION", product.region || "N/A");
        result = replaceAll(result, "PRODUCT_CERTIFICATIONS", formatList(product.certifications));
        result = replaceAll(result, "PRODUCT_TRANSPORT", product.transportType || "N/A");
        result = replaceAll(result, "PRODUCT_INGREDIENTS", formatList(product.ingredients));
        result = replaceAll(result, "PRODUCT_TAGS", formatList(product.tags));
        result = replaceAll(result, "PRODUCT_STORAGE", product.storageInfo || "N/A");
        result = replaceAll(result, "PRODUCT_PAIRINGS", formatList(product.pairingSuggestions));
        result = replaceAll(result, "PRODUCT_IMAGE_URL", this.getFullImageUrl(product.imageUrl));
        result = result.replace("{{PRODUCT_FACTS}}", formattedFacts);
        return result;
    }
}
exports.ProductContextAgentLLM = ProductContextAgentLLM;
//# sourceMappingURL=ProductContextAgentLLM.js.map