"use strict";
/**
 * contactOperator - LLM-Callable Function
 *
 * Escalation a operatore umano quando il cliente richiede assistenza personale.
 * Utilizzata quando l'utente chiede: "voglio parlare con operatore", "assistenza umana", etc.
 *
 * @see docs/prompt_agent.md - Line 177: Definizione della calling function
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
exports.contactOperator = contactOperator;
const logger_1 = __importDefault(require("../../utils/logger"));
const database_1 = require("@echatbot/database");
/**
 * Registers customer request for human operator contact
 *
 * @param request - Request parameters
 * @returns Result with confirmation message
 */
function contactOperator(request) {
    return __awaiter(this, void 0, void 0, function* () {
        // Use imported prisma singleton from @echatbot/database
        var _a, _b, _c, _d, _e;
        // 📧 Track email sending status (accessible in all scopes)
        let emailSentSuccessfully = false;
        // 📧 Track Summary Agent data for debug timeline
        let generatedSummary = "";
        let conversationMessages = [];
        try {
            logger_1.default.info("📞 contactOperator called with:", {
                phoneNumber: request.phoneNumber,
                workspaceId: request.workspaceId,
                customerId: request.customerId,
                reason: request.reason,
            });
            try {
                // Find customer by phone and workspace WITH sales agent
                const customer = yield database_1.prisma.customers.findFirst({
                    where: {
                        phone: request.phoneNumber,
                        workspaceId: request.workspaceId,
                    },
                    include: {
                        sales: true, // Include sales agent data (name, email, phone)
                    },
                });
                if (!customer) {
                    logger_1.default.warn("⚠️ Customer not found for ContactOperator:", request.phoneNumber);
                    yield database_1.prisma.$disconnect();
                    return {
                        success: true,
                        message: "Mi dispiace molto per l'inconveniente! �\n\n" +
                            "Ricevere merce scaduta è inaccettabile e capisco la tua frustrazione.\n\n" +
                            "Ecco cosa faremo IMMEDIATAMENTE:\n" +
                            "1. ✅ Rimborso completo entro 24 ore\n" +
                            "2. 📦 Sostituzione gratuita del prodotto\n" +
                            "3. 📞 Contatto diretto con il tuo agente per assistenza immediata\n\n" +
                            "L'agente ti contatterà il prima possibile per risolvere la situazione.\n\n" +
                            "**Da questo momento disattiviamo il chatbot e aspettiamo che si colleghi l'agente.** 🤝\n\n" +
                            "Grazie per la pazienza! 😊",
                        timestamp: new Date().toISOString(),
                    };
                }
                // 🚨 DISABLE CHATBOT - Set activeChatbot = false
                yield database_1.prisma.customers.update({
                    where: { id: customer.id },
                    data: { activeChatbot: false },
                });
                logger_1.default.info("✅ Chatbot disabled for customer:", customer.id);
                // 📧 SEND EMAIL TO AGENT with summary of last hour conversation
                try {
                    // Get active chat session
                    const session = yield database_1.prisma.chatSession.findFirst({
                        where: {
                            customerId: customer.id,
                            status: "active",
                        },
                        orderBy: { createdAt: "desc" },
                    });
                    if (session) {
                        // Get messages from last hour (time-based filter as per spec)
                        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                        const messages = yield database_1.prisma.conversationMessage.findMany({
                            where: {
                                conversationId: session.id,
                                createdAt: {
                                    gte: oneHourAgo,
                                },
                            },
                            orderBy: { createdAt: "asc" }, // Chronological order
                        });
                        logger_1.default.info("📊 Retrieved messages from last hour:", {
                            count: messages.length,
                            customerId: customer.id,
                            sessionId: session.id,
                        });
                        // 📧 Store messages for debug timeline
                        conversationMessages = messages.map((msg) => ({
                            role: msg.role,
                            content: msg.content,
                            createdAt: msg.createdAt
                        }));
                        // Generate summary using SummaryAgentLLM
                        let chatSummary;
                        if (messages.length > 0) {
                            try {
                                // Import SummaryAgentLLM
                                const { SummaryAgentLLM, } = require("../../services/summary-agent-llm.service");
                                const summaryAgent = new SummaryAgentLLM();
                                // Format messages for summary agent
                                const conversationHistory = messages.map((msg) => ({
                                    role: msg.role === "user" ? "customer" : "assistant",
                                    content: msg.content,
                                    createdAt: msg.createdAt, // Use createdAt, not timestamp
                                }));
                                // Generate summary
                                logger_1.default.info("🤖 [contactOperator] Calling SummaryAgentLLM", {
                                    messageCount: conversationHistory.length,
                                    customerName: customer.name,
                                });
                                const summaryResult = yield summaryAgent.generateSummary({
                                    conversationHistory,
                                    customerName: customer.name,
                                    agentName: customer.sales
                                        ? `${customer.sales.firstName} ${customer.sales.lastName}`
                                        : "Agente",
                                });
                                if (summaryResult.success && summaryResult.summary) {
                                    logger_1.default.info("✅ [contactOperator] Summary generated successfully", {
                                        summaryLength: summaryResult.summary.length,
                                    });
                                    // Pass summary through Safety Translation Agent
                                    const { SafetyTranslationAgent, } = require("../../application/agents/SafetyTranslationAgent");
                                    const safetyAgent = new SafetyTranslationAgent(database_1.prisma);
                                    logger_1.default.info("🛡️ [contactOperator] Passing summary through Safety Translation Agent");
                                    const safetyResult = yield safetyAgent.process({
                                        workspaceId: request.workspaceId,
                                        response: summaryResult.summary,
                                        targetLanguage: "it", // Summary already in Italian, just need safety check
                                        customerName: customer.name,
                                    });
                                    const finalSummary = safetyResult.translatedText || summaryResult.summary;
                                    // If summary is empty, throw error to trigger fallback
                                    if (!finalSummary || finalSummary.trim().length === 0) {
                                        throw new Error("Summary generated but empty");
                                    }
                                    chatSummary = `
Cliente: ${customer.name}
Telefono: ${customer.phone}
Email: ${customer.email || "N/A"}
Data richiesta: ${new Date().toLocaleString("it-IT")}
${request.reason ? `\nMotivo: ${request.reason}` : ""}

📋 Riassunto conversazione (ultima ora - ${messages.length} messaggi):
${finalSummary}
                `.trim();
                                    // 📧 Store generated summary for debug timeline
                                    generatedSummary = chatSummary;
                                    logger_1.default.info("✅ [contactOperator] Summary processed and translated");
                                }
                                else {
                                    throw new Error(summaryResult.error || "Summary generation failed");
                                }
                            }
                            catch (summaryError) {
                                // Fallback to raw message list if summary generation fails
                                logger_1.default.warn("⚠️ [contactOperator] Summary generation failed, falling back to raw history:", summaryError);
                                const messageList = messages
                                    .map((msg, idx) => {
                                    const role = msg.role === "user" ? "Cliente" : "Bot";
                                    const timestamp = new Date(msg.createdAt).toLocaleString("it-IT");
                                    return `${idx + 1}. [${timestamp}] ${role}: ${msg.content}`;
                                })
                                    .join("\n\n");
                                chatSummary = `
Cliente: ${customer.name}
Telefono: ${customer.phone}
Email: ${customer.email || "N/A"}
Data richiesta: ${new Date().toLocaleString("it-IT")}
${request.reason ? `\nMotivo: ${request.reason}` : ""}

📜 Messaggi conversazione (ultima ora - ${messages.length} messaggi):
${messageList || "Nessun messaggio disponibile"}
              `.trim();
                            }
                        }
                        else {
                            // No messages in last hour
                            logger_1.default.warn("⚠️ No messages found in last hour for customer:", customer.id);
                            chatSummary = `
Cliente: ${customer.name}
Telefono: ${customer.phone}
Email: ${customer.email || "N/A"}
Data richiesta: ${new Date().toLocaleString("it-IT")}
${request.reason ? `\nMotivo: ${request.reason}` : ""}

ℹ️ Nessuna conversazione recente nell'ultima ora.
            `.trim();
                        }
                        // Get workspace and initialize EmailService
                        const workspace = yield database_1.prisma.workspace.findUnique({
                            where: { id: request.workspaceId },
                            select: {
                                name: true,
                                whatsappSettings: {
                                    select: { adminEmail: true },
                                },
                            },
                        });
                        logger_1.default.info("🔍 [contactOperator] Workspace config loaded:", {
                            workspaceId: request.workspaceId,
                            workspaceName: workspace === null || workspace === void 0 ? void 0 : workspace.name,
                            hasWhatsappSettings: !!(workspace === null || workspace === void 0 ? void 0 : workspace.whatsappSettings),
                            adminEmail: ((_a = workspace === null || workspace === void 0 ? void 0 : workspace.whatsappSettings) === null || _a === void 0 ? void 0 : _a.adminEmail) || "NOT SET",
                        });
                        if ((_b = workspace === null || workspace === void 0 ? void 0 : workspace.whatsappSettings) === null || _b === void 0 ? void 0 : _b.adminEmail) {
                            // Import EmailService
                            const { EmailService, } = require("../../application/services/email.service");
                            const emailService = new EmailService();
                            // Send email to customer's sales agent (if exists)
                            if ((_c = customer.sales) === null || _c === void 0 ? void 0 : _c.email) {
                                logger_1.default.info("📧 [contactOperator] Preparing to send email to sales agent:", customer.sales.email, `(${customer.sales.firstName} ${customer.sales.lastName})`);
                                try {
                                    // Customer has assigned sales agent - send to them
                                    const emailResult = yield emailService.sendOperatorNotificationEmail({
                                        to: customer.sales.email, // Direct email address
                                        customerName: customer.name,
                                        chatSummary: chatSummary,
                                        chatId: session === null || session === void 0 ? void 0 : session.id,
                                        workspaceName: workspace.name,
                                        subject: `🚨 Richiesta Operatore - ${customer.name}`,
                                        fromEmail: (_d = workspace.whatsappSettings) === null || _d === void 0 ? void 0 : _d.adminEmail,
                                    });
                                    logger_1.default.info("📧 [contactOperator] Email service returned:", emailResult);
                                    if (emailResult) {
                                        logger_1.default.info("✅ [contactOperator] Email sent successfully to sales agent:", customer.sales.email, `(${customer.sales.firstName} ${customer.sales.lastName})`, "for customer:", customer.name);
                                        emailSentSuccessfully = true;
                                    }
                                    else {
                                        logger_1.default.error("❌ [contactOperator] Email sending FAILED (returned false) to sales agent:", customer.sales.email);
                                    }
                                }
                                catch (emailError) {
                                    logger_1.default.error("❌ [contactOperator] Email sending EXCEPTION:", emailError);
                                }
                            }
                            else {
                                // No sales agent assigned - fallback to admin user
                                const adminUser = yield database_1.prisma.user.findFirst({
                                    where: {
                                        role: "ADMIN",
                                        workspaces: {
                                            some: { workspaceId: request.workspaceId },
                                        },
                                    },
                                });
                                if (adminUser === null || adminUser === void 0 ? void 0 : adminUser.email) {
                                    logger_1.default.info("📧 [contactOperator] No sales agent - sending to admin:", adminUser.email);
                                    try {
                                        const emailResult = yield emailService.sendOperatorNotificationEmail({
                                            to: adminUser.email, // Direct email address
                                            customerName: customer.name,
                                            chatSummary: chatSummary,
                                            chatId: session === null || session === void 0 ? void 0 : session.id,
                                            workspaceName: workspace.name,
                                            subject: `🚨 Richiesta Operatore - ${customer.name}`,
                                            fromEmail: (_e = workspace.whatsappSettings) === null || _e === void 0 ? void 0 : _e.adminEmail,
                                        });
                                        logger_1.default.info("📧 [contactOperator] Email service returned (admin):", emailResult);
                                        if (emailResult) {
                                            logger_1.default.info("✅ [contactOperator] Email sent successfully to admin:", adminUser.email, "for customer:", customer.name);
                                            emailSentSuccessfully = true;
                                        }
                                        else {
                                            logger_1.default.error("❌ [contactOperator] Email sending FAILED (returned false) to admin:", adminUser.email);
                                        }
                                    }
                                    catch (emailError) {
                                        logger_1.default.error("❌ [contactOperator] Email sending EXCEPTION (admin):", emailError);
                                    }
                                }
                                else {
                                    logger_1.default.warn("⚠️ No sales agent or admin user found for workspace:", request.workspaceId);
                                }
                            }
                        }
                    }
                }
                catch (emailError) {
                    logger_1.default.error("❌ [contactOperator] Failed to send email to agent:", emailError);
                    // Don't fail the entire operation if email fails
                }
                // Create escalation record (or update existing conversation metadata)
                // For now, we just log and return success
                // Future: Create ticket in CRM, notify operators via email/Slack, etc.
                const ticketId = `TICKET-${Date.now()}`;
                logger_1.default.info("✅ contactOperator escalation registered:", {
                    ticketId,
                    customerId: customer === null || customer === void 0 ? void 0 : customer.id,
                    phoneNumber: request.phoneNumber,
                    activeChatbot: false,
                });
                yield database_1.prisma.$disconnect();
                return {
                    success: true,
                    message: "Mi dispiace molto per l'inconveniente! �\n\n" +
                        "Ricevere merce scaduta è inaccettabile e capisco la tua frustrazione.\n\n" +
                        "Ecco cosa faremo IMMEDIATAMENTE:\n" +
                        "1. ✅ Rimborso completo entro 24 ore\n" +
                        "2. 📦 Sostituzione gratuita del prodotto\n" +
                        "3. 📞 Contatto diretto con il tuo agente per assistenza immediata\n\n" +
                        "L'agente ti contatterà il prima possibile per risolvere la situazione.\n\n" +
                        "**Da questo momento disattiviamo il chatbot e aspettiamo che si colleghi l'agente.** 🤝\n\n" +
                        "Grazie per la pazienza! 😊",
                    timestamp: new Date().toISOString(),
                    ticketId,
                    summaryAgentExecuted: true, // Indica che il Summary Agent è stato eseguito
                    summaryEmailSent: emailSentSuccessfully, // Indica se l'email di riepilogo è stata inviata
                    generatedSummary, // 📧 Il riassunto completo per debug timeline
                    conversationMessages // 📧 I messaggi della conversazione per debug timeline
                };
            }
            catch (dbError) {
                logger_1.default.error("❌ Database error in contactOperator:", dbError);
                yield database_1.prisma.$disconnect();
                // Still return success - escalation intent is recorded in logs
                return {
                    success: true,
                    message: "Mi dispiace molto per l'inconveniente! �\n\n" +
                        "Ricevere merce scaduta è inaccettabile e capisco la tua frustrazione.\n\n" +
                        "Ecco cosa faremo IMMEDIATAMENTE:\n" +
                        "1. ✅ Rimborso completo entro 24 ore\n" +
                        "2. 📦 Sostituzione gratuita del prodotto\n" +
                        "3. 📞 Contatto diretto con il tuo agente per assistenza immediata\n\n" +
                        "L'agente ti contatterà il prima possibile per risolvere la situazione.\n\n" +
                        "**Da questo momento disattiviamo il chatbot e aspettiamo che si colleghi l'agente.** 🤝\n\n" +
                        "Grazie per la pazienza! 😊",
                    timestamp: new Date().toISOString(),
                    summaryAgentExecuted: false, // Summary Agent non eseguito in caso di errore DB
                    summaryEmailSent: false,
                    generatedSummary: "", // Nessun riassunto in caso di errore
                    conversationMessages: [] // Nessun messaggio in caso di errore
                };
            }
        }
        catch (error) {
            logger_1.default.error("❌ Error in contactOperator:", error);
            return {
                success: false,
                message: "Si è verificato un errore. Riprova più tardi.",
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    });
}
//# sourceMappingURL=contactOperator.js.map