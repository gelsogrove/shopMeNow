# 🧾 Invoice Service - Generazione Fatture Automatica

## 🎯 Funzionalità

Quando un ordine viene completato:
1. ✅ Genera PDF fattura professionale
2. ✅ Salva con Storage Service (Local dev / Cloudinary prod)
3. ✅ Associa fattura all'ordine nel DB
4. ✅ Genera signed URL per download sicuro
5. ✅ Invia email al cliente con link

---

## 🏗️ Architettura

```
Order completato
    ↓
InvoiceService.generateInvoice()
    ↓
1. Query dati ordine (Prisma)
2. Genera PDF (pdfkit)
3. Upload PDF (StorageService)
    ├─ Dev: ./uploads/invoices/
    └─ Prod: Cloudinary
4. Salva URL in Order.invoiceUrl
5. Return signed URL
    ↓
Email al cliente con link download
```

---

## 🚀 Utilizzo

### Genera fattura quando ordine completato

```typescript
import { invoiceService } from './services/invoice/InvoiceService';

// Nel controller ordini
export async function completeOrder(orderId: string) {
  // 1. Completa ordine
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'COMPLETED' }
  });

  // 2. Genera fattura
  const invoiceUrl = await invoiceService.generateInvoice(orderId);

  // 3. Invia email
  await sendEmail({
    to: order.customer.email,
    subject: `Fattura ordine ${order.orderNumber}`,
    body: `
      Grazie per il tuo acquisto!
      
      Scarica la tua fattura: ${invoiceUrl}
      
      (Il link scade tra 24 ore)
    `
  });

  return { success: true, invoiceUrl };
}
```

### Get signed URL per download

```typescript
// Cliente vuole scaricare fattura
export async function downloadInvoice(req: Request, res: Response) {
  const { orderId } = req.params;

  // Verifica che l'utente possa accedere all'ordine
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true }
  });

  if (order.customer.id !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Get signed URL (valido 1 ora)
  const url = await invoiceService.getInvoiceUrl(orderId, 3600);

  res.json({ url });
}
```

---

## 📄 Formato Fattura PDF

```
┌─────────────────────────────────────────┐
│           FATTURA                       │
├─────────────────────────────────────────┤
│ Workspace Name                          │
│ Via Address 123                         │
│ P.IVA: IT12345678901                    │
│                                         │
│ Fattura N°: ORD-2024-001               │
│ Data: 15/01/2024                        │
│                                         │
│ Cliente:                                │
│ Mario Rossi                             │
│ mario@example.com                       │
│ +39 123 456 7890                        │
│                                         │
├─────────────────────────────────────────┤
│ Descrizione    Qtà  Prezzo    Totale   │
├─────────────────────────────────────────┤
│ Prodotto A      2   €50.00    €100.00  │
│ Servizio B      1   €30.00    €30.00   │
│                                         │
│                      Subtotale: €130.00 │
│                      IVA 22%:   €28.60  │
│                      TOTALE:    €158.60 │
└─────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Update Order model

```prisma
model Order {
  id           String   @id @default(cuid())
  orderNumber  String   @unique
  // ... existing fields
  
  // Invoice fields
  invoiceUrl   String?  // Public or signed URL
  invoiceKey   String?  // Storage key for deletion
  invoiceDate  DateTime? // When invoice was generated
  
  @@index([invoiceKey])
}
```

### Migration

```bash
# Create migration
npx prisma migrate dev --name add_invoice_fields

# SQL generated:
ALTER TABLE "Order" ADD COLUMN "invoiceUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "invoiceKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "invoiceDate" TIMESTAMP;
CREATE INDEX "Order_invoiceKey_idx" ON "Order"("invoiceKey");
```

---

## 🔄 Workflow Completo

### 1. Cliente completa ordine

```typescript
POST /api/orders/:id/complete

// Backend:
1. Valida pagamento
2. Update order status → COMPLETED
3. Genera fattura PDF
4. Upload su storage esterno (o local)
5. Salva URL in order.invoiceUrl
6. Invia email con link
```

### 2. Cliente scarica fattura

```typescript
GET /api/orders/:id/invoice

// Backend:
1. Verifica autorizzazione
2. Genera signed URL (scade 1h)
3. Return URL

// Frontend:
window.open(signedUrl) // Download PDF
```

### 3. Admin rigenera fattura

```typescript
POST /api/orders/:id/invoice/regenerate

// Backend:
1. Elimina vecchia fattura
2. Genera nuova fattura
3. Update order.invoiceUrl
4. Return nuovo URL
```

---

## 🔐 Sicurezza

### File privati con signed URLs

```typescript
// Fatture sono PRIVATE (isPublic: false)
const file = await storage.upload(pdfBuffer, {
  filename: `${orderNumber}.pdf`,
  folder: `invoices/${workspaceId}`,
  isPublic: false // ← IMPORTANTE
});

