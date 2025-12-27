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
exports.invoiceService = exports.InvoiceService = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const storage_1 = require("../storage");
const database_1 = require("@echatbot/database");
class InvoiceService {
    /**
     * Genera fattura PDF per ordine
     */
    generateInvoice(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Recupera dati ordine
            const order = yield database_1.prisma.orders.findUnique({
                where: { id: orderId },
                include: {
                    workspace: true,
                    customer: true,
                    items: {
                        include: {
                            product: true,
                            service: true
                        }
                    }
                }
            });
            if (!order) {
                throw new Error(`Order ${orderId} not found`);
            }
            // 2. Calculate totals from items
            const subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
            const tax = order.taxAmount || 0;
            const total = order.totalAmount;
            // 3. Prepara dati fattura
            const invoiceData = {
                orderId: order.id,
                orderCode: order.orderCode,
                orderDate: order.createdAt,
                workspaceName: order.workspace.name,
                workspaceAddress: order.workspace.address || undefined,
                workspaceVAT: undefined, // vatNumber not in schema
                customerName: order.customer.name,
                customerEmail: order.customer.email,
                customerPhone: order.customer.phone || undefined,
                customerAddress: order.customer.address || undefined,
                items: order.items.map(item => {
                    var _a, _b;
                    return ({
                        name: ((_a = item.product) === null || _a === void 0 ? void 0 : _a.name) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.name) || 'Item',
                        quantity: item.quantity,
                        price: item.unitPrice,
                        total: item.totalPrice
                    });
                }),
                subtotal,
                tax,
                total
            };
            // 4. Genera PDF
            const pdfBuffer = yield this.createPDF(invoiceData);
            // 5. Salva con Storage Service
            const storage = (0, storage_1.getStorageService)();
            const file = yield storage.upload(pdfBuffer, {
                filename: `${order.orderCode}.pdf`,
                folder: `invoices/${order.workspaceId}`,
                contentType: 'application/pdf',
                isPublic: false // Private, richiede signed URL
            });
            // 6. Aggiorna ordine con URL fattura
            yield database_1.prisma.orders.update({
                where: { id: orderId },
                data: {
                    invoiceUrl: file.url,
                    invoiceKey: file.key,
                    invoiceDate: new Date()
                }
            });
            console.log(`✅ Invoice generated: ${file.key}`);
            return file.url;
        });
    }
    /**
     * Crea PDF fattura con logo e branding
     */
    createPDF(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    const doc = new pdfkit_1.default({ margin: 50, size: 'A4' });
                    const chunks = [];
                    doc.on('data', chunk => chunks.push(chunk));
                    doc.on('end', () => resolve(Buffer.concat(chunks)));
                    doc.on('error', reject);
                    const pageWidth = doc.page.width;
                    const margin = 50;
                    const contentWidth = pageWidth - (margin * 2);
                    // === HEADER CON LOGO ===
                    let yPos = margin;
                    // Logo (se presente)
                    const order = yield database_1.prisma.orders.findUnique({
                        where: { id: data.orderId },
                        include: {
                            workspace: true
                        }
                    });
                    const logoUrl = (_a = order === null || order === void 0 ? void 0 : order.workspace) === null || _a === void 0 ? void 0 : _a.logoUrl;
                    if (logoUrl) {
                        try {
                            const storage = (0, storage_1.getStorageService)();
                            const logoKey = this.extractKeyFromUrl(logoUrl);
                            const logoBuffer = yield storage.get(logoKey);
                            // Logo a sinistra
                            doc.image(logoBuffer, margin, yPos, { width: 80, height: 80 });
                        }
                        catch (err) {
                            console.warn('Logo not found, skipping');
                        }
                    }
                    // Workspace info a destra
                    const rightX = pageWidth - margin - 200;
                    doc.fontSize(14).font('Helvetica-Bold').text(data.workspaceName, rightX, yPos, { width: 200, align: 'right' });
                    yPos += 20;
                    if (data.workspaceAddress) {
                        doc.fontSize(9).font('Helvetica').text(data.workspaceAddress, rightX, yPos, { width: 200, align: 'right' });
                        yPos += 15;
                    }
                    if (data.workspaceVAT) {
                        doc.text(`P.IVA: ${data.workspaceVAT}`, rightX, yPos, { width: 200, align: 'right' });
                        yPos += 15;
                    }
                    yPos = Math.max(yPos, margin + 100); // Spazio minimo per logo
                    doc.moveDown(2);
                    // === TITOLO FATTURA ===
                    yPos = doc.y;
                    doc.fontSize(24).font('Helvetica-Bold')
                        .fillColor('#2c3e50')
                        .text('FATTURA', margin, yPos, { align: 'center' });
                    doc.fillColor('#000000');
                    yPos += 40;
                    // === DETTAGLI FATTURA ===
                    doc.fontSize(10).font('Helvetica');
                    doc.text(`Fattura N°: `, margin, yPos, { continued: true })
                        .font('Helvetica-Bold').text(data.orderCode);
                    yPos += 15;
                    doc.font('Helvetica').text(`Data: `, margin, yPos, { continued: true })
                        .font('Helvetica-Bold').text(data.orderDate.toLocaleDateString('it-IT'));
                    yPos += 30;
                    // === BOX CLIENTE ===
                    doc.rect(margin, yPos, contentWidth, 80)
                        .fillAndStroke('#f8f9fa', '#dee2e6');
                    yPos += 15;
                    doc.fillColor('#000000')
                        .fontSize(11).font('Helvetica-Bold')
                        .text('CLIENTE', margin + 15, yPos);
                    yPos += 20;
                    doc.fontSize(10).font('Helvetica')
                        .text(data.customerName, margin + 15, yPos);
                    yPos += 15;
                    doc.text(data.customerEmail, margin + 15, yPos);
                    yPos += 15;
                    if (data.customerPhone) {
                        doc.text(data.customerPhone, margin + 15, yPos);
                        yPos += 15;
                    }
                    if (data.customerAddress) {
                        doc.text(data.customerAddress, margin + 15, yPos, { width: contentWidth - 30 });
                    }
                    yPos += 40;
                    // === TABELLA ITEMS ===
                    const tableTop = yPos;
                    const colDesc = margin;
                    const colQty = pageWidth - margin - 200;
                    const colPrice = pageWidth - margin - 130;
                    const colTotal = pageWidth - margin - 60;
                    // Header tabella
                    doc.rect(margin, tableTop, contentWidth, 25)
                        .fillAndStroke('#2c3e50', '#2c3e50');
                    doc.fillColor('#ffffff')
                        .fontSize(10).font('Helvetica-Bold')
                        .text('Descrizione', colDesc + 10, tableTop + 8)
                        .text('Qtà', colQty, tableTop + 8)
                        .text('Prezzo', colPrice, tableTop + 8)
                        .text('Totale', colTotal, tableTop + 8);
                    yPos = tableTop + 25;
                    doc.fillColor('#000000').font('Helvetica');
                    // Righe items
                    let isEven = false;
                    for (const item of data.items) {
                        // Alternating row colors
                        if (isEven) {
                            doc.rect(margin, yPos, contentWidth, 25).fill('#f8f9fa');
                        }
                        doc.fillColor('#000000')
                            .text(item.name, colDesc + 10, yPos + 8, { width: colQty - colDesc - 20 })
                            .text(item.quantity.toString(), colQty, yPos + 8)
                            .text(`€${item.price.toFixed(2)}`, colPrice, yPos + 8)
                            .text(`€${item.total.toFixed(2)}`, colTotal, yPos + 8);
                        yPos += 25;
                        isEven = !isEven;
                    }
                    // Linea finale tabella
                    doc.moveTo(margin, yPos).lineTo(pageWidth - margin, yPos).stroke('#dee2e6');
                    yPos += 30;
                    // === TOTALI ===
                    const totalsX = pageWidth - margin - 150;
                    doc.fontSize(10).font('Helvetica')
                        .text('Subtotale:', totalsX, yPos)
                        .text(`€${data.subtotal.toFixed(2)}`, totalsX + 80, yPos, { align: 'right' });
                    yPos += 20;
                    doc.text('IVA (22%):', totalsX, yPos)
                        .text(`€${data.tax.toFixed(2)}`, totalsX + 80, yPos, { align: 'right' });
                    yPos += 25;
                    // Box totale
                    doc.rect(totalsX - 10, yPos - 5, 160, 30)
                        .fillAndStroke('#2c3e50', '#2c3e50');
                    doc.fillColor('#ffffff')
                        .fontSize(12).font('Helvetica-Bold')
                        .text('TOTALE:', totalsX, yPos + 5)
                        .text(`€${data.total.toFixed(2)}`, totalsX + 80, yPos + 5, { align: 'right' });
                    // === FOOTER ===
                    const footerY = doc.page.height - 80;
                    doc.fillColor('#7f8c8d')
                        .fontSize(8).font('Helvetica')
                        .text('Grazie per il tuo acquisto! Per qualsiasi informazione contattaci.', margin, footerY, { align: 'center', width: contentWidth });
                    doc.fontSize(7)
                        .text(`Documento generato automaticamente il ${new Date().toLocaleString('it-IT')}`, margin, footerY + 15, { align: 'center', width: contentWidth });
                    doc.end();
                }
                catch (error) {
                    reject(error);
                }
            }));
        });
    }
    /**
     * Estrae key da URL
     */
    extractKeyFromUrl(url) {
        // http://localhost:3001/uploads/workspaces/123/logo.png → workspaces/123/logo.png
        // https://bucket.s3.amazonaws.com/workspaces/123/logo.png → workspaces/123/logo.png
        if (url.includes('/uploads/')) {
            return url.split('/uploads/')[1];
        }
        if (url.includes('.amazonaws.com/')) {
            return url.split('.amazonaws.com/')[1].split('?')[0];
        }
        return url;
    }
    /**
     * Get signed URL per scaricare fattura
     */
    getInvoiceUrl(orderId_1) {
        return __awaiter(this, arguments, void 0, function* (orderId, expiresIn = 3600) {
            const order = yield database_1.prisma.orders.findUnique({
                where: { id: orderId },
                select: { invoiceKey: true }
            });
            if (!(order === null || order === void 0 ? void 0 : order.invoiceKey)) {
                throw new Error('Invoice not found');
            }
            const storage = (0, storage_1.getStorageService)();
            return storage.getUrl(order.invoiceKey, expiresIn);
        });
    }
    /**
     * Elimina fattura
     */
    deleteInvoice(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield database_1.prisma.orders.findUnique({
                where: { id: orderId },
                select: { invoiceKey: true }
            });
            if (!(order === null || order === void 0 ? void 0 : order.invoiceKey)) {
                return;
            }
            const storage = (0, storage_1.getStorageService)();
            yield storage.delete(order.invoiceKey);
            yield database_1.prisma.orders.update({
                where: { id: orderId },
                data: {
                    invoiceUrl: null,
                    invoiceKey: null
                }
            });
        });
    }
}
exports.InvoiceService = InvoiceService;
exports.invoiceService = new InvoiceService();
//# sourceMappingURL=InvoiceService.js.map