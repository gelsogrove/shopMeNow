"use strict";
/**
 * Message Sending Service - CENTRAL HUB for all WhatsApp messages
 *
 * 🎯 OBIETTIVO: TUTTI i messaggi WhatsApp DEVONO passare da questo service
 *
 * ✅ Garantisce che security layer sia applicato quando necessario
 * ✅ Log uniforme per audit trail
 * ✅ Gestione errori centralizzata
 * ✅ Salvataggio automatico in database
 *
 * 🚨 REGOLA CRITICA: sendToWhatsApp NON deve essere chiamato direttamente!
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.MessageSendingService = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../utils/logger"));
const translation_security_service_1 = __importDefault(require("./translation-security.service"));
const whatsapp_api_service_1 = require("./whatsapp-api.service");
const config_1 = require("../config");
/**
 * Message Sending Service
 * Punto UNICO per tutti gli invii WhatsApp
 */
class MessageSendingService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Invia un messaggio WhatsApp con security layer automatico
     *
     * @param options Opzioni di invio
     * @returns Risultato dell'invio
     */
    sendMessage(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            logger_1.default.info("📤 [MESSAGE-SEND] Starting message send", {
                sendType: options.sendType,
                phoneNumber: options.phoneNumber,
                workspaceId: options.workspaceId,
                customerId: options.customerId,
                messageLength: options.message.length,
                skipSecurityLayer: options.skipSecurityLayer,
            });
            try {
                // 1. Determine if security layer is needed
                const needsSecurity = this.needsSecurityCheck(options.sendType, options.skipSecurityLayer);
                let finalMessage = options.message;
                let securityChecked = false;
                let blocked = false;
                let blockReason;
                // 2. Apply security layer if needed
                if (needsSecurity) {
                    logger_1.default.info("🔒 [MESSAGE-SEND] Applying security layer", {
                        sendType: options.sendType,
                    });
                    const securityResult = yield this.applySecurityLayer(options.message, options.userLanguage || "it", options.workspaceId);
                    securityChecked = true;
                    if (securityResult.blocked) {
                        blocked = true;
                        blockReason = securityResult.reason;
                        logger_1.default.warn("🚨 [MESSAGE-SEND] Security layer BLOCKED message", {
                            sendType: options.sendType,
                            reason: securityResult.reason,
                            phoneNumber: options.phoneNumber,
                            customerId: options.customerId,
                        });
                        // Return blocked result WITHOUT sending to WhatsApp
                        return {
                            success: false,
                            error: `Message blocked by security layer: ${securityResult.reason}`,
                            blocked: true,
                            blockReason: securityResult.reason,
                            securityChecked: true,
                        };
                    }
                    finalMessage = securityResult.translatedText;
                    logger_1.default.info("✅ [MESSAGE-SEND] Security layer passed", {
                        originalLength: options.message.length,
                        finalLength: finalMessage.length,
                    });
                }
                else {
                    logger_1.default.info("⏭️ [MESSAGE-SEND] Skipping security layer", {
                        sendType: options.sendType,
                        reason: options.skipSecurityLayer
                            ? "Explicitly skipped"
                            : "Not required for this send type",
                    });
                }
                // 3. Save to database BEFORE sending to WhatsApp (for better audit trail)
                let messageId;
                if (options.chatSessionId) {
                    logger_1.default.info("💾 [MESSAGE-SEND] Saving to history BEFORE WhatsApp send", {
                        chatSessionId: options.chatSessionId,
                        sendType: options.sendType,
                    });
                    messageId = yield this.saveMessageToDatabase(options, finalMessage, { success: false }, // Temporary status, will update after WhatsApp send
                    securityChecked);
                    logger_1.default.info("✅ [MESSAGE-SEND] Message saved to history", {
                        messageId,
                        duration: Date.now() - startTime,
                    });
                }
                // 4. Send to WhatsApp
                logger_1.default.info("📱 [MESSAGE-SEND] Sending to WhatsApp", {
                    phoneNumber: options.phoneNumber,
                    messageLength: finalMessage.length,
                });
                const whatsappResult = yield (0, whatsapp_api_service_1.sendToWhatsApp)(options.phoneNumber, finalMessage, options.workspaceId);
                if (!whatsappResult.success) {
                    logger_1.default.error("❌ [MESSAGE-SEND] WhatsApp send failed", {
                        error: whatsappResult.error,
                        phoneNumber: options.phoneNumber,
                    });
                    // Update message status to failed
                    if (messageId) {
                        yield this.updateMessageStatus(messageId, "failed", whatsappResult.error);
                    }
                    return {
                        success: false,
                        error: whatsappResult.error,
                        securityChecked,
                        blocked: false,
                    };
                }
                logger_1.default.info("✅ [MESSAGE-SEND] WhatsApp send successful", {
                    messageId: whatsappResult.messageId,
                    duration: Date.now() - startTime,
                });
                // 5. Update message status to sent
                if (messageId) {
                    yield this.updateMessageStatus(messageId, "sent", undefined, whatsappResult.messageId);
                }
                return {
                    success: true,
                    messageId: whatsappResult.messageId,
                    blocked: false,
                    securityChecked,
                    translatedText: finalMessage,
                };
            }
            catch (error) {
                logger_1.default.error("❌ [MESSAGE-SEND] Fatal error", {
                    error,
                    sendType: options.sendType,
                    phoneNumber: options.phoneNumber,
                });
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    securityChecked: false,
                    blocked: false,
                };
            }
        });
    }
    /**
     * Determina se il security layer è necessario
     *
     * @param sendType Tipo di invio
     * @param skipExplicit Flag esplicito per saltare security
     * @returns true se security layer necessario
     */
    needsSecurityCheck(sendType, skipExplicit) {
        // Se esplicitamente saltato dall'utente, rispetta la scelta
        if (skipExplicit === true) {
            return false;
        }
        // Matrice decisionale basata su sendType
        switch (sendType) {
            case "CHATBOT":
                // ✅ LLM può generare contenuto inappropriato
                return true;
            case "CAMPAIGN":
                // ✅ Token replacement da DB può contenere dati malevoli
                return true;
            case "SCHEDULER":
                // ✅ Contenuto automatico, serve controllo
                return true;
            case "ADMIN_MANUAL":
                // ❌ Admin è fidato (ma può esplicitamente richiedere check)
                return false;
            case "SYSTEM":
                // ❌ Notifiche hardcoded, nessun input esterno
                return false;
            default:
                // 🚨 Safe default: in caso di dubbio, applica security
                logger_1.default.warn("⚠️ [MESSAGE-SEND] Unknown sendType, applying security by default", {
                    sendType,
                });
                return true;
        }
    }
    /**
     * Applica il security layer al messaggio
     */
    applySecurityLayer(message, language, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Get workspace with agentConfigs to use same LLM model as agent
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    url: true,
                    agentConfigs: {
                        select: {
                            model: true,
                        },
                        take: 1, // Get first (primary) agent config
                    },
                },
            });
            const workspaceUrl = (workspace === null || workspace === void 0 ? void 0 : workspace.url) || "";
            const allowedLinks = this.buildAllowedLinks(workspaceUrl);
            // 🔧 Get LLM config from Agent Settings (same model/provider as agent)
            const { getLLMConfig } = yield Promise.resolve().then(() => __importStar(require("../config/llm.config")));
            const agentModel = (_b = (_a = workspace === null || workspace === void 0 ? void 0 : workspace.agentConfigs) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.model;
            const llmConfig = getLLMConfig(agentModel);
            logger_1.default.info("🔒 [MESSAGE-SEND] Security layer using agent model", {
                agentModel,
                provider: "OpenRouter (cloud)",
            });
            return yield translation_security_service_1.default.processResponse(message, language, allowedLinks, llmConfig.model, // Use same model as agent
            llmConfig.baseURL, // Use same baseURL as agent
            llmConfig.apiKey // Use same API key as agent
            );
        });
    }
    /**
     * Salva il messaggio nel database con audit trail
     * @returns messageId del messaggio salvato
     */
    saveMessageToDatabase(options, finalMessage, whatsappResult, securityChecked) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const savedMessage = yield this.prisma.message.create({
                    data: {
                        chatSessionId: options.chatSessionId,
                        direction: "OUTBOUND",
                        content: finalMessage,
                        whatsappStatus: whatsappResult.success ? "sent" : "pending",
                        whatsappError: whatsappResult.error || null,
                        whatsappMessageId: whatsappResult.messageId || null,
                        metadata: Object.assign({ sendType: options.sendType, securityChecked, originalMessage: options.message !== finalMessage ? options.message : undefined }, options.metadata),
                    },
                });
                logger_1.default.info("💾 [MESSAGE-SEND] Message saved to database", {
                    chatSessionId: options.chatSessionId,
                    sendType: options.sendType,
                    messageId: savedMessage.id,
                });
                return savedMessage.id;
            }
            catch (error) {
                logger_1.default.error("❌ [MESSAGE-SEND] Failed to save message to DB", {
                    error,
                    chatSessionId: options.chatSessionId,
                });
                // Don't throw - continue with WhatsApp send
                return undefined;
            }
        });
    }
    /**
     * Aggiorna lo stato WhatsApp del messaggio
     */
    updateMessageStatus(messageId, status, error, whatsappMessageId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.message.update({
                    where: { id: messageId },
                    data: {
                        whatsappStatus: status,
                        whatsappError: error || null,
                        whatsappMessageId: whatsappMessageId || null,
                    },
                });
                logger_1.default.info("✅ [MESSAGE-SEND] Message status updated", {
                    messageId,
                    status,
                });
            }
            catch (error) {
                logger_1.default.error("❌ [MESSAGE-SEND] Failed to update message status", {
                    error,
                    messageId,
                });
            }
        });
    }
    /**
     * Health check - verifica che il service sia configurato correttamente
     */
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check database connection
                yield this.prisma.$queryRaw `SELECT 1`;
                // Check translation service
                const isHealthy = yield translation_security_service_1.default.healthCheck();
                return isHealthy;
            }
            catch (error) {
                logger_1.default.error("❌ [MESSAGE-SEND] Health check failed", error);
                return false;
            }
        });
    }
    buildAllowedLinks(workspaceUrl) {
        const links = new Set();
        const addIfValid = (value) => {
            if (!value)
                return;
            const trimmed = value.trim();
            if (!trimmed)
                return;
            links.add(trimmed);
        };
        const addBaseVariants = (base) => {
            if (!base)
                return;
            const normalized = base.trim().replace(/\/+$/, "");
            if (!normalized)
                return;
            addIfValid(normalized);
            addIfValid(`${normalized}/`);
            addIfValid(`${normalized}/uploads`);
            addIfValid(`${normalized}/uploads/`);
            addIfValid(`${normalized}/assets`);
            addIfValid(`${normalized}/assets/`);
        };
        if (workspaceUrl) {
            const normalizedWorkspace = workspaceUrl.trim().replace(/\/+$/, "");
            addIfValid(normalizedWorkspace);
            addIfValid(`${normalizedWorkspace}/s`);
            addIfValid(`${normalizedWorkspace}/s/`);
            addIfValid(`${normalizedWorkspace}/orders-public`);
            addIfValid(`${normalizedWorkspace}/checkout-public`);
            addIfValid(`${normalizedWorkspace}/api`);
            addIfValid(`${normalizedWorkspace}/api/`);
            // Add uploads path for product images
            addIfValid(`${normalizedWorkspace}/uploads`);
            addIfValid(`${normalizedWorkspace}/uploads/`);
        }
        addBaseVariants(config_1.config.frontendUrl);
        addBaseVariants(config_1.config.appUrl);
        addIfValid("https://wa.me/");
        return Array.from(links);
    }
}
exports.MessageSendingService = MessageSendingService;
// Export singleton instance
exports.default = new MessageSendingService(database_1.prisma);
//# sourceMappingURL=message-sending.service.js.map