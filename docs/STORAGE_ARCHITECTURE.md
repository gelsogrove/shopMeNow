# 📦 Storage Architecture - File Management Strategy

## 🎯 Obiettivo

**Problema**: File salvati localmente non funzionano in produzione (EC2 effimero, scaling, backup)

**Soluzione**: Storage Service unificato con switch automatico Local/S3

---

## 🗂️ File da Gestire

### 1. **Fatture (PDF)** 🧾
```typescript
Tipo: Private
Storage: S3 (production) / Local (dev)
Access: Signed URLs (scadono dopo 1h)
Path: invoices/{workspaceId}/{orderId}.pdf
Retention: Permanente (legale)
Size: ~100KB per fattura
```

### 2. **Immagini Prodotti** 🛍️
```typescript
Tipo: Public
Storage: S3 + CloudFront CDN
Access: Public URLs
Path: products/{workspaceId}/{productId}.jpg
Retention: Finché prodotto esiste
Size: ~500KB per immagine
Cleanup: Quando prodotto eliminato
```

### 3. **Immagini Servizi** 🔧
```typescript
Tipo: Public
Storage: S3 + CloudFront CDN
Access: Public URLs
Path: services/{workspaceId}/{serviceId}.jpg
Retention: Finché servizio esiste
Size: ~500KB per immagine
Cleanup: Quando servizio eliminato
```

### 4. **Loghi Workspace** 🏢
```typescript
Tipo: Public
Storage: S3 + CloudFront CDN
Access: Public URLs
Path: workspaces/{workspaceId}/logo.png
Retention: Finché workspace esiste
Size: ~100KB per logo
Cleanup: Quando workspace eliminato
```

### 5. **Loghi Canali WhatsApp** 📱
```typescript
Tipo: Public
Storage: S3 + CloudFront CDN
Access: Public URLs
Path: channels/{workspaceId}/{channelId}/logo.png
Retention: Finché canale esiste
Size: ~100KB per logo
Cleanup: Quando canale eliminato
```

### 6. **File Temporanei** ⏱️
```typescript
Tipo: Temporary
Storage: S3 (temp folder)
Access: Private
Path: temp/{timestamp}-{random}.ext
Retention: 24 ore
Cleanup: Scheduler giornaliero
```

---

## 🏗️ Architettura Storage

```
┌─────────────────────────────────────────────────┐
│           Application Code                      │
│  (Products, Services, Workspaces, Channels)     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│         StorageService (Interface)              │
│  upload() / get() / delete() / exists()         │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│   Local      │  │     S3       │
│ (Dev only)   │  │ (Production) │
│ ./uploads/   │  │ AWS Bucket   │
└──────────────┘  └──────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  CloudFront  │
                  │     CDN      │
                  │  (Public)    │
                  └──────────────┘
```

---

## 🔄 Scheduler Cleanup Jobs

### Job 1: Orphaned Files Cleanup (Ogni notte 03:00)

```typescript
/**
 * Trova e elimina file non collegati al database
 */
async function cleanupOrphanedFiles() {
  const storage = getStorageService();
  
  // 1. Lista tutti i file S3
  const allFiles = await storage.list('products');
  
  // 2. Query database per file attivi
  const activeProducts = await prisma.product.findMany({
    select: { imageUrl: true }
  });
  const activeKeys = activeProducts.map(p => extractKey(p.imageUrl));
  
  // 3. Trova orfani
  const orphans = allFiles.filter(file => !activeKeys.includes(file));
  
  // 4. Elimina orfani
  for (const orphan of orphans) {
    await storage.delete(orphan);
    console.log(`🗑️ Deleted orphaned file: ${orphan}`);
  }
  
  return orphans.length;
}
```

### Job 2: Temporary Files Cleanup (Ogni ora)

```typescript
/**
 * Elimina file temporanei > 24 ore
 */
async function cleanupTempFiles() {
  const storage = getStorageService();
  const tempFiles = await storage.list('temp');
  
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 ore
  
  let deleted = 0;
  for (const file of tempFiles) {
    // Estrai timestamp dal nome file: temp/1234567890-abc.jpg
    const timestamp = parseInt(file.split('/')[1].split('-')[0]);
    const age = now - timestamp;
    
    if (age > maxAge) {
      await storage.delete(file);
      deleted++;
    }
  }
  
  console.log(`🗑️ Deleted ${deleted} temporary files`);
  return deleted;
}
```

### Job 3: Unused Files Report (Ogni settimana)

```typescript
/**
 * Report file non usati da > 30 giorni
 */
async function reportUnusedFiles() {
  const storage = getStorageService();
  
  // Query file non acceduti da 30 giorni
  // (richiede S3 access logs o CloudWatch)
  
  const report = {
    totalFiles: 0,
    totalSize: 0,
    unusedFiles: [],
    potentialSavings: 0
  };
  
  // Invia report via email
  await sendEmail({
    to: 'admin@echatbot.ai',
    subject: 'Storage Cleanup Report',
    body: JSON.stringify(report, null, 2)
  });
}
```

---

## 📅 Scheduler Configuration

```typescript
// apps/backend/src/scheduler/storage-cleanup.ts

import cron from 'node-cron';

export function setupStorageCleanup() {
  // Ogni notte alle 03:00
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 Starting orphaned files cleanup...');
    const deleted = await cleanupOrphanedFiles();
    console.log(`✅ Cleanup completed: ${deleted} files deleted`);
  });
  
  // Ogni ora
  cron.schedule('0 * * * *', async () => {
    console.log('🧹 Starting temp files cleanup...');
    const deleted = await cleanupTempFiles();
    console.log(`✅ Temp cleanup completed: ${deleted} files deleted`);
  });
  
  // Ogni domenica alle 00:00
  cron.schedule('0 0 * * 0', async () => {
    console.log('📊 Generating storage report...');
    await reportUnusedFiles();
    console.log('✅ Report sent');
  });
}
```

---

## 🔗 Database Schema Updates

### Tracking file metadata

```prisma
// packages/database/prisma/schema.prisma

model FileMetadata {
  id          String   @id @default(cuid())
  key         String   @unique // S3 key or local path
  url         String   // Public or signed URL
  type        FileType
  entityType  String   // "product", "service", "workspace", "channel", "invoice"
  entityId    String   // ID dell'entità collegata
  size        Int      // Bytes
  contentType String   // MIME type
  isPublic    Boolean  @default(false)
  uploadedAt  DateTime @default(now())
  lastAccess  DateTime @default(now())
  
  @@index([entityType, entityId])
  @@index([uploadedAt])
  @@index([lastAccess])
}

enum FileType {
  IMAGE
  PDF
  DOCUMENT
  TEMP
}
```

### Update existing models

```prisma
model Product {
  // ... existing fields
  imageUrl     String?
  imageKey     String? // S3 key for cleanup
  imageMetadataId String?
  imageMetadata FileMetadata? @relation(fields: [imageMetadataId], references: [id])
}

model Service {
  // ... existing fields
  imageUrl     String?
  imageKey     String?
  imageMetadataId String?
  imageMetadata FileMetadata? @relation(fields: [imageMetadataId], references: [id])
}

model Workspace {
  // ... existing fields
  logoUrl      String?
  logoKey      String?
  logoMetadataId String?
  logoMetadata FileMetadata? @relation(fields: [logoMetadataId], references: [id])
}

model Channel {
  // ... existing fields
  logoUrl      String?
  logoKey      String?
  logoMetadataId String?
  logoMetadata FileMetadata? @relation(fields: [logoMetadataId], references: [id])
}
```

---

## 🔄 Migration Strategy

### Phase 1: Add Storage Service (Non-breaking)

```bash
# 1. Crea storage service
# 2. Mantieni codice esistente funzionante
# 3. Test in development
```

### Phase 2: Update Upload Logic

```typescript
// Prima (esempio Product)
const imagePath = path.join('./uploads', filename);
await fs.writeFile(imagePath, buffer);
product.imageUrl = `/uploads/${filename}`;

// Dopo
const storage = getStorageService();
const file = await storage.upload(buffer, {
  filename: `${product.id}.jpg`,
  folder: `products/${workspace.id}`,
  contentType: 'image/jpeg',
  isPublic: true
});

// Salva metadata
const metadata = await prisma.fileMetadata.create({
  data: {
    key: file.key,
    url: file.url,
    type: 'IMAGE',
    entityType: 'product',
    entityId: product.id,
    size: file.size,
    contentType: file.contentType,
    isPublic: true
  }
});

product.imageUrl = file.url;
product.imageKey = file.key;
product.imageMetadataId = metadata.id;
```

### Phase 3: Migrate Existing Files

```typescript
// Script migrazione
async function migrateExistingFiles() {
  const storage = getStorageService();
  
  // Prodotti
  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } }
  });
  
  for (const product of products) {
    if (product.imageUrl?.startsWith('/uploads/')) {
      // File locale, upload su S3
      const localPath = path.join('./uploads', product.imageUrl.replace('/uploads/', ''));
      const buffer = await fs.readFile(localPath);
      
      const file = await storage.upload(buffer, {
        filename: `${product.id}.jpg`,
        folder: `products/${product.workspaceId}`,
        contentType: 'image/jpeg',
        isPublic: true
      });
      
      await prisma.product.update({
        where: { id: product.id },
        data: {
          imageUrl: file.url,
          imageKey: file.key
        }
      });
      
      console.log(`✅ Migrated product ${product.id}`);
    }
  }
}
```

### Phase 4: Enable Cleanup Jobs

```bash
# Attiva scheduler
npm run scheduler
```

---

## 💰 Cost Estimation

### Storage Costs (S3)

```
Scenario: 1000 workspaces, 10 prodotti ciascuno

Files:
- 1000 workspace logos (100KB) = 100MB
- 10000 product images (500KB) = 5GB
- 1000 invoices/mese (100KB) = 100MB/mese
Total: ~5.2GB

S3 Storage: 5.2GB × €0.023/GB = €0.12/mese
S3 Requests: 
  - Upload: 1000/mese × €0.005/1000 = €0.005
  - Download: 100K/mese × €0.0004/1000 = €0.04
CloudFront: 10GB transfer × €0.085/GB = €0.85/mese

Total: ~€1/mese
```

### Cleanup Savings

```
Senza cleanup: +500MB/mese file orfani = +€0.01/mese
Con cleanup: File orfani eliminati = €0 extra

Risparmio annuale: €0.12 (minimo ma importante per scalabilità)
```

---

## 🛡️ Security & Compliance

### File Privati (Fatture)

```typescript
// Upload fattura
const file = await storage.upload(pdfBuffer, {
  filename: `${orderId}.pdf`,
  folder: `invoices/${workspaceId}`,
  contentType: 'application/pdf',
  isPublic: false // ← IMPORTANTE
});

// Get signed URL (scade dopo 1 ora)
const signedUrl = await storage.getUrl(file.key, 3600);

// Invia email con link
await sendEmail({
  to: customer.email,
  subject: 'La tua fattura',
  body: `Scarica la fattura: ${signedUrl}`
});
```

### File Pubblici (Immagini)

```typescript
// Upload logo
const file = await storage.upload(imageBuffer, {
  filename: 'logo.png',
  folder: `workspaces/${workspaceId}`,
  contentType: 'image/png',
  isPublic: true // ← Accessibile da CDN
});

// URL pubblico permanente
workspace.logoUrl = file.url;
```

---

## 📊 Monitoring

### CloudWatch Metrics

```typescript
// Track storage usage
await cloudwatch.putMetricData({
  Namespace: 'eChatbot/Storage',
  MetricData: [{
    MetricName: 'FilesUploaded',
    Value: 1,
    Unit: 'Count',
    Dimensions: [
      { Name: 'FileType', Value: 'product_image' },
      { Name: 'WorkspaceId', Value: workspaceId }
    ]
  }]
});
```

### Alerts

```
- Storage > 10GB → Email alert
- Orphaned files > 100 → Email alert
- Upload failures > 10/hour → Email alert
```

---

## ✅ Implementation Checklist

- [ ] Crea Storage Service (interface + adapters)
- [ ] Aggiungi FileMetadata model a Prisma
- [ ] Update Product upload logic
- [ ] Update Service upload logic
- [ ] Update Workspace upload logic
- [ ] Update Channel upload logic
- [ ] Update Invoice generation
- [ ] Crea cleanup jobs scheduler
- [ ] Migra file esistenti da local a S3
- [ ] Test cleanup jobs
- [ ] Setup CloudWatch monitoring
- [ ] Deploy in production
- [ ] Verifica backup S3

---

## 🚀 Next Steps

1. **Review architettura** con team
2. **Implementa Storage Service** (già fatto)
3. **Update database schema** (Prisma migration)
4. **Implementa cleanup scheduler**
5. **Migra file esistenti**
6. **Deploy e monitor**