// URL diretta NON funziona:
// https://res.cloudinary.com/<cloud_name>/.../invoices/123/ORD-001.pdf
// → 403 Forbidden

// Serve signed URL:
const signedUrl = await storage.getUrl(file.key, 3600);
// https://res.cloudinary.com/<cloud_name>/.../invoices/123/ORD-001.pdf?signature=...
// → 200 OK (valido 1 ora)
```

### Autorizzazione

```typescript
// Solo il cliente o admin possono scaricare
export async function canAccessInvoice(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, workspace: true }
  });

  // Cliente proprietario
  if (order.customer.id === userId) return true;

  // Admin workspace
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user.workspaceId === order.workspaceId && user.role === 'ADMIN') {
    return true;
  }

  return false;
}
```

---

## 📧 Email Template

```typescript
import { sendEmail } from './email/EmailService';

async function sendInvoiceEmail(order: Order, invoiceUrl: string) {
  await sendEmail({
    to: order.customer.email,
    subject: `Fattura ordine ${order.orderNumber}`,
    html: `
      <h2>Grazie per il tuo acquisto!</h2>
      
      <p>Il tuo ordine <strong>${order.orderNumber}</strong> è stato completato.</p>
      
      <p>
        <a href="${invoiceUrl}" style="
          background: #4CAF50;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
        ">
          Scarica Fattura PDF
        </a>
      </p>
      
      <p><small>Il link scade tra 24 ore</small></p>
      
      <hr>
      
      <h3>Riepilogo Ordine</h3>
      <ul>
        ${order.items.map(item => `
          <li>${item.name} x${item.quantity} - €${item.total}</li>
        `).join('')}
      </ul>
      
      <p><strong>Totale: €${order.total}</strong></p>
    `
  });
}
```

---

## 🧹 Cleanup Scheduler

### Elimina fatture ordini cancellati

```typescript
// apps/scheduler/src/jobs/invoice-cleanup.ts

import cron from 'node-cron';
import { invoiceService } from '../../backend/src/services/invoice/InvoiceService';

export function setupInvoiceCleanup() {
  // Ogni notte alle 04:00
  cron.schedule('0 4 * * *', async () => {
    console.log('🧹 Starting invoice cleanup...');

    // Trova ordini cancellati con fattura
    const cancelledOrders = await prisma.order.findMany({
      where: {
        status: 'CANCELLED',
        invoiceKey: { not: null }
      }
    });

    let deleted = 0;
    for (const order of cancelledOrders) {
      await invoiceService.deleteInvoice(order.id);
      deleted++;
    }

    console.log(`✅ Deleted ${deleted} invoices from cancelled orders`);
  });
}
```

---

## 💰 Costi

### Storage

Valuta i costi in base al provider (Cloudinary o equivalente).

---

## 🧪 Testing

### Test generazione fattura

```typescript
import { invoiceService } from './services/invoice/InvoiceService';

describe('InvoiceService', () => {
  it('should generate invoice PDF', async () => {
    // Create test order
    const order = await prisma.order.create({
      data: {
        orderNumber: 'TEST-001',
        workspaceId: 'workspace-1',
        customerId: 'customer-1',
        total: 100,
        status: 'COMPLETED'
      }
    });

    // Generate invoice
    const url = await invoiceService.generateInvoice(order.id);

    // Verify
    expect(url).toBeDefined();
    expect(url).toContain('TEST-001.pdf');

    // Verify order updated
    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    });
    expect(updated.invoiceUrl).toBe(url);
    expect(updated.invoiceKey).toBeDefined();
  });
});
```

---

## 📦 Dipendenze

```bash
# Installa pdfkit per generazione PDF
npm install pdfkit
npm install --save-dev @types/pdfkit
```

```json
// package.json
{
  "dependencies": {
    "pdfkit": "^0.14.0"
  },
  "devDependencies": {
    "@types/pdfkit": "^0.13.0"
  }
}
```

---

## ✅ Implementation Checklist

- [ ] Installa pdfkit
- [ ] Crea InvoiceService
- [ ] Update Order model (invoiceUrl, invoiceKey)
- [ ] Prisma migration
- [ ] Integra in order completion flow
- [ ] Setup email template
- [ ] Test generazione PDF
- [ ] Test signed URLs
- [ ] Setup cleanup scheduler
- [ ] Deploy in production

---

## 🚀 Next Steps

1. **Implementa InvoiceService** (già fatto)
2. **Update database schema**
3. **Integra in order controller**
4. **Test in development**
5. **Deploy in production**
