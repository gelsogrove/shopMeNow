import PDFDocument from 'pdfkit';
import { getStorageService } from '../storage';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface InvoiceData {
  orderId: string;
  orderNumber: string;
  orderDate: Date;
  workspaceName: string;
  workspaceAddress?: string;
  workspaceVAT?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

export class InvoiceService {
  /**
   * Genera fattura PDF per ordine
   */
  async generateInvoice(orderId: string): Promise<string> {
    // 1. Recupera dati ordine
    const order = await prisma.order.findUnique({
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

    // 2. Prepara dati fattura
    const invoiceData: InvoiceData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      workspaceName: order.workspace.name,
      workspaceAddress: order.workspace.address || undefined,
      workspaceVAT: order.workspace.vatNumber || undefined,
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      customerPhone: order.customer.phone || undefined,
      customerAddress: order.customer.address || undefined,
      items: order.items.map(item => ({
        name: item.product?.name || item.service?.name || 'Item',
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
        total: parseFloat(item.total.toString())
      })),
      subtotal: parseFloat(order.subtotal.toString()),
      tax: parseFloat(order.tax.toString()),
      total: parseFloat(order.total.toString())
    };

    // 3. Genera PDF
    const pdfBuffer = await this.createPDF(invoiceData);

    // 4. Salva con Storage Service
    const storage = getStorageService();
    const file = await storage.upload(pdfBuffer, {
      filename: `${order.orderNumber}.pdf`,
      folder: `invoices/${order.workspaceId}`,
      contentType: 'application/pdf',
      isPublic: false // Private, richiede signed URL
    });

    // 5. Aggiorna ordine con URL fattura
    await prisma.order.update({
      where: { id: orderId },
      data: {
        invoiceUrl: file.url,
        invoiceKey: file.key
      }
    });

    console.log(`✅ Invoice generated: ${file.key}`);
    return file.url;
  }

  /**
   * Crea PDF fattura
   */
  private async createPDF(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('FATTURA', { align: 'center' });
      doc.moveDown();

      // Workspace info
      doc.fontSize(12).text(data.workspaceName, { bold: true });
      if (data.workspaceAddress) {
        doc.fontSize(10).text(data.workspaceAddress);
      }
      if (data.workspaceVAT) {
        doc.text(`P.IVA: ${data.workspaceVAT}`);
      }
      doc.moveDown();

      // Invoice details
      doc.fontSize(10);
      doc.text(`Fattura N°: ${data.orderNumber}`);
      doc.text(`Data: ${data.orderDate.toLocaleDateString('it-IT')}`);
      doc.moveDown();

      // Customer info
      doc.fontSize(12).text('Cliente:', { bold: true });
      doc.fontSize(10).text(data.customerName);
      doc.text(data.customerEmail);
      if (data.customerPhone) {
        doc.text(data.customerPhone);
      }
      if (data.customerAddress) {
        doc.text(data.customerAddress);
      }
      doc.moveDown(2);

      // Items table
      const tableTop = doc.y;
      const itemX = 50;
      const qtyX = 300;
      const priceX = 370;
      const totalX = 450;

      // Table header
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Descrizione', itemX, tableTop);
      doc.text('Qtà', qtyX, tableTop);
      doc.text('Prezzo', priceX, tableTop);
      doc.text('Totale', totalX, tableTop);
      
      doc.moveTo(itemX, tableTop + 15)
         .lineTo(550, tableTop + 15)
         .stroke();

      // Table rows
      doc.font('Helvetica');
      let y = tableTop + 25;
      
      for (const item of data.items) {
        doc.text(item.name, itemX, y, { width: 240 });
        doc.text(item.quantity.toString(), qtyX, y);
        doc.text(`€${item.price.toFixed(2)}`, priceX, y);
        doc.text(`€${item.total.toFixed(2)}`, totalX, y);
        y += 25;
      }

      // Totals
      doc.moveDown(2);
      const totalsX = 400;
      y = doc.y;

      doc.text('Subtotale:', totalsX, y);
      doc.text(`€${data.subtotal.toFixed(2)}`, totalX, y);
      y += 20;

      doc.text('IVA:', totalsX, y);
      doc.text(`€${data.tax.toFixed(2)}`, totalX, y);
      y += 20;

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('TOTALE:', totalsX, y);
      doc.text(`€${data.total.toFixed(2)}`, totalX, y);

      // Footer
      doc.fontSize(8).font('Helvetica');
      doc.text(
        'Grazie per il tuo acquisto!',
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();
    });
  }

  /**
   * Get signed URL per scaricare fattura
   */
  async getInvoiceUrl(orderId: string, expiresIn: number = 3600): Promise<string> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { invoiceKey: true }
    });

    if (!order?.invoiceKey) {
      throw new Error('Invoice not found');
    }

    const storage = getStorageService();
    return storage.getUrl(order.invoiceKey, expiresIn);
  }

  /**
   * Elimina fattura
   */
  async deleteInvoice(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { invoiceKey: true }
    });

    if (!order?.invoiceKey) {
      return;
    }

    const storage = getStorageService();
    await storage.delete(order.invoiceKey);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        invoiceUrl: null,
        invoiceKey: null
      }
    });
  }
}

export const invoiceService = new InvoiceService();
