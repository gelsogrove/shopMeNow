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
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("../../utils/logger"));
const database_1 = require("@echatbot/database");
const email_templates_1 = require("../../utils/email-templates");
class EmailService {
    constructor() {
        this.setupTransporter();
    }
    setupTransporter() {
        // SMTP configuration - REQUIRES real credentials
        const config = {
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || "",
                pass: process.env.SMTP_PASS || "",
            },
        };
        // Validate SMTP credentials
        if (!config.auth.user || !config.auth.pass) {
            logger_1.default.error("SMTP credentials not configured! Please set SMTP_USER and SMTP_PASS in .env file");
            throw new Error("SMTP credentials required for email service");
        }
        this.transporter = nodemailer_1.default.createTransport(config);
        logger_1.default.info(`Email service initialized with SMTP: ${config.host}:${config.port}`);
    }
    sendPasswordResetEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth/reset-password?token=${data.resetToken}`;
                // Get translations for the user's language (defaults to English)
                const t = (0, email_templates_1.getEmailTranslation)(data.language);
                const userFirstName = data.userFirstName || t.resetPassword.greeting;
                logger_1.default.info(`Sending password reset email to: ${data.to} in language: ${data.language || "en (default)"}`);
                const htmlContent = this.generateResetEmailHTML({
                    resetUrl,
                    userFirstName,
                    expiryTime: "1 hour",
                    translations: t.resetPassword,
                });
                const mailOptions = {
                    from: `"eChatbot Support" <${process.env.SMTP_FROM || "noreply@echatbot.ai"}>`,
                    to: data.to,
                    subject: t.resetPassword.subject,
                    html: htmlContent,
                    text: this.generateResetEmailText(resetUrl, userFirstName, t.resetPassword),
                };
                const info = yield this.transporter.sendMail(mailOptions);
                logger_1.default.info(`Password reset email sent successfully to: ${data.to} (language: ${data.language || "en"})`);
                return true;
            }
            catch (error) {
                logger_1.default.error("Failed to send password reset email:", error);
                return false;
            }
        });
    }
    generateResetEmailHTML(data) {
        const t = data.translations;
        const warningsList = t.warnings.map((w) => `<li>${w}</li>`).join("\n                ");
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .button:hover { background-color: #059669; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        .warning { background-color: #fef3cd; border: 1px solid #fbbf24; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 ${t.subject}</h1>
    </div>
    <div class="content">
        <p>${t.greeting} ${data.userFirstName},</p>
        
        <p>${t.intro}</p>
        
        <p style="text-align: center;">
            <a href="${data.resetUrl}" class="button">${t.resetButton}</a>
        </p>
        
        <p>${t.copyLink}</p>
        <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px;">
            ${data.resetUrl}
        </p>
        
        <div class="warning">
            <strong>${t.warningTitle}</strong>
            <ul>
                ${warningsList}
            </ul>
        </div>
        
        <p>${t.footer}</p>
    </div>
    <div class="footer">
        <p>${t.rights}</p>
    </div>
</body>
</html>
    `;
    }
    generateResetEmailText(resetUrl, userFirstName, translations) {
        const t = translations;
        const warningsList = t.warnings.map((w) => `- ${w}`).join("\n");
        return `
${t.greeting} ${userFirstName},

${t.intro}

${t.copyLink}
${resetUrl}

${t.warningTitle}
${warningsList}

${t.footer}

---
${t.rights}
    `;
    }
    sendOperatorNotificationEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`📧 [EmailService] Preparing operator notification email to: ${data.to}`);
                const htmlContent = this.generateOperatorNotificationHTML(data);
                const textContent = this.generateOperatorNotificationText(data);
                const mailOptions = {
                    from: `"eChatbot Support" <${data.fromEmail || process.env.SMTP_FROM || "noreply@echatbot.ai"}>`,
                    to: data.to,
                    subject: data.subject ||
                        `🔔 Utente ${data.customerName} vuole parlare con un operatore`,
                    html: htmlContent,
                    text: textContent,
                };
                logger_1.default.info(`📧 [EmailService] Sending email via SMTP to: ${data.to} from: ${mailOptions.from}`);
                const info = yield this.transporter.sendMail(mailOptions);
                logger_1.default.info(`✅ [EmailService] Operator notification email sent successfully to: ${data.to}, MessageID: ${info.messageId}`);
                return true;
            }
            catch (error) {
                logger_1.default.error(`❌ [EmailService] Failed to send operator notification email to ${data.to}:`, error);
                return false;
            }
        });
    }
    generateOperatorNotificationHTML(data) {
        const chatLink = data.chatId
            ? `${process.env.FRONTEND_URL || "http://localhost:5173"}/chat/${data.chatId}`
            : null;
        return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Richiesta Assistenza Operatore</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .button:hover { background-color: #059669; }
        .summary-box { background-color: #e5e7eb; border-left: 4px solid #6366f1; padding: 15px; margin: 15px 0; border-radius: 0 5px 5px 0; }
        .urgent { background-color: #fef3cd; border: 1px solid #fbbf24; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔔 Richiesta Assistenza Operatore</h1>
    </div>
    <div class="content">
        <div class="urgent">
            <strong>⚠️ ATTENZIONE:</strong> L'utente <strong>${data.customerName}</strong> ha richiesto di parlare con un operatore.
        </div>
        
        <h3>📋 Dettagli della richiesta:</h3>
        <ul>
            <li><strong>Cliente:</strong> ${data.customerName}</li>
            <li><strong>Workspace:</strong> ${data.workspaceName || "N/A"}</li>
            <li><strong>Data/Ora:</strong> ${new Date().toLocaleString("it-IT")}</li>
        </ul>
        
        <h3>🤖 Riassunto AI della conversazione (ultime 24h):</h3>
        <div class="summary-box">
            ${data.chatSummary}
        </div>
        
        ${chatLink
            ? `
        <p style="text-align: center;">
            <a href="${chatLink}" class="button">📱 Visualizza Chat Completa</a>
        </p>
        `
            : ""}
        
        <p><strong>Azione richiesta:</strong> Contattare il cliente il prima possibile per fornire assistenza personalizzata.</p>
        
        <p>Cordiali saluti,<br>Sistema di Notifiche eChatbot</p>
    </div>
    <div class="footer">
        <p>Questa email è stata generata automaticamente dal sistema eChatbot quando un cliente ha richiesto assistenza operatore.</p>
        <p>eChatbot - La tua piattaforma e-commerce di fiducia</p>
    </div>
</body>
</html>
    `;
    }
    generateOperatorNotificationText(data) {
        const chatLink = data.chatId
            ? `${process.env.FRONTEND_URL || "http://localhost:5173"}/chat/${data.chatId}`
            : null;
        return `
🔔 RICHIESTA ASSISTENZA OPERATORE

⚠️ ATTENZIONE: L'utente ${data.customerName} ha richiesto di parlare con un operatore.

📋 Dettagli della richiesta:
- Cliente: ${data.customerName}
- Workspace: ${data.workspaceName || "N/A"}
- Data/Ora: ${new Date().toLocaleString("it-IT")}

🤖 Riassunto AI della conversazione (ultime 24h):
${data.chatSummary}

${chatLink ? `📱 Link alla chat completa: ${chatLink}` : ""}

Azione richiesta: Contattare il cliente il prima possibile per fornire assistenza personalizzata.

Cordiali saluti,
Sistema di Notifiche eChatbot

---
Questa email è stata generata automaticamente dal sistema eChatbot quando un cliente ha richiesto assistenza operatore.
eChatbot - La tua piattaforma e-commerce di fiducia
    `;
    }
    /**
     * Generic email sending function
     * @param params.type - 'customer' or 'agent' - determines email lookup
     * @param params.to - customerId or agentId (userId)
     * @param params.subject - Email subject
     * @param params.body - Email body (HTML or plain text)
     * @param params.cc - Optional CC recipients (string or array)
     * @param params.workspaceId - Workspace ID for database lookup
     * @returns Promise<boolean> - true if sent successfully, false otherwise
     */
    sendMail(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { type, to, subject, body, cc, workspaceId } = params;
                // Use the singleton prisma instance from @echatbot/database
                let recipientEmail = null;
                let recipientName = null;
                try {
                    if (type === "customer") {
                        // Lookup customer email
                        const customer = yield database_1.prisma.customers.findUnique({
                            where: { id: to },
                            select: { email: true, name: true },
                        });
                        if (!customer || !customer.email) {
                            logger_1.default.error(`Customer ${to} not found or has no email`);
                            return false;
                        }
                        recipientEmail = customer.email;
                        recipientName = customer.name || "Customer";
                    }
                    else if (type === "agent") {
                        // Lookup agent (user) email
                        const agent = yield database_1.prisma.user.findUnique({
                            where: { id: to },
                            select: { email: true, firstName: true, lastName: true },
                        });
                        if (!agent || !agent.email) {
                            logger_1.default.error(`Agent ${to} not found or has no email`);
                            return false;
                        }
                        recipientEmail = agent.email;
                        recipientName =
                            `${agent.firstName || ""} ${agent.lastName || ""}`.trim();
                    }
                    else {
                        logger_1.default.error(`Invalid type: ${type}. Must be 'customer' or 'agent'`);
                        return false;
                    }
                    // Fetch workspace admin email for FROM address
                    const workspace = yield database_1.prisma.workspace.findUnique({
                        where: { id: workspaceId },
                        select: {
                            name: true,
                            whatsappSettings: {
                                select: { adminEmail: true },
                            },
                        },
                    });
                    if (!workspace || !((_a = workspace.whatsappSettings) === null || _a === void 0 ? void 0 : _a.adminEmail)) {
                        logger_1.default.error(`Workspace ${workspaceId} not found or has no admin email in whatsappSettings`);
                        return false;
                    }
                    const fromEmail = workspace.whatsappSettings.adminEmail;
                    const fromName = workspace.name || "eChatbot";
                    // Build email options
                    const mailOptions = {
                        from: `"${fromName}" <${fromEmail}>`,
                        to: recipientEmail,
                        subject: subject,
                        html: body,
                        text: body.replace(/<[^>]*>/g, ""), // Strip HTML tags for plain text fallback
                    };
                    // Add CC if provided
                    if (cc) {
                        mailOptions.cc = Array.isArray(cc) ? cc.join(", ") : cc;
                    }
                    // Send email
                    const info = yield this.transporter.sendMail(mailOptions);
                    logger_1.default.info(`Email sent successfully to ${type} ${recipientName} (${recipientEmail}). MessageID: ${info.messageId}`);
                    return true;
                }
                finally {
                    yield database_1.prisma.$disconnect();
                }
            }
            catch (error) {
                logger_1.default.error("Failed to send email via sendMail():", error);
                return false;
            }
        });
    }
    sendWelcomeEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to eChatbot</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Welcome to eChatbot! 🎉</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi <strong>${data.firstName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Welcome to <strong>eChatbot</strong>! We're excited to have you on board. 🚀
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Your account has been successfully created. You can now:
              </p>
              
              <ul style="margin: 0 0 20px; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #333333;">
                <li>Manage your products and services</li>
                <li>Handle customer orders via WhatsApp</li>
                <li>Use AI-powered chatbot for customer support</li>
                <li>Track analytics and sales</li>
              </ul>
              
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #333333;">
                If you have any questions, feel free to reach out to our support team.
              </p>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Get Started
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 14px; color: #666666;">
                © 2025 eChatbot. All rights reserved.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #999999;">
                You're receiving this email because you registered for a eChatbot account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
                const textContent = `
Welcome to eChatbot!

Hi ${data.firstName},

Welcome to eChatbot! We're excited to have you on board.

Your account has been successfully created. You can now:
- Manage your products and services
- Handle customer orders via WhatsApp
- Use AI-powered chatbot for customer support
- Track analytics and sales

Get started: ${process.env.FRONTEND_URL || "http://localhost:3000"}

If you have any questions, feel free to reach out to our support team.

Best regards,
The eChatbot Team

© 2025 eChatbot. All rights reserved.
`;
                const mailOptions = {
                    from: `"eChatbot" <${process.env.SMTP_FROM || "noreply@echatbot.ai"}>`,
                    to: data.to,
                    subject: "Welcome to eChatbot! 🎉",
                    html: htmlContent,
                    text: textContent,
                };
                const info = yield this.transporter.sendMail(mailOptions);
                logger_1.default.info(`Welcome email sent successfully to: ${data.to}`);
                return true;
            }
            catch (error) {
                logger_1.default.error("Failed to send welcome email:", error);
                return false;
            }
        });
    }
    /**
     * Send invoice email with PDF attachment
     * @see Feature 202 - Order Selection & Invoice Actions
     *
     * PDF naming convention:
     * - Invoice: {orderCode}_fattura.pdf
     * - Credit note: {orderCode}_notadicredito{N}.pdf
     */
    sendInvoiceEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const invoiceFileName = `${data.orderCode}_fattura.pdf`;
                // Build attachments array
                const attachments = [];
                // Add invoice PDF
                attachments.push({
                    filename: invoiceFileName,
                    content: data.invoicePdf,
                });
                // Add credit note PDFs if present
                if (data.creditNotePdfs && data.creditNotePdfs.length > 0) {
                    for (const cn of data.creditNotePdfs) {
                        attachments.push({
                            filename: cn.fileName,
                            content: cn.content,
                        });
                    }
                }
                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${data.orderCode}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">📄 Invoice ${data.orderCode}</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi <strong>${data.customerName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Attached you will find the invoice for your order <strong>${data.orderCode}</strong>.
              </p>
              
              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 5px 5px 0;">
                <p style="margin: 0; font-size: 18px; color: #166534;">
                  <strong>Order total: €${data.orderTotal.toFixed(2)}</strong>
                </p>
              </div>
              
              ${data.creditNotePdfs && data.creditNotePdfs.length > 0 ? `
              <p style="margin: 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                📋 We've also attached <strong>${data.creditNotePdfs.length} credit note(s)</strong> related to this order.
              </p>
              ` : ''}
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                If you have any questions, feel free to contact us.
              </p>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Thank you for your purchase.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 14px; color: #666666;">
                © 2025 ${data.workspaceName || "eChatbot"}. Tutti i diritti riservati.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
                const textContent = `
    Invoice ${data.orderCode}

    Hi ${data.customerName},

    Attached you will find the invoice for your order ${data.orderCode}.

    Order total: €${data.orderTotal.toFixed(2)}

    ${data.creditNotePdfs && data.creditNotePdfs.length > 0 ? `We've also attached ${data.creditNotePdfs.length} credit note(s) related to this order.\n` : ''}

    If you have any questions, feel free to contact us.

    Thank you for your purchase.

---
© 2025 ${data.workspaceName || "eChatbot"}. All rights reserved.
`;
                const mailOptions = {
                    from: `"${data.workspaceName || "eChatbot"}" <${process.env.SMTP_FROM || "noreply@echatbot.ai"}>`,
                    to: data.to,
                    subject: `📄 Invoice ${data.orderCode}`,
                    html: htmlContent,
                    text: textContent,
                    attachments,
                };
                const info = yield this.transporter.sendMail(mailOptions);
                logger_1.default.info(`✅ [EmailService] Invoice email sent to ${data.to} for order ${data.orderCode}. MessageID: ${info.messageId}`);
                return true;
            }
            catch (error) {
                logger_1.default.error(`❌ [EmailService] Failed to send invoice email for order ${data.orderCode}:`, error);
                return false;
            }
        });
    }
    /**
     * Generate a placeholder PDF for MVP testing
     * This creates a simple text-based placeholder that looks like a PDF
     * In production, this would be replaced with actual PDF generation (e.g., pdfkit)
     */
    generatePlaceholderInvoicePdf(orderCode, total, customerName) {
        // Simple placeholder - in production use pdfkit or similar
        const content = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 24 Tf
50 700 Td
(FATTURA - ${orderCode}) Tj
/F1 14 Tf
0 -40 Td
(Cliente: ${customerName}) Tj
0 -25 Td
(Totale: EUR ${total.toFixed(2)}) Tj
0 -50 Td
(Documento generato automaticamente) Tj
0 -20 Td
(Data: ${new Date().toLocaleDateString("it-IT")}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000518 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
595
%%EOF
`;
        return Buffer.from(content, 'utf-8');
    }
    verifyConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.transporter.verify();
                logger_1.default.info("Email service connection verified successfully");
                return true;
            }
            catch (error) {
                logger_1.default.error("Email service connection failed:", error);
                return false;
            }
        });
    }
    /**
     * Send notification email when a user unsubscribes (soft-delete)
     * Sends to user AND admin for compliance tracking
     */
    sendUnsubscribeNotification(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const formattedDate = data.permanentDeleteDate.toLocaleDateString("it-IT", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                });
                const cascadeInfo = data.cascadeType === "OWNER_CASCADE"
                    ? `The workspace "${data.workspaceName || "N/A"}" and all associated data (customers, orders, messages) have been marked for deletion.`
                    : `Only your user account has been marked for deletion. The workspace remains active.`;
                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; background-color: #f9fafb; }
        .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .footer { background-color: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚠️ Account Deletion Initiated</h1>
    </div>
    <div class="content">
        <p>Dear ${data.userName},</p>
        
        <p>Your account deletion request has been processed successfully.</p>
        
        <div class="warning">
            <strong>Important Information:</strong>
            <ul>
                <li><strong>Deletion Type:</strong> ${data.cascadeType === "OWNER_CASCADE" ? "Owner Cascade (full workspace)" : "Agent Isolated"}</li>
                <li><strong>Permanent Delete Date:</strong> ${formattedDate}</li>
                <li><strong>Recovery Window:</strong> 90 days from today</li>
            </ul>
        </div>
        
        <p>${cascadeInfo}</p>
        
        <p>If you did not request this deletion or wish to recover your account, please contact our support team immediately at <a href="mailto:support@echatbot.ai">support@echatbot.ai</a> before ${formattedDate}.</p>
        
        <p>After this date, all data will be permanently deleted and cannot be recovered.</p>
        
        <p>Best regards,<br>The eChatbot Team</p>
    </div>
    <div class="footer">
        <p>© 2025 eChatbot. All rights reserved.</p>
        <p>This is an automated notification for compliance purposes.</p>
    </div>
</body>
</html>`;
                // Send to user
                const mailOptions = {
                    from: `"eChatbot" <${process.env.SMTP_FROM || "noreply@echatbot.ai"}>`,
                    to: data.userEmail,
                    cc: data.adminEmail || process.env.ADMIN_EMAIL, // CC admin
                    subject: "⚠️ Account Deletion Confirmation - eChatbot",
                    html: htmlContent,
                };
                yield this.transporter.sendMail(mailOptions);
                logger_1.default.info(`Unsubscribe notification sent to: ${data.userEmail} (cc: ${data.adminEmail || process.env.ADMIN_EMAIL})`);
                return true;
            }
            catch (error) {
                logger_1.default.error("Failed to send unsubscribe notification:", error);
                return false;
            }
        });
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=email.service.js.map