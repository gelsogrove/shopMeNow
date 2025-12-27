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
exports.CatalogQueryService = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
const response_builder_service_1 = require("../response-builder/response-builder.service");
const query_builder_service_1 = require("./query-builder.service");
const query_executor_1 = require("./query-executor");
class CatalogQueryService {
    constructor(prisma) {
        this.prisma = prisma;
        this.builder = new query_builder_service_1.CatalogQueryBuilder();
    }
    process(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { workspaceId, message, customerDiscount = 0, intentType, customerLanguage = "it" } = options;
            const builderResult = yield this.builder.build(message);
            const finalQuery = Object.assign({}, builderResult.query);
            const trimmedMessage = message.trim();
            const hasFilters = Array.isArray(finalQuery.filters) && finalQuery.filters.length > 0;
            const hasGroupBy = Array.isArray(finalQuery.groupBy) && finalQuery.groupBy.length > 0;
            // For SEARCH_PRODUCTS, enforce a text filter when the builder returns a plain list.
            if (intentType === "SEARCH_PRODUCTS" && trimmedMessage.length > 1 && !hasFilters && !hasGroupBy) {
                finalQuery.filters = [
                    {
                        field: "text",
                        op: "contains",
                        value: trimmedMessage,
                    },
                ];
            }
            const products = yield this.loadProducts(workspaceId, customerDiscount);
            if (products.length === 0) {
                return {
                    loadedData: {
                        type: "CATALOG_QUERY_RESULT",
                        resultType: "EMPTY",
                    },
                    structuredResponse: this.buildNoResultsResponse(customerLanguage, intentType, customerDiscount),
                    query: finalQuery,
                    model: builderResult.model,
                    tokenUsage: builderResult.usage,
                    resultType: "EMPTY",
                };
            }
            const result = (0, query_executor_1.executeCatalogQuery)(products, finalQuery);
            if (result.type === "EMPTY" &&
                intentType === "SEARCH_PRODUCTS" &&
                trimmedMessage.length > 0) {
                const llmMatches = yield this.selectProductsWithLLM(products, trimmedMessage);
                if (llmMatches.length > 0) {
                    const structuredResponse = this.buildListResponse(llmMatches, intentType, customerLanguage, customerDiscount, (_a = finalQuery.groupBy) === null || _a === void 0 ? void 0 : _a[0]);
                    return {
                        loadedData: {
                            type: "CATALOG_QUERY_RESULT",
                            resultType: "LIST",
                            products: llmMatches,
                        },
                        structuredResponse,
                        query: finalQuery,
                        model: "openai/gpt-4o-mini",
                        resultType: "LIST",
                    };
                }
            }
            switch (result.type) {
                case "LIST": {
                    const structuredResponse = this.buildListResponse(result.items, intentType, customerLanguage, customerDiscount, (_b = builderResult.query.groupBy) === null || _b === void 0 ? void 0 : _b[0]);
                    return {
                        loadedData: {
                            type: "CATALOG_QUERY_RESULT",
                            resultType: "LIST",
                            products: result.items,
                        },
                        structuredResponse,
                        query: finalQuery,
                        model: builderResult.model,
                        tokenUsage: builderResult.usage,
                        resultType: "LIST",
                    };
                }
                case "GROUPED": {
                    const structuredResponse = this.buildGroupedResponse(result.groups, products, intentType, customerLanguage, customerDiscount);
                    return {
                        loadedData: {
                            type: "CATALOG_QUERY_RESULT",
                            resultType: "GROUPED",
                            groups: result.groups,
                        },
                        structuredResponse,
                        query: finalQuery,
                        model: builderResult.model,
                        tokenUsage: builderResult.usage,
                        resultType: "GROUPED",
                    };
                }
                case "AGGREGATE": {
                    const structuredResponse = this.buildAggregateResponse(result.aggregate.type, result.aggregate.value, intentType, customerLanguage, customerDiscount);
                    return {
                        loadedData: {
                            type: "CATALOG_QUERY_RESULT",
                            resultType: "AGGREGATE",
                        },
                        structuredResponse,
                        query: finalQuery,
                        model: builderResult.model,
                        tokenUsage: builderResult.usage,
                        resultType: "AGGREGATE",
                    };
                }
                default: {
                    return {
                        loadedData: {
                            type: "CATALOG_QUERY_RESULT",
                            resultType: "EMPTY",
                        },
                        structuredResponse: this.buildNoResultsResponse(customerLanguage, intentType, customerDiscount),
                        query: finalQuery,
                        model: builderResult.model,
                        tokenUsage: builderResult.usage,
                        resultType: "EMPTY",
                    };
                }
            }
        });
    }
    loadProducts(workspaceId, customerDiscount) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const products = yield this.prisma.products.findMany({
                    where: { workspaceId, isActive: true },
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        description: true,
                        price: true,
                        stock: true,
                        imageUrl: true,
                        region: true,
                        formato: true,
                        transportType: true,
                        productCategories: {
                            select: { category: { select: { id: true, name: true } } },
                        },
                        productCertifications: {
                            select: { certification: { select: { name: true } } },
                        },
                        productTransportTypes: {
                            select: { transportType: { select: { name: true } } },
                        },
                        certifications: true,
                        allergens: true,
                    },
                    orderBy: { name: "asc" },
                });
                return products.map((product) => this.mapProduct(product, customerDiscount));
            }
            catch (error) {
                logger_1.default.error("❌ [CatalogQueryService] Failed to load products", { error });
                return [];
            }
        });
    }
    mapProduct(product, customerDiscount) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const discount = customerDiscount > 0 ? product.price * (1 - customerDiscount / 100) : undefined;
        const certs = Array.isArray(product.productCertifications)
            ? product.productCertifications
                .map((pc) => { var _a; return (_a = pc.certification) === null || _a === void 0 ? void 0 : _a.name; })
                .filter(Boolean)
            : Array.isArray(product.certifications)
                ? product.certifications.map(String)
                : [];
        const allergens = Array.isArray(product.allergens) ? product.allergens.map(String) : [];
        return {
            id: product.id,
            name: product.name,
            sku: product.sku || undefined,
            description: product.description || undefined,
            price: product.price,
            priceWithDiscount: discount,
            stock: product.stock,
            imageUrl: Array.isArray(product.imageUrl) && product.imageUrl.length > 0 ? String(product.imageUrl[0]) : undefined,
            categoryId: (_c = (_b = (_a = product.productCategories) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.category) === null || _c === void 0 ? void 0 : _c.id,
            categoryName: (_f = (_e = (_d = product.productCategories) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.category) === null || _f === void 0 ? void 0 : _f.name,
            region: product.region || undefined,
            formato: product.formato || undefined,
            certifications: certs,
            allergens,
            transportType: product.transportType ||
                ((_j = (_h = (_g = product.productTransportTypes) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.transportType) === null || _j === void 0 ? void 0 : _j.name) ||
                undefined,
            isAvailable: product.stock > 0,
        };
    }
    selectProductsWithLLM(products, query) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            try {
                const apiKey = process.env.OPENROUTER_API_KEY || "";
                if (!apiKey) {
                    logger_1.default.warn("⚠️ [CatalogQueryService] OPENROUTER_API_KEY not set - LLM fallback skipped");
                    return [];
                }
                const trimmedQuery = query.trim();
                if (!trimmedQuery) {
                    return [];
                }
                const systemPrompt = `You are a product matcher.
Given a user query and a list of products, return the products that match the query.
Rules:
- Use semantic understanding and handle typos in any language.
- Match based on meaning from product title, description, category, region, format, transport, and certifications.
- If the query term appears (or a simple singular/plural variant appears) in any product field, you MUST include that product.
- For each match, provide an evidence snippet that appears verbatim in the provided product fields.
- Do NOT invent products or IDs.
- Return at most 20 matches ordered by relevance.
- Use ONLY the numeric field "n" to refer to products (do not return any IDs).
- Output ONLY valid JSON in this format:
  {"matches":[{"n":1,"evidence":"exact snippet"},{"n":2,"evidence":"exact snippet"}]}`;
                const byId = new Map(products.map((p) => [p.id, p]));
                const allIds = [];
                const batchSize = 200;
                const maxIds = 20;
                for (let start = 0; start < products.length; start += batchSize) {
                    const batch = products.slice(start, start + batchSize);
                    const batchCandidates = batch.map((product, index) => ({
                        n: index + 1,
                        name: product.name,
                        description: product.description || "",
                        category: product.categoryName || "",
                        region: product.region || "",
                        formato: product.formato || "",
                        transport: product.transportType || "",
                        certifications: product.certifications || [],
                    }));
                    const response = yield fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model: "openai/gpt-4o-mini",
                            temperature: 0,
                            max_tokens: 400,
                            messages: [
                                { role: "system", content: systemPrompt },
                                {
                                    role: "user",
                                    content: JSON.stringify({
                                        query: trimmedQuery,
                                        products: batchCandidates,
                                    }),
                                },
                            ],
                        }),
                    });
                    if (!response.ok) {
                        logger_1.default.warn("⚠️ [CatalogQueryService] LLM fallback error", {
                            status: response.status,
                            batchStart: start,
                        });
                        continue;
                    }
                    const data = yield response.json();
                    const content = (_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
                    if (!content || typeof content !== "string") {
                        continue;
                    }
                    const parsed = this.parseJsonObject(content, {
                        logContext: { batchStart: start },
                    });
                    if (!parsed) {
                        continue;
                    }
                    const ids = this.extractMatchedIds(parsed, batch, byId);
                    for (const id of ids) {
                        if (!allIds.includes(id)) {
                            allIds.push(id);
                        }
                    }
                }
                if (allIds.length === 0) {
                    return [];
                }
                let finalIds = allIds.slice(0, maxIds);
                if (allIds.length > maxIds) {
                    const refinementCandidates = finalIds
                        .map((id) => byId.get(id))
                        .filter(Boolean)
                        .map((product, index) => ({
                        n: index + 1,
                        name: product.name,
                        description: product.description || "",
                        category: product.categoryName || "",
                        region: product.region || "",
                        formato: product.formato || "",
                        transport: product.transportType || "",
                        certifications: product.certifications || [],
                    }));
                    const response = yield fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model: "openai/gpt-4o-mini",
                            temperature: 0,
                            max_tokens: 400,
                            messages: [
                                { role: "system", content: systemPrompt },
                                {
                                    role: "user",
                                    content: JSON.stringify({
                                        query: trimmedQuery,
                                        products: refinementCandidates,
                                    }),
                                },
                            ],
                        }),
                    });
                    if (response.ok) {
                        const data = yield response.json();
                        const content = (_f = (_e = (_d = data.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.content;
                        if (content && typeof content === "string") {
                            const parsed = this.parseJsonObject(content, {
                                logPrefix: "LLM refinement",
                            });
                            const ids = this.extractMatchedIds(parsed, refinementCandidates.map((entry) => ({
                                id: finalIds[entry.n - 1],
                                name: entry.name,
                                description: entry.description,
                                categoryName: entry.category,
                                region: entry.region,
                                formato: entry.formato,
                                transportType: entry.transport,
                                certifications: entry.certifications,
                            })), byId);
                            if (ids.length > 0) {
                                finalIds = ids.slice(0, maxIds);
                            }
                        }
                    }
                }
                const matched = finalIds.map((id) => byId.get(id)).filter(Boolean);
                const directMatches = this.findDirectMatches(products, trimmedQuery);
                const combined = [
                    ...matched,
                    ...directMatches.filter((item) => !matched.some((m) => m.id === item.id)),
                ];
                logger_1.default.info("🧠 [CatalogQueryService] LLM fallback matches", {
                    query: trimmedQuery,
                    matched: combined.length,
                    directMatches: directMatches.length,
                });
                return combined;
            }
            catch (error) {
                logger_1.default.error("❌ [CatalogQueryService] LLM fallback failed", { error });
                return [];
            }
        });
    }
    parseJsonObject(content, options) {
        const prefix = (options === null || options === void 0 ? void 0 : options.logPrefix) || "LLM fallback";
        const context = (options === null || options === void 0 ? void 0 : options.logContext) || {};
        const trimmed = content.trim();
        const cleaned = this.stripCodeFence(trimmed);
        const direct = this.tryParseJson(cleaned);
        if (direct) {
            return direct;
        }
        const firstObject = this.extractFirstJsonObject(cleaned);
        const parsed = firstObject ? this.tryParseJson(firstObject) : null;
        if (!parsed) {
            logger_1.default.warn(`⚠️ [CatalogQueryService] ${prefix} returned invalid JSON`, Object.assign({}, context));
        }
        return parsed;
    }
    stripCodeFence(input) {
        let sanitized = input.trim();
        if (sanitized.startsWith("```")) {
            const lines = sanitized.split("\n");
            lines.shift();
            if (lines.length > 0 && lines[lines.length - 1].trim().startsWith("```")) {
                lines.pop();
            }
            sanitized = lines.join("\n").trim();
        }
        return sanitized;
    }
    tryParseJson(input) {
        if (!input)
            return null;
        try {
            return JSON.parse(input);
        }
        catch (_a) {
            return null;
        }
    }
    extractFirstJsonObject(input) {
        const start = input.indexOf("{");
        if (start === -1)
            return null;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let i = start; i < input.length; i++) {
            const char = input[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"") {
                inString = !inString;
                continue;
            }
            if (inString)
                continue;
            if (char === "{")
                depth += 1;
            if (char === "}")
                depth -= 1;
            if (depth === 0) {
                return input.slice(start, i + 1);
            }
        }
        return null;
    }
    extractMatchedIds(parsed, batch, byId) {
        const matches = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.matches) ? parsed.matches : [];
        const idsFromMatches = matches
            .map((entry) => {
            const index = typeof (entry === null || entry === void 0 ? void 0 : entry.n) === "number" ? entry.n : null;
            const evidence = typeof (entry === null || entry === void 0 ? void 0 : entry.evidence) === "string" ? entry.evidence : "";
            if (!index || index < 1 || index > batch.length)
                return null;
            const product = batch[index - 1];
            if (!product)
                return null;
            if (!this.hasEvidence(product, evidence))
                return null;
            return product.id;
        })
            .filter(Boolean);
        if (idsFromMatches.length > 0) {
            return idsFromMatches;
        }
        const legacyIds = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.ids) ? parsed.ids : [];
        return legacyIds.filter((id) => typeof id === "string" && byId.has(id));
    }
    hasEvidence(product, evidence) {
        const needle = evidence.trim().toLowerCase();
        if (!needle)
            return false;
        const haystack = [
            product.name,
            product.description,
            product.categoryName,
            product.region,
            product.formato,
            product.transportType,
            ...(product.certifications || []),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return haystack.includes(needle);
    }
    findDirectMatches(products, query) {
        const normalizedQuery = this.normalizeText(query);
        if (!normalizedQuery)
            return [];
        const tokens = normalizedQuery.split(" ").filter((token) => token.length >= 4);
        if (tokens.length === 0)
            return [];
        const stems = tokens.map((token) => token.replace(/[aeiou]$/i, ""));
        const searchTokens = Array.from(new Set([...tokens, ...stems].filter(Boolean)));
        return products.filter((product) => {
            const text = this.normalizeText(this.buildSearchText(product));
            return searchTokens.some((token) => text.includes(token));
        });
    }
    buildSearchText(product) {
        return [
            product.name,
            product.description,
            product.categoryName,
            product.region,
            product.formato,
            product.transportType,
            ...(product.certifications || []),
        ]
            .filter(Boolean)
            .join(" ");
    }
    normalizeText(input) {
        return input
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
    buildListResponse(products, intentType, customerLanguage, customerDiscount, groupByField) {
        if (products.length === 1) {
            const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount);
            return {
                type: "PRODUCT_DETAIL",
                data: {
                    product: products[0],
                },
                formatting: Object.assign({}, response_builder_service_1.RESPONSE_DEFAULT_FORMATTING),
                context,
            };
        }
        const listItems = products.map((product, index) => ({
            number: index + 1,
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            priceWithDiscount: product.priceWithDiscount,
            stock: product.stock,
            extra: product.categoryName || product.region || undefined,
        }));
        const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount);
        const shouldGroup = !!groupByField || listItems.length > response_builder_service_1.RESPONSE_DEFAULT_FORMATTING.maxItemsBeforeGroup;
        if (shouldGroup) {
            const preferredField = groupByField || "category";
            const groupedResponse = this.tryBuildGroupedResponse(products, preferredField, intentType, customerLanguage, customerDiscount, Boolean(groupByField));
            if (groupedResponse) {
                return groupedResponse;
            }
        }
        return {
            type: "PRODUCT_LIST",
            data: {
                items: listItems,
                count: products.length,
            },
            formatting: Object.assign(Object.assign({}, response_builder_service_1.RESPONSE_DEFAULT_FORMATTING), { showTotal: false }),
            context,
        };
    }
    tryBuildGroupedResponse(products, field, intentType, customerLanguage, customerDiscount, forceField) {
        let meta = this.buildGroupsByField(products, field);
        if (!this.hasValidGroups(meta)) {
            return null;
        }
        if (!forceField && this.shouldFallbackGroupedResult(meta)) {
            if (field === "category") {
                return null;
            }
            meta = this.buildGroupsByField(products, "category");
            if (!this.hasValidGroups(meta) || this.shouldFallbackGroupedResult(meta)) {
                return null;
            }
        }
        return this.buildGroupedResponse(meta, products, intentType, customerLanguage, customerDiscount);
    }
    buildGroupedResponse(groups, products, intentType, customerLanguage, customerDiscount) {
        const productMap = new Map(products.map((p) => [p.id, p]));
        let numberCounter = 1;
        const groupedItems = groups.map((group) => {
            const items = group.ids
                .map((id) => productMap.get(id))
                .filter(Boolean)
                .map((product) => ({
                number: numberCounter++,
                id: product.id,
                name: product.name,
                sku: product.sku,
                price: product.price,
                priceWithDiscount: product.priceWithDiscount,
                stock: product.stock,
                extra: product.region || product.formato,
            }));
            return {
                groupName: group.key,
                variantCount: group.count,
                items,
            };
        });
        const limitedGroups = groupedItems
            .sort((a, b) => b.variantCount - a.variantCount)
            .slice(0, 4);
        const groupMapping = {};
        limitedGroups.forEach((group, index) => {
            groupMapping[String(index + 1)] = {
                nome: group.groupName,
                skus: group.items
                    .map((item) => item.sku)
                    .filter((sku) => Boolean(sku)),
            };
        });
        const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount);
        return {
            type: "PRODUCT_GROUPED",
            data: {
                groups: limitedGroups,
                count: limitedGroups.reduce((sum, group) => sum + group.variantCount, 0),
                groupMapping,
            },
            formatting: Object.assign(Object.assign({}, response_builder_service_1.RESPONSE_DEFAULT_FORMATTING), { groupByCategory: true, showTotal: false }),
            context,
        };
    }
    buildGroupsByField(products, field) {
        const fallbackLabels = {
            category: "Altre categorie",
            region: "Altre regioni",
            certification: "Altre certificazioni",
            transport: "Altri trasporti",
        };
        const map = new Map();
        const pushKey = (productId, rawKey, fallbackLabel) => {
            const trimmed = rawKey === null || rawKey === void 0 ? void 0 : rawKey.trim();
            const key = trimmed && trimmed.length > 0 ? trimmed : fallbackLabel;
            const usedFallback = !trimmed || trimmed.length === 0;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, { ids: [productId], isFallback: usedFallback });
                return;
            }
            existing.ids.push(productId);
            existing.isFallback = existing.isFallback && usedFallback;
        };
        for (const product of products) {
            if (field === "category") {
                pushKey(product.id, product.categoryName, fallbackLabels.category);
                continue;
            }
            if (field === "region") {
                pushKey(product.id, product.region, fallbackLabels.region);
                continue;
            }
            if (field === "certification") {
                if (!product.certifications || product.certifications.length === 0) {
                    pushKey(product.id, null, fallbackLabels.certification);
                    continue;
                }
                for (const cert of product.certifications) {
                    pushKey(product.id, cert, fallbackLabels.certification);
                }
            }
        }
        return Array.from(map.entries())
            .map(([key, entry]) => ({
            key,
            ids: entry.ids,
            count: entry.ids.length,
            isFallback: entry.isFallback,
        }))
            .filter((group) => group.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);
    }
    buildAggregateResponse(aggregateType, value, intentType, customerLanguage, customerDiscount) {
        const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount);
        return {
            type: "CATALOG_AGGREGATE",
            data: {
                aggregateResult: {
                    type: aggregateType,
                    field: "price",
                    value,
                },
            },
            formatting: Object.assign(Object.assign({}, response_builder_service_1.RESPONSE_DEFAULT_FORMATTING), { showNumbers: false, showPrices: true }),
            context,
        };
    }
    buildNoResultsResponse(customerLanguage, intentType, customerDiscount) {
        const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount);
        return {
            type: "NO_RESULTS",
            data: {
                errorMessage: "Nessun prodotto trovato per questa ricerca",
            },
            formatting: Object.assign(Object.assign({}, response_builder_service_1.RESPONSE_DEFAULT_FORMATTING), { showNumbers: false }),
            context,
        };
    }
    buildResponseContext(intentType, customerLanguage, customerDiscount) {
        return {
            intentType,
            customerLanguage,
            hasDiscount: (customerDiscount || 0) > 0,
            discountPercent: customerDiscount || 0,
        };
    }
    hasValidGroups(groups) {
        if (!groups || groups.length < 2) {
            return false;
        }
        return groups.some((group) => group.count > 0);
    }
    shouldFallbackGroupedResult(groups) {
        if (!groups || groups.length === 0) {
            return true;
        }
        const total = groups.reduce((sum, group) => sum + group.count, 0);
        if (total === 0) {
            return true;
        }
        const [largest] = groups;
        if (!largest) {
            return true;
        }
        const ratio = largest.count / total;
        return !!largest.isFallback && ratio >= 0.7;
    }
}
exports.CatalogQueryService = CatalogQueryService;
//# sourceMappingURL=catalog-query.service.js.map