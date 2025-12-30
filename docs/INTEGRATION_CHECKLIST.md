# ✅ Integration Checklist - Storage Service

## 📋 Modifiche da fare al codice esistente

### 1️⃣ **Product Controller** 
File: `apps/backend/src/interfaces/http/controllers/product.controller.ts`

**Modifiche**:
```typescript
// Aggiungi import
import { getStorageService } from '../../../services/storage';

// Nel createProduct - sostituisci upload locale con:
const storage = getStorageService();
const file = await storage.upload(req.file.buffer, {
  filename: `${productId}.jpg`,
  folder: `products/${workspaceId}`,
  contentType: 'image/jpeg',
  isPublic: true
});

// Salva nel DB
await prisma.products.create({
  data: {
    ...productData,
    imageUrl: [file.url],
    imageKey: file.key  // ← NUOVO
  }
});

// Nel updateProduct - quando cambi immagine:
if (oldImageKey) {
  await storage.delete(oldImageKey);
}

// Nel deleteProduct - elimina immagine:
if (product.imageKey) {
  await storage.delete(product.imageKey);
}
```

### 2️⃣ **Service Controller**
File: `apps/backend/src/interfaces/http/controllers/service.controller.ts`

**Stesse modifiche del Product Controller**

### 3️⃣ **Workspace Controller**
File: `apps/backend/src/interfaces/http/controllers/workspace.controller.ts`

**Modifiche per logo upload**:
```typescript
import { getStorageService } from '../../../services/storage';

// Upload logo
const storage = getStorageService();
const file = await storage.upload(req.file.buffer, {
  filename: `${workspaceId}-logo.png`,
  folder: `workspaces/${workspaceId}`,
  contentType: 'image/png',
  isPublic: true
});

await prisma.workspace.update({
  where: { id: workspaceId },
  data: {
    logoUrl: file.url,
    logoKey: file.key  // ← NUOVO
  }
});
```

### 4️⃣ **Order Controller - Genera Fattura**
File: `apps/backend/src/interfaces/http/controllers/order.controller.ts`

**Aggiungi**:
```typescript
import { invoiceService } from '../../../services/invoice/InvoiceService';

// Quando ordine completato
export async function completeOrder(req: Request, res: Response) {
  const { orderId } = req.params;
  
  // 1. Completa ordine
  await prisma.orders.update({
    where: { id: orderId },
    data: { status: 'COMPLETED' }
  });
  
  // 2. Genera fattura
  const invoiceUrl = await invoiceService.generateInvoice(orderId);
  
  // 3. Invia email (opzionale)
  await sendEmail({
    to: order.customer.email,
    subject: `Fattura ordine ${order.orderCode}`,
    body: `Scarica la tua fattura: ${invoiceUrl}`
  });
  
  res.json({ success: true, invoiceUrl });
}

// Endpoint download fattura
export async function downloadInvoice(req: Request, res: Response) {
  const { orderId } = req.params;
  
  // Get signed URL (valido 1 ora)
  const url = await invoiceService.getInvoiceUrl(orderId, 3600);
  
  res.json({ url });
}
```

---

## 🔧 File da modificare (lista completa)

### Controllers:
- [x] `product.controller.ts` - Upload/delete immagini prodotti ✅
- [x] `services.controller.ts` - Upload/delete immagini servizi ✅
- [x] `workspace.controller.ts` - Upload/delete logo workspace ✅
- [x] `order.controller.ts` - Genera fatture ✅ (già presente endpoint `/orders/:orderCode/invoice`)

### Routes:
- [x] `order.routes.ts` - Endpoint `/orders/:id/invoice` già presente ✅

### Domain & Repository:
- [x] `product.entity.ts` - Aggiunto `imageKey` field ✅
- [x] `workspace.entity.ts` - Aggiunto `logoKey` field ✅
- [x] `product.repository.ts` - Aggiunto mapping `imageKey` ✅
- [x] `workspace.service.ts` - Aggiunto `logoKey` all'interface ✅

### Environment:
- [ ] `.env` locale - Aggiungi `CLOUDINARY_URL` (prod) o `UPLOADS_DIR` (local)
- [ ] GitHub Secrets - Aggiungi `CLOUDINARY_URL` se necessario

---

## 🚀 Testing Checklist

### Development (Local):
- [ ] Upload immagine prodotto → Salva in `./uploads/products/`
- [ ] Delete prodotto → Elimina da `./uploads/products/`
- [ ] Genera fattura → Salva in `./uploads/invoices/`
- [ ] Scheduler cleanup → Elimina file orfani da `./uploads/`

### Production:
- [ ] Upload immagine prodotto → Salva su storage esterno
- [ ] Delete prodotto → Elimina da storage esterno
- [ ] Genera fattura → Salva su storage esterno
- [ ] Scheduler cleanup → Elimina file orfani

---

## 📝 Migration Database

```bash
# Quando avvii il database
cd packages/database
npx prisma migrate dev --name add_invoice_and_storage_fields

# Genera Prisma client
npx prisma generate
```

---

## 🎯 Priority Order

1. **ALTA** - Database migration (serve per tutto)
2. **ALTA** - Product upload (più usato)
3. **MEDIA** - Service upload
4. **MEDIA** - Workspace logo
5. **MEDIA** - Invoice generation
6. **BASSA** - Scheduler (già fatto, solo testare)

---

## 💡 Note Implementazione

### Pattern da seguire:

```typescript
// 1. Import storage service
import { getStorageService } from '../../../services/storage';

// 2. Get instance
const storage = getStorageService();

// 3. Upload
const file = await storage.upload(buffer, {
  filename: 'name.jpg',
  folder: 'products/workspace-id',
  contentType: 'image/jpeg',
  isPublic: true
});

// 4. Save to DB
await prisma.products.update({
  data: {
    imageUrl: [file.url],
    imageKey: file.key  // ← Per cleanup
  }
});

// 5. Delete old (se update)
if (oldImageKey) {
  await storage.delete(oldImageKey);
}
```

### Error Handling:

```typescript
try {
  const file = await storage.upload(buffer, options);
} catch (error) {
  logger.error('Upload failed:', error);
  return res.status(500).json({ 
    error: 'File upload failed' 
  });
}
```

---

## ✅ Quando tutto è fatto

- [ ] Tutti i controller aggiornati
- [ ] Database migration eseguita
- [ ] Test local funzionanti
- [ ] Terraform apply (solo se usi Terraform)
- [ ] Test production funzionanti
- [ ] Scheduler attivo
- [ ] Documentazione aggiornata

---

## 🆘 Troubleshooting

### Errore: "Storage service not found"
```bash
# Verifica import
import { getStorageService } from '../../../services/storage';
```

### Errore: "Storage credentials not found"
```bash
# Verifica .env
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
```
