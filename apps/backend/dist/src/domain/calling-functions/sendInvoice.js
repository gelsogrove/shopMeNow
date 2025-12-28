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
exports.sendInvoice = sendInvoice;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../utils/logger"));
const email_service_1 = require("../../application/services/email.service");
function generatePdfBuffer(build) {
    return __awaiter(this, void 0, void 0, function* () {
        const PDFDocument = require("pdfkit");
        return yield new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: "A4", margin: 50 });
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", (err) => reject(err));
            build(doc);
            doc.end();
        });
    });
}
function generateInvoicePdf(params) {
    return __awaiter(this, void 0, void 0, function* () {
        return generatePdfBuffer((doc) => {
            doc.fontSize(20).font("Helvetica-Bold").text("INVOICE", { align: "center" });
            doc.moveDown(0.5);
            doc.fontSize(10).font("Helvetica").text(params.workspaceName, { align: "center" });
            doc.moveDown(0.5);
            doc.text(`Invoice Number: ${params.orderCode}`, { align: "center" });
            doc.text(`Invoice Date: ${new Date(params.createdAt).toLocaleDateString("en-US")}`, {
                align: "center",
            });
            doc.moveDown(2);
            doc.fontSize(12).font("Helvetica-Bold").text("BILL TO");
            doc.moveDown(0.25);
            doc.fontSize(10).font("Helvetica");
            if (params.customerName)
                doc.text(params.customerName);
            if (params.customerEmail)
                doc.text(`Email: ${params.customerEmail}`);
            if (params.customerPhone)
                doc.text(`Phone: ${params.customerPhone}`);
            doc.moveDown(2);
            doc.fontSize(12).font("Helvetica-Bold").text("ITEMS");
            doc.moveDown(0.5);
            // Simple table header
            doc.fontSize(10).font("Helvetica-Bold");
            doc.text("Item", 50, doc.y, { continued: true });
            doc.text("Qty", 300, doc.y, { width: 50, align: "right", continued: true });
            doc.text("Unit", 360, doc.y, { width: 70, align: "right", continued: true });
            doc.text("Total", 440, doc.y, { width: 100, align: "right" });
            doc.moveDown(0.25);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font("Helvetica");
            for (const item of params.items) {
                doc.text(item.name, 50, doc.y, { continued: true });
                doc.text(String(item.quantity), 300, doc.y, { width: 50, align: "right", continued: true });
                doc.text(`€${item.unitPrice.toFixed(2)}`, 360, doc.y, { width: 70, align: "right", continued: true });
                doc.text(`€${item.totalPrice.toFixed(2)}`, 440, doc.y, { width: 100, align: "right" });
            }
            doc.moveDown(1);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(12).font("Helvetica-Bold").text(`Grand Total: €${params.orderTotal.toFixed(2)}`, {
                align: "right",
            });
        });
    });
}
function generateCreditNotePdf(params) {
    return __awaiter(this, void 0, void 0, function* () {
        return generatePdfBuffer((doc) => {
            doc.fontSize(20).font("Helvetica-Bold").text("CREDIT NOTE", { align: "center" });
            doc.moveDown(0.5);
            doc.fontSize(10).font("Helvetica").text(params.workspaceName, { align: "center" });
            doc.moveDown(1);
            doc.fontSize(12).font("Helvetica-Bold").text(`Credit Note: ${params.creditNoteCode}`);
            doc.fontSize(10).font("Helvetica");
            doc.text(`Order: ${params.orderCode}`);
            doc.text(`Date: ${new Date(params.createdAt).toLocaleDateString("en-US")}`);
            doc.text(`Amount: €${params.amount.toFixed(2)}`);
            doc.moveDown(1);
            doc.fontSize(10).font("Helvetica-Bold").text("Reason");
            doc.fontSize(10).font("Helvetica").text(params.reason || "-");
        });
    });
}
/**
 * Send invoice PDF via email for specific order
 * @see Feature 202 - Order Selection & Invoice Actions
 *
 * PDF naming: {orderCode}_fattura.pdf
 * Credit notes: {orderCode}_notadicredito{N}.pdf
 */
function sendInvoice(request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            logger_1.default.info("[SEND_INVOICE] Sending invoice:", request);
            const { customerId, workspaceId, orderId, email } = request;
            // Find order with customer details and credit notes
            const order = yield database_1.prisma.orders.findFirst({
                where: {
                    OR: [{ id: orderId }, { orderCode: orderId }],
                    customerId: customerId,
                    workspaceId: workspaceId,
                },
                include: {
                    customer: true,
                    workspace: true,
                    items: {
                        include: {
                            product: true,
                            service: true,
                        },
                    },
                    creditNotes: true,
                },
            });
            if (!order) {
                logger_1.default.warn(`[SEND_INVOICE] Order not found: ${orderId}`);
                return {
                    success: false,
                    error: "Order not found",
                    message: `Order ${orderId} was not found. Please check the order code.`,
                };
            }
            // Determine email recipient
            const recipientEmail = email || order.customer.email;
            if (!recipientEmail) {
                logger_1.default.warn(`[SEND_INVOICE] No email available for customer: ${customerId}`);
                return {
                    success: false,
                    error: "No email available",
                    message: "No email is available. Please provide an email address.",
                };
            }
            // Calculate order total
            const orderTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
            const workspaceName = ((_a = order.workspace) === null || _a === void 0 ? void 0 : _a.name) || "eChatbot";
            const invoicePdf = yield generateInvoicePdf({
                workspaceName,
                orderCode: order.orderCode,
                createdAt: order.createdAt,
                customerName: ((_b = order.customer) === null || _b === void 0 ? void 0 : _b.name) || undefined,
                customerEmail: ((_c = order.customer) === null || _c === void 0 ? void 0 : _c.email) || undefined,
                customerPhone: ((_d = order.customer) === null || _d === void 0 ? void 0 : _d.phone) || undefined,
                items: order.items.map((it) => {
                    var _a, _b;
                    return ({
                        name: ((_a = it.product) === null || _a === void 0 ? void 0 : _a.name) || ((_b = it.service) === null || _b === void 0 ? void 0 : _b.name) || "Item",
                        quantity: it.quantity,
                        unitPrice: it.unitPrice,
                        totalPrice: it.totalPrice,
                    });
                }),
                orderTotal,
            });
            // Prepare credit note PDFs if any
            const creditNotePdfs = [];
            if (order.creditNotes && order.creditNotes.length > 0) {
                for (let i = 0; i < order.creditNotes.length; i++) {
                    const cn = order.creditNotes[i];
                    const fileName = `${order.orderCode}_notadicredito${i + 1}.pdf`;
                    const content = yield generateCreditNotePdf({
                        workspaceName,
                        orderCode: order.orderCode,
                        creditNoteCode: cn.creditNoteCode,
                        amount: cn.amount,
                        reason: cn.reason,
                        createdAt: cn.createdAt,
                    });
                    creditNotePdfs.push({ fileName, content });
                }
            }
            // Send email with invoice (and credit notes if any)
            const emailService = new email_service_1.EmailService();
            const emailSent = yield emailService.sendInvoiceEmail({
                to: recipientEmail,
                orderCode: order.orderCode,
                customerName: order.customer.name || "Customer",
                orderTotal,
                invoicePdf,
                creditNotePdfs: creditNotePdfs.length > 0 ? creditNotePdfs : undefined,
                workspaceName,
            });
            if (!emailSent) {
                logger_1.default.error(`[SEND_INVOICE] Failed to send email to ${recipientEmail}`);
                return {
                    success: false,
                    error: "Email sending failed",
                    message: "Failed to send the email. Please try again later.",
                };
            }
            logger_1.default.info(`[SEND_INVOICE] ✅ Invoice sent to ${recipientEmail} for order ${order.orderCode}`);
            // Build response message
            let message = `✅ Invoice for order ${order.orderCode} has been emailed to ${recipientEmail}.`;
            if (creditNotePdfs.length > 0) {
                message += ` It also includes ${creditNotePdfs.length} credit note(s).`;
            }
            message += " Please check your inbox.";
            return {
                success: true,
                message,
                sentTo: recipientEmail,
            };
        }
        catch (error) {
            logger_1.default.error("[SEND_INVOICE] Error:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                message: "Failed to send the invoice. Please try again later or contact support.",
            };
        }
    });
}
//# sourceMappingURL=sendInvoice.js.map