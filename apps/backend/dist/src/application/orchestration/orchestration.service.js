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
exports.OrchestrationService = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
const intent_recognition_service_1 = require("./intent-recognition.service");
const parallel_loader_service_1 = require("./parallel-loader.service");
const preference_manager_service_1 = require("./preference-manager.service");
const content_mixer_service_1 = require("./content-mixer.service");
const natural_mixer_service_1 = require("./natural-mixer.service");
const validator_service_1 = require("./validator.service");
/**
 * Natural conversation orchestrator (Feature 204).
 * Keeps deterministic steps and reserves creativity for the mixer/translator.
 */
class OrchestrationService {
    constructor(prisma) {
        this.prisma = prisma;
        this.intentRecognition = new intent_recognition_service_1.IntentRecognitionService(prisma);
        this.loader = new parallel_loader_service_1.ParallelLoaderService(prisma);
        this.preferences = new preference_manager_service_1.PreferenceManagerService(prisma);
        this.mixer = new content_mixer_service_1.ContentMixerService();
        this.validator = new validator_service_1.MixerValidatorService();
        this.naturalMixer = new natural_mixer_service_1.NaturalMixerService();
    }
    orchestrate(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const intents = yield this.intentRecognition.recognize({
                message: input.message,
                workspaceId: input.workspaceId,
                customerId: input.customerId,
            });
            const context = yield this.loader.load({
                intents,
                workspaceId: input.workspaceId,
                customerId: input.customerId,
                conversationId: input.conversationId,
                sellsProductsAndServices: input.sellsProductsAndServices,
                isRegistered: input.isRegistered,
            });
            // Attach preferences (no-op if not present)
            const loadedPrefs = yield this.preferences.load({
                conversationId: input.conversationId,
                workspaceId: input.workspaceId,
            });
            context.preferences = loadedPrefs;
            const mixed = this.mixer.mix({
                intents,
                context,
                isRegistered: input.isRegistered,
            });
            const validation = this.validator.validate(mixed);
            if (!validation.valid) {
                // Fallback: keep minimal intro and questions, drop invalid prompts
                mixed.questions = (_a = mixed.questions) === null || _a === void 0 ? void 0 : _a.slice(0, 1);
            }
            logger_1.default.info("[Orchestration] Completed", {
                intents: intents.map((i) => i.intent.type),
                hasProducts: !!context.products,
                hasFaq: !!context.faqs,
            });
            const message = yield this.naturalMixer.build({
                output: mixed,
                context,
                customerLanguage: input.customerLanguage,
                isRegistered: input.isRegistered,
            });
            return {
                intents,
                context,
                mixed,
                message,
            };
        });
    }
}
exports.OrchestrationService = OrchestrationService;
//# sourceMappingURL=orchestration.service.js.map