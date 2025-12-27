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
exports.RegistrationService = void 0;
const database_1 = require("@echatbot/database");
const message_repository_1 = require("../../repositories/message.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service for handling registration-related functionality
 */
class RegistrationService {
    constructor() {
        this.prisma = database_1.prisma;
        this.messageRepository = new message_repository_1.MessageRepository();
    }
    /**
     * Send a WhatsApp message using workspace settings
     */
    sendWhatsAppMessage(phoneNumber, message, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[REGISTRATION-WA] 📱 Sending after-registration message to ${phoneNumber}`);
                // Get workspace WhatsApp settings
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: {
                        whatsappApiKey: true,
                        whatsappPhoneNumber: true,
                    },
                });
                if (!workspace || !workspace.whatsappApiKey) {
                    logger_1.default.error(`[REGISTRATION-WA] WhatsApp settings not found for workspace ${workspaceId}`);
                    return false;
                }
                // Send message via WhatsApp Business API
                const whatsappApiUrl = `https://graph.facebook.com/v18.0/${workspace.whatsappPhoneNumber}/messages`;
                const whatsappPayload = {
                    messaging_product: "whatsapp",
                    to: phoneNumber.replace("+", ""),
                    type: "text",
                    text: {
                        body: message,
                    },
                };
                const response = yield fetch(whatsappApiUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${workspace.whatsappApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(whatsappPayload),
                });
                if (!response.ok) {
                    const errorData = yield response.text();
                    logger_1.default.error(`[REGISTRATION-WA] WhatsApp API error: ${response.status} ${response.statusText} - ${errorData}`);
                    return false;
                }
                const responseData = yield response.json();
                logger_1.default.info(`[REGISTRATION-WA] ✅ Message sent successfully:`, responseData);
                return true;
            }
            catch (error) {
                logger_1.default.error(`[REGISTRATION-WA] Error sending WhatsApp message:`, error);
                return false;
            }
        });
    }
    /**
     * Send an after-registration message to a newly registered customer
     * ✅ USES Security & Translation layer (MANDATORY)
     *
     * @param customerId The customer ID
     * @returns True if message was sent successfully
     */
    sendAfterRegistrationMessage(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get customer data
                const customer = yield this.prisma.customers.findUnique({
                    where: {
                        id: customerId,
                    },
                    include: {
                        workspace: true,
                    },
                });
                if (!customer) {
                    logger_1.default.error(`Customer with ID ${customerId} not found`);
                    return false;
                }
                // Get customer language
                const customerLanguage = customer.language || "English";
                // Extract first name
                const firstName = customer.name.split(" ")[0];
                // Get workspace settings
                const workspaceSettings = yield this.messageRepository.getWorkspaceSettings(customer.workspaceId);
                if (!workspaceSettings) {
                    logger_1.default.error(`Workspace settings not found for workspace ${customer.workspaceId}`);
                    return false;
                }
                // Get the after-registration message from workspace settings (ENGLISH ONLY)
                const afterRegistrationMessages = workspaceSettings.afterRegistrationMessages || {};
                // Get ENGLISH message from database
                let afterRegistrationMessageEnglish = afterRegistrationMessages["en"];
                // If no message found in workspace settings, use default ENGLISH
                if (!afterRegistrationMessageEnglish) {
                    afterRegistrationMessageEnglish =
                        this.getDefaultAfterRegistrationMessage("en");
                }
                // Replace placeholders in ENGLISH message
                afterRegistrationMessageEnglish = afterRegistrationMessageEnglish.replace(/\[nome\]/gi, firstName);
                // ✅ TRANSLATE via Security & Translation layer (MANDATORY)
                const { LLMService } = require("../../services/llm.service");
                const llmService = new LLMService();
                const normalizedLanguage = this.normalizeLanguageCode(customerLanguage);
                const afterRegistrationMessage = yield llmService.translateSystemMessage(afterRegistrationMessageEnglish, customer.workspaceId, normalizedLanguage, undefined, "registration_confirmation" // stage name for Safety layer
                );
                logger_1.default.info(`✅ After-registration message translated via Security & Translation layer`, {
                    customerId,
                    language: normalizedLanguage,
                    stage: "registration_confirmation",
                });
                // Send the message
                if (customer.phone) {
                    try {
                        // 1. Send via WhatsApp API
                        const whatsappSent = yield this.sendWhatsAppMessage(customer.phone, afterRegistrationMessage, customer.workspaceId);
                        if (!whatsappSent) {
                            logger_1.default.warn(`Failed to send after-registration message via WhatsApp to ${customer.phone}`);
                        }
                        // 2. Save the outgoing message to history (even if WhatsApp failed)
                        // 🔧 CRITICAL: Use conversationMessage table (NEW) not message table (OLD)
                        // This ensures messages appear in frontend (same as welcome message flow)
                        // Get or create chat session
                        let chatSession = yield this.prisma.chatSession.findFirst({
                            where: {
                                customerId: customer.id,
                                workspaceId: customer.workspaceId,
                                status: "active",
                            },
                        });
                        if (!chatSession) {
                            chatSession = yield this.prisma.chatSession.create({
                                data: {
                                    customerId: customer.id,
                                    workspaceId: customer.workspaceId,
                                    status: "active",
                                },
                            });
                        }
                        // Save to conversationMessage table (NEW format)
                        yield this.prisma.conversationMessage.create({
                            data: {
                                workspaceId: customer.workspaceId,
                                customerId: customer.id,
                                conversationId: chatSession.id,
                                role: "assistant", // Bot response
                                content: afterRegistrationMessage,
                                agentType: "REGISTRATION_CONFIRMATION",
                                tokensUsed: 0, // No LLM tokens (static message + translation)
                                debugInfo: JSON.stringify({
                                    stage: "registration_confirmation",
                                    translatedViaSecurityLayer: true,
                                    language: normalizedLanguage,
                                    firstName: firstName,
                                    timestamp: new Date().toISOString(),
                                }),
                            },
                        });
                        logger_1.default.info(`✅ After-registration message ${whatsappSent ? "sent" : "saved"} for customer ${customerId} (translated via Security layer, saved to conversationMessage)`);
                        return whatsappSent;
                    }
                    catch (error) {
                        logger_1.default.error("Error sending after-registration message:", error);
                        return false;
                    }
                }
                else {
                    logger_1.default.error(`Customer ${customerId} has no phone number`);
                    return false;
                }
            }
            catch (error) {
                logger_1.default.error("Error sending after-registration message:", error);
                return false;
            }
        });
    }
    /**
     * Normalize language code for consistent lookup
     */
    normalizeLanguageCode(language) {
        if (!language)
            return "en";
        const upperLanguage = language.toUpperCase();
        // Direct 3-letter code mapping (used by our system)
        if (upperLanguage === "IT")
            return "it";
        if (upperLanguage === "ENG")
            return "en";
        if (upperLanguage === "ESP")
            return "es";
        if (upperLanguage === "PRT")
            return "pt";
        if (upperLanguage === "FR")
            return "fr";
        if (upperLanguage === "DE")
            return "de";
        // Fallback: partial string matching
        const lowerCaseLanguage = language.toLowerCase();
        if (lowerCaseLanguage.includes("ital"))
            return "it";
        if (lowerCaseLanguage.includes("engl") || lowerCaseLanguage.includes("ing"))
            return "en";
        if (lowerCaseLanguage.includes("span") || lowerCaseLanguage.includes("esp"))
            return "es";
        if (lowerCaseLanguage.includes("fran") || lowerCaseLanguage.includes("fr"))
            return "fr";
        if (lowerCaseLanguage.includes("deut") ||
            lowerCaseLanguage.includes("germ"))
            return "de";
        if (lowerCaseLanguage.includes("port") ||
            lowerCaseLanguage.includes("portu"))
            return "pt";
        // Default to English if no match
        return "en";
    }
    /**
     * Get default after-registration message in the specified language
     */
    getDefaultAfterRegistrationMessage(languageCode) {
        if (languageCode === "it") {
            return "Grazie, ti sei registrato con successo! Ti ricontatteremo a breve.";
        }
        if (languageCode === "es") {
            return "¡Gracias, te has registrado con éxito! Te contactaremos pronto.";
        }
        if (languageCode === "fr") {
            return "Merci, vous vous êtes inscrit avec succès ! Nous vous recontacterons bientôt.";
        }
        if (languageCode === "de") {
            return "Danke, Sie haben sich erfolgreich registriert! Wir werden uns bald bei Ihnen melden.";
        }
        if (languageCode === "pt") {
            return "Obrigado, você se registrou com sucesso! Entraremos em contato em breve.";
        }
        // Default English
        return "Thank you, you have successfully registered! We will get back to you shortly.";
    }
}
exports.RegistrationService = RegistrationService;
//# sourceMappingURL=registration.service.js.map