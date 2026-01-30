# Invoice System Refactoring - On-Demand PDF Generation

## 🎯 Obiettivo
Tutte le fatture (Order Invoices + Monthly Invoices) vengono generate **on-demand** senza storage fisico.

## 📊 Prima del Refactoring

### Order Invoices (vecchio):
- PDF generato e salvato su Cloudinary/filesystem
- Referenze in DB: `orders.invoiceUrl`, `orders.invoiceKey`, `orders.invoiceDate`
- Scheduler cleanup per fatture di ordini cancellati

### Monthly Invoices (nuovo):
- ✅ Già on-demand (PDF generato al volo)
- ✅ Solo dati in DB (`monthlyInvoice` table)

## 📊 Dopo il Refactoring

### Order Invoices (refactored):
- ✅ PDF generato on-demand
- ✅ NO storage fisico
- ✅ Metodo: `invoiceService.generateInvoicePdf(orderId)` → Buffer

### Monthly Invoices:
- ✅ Invariato (già on-demand)

## 🔧 Modifiche Implementate

### 1. **Order Invoice Service** (`backend/src/services/invoice/InvoiceService.ts`)
```typescript
// PRIMA:
async generateInvoice(orderId: string): Promise<string> {
  const pdfBuffer = await this.createPDF(invoiceData)
  const file = await storage.upload(pdfBuffer, {...}) // ❌ Salva su storage
  return file.url
}

// DOPO:
async generateInvoicePdf(orderId: string): Promise<Buffer> {
  const pdfBuffer = await this.createPDF(invoiceData)
  return pdfBuffer // ✅ Restituisce Buffer direttamente
}
```

### 2. **Scheduler Cleanup** (`apps/scheduler/src/jobs/unused-images-cleanup.job.ts`)
- ❌ Rimossa sezione "CANCELLED INVOICE CLEANUP"
- ✅ Aggiunto commento: "Invoices are now generated on-demand"

### 3. **Cleanup Script** (`backend/scripts/cleanup-existing-invoices.ts`)
- Script one-time per cancellare invoice esistenti
- Cancella file da Cloudinary (prod) o filesystem (dev)
- Pulisce campi DB: `invoiceUrl = NULL`, `invoiceKey = NULL`, `invoiceDate = NULL`

## 🚀 Come Eseguire il Cleanup

### Produzione (Cloudinary):
```bash
cd apps/backend
CLOUDINARY_URL=cloudinary://... npx ts-node scripts/cleanup-existing-invoices.ts
```

### Development (Local):
```bash
cd apps/backend
npx ts-node scripts/cleanup-existing-invoices.ts
```

## 📝 Note per Controller/API

Se hai endpoint che usano il vecchio metodo, aggiornali:

```typescript
// PRIMA:
const invoiceUrl = await invoiceService.generateInvoice(orderId)
res.json({ invoiceUrl })

// DOPO:
const pdfBuffer = await invoiceService.generateInvoicePdf(orderId)
res.setHeader('Content-Type', 'application/pdf')
res.setHeader('Content-Disposition', `attachment; filename=${orderCode}.pdf`)
res.send(pdfBuffer)
```

## ✅ Vantaggi

1. **Zero storage costs** per invoice
2. **Sempre aggiornate**: PDF generato con dati correnti
3. **Nessun cleanup necessario**: non ci sono file orfani
4. **Consistenza**: stesso pattern per Order e Monthly Invoices

## 🧪 Testing

Non ci sono test da aggiornare per Order Invoices (non esistevano test specifici).
Test Monthly Invoices rimangono invariati (già on-demand).

## 📚 Riferimenti

- Feature 197: Monthly Invoice Management
- Invoice Service: `backend/src/application/services/invoice.service.ts` (Monthly)
- Invoice Service: `backend/src/services/invoice/InvoiceService.ts` (Orders - refactored)
