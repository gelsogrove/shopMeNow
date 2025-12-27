"use strict";
/**
 * 🔹 MAIN ROUTER - INDEX.TS
 *
 * Central routing file for eChatbot backend.
 *
 * ORGANIZATION:
 * 1. Core imports (Prisma, Express, Config)
 * 2. Middleware imports
 * 3. Service imports
 * 4. Controller imports
 * 5. Repository imports
 * 6. Router imports (feature-specific)
 * 7. Helper functions (moved to separate files where possible)
 * 8. Route registration
 */
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
// ============================================================================
// 1. CORE IMPORTS
// ============================================================================
const database_1 = require("@echatbot/database");
const express_1 = require("express");
const logger_1 = __importDefault(require("../utils/logger"));
// ============================================================================
// 2. MIDDLEWARE IMPORTS
// ============================================================================
const auth_middleware_1 = require("../interfaces/http/middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../interfaces/http/middlewares/workspace-validation.middleware");
// ============================================================================
// 3. SERVICE IMPORTS
// ============================================================================
const auth_service_1 = require("../application/services/auth.service");
const otp_service_1 = require("../application/services/otp.service");
const registration_attempts_service_1 = require("../application/services/registration-attempts.service");
const secure_token_service_1 = require("../application/services/secure-token.service");
const user_service_1 = require("../application/services/user.service");
// ============================================================================
// 4. CONTROLLER IMPORTS
// ============================================================================
const auth_controller_1 = require("../interfaces/http/controllers/auth.controller");
const campaign_controller_1 = require("../interfaces/http/controllers/campaign.controller");
const cart_token_controller_1 = require("../interfaces/http/controllers/cart-token.controller");
const category_controller_1 = require("../interfaces/http/controllers/category.controller");
const chat_controller_1 = require("../interfaces/http/controllers/chat.controller");
const customers_controller_1 = require("../interfaces/http/controllers/customers.controller");
const faq_controller_1 = require("../interfaces/http/controllers/faq.controller");
const feedback_controller_1 = require("../interfaces/http/controllers/feedback.controller");
const product_controller_1 = require("../interfaces/http/controllers/product.controller");
const push_controller_1 = require("../interfaces/http/controllers/push.controller");
const services_controller_1 = require("../interfaces/http/controllers/services.controller");
const settings_controller_1 = require("../interfaces/http/controllers/settings.controller");
const user_controller_1 = require("../interfaces/http/controllers/user.controller");
// ============================================================================
// 5. REPOSITORY IMPORTS
// ============================================================================
const message_repository_1 = require("../repositories/message.repository");
// ============================================================================
// 6. ROUTER IMPORTS (Feature-specific routes)
// ============================================================================
// Agent & AI
const agent_config_routes_1 = __importDefault(require("../interfaces/http/routes/agent-config.routes"));
const agent_routes_1 = require("../interfaces/http/routes/agent.routes");
const agentChatRoutes_1 = __importDefault(require("./agentChatRoutes"));
// Auth & User
const auth_routes_1 = require("../interfaces/http/routes/auth.routes");
const registration_routes_1 = __importDefault(require("../interfaces/http/routes/registration.routes"));
const session_routes_1 = require("../interfaces/http/routes/session.routes");
const user_routes_1 = require("../interfaces/http/routes/user.routes");
// Workspace
const workspace_routes_1 = require("../interfaces/http/routes/workspace.routes");
const workspace_routes_2 = __importDefault(require("./workspace.routes"));
const invitation_routes_1 = require("../interfaces/http/routes/invitation.routes");
const member_routes_1 = require("../interfaces/http/routes/member.routes");
// E-commerce
const cart_routes_1 = require("../interfaces/http/routes/cart.routes");
const categories_routes_1 = require("../interfaces/http/routes/categories.routes");
const certification_routes_1 = __importDefault(require("../interfaces/http/routes/certification.routes"));
const credit_note_routes_1 = __importDefault(require("../interfaces/http/routes/credit-note.routes"));
const transport_type_routes_1 = __importDefault(require("../interfaces/http/routes/transport-type.routes"));
const chat_routes_1 = require("../interfaces/http/routes/chat.routes");
const checkout_routes_1 = require("../interfaces/http/routes/checkout.routes");
const offers_routes_1 = require("../interfaces/http/routes/offers.routes");
const order_routes_1 = require("../interfaces/http/routes/order.routes");
const orders_routes_1 = __importDefault(require("../interfaces/http/routes/orders.routes"));
const products_routes_1 = __importDefault(require("../interfaces/http/routes/products.routes"));
const public_orders_routes_1 = __importDefault(require("../interfaces/http/routes/public-orders.routes"));
const sales_routes_1 = require("../interfaces/http/routes/sales.routes");
// Customer & Communication
const campaign_routes_1 = require("../interfaces/http/routes/campaign.routes");
const customers_routes_1 = require("../interfaces/http/routes/customers.routes");
const faqs_routes_1 = require("../interfaces/http/routes/faqs.routes");
const feedback_routes_1 = require("../interfaces/http/routes/feedback.routes");
const push_routes_1 = require("../interfaces/http/routes/push.routes");
const whatsapp_queue_routes_1 = require("../interfaces/http/routes/whatsapp-queue.routes");
// Services
const services_routes_1 = require("../interfaces/http/routes/services.routes");
// System & Config
const rate_limiters_1 = require("../config/rate-limiters");
const analytics_routes_1 = __importDefault(require("../interfaces/http/routes/analytics.routes"));
const billing_routes_1 = require("../interfaces/http/routes/billing.routes");
const subscription_billing_routes_1 = require("../interfaces/http/routes/subscription-billing.routes");
const owner_billing_routes_1 = require("../interfaces/http/routes/owner-billing.routes");
const debug_routes_1 = __importDefault(require("../interfaces/http/routes/debug.routes"));
const languages_routes_1 = require("../interfaces/http/routes/languages.routes");
const gdpr_routes_1 = __importDefault(require("../interfaces/http/routes/gdpr.routes"));
const platform_config_routes_1 = __importDefault(require("../interfaces/http/routes/platform-config.routes"));
const pricing_routes_1 = __importDefault(require("../interfaces/http/routes/pricing.routes"));
const settings_routes_1 = __importDefault(require("../interfaces/http/routes/settings.routes"));
const short_url_routes_1 = require("../interfaces/http/routes/short-url.routes");
const whatsapp_routes_1 = __importDefault(require("../interfaces/http/routes/whatsapp.routes"));
const token_1 = require("./token");
const user_admin_routes_1 = __importDefault(require("../interfaces/http/routes/user-admin.routes"));
const two_factor_reset_routes_1 = __importDefault(require("../interfaces/http/routes/two-factor-reset.routes"));
const trash_routes_1 = require("../interfaces/http/routes/trash.routes");
// ============================================================================
// 7. TYPE IMPORTS
// ============================================================================
/**
 * 🔒 BLACKLIST CHECK HELPER
 * Checks if a customer is blacklisted and returns appropriate response
 */
