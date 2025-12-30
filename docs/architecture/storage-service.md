# 📦 Storage Service - Unified File Management

## 🎯 Problema Risolto

**Prima**: Codice diverso per local e Cloudinary
```typescript
// Development
fs.writeFile('./uploads/file.jpg', buffer);

// Production
cloudinary.uploader.upload('/tmp/file.jpg', { folder: 'uploads' });
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
    └── CloudinaryAdapter (Production)
        └── Salva su Cloudinary
```

**Switch automatico** basato su `NODE_ENV`:
- `development` → Local filesystem
- `production` → Cloudinary

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
                       // https://res.cloudinary.com/<cloud_name>/... (prod)
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

// URL pubblico (o firmato dal provider se necessario)
const publicUrl = await storage.getUrl('private/doc.pdf', 3600);
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
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
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
  // https://res.cloudinary.com/<cloud_name>/.../workspaces/123-logo.png → workspaces/123-logo.png
  const key = oldUrl.split('/uploads/')[1] || oldUrl.split('.com/')[1];
  
  if (await storage.exists(key)) {
    await storage.delete(key);
  }
}
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

## ✅ Vantaggi

- ✅ **Stesso codice** per dev e prod
- ✅ **Switch automatico** basato su NODE_ENV
- ✅ **Facile testing** con mock
- ✅ **Type-safe** con TypeScript
- ✅ **Scalabile** (da local a Cloudinary senza cambiare codice)
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

// 3. Production (Cloudinary)
NODE_ENV=production npm start
// Storage: Cloudinary

// 4. Stesso codice!
const file = await storage.upload(buffer, { filename: 'logo.png' });
// Salva in: Cloudinary
// URL: https://res.cloudinary.com/<cloud_name>/.../logos/logo.png
```

---

## 🆘 Troubleshooting

### File non accessibile (403)

```typescript
// Usa signed URL per file privati
const url = await storage.getUrl('private/file.pdf', 3600);
```
