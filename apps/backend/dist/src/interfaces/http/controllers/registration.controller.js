"use strict";
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
exports.RegistrationController = void 0;
const registration_service_1 = require("../../../application/services/registration.service");
const secure_token_service_1 = require("../../../application/services/secure-token.service");
const welcome_service_1 = require("../../../application/services/welcome.service");
const prisma_1 = require("../../../lib/prisma");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * RegistrationController class
 * Handles HTTP requests related to customer registration
 */
class RegistrationController {
    constructor() {
        this.secureTokenService = new secure_token_service_1.SecureTokenService();
        this.welcomeService = new welcome_service_1.WelcomeService();
        this.registrationService = new registration_service_1.RegistrationService();
    }
    /**
     * Validate registration token
     */
    validateToken(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { token } = req.params;
                if (!token) {
                    return res.status(400).json({ error: "Token is required" });
                }
                // Use SecureTokenService for unified token validation
                const validation = yield this.secureTokenService.validateToken(token);
                if (!validation.valid) {
                    return res.status(404).json({ error: "Invalid or expired token" });
                }
                const tokenData = validation.data;
                if (!tokenData) {
                    return res.status(404).json({ error: "Invalid or expired token" });
                }
                res.status(200).json({
                    valid: true,
                    phoneNumber: tokenData.phoneNumber,
                    workspaceId: tokenData.workspaceId,
                    expiresAt: tokenData.expiresAt,
                });
            }
            catch (error) {
                logger_1.default.error("Error validating token:", error);
                next(error);
            }
        });
    }
    /**
     * Register a new customer
     */
    register(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { token, first_name, last_name, company, email, phone, workspace_id, language, currency, gdpr_consent, push_notifications_consent, } = req.body;
                // 🔍 DEBUG: Log all received parameters
                logger_1.default.info("[REGISTRATION] 📝 Received registration request:", {
                    token: token ? `${token.substring(0, 20)}...` : "MISSING",
                    first_name,
                    last_name,
                    company,
                    email,
                    phone,
                    workspace_id,
                    language,
                    currency,
                    gdpr_consent: gdpr_consent,
                    gdpr_consent_type: typeof gdpr_consent,
                    push_notifications_consent,
                    all_body_keys: Object.keys(req.body),
                });
                // Validate required fields
                if (!token ||
                    !first_name ||
                    !last_name ||
                    !company ||
                    !email ||
                    !phone ||
                    !workspace_id ||
                    gdpr_consent !== true // ✅ Must be explicitly true
                ) {
                    logger_1.default.error("[REGISTRATION] ❌ Validation failed:", {
                        has_token: !!token,
                        has_first_name: !!first_name,
                        has_last_name: !!last_name,
                        has_company: !!company,
                        has_email: !!email,
                        has_phone: !!phone,
                        has_workspace_id: !!workspace_id,
                        gdpr_consent_value: gdpr_consent,
                        gdpr_consent_check: gdpr_consent !== true,
                    });
                    return res.status(400).json({ error: "Missing required fields" });
                }
                // Use SecureTokenService for unified token validation
                const validation = yield this.secureTokenService.validateToken(token);
                if (!validation.valid) {
                    return res
                        .status(401)
                        .json({ error: "Invalid or expired registration token" });
                }
                const tokenData = validation.data;
                if (!tokenData ||
                    tokenData.phoneNumber !== phone ||
                    tokenData.workspaceId !== workspace_id) {
                    logger_1.default.error(`[REGISTRATION] Token validation failed. TokenData:`, tokenData
                        ? {
                            phoneNumber: tokenData.phoneNumber,
                            workspaceId: tokenData.workspaceId,
                            phone,
                            workspace_id,
                        }
                        : "No token data");
                    return res
                        .status(401)
                        .json({ error: "Invalid or expired registration token" });
                }
                // Check if workspace exists
                const workspace = yield prisma_1.prisma.workspace.findUnique({
                    where: {
                        id: workspace_id,
                    },
                });
                if (!workspace) {
                    return res.status(404).json({ error: "Workspace not found" });
                }
                // Check if customer exists by phone number
                const existingCustomer = yield prisma_1.prisma.customers.findFirst({
                    where: {
                        phone,
                        workspaceId: workspace_id,
                    },
                });
                // Check if email already exists for another customer in the same workspace
                const existingEmailCustomer = yield prisma_1.prisma.customers.findFirst({
                    where: {
                        email: email,
                        workspaceId: workspace_id,
                        id: { not: existingCustomer === null || existingCustomer === void 0 ? void 0 : existingCustomer.id }, // Exclude current customer if updating
                    },
                });
                if (existingEmailCustomer) {
                    return res.status(409).json({
                        error: "Email già registrata",
                        message: "Questo indirizzo email è già registrato nel sistema. Utilizza un'altra email o contatta il supporto.",
                        field: "email",
                    });
                }
                let customer;
                if (existingCustomer) {
                    // Update existing customer and ACTIVATE them
                    customer = yield prisma_1.prisma.customers.update({
                        where: {
                            id: existingCustomer.id,
                        },
                        data: {
                            name: `${first_name} ${last_name}`,
                            email: email, // Use the email provided by the user
                            company,
                            language: language || "ENG",
                            currency: currency || "EUR",
                            last_privacy_version_accepted: "1.0.0", // Current privacy policy version
                            privacy_accepted_at: new Date(),
                            push_notifications_consent: push_notifications_consent || false,
                            push_notifications_consent_at: push_notifications_consent
                                ? new Date()
                                : null,
                            isActive: true, // CRITICAL: Activate the customer after registration!
                            isBlacklisted: true, // 🚨 NEW USERS ARE BLOCKED until admin approval!
                            activeChatbot: false, // 🚨 CHATBOT DISABLED after registration (admin must enable)
                        },
                    });
                }
                else {
                    // Create new customer with provided email
                    try {
                        customer = yield prisma_1.prisma.customers.create({
                            data: {
                                name: `${first_name} ${last_name}`,
                                email: email, // Use the email provided by the user
                                phone,
                                company,
                                workspaceId: workspace_id,
                                language: language || "ENG",
                                currency: currency || "EUR",
                                last_privacy_version_accepted: "1.0.0", // Current privacy policy version
                                privacy_accepted_at: new Date(),
                                push_notifications_consent: push_notifications_consent || false,
                                push_notifications_consent_at: push_notifications_consent
                                    ? new Date()
                                    : null,
                                isActive: true,
                                isBlacklisted: true, // 🚨 NEW USERS ARE BLOCKED until admin approval!
                                activeChatbot: false, // 🚨 CHATBOT DISABLED after registration (admin must enable)
                            },
                        });
                    }
                    catch (createError) {
                        // P2002: Unique constraint violation (phone or email already exists)
                        if (createError.code === "P2002") {
                            logger_1.default.error(`[REGISTRATION] Unique constraint violation during customer creation. Phone: ${phone}, Email: ${email}`, createError);
                            // Fetch the existing customer (race condition: another request created it)
                            customer = yield prisma_1.prisma.customers.findFirst({
                                where: {
                                    phone,
                                    workspaceId: workspace_id,
                                },
                            });
                            if (!customer) {
                                // This should never happen, but handle it gracefully
                                return res.status(409).json({
                                    error: "Numero di telefono o email già registrati",
                                    message: "Questo numero di telefono o email è già presente nel sistema.",
                                });
                            }
                            // Update the existing customer found
                            customer = yield prisma_1.prisma.customers.update({
                                where: {
                                    id: customer.id,
                                },
                                data: {
                                    name: `${first_name} ${last_name}`,
                                    email: email,
                                    company,
                                    language: language || "ENG",
                                    currency: currency || "EUR",
                                    last_privacy_version_accepted: "1.0.0",
                                    privacy_accepted_at: new Date(),
                                    push_notifications_consent: push_notifications_consent || false,
                                    push_notifications_consent_at: push_notifications_consent
                                        ? new Date()
                                        : null,
                                    isActive: true,
                                    isBlacklisted: false,
                                    activeChatbot: true,
                                },
                            });
                            logger_1.default.info(`[REGISTRATION] ✅ Race condition handled - updated existing customer ${customer.id}`);
                        }
                        else {
                            // Different error, rethrow
                            throw createError;
                        }
                    }
                }
                // 🔧 CRITICAL FIX: Update token with customerId for TOKEN-ONLY system
                yield prisma_1.prisma.secureToken.update({
                    where: { token },
                    data: {
                        customerId: customer.id,
                        userId: customer.id, // For backward compatibility
                    },
                });
                logger_1.default.info(`[REGISTRATION] ✅ Token updated with customerId: ${customer.id}`);
                // Mark token as used using SecureTokenService
                yield this.secureTokenService.markTokenAsUsed(token);
                // Clear registration attempts since user successfully registered
                const { RegistrationAttemptsService } = yield Promise.resolve().then(() => __importStar(require("../../../application/services/registration-attempts.service")));
                const registrationAttemptsService = new RegistrationAttemptsService(prisma_1.prisma);
                yield registrationAttemptsService.clearAttempts(phone, workspace_id);
                // 💰 NOTE: Registration cost (€1.00) is already tracked in welcome message
                // No additional charge for registration form submission
                logger_1.default.info(`[REGISTRATION] ✅ Registration completed for ${customer.id} - cost already tracked in welcome message`);
                // 🚨 REMOVED: sendWelcomeMessage() - was duplicate with sendAfterRegistrationMessage
                // Only send ONE message after registration to avoid spam
                // Send after-registration message asynchronously (uses workspace-specific settings)
                this.registrationService
                    .sendAfterRegistrationMessage(customer.id)
                    .then((success) => {
                    if (success) {
                        logger_1.default.info(`After-registration message sent successfully to customer ${customer.id}`);
                    }
                    else {
                        logger_1.default.error(`Failed to send after-registration message to customer ${customer.id}`);
                    }
                })
                    .catch((error) => {
                    logger_1.default.error("Error sending after-registration message:", error);
                });
                res.status(200).json({
                    success: true,
                    customer: {
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone,
                    },
                    message: "Registration successful",
                });
            }
            catch (error) {
                logger_1.default.error("Error registering customer:", error);
                next(error);
            }
        });
    }
    /**
     * Get data protection information
     */
    getDataProtectionInfo(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { lang } = req.query;
                // Default language is English
                const language = (lang === null || lang === void 0 ? void 0 : lang.toString()) || "en";
                // This would ideally come from a database or translation files
                let content;
                switch (language.toLowerCase()) {
                    case "it":
                        content = {
                            title: "Come proteggiamo i tuoi dati",
                            content: "Il nostro sistema utilizza tecniche avanzate di tokenizzazione per proteggere i tuoi dati personali. Quando invii un messaggio, i tuoi dati personali vengono sostituiti con token casuali prima di essere elaborati dai nostri modelli di intelligenza artificiale. Questi token vengono poi sostituiti con i dati originali solo quando il messaggio viene inviato a te.",
                            sections: [
                                {
                                    title: "Il nostro processo di sicurezza",
                                    content: "Ogni dato sensibile viene criptato e protetto secondo gli standard più elevati.",
                                },
                                {
                                    title: "Conformità GDPR",
                                    content: "Siamo pienamente conformi alle normative GDPR per la protezione dei dati personali.",
                                },
                            ],
                        };
                        break;
                    default: // English as default
                        content = {
                            title: "How we protect your data",
                            content: "Our system uses advanced tokenization techniques to protect your personal data. When you send a message, your personal data is replaced with random tokens before being processed by our AI models. These tokens are then replaced with the original data only when the message is sent back to you.",
                            sections: [
                                {
                                    title: "Our security process",
                                    content: "Every sensitive piece of data is encrypted and protected according to the highest standards.",
                                },
                                {
                                    title: "GDPR compliance",
                                    content: "We are fully compliant with GDPR regulations for the protection of personal data.",
                                },
                            ],
                        };
                }
                res.status(200).json(content);
            }
            catch (error) {
                logger_1.default.error("Error getting data protection info:", error);
                next(error);
            }
        });
    }
    /**
     * Send registration confirmation message to user
     */
    sendRegistrationConfirmationMessage(phoneNumber, workspaceId, language, customerName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get workspace settings for after-registration messages
                const workspace = yield prisma_1.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { afterRegistrationMessages: true },
                });
                if (!(workspace === null || workspace === void 0 ? void 0 : workspace.afterRegistrationMessages)) {
                    logger_1.default.warn(`[REGISTRATION_CONFIRMATION] No after-registration messages configured for workspace ${workspaceId}`);
                    return;
                }
                const messages = workspace.afterRegistrationMessages;
                let confirmationMessage = messages[language] || messages["en"] || messages["it"];
                if (!confirmationMessage) {
                    logger_1.default.warn(`[REGISTRATION_CONFIRMATION] No message found for language ${language} in workspace ${workspaceId}`);
                    return;
                }
                // Replace [nome] placeholder with actual customer name
                confirmationMessage = confirmationMessage.replace(/\[nome\]/g, customerName);
                // TODO: Send message via WhatsApp API
                // For now, just log the message
                logger_1.default.info(`[REGISTRATION_CONFIRMATION] Would send to ${phoneNumber}: ${confirmationMessage}`);
                // In a real implementation, you would send this via WhatsApp API
                // await whatsappService.sendMessage(phoneNumber, confirmationMessage, workspaceId);
            }
            catch (error) {
                logger_1.default.error(`[REGISTRATION_CONFIRMATION] Error sending confirmation message to ${phoneNumber}:`, error);
            }
        });
    }
}
exports.RegistrationController = RegistrationController;
//# sourceMappingURL=registration.controller.js.map