function checkCustomerBlacklist(phoneNumber_1, workspaceId_1, res_1) {
    return __awaiter(this, arguments, void 0, function* (phoneNumber, workspaceId, res, format = "WHATSAPP") {
        try {
            const customer = yield database_1.prisma.customers.findFirst({
                where: {
                    phone: phoneNumber.replace(/\s+/g, ""),
                    isActive: true,
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    language: true,
                    isBlacklisted: true,
                },
            });
            // ✅ BLACKLIST CHECK ENABLED - Check customer blacklist status
            logger_1.default.info(`🚫 ${format}: Checking blacklist status for ${phoneNumber}`);
            if (customer === null || customer === void 0 ? void 0 : customer.isBlacklisted) {
                logger_1.default.info(`🚫 ${format}: Customer ${phoneNumber} is blacklisted - IGNORING MESSAGE`);
                res.status(200).json({
                    success: true,
                    data: {
                        sessionId: null,
                        message: "EVENT_RECEIVED_CUSTOMER_BLACKLISTED",
                    },
                });
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.default.error(`[BLACKLIST_CHECK] Error checking blacklist for ${phoneNumber}:`, error);
            return false;
        }
    });
}
/**
 * � LANGUAGE DETECTION HELPER
 * Determines user language based on phone number prefix
 * @param phoneNumber - User phone number with country prefix
 * @returns Language code (it, es, pt, en)
 */
function detectLanguageFromPhonePrefix(phoneNumber) {
    // Supported country prefixes with their corresponding languages:
    // +39 = Italy (Italian)
    // +34 = Spain (Spanish)
    // +351 = Portugal (Portuguese)
    // All others = Default to English
    if (phoneNumber.startsWith("+39")) {
        return "it"; // Italian
    }
    else if (phoneNumber.startsWith("+34")) {
        return "es"; // Spanish
    }
    else if (phoneNumber.startsWith("+351")) {
        return "pt"; // Portuguese
    }
    return "en"; // Default to English for all other prefixes
}
/**
 * �🆕 NEW USER WELCOME FLOW HELPER
 * Handles new user detection, registration attempts tracking, and welcome message sending
 * @param phoneNumber - User phone number
 * @param workspaceId - Workspace ID
 * @param messageContent - User message content
 * @param res - Express response object
 * @param format - Format type for logging ('WHATSAPP' or 'TEST')
 * @returns Promise<boolean> - true if handled (response sent), false if should continue normal flow
 */
function getRegistrationText(language) {
    // Read TOKEN_EXPIRATION from environment (e.g., "15m" or "1h")
    const tokenExpiration = process.env.TOKEN_EXPIRATION || "1h";
    // Parse the duration
    const match = tokenExpiration.match(/^(\d+)([hm])$/);
    let validityText = "1 hour"; // Default fallback
    if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        // Generate text based on language and duration
        if (unit === "m") {
            // Minutes
            validityText =
                language.toLowerCase() === "en"
                    ? `${value} minutes`
                    : language.toLowerCase() === "es"
                        ? `${value} minutos`
                        : language.toLowerCase() === "pt"
                            ? `${value} minutos`
                            : `${value} minuti`; // Italian
        }
        else {
            // Hours
            validityText =
                language.toLowerCase() === "en"
                    ? `${value} hour${value > 1 ? "s" : ""}`
                    : language.toLowerCase() === "es"
                        ? `${value} hora${value > 1 ? "s" : ""}`
                        : language.toLowerCase() === "pt"
                            ? `${value} hora${value > 1 ? "s" : ""}`
                            : `${value} ora${value > 1 ? "" : ""}`; // Italian (1 ora, 2 ore)
        }
    }
    switch (language.toLowerCase()) {
        case "en":
            return {
                link: "To continue, register here",
                validity: `Link valid for ${validityText}`,
            };
        case "es":
            return {
                link: "Para continuar, regístrate aquí",
                validity: `Enlace válido por ${validityText}`,
            };
        case "pt":
            return {
                link: "Para continuar, registre-se aqui",
                validity: `Link válido por ${validityText}`,
            };
        case "it":
        default:
            return {
                link: "Per continuare, registrati qui",
                validity: `Link valido per ${validityText}`,
            };
    }
}
function handleNewUserWelcomeFlow(phoneNumber_1, workspaceId_1, messageContent_1, res_1) {
    return __awaiter(this, arguments, void 0, function* (phoneNumber, workspaceId, messageContent, res, format = "WHATSAPP") {
        try {
            // Initialize services
            const secureTokenService = new secure_token_service_1.SecureTokenService();
            const messageRepository = new message_repository_1.MessageRepository();
            const registrationAttemptsService = new registration_attempts_service_1.RegistrationAttemptsService(database_1.prisma);
            // Check if user is blocked due to too many registration attempts
            const isBlocked = yield registrationAttemptsService.isBlocked(phoneNumber, workspaceId);
            if (isBlocked) {
                // ✅ REGISTRATION ATTEMPTS CHECK ENABLED - Block users with too many attempts
                logger_1.default.info(`🚫 ${format}: User ${phoneNumber} is blocked due to too many registration attempts - IGNORING MESSAGE`);
                res.status(200).json({
                    success: true,
                    data: {
                        sessionId: null,
                        message: "EVENT_RECEIVED_CUSTOMER_BLACKLISTED",
                    },
                });
                return true;
            }
            // Record this registration attempt
            const attempt = yield registrationAttemptsService.recordAttempt(phoneNumber, workspaceId);
            logger_1.default.info(`📊 ${format}: Registration attempt ${attempt.attemptCount}/3 for ${phoneNumber}`);
            // If user is now blocked after this attempt, ignore completely (blacklist totale)
            if (attempt.isBlocked) {
                // ✅ REGISTRATION ATTEMPTS CHECK ENABLED - Block users after too many attempts
                logger_1.default.info(`🚫 ${format}: User ${phoneNumber} blocked after ${attempt.attemptCount} attempts - IGNORING MESSAGE`);
                res.status(200).json({
                    success: true,
                    data: {
                        sessionId: null,
                        message: "EVENT_RECEIVED_CUSTOMER_BLACKLISTED",
                    },
                });
                return true;
            }
            // If no customer is found, this is a new user
            // 🔒 USE LLMService.handleNewUserWelcome() - ENSURES Safety & Translation layer
            const { LLMService } = require("../services/llm.service");
            const llmService = new LLMService();
            const result = yield llmService.handleNewUserWelcome(phoneNumber, workspaceId, messageContent);
            const completeMessage = result.message;
            const { detectedLanguage } = result.debugInfo;
            // 💾 SAVE MESSAGE TO HISTORY - Save both user message and welcome response
            yield messageRepository.saveMessage({
                workspaceId: workspaceId,
                phoneNumber: phoneNumber,
                message: messageContent,
                response: completeMessage,
                direction: "INBOUND",
                agentSelected: "CHATBOT",
                functionCallsDebug: [],
                processingSource: "new_user_welcome",
                debugInfo: JSON.stringify(Object.assign({ isNewUser: true, detectedLanguage, attemptCount: attempt.attemptCount }, result.debugInfo)),
            });
            logger_1.default.info(`✅ ${format}: New user welcome sent (via LLMService) to ${phoneNumber}`);
            res.status(200).json({
                success: true,
                data: {
                    sessionId: null,
                    message: completeMessage,
                },
            });
            return true;
        }
        catch (error) {
            logger_1.default.error(`❌ ${format}: Error handling new user welcome flow for ${phoneNumber}:`, error);
            res.status(500).send("ERROR");
            return true; // Error handled
        }
    });
}
// ============================================================================
// 8. HELPER FUNCTIONS
// ============================================================================
// (checkCustomerBlacklist, detectLanguageFromPhonePrefix, getRegistrationText, handleNewUserWelcomeFlow defined above)
// Simple logging middleware
const loggingMiddleware = (req, res, next) => {
    logger_1.default.info(`Request: ${req.method} ${req.originalUrl}`);
    // Track the original end method
    const originalEnd = res.end;
    // Override the end method to log the response
    res.end = function () {
        logger_1.default.info(`Response for ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`);
        // Call the original end method
        return originalEnd.apply(this, arguments);
    };
    next();
};
// Log router setup
logger_1.default.info("Setting up API routes");
// Create a router instance
const router = (0, express_1.Router)();
// Add logging middleware
router.use(loggingMiddleware);
// ⚡ SESSION VALIDATION MIDDLEWARE (with exceptions)
const SESSION_EXEMPT_ROUTES = [
    "/auth/login",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/register",
    "/auth/verify-2fa-setup", // 🔒 User hasn't authenticated yet - just registered
    "/auth/verify-2fa", // 🔒 2FA verification during login (creates sessionId)
    "/auth/verify-recovery-code", // 🔒 Recovery code verification (creates sessionId)
    "/auth/2fa/verify", // 🔒 2FA verification during login (creates sessionId)
    "/auth/oauth/google", // 🔒 OAuth Google login/register (creates sessionId after 2FA)
    "/health",
    "/session/validate",
    "/whatsapp/webhook",
    "/chat", // WhatsApp compatibility endpoint
    "/cart-tokens", // Support interface
    "/token/", // TOKEN-BASED routes (NO sessionId required)
    "/analytics", // Analytics routes (JWT-based authentication)
    "/pricing", // PUBLIC pricing configuration endpoint (no auth required)
    "/subscription/plans", // PUBLIC subscription plans endpoint (Feature 185)
];
router.use((req, res, next) => {
    const path = req.path;
    // Skip sessionId validation for exempt routes
    if (SESSION_EXEMPT_ROUTES.some((route) => path.startsWith(route))) {
        logger_1.default.debug(`🔓 SessionID check SKIPPED for exempt route: ${path}`);
        return next();
    }
    // Skip sessionId validation for internal routes (JWT-based)
    if (path.startsWith("/internal/")) {
        logger_1.default.debug(`🔓 SessionID check SKIPPED for internal route: ${path}`);
        return next();
    }
    // NOTE: SessionId validation removed - using JWT-only authentication
    // All protected routes use authMiddleware which validates JWT token
    // Skip sessionId validation for internal routes (JWT-based)
    if (path.startsWith("/internal/")) {
        logger_1.default.debug(`🔓 Internal route (JWT-based): ${path}`);
        return next();
    }
    return next();
});
logger_1.default.info("✅ Route middleware configured for JWT-only authentication");
// 🛒 Cart Token Routes (for support interface)
// 🔒 SECURITY: Rate limited to prevent token abuse
router.post("/cart-tokens", rate_limiters_1.cartTokenLimiter, (req, res) => cartTokenController.getCartToken(req, res));
router.get("/cart-tokens/:token/validate", rate_limiters_1.cartTokenLimiter, (req, res) => cartTokenController.validateCartToken(req, res));
// ============================================================================
// 9. ROUTE DEFINITIONS
// ============================================================================
// WhatsApp webhook routes - Now handled by controller-based architecture
// See: /interfaces/http/controllers/whatsapp-webhook.controller.ts
// See: /interfaces/http/routes/whatsapp.routes.ts
logger_1.default.info("Registered WhatsApp webhook routes (public, no authentication)");
// Debug middleware removed - TypeScript errors fixed
logger_1.default.info("Registered WhatsApp webhook routes (public, no authentication)");
// Debug middleware removed - TypeScript errors fixed
// Initialize services (using shared prisma instance from @echatbot/database)
const authService = new auth_service_1.AuthService(database_1.prisma);
const userService = new user_service_1.UserService(database_1.prisma);
const otpService = new otp_service_1.OtpService(database_1.prisma);
// billingService removed - billing is now handled by message.repository.ts
// Create controllers in advance
const cartTokenController = new cart_token_controller_1.CartTokenController();
const customersController = new customers_controller_1.CustomersController();
const servicesController = new services_controller_1.ServicesController();
const campaignController = new campaign_controller_1.CampaignController();
const feedbackController = new feedback_controller_1.FeedbackController();
const pushController = new push_controller_1.PushController();
const categoryController = new category_controller_1.CategoryController();
const chatController = new chat_controller_1.ChatController();
// Removed messageController
const productController = new product_controller_1.ProductController();
const userController = new user_controller_1.UserController(userService);
const authController = new auth_controller_1.AuthController(authService, userService, otpService);
const faqController = new faq_controller_1.FaqController();
// Removed whatsappController
// Initialize Settings controller for GDPR routes
const settingsController = new settings_controller_1.SettingsController();
// ========================================
// 🎫 TOKEN ROUTES (NO SessionID required)
// ========================================
router.use("/token", (0, token_1.createTokenRouter)());
logger_1.default.info("✅ Registered /api/token/* routes (registration, checkout, orders-public)");
// Public routes (MUST BE BEFORE AUTH ROUTES)
router.use(short_url_routes_1.shortUrlRoutes);
logger_1.default.info("Registered short URL routes for /s/:shortCode redirection");
// ========================================
// ⚠️ LEGACY ROUTES (Deprecated - will be removed in v2.0)
// ========================================
// Add deprecation warning middleware
const deprecationWarning = (newPath) => (req, res, next) => {
    logger_1.default.warn(`⚠️ DEPRECATED: ${req.method} ${req.originalUrl} - Use /api/token${newPath} instead`);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', `</api/token${newPath}>; rel="successor-version"`);
    next();
};
router.use("/checkout", deprecationWarning("/checkout"), checkout_routes_1.checkoutRouter);
logger_1.default.info("⚠️ LEGACY: /checkout (use /token/checkout instead)");
router.use("/cart", deprecationWarning("/cart"), cart_routes_1.cartRouter);
logger_1.default.info("⚠️ LEGACY: /cart (use /token/cart instead)");
router.use("/registration", deprecationWarning("/registration"), (0, registration_routes_1.default)());
logger_1.default.info("⚠️ LEGACY: /registration (use /token/registration instead)");
// ========================================
// 🔐 AUTHENTICATED ROUTES (SessionID required)
// ========================================
// ========================================
// 💰 PUBLIC PRICING ROUTES (No auth required)
// ========================================
router.use("/pricing", pricing_routes_1.default);
logger_1.default.info("✅ Registered pricing routes (/api/pricing/config)");
// ========================================
// 🚀 PLATFORM CONFIG ROUTES (Public + Admin)
// ========================================
router.use("/platform-config", platform_config_routes_1.default);
logger_1.default.info("✅ Registered platform config routes (/api/platform-config)");
// ========================================
// 👥 USER ADMIN ROUTES (Platform Admin only)
// ========================================
router.use("/users", user_admin_routes_1.default);
logger_1.default.info("✅ Registered user admin routes (/api/users/admin/*)");
// ========================================
// 🗑️ TRASH MANAGEMENT ROUTES (Platform Admin only)
// ========================================
router.use("/admin/trash", (0, trash_routes_1.createTrashRoutes)(database_1.prisma));
logger_1.default.info("✅ Registered trash management routes (/api/admin/trash/*)");
// ========================================
// 🕐 SCHEDULER ROUTES (Platform Admin only)
// ========================================
const scheduler_routes_1 = __importDefault(require("../interfaces/http/routes/scheduler.routes"));
router.use("/schedulers", scheduler_routes_1.default);
logger_1.default.info("✅ Registered scheduler routes (/api/schedulers)");
// 💳 PUBLIC SUBSCRIPTION PLANS (Feature 185 - No auth required)
router.use("/subscription", subscription_billing_routes_1.publicBillingRoutes); // GET /api/subscription/plans
logger_1.default.info("✅ Registered PUBLIC subscription plans route (/api/subscription/plans)");
router.use("/auth", (0, auth_routes_1.authRouter)(authController));
router.use("/auth", two_factor_reset_routes_1.default); // 2FA reset public routes
logger_1.default.info("✅ Registered 2FA reset routes (/api/auth/2fa-reset/*)");
router.use("/session", session_routes_1.sessionRoutes);
logger_1.default.info("✅ Registered session routes (/api/session/validate, /api/session/stats)");
router.use("/chat", (0, chat_routes_1.chatRouter)(chatController));
// ========================================
// 🤖 MULTI-AGENT CHAT SYSTEM (Sprint 1 - Task 1.5)
// ========================================
router.use("/agent-chat", agentChatRoutes_1.default);
logger_1.default.info("✅ Registered multi-agent chat routes (/api/agent-chat, /api/agent-chat/metrics, /api/agent-chat/history/:customerId)");
// ========================================
// ⚙️ AGENT CONFIGURATION API
// ========================================
// ========================================
// 🔓 PUBLIC TEAM INVITATION ROUTES (NO AUTH REQUIRED)
// ========================================
// IMPORTANT: These MUST be mounted BEFORE any router that uses router.use(authMiddleware)
// to prevent the auth middleware from intercepting public requests
router.use("/invitations", invitation_routes_1.publicInvitationRoutes);
logger_1.default.info("✅ Registered PUBLIC invitation routes: /api/invitations (validate, accept)");
router.use("/", agent_config_routes_1.default);
logger_1.default.info("✅ Registered agent config routes (/api/workspaces/:workspaceId/agent-config)");
// Removed messages, push-messaging, and push-testing routes (not used by frontend)
router.use("/users", (0, user_routes_1.createUserRouter)());
// Mount customer routes on both legacy and workspace paths to ensure backward compatibility
router.use("/", (0, customers_routes_1.customersRouter)(customersController));
// Utilizziamo il router specifico per workspaces
router.use("/workspaces", (0, customers_routes_1.workspaceCustomersRouter)(customersController));
// Mount workspace routes (includes the /current endpoint) with authentication FIRST
// 🔒 SECURITY: Only authMiddleware here - sessionValidationMiddleware applied per-route basis
// (POST /workspaces for creation doesn't need session, only JWT token)
// NOTE: workspaceRoutes FIRST (has /badge-stats) before workspaceRoutesLegacy (has /:id which would catch "badge-stats" as ID)
router.use("/workspaces", auth_middleware_1.authMiddleware, workspace_routes_1.workspaceRoutes);
router.use("/workspaces", auth_middleware_1.authMiddleware, workspace_routes_2.default);
// Mount invitation and member routes for workspace team management (Feature 184)
// Workspace-scoped routes (require workspaceId in path)
router.use("/workspaces/:workspaceId/invitations", invitation_routes_1.invitationRoutes);
router.use("/workspaces/:workspaceId/members", member_routes_1.memberRoutes);
logger_1.default.info("✅ Registered PROTECTED team management routes: /api/workspaces/:workspaceId/invitations, /api/workspaces/:workspaceId/members");
// Mount campaign routes
router.use("/workspaces", (0, campaign_routes_1.campaignRoutes)(campaignController));
logger_1.default.info("✅ Registered campaign routes: /api/workspaces/:workspaceId/campaigns");
// Mount feedback routes (public + admin)
router.use((0, feedback_routes_1.feedbackRoutes)(feedbackController));
logger_1.default.info("✅ Registered feedback routes: /api/feedback (public), /api/workspaces/:workspaceId/feedbacks (admin)");
// Mount agent routes with workspace parameter properly configured
router.use("/workspaces/:workspaceId/agent", (req, res, next) => {
    // Ensure workspaceId is available in params
    if (req.params.workspaceId) {
        logger_1.default.debug(`Agent route: workspaceId from params: ${req.params.workspaceId}`);
    }
    next();
}, (0, agent_routes_1.createAgentRouter)());
logger_1.default.info("Registered agent router with workspace routes only");
// Add a simple test route to debug workspace ID extraction
router.get("/workspaces/:workspaceId/test", auth_middleware_1.authMiddleware, (req, res) => {
    res.json({
        success: true,
        workspaceId: req.params.workspaceId,
        originalUrl: req.originalUrl,
        params: req.params,
        user: req.user ? { userId: req.user.userId } : null,
    });
});
// Mount products routes with workspace context
const productsRouterInstance = (0, products_routes_1.default)();
router.use("/workspaces/:workspaceId/products", productsRouterInstance);
logger_1.default.info("Registered products router with workspace routes");
// Mount categories routes
const categoriesRouterInstance = (0, categories_routes_1.categoriesRouter)();
router.use("/workspaces/:workspaceId/categories", categoriesRouterInstance);
router.use("/categories", categoriesRouterInstance);
logger_1.default.info("Registered categories router with workspace routes");
// Mount sales routes
const salesRouterInstance = (0, sales_routes_1.salesRouter)();
router.use("/workspaces/:workspaceId/sales", salesRouterInstance);
router.use("/sales", salesRouterInstance);
logger_1.default.info("Registered sales router with workspace routes");
// Mount certification routes
router.use("/workspaces/:workspaceId/certifications", certification_routes_1.default);
logger_1.default.info("Registered certification router with workspace routes");
// Mount transport type routes
router.use("/workspaces/:workspaceId/transport-types", transport_type_routes_1.default);
logger_1.default.info("Registered transport type router with workspace routes");
// Mount WhatsApp queue routes
router.use(whatsapp_queue_routes_1.whatsappQueueRoutes);
logger_1.default.info("Registered WhatsApp queue router with workspace routes");
// Mount services routes (with authentication)
const servicesRouterInstance = (0, services_routes_1.servicesRouter)(servicesController);
router.use("/workspaces/:workspaceId/services", servicesRouterInstance);
logger_1.default.info("Registered services router with workspace routes");
// Mount FAQs router
const faqsRouterInstance = (0, faqs_routes_1.faqsRouter)();
router.use("/workspaces/:workspaceId/faqs", faqsRouterInstance);
router.use("/faqs", faqsRouterInstance);
logger_1.default.info("Registered FAQs router with workspace routes");
router.use("/settings", (0, settings_routes_1.default)());
router.use("/languages", (0, languages_routes_1.createLanguagesRouter)());
// Mount GDPR routes (with workspace context and without)
router.use("/workspaces/:workspaceId/gdpr", gdpr_routes_1.default);
router.use("/gdpr", gdpr_routes_1.default);
logger_1.default.info("Registered GDPR routes (/api/workspaces/:workspaceId/gdpr, /api/gdpr)");
// Mount subscription billing routes (Feature 185) - WORKSPACE-SCOPED (DEPRECATED)
// Note: Public /subscription/plans route is registered earlier in the file
router.use("/workspaces/:workspaceId/subscription-billing", subscription_billing_routes_1.billingRoutes);
logger_1.default.info("Registered workspace subscription billing routes: /api/workspaces/:workspaceId/subscription-billing (DEPRECATED)");
// Mount owner-based billing routes (Feature 198) - NO WORKSPACEID
// This is the NEW primary billing API - uses userId from JWT token
router.use("/subscription-billing", owner_billing_routes_1.ownerBillingRoutes);
logger_1.default.info("Registered owner billing routes: /api/subscription-billing (Feature 198)");
// Mount billing routes (legacy usage tracking - has auth middleware that catches all)
router.use("/billing", billing_routes_1.billingRouter);
logger_1.default.info("Registered billing routes for usage tracking");
// Mount offers routes
const offersRouterInstance = (0, offers_routes_1.offersRouter)();
router.use("/workspaces/:workspaceId/offers", offersRouterInstance);
router.use("/offers", offersRouterInstance);
logger_1.default.info("Registered offers router with workspace routes");
// Mount orders routes
const ordersRouterInstance = (0, order_routes_1.createOrderRouter)();
router.use("/workspaces/:workspaceId/orders", ordersRouterInstance);
router.use("/orders", ordersRouterInstance);
logger_1.default.info("Registered orders router with workspace routes");
// Mount credit notes routes
router.use("/", credit_note_routes_1.default);
logger_1.default.info("Registered credit notes routes for partial refunds");
// Mount cart routes with workspace context (for price calculation)
router.use("/workspaces/:workspaceId/cart", cart_routes_1.cartRouter);
logger_1.default.info("Registered cart router with workspace routes for price calculation");
// Mount public orders routes (JWT-based)
router.use("/orders", orders_routes_1.default);
logger_1.default.info("Registered public orders routes with JWT authentication");
// Mount analytics routes
router.use("/analytics", analytics_routes_1.default);
logger_1.default.info("Registered analytics routes for dashboard metrics");
// Mount debug routes
router.use("/workspaces/:workspaceId/debug", debug_routes_1.default);
logger_1.default.info("Registered debug routes for testing and analysis");
// Mount push notification routes
router.use("/workspaces/:workspaceId/push", (0, push_routes_1.pushRoutes)(pushController));
logger_1.default.info("Registered push notification routes for chatbot reactivation");
// Mount WhatsApp routes
router.use("/whatsapp", whatsapp_routes_1.default);
logger_1.default.info("Registered WhatsApp routes for webhook and send message");
// Mount public orders routes (for secure token validation and public access)
router.use("/internal", public_orders_routes_1.default);
logger_1.default.info("Registered public orders routes for secure token validation");
// Add special route for GDPR default content (to handle frontend request to /gdpr/default)
router.get("/gdpr/default", auth_middleware_1.authMiddleware, settingsController.getDefaultGdprContent.bind(settingsController));
logger_1.default.info("Registered /gdpr/default route for backward compatibility");
// Health check
router.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        apiVersion: "v1",
    });
});
// Simple test route for workspace agent debugging (🔒 PROTECTED)
router.get("/workspaces/:workspaceId/agent-test", auth_middleware_1.authMiddleware, // ⚠️ FIXED: Added auth protection
workspace_validation_middleware_1.workspaceValidationMiddleware, // ⚠️ FIXED: Added workspace validation
(req, res) => {
    res.json({
        success: true,
        message: "Test route working",
        workspaceId: req.params.workspaceId,
        originalUrl: req.originalUrl,
        params: req.params,
    });
});
logger_1.default.info("API routes setup complete");
exports.default = router;
//# sourceMappingURL=index.js.map