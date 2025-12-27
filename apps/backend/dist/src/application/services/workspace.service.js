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
exports.WorkspaceService = void 0;
const database_1 = require("@echatbot/database");
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const workspace_entity_1 = require("../../domain/entities/workspace.entity");
const workspace_repository_1 = require("../../repositories/workspace.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
const defaultAgents_1 = require("../../../prisma/data/defaultAgents");
const initialFAQs_1 = require("../../../prisma/data/initialFAQs");
class WorkspaceService {
    constructor(prismaInstance) {
        this.prisma = prismaInstance || database_1.prisma;
        this.repository = new workspace_repository_1.WorkspaceRepository(this.prisma);
    }
    /**
     * Generate a slug from a name
     * @private
     */
    generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }
    /**
     * Get default GDPR content from file
     * @private
     */
    getDefaultGdprContent() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const gdprFilePath = path_1.default.join(__dirname, "../../prisma/prompts/gdpr.md");
                return fs_1.default.readFileSync(gdprFilePath, "utf8");
            }
            catch (error) {
                logger_1.default.warn("Could not read default GDPR file, using fallback content");
                return `# Privacy Policy

## Data Collection
We collect and process personal data in accordance with applicable privacy laws.

## Data Usage
Your data is used to provide our services and improve user experience.

## Contact
For privacy inquiries, please contact our support team.`;
            }
        });
    }
    /**
     * Load default GDPR content in 4 languages from markdown files
     * @private
     */
    loadDefaultGdprContent() {
        const gdprDir = path_1.default.join(__dirname, "../../../docs/prompts/gdpr");
        const languages = [
            { code: "it", key: "gdpr_ita" },
            { code: "en", key: "gdpr_eng" },
            { code: "es", key: "gdpr_esp" },
            { code: "pt", key: "gdpr_prt" },
        ];
        const result = {};
        for (const lang of languages) {
            const filePath = path_1.default.join(gdprDir, `gdpr-${lang.code}.md`);
            try {
                const content = fs_1.default.readFileSync(filePath, "utf-8");
                result[lang.key] = content;
                logger_1.default.info(`✓ Loaded GDPR content for language: ${lang.code}`);
            }
            catch (error) {
                logger_1.default.warn(`⚠️  Could not read GDPR file for language '${lang.code}' at ${filePath}`);
                result[lang.key] = `# GDPR Content - ${lang.code.toUpperCase()}\n\nContent not available.`;
            }
        }
        return result;
    }
    /**
     * Get default agent prompt content from file
     * @private
     */
    getDefaultAgentContent() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to read from the default agent prompt file
                const agentFilePath = path_1.default.join(__dirname, "../../prisma/prompts/default-agent.md");
                return fs_1.default.readFileSync(agentFilePath, "utf8");
            }
            catch (error) {
                // Fallback to GDPR file if default agent file doesn't exist
                try {
                    const gdprFilePath = path_1.default.join(__dirname, "../../prisma/prompts/gdpr.md");
                    return fs_1.default.readFileSync(gdprFilePath, "utf8");
                }
                catch (gdprError) {
                    logger_1.default.warn("Could not read default agent prompt files, using fallback content");
                    return `You are a helpful AI assistant for customer support. Please assist users with their inquiries in a professional and friendly manner.`;
                }
            }
        });
    }
    /**
     * Get all workspaces
     */
    getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info("Getting all workspaces");
            return this.repository.findAll();
        });
    }
    /**
     * Get workspaces by user ID (workspace isolation)
     * SECURITY: Returns ONLY workspaces the user has access to via UserWorkspace relation
     */
    getByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Getting workspaces for user: ${userId}`);
            const workspaces = yield this.prisma.workspace.findMany({
                where: {
                    users: {
                        some: {
                            userId: userId
                        }
                    },
                    isDelete: false
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            // Convert to Workspace entities
            return workspaces.map(w => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
                return new workspace_entity_1.Workspace({
                    id: w.id,
                    name: w.name,
                    slug: w.slug,
                    description: (_a = w.description) !== null && _a !== void 0 ? _a : undefined,
                    whatsappPhoneNumber: (_b = w.whatsappPhoneNumber) !== null && _b !== void 0 ? _b : undefined,
                    whatsappApiKey: (_c = w.whatsappApiKey) !== null && _c !== void 0 ? _c : undefined,
                    webhookUrl: (_d = w.webhookUrl) !== null && _d !== void 0 ? _d : undefined,
                    notificationEmail: (_e = w.notificationEmail) !== null && _e !== void 0 ? _e : undefined,
                    language: (_f = w.language) !== null && _f !== void 0 ? _f : 'it',
                    currency: (_g = w.currency) !== null && _g !== void 0 ? _g : 'EUR',
                    messageLimit: (_h = w.messageLimit) !== null && _h !== void 0 ? _h : 1000,
                    welcomeMessage: (_j = w.welcomeMessage) !== null && _j !== void 0 ? _j : undefined,
                    wipMessage: (_k = w.wipMessage) !== null && _k !== void 0 ? _k : undefined,
                    channelStatus: w.channelStatus,
                    isActive: w.isActive,
                    isDelete: w.isDelete,
                    url: (_l = w.url) !== null && _l !== void 0 ? _l : undefined,
                    debugMode: (_m = w.debugMode) !== null && _m !== void 0 ? _m : false,
                    createdAt: w.createdAt,
                    updatedAt: w.updatedAt,
                    planType: (_o = w.planType) !== null && _o !== void 0 ? _o : undefined,
                    trialEndsAt: (_p = w.trialEndsAt) !== null && _p !== void 0 ? _p : undefined,
                    // 🆕 Channel Configuration (Feature 199) - CRITICAL: Must include these!
                    sellsProductsAndServices: w.sellsProductsAndServices,
                    hasSalesAgents: w.hasSalesAgents,
                    hasHumanSupport: w.hasHumanSupport,
                    humanSupportInstructions: (_q = w.humanSupportInstructions) !== null && _q !== void 0 ? _q : undefined,
                    operatorContactMethod: (_r = w.operatorContactMethod) !== null && _r !== void 0 ? _r : undefined,
                    operatorWhatsappNumber: (_s = w.operatorWhatsappNumber) !== null && _s !== void 0 ? _s : undefined,
                    toneOfVoice: (_t = w.toneOfVoice) !== null && _t !== void 0 ? _t : undefined,
                    botIdentityResponse: (_u = w.botIdentityResponse) !== null && _u !== void 0 ? _u : undefined,
                    address: (_v = w.address) !== null && _v !== void 0 ? _v : undefined,
                    customAiRules: (_w = w.customAiRules) !== null && _w !== void 0 ? _w : undefined,
                    // 🆕 Logo
                    logoUrl: (_x = w.logoUrl) !== null && _x !== void 0 ? _x : undefined,
                });
            });
        });
    }
    /**
     * Get a workspace by ID
     */
    getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Getting workspace by ID: ${id}`);
            return this.repository.findById(id);
        });
    }
    /**
     * Find a workspace by slug
     */
    getBySlug(slug) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Getting workspace by slug: ${slug}`);
            return this.repository.findBySlug(slug);
        });
    }
    /**
     * Create a new workspace
     * @param data - Workspace data (must include createdBy for UserWorkspace relation)
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info("Creating new workspace with default settings and agents");
            // Generate a slug if not provided
            if (!data.slug) {
                data.slug = this.generateSlug(data.name);
            }
            // Check if workspace with same slug exists
            const existingWorkspace = yield this.repository.findBySlug(data.slug);
            if (existingWorkspace) {
                throw new Error(`Workspace with name "${data.name}" already exists`);
            }
            // Generate UUID if not provided
            if (!data.id) {
                data.id = (0, crypto_1.randomUUID)();
            }
            // Extract userId for UserWorkspace relation
            const createdBy = data.createdBy;
            const adminEmail = data.adminEmail; // Extract adminEmail for WhatsappSettings
            const customFaqs = data.faqs; // 🆕 Extract custom FAQs from wizard (Feature 199)
            const workspaceData = Object.assign({}, data);
            delete workspaceData.createdBy; // Remove from workspace data
            delete workspaceData.adminEmail; // Remove from workspace data (stored in WhatsappSettings)
            delete workspaceData.faqs; // Remove FAQs from workspace data (stored in separate table)
            // 🆕 DEFAULT WELCOME AND WIP MESSAGES
            const defaultWelcomeMessage = {
                en: "Welcome! I'm SofiA, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?",
                es: "¡Bienvenido! Soy SofiA, tu asistente digital. Puedo ayudarte a descubrir productos gourmet italianos, responder preguntas y gestionar pedidos. ¿Cómo puedo ayudarte hoy?",
                it: "Benvenuto! Sono SofiA, il tuo assistente digitale. Posso aiutarti a scoprire prodotti gourmet italiani, rispondere alle tue domande e gestire ordini. Come posso aiutarti oggi?",
                pt: "Bem-vindo! Sou a SofiA, a sua assistente digital. Posso ajudá-lo a descobrir produtos gourmet italianos, responder perguntas e gerir encomendas. Como posso ajudá-lo hoje?",
            };
            const defaultWipMessage = {
                en: "Work in progress. Please contact us later.",
                es: "Trabajos en curso. Por favor, contáctenos más tarde.",
                it: "Lavori in corso. Contattaci più tardi.",
                pt: "Em manutenção. Por favor, contacte-nos mais tarde.",
            };
            // Add messages to workspace data
            data.welcomeMessage = defaultWelcomeMessage;
            data.wipMessage = defaultWipMessage;
            // 🆕 Feature 199: Set default channel configuration values
            // These can be overridden by wizard input, but provide sensible defaults
            if (data.hasHumanSupport === undefined)
                data.hasHumanSupport = true;
            if (data.hasSalesAgents === undefined)
                data.hasSalesAgents = false;
            if (data.sellsProductsAndServices === undefined)
                data.sellsProductsAndServices = true;
            if (data.toneOfVoice === undefined)
                data.toneOfVoice = "FRIENDLY";
            if (data.operatorContactMethod === undefined)
                data.operatorContactMethod = "EMAIL";
            // Default human support instructions - use placeholder as default
            if (!data.humanSupportInstructions) {
                if (data.hasHumanSupport) {
                    if (data.hasSalesAgents) {
                        data.humanSupportInstructions =
                            `Ciao {{nameUser}}, mi sto mettendo in contatto con l'agente {{agentName}}.\nTi richiamera' al piu' presto (tel: {{agentPhone}} - email: {{agentEmail}}).\nMetto in pausa il chatbot finche' non ricevi risposta.`;
                    }
                    else {
                        data.humanSupportInstructions =
                            `Ciao {{nameUser}}, mi sto mettendo in contatto con il nostro operatore.\nTi rispondera' al piu' presto.\nMetto in pausa il chatbot finche' non ricevi assistenza.`;
                    }
                }
                else {
                    data.humanSupportInstructions =
                        "Mi dispiace per il disagio. Puoi inviarci una mail a {{adminEmail}} e ti risponderemo il prima possibile.";
                }
            }
            // Default bot identity
            if (!data.botIdentityResponse) {
                data.botIdentityResponse = "I'm your digital assistant. I can help you find products, answer questions, and manage your orders!";
            }
            // Create workspace entity
            const workspace = workspace_entity_1.Workspace.create(data);
            // Use transaction to create workspace and related records
            return yield database_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                // 1. Create the workspace
                const createdWorkspace = yield this.repository.create(workspace);
                logger_1.default.info(`Created workspace ${createdWorkspace.id}, now importing default agents`);
                // 2. Create default GDPR settings
                try {
                    const defaultGdprContent = yield this.getDefaultGdprContent();
                    yield tx.whatsappSettings.create({
                        data: {
                            workspaceId: createdWorkspace.id,
                            phoneNumber: `+34-${createdWorkspace.id.substring(0, 8)}`,
                            apiKey: "default-api-key",
                            gdpr: defaultGdprContent,
                            adminEmail: adminEmail || null, // 🆕 Use adminEmail from creator
                        },
                    });
                    logger_1.default.info(`Created default GDPR settings for workspace ${createdWorkspace.id}`);
                }
                catch (error) {
                    logger_1.default.error(`Error creating GDPR settings for workspace ${createdWorkspace.id}:`, error);
                    // Don't fail the entire transaction for GDPR settings
                }
                // 3. 🆕 IMPORT ALL DEFAULT AGENTS (Feature: Import prompts on new workspace)
                try {
                    const agents = (0, defaultAgents_1.defaultAgents)(createdWorkspace.id);
                    for (const agent of agents) {
                        yield tx.agentConfig.create({
                            data: {
                                workspaceId: createdWorkspace.id,
                                name: agent.name,
                                type: agent.type,
                                description: agent.description,
                                icon: agent.icon,
                                systemPrompt: agent.systemPrompt,
                                model: agent.model,
                                temperature: agent.temperature,
                                maxTokens: agent.maxTokens,
                                order: agent.order,
                                isActive: agent.isActive,
                                availableFunctions: agent.availableFunctions,
                            },
                        });
                    }
                    logger_1.default.info(`✅ Imported ${agents.length} agents for workspace ${createdWorkspace.id}`);
                }
                catch (error) {
                    logger_1.default.error(`Error importing agents for workspace ${createdWorkspace.id}:`, error);
                    // Don't fail the entire transaction for agent settings
                }
                // 4. 🆕 CREATE DEFAULT GDPR CONTENT (Feature: Auto-create GDPR on new workspace)
                try {
                    const gdprContent = this.loadDefaultGdprContent();
                    yield tx.gdprContent.create({
                        data: {
                            workspaceId: createdWorkspace.id,
                            gdpr_ita: gdprContent.gdpr_ita,
                            gdpr_eng: gdprContent.gdpr_eng,
                            gdpr_esp: gdprContent.gdpr_esp,
                            gdpr_prt: gdprContent.gdpr_prt,
                        },
                    });
                    logger_1.default.info(`✅ Created GDPR content in 4 languages for workspace ${createdWorkspace.id}`);
                }
                catch (error) {
                    logger_1.default.error(`Error creating GDPR content for workspace ${createdWorkspace.id}:`, error);
                    // Don't fail the entire transaction for GDPR content
                }
                // 4b. 🆕 CREATE FAQs (Feature 199: Use wizard FAQs if provided, otherwise defaults)
                try {
                    // Use custom FAQs from wizard if provided, otherwise use default FAQs
                    const faqsToCreate = (customFaqs && customFaqs.length > 0)
                        ? customFaqs.map((faq, index) => ({
                            question: faq.question,
                            answer: faq.answer,
                            keywords: [], // Will be populated by user later
                            category: 'General',
                            order: index,
                            isActive: true,
                        }))
                        : (0, initialFAQs_1.initialFAQs)(createdWorkspace.id);
                    for (const faq of faqsToCreate) {
                        yield tx.fAQ.create({
                            data: {
                                workspaceId: createdWorkspace.id,
                                question: faq.question,
                                answer: faq.answer,
                                keywords: faq.keywords || [],
                                category: faq.category || 'General',
                                order: (_a = faq.order) !== null && _a !== void 0 ? _a : 0,
                                isActive: (_b = faq.isActive) !== null && _b !== void 0 ? _b : true,
                            },
                        });
                    }
                    const faqSource = (customFaqs && customFaqs.length > 0) ? 'wizard' : 'default';
                    logger_1.default.info(`✅ Created ${faqsToCreate.length} FAQs (${faqSource}) for workspace ${createdWorkspace.id}`);
                }
                catch (error) {
                    logger_1.default.error(`Error creating FAQs for workspace ${createdWorkspace.id}:`, error);
                    // Don't fail the entire transaction for FAQs
                }
                // 5. 🆕 CREATE USER-WORKSPACE RELATION AND SET OWNER (Feature 184: Team Management)
                if (createdBy) {
                    try {
                        // Set the workspace owner
                        yield tx.workspace.update({
                            where: { id: createdWorkspace.id },
                            data: { ownerId: createdBy },
                        });
                        logger_1.default.info(`✅ Set workspace owner: ${createdBy} for workspace ${createdWorkspace.id}`);
                        // Create UserWorkspace relation with SUPER_ADMIN role
                        yield tx.userWorkspace.create({
                            data: {
                                userId: createdBy,
                                workspaceId: createdWorkspace.id,
                                role: 'SUPER_ADMIN', // Creator is SUPER_ADMIN (Feature 184)
                            },
                        });
                        logger_1.default.info(`✅ Created UserWorkspace relation: user ${createdBy} → workspace ${createdWorkspace.id} (SUPER_ADMIN)`);
                        // 6. 💰 CREATE INITIAL CREDIT TRANSACTION (Welcome bonus from plan configuration)
                        try {
                            // Get the FREE_TRIAL plan configuration to get the initial credit amount
                            const freeTrial = yield tx.planConfiguration.findFirst({
                                where: { planType: 'FREE_TRIAL' }
                            });
                            // Convert Decimal to number (Prisma returns Decimal type)
                            const initialCredit = (freeTrial === null || freeTrial === void 0 ? void 0 : freeTrial.initialCredit)
                                ? Number(freeTrial.initialCredit)
                                : 19.00; // Fallback to €19 if not found
                            if (initialCredit > 0 && createdBy) {
                                // Feature 198: Update owner's credit balance (not workspace)
                                yield tx.user.update({
                                    where: { id: createdBy },
                                    data: { creditBalance: initialCredit }
                                });
                                // Create the billing transaction record
                                // Feature 198: userId is required, workspaceId tracks which channel
                                yield tx.billingTransaction.create({
                                    data: {
                                        userId: createdBy,
                                        workspaceId: createdWorkspace.id,
                                        type: 'INITIAL_CREDIT',
                                        amount: initialCredit,
                                        balanceAfter: initialCredit,
                                        description: 'Initial Free Trial credit',
                                    }
                                });
                                logger_1.default.info(`✅ Created initial credit transaction: €${initialCredit} for workspace ${createdWorkspace.id}`);
                            }
                        }
                        catch (error) {
                            logger_1.default.error(`Error creating initial credit for workspace ${createdWorkspace.id}:`, error);
                            // Don't fail the entire transaction for billing
                        }
                        // 7. 🆕 AUTO-ADD EXISTING ADMINS (Feature 184: New channel propagation)
                        // Find all workspaces owned by this user and get their ADMINs
                        const existingOwnerWorkspaces = yield tx.workspace.findMany({
                            where: {
                                ownerId: createdBy,
                                id: { not: createdWorkspace.id }, // Exclude the new workspace
                            },
                            select: { id: true },
                        });
                        if (existingOwnerWorkspaces.length > 0) {
                            // Get all unique ADMINs from owner's other workspaces
                            const existingAdmins = yield tx.userWorkspace.findMany({
                                where: {
                                    workspaceId: { in: existingOwnerWorkspaces.map(w => w.id) },
                                    role: 'ADMIN',
                                },
                                select: { userId: true },
                                distinct: ['userId'],
                            });
                            // Add each ADMIN to the new workspace
                            let adminsAdded = 0;
                            for (const admin of existingAdmins) {
                                yield tx.userWorkspace.create({
                                    data: {
                                        userId: admin.userId,
                                        workspaceId: createdWorkspace.id,
                                        role: 'ADMIN',
                                    },
                                });
                                adminsAdded++;
                            }
                            if (adminsAdded > 0) {
                                logger_1.default.info(`✅ Auto-added ${adminsAdded} existing ADMINs to new workspace ${createdWorkspace.id}`);
                            }
                        }
                    }
                    catch (error) {
                        logger_1.default.error(`❌ CRITICAL: Failed to create UserWorkspace relation for user ${createdBy}:`, error);
                        // This SHOULD fail the transaction - user must be linked to workspace
                        throw error;
                    }
                }
                else {
                    logger_1.default.warn(`⚠️ No createdBy userId provided - workspace ${createdWorkspace.id} has no owner!`);
                }
                return createdWorkspace;
            }));
        });
    }
    /**
     * Update a workspace
     */
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Updating workspace with ID: ${id}`);
            // 🆕 Feature 199: Auto-toggle e-commerce agents based on sellsProductsAndServices
            const ecommerceAgentTypes = ["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING"];
            if (data.sellsProductsAndServices === false) {
                logger_1.default.info(`⚠️ sellsProductsAndServices = false → Disabling e-commerce agents`);
                for (const agentType of ecommerceAgentTypes) {
                    try {
                        yield this.repository.updateAgentStatus(id, agentType, false);
                        logger_1.default.info(`✅ Disabled ${agentType} agent for workspace ${id}`);
                    }
                    catch (error) {
                        logger_1.default.warn(`⚠️ Failed to disable ${agentType} agent:`, error);
                    }
                }
            }
            else if (data.sellsProductsAndServices === true) {
                logger_1.default.info(`✅ sellsProductsAndServices = true → Enabling e-commerce agents`);
                for (const agentType of ecommerceAgentTypes) {
                    try {
                        yield this.repository.updateAgentStatus(id, agentType, true);
                        logger_1.default.info(`✅ Enabled ${agentType} agent for workspace ${id}`);
                    }
                    catch (error) {
                        logger_1.default.warn(`⚠️ Failed to enable ${agentType} agent:`, error);
                    }
                }
            }
            // Generate slug if name is updated and slug is not provided
            if (data.name && !data.slug) {
                data.slug = this.generateSlug(data.name);
                // Check for slug uniqueness if it has changed
                const existingWorkspace = yield this.repository.findBySlug(data.slug);
                if (existingWorkspace && existingWorkspace.id !== id) {
                    throw new Error(`Workspace with name "${data.name}" already exists`);
                }
            }
            return this.repository.update(id, data);
        });
    }
    /**
     * Delete a workspace
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Deleting workspace with ID: ${id}`);
            return this.repository.delete(id);
        });
    }
    /**
     * Get workspaces for a user
     */
    getWorkspacesForUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info(`Getting workspaces for user: ${userId}`);
            return this.repository.findByUserId(userId);
        });
    }
}
exports.WorkspaceService = WorkspaceService;
//# sourceMappingURL=workspace.service.js.map