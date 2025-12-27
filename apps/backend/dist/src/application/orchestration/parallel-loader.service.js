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
exports.ParallelLoaderService = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
const conversation_manager_service_1 = require("../../services/conversation-manager.service");
const data_loader_1 = require("../data-loader");
const intent_types_1 = require("../intent/intent.types");
/**
 * Parallel data loader that fans out DB calls based on detected intents.
 * Applies workspace isolation, guest masking, and skips product loads when
 * sellsProductsAndServices is false.
 */
class ParallelLoaderService {
    constructor(prisma) {
        this.prisma = prisma;
        this.dataLoader = new data_loader_1.DataLoaderService(prisma);
        this.conversationManager = new conversation_manager_service_1.ConversationManager(prisma, 10);
    }
    load(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const workspaceConfig = yield this.prisma.workspace.findUnique({
                where: { id: params.workspaceId },
                select: {
                    sellsProductsAndServices: true,
                    toneOfVoice: true,
                },
            });
            const workspace = {
                sellsProductsAndServices: (_b = (_a = params.sellsProductsAndServices) !== null && _a !== void 0 ? _a : workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.sellsProductsAndServices) !== null && _b !== void 0 ? _b : false,
                toneOfVoice: workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.toneOfVoice,
            };
            const historyPromise = this.conversationManager.loadHistory(params.workspaceId, params.conversationId);
            const intentsToLoad = workspace.sellsProductsAndServices
                ? params.intents
                : params.intents.filter((i) => !(0, intent_types_1.isProductSearchIntent)(i.intent));
            const dataPromises = intentsToLoad.map((i) => __awaiter(this, void 0, void 0, function* () {
                try {
                    return yield this.dataLoader.loadForIntent(i.intent, params.workspaceId, params.customerId);
                }
                catch (error) {
                    logger_1.default.error("[Orchestration] Data load failed", {
                        intent: i.intent.type,
                        error,
                    });
                    return null;
                }
            }));
            const [history, ...dataResults] = yield Promise.all([
                historyPromise,
                ...dataPromises,
            ]);
            const recentMessages = history
                .filter((m) => m.role === "user" || m.role === "assistant")
                .slice(-6)
                .map((m) => ({ role: m.role, content: m.content }));
            const conversation = {
                recentMessages,
                summary: undefined,
            };
            return {
                products: dataResults.find((d) => (d === null || d === void 0 ? void 0 : d.type) === "PRODUCTS"),
                faqs: dataResults.find((d) => (d === null || d === void 0 ? void 0 : d.type) === "FAQ"),
                offers: dataResults.find((d) => (d === null || d === void 0 ? void 0 : d.type) === "OFFERS"),
                services: dataResults.find((d) => (d === null || d === void 0 ? void 0 : d.type) === "SERVICES"),
                customerProfile: dataResults.find((d) => (d === null || d === void 0 ? void 0 : d.type) === "PROFILE"),
                preferences: [],
                conversation,
                workspace,
            };
        });
    }
}
exports.ParallelLoaderService = ParallelLoaderService;
//# sourceMappingURL=parallel-loader.service.js.map