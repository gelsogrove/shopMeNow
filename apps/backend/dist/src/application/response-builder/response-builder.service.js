"use strict";
/**
 * ResponseBuilder Service - Code-First LLM Architecture
 *
 * RESPONSIBILITY: Deterministic logic for formatting responses
 *
 * PRINCIPLES:
 * - ALL decisions are made by CODE, not LLM
 * - Grouping rules: >10 products → group by category
 * - Count display: always show (N items)
 * - Numeric options: numbered list for selection
 * - NO LLM calls in this service
 *
 * OUTPUT: StructuredResponse ready for LLMFormatter
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseBuilderService = exports.RESPONSE_DEFAULT_FORMATTING = void 0;
exports.getResponseBuilder = getResponseBuilder;
const logger_1 = __importDefault(require("../../utils/logger"));
// ================================================================================
// DEFAULT FORMATTING
// ================================================================================
exports.RESPONSE_DEFAULT_FORMATTING = {
    showNumbers: true,
    showPrices: true,
    showStock: false, // Only show for cart
    showTotal: true,
    groupByCategory: false,
    includeEmoji: true,
    maxItemsBeforeGroup: 5, // AC-10: 6+ prodotti = grouping (soglia = 5, quindi >5 = group)
};
const DEFAULT_FORMATTING = exports.RESPONSE_DEFAULT_FORMATTING;
// ================================================================================
// RESPONSE BUILDER SERVICE
// ================================================================================
class ResponseBuilderService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Main entry point - build structured response from loaded data
     *
     * 🆕 enrichmentOptions: Pass conversation history for contextual enrichment
     */
    build(intent, loadedData, options, enrichmentOptions) {
        logger_1.default.info("🏗️ [ResponseBuilder] Building response", {
            intentType: intent.type,
            dataType: loadedData.type,
            customerDiscount: options.customerDiscount,
        });
        const discountPercent = options.customerDiscount || 0;
        const context = {
            intentType: intent.type,
            customerLanguage: options.customerLanguage || "it",
            hasDiscount: discountPercent > 0,
            discountPercent,
            customerName: options.customerName,
            showOptimizeOption: options.showOptimizeOption,
            disableGrouping: options.disableGrouping,
            userMessage: options.userMessage,
            enableCategoryRanking: options.enableCategoryRanking,
        };
        // Handle errors first
        if (loadedData.type === "ERROR") {
            return this.buildErrorResponse(loadedData.error, context);
        }
        // Build response based on data type
        switch (loadedData.type) {
            case "CATEGORIES":
                return this.buildCategoryList(loadedData.categories, context);
            case "PRODUCTS":
                return this.buildProductList(loadedData.products, context);
            case "PRODUCT_DETAIL":
                return this.buildProductDetail(loadedData.product, context);
            case "SERVICES":
                return this.buildServiceList(loadedData.services, context);
            case "SERVICE_DETAIL":
                return this.buildServiceDetail(loadedData.service, context);
            case "CART":
                return this.buildCartResponse(loadedData.cart, context);
            case "ORDER_LIST":
                return this.buildOrderList(loadedData.orders, context);
            case "ORDER_DETAIL":
                return this.buildOrderDetail(loadedData.order, context);
            case "IDENTITY":
                return this.buildIdentityResponse(loadedData.identity, context);
            case "LOCATION":
                return this.buildLocationResponse(loadedData.location, context);
            case "BUSINESS_INFO":
                return this.buildBusinessInfoResponse(loadedData.businessInfo, context);
            case "FAQ":
                return this.buildFAQResponse(loadedData.faqs, loadedData.query, context);
            case "PROFILE":
                return this.buildProfileResponse(loadedData.profile, context);
            case "OFFERS":
                return this.buildOffersResponse(loadedData.offers, context);
            case "OFFER_WITH_PRODUCTS":
                return this.buildOfferWithProductsResponse(loadedData.offer, loadedData.products, context);
            case "ORDER_ACTION":
                return this.buildOrderActionResponse(loadedData.action, context, {
                    orderCode: loadedData.orderCode,
                });
            case "CART_ACTION":
                // CART_ACTION is handled directly in chat-engine, this is a fallback
                return {
                    type: "CART_ACTION",
                    data: { action: loadedData.action },
                    formatting: DEFAULT_FORMATTING,
                    context,
                };
            case "CART_REMOVAL_OPTIONS":
                // CART_REMOVAL_OPTIONS is handled directly in chat-engine, this is a fallback
                // Map CartRemovalItemData[] to ListItem[] (ensuring number is always present)
                return {
                    type: "CART_REMOVAL_OPTIONS",
                    data: {
                        items: (loadedData.items || []).map((item, index) => {
                            var _a;
                            return ({
                                number: (_a = item.number) !== null && _a !== void 0 ? _a : (index + 1),
                                id: item.id,
                                name: item.name,
                                price: item.price,
                            });
                        })
                    },
                    formatting: DEFAULT_FORMATTING,
                    context,
                };
            case "AGENT_INFO":
                return this.buildAgentInfoResponse(loadedData.agentInfo, context);
            case "NEEDS_LLM_CONTEXT":
                // 🧠 Hybrid fallback: inference failed, needs LLM to understand from context
                return {
                    type: "NEEDS_LLM_CONTEXT",
                    data: {
                        label: loadedData.label,
                        originalListType: loadedData.originalListType,
                        inferAttempted: loadedData.inferAttempted,
                    },
                    formatting: DEFAULT_FORMATTING,
                    context,
                };
            case "EMPTY":
                return this.enrichResponse(this.buildEmptyResponse(intent.type, loadedData.reason, context), enrichmentOptions);
            default:
                return this.buildErrorResponse("Unknown data type", context);
        }
    }
    // ================================================================================
    // 🆕 CONTEXTUAL ENRICHMENT - Makes responses more natural and helpful
    // ================================================================================
    /**
     * Enrich a structured response with contextual intelligence
     *
     * Adds:
     * - Clarifying questions when response is ambiguous
     * - Contextual suggestions based on conversation flow
     * - Personalization based on customer history
     * - Tone hints for the LLM formatter
     */
    enrichResponse(response, options) {
        var _a, _b;
        // Skip enrichment if no options provided
        if (!options) {
            return response;
        }
        const enrichment = {};
        let hasEnrichment = false;
        // 1. Add clarifying questions for ambiguous responses
        if (options.enableClarifyingQuestions !== false) {
            const clarifyingQuestion = this.generateClarifyingQuestion(response, options);
            if (clarifyingQuestion) {
                enrichment.clarifyingQuestion = clarifyingQuestion;
                hasEnrichment = true;
            }
        }
        // 2. Add contextual suggestions
        if (options.enableSuggestions !== false) {
            const suggestions = this.generateContextualSuggestions(response, options);
            if (suggestions.length > 0) {
                enrichment.suggestions = suggestions;
                hasEnrichment = true;
            }
        }
        // 3. Add personalization from customer profile
        if (options.enablePersonalization !== false && options.customerProfile) {
            const personalization = this.generatePersonalization(response, options);
            if (personalization) {
                enrichment.personalization = personalization;
                hasEnrichment = true;
            }
        }
        // 4. Add tone hints based on context
        const toneHints = this.generateToneHints(response, options);
        if (toneHints.length > 0) {
            enrichment.toneHints = toneHints;
            hasEnrichment = true;
        }
        // Only add enrichment if we have something
        if (hasEnrichment) {
            logger_1.default.info("✨ [ResponseBuilder] Response enriched", {
                responseType: response.type,
                hasClarifyingQuestion: !!enrichment.clarifyingQuestion,
                suggestionsCount: ((_a = enrichment.suggestions) === null || _a === void 0 ? void 0 : _a.length) || 0,
                hasPersonalization: !!enrichment.personalization,
                toneHintsCount: ((_b = enrichment.toneHints) === null || _b === void 0 ? void 0 : _b.length) || 0,
            });
            return Object.assign(Object.assign({}, response), { enrichment });
        }
        return response;
    }
    /**
     * Generate clarifying question when response has multiple options
     */
    generateClarifyingQuestion(response, options) {
        // Multiple products with similar names → ask for preference
        if (response.type === "PRODUCT_LIST" && response.data.items) {
            const items = response.data.items;
            if (items.length >= 3 && items.length <= 6) {
                // Check if products are similar (same base name)
                const baseNames = items.map(i => i.name.split(" ")[0].toLowerCase());
                const uniqueBaseNames = new Set(baseNames);
                if (uniqueBaseNames.size <= 2) {
                    return "Quale formato preferisci?";
                }
            }
        }
        // Cart is empty → suggest action
        if (response.type === "CART_EMPTY") {
            return "Vuoi vedere i nostri prodotti o le offerte attive?";
        }
        // Search with many results → help narrow down
        if (response.type === "PRODUCT_LIST" && (response.data.count || 0) > 10) {
            return "Posso aiutarti a restringere la ricerca?";
        }
        return undefined;
    }
    /**
     * Generate contextual suggestions based on conversation state
     */
    generateContextualSuggestions(response, options) {
        var _a, _b;
        const suggestions = [];
        // After viewing cart → suggest checkout or continue shopping
        if (response.type === "CART_VIEW" && ((_b = (_a = response.data.cart) === null || _a === void 0 ? void 0 : _a.items) === null || _b === void 0 ? void 0 : _b.length)) {
            suggestions.push({
                text: "Procedi al checkout",
                intent: "CHECKOUT",
                priority: 1,
                emoji: "✅",
            });
            suggestions.push({
                text: "Continua a comprare",
                intent: "SHOW_CATEGORIES",
                priority: 2,
                emoji: "🛒",
            });
        }
        // After viewing categories → suggest offers
        if (response.type === "CATEGORY_LIST") {
            suggestions.push({
                text: "Vedi offerte attive",
                intent: "SHOW_OFFERS",
                priority: 2,
                emoji: "🎁",
            });
        }
        // Product detail → suggest add to cart
        if (response.type === "PRODUCT_DETAIL" && response.data.product) {
            suggestions.push({
                text: "Aggiungi al carrello",
                intent: "ADD_TO_CART",
                priority: 1,
                emoji: "🛒",
            });
            suggestions.push({
                text: "Vedi prodotti simili",
                intent: "SEARCH_PRODUCTS",
                priority: 3,
                emoji: "🔍",
            });
        }
        // After viewing order → suggest actions
        if (response.type === "ORDER_DETAIL") {
            suggestions.push({
                text: "Riordina",
                intent: "REPEAT_ORDER",
                priority: 1,
                emoji: "🔄",
            });
        }
        // Empty results → suggest alternatives
        if (response.type === "NO_RESULTS") {
            suggestions.push({
                text: "Vedi tutti i prodotti",
                intent: "SHOW_PRODUCTS",
                priority: 1,
                emoji: "📦",
            });
            suggestions.push({
                text: "Cerca per categoria",
                intent: "SHOW_CATEGORIES",
                priority: 2,
                emoji: "📁",
            });
        }
        return suggestions.slice(0, 3); // Max 3 suggestions
    }
    /**
     * Generate personalization based on customer history
     */
    generatePersonalization(response, options) {
        var _a, _b;
        const profile = options.customerProfile;
        if (!profile)
            return undefined;
        const personalization = {
            isReturningCustomer: profile.isReturningCustomer,
            totalOrders: profile.totalOrders,
        };
        // Calculate days since last order
        if (profile.lastOrderDate) {
            const daysSince = Math.floor((Date.now() - new Date(profile.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24));
            personalization.daysSinceLastOrder = daysSince;
            // Suggest reorder if it's been a while
            if (daysSince >= 7 && daysSince <= 30) {
                personalization.lastOrderHint = "Come l'ultima volta?";
            }
        }
        // Add frequent products if viewing categories/products
        if ((response.type === "CATEGORY_LIST" || response.type === "PRODUCT_LIST") &&
            ((_a = profile.frequentProducts) === null || _a === void 0 ? void 0 : _a.length)) {
            personalization.frequentProducts = profile.frequentProducts
                .slice(0, 3)
                .map(p => p.name);
        }
        // Add preferred categories
        if ((_b = profile.preferredCategories) === null || _b === void 0 ? void 0 : _b.length) {
            personalization.preferredCategories = profile.preferredCategories.slice(0, 3);
        }
        return personalization;
    }
    /**
     * Generate tone hints for the LLM formatter
     */
    generateToneHints(response, options) {
        var _a, _b, _c, _d;
        const hints = [];
        // First time customer → extra friendly
        if (options.customerProfile && !options.customerProfile.isReturningCustomer) {
            hints.push({
                type: "friendly",
                reason: "first_time_customer",
            });
        }
        // Empty cart → helpful
        if (response.type === "CART_EMPTY") {
            hints.push({
                type: "helpful",
                reason: "empty_cart",
            });
        }
        // Large order (>5 items) → celebratory
        if (response.type === "CART_VIEW") {
            const itemCount = ((_b = (_a = response.data.cart) === null || _a === void 0 ? void 0 : _a.items) === null || _b === void 0 ? void 0 : _b.length) || 0;
            if (itemCount >= 5) {
                hints.push({
                    type: "celebratory",
                    reason: "large_order",
                });
            }
        }
        // Error or no results → apologetic
        if (response.type === "ERROR" || response.type === "NO_RESULTS") {
            hints.push({
                type: "apologetic",
                reason: "no_results_or_error",
            });
        }
        // Returning customer with recent order → familiar
        if (((_c = options.customerProfile) === null || _c === void 0 ? void 0 : _c.isReturningCustomer) &&
            ((_d = options.customerProfile) === null || _d === void 0 ? void 0 : _d.totalOrders) > 3) {
            hints.push({
                type: "friendly",
                reason: "loyal_customer",
            });
        }
        return hints;
    }
    // ================================================================================
    // CATEGORY BUILDERS
    // ================================================================================
    buildCategoryList(categories, context) {
        if (categories.length === 0) {
            return {
                type: "NO_RESULTS",
                data: { errorMessage: "No categories available" },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        const orderedCategories = context.enableCategoryRanking
            ? this.prioritizeCategories(categories, context.userMessage)
            : categories;
        const items = orderedCategories.map((cat, index) => ({
            number: index + 1,
            id: cat.id,
            name: cat.name,
            description: cat.description,
            extra: cat.productCount > 0 ? `${cat.productCount} prodotti` : undefined,
        }));
        return {
            type: "CATEGORY_LIST",
            data: {
                items,
                count: categories.length,
            },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showPrices: false, showStock: false, showTotal: false }),
            context,
        };
    }
    prioritizeCategories(categories, userMessage) {
        if (!userMessage) {
            return categories;
        }
        const tokens = this.tokenizeQuery(userMessage);
        if (tokens.length === 0) {
            return categories;
        }
        const scored = categories.map((category, index) => ({
            category,
            index,
            score: this.calculateCategoryScore(category.name, tokens),
        }));
        const matches = scored.filter((entry) => entry.score > 0);
        const sourceArray = matches.length > 0 ? matches : scored;
        sourceArray.sort((a, b) => {
            if (b.score === a.score) {
                return a.index - b.index;
            }
            return b.score - a.score;
        });
        const ordered = sourceArray.map((entry) => entry.category);
        // If we only returned matches, ensure we don't return empty list
        if (ordered.length > 0) {
            return ordered;
        }
        return categories;
    }
    tokenizeQuery(message) {
        const normalized = this.normalizeText(message)
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        if (!normalized) {
            return [];
        }
        return normalized
            .split(" ")
            .map((token) => token.trim())
            .filter((token) => token.length >= 3);
    }
    calculateCategoryScore(name, tokens) {
        const normalizedName = this.normalizeText(name);
        let score = 0;
        for (const token of tokens) {
            if (!token)
                continue;
            if (normalizedName.includes(token)) {
                score += 5;
                continue;
            }
            if (token.length > 4) {
                const singular = token.replace(/(i|e|o|a)$/i, "");
                if (singular && singular.length >= 3 && normalizedName.includes(singular)) {
                    score += 3;
                }
            }
        }
        return score;
    }
    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }
    // ================================================================================
    // PRODUCT BUILDERS
    // ================================================================================
    buildProductList(products, context) {
        var _a;
        if (products.length === 0) {
            return {
                type: "NO_RESULTS",
                data: { errorMessage: "No products found" },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        // 🎯 OPTIMIZATION: If only 1 product, skip list and show detail directly
        if (products.length === 1) {
            const [product] = products;
            return {
                type: "PRODUCT_DETAIL",
                data: { product },
                formatting: DEFAULT_FORMATTING,
                context,
            };
        }
        // 🚫 If grouping is disabled (e.g., selection came from an existing group), force a flat list
        if (context.disableGrouping) {
            const items = products.map((p, index) => ({
                number: index + 1,
                id: p.id,
                name: p.name,
                sku: p.sku,
                price: p.price,
                priceWithDiscount: p.priceWithDiscount,
                imageUrl: p.imageUrl,
                stock: p.stock,
                description: p.description,
                extra: p.categoryName || p.region,
            }));
            return {
                type: "PRODUCT_LIST",
                data: {
                    items,
                    count: products.length,
                },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showStock: products.some((p) => !p.isAvailable), showTotal: false }),
                context,
            };
        }
        // RULE: If >5 products, try to group by category
        // But only if we can create 2+ meaningful groups
        if (!context.disableGrouping && products.length > DEFAULT_FORMATTING.maxItemsBeforeGroup) {
            const grouped = this.buildGroupedProducts(products, context);
            // 🔧 FIX: PRODUCT_NEEDS_SMART_GROUPING should be returned directly!
            // It doesn't have `groups`, it has `items` for LLM to group
            if (grouped.type === "PRODUCT_NEEDS_SMART_GROUPING") {
                logger_1.default.info("🏗️ [ResponseBuilder] Smart grouping needed for single category", {
                    count: products.length,
                    category: (_a = products[0]) === null || _a === void 0 ? void 0 : _a.categoryName,
                });
                return grouped;
            }
            // Only use category grouping if we have 2+ groups (1 group is useless)
            if (grouped.data.groups && grouped.data.groups.length >= 2) {
                return grouped;
            }
            // Otherwise fall through to simple list
        }
        // Simple list
        const items = products.map((p, index) => ({
            number: index + 1,
            id: p.id,
            name: p.name,
            sku: p.sku, // Include SKU for cart operations
            price: p.price,
            priceWithDiscount: p.priceWithDiscount,
            imageUrl: p.imageUrl,
            stock: p.stock,
            description: p.description,
            extra: p.categoryName || p.region,
        }));
        return {
            type: "PRODUCT_LIST",
            data: {
                items,
                count: products.length,
            },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showStock: products.some((p) => !p.isAvailable), showTotal: false }),
            context,
        };
    }
    buildGroupedProducts(products, context) {
        // Group by category
        const groupMap = new Map();
        for (const product of products) {
            const groupName = product.categoryName || "Altri prodotti";
            if (!groupMap.has(groupName)) {
                groupMap.set(groupName, []);
            }
            groupMap.get(groupName).push(product);
        }
        // If ALL products are in the SAME category (1 group with 6+ items),
        // we use CODE-FIRST grouping based on product attributes
        // The LLM only formats the text, NOT the grouping logic!
        if (groupMap.size === 1 && products.length >= 6) {
            const categoryName = products[0].categoryName || "Prodotti";
            // 🔧 CODE-FIRST GROUPING: Group by common attributes (region, formato, description keywords)
            const productGroups = this.createSmartGroups(products, categoryName);
            // 🆕 If no meaningful groups found (empty array), fall through to flat list
            if (productGroups.length === 0) {
                logger_1.default.info("🏗️ [ResponseBuilder] No meaningful groups found, using flat list", {
                    categoryName,
                    productCount: products.length,
                });
                // Fall through to standard grouped view or flat list below
            }
            else {
                // Build items list with group info
                const items = products.map((p, index) => ({
                    number: index + 1,
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    price: p.price,
                    priceWithDiscount: p.priceWithDiscount,
                    imageUrl: p.imageUrl,
                    stock: p.stock,
                    description: p.description,
                    extra: p.region || p.formato,
                }));
                // 🆕 Pre-compute groupMapping here, not in LLM!
                const groupMapping = {};
                productGroups.forEach((group, index) => {
                    groupMapping[String(index + 1)] = {
                        nome: group.name,
                        skus: group.products.map(p => p.sku).filter(Boolean),
                    };
                });
                logger_1.default.info("🏗️ [ResponseBuilder] CODE-FIRST grouping created", {
                    categoryName,
                    groupCount: productGroups.length,
                    groups: productGroups.map(g => ({ name: g.name, count: g.products.length })),
                    totalSkus: Object.values(groupMapping).reduce((sum, g) => sum + g.skus.length, 0),
                });
                return {
                    type: "PRODUCT_NEEDS_SMART_GROUPING",
                    data: {
                        items,
                        count: products.length,
                        categoryName,
                        // 🆕 Pass pre-computed groups to formatter
                        productGroups: productGroups.map((g, i) => ({
                            number: i + 1,
                            name: g.name,
                            productCount: g.products.length,
                        })),
                        // 🆕 Pass groupMapping directly - NO LLM needed for this!
                        groupMapping,
                    },
                    formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { groupByCategory: true }),
                    context,
                };
            }
        }
        let itemNumber = 1;
        const rawGroups = [];
        for (const [groupName, groupProducts] of groupMap) {
            const items = groupProducts.map((p) => ({
                number: itemNumber++,
                id: p.id,
                name: p.name,
                sku: p.sku, // Include SKU for cart operations
                price: p.price,
                priceWithDiscount: p.priceWithDiscount,
                imageUrl: p.imageUrl,
                stock: p.stock,
                extra: p.region || p.formato,
            }));
            rawGroups.push({
                groupName,
                variantCount: groupProducts.length,
                items,
            });
        }
        const groups = rawGroups
            .sort((a, b) => {
            const aIsOther = a.groupName.trim().toLowerCase() === "altri";
            const bIsOther = b.groupName.trim().toLowerCase() === "altri";
            if (aIsOther !== bIsOther)
                return aIsOther ? 1 : -1;
            return b.variantCount - a.variantCount;
        })
            .slice(0, 4);
        const groupMapping = {};
        groups.forEach((group, index) => {
            groupMapping[String(index + 1)] = {
                nome: group.groupName,
                skus: group.items
                    .map((item) => item.sku)
                    .filter((sku) => Boolean(sku)),
            };
        });
        return {
            type: "PRODUCT_GROUPED",
            data: {
                groups,
                count: groups.reduce((sum, group) => sum + group.variantCount, 0),
                groupMapping,
            },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { groupByCategory: true, showTotal: false }),
            context,
        };
    }
    buildProductDetail(product, context) {
        if (!product) {
            return {
                type: "NO_RESULTS",
                data: { errorMessage: "Product not found" },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        return {
            type: "PRODUCT_DETAIL",
            data: { product },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showStock: true }),
            context,
        };
    }
    // ================================================================================
    // SERVICE BUILDERS
    // ================================================================================
    buildServiceList(services, context) {
        if (services.length === 0) {
            return {
                type: "NO_RESULTS",
                data: { errorMessage: "No services available" },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        // 🎯 OPTIMIZATION: If only 1 service, skip list and show detail directly
        if (services.length === 1) {
            const service = services[0];
            logger_1.default.info("🎯 [ResponseBuilder] Single service found - showing detail directly", {
                serviceName: service.name,
                code: service.code,
            });
            return this.buildServiceDetail(service, context);
        }
        const items = services.map((svc, index) => ({
            number: index + 1,
            id: svc.id,
            name: svc.name,
            price: svc.price,
            sku: svc.code, // Use code as SKU for cart operations
            extra: svc.currency,
        }));
        return {
            type: "SERVICE_LIST", // 🆕 Use SERVICE_LIST type to distinguish from CATEGORY_LIST
            data: {
                items,
                count: services.length,
            },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showPrices: true, showStock: false }),
            context,
        };
    }
    buildServiceDetail(service, context) {
        if (!service) {
            return {
                type: "NO_RESULTS",
                data: { errorMessage: "Service not found" },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        return {
            type: "SERVICE_DETAIL", // Use dedicated SERVICE_DETAIL type
            data: { service }, // Pass service data directly
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showStock: false }),
            context,
        };
    }
    // ================================================================================
    // CART BUILDERS
    // ================================================================================
    buildCartResponse(cart, context) {
        if (cart.isEmpty) {
            return {
                type: "CART_EMPTY",
                data: { cart },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        const items = cart.items.map((item, index) => ({
            number: index + 1,
            id: item.productId,
            name: item.productName,
            price: item.totalPrice,
            stock: item.stock,
            extra: `${item.quantity}×`,
        }));
        return {
            type: "CART_VIEW",
            data: {
                items,
                cart,
                count: cart.itemCount,
            },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showStock: true, showTotal: true }),
            context,
        };
    }
    // ================================================================================
    // ORDER BUILDERS
    // ================================================================================
    buildOrderList(orders, context) {
        if (orders.length === 0) {
            return {
                type: "NO_RESULTS",
                data: { errorMessage: "Non ci sono ordini per questo cliente. Posso aiutarti a trovare prodotti o servizi?" },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        const items = orders.map((o, index) => ({
            number: index + 1,
            id: o.id,
            name: `#${o.code}`,
            price: o.totalAmount,
            extra: `${o.status}${o.createdAt ? ` · ${new Date(o.createdAt).toLocaleDateString("it-IT")}` : ""}`,
        }));
        return {
            type: "ORDER_LIST",
            data: {
                items,
                count: orders.length,
            },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showStock: false }),
            context,
        };
    }
    buildOrderDetail(order, context) {
        if (!order) {
            return {
                type: "ORDER_NOT_FOUND",
                data: { errorMessage: "Order not found" },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        return {
            type: "ORDER_DETAIL",
            data: { order },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
            context,
        };
    }
    /**
     * Build response for order actions (SEND_INVOICE, REPEAT_ORDER, SEND_CREDIT_NOTES)
     * Returns ORDER_ACTION type for the chat-engine to execute the calling function
     */
    buildOrderActionResponse(action, context, extras) {
        return {
            type: "ORDER_ACTION",
            data: { action, orderCode: extras === null || extras === void 0 ? void 0 : extras.orderCode },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
            context,
        };
    }
    /**
     * Build agent info response for "who is my agent?" queries
     * @see Feature 202 - Agent Variables
     */
    buildAgentInfoResponse(agentInfo, context) {
        return {
            type: "AGENT_INFO",
            data: { agentInfo },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showPrices: false }),
            context,
        };
    }
    // ================================================================================
    // WORKSPACE INFO BUILDERS
    // ================================================================================
    buildIdentityResponse(identity, context) {
        var _a;
        const identityText = (_a = identity.botName) === null || _a === void 0 ? void 0 : _a.trim();
        if (identityText) {
            return {
                type: "SIMPLE_TEXT",
                data: { identity },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showPrices: false }),
                context,
                text: identityText,
            };
        }
        return {
            type: "IDENTITY",
            data: { identity },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showPrices: false }),
            context,
        };
    }
    buildLocationResponse(location, context) {
        return {
            type: "LOCATION",
            data: { location },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showPrices: false }),
            context,
        };
    }
    /**
     * Build business info response - for "che settore?", "che tipo di negozio?"
     * Provides chatbot name, business type, and basic info
     */
    buildBusinessInfoResponse(businessInfo, context) {
        return {
            type: "BUSINESS_INFO",
            data: { businessInfo },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showPrices: false }),
            context,
        };
    }
    /**
     * Build FAQ response - passes FAQs to LLM for matching
     * LLM will find the best matching FAQ answer for the user's query
     */
    buildFAQResponse(faqs, query, context) {
        if (!faqs || faqs.length === 0) {
            // No FAQs configured - return NEEDS_LLM_FORMAT for general response
            return {
                type: "NEEDS_LLM_FORMAT",
                data: {},
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
                template: `The user asked: "${query}". There are no FAQs configured. Provide a helpful general response.`,
            };
        }
        // Pass FAQs to LLM for semantic matching
        return {
            type: "FAQ",
            data: {
                faqs,
                query,
            }, // Extend ResponseData type as needed
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showPrices: false }),
            context,
        };
    }
    /**
     * Build profile response - shows customer discount info
     */
    buildProfileResponse(profile, context) {
        return {
            type: "PROFILE",
            data: { profile },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showPrices: false }),
            context,
        };
    }
    /**
     * Build offers response - shows active offers/promotions
     * 🆕 Now includes numbered options to view products for each offer with a category
     */
    buildOffersResponse(offers, context) {
        if (offers.length === 0) {
            return {
                type: "NO_RESULTS",
                data: { errorMessage: "No active offers" },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        // 🆕 Create numbered items for offers that have categories (can show products)
        const offersWithCategories = offers.filter(o => o.categoryName);
        const items = offersWithCategories.map((offer, index) => ({
            number: index + 1,
            id: offer.id,
            name: `Vedi prodotti ${offer.categoryName} in sconto (-${offer.discountPercent}%)`,
            sku: offer.categoryName, // Store category name as SKU for resolution
            extra: offer.categoryName, // Category name for filtering
        }));
        return {
            type: "OFFERS",
            data: {
                offers,
                count: offers.length,
                items: items.length > 0 ? items : undefined, // 🆕 Include items for selection
            },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: items.length > 0, showPrices: true }),
            context,
        };
    }
    /**
     * Build offer with products response - shows single offer with its products
     * 🆕 For single-offer scenario: shows offer context (discount %) + product list
     */
    buildOfferWithProductsResponse(offer, products, context) {
        if (!offer) {
            return {
                type: "NO_RESULTS",
                data: { errorMessage: "Offer not found" },
                formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
                context,
            };
        }
        // Create numbered items for products
        const items = products.map((product, index) => ({
            number: index + 1,
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            extra: product.description,
        }));
        return {
            type: "OFFER_WITH_PRODUCTS",
            data: {
                offer,
                products,
                items,
                count: products.length,
            },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: true, showPrices: true }),
            context,
        };
    }
    // ================================================================================
    // SIMPLE INTENT BUILDERS
    // ================================================================================
    buildEmptyResponse(intentType, reason, context) {
        // Map simple intents to response types
        const typeMap = {
            GREETING: "GREETING",
            GOODBYE: "GOODBYE",
            THANKS: "THANKS",
            ASK_HELP: "HELP",
            HUMAN_SUPPORT: "HUMAN_SUPPORT",
        };
        const responseType = typeMap[intentType] || "NEEDS_LLM_FORMAT";
        return {
            type: responseType,
            data: {},
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false, showPrices: false }),
            context,
        };
    }
    buildErrorResponse(errorMessage, context) {
        return {
            type: "ERROR",
            data: { errorMessage },
            formatting: Object.assign(Object.assign({}, DEFAULT_FORMATTING), { showNumbers: false }),
            context,
        };
    }
    /**
     * 🆕 CODE-FIRST Smart Grouping - Groups products by attributes WITHOUT LLM
     *
     * Grouping strategy (in order of priority):
     * 1. If "formato" exists AND is NOT just a weight (e.g., "Stagionato", "Fresco") → group by formato
     * 2. If "region" exists (e.g., "Toscana", "Piemonte") → group by region
     * 3. Otherwise → group by first word of description or "Altri"
     *
     * CRITICAL: Skip formato if it's just a weight like "200g", "1kg", "500ml"
     */
    createSmartGroups(products, categoryName) {
        var _a, _b;
        const groupMap = new Map();
        // Helper: Check if a string is just a weight/measure (not meaningful for grouping)
        const isJustWeight = (s) => {
            if (!s)
                return true;
            const trimmed = s.trim().toLowerCase();
            // Match patterns like: "200g", "1kg", "500ml", "1.5l", "250 g", "1 kg"
            return /^\d+(\.\d+)?\s*(g|kg|ml|l|cl|gr|grammi|litri|litro)$/i.test(trimmed);
        };
        // Determine grouping strategy based on available data
        // IMPORTANT: formato must have MEANINGFUL values, not just weights
        const formatoValues = products.map(p => { var _a; return (_a = p.formato) === null || _a === void 0 ? void 0 : _a.trim(); }).filter(Boolean);
        const hasUsefulFormato = formatoValues.length > 0 && formatoValues.some(f => !isJustWeight(f));
        const hasRegion = products.some(p => p.region && p.region.trim() !== "");
        const hasTransport = products.some(p => p.transportType && String(p.transportType).trim() !== "");
        const normalizedText = (product) => `${product.name || ""} ${product.description || ""}`.toLowerCase();
        const typePatterns = [
            { name: "Freschi", regex: /\bfresc[oaie]|\bmozzarella|\bstracciatella|\bfiordilatte/ },
            { name: "Stagionati", regex: /\bstagionat|\bvecchi[aoe]|\baffinat/ },
            { name: "Erborinati", regex: /\berborinat|\bgorgonzola|\bblu/ },
            { name: "Affumicati", regex: /\baffumicat/ },
            { name: "Spalmabili", regex: /\bspalmabil|\bcremos[oaie]|\bphiladelphia/ },
            { name: "Piccanti", regex: /\bpiccant|\bpeperoncino/ },
            { name: "Dolci", regex: /\bdolc[ei]|\bvaniglia|\bcioccolat/ },
            { name: "Integrali", regex: /\bintegral/ },
            { name: "Bio", regex: /\bbio|\bbiologic/ },
            { name: "Senza Lattosio", regex: /\bsenza lattosio|\blactose free/ },
            { name: "Senza Glutine", regex: /\bsenza glutine|\bgluten[-\s]?free/ },
        ];
        const getTypeGroup = (product) => {
            const text = normalizedText(product);
            for (const pattern of typePatterns) {
                if (pattern.regex.test(text)) {
                    return pattern.name;
                }
            }
            return null;
        };
        const typeMatches = products
            .map((product) => getTypeGroup(product))
            .filter((value) => Boolean(value));
        const typeGroupsCount = new Set(typeMatches).size;
        const hasTypeGrouping = typeGroupsCount >= 2;
        logger_1.default.info("🧠 [ResponseBuilder] createSmartGroups analyzing", {
            categoryName,
            productCount: products.length,
            hasTypeGrouping,
            hasUsefulFormato,
            hasRegion,
            hasTransport,
            formatoValues: formatoValues.slice(0, 5),
            sampleProducts: products.slice(0, 3).map(p => ({
                name: p.name,
                formato: p.formato,
                region: p.region,
            })),
        });
        for (const product of products) {
            let groupKey;
            if (hasTypeGrouping) {
                // Strategy 1: Group by product typology inferred from name/description
                groupKey = getTypeGroup(product) || "Altri";
            }
            else if (hasRegion && product.region && product.region.trim() !== "") {
                // Strategy 2: Group by region (e.g., "Toscana", "Piemonte")
                groupKey = product.region.trim();
            }
            else if (hasTransport && product.transportType && String(product.transportType).trim() !== "") {
                // Strategy 3: Group by transport type when available
                groupKey = String(product.transportType).trim();
            }
            else if (hasUsefulFormato && product.formato && product.formato.trim() !== "" && !isJustWeight(product.formato)) {
                // Strategy 4: Group by formato (e.g., "Stagionato", "Fresco") - but NOT if it's just weight
                groupKey = product.formato.trim();
            }
            else {
                // Fallback: Group by first significant word in name/description
                // Skip common words like "Formaggio", use second word if available
                const nameWords = product.name.split(" ");
                groupKey = nameWords.length > 1 ? nameWords[1] : nameWords[0] || "Altri";
            }
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, []);
            }
            groupMap.get(groupKey).push(product);
        }
        // Convert to array and sort by group size (largest first)
        const groups = Array.from(groupMap.entries())
            .map(([name, prods]) => ({ name, products: prods }))
            .sort((a, b) => b.products.length - a.products.length);
        // If we ended up with too many groups (>=5), skip grouping entirely
        if (groups.length >= 5) {
            logger_1.default.info("🧠 [ResponseBuilder] Too many groups, skipping grouping", {
                groupCount: groups.length,
                categoryName,
            });
            return [];
        }
        // 🆕 If we only have 1 group (all products ended up in same group), 
        // don't bother grouping - just return empty to trigger flat list
        if (groups.length <= 1) {
            logger_1.default.info("🧠 [ResponseBuilder] Only 1 group found, skipping grouping", {
                groupName: (_a = groups[0]) === null || _a === void 0 ? void 0 : _a.name,
                productCount: (_b = groups[0]) === null || _b === void 0 ? void 0 : _b.products.length,
            });
            return [];
        }
        logger_1.default.info("🧠 [ResponseBuilder] Smart groups created", {
            groupCount: groups.length,
            groups: groups.map(g => ({ name: g.name, count: g.products.length })),
        });
        return groups;
    }
}
exports.ResponseBuilderService = ResponseBuilderService;
// ================================================================================
// SINGLETON INSTANCE
// ================================================================================
let responseBuilderInstance = null;
function getResponseBuilder(prisma) {
    if (!responseBuilderInstance) {
        responseBuilderInstance = new ResponseBuilderService(prisma);
    }
    return responseBuilderInstance;
}
//# sourceMappingURL=response-builder.service.js.map