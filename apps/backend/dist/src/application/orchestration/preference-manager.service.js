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
exports.PreferenceManagerService = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Manages conversational preferences with confidence/expiry metadata.
 * Current version keeps a JSON blob on customer row if available, otherwise
 * acts as an in-memory passthrough.
 */
class PreferenceManagerService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    load(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const session = yield this.prisma.chatSession.findUnique({
                    where: { id: params.conversationId },
                    select: { context: true, workspaceId: true },
                });
                if (!session || session.workspaceId !== params.workspaceId) {
                    return [];
                }
                const prefs = ((_a = session.context) === null || _a === void 0 ? void 0 : _a.preferences) || [];
                return Array.isArray(prefs) ? prefs : [];
            }
            catch (error) {
                logger_1.default.error("[Preferences] Failed to load preferences", { error });
                return [];
            }
        });
    }
    save(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existing = yield this.prisma.chatSession.findUnique({
                    where: { id: params.conversationId },
                    select: { context: true, workspaceId: true },
                });
                if (!existing || existing.workspaceId !== params.workspaceId) {
                    return;
                }
                const nextContext = Object.assign(Object.assign({}, existing.context), { preferences: params.preferences });
                yield this.prisma.chatSession.update({
                    where: { id: params.conversationId },
                    data: { context: nextContext },
                });
            }
            catch (error) {
                logger_1.default.error("[Preferences] Failed to save preferences", { error });
            }
        });
    }
}
exports.PreferenceManagerService = PreferenceManagerService;
//# sourceMappingURL=preference-manager.service.js.map