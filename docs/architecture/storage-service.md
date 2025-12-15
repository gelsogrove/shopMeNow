# 📦 Storage Service - Unified File Management

## 🎯 Problema Risolto

**Prima**: Codice diverso per local e S3
```typescript
// Development
fs.writeFile('./uploads/file.jpg', buffer);

// Production
s3.upload({ Bucket: 'bucket', Key: 'file.jpg', Body: buffer });
```

**Dopo**: Stesso codice ovunque
```typescript
// Development E Production
await storage.upload(buffer, { filename: 'file.jpg' });
```

---

## 🏗️ Architettura

```
StorageService (Interface)
    ↓
    ├── LocalStorageAdapter (Development)
    │   └── Salva in ./uploads/
    │
    └── S3StorageAdapter (Production)
        └── Salva in S3 bucket
```

**Switch automatico** basato su `NODE_ENV`:
- `development` → Local filesystem
- `production` → AWS S3

---

## 🚀 Utilizzo

### Setup

```typescript
import { getStorageService } from './services/storage';

const storage = getStorageService();
```

### Upload file

```typescript
// Da buffer
const file = await storage.upload(buffer, {
  filename: 'logo.png',
  folder: 'logos',
  contentType: 'image/png',
  isPublic: true
});

console.log(file.url); // http://localhost:3001/uploads/logos/logo.png (dev)
                       // https://echatbot-uploads.s3.eu-west-1.amazonaws.com/logos/logo.png (prod)
```

### Upload da path

```typescript
const file = await storage.uploadFromPath('/tmp/upload.jpg', {
  filename: 'product.jpg',
  folder: 'products'
});
```

### Get file

```typescript
const buffer = await storage.get('logos/logo.png');
```

### Get URL

```typescript
// Public URL (se isPublic: true)
const url = await storage.getUrl('logos/logo.png');

// Signed URL (scade dopo 1 ora)
const signedUrl = await storage.getUrl('private/doc.pdf', 3600);
```

### Delete file

```typescript
await storage.delete('logos/old-logo.png');
```

### Check exists

```typescript
const exists = await storage.exists('logos/logo.png');
```

### List files

```typescript
const files = await storage.list('logos');
// ['logos/logo1.png', 'logos/logo2.png']
```

---

## 🔧 Configurazione

### Development (.env)

```env
NODE_ENV=development
UPLOADS_DIR=./uploads
UPLOADS_URL=http://localhost:3001/uploads
```

### Production (.env)

```env
NODE_ENV=production
AWS_S3_BUCKET=echatbot-uploads-prod
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIAQC4U3MGFIUTN4JHJ
AWS_SECRET_ACCESS_KEY=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
```

---

## 📝 Esempi Pratici

### Upload logo workspace

```typescript
import { getStorageService } from './services/storage';
import { Request, Response } from 'express';

export async function uploadWorkspaceLogo(req: Request, res: Response) {
  const storage = getStorageService();
  const workspaceId = req.params.workspaceId;
  
  // Multer buffer
  const buffer = req.file!.buffer;
  
  // Upload
  const file = await storage.upload(buffer, {
    filename: `${workspaceId}-logo.png`,
    folder: 'workspaces',
    contentType: 'image/png',
    isPublic: true
  });
  
  // Salva URL nel database
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { logoUrl: file.url }
  });
  
  res.json({ url: file.url });
}
```

### Upload product image

```typescript
export async function uploadProductImage(productId: string, buffer: Buffer) {
  const storage = getStorageService();
  
  const file = await storage.upload(buffer, {
    filename: `${productId}.jpg`,
    folder: 'products',
    contentType: 'image/jpeg',
    isPublic: true
  });
  
  await prisma.product.update({
    where: { id: productId },
    data: { imageUrl: file.url }
  });
  
  return file.url;
}
```

### Delete old logo

```typescript
export async function deleteOldLogo(oldUrl: string) {
  const storage = getStorageService();
  
  // Estrai key da URL
  // http://localhost:3001/uploads/workspaces/123-logo.png → workspaces/123-logo.png
  // https://bucket.s3.amazonaws.com/workspaces/123-logo.png → workspaces/123-logo.png
  const key = oldUrl.split('/uploads/')[1] || oldUrl.split('.com/')[1];
  
  if (await storage.exists(key)) {
    await storage.delete(key);
  }
}
```

---

## 🔄 Migrazione da Local a S3

### Step 1: Sync files esistenti

```bash
# Copia tutti i file locali su S3
aws s3 sync ./uploads s3://echatbot-uploads-prod/
```

### Step 2: Update database URLs

```typescript
// Script migrazione
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateUrls() {
  const workspaces = await prisma.workspace.findMany({
    where: { logoUrl: { startsWith: 'http://localhost' } }
  });
  
  for (const workspace of workspaces) {
    const key = workspace.logoUrl.split('/uploads/')[1];
    const newUrl = `https://echatbot-uploads-prod.s3.eu-west-1.amazonaws.com/${key}`;
    
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { logoUrl: newUrl }
    });
  }
  
  console.log(`✅ Migrated ${workspaces.length} workspace logos`);
}

migrateUrls();
```

---

## 💰 Costi S3

```
Storage:     €0.023/GB/mese
Requests:    €0.0004 per 1000 GET
             €0.005 per 1000 PUT
Transfer:    €0.09/GB (primi 10TB)

Esempio (1000 immagini, 500KB ciascuna):
- Storage: 500MB = €0.01/mese
- Upload: 1000 PUT = €0.005
- Download: 10GB = €0.90/mese
Totale: ~€1/mese
```

---

## 🛡️ Sicurezza

### Public files (logos, product images)

```typescript
await storage.upload(buffer, {
  isPublic: true  // Accessibile senza autenticazione
});
```

### Private files (documenti, fatture)

```typescript
await storage.upload(buffer, {
  isPublic: false  // Richiede signed URL
});

// Get signed URL (scade dopo 1 ora)
const url = await storage.getUrl('private/invoice.pdf', 3600);
```

---

## 🧪 Testing

### Mock per test

```typescript
import { IStorageService, StorageFile } from './services/storage';

class MockStorageAdapter implements IStorageService {
  private files = new Map<string, Buffer>();
  
  async upload(buffer: Buffer, options: any): Promise<StorageFile> {
    const key = `${options.folder}/${options.filename}`;
    this.files.set(key, buffer);
    return {
      url: `http://mock/${key}`,
      key,
      size: buffer.length,
      contentType: options.contentType
    };
  }
  
  async get(key: string): Promise<Buffer> {
    return this.files.get(key)!;
  }
  
  // ... altri metodi
}

// Nei test
const storage = new MockStorageAdapter();
```

---

## 📦 Dipendenze

```bash
# Installa AWS SDK
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

```json
// package.json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.450.0",
    "@aws-sdk/s3-request-presigner": "^3.450.0"
  }
}
```

---

## ✅ Vantaggi

- ✅ **Stesso codice** per dev e prod
- ✅ **Switch automatico** basato su NODE_ENV
- ✅ **Facile testing** con mock
- ✅ **Type-safe** con TypeScript
- ✅ **Scalabile** (da local a S3 senza cambiare codice)
- ✅ **Signed URLs** per file privati
- ✅ **Public URLs** per file pubblici

---

## 🔄 Workflow Completo

```typescript
// 1. Development (local)
NODE_ENV=development npm run dev
// Storage: Local (dir: ./uploads)

// 2. Upload file
const file = await storage.upload(buffer, { filename: 'logo.png' });
// Salva in: ./uploads/logos/logo.png
// URL: http://localhost:3001/uploads/logos/logo.png

// 3. Production (S3)
NODE_ENV=production npm start
// Storage: S3 (bucket: echatbot-uploads-prod)

// 4. Stesso codice!
const file = await storage.upload(buffer, { filename: 'logo.png' });
// Salva in: S3 bucket
// URL: https://echatbot-uploads-prod.s3.eu-west-1.amazonaws.com/logos/logo.png
```

---

## 🆘 Troubleshooting

### Errore: AWS credentials not found

```bash
# Verifica .env
AWS_ACCESS_KEY_ID=AKIAQC4U3MGFIUTN4JHJ
AWS_SECRET_ACCESS_KEY=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
```

### Errore: Bucket does not exist

```bash
# Crea bucket S3
aws s3 mb s3://echatbot-uploads-prod --region eu-west-1
```

### File non accessibile (403)

```typescript
// Usa signed URL per file privati
const url = await storage.getUrl('private/file.pdf', 3600);
```
