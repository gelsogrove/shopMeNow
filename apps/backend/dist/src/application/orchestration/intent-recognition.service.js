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
exports.IntentRecognitionService = void 0;
const intent_parser_service_1 = require("../intent/intent-parser.service");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Multi-intent recognition layer.
 *
 * First iteration: reuse existing IntentParser (pattern/keyword/LLM fallback)
 * and expose a normalized array structure so the orchestrator can support
 * multiple intents as we extend prompts later.
 */
class IntentRecognitionService {
    constructor(prisma) {
        this.intentParser = new intent_parser_service_1.IntentParserService(prisma);
    }
    recognize(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const lastAssistantMessage = (_b = (_a = params.conversationHistory) === null || _a === void 0 ? void 0 : _a.slice().reverse().find((m) => m.role === "assistant")) === null || _b === void 0 ? void 0 : _b.content;
            const parsed = yield this.intentParser.parse(params.message, {
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                conversationHistory: params.conversationHistory,
                lastAssistantMessage,
            });
            const intents = [this.toRecognized(parsed)];
            logger_1.default.info("[Orchestration] Intent recognition completed", {
                intents: intents.map((i) => i.intent.type),
                confidence: intents.map((i) => i.confidence),
            });
            return intents;
        });
    }
    toRecognized(result) {
        return {
            intent: result.intent,
            confidence: result.confidence,
            source: result.source === "PATTERN" || result.source === "KEYWORD"
                ? result.source
                : "LLM",
        };
    }
}
exports.IntentRecognitionService = IntentRecognitionService;
//# sourceMappingURL=intent-recognition.service.js.map