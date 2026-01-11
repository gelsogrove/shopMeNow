# Legal Documents System - Architecture

## 🎯 Purpose

System for managing **GLOBAL** legal documents for the **eCHATBOT PLATFORM**.

### What It Is
- GDPR compliance document (data protection for eCHATBOT)
- Privacy Policy (how eCHATBOT handles user data)
- Terms of Service (user agreement with eCHATBOT)
- Refund Policy (eCHATBOT's refund procedures)

### What It's NOT
- ❌ NOT for customer workspace terms
- ❌ NOT per-workspace legal documents
- ❌ NOT for individual business policies

**CRITICAL**: These documents describe the **eCHATBOT SaaS platform** terms, not customer terms!

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ECHATBOT PLATFORM                        │
│                   (Global Legal Docs)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ One set of docs
                              ▼
                    ┌──────────────────┐
                    │  LegalDocument   │
                    │  (Database)      │
                    │                  │
                    │  • GDPR          │
                    │  • PRIVACY       │
                    │  • TERMS         │
                    │  • REFUND        │
                    └──────────────────┘
                              │
                              │ Public Read
                              │ Admin Write
                              ▼
            ┌─────────────────────────────────┐
            │                                 │
            ▼                                 ▼
    ┌──────────────┐              ┌──────────────────┐
    │   Frontend   │              │   Backoffice     │
    │   (Public)   │              │ (Platform Admin) │
    │              │              │                  │
    │  Footer:     │              │  Edit:           │
    │  - GDPR      │              │  - Update HTML   │
    │  - Privacy   │              │  - 4 languages   │
    │  - Terms     │              │  - Activate      │
    │  - Refund    │              │                  │
    └──────────────┘              └──────────────────┘
```

---

## 🔄 Data Flow

### Public Read (GET)
```
User clicks "Privacy Policy" in footer
          ↓
GET /api/legal-documents/PRIVACY_POLICY?lang=it
          ↓
No authentication required (PUBLIC)
          ↓
Controller.getLegalDocument()
          ↓
Service.getLegalDocumentByLanguage(type, lang)
          ↓
Prisma: findUnique({ where: { type } })
          ↓
Return { title, content, isActive }
          ↓
Frontend displays HTML content
```

### Admin Update (PUT)
```
Platform admin edits GDPR in backoffice
          ↓
PUT /api/legal-documents/GDPR
Authorization: Bearer <platform_admin_token>
          ↓
authMiddleware: Verify JWT, load user
          ↓
platformAdminMiddleware: Check isPlatformAdmin = true
          ↓
Controller.updateLegalDocument()
          ↓
Service: Validate HTML content
          ↓
Prisma: update({ where: { type }, data })
          ↓
Log: "✅ GLOBAL legal document updated: GDPR"
          ↓
Return updated document
```

---

## 📊 Database Schema

```prisma
model LegalDocument {
  id        String   @id @default(cuid())
  type      String   @unique  // Global singleton per type
  
  // Multilingual titles
  titleIt   String
  titleEn   String
  titleEs   String
  titlePt   String
  
  // Multilingual content (HTML)
  contentIt String   @db.Text
  contentEn String   @db.Text
  contentEs String   @db.Text
  contentPt String   @db.Text
  
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("legal_documents")
}
```

### Key Features
- **Global**: No `workspaceId` field - documents are platform-wide
- **Unique Type**: Only ONE document per type (GDPR, PRIVACY, etc.)
- **Multilingual**: 4 languages (IT, EN, ES, PT)
- **HTML Content**: Stored as TEXT for rich formatting

---

## 🛠️ API Endpoints

### GET /api/legal-documents
**Description**: Get all legal documents  
**Auth**: None (PUBLIC)  
**Response**:
```json
[
  {
    "id": "clx...",
    "type": "GDPR",
    "titleIt": "Informativa GDPR",
    "titleEn": "GDPR Notice",
    "contentIt": "<h1>GDPR...</h1>",
    "contentEn": "<h1>GDPR...</h1>",
    "isActive": true
  },
  ...
]
```

### GET /api/legal-documents/:type?lang=:lang
**Description**: Get specific document by type and language  
**Auth**: None (PUBLIC)  
**Parameters**:
- `type`: GDPR | PRIVACY_POLICY | TERMS_OF_SERVICE | REFUND_POLICY
- `lang`: it | en | es | pt (default: it)

**Response**:
```json
{
  "type": "GDPR",
  "title": "Informativa GDPR",
  "content": "<h1>Informativa sulla protezione dei dati...</h1>",
  "isActive": true
}
```

### PUT /api/legal-documents/:type
**Description**: Update legal document (PLATFORM ADMIN ONLY)  
**Auth**: JWT + Platform Admin  
**Request**:
```json
{
  "titleIt": "Nuovo Titolo",
  "titleEn": "New Title",
  "contentIt": "<h1>Nuovo contenuto...</h1>",
  "contentEn": "<h1>New content...</h1>",
  "isActive": true
}
```

**Response**:
```json
{
  "id": "clx...",
  "type": "GDPR",
  "titleIt": "Nuovo Titolo",
  ...
}
```

---

## 🔒 Security Model

### Access Levels

| User Type | Read | Write | Middleware |
|-----------|------|-------|------------|
| Public (no auth) | ✅ | ❌ | None |
| Regular User | ✅ | ❌ | authMiddleware |
| Workspace Admin | ✅ | ❌ | workspaceAdminMiddleware |
| Platform Admin | ✅ | ✅ | platformAdminMiddleware |

### Security Layers (PUT)
1. **authMiddleware**: Validate JWT token
2. **platformAdminMiddleware**: Check `isPlatformAdmin = true`

### Why NO Workspace Context?
- These documents are for **eCHATBOT platform**, not workspaces
- Workspace admins manage their **business data**, not platform terms
- Platform admins manage **eCHATBOT legal compliance**

---

## 📁 File Structure

```
apps/backend/src/
├── application/services/
│   └── legal-document.service.ts         # Business logic
├── interfaces/http/
│   ├── controllers/
│   │   └── legal-document.controller.ts  # Request handling
│   ├── routes/
│   │   └── legal-documents.routes.ts     # Route definitions
│   └── middlewares/
│       └── platformAdmin.middleware.ts   # Security
└── routes/
    └── index.ts                          # Mount: /api/legal-documents

apps/backoffice/src/
├── pages/
│   └── LawsDocumentsPage.tsx             # Admin UI
└── components/legal-documents/
    └── LegalDocumentEditDialog.tsx       # Edit form

packages/database/prisma/
└── schema.prisma                         # Database schema
```

---

## 🧪 Testing

### Unit Tests
```typescript
// Test service validates type
expect(() => service.getLegalDocument("INVALID_TYPE")).toThrow()

// Test service validates HTML
expect(() => service.updateLegalDocument("GDPR", {
  contentIt: "<script>alert('xss')</script>"
})).toThrow()
```

### Integration Tests
```typescript
// Test public read access
const res = await request(app).get("/api/legal-documents/GDPR")
expect(res.status).toBe(200)

// Test unauthorized update
const res = await request(app)
  .put("/api/legal-documents/GDPR")
  .send({ contentIt: "New" })
expect(res.status).toBe(401)

// Test non-platform-admin update
const res = await request(app)
  .put("/api/legal-documents/GDPR")
  .set("Authorization", `Bearer ${regularUserToken}`)
  .send({ contentIt: "New" })
expect(res.status).toBe(403)

// Test platform admin update
const res = await request(app)
  .put("/api/legal-documents/GDPR")
  .set("Authorization", `Bearer ${platformAdminToken}`)
  .send({ contentIt: "New" })
expect(res.status).toBe(200)
```

---

## 🚀 Deployment

### Migration
```bash
cd packages/database
npx prisma migrate dev --name remove_workspace_from_legal_documents
npx prisma generate
```

### Seed Data
```bash
npm run seed
# Creates 4 documents (GDPR, PRIVACY, TERMS, REFUND)
# Each with 4 languages (IT, EN, ES, PT)
```

### Environment Variables
```bash
# No special env vars needed
# Uses standard DATABASE_URL
```

---

## 📈 Future Enhancements

### Versioning
```prisma
model LegalDocumentVersion {
  id          String   @id @default(cuid())
  documentId  String
  version     Int
  contentIt   String   @db.Text
  createdBy   String
  createdAt   DateTime @default(now())
}
```

### Audit Log
```prisma
model LegalDocumentAudit {
  id          String   @id @default(cuid())
  documentId  String
  userId      String
  action      String   // "UPDATE"
  changes     Json
  ipAddress   String?
  createdAt   DateTime @default(now())
}
```

### Email Notifications
- Notify platform admins when legal docs are updated
- Optionally notify users of Terms of Service changes

### Acceptance Tracking
```prisma
model LegalDocumentAcceptance {
  id            String   @id @default(cuid())
  userId        String
  documentType  String
  version       Int
  acceptedAt    DateTime @default(now())
  ipAddress     String?
}
```

---

## 🆘 Troubleshooting

### Documents Not Loading
1. Check database has seeded documents: `npm run seed`
2. Verify route is registered in `routes/index.ts`
3. Check backend logs for errors

### Can't Update Documents
1. Verify user has `isPlatformAdmin = true` in database
2. Check JWT token is valid
3. Verify middleware stack order (auth → platform admin)

### Wrong Language Displayed
1. Check `?lang=XX` query parameter
2. Verify language code is valid (it/en/es/pt)
3. Check document has content in that language

---

## 📚 Related Documentation

- [Security Details](../security/legal-documents-security.md)
- [API Routes](../../apps/backend/src/interfaces/http/routes/legal-documents.routes.ts)
- [Database Schema](../../packages/database/prisma/schema.prisma)
- [Platform Admin Middleware](../../apps/backend/src/interfaces/http/middlewares/platformAdmin.middleware.ts)

---

**Created**: 2026-01-09  
**Author**: Andrea & GitHub Copilot  
**Status**: ✅ Production Ready
