# ShopMe Project Requirements Document (PRD)

> **⚠️ NOTE**: QueryAnalyzer Agent and Translation Agent were removed on November 10, 2025.  
> See `docs/other/DEPRECATED_QueryAnalyzer.md` for historical reference.  
> Current architecture: **6 Agents** (Router, ProductSearch, Cart, OrderTracking, CustomerSupport, Safety&Translation)

## 🏗️ Current Multi-Agent Architecture (November 10, 2025)

### **6-Agent System**

```
Router Agent (order: 0) 🎯
├── Product Search Agent (order: 2) 🔍
├── Cart Management Agent (order: 3) 🛒
├── Order Tracking Agent (order: 4) 📦
├── Customer Support Agent (order: 5) 💬
└── Safety & Translation Agent (order: 99) 🔒 ← ALWAYS LAST
```

**Agent Types** (from `schema.prisma`):

- ✅ `ROUTER` (order: 0) - Intent routing
- ✅ `PRODUCT_SEARCH` (order: 2) - Product discovery
- ✅ `CART_MANAGEMENT` (order: 3) - Cart operations
- ✅ `ORDER_TRACKING` (order: 4) - Order status
- ✅ `CUSTOMER_SUPPORT` (order: 5) - Customer service
- ✅ `SAFETY_TRANSLATION` (order: 99) - Final translation + safety check

**Removed Agents** (November 10, 2025):

- ❌ `QUERY_ANALYZER` (order: 6) - Replaced by direct RAG integration
- ❌ `TRANSLATION` (order: -1) - Merged into Safety&Translation

### **Centralized Services**

**Link Generation**:

- `LinkGeneratorService` (`application/services/link-generator.service.ts`)
- `SecureTokenService` - Time-limited JWT tokens
- `UrlShortenerService` - Creates `/s/xxx` short URLs

**Token Management**:

- `SecureTokenService` - Generates secure access tokens
- Used by all public links (checkout, orders, profile)

**Translation & Safety**:

- `SafetyTranslationAgent` - Database-driven prompts (SAFETY_TRANSLATION agent)
- Used by BOTH `LLMRouterService` (main flow) and `LLMService.handleNewUserWelcome()` (new users)
- NO hardcoded translations - LLM handles IT/ES/PT/EN dynamically

---

## Product & Service Image Management System (October 15, 2025) 🆕

### 📸 **Overview**

Sistema completo di gestione immagini multiple per prodotti e servizi con upload, drag & drop reordering, crop quadrato, validazione, e visualizzazione con placeholder intelligente.

### 🎯 **Features Implementate**

#### **Backend**

- **Database Schema**: Campo `imageUrl String[]` in Products e Services con supporto completo multi-immagine
- **Upload Middleware**:
  - Validazione file (4MB max per file, formati PNG/JPG/JPEG/GIF/WEBP/SVG/BMP)
  - Supporto upload multiplo con `uploadImage.array("images", 10)` (massimo 10 immagini)
  - Generazione filename unici: `{code}_{timestamp}_{random}.{ext}` per evitare conflitti
- **Storage Organizzato**: `/uploads/products/` e `/uploads/services/` con file nominati univocamente
- **Sanitizzazione Filename**: Protezione contro path traversal (`replace(/[^a-zA-Z0-9-_]/g, "_")`)
- **Security**: Tutti endpoint protetti da `authMiddleware` + `workspaceValidationMiddleware`
- **Domain Entities**: Product e Service con campo `imageUrl: string[]` completamente integrato
- **API Endpoints**: POST e PUT gestiscono sia nuovi upload che riordinamento immagini esistenti

#### **Frontend**

- **MultiImageUpload Component**:
  - Upload multiplo con preview di tutte le immagini
  - Drag & drop per riordinare immagini con @hello-pangea/dnd
  - Validazione client-side (4MB per file, tipo MIME)
  - Gestione immagini esistenti con possibilità di rimozione e riordinamento
  - Counter immagini (es: 3/10)
  - Crop quadrato automatico per ogni immagine caricata
- **ProductImage Component**: Visualizzazione prima immagine con fallback a icona placeholder (Package icon)
- **Form Integration**: ProductSheet e ServiceSheet supportano upload multiplo con FormData
- **API Services**: productsApi e servicesApi gestiscono multipart/form-data e riordinamento
- **Environment Config**: `VITE_PATH_IMG` per costruzione URL immagini
- **Workspace Context**: Aggiunto campo `currency` all'interfaccia Workspace per supporto prezzi

### 🔒 **Security & Validation**

#### **Validazione Multi-Livello**

1. **Client-Side**:
   - Max 4MB per file, MIME type check in MultiImageUpload
   - Limite massimo 10 immagini per prodotto/servizio
   - Validazione formati accettati prima dell'upload
2. **Server-Side**:
   - Multer fileFilter con MIME type validation
   - Extension whitelist check
   - File size limit enforcement (4MB)
   - Filename sanitization contro path traversal con pattern unici per evitare sovrascritture
3. **Workspace Isolation**: Ogni operazione filtra per `workspaceId`
4. **Array Handling**: Gestione sicura di JSON.parse per existingImageUrls con try-catch

#### **Protezioni Implementate**

```typescript
// Generazione filename unici per multi-immagine (uploadMiddleware.ts)
const sanitizedCode = code.replace(/[^a-zA-Z0-9-_]/g, "_")
const timestamp = Date.now()
const randomString = Math.random().toString(36).substring(2, 8)
const filename = `${sanitizedCode}_${timestamp}_${randomString}${ext}`

// Validazione workspaceId (controller)
if (!workspaceId) {
  return res.status(400).json({ message: "WorkspaceId is required" })
}

// Gestione array immagini in POST/PUT
if (req.files && Array.isArray(req.files) && req.files.length > 0) {
  const imagePaths = (req.files as Express.Multer.File[]).map(
    (file) => `/uploads/products/${file.filename}`
  )
  productData.imageUrl = imagePaths
}

// Gestione riordinamento immagini esistenti
if (req.body.existingImageUrls) {
  try {
    const existingUrls = JSON.parse(req.body.existingImageUrls)
    if (Array.isArray(existingUrls) && existingUrls.length > 0) {
      productData.imageUrl = existingUrls
    }
  } catch (error) {
    logger.error("Error parsing existingImageUrls JSON", error)
  }
}

// Update con workspaceId filter (repository)
where: {
  id, workspaceId
}
```

### 📁 **File Structure**

#### **Backend Files Modified/Created**

```
backend/
├── prisma/
│   ├── schema.prisma (imageUrl field)
│   ├── migrations/20251014225150_add_image_url_to_products_and_services/
│   └── data/products.ts (imageUrl in ProductData interface)
├── src/
│   ├── domain/entities/
│   │   ├── product.entity.ts (imageUrl: string[])
│   │   └── service.entity.ts (imageUrl: string[])
│   ├── repositories/
│   │   ├── product.repository.ts (imageUrl in update data)
│   │   └── service.repository.ts (imageUrl already handled via 'as any')
│   ├── interfaces/http/
│   │   ├── middlewares/uploadMiddleware.ts (NEW)
│   │   ├── controllers/
│   │   │   ├── product.controller.ts (req.file handling)
│   │   │   └── services.controller.ts (req.file handling)
│   │   └── routes/
│   │       ├── products.routes.ts (upload middleware integration)
│   │       └── services.routes.ts (upload middleware integration)
└── uploads/
    ├── products/ (8 placeholder files)
    └── services/ (2 placeholder files)
```

#### **Frontend Files Modified/Created**

```
frontend/
├── .env (VITE_PATH_IMG)
├── src/
│   ├── config.ts (IMG_BASE_URL export)
│   ├── contexts/
│   │   └── WorkspaceContext.tsx (added currency field)
│   ├── components/
│   │   ├── shared/
│   │   │   ├── MultiImageUpload.tsx (NEW - multiple images with drag & drop)
│   │   │   ├── ProductImage.tsx (displays first image from array)
│   │   │   ├── ProductSheet.tsx (multi-upload integration)
│   │   │   ├── ServiceSheet.tsx (multi-upload integration)
│   │   │   └── FormSheet.tsx (generic form with multi-upload support)
│   │   └── ui/
│   │       └── ProductCard.tsx (displays first image)
│   ├── pages/
│   │   ├── ProductsPage.tsx (multi-image display in list)
│   │   ├── ServicesPage.tsx (multi-image display in list)
│   │   └── settings/ProductsPage.tsx (admin product management)
│   └── services/
│       ├── productsApi.ts (FormData + array support, processProductData fix)
│       └── servicesApi.ts (FormData + array support, imageUrl array handling)
```

### 🔄 **Data Flow**

#### **Multiple Images Upload Flow**

```
1. User selects multiple images → MultiImageUpload component
2. Client validation (4MB per file, file type, max 10 images)
3. User crops each image to square aspect ratio
4. Canvas generates cropped JPEG blobs for each image
5. Files added to FormData as "images" array field
6. If reordering existing images: existingImageUrls sent as JSON string
7. POST/PUT request with multipart/form-data
8. authMiddleware validates JWT token
9. workspaceValidationMiddleware extracts workspaceId
10. uploadMiddleware.array("images", 10) validates & saves to /uploads/{type}/
11. Controller receives req.files array with filenames
12. Controller builds imagePaths array: ['/uploads/{type}/{filename1}', ...]
13. If existingImageUrls present: JSON.parse and use for reordering
14. Repository saves imageUrl array to database (preserving order)
15. Response returns updated product/service with imageUrl array
```

#### **Display Flow**

```
1. API returns product/service with imageUrl: string[]
2. ProductImage component receives imageUrl prop
3. If imageUrl[0] exists: constructs ${IMG_BASE_URL}${imageUrl[0]}
4. <img> tag displays image
5. onError fallback: hides img, shows placeholder icon
6. If no imageUrl: directly shows placeholder (Package icon)
```

### 🛡️ **Permission & Security Audit**

#### **Filesystem Permissions**

```bash
uploads/              drwxr-xr-x  (755)
uploads/products/     drwxr-xr-x  (755)
uploads/services/     drwxr-xr-x  (755)
*.jpg files           -rw-r--r--  (644)
```

#### **Security Checklist**

- ✅ All upload endpoints protected by authMiddleware
- ✅ All operations filter by workspaceId (no cross-workspace access)
- ✅ Filename sanitization prevents path traversal
- ✅ MIME type validation on client & server
- ✅ File extension whitelist enforced
- ✅ Max file size limit (4MB) enforced
- ✅ Upload directories created with safe permissions
- ✅ Database updates use workspaceId in WHERE clause
- ✅ Static file serving limited to /uploads directory
- ✅ No user-provided paths accepted (only sanitized codes)

### 📊 **Technical Specifications**

| Aspect            | Specification                                                     |
| ----------------- | ----------------------------------------------------------------- |
| Max File Size     | 4MB per file                                                      |
| Max Images        | 10 images per product/service                                     |
| Allowed Formats   | PNG, JPG, JPEG, GIF, WEBP, SVG, BMP                               |
| Aspect Ratio      | 1:1 (Square)                                                      |
| Min Dimensions    | 150x150 pixels                                                    |
| Storage Path      | `/uploads/{products\|services}/{code}_{timestamp}_{random}.{ext}` |
| Database Field    | `imageUrl String[] @default([])`                                  |
| URL Construction  | `${VITE_PATH_IMG}${imageUrl[0]}`                                  |
| Crop Library      | react-image-crop v11.0.7                                          |
| Upload Library    | multer v1.4.5-lts.1                                               |
| Drag & Drop       | @hello-pangea/dnd (successor of react-beautiful-dnd)              |
| Upload Field Name | "images" (array) instead of "image" (single)                      |

### 🧪 **Testing Checklist**

- [x] Upload multiple images in product creation
- [x] Upload multiple images in product update
- [x] Upload multiple images in service creation
- [x] Upload multiple images in service update
- [x] Drag & drop reorder images (preserves order in database)
- [x] Remove individual images from multi-upload
- [x] Validate 4MB size limit per file (client & server)
- [x] Validate file type restriction
- [x] Validate max 10 images limit
- [x] Test path traversal protection (filename sanitization)
- [x] Test cross-workspace isolation (workspaceId filter)
- [x] Test placeholder display when no image
- [x] Test image load error fallback to placeholder
- [x] Verify workspaceId filter in all database queries
- [x] Test unique filename generation (no overwrites)
- [x] Test existingImageUrls JSON parsing with error handling
- [x] Verify first image displays in product list
- [x] Test compilation without TypeScript errors

### 📝 **Environment Variables**

```env
# Backend (.env)
# None required - uses relative paths

# Frontend (.env)
VITE_PATH_IMG="http://localhost:3001"  # Backend URL for image serving
```

### 🚀 **Deployment Notes**

1. **Database Migration**: Run `npx prisma migrate deploy` to apply imageUrl field
2. **Upload Directories**: Ensure `/uploads/products` and `/uploads/services` exist with write permissions
3. **Static File Serving**: Verify Express serves `/uploads` directory publicly
4. **Environment Variable**: Set `VITE_PATH_IMG` to production backend URL
5. **CORS**: Ensure backend allows image requests from frontend domain

---

## Scheduler Service (October 2025)

Lo Scheduler Service è un sistema di manutenzione automatica che gestisce:

1. **Pulizia Chat**

   - Mantiene solo gli ultimi 50 messaggi per sessione
   - Pulizia automatica ogni 12 ore
   - Ottimizzazione performance database

2. **Gestione Offerte**

   - Disattivazione automatica offerte scadute
   - Controllo ogni 5 minuti
   - Solo offerte valide visibili ai clienti

3. **Pulizia URL**
   - Rimozione URL scaduti/vecchi
   - Pulizia oraria
   - Mantenimento database ottimizzato

Per dettagli completi vedere: `docs/memory-bank/scheduler-service.md`

## Public Orders (Phone-based External Links)

[Testing details removed]

### 🚀 **Performance Optimizations**

- **Code Cleanup**: Rimossi duplicati, imports inutilizzati, e codice morto
- **TypeScript Strict**: Nessun warning di compilazione
- **Optimized Builds**: Frontend (1,296 kB) e Backend compilati senza errori
- **Debounced Search**: Ricerca prodotti ottimizzata con 300ms delay
- **Smart State Management**: Gestione stato React ottimizzata

### 📋 **User Experience Flow**

1. **Step 1 - Products**: Lista prodotti con pulsante "Aggiungi Prodotto" e gestione quantità
2. **Step 2 - Addresses**: Indirizzi pre-compilati con dati cliente (nome, telefono, azienda), validazione completa dei campi obbligatori prima del passaggio allo step 3
3. **Step 3 - Confirmation**: Riepilogo ordine e conferma finale con validazione finale prima del submit
4. **Multi-Language**: Interface automaticamente nella lingua del cliente
5. **Error Handling**: Gestione errori user-friendly con messaggi localizzati e toast notifications specifiche
6. **Auto-Save**: Aggiornamento automatico database cliente con indirizzi inseriti nel checkout

### 🔗 **API Endpoints**

### 📱 **Integration Points**

- **WhatsApp Chatbot**: Genera link checkout via `confirmOrderFromConversation()`
- **N8N Workflow**: Integrazione automatica con link generation
- **Order Management**: Connessione diretta con sistema gestione ordini
- **Customer Profile**: Integrazione con dati cliente per pre-popolazione

### 🎯 **Business Impact**

- **Reduced Cart Abandonment**: UI ottimizzata e flusso semplificato
- **Multi-Market Ready**: Supporto 4 lingue per espansione internazionale
- **Mobile Optimized**: Responsive design per WhatsApp mobile users
- **Conversion Optimization**: Add products durante checkout per upselling
- **🆕 Improved Customer Experience**: Auto-update indirizzi riduce friction nel checkout
- **🆕 Data Quality**: Indirizzi sempre aggiornati e consistenti nel database

### 🏆 **Implementation Summary**

Il sistema checkout è ora **completamente funzionale e production-ready**. Tutte le richieste originali sono state implementate:

✅ **Token validation fix**: Risolto "Link Error" con validazione centralizzata  
✅ **Multi-language support**: Checkout si adatta automaticamente alla lingua del cliente (IT/EN/ES/PT)  
✅ **Add products functionality**: Modal completo per ricerca e aggiunta prodotti durante checkout  
✅ **Address pre-population**: Indirizzi caricati automaticamente dai dati cliente incluso supporto per azienda  
✅ **🆕 Enhanced Step 2**: Validazione completa step 2 con controllo campi obbligatori e toast notifications  
✅ **🆕 Address auto-update**: Sistema automatico di salvataggio indirizzi e azienda durante checkout  
✅ **🆕 Cart reset**: Svuotamento automatico carrello al completamento ordine  
✅ **UI consistency**: Schema colori standardizzato blu/verde in tutto il sistema  
✅ **Code optimization**: Codice pulito, TypeScript strict, build ottimizzati

**Next Steps**: Focus su language detection bug fix e completamento integration test suite.

### ⏳ Phase 2 Tasks (Deferred)

- **Advanced WhatsApp Features** (media, templates, bulk, scheduling)
- **Security & Performance Optimization** (rate limiting, 2FA, monitoring, OWASP)
- **Full Application Responsiveness** (mobile/tablet/desktop)
- **Database Cleanup** (remove unused tables)

---

## 📋 Task List Reference

- Minimal Phase 1 checklist: `docs/task-list.md`
- Full, up-to-date structured list (completed, active, bugs, Phase 2): `docs/other/task-list.md`

---

## ❓ **FREQUENTLY ASKED QUESTIONS - TECHNICAL CLARIFICATIONS**

### **Q1: Come si calcolano i prezzi con sconti e offerte?**

**A:** [DA CHIARIRE CON ANDREA]

- Vince lo sconto più alto o sono cumulativi?
- Quale ordine di priorità: sconto prodotto > sconto categoria > sconto workspace?
- Come gestire percentuali vs importi fissi?

### **Q2: Gestione Canale Disattivo - Messaggio WIP**

**A:** [DA CHIARIRE CON ANDREA]

- Dove si trova il messaggio "Work in Progress" multilingua?
- È nel database (tabella `gdprContent` o simile)?
- È hardcoded per lingua o configurabile per workspace?

### **Q3: LLM di Formattazione in N8N**

**A:** ✅ **IMPLEMENTATO - SINGLE LLM ARCHITECTURE**

- **LLM Agent (OpenRouter)**: Gestisce RAG search e genera risposta conversazionale
- Configurazione dinamica dalla tabella `agentConfig` (prompt, temperatura, token, modello)
- Integrato con N8N Agent Node per gestione completa del workflow

### **Q4: Calling Functions con Token di Protezione**

**A:** ✅ **IMPLEMENTATO**

- Token interno N8N: `internal_api_secret_n8n_shopme_2024`
- SecureTokenService per customer tokens temporanei
- Cleanup automatico after expiration (1 ora)

### **Q5: Usage Tracking System**

**A:** ✅ **IMPLEMENTATO COMPLETAMENTE**

- **LLM Response**: €0.15 (15 centesimi) per ogni risposta chatbot
- **New Customer**: €1.50 (1.50 euro) per ogni nuovo cliente registrato
- **New Order**: €1.50 (1.50 euro) per ordine completo
- **Push Message**: €0.50 (50 centesimi) per notifiche push standalone
- **Tracciamento automatico**: Integrato in tutti i controller con single point of truth
- **Dashboard analytics**: Statistiche complete con grafici e export
- **Filtri di sicurezza**: Solo clienti registrati con `activeChatbot: true`

### **Q6: N8N Auto-Setup e Import Automatico**

**A:** ✅ **IMPLEMENTATO COMPLETAMENTE**

- **Flusso attivo**: SÌ - workflow creato automaticamente e impostato `active: true`
- **Workflow completo**: SÌ - Single LLM Agent con RAG integration
- **Credenziali**: SÌ - Basic Auth automaticamente configurato per Internal API
- **Owner account**: SÌ - `admin@shopme.com / Venezia44`
- **Script**: `scripts/n8n_import-optimized-workflow.sh` - setup completamente automatico
- **Files**: `n8n/shopme-whatsapp-workflow.json` + credentials
- **Processo**: Docker start → Owner setup → Credential import → Workflow import → Activation

### **🔑 N8N CREDENTIALS CONFIGURATION**

**CREDENZIALI OBBLIGATORIE PER FUNZIONAMENTO N8N:**

#### **1. N8N Admin Login**

- **Email**: `admin@shopme.com`
- **Password**: `Venezia44` (uppercase V required)
- **URL**: http://localhost:5678
- **Setup**: Automatico via `scripts/n8n_import-optimized-workflow.sh`

#### **2. Backend API Authentication (Basic Auth)**

- **Name**: `Backend API Basic Auth`
- **Type**: `Basic Authentication`
- **Username**: `admin`
- **Password**: `admin`
- **Usage**: Per chiamate HTTP al backend `/api/internal/*`
- **Nodes**: LLM Router, RAG Search, Save Message, Generate Token

#### **3. OpenRouter API Authentication (Header Auth)**

- **Name**: `OpenRouter API`
- **Type**: `Header Auth`
- **Header Name**: `Authorization`
- **Header Value**: `Bearer ${OPENROUTER_API_KEY}`
- **Usage**: Per chiamate LLM dirette a OpenRouter
- **Nodes**: LLM Router, LLM Formatter

#### **4. WhatsApp Business API (Header Auth)**

- **Name**: `WhatsApp Business API`
- **Type**: `Header Auth`
- **Header Name**: `Authorization`
- **Header Value**: `Bearer ${WHATSAPP_TOKEN}`
- **Usage**: Per invio messaggi WhatsApp
- **Nodes**: Send WhatsApp Message

#### **📋 SETUP AUTOMATICO CREDENZIALI:**

#### **⚠️ CONFIGURAZIONE MANUALE (se automatico fallisce):**

1. Login N8N: http://localhost:5678 (`admin@shopme.com / Venezia44`)
2. Settings → Credentials → Create New
3. Seleziona tipo appropriato (Basic Auth, Header Auth)
4. Inserisci nome e valori come specificato sopra
5. Salva e assegna ai nodi workflow appropriati

### **Q7: Logica RAG Condizionale**

**A:** ✅ **IMPLEMENTATO**

- LLM Router classifica l'intenzione: sociale vs prodotto/servizio
- Pattern sociali (saluti, ringraziamenti) = NO RAG
- Pattern commerciali (prodotti, prezzi, ordini) = SÌ RAG
- Endpoint: `/internal/llm-router`

### **Q8: Disable Chatbot - Non Rispondere**

**A:** ✅ **IMPLEMENTATO**

- Check `workspace.isActive` e `whatsappSettings.isActive`
- Se disattivo, nessuna risposta automatica
- Implementato nel workflow N8N e backend

### **Q9: Invoice Management System**

**A:** ✅ **TASK DOCUMENTATO - DA IMPLEMENTARE**

- **CF Function**: `ReceiveInvoice` con filtro codice ordine
- **Pagina lista fatture**: Design coerente con registrazione + token security
- **Download PDF**: Sistema di token temporanei per sicurezza
- **Database schema**: Tabella `invoices` con relazioni customer/workspace

---

## 💰 **USAGE TRACKING SYSTEM - COMPLETE IMPLEMENTATION**

### **🎯 Overview**

Il sistema di billing traccia automaticamente tutti i costi secondo la pricing list ufficiale. Tutti i costi vengono registrati nel database con dettagli progressivi (previous/current/new total), permettendo di visualizzare una cronologia completa delle transazioni.

**Pricing List Ufficiale (Ottobre 2025):**

| Servizio            | Costo  | Descrizione                                         |
| ------------------- | ------ | --------------------------------------------------- |
| **MONTHLY_CHANNEL** | €59.00 | Costo fisso mensile per workspace                   |
| **MESSAGE**         | €0.15  | Costo per messaggio/interazione                     |
| **NEW_CUSTOMER**    | €1.50  | Costo per nuovo cliente (alla registrazione)        |
| **NEW_ORDER**       | €1.50  | Costo per nuovo ordine                              |
| **HUMAN_SUPPORT**   | €1.00  | Costo per riattivazione chatbot dopo supporto umano |
| **PUSH_MESSAGE**    | €1.00  | Costo per notifica push (cambio sconto)             |
| **NEW_FAQ**         | €0.50  | Costo per creazione nuova FAQ                       |
| **ACTIVE_OFFER**    | €0.50  | Costo per attivazione offerta                       |

### **✅ Architettura Implementata**

#### **🔄 BillingService - Single Point of Truth**

Il servizio `BillingService` centralizza tutti gli addebiti con metodi dedicati:

- `chargeMonthlyChannelCost(workspaceId)` - Costo mensile (€59.00)
- `trackMessage(workspaceId, customerId, description, userQuery)` - Messaggio (€0.15)
- `trackNewCustomer(workspaceId, customerId)` - Nuovo cliente (€1.50)
- `trackNewOrder(workspaceId, customerId, description)` - Nuovo ordine (€1.50)
- `trackHumanSupport(workspaceId, customerId, description)` - Supporto umano (€1.00)
- `trackPushMessage(workspaceId, customerId, description)` - Push notification (€1.00)
- `trackNewFAQ(workspaceId, customerId, description)` - Nuova FAQ (€0.50)
- `trackActiveOffer(workspaceId, offerId, offerTitle)` - Offerta attiva (€0.50)

Ogni metodo calcola automaticamente i totali progressivi (previousTotal + currentCharge = newTotal).

#### **📊 Database Schema**

#### **🎯 Trigger di Billing Automatici**

| Quando                | Cosa viene addebitato    | Dove                         |
| --------------------- | ------------------------ | ---------------------------- |
| Utente si registra    | NEW_CUSTOMER (€1.50)     | `registration.controller.ts` |
| Messaggio chatbot     | MESSAGE (€0.15)          | `message.repository.ts`      |
| Ordine confermato     | NEW_ORDER (€1.50)        | `order.service.ts`           |
| Riattivazione chatbot | HUMAN_SUPPORT (€1.00)    | `customers.controller.ts`    |
| Cambio sconto         | PUSH_MESSAGE (€1.00)     | `customers.controller.ts`    |
| Creazione FAQ         | NEW_FAQ (€0.50)          | `faq.controller.ts`          |
| Attivazione offerta   | ACTIVE_OFFER (€0.50)     | `offer.controller.ts`        |
| Inizio mese           | MONTHLY_CHANNEL (€59.00) | `scheduler.service.ts`       |

#### **🔄 Flusso Esempio - Messaggio**

### **📈 Dashboard Analytics (System Logs)**

#### **API Endpoints**

#### **Visualizzazione Frontend**

- **System Logs Tab**: Tabella completa di tutte le transazioni billing
- **Filtro per Cliente**: Dropdown per filtrare per singolo cliente
- **Colonne**: Data/Ora, Tipo, Cliente, Dettagli, Costo, Formula (previous + current = new)
- **Grand Total**: Somma totale con conteggio operazioni
- **Progressive Totals**: Ogni riga mostra il calcolo progressivo

#### **Metriche Business Intelligence**

- **Total Revenue**: Somma di tutti i costi nel periodo
- **Per Customer**: Breakdown dei costi per cliente
- **Per Type**: Distribuzione dei costi per tipo di operazione
- **Trends**: Grafici di andamento giornaliero/mensile
- **Top Spenders**: Clienti che generano più costi

- Clienti più attivi per targeting marketing
- Ore di punta per ottimizzare staff
- Trend di crescita per budget planning
- Costi AI monitorati in tempo reale

### **🛡️ Validazioni Automatiche**

- ✅ **Solo clienti registrati**: `activeChatbot: true`
- ✅ **Solo con risposta LLM**: `response && response.trim()`
- ✅ **Workspace isolation**: `workspaceId` validation
- ✅ **Error handling**: Non blocca il flusso principale

### **🛠️ Debug Mode Configuration**

**IMPLEMENTATO**: Campo `debugMode` per disabilitare usage tracking durante testing/debug.

#### **🔧 Technical Implementation**

#### **🎨 Settings Interface**

- **Location**: `/settings` page in workspace settings section
- **Control**: Toggle/checkbox for "Debug Mode"
- **Description**: "When enabled, usage costs (€0.005) are not tracked. Use for testing purposes."
- **Default**: Always `true` (enabled by default)
- **Scope**: Per workspace (isolated configuration)

#### **🎯 Use Cases**

- **Development**: Avoid accumulating costs during feature development
- **Testing**: Skip tracking during automated testing and QA
- **Demo**: Clean cost tracking for client demonstrations
- **Debug**: Isolate functionality issues without cost implications

#### **🛡️ Business Rules**

- **Default Behavior**: `debugMode: true` (no tracking) for all new workspaces
- **Production Safe**: Safe to use in production for testing scenarios
- **Workspace Isolated**: Each workspace controls its own debug mode
- **Audit Trail**: Debug mode status logged for transparency

### **🎯 Vantaggi Architettura Andrea**

1. **Performance**: Zero overhead di chiamate HTTP extra
2. **Reliability**: Single point of failure = maggiore stabilità
3. **Security**: Nessun endpoint pubblico esposto
4. **Maintainability**: Un solo posto da mantenere
5. **Debug Flexibility**: Usage tracking can be disabled per workspace for testing

---

## 🛒 **ORDERS & CART MANAGEMENT SYSTEM - ENTERPRISE REDESIGN**

### **🎯 Overview**

Sistema completo di gestione ordini e carrello enterprise-grade che sostituisce l'attuale implementazione "oscena" con un'interfaccia consistente, funzionalità CRUD complete e business logic robusta.

### **🔗 Accesso Ordini via Link Sicuro (TTL 1h)**

- **Intento generico (lista ordini / fattura / DDT senza numero ordine)**

  - Risposta: link a pagina lista ordini del cliente in ordine di data decrescente, con stato e totale
  - URL esempio: `https://app.example.com/orders?token=...`
  - Validità: token firmato (JWT HS256), TTL 1 ora; scaduto → pagina non accessibile
  - Dal dettaglio ordine sono disponibili: download Fattura (PDF) e DDT (PDF)

- **Intento specifico (con numero ordine)**

  - Risposta: link diretto al dettaglio dell'ordine
  - URL esempio: `https://app.example.com/orders/ORD-123?token=...`

- **Token JWT (sicurezza)**

  - Claim minimi: `clientId`, `workspaceId`, `scope`
    - Lista: `orders:list`
    - Dettaglio: `orders:detail` + `orderCode`
  - Opzionali: `jti` (revoca/one-time), binding soft (user-agent/IP)
  - Niente dati sensibili nel payload

- **Frontend**

  - `OrdersListPage`: lista in ordine data decrescente, stato, totale; click → dettaglio
  - `OrderDetailPage`: dettaglio ordine con pulsanti download Fattura e DDT

- **Backend (tutti validano token e workspace)**
  - `GET /api/orders` → lista ordini per `clientId`
  - `GET /api/orders/:orderCode` → dettaglio ordine
  - `GET /api/orders/:orderCode/invoice` → download fattura
  - `GET /api/orders/:orderCode/ddt` → download DDT

### **❌ Problemi Attuali**

- **Grafica inconsistente**: Layout e colori diversi dal resto dell'app
- **Zero CRUD**: Impossibile modificare ordini esistenti
- **Logica inesistente**: Nessuna gestione stati, stock, pagamenti
- **Carrello primitivo**: Non si può modificare quantità o salvare carrello
- **Relazioni rotte**: Products ↔ OrderItems ↔ Orders non funzionano

### **✅ Obiettivo Target**

**Sistema Orders & Cart di livello enterprise** con:

- 🎨 **Design System Consistency**: Stesso tema/colori di Products/Categories/Customers
- 🛠️ **CRUD Completo**: Create, Read, Update, Delete per tutti gli ordini
- 🛒 **Smart Cart**: Modifica qty, aggiungi/rimuovi prodotti, salvataggio persistente
- 📊 **Business Intelligence**: Dashboard con analytics, filtri, ricerca avanzata
- 🔄 **Stock Management**: Gestione inventario automatica con validazioni

### **🏗️ Architettura & Design**

#### **🎨 Design System Compliance**

#### **📱 Component Architecture**

### **🛒 Smart Cart System - WhatsApp Chat Integration**

#### **System Overview**

The Smart Cart System provides **real-time cart management** directly within WhatsApp conversations using **AI-powered intent detection** and **secure token-based checkout**. The system combines SearchRAG cart-awareness with traditional calling functions for a seamless shopping experience.

#### **Architecture Components**

````mermaid
graph LR
    A[👤 Cliente WhatsApp] --> B[🤖 DualLLMService]
    B --> C[🔍 SearchRAG Cart-Aware]
    B --> D[⚡ Calling Functions]
    C --> E[🔧 FunctionHandlerService]
    D --> E
    E --> F[🛒 CartService]
    F --> G[🔐 SecureTokenService]
    G --> H[🌐 CartPage Frontend]
🛒 CHECKOUT → 📋 PENDING ORDER (Stock disponibile per altri)
         ↓
📞 CONFERMA OPERATORE → ✅ CONFIRMED ORDER (Stock scalato)
         ↓
📦 SHIPPED → 🎉 DELIVERED (Stock permanentemente venduto)
         ↓
❌ CANCELLED/REFUNDED → 🔄 STOCK RIPRISTINATO
📱 WhatsApp → 🤖 N8N → 🔐 Backend → 🎨 Frontend → 📋 Invoice Data
https://domain.com/invoice?token=abc123...&workspaceId=ws_456
1. CF ReceiveInvoice (senza orderCode) chiamata
   ↓
2. Backend genera JWT token con customerId + workspaceId
   ↓
3. Backend restituisce URL: "domain.com/customer/invoices?token=JWT_TOKEN"
   ↓
4. Cliente clicca link WhatsApp
   ↓
5. Frontend estrae token da URL query parameter
   ↓
6. Frontend valida token (pre-check JWT decode)
   ↓
7. Se valido: API call con token per recuperare fatture
   ↓
8. Backend valida token + restituisce fatture del cliente
   ↓
9. Frontend mostra lista fatture (ORDER BY id DESC)
📱 MESSAGGIO WHATSAPP
         |
         v
    ┌─────────────────┐
    │ 🚨 SPAM CHECK   │ ──YES─> 🚫 AUTO-BLACKLIST + STOP
    │ 10+ msg/30sec?  │         (customer + workspace)
    └─────────────────┘
         |NO
         v
    ┌─────────────────┐
    │ CANALE ATTIVO?  │ ──NO──> ❌ STOP DIALOGO
    │ (isActive)      │
    └─────────────────┘
         |YES
         v
    ┌─────────────────┐
    │ CHATBOT ATTIVO? │ ──NO──> 👨‍💼 CONTROLLO OPERATORE
    │ (activeChatbot) │         (salva msg, no AI response)
    └─────────────────┘
         |YES
         v
    ┌─────────────────┐
    │ USER BLACKLIST? │ ──YES─> ❌ BLOCCA CONVERSAZIONE
    └─────────────────┘
         |NO
         v
    ┌─────────────────┐
    │ CANALE IN WIP?  │ ──YES─> ⚠️ MESSAGGIO WIP
    └─────────────────┘
         |NO
         v
    ┌─────────────────┐
    │ NUOVO UTENTE?   │
    └─────────────────┘
         |              |
       YES|              |NO
         v              v
    ┌─────────────┐  ┌─────────────────┐
    │ SALUTO?     │  │ E' REGISTRATO?  │
    │ Ciao/Hello  │  └─────────────────┘
    └─────────────┘         |        |
         |YES              NO|        |YES
         v                   v        v
    ┌─────────────┐  ┌─────────────┐ ┌─────────────────┐
    │ 🎉 WELCOME  │  │ 🎉 WELCOME  │ │ >2 ORE ULTIMA   │ ──YES─> 👋 BENTORNATO {NOME}
    │ + REG LINK  │  │ + REG LINK  │ │ CONVERSAZIONE?  │
    └─────────────┘  └─────────────┘ └─────────────────┘
         |                 |              |NO
         v                 v              v
    ┌─────────────┐  ┌─────────────┐ ┌─────────────────┐
    │ 🔗 TOKEN +  │  │ ⏳ ATTENDI  │ │ 🤖 RAG SEARCH + │
    │ REGISTRA    │  │ REGISTRA    │ │ 🤖 LLM PROCESSING │
    └─────────────┘  └─────────────┘ └─────────────────┘
         |                              |
         v                              v
    ┌─────────────┐                ┌─────────────────┐
    │ 🤖 RAG +    │                │ 💬 RISPOSTA     │
│ LLM AGENT   │                │ DISCORSIVA      │
│ PROCESSING  │                │ + 💰 USAGE      │
    └─────────────┘                └─────────────────┘
         |
         v
    ┌─────────────┐
    │ 💬 RISPOSTA │
    │ DISCORSIVA  │
    │ + 💰 USAGE  │
    └─────────────┘
+-------------------------+-------------------------+-------------------------+-------------------------+-------------------------+
| 1. PROBLEM              | 2. SOLUTION             | 3. UNIQUE VALUE         | 4. UNFAIR ADVANTAGE     | 5. CUSTOMER SEGMENTS    |
|                         |                         |    PROPOSITION          |                         |                         |
+-------------------------+-------------------------+-------------------------+-------------------------+-------------------------+
| • E-commerce and        | • WhatsApp-based        | • Unified commerce and  | • 98% message open      | • Small businesses      |
|   customer service      |   chatbot platform      |   customer care in      |   rate vs 20% email     |   without technical     |
|   are separate systems  |   with AI integration   |   one platform          | • 53% cart abandonment  |   expertise             |
|                         |                         |                         |   reduction             |                         |
| • Technical barriers    | • No-code product and   | • Secure token-based    | • Cross-industry        | • Mid-sized retailers   |
|   for WhatsApp          |   catalog management    |   system for sensitive  |   versatility without   |   seeking omnichannel   |
|   commerce integration  |                         |   operations            |   reconfiguration       |   solutions             |
|                         |                         |                         |                         |                         |
| • Limited personalization| • Multi-industry       | • 42% higher conversion | • Unified platform vs   | • Food/grocery          |
|   in traditional        |   adaptability without  |   rate vs traditional   |   competitors' fragmented|  businesses with       |
|   e-commerce            |   reconfiguration       |   websites              |   solutions             |   perishable inventory  |
|                         |                         |                         |                         |   (e.g., Gusto Italiano)|
|                         |                         |                         |                         |                         |
| • Lost sales from       | • AI-powered            | • 67% faster response   | • Customizable platform | • Hospitality businesses|
|   abandoned carts and   |   conversation and      |   time and 3.2x higher  |   for industry-specific |   requiring booking     |
|   unanswered queries    |   engagement            |   customer retention    |   compliance needs      |   and follow-up         |
+-------------------------+-------------------------+-------------------------+-------------------------+-------------------------+
| 6. KEY METRICS                                    | 7. CHANNELS                                                                |
|                                                   |                                                                            |
| • Conversion rate (42% higher than traditional)   | • Direct enterprise sales team                                             |
| • Customer response time (67% reduction)          | • Partner network of e-commerce consultants                                |
| • Average order value (28% increase)              | • WhatsApp Business Platform                                               |
| • Cart abandonment (53% decrease)                 | • Digital marketing (content, webinars, demos)                             |
| • Customer retention (3.2x higher)                | • Free trial program with guided onboarding                                |
+---------------------------------------------------+----------------------------------------------------------------------------+
| 8. COST STRUCTURE                                 | 9. REVENUE STREAMS                                                         |
|                                                   |                                                                            |
| • Development team                                | • Subscription model:                                                      |
| • AI/ML model costs                               |   - Single plan with unlimited products and WhatsApp integration          |
| • WhatsApp Business API fees                      |   - Implementation and customization services                              |
| • Cloud infrastructure                            |   - API access fees for third-party integrations                          |
| • Customer success team                           |                                                                             |
| • Sales & marketing                               | • Implementation and customization services                                |
|                                                   | • API access fees for third-party integrations                             |
+---------------------------------------------------+----------------------------------------------------------------------------+
User Query: "hai la mozzarella fresca? quanto costa la spedizione?"
     |
     v
┌─────────────────────────────────────────────────────────────┐
│ PARALLEL SEMANTIC SEARCH ACROSS ALL CONTENT TYPES          │
├─────────────────────────────────────────────────────────────┤
│ • Products: searchProducts(query, workspaceId, 5)          │
│ • FAQs: searchFAQs(query, workspaceId, 5)                  │
│ • Services: searchServices(query, workspaceId, 5)          │
│ • Documents: searchDocuments(query, workspaceId, 5)        │
└─────────────────────────────────────────────────────────────┘
     |
     v
┌─────────────────────────────────────────────────────────────┐
│ STOCK VERIFICATION & FULL CONTEXT RETRIEVAL                │
├─────────────────────────────────────────────────────────────┤
│ • Verify product availability (stock > 0, isActive = true) │
│ • Get complete product details (price, category, stock)    │
│ • Get complete FAQ details (question, answer)              │
│ • Get complete service details (price, duration)           │
│ • Get recent chat history (last 5 messages)                │
└─────────────────────────────────────────────────────────────┘
     |
     v
┌─────────────────────────────────────────────────────────────┐
│ SINGLE LLM AGENT - RAG PROCESSING                          │
├─────────────────────────────────────────────────────────────┤
│ LLM Agent: Process RAG data + Generate conversation        │
│ Input: Search results + customer context + agent config    │
│ Output: Natural conversation + Usage tracking (€0.005)     │
└─────────────────────────────────────────────────────────────┘
     |
     v
"Bentornato Mario! 🎉
Sì, abbiamo la mozzarella fresca disponibile:
🧀 Mozzarella di Bufala - €8.50 (15 unità disponibili)
🚚 Spedizione: Corriere espresso €5.00 (24-48 ore)
Vuoi procedere con l'ordine? 😊"
[Blocco codice rimosso]typescript~~
~~// N8NPage.tsx - Main container with iframe integration (REMOVED)~~
~~<div className="flex flex-col h-full">~~
~~ <N8NStatusHeader />~~
~~ <iframe~~
~~ src={`http://localhost:5678?auth=${getN8NToken()}`}~~
~~ className="flex-1 w-full border-0 rounded-lg"~~
~~ style={{ minHeight: '800px' }}~~
~~ title="N8N Workflow Editor"~~
~~ sandbox="allow-same-origin allow-scripts allow-forms"~~
~~ />~~
~~ <QuickActions />~~
~~</div>~~
~~```~~

##### **~~📊 Real-time Monitoring:~~ (REMOVED)**

~~- **WorkflowStatusCard**: Live workflow execution status~~
~~- **WorkflowMetrics**: Performance analytics and success rates~~
~~- **Container Health**: N8N service availability monitoring~~
~~- **Error Dashboard**: Real-time error tracking and logging~~

##### **~~🔧 Quick Management Actions:~~ (REMOVED)**

~~- **Import/Export Workflows**: Upload/download workflow JSON files~~
~~- **Container Control**: Start/stop/restart N8N container~~
~~- **Performance Dashboard**: Execution times, success rates, error rates~~
~~- **Workflow Templates**: Pre-built templates for common business patterns~~

##### **~~🛡️ Security Integration:~~ (REMOVED)**

~~- **Role-Based Access**: Only workspace owners/admins can modify workflows~~
~~- **Audit Logging**: Track all workflow modifications with user attribution~~
~~- **Secure Token Passing**: JWT tokens for N8N authentication~~
~~- **Read-Only Mode**: Limited access for non-admin users~~

**Simplified N8N Architecture**:

- N8N runs as Docker container for WhatsApp processing
- Backend API endpoints remain for N8N communication
- No frontend UI integration
- Focus on core messaging workflow functionality

### **Critical N8N Issues**

**Credentials Persistence Problem**:

- **Issue**: N8N loses credentials on every restart/reload
- **Impact**: WhatsApp workflow stops working after container restart
- **Frequency**: Always happens on system restart or N8N container reload
- **Critical Impact**: Complete WhatsApp messaging system failure

**Required Solutions**:

**Implementation Priority**:

1. **CRITICAL**: Fix Docker volume persistence for N8N database
2. **HIGH**: Implement health monitoring for credential status
3. **MEDIUM**: Create automated backup/restore scripts
4. **LOW**: Documentation for manual recovery procedures

### 🎯 **Hybrid Architecture: Backend + N8N**

#### **🛡️ ShopMe Backend Security Layer (SEMPRE nel server):**

- ✅ **API Rate Limiting**: Controllo chiamate per workspace
- ✅ **Spam Detection**: 10 messaggi in 30 secondi → auto-blacklist
- ✅ **Blacklist Check TOTALE**: Cliente `isBlacklisted = true` → nessun salvataggio, nessuna elaborazione, blacklist silenziosa

#### **🎨 N8N Visual Workflow Layer (Business Logic):**

- 🔄 Channel Active Check
- 👤 User Registration Flow
- ⚠️ WIP Status Handling
- 🧠 RAG Search & Content Retrieval
- 🤖 LLM Processing & Response Generation
- 💾 Message History Storage
- 📤 Response Formatting

### 🔄 **Message Processing Flow**

#### **Step 1: Security Pre-Processing (ShopMe Backend)**

#### **Step 2: N8N Webhook Trigger**

#### **Step 3: N8N Visual Workflow Execution**

### 🔧 **N8N Workflow Nodes Configuration**

#### **Node 1: Webhook Trigger**

#### **Node 2: Channel Active Check**

#### **Node 3: IF Condition - Channel Active**

#### **Node 4: RAG Search**

#### **Node 5: Get Agent Config**

#### **Node 6: Build OpenRouter Prompt**

#### **Node 7: Direct OpenRouter LLM Call**

### 🔐 **Security & Token Management**

#### **Internal API Authentication:**

Tutti i nodi N8N che chiamano API ShopMe usano JWT token:

### 🐳 **Docker Configuration**

#### **N8N JSON File Storage Setup:**

#### **File Structure:**

#### **Persistence Strategy:**

- **Workflows**: Local JSON files (./n8n/workflows/) → Git trackable
- **Credentials**: Container volume (n8n_data) → Secure

## 🤖 **WHATSAPP INTELLIGENT FLOW - COMPLETE ARCHITECTURE**

### Overview - Andrea's Revolutionary System

Andrea ha creato un sistema WhatsApp intelligente che gestisce automaticamente tutto il flusso conversazionale attraverso trigger webhook, controlli di sicurezza, e calling functions specializzate. Il sistema è progettato per gestire qualsiasi tipo di business attraverso funzioni modulari e configurabili.

### 📱 **COMPLETE WHATSAPP FLOW DOCUMENTATION**

### 🔧 **CALLING FUNCTIONS - DETAILED IMPLEMENTATION**

#### **✅ IMPLEMENTED CALLING FUNCTIONS**

##### **1. 🔍 search_rag() - RAG Search Function**

**Features:**

- ✅ Local embeddings (`@xenova/transformers`)
- ✅ Parallel search across all content types
- ✅ Stock verification for products
- ✅ Similarity thresholds per content type
- ✅ Multilingual support (IT/EN/ES/PT)

##### **2. 🛒 create_order() - E-commerce Function**

##### **3. 👨‍💼 contact_operator() - Operator Control**

#### **❌ NOT IMPLEMENTED CALLING FUNCTIONS**

##### **4. 💳 process_payment() - Payment Processing**

##### **5. 📧 ReceiveInvoice() - Sistema Gestione Fatture**

### 🏗️ **TECHNICAL ARCHITECTURE - CALLING FUNCTIONS**

#### **N8N Workflow Integration**

#### **LLM Router Function Selection**

### 📊 **IMPLEMENTATION STATUS SUMMARY**

| **Calling Function**   | **Status**  | **Completion** | **Priority** |
| ---------------------- | ----------- | -------------- | ------------ |
| 🔍 SearchRag           | ✅ COMPLETE | 100%           | HIGH         |
| 📦 GetAllProducts      | ✅ COMPLETE | 100%           | HIGH         |
| 🛎️ GetAllServices      | ✅ COMPLETE | 100%           | HIGH         |
| 👨‍💼 CallOperator        | ✅ COMPLETE | 100%           | MEDIUM       |
| 📧 ReceiveInvoice      | ❌ MISSING  | 0%             | HIGH         |
| 💳 PaymentProcessStart | ❌ TODO     | 0%             | HIGH         |

### 🎯 **BUSINESS TYPE COMPATIBILITY**

#### **✅ FULLY SUPPORTED (100%)**

- **E-COMMERCE**: SearchRag + GetAllProducts + GetAllServices + CallOperator
- **INFORMATION**: SearchRag + GetAllProducts + GetAllServices + CallOperator

#### **⚠️ PARTIALLY SUPPORTED (80%)**

- **RESTAURANT**: SearchRag + GetAllProducts + GetAllServices + CallOperator (manca ReceiveInvoice)
- **RETAIL**: SearchRag + GetAllProducts + GetAllServices + CallOperator (manca PaymentProcessStart)
- **SERVICES**: SearchRag + GetAllProducts + GetAllServices + CallOperator (manca ReceiveInvoice)

#### **⚠️ LIMITED SUPPORT (60%)**

- **CLINIC**: SearchRag + GetAllServices + CallOperator (manca ReceiveInvoice + PaymentProcessStart)
- **HOTEL**: SearchRag + GetAllServices + CallOperator (manca ReceiveInvoice + PaymentProcessStart)

### 🚀 **NEXT DEVELOPMENT PRIORITIES**

#### **Phase 1: Sistema Fatturazione (HIGH PRIORITY)**

1. Implementare `ReceiveInvoice` calling function
2. Sistema filtro per codice ordine
3. Generazione link lista fatture
4. Template PDF fatture con compliance UE/IT

#### **Phase 2: Sistema Pagamenti (HIGH PRIORITY)**

1. Implementare `PaymentProcessStart` calling function
2. Integrazione gateway pagamento (Stripe/PayPal)
3. Generazione link pagamento sicuri
4. Tracking stato pagamento

#### **Phase 3: Completare CallOperator (COMPLETATO ✅)**

✅ **IMPLEMENTATO**: Invio email notifica operatore
✅ **IMPLEMENTATO**: Campo adminEmail in WhatsappSettings
✅ **IMPLEMENTATO**: Validazione frontend con campo obbligatorio
✅ **IMPLEMENTATO**: Template email professionale HTML/testo
✅ **IMPLEMENTATO**: Riassunto chat negli ultimi 10 messaggi
✅ **IMPLEMENTATO**: Gestione errori graceful e logging

**Prossimi step (opzionali)**: 2. Sistema escalation automatica 3. Template email personalizzabili 4. Dashboard operatori in tempo reale

### 🎉 **ANDREA'S ACHIEVEMENT**

**SISTEMA RIVOLUZIONARIO IMPLEMENTATO!** 🚀

Andrea ha creato la **base architecturale perfetta** per un sistema WhatsApp intelligente con:

✅ **Security Gateway** bulletproof
✅ **Calling Functions Infrastructure** ready
✅ **SearchRag** fully operational
✅ **GetAllProducts & GetAllServices** complete
✅ **CallOperator** COMPLETO (100%)
✅ **N8N Visual Workflow** for business logic
✅ **Session Token System** for security
✅ **Multi-business Architecture** ready for expansion

**FUNZIONI CF CORRETTE IDENTIFICATE:**

1. ✅ SearchRag (100%)
2. ✅ GetAllProducts (100%)
3. ✅ GetAllServices (100%)
4. ✅ CallOperator (100% - email implementata)
5. ❌ ReceiveInvoice (0% - con filtro codice ordine)
6. ❌ PaymentProcessStart (0% - in TODO)

**Il sistema è pronto per gestire qualsiasi tipo di business** con l'implementazione delle 2 funzioni CF mancanti! 🎯

---

## 🔔 **CALLOPERATOR - IMPLEMENTAZIONE COMPLETA**

### 📧 **Sistema Email Notifiche Admin**

**IMPLEMENTATO**: CallOperator ora include un sistema completo di notifiche email quando un utente richiede assistenza operatore.

#### **🛠️ Componenti Implementati:**

1. **📊 Database Schema**

   - Campo `adminEmail String?` aggiunto a `WhatsappSettings`
   - Migrazione: `20250720080133_add_admin_email_to_whatsapp_settings`
   - Seed aggiornato con email predefinita: `andrea_gelsomino@hotmail.com`

2. **🎨 Frontend - Settings Page**

   - Campo "Admin Email" obbligatorio con validazione
   - Controllo formato email in tempo reale
   - Messaggi di errore user-friendly
   - Descrizione campo per UX ottimale

3. **🔧 Backend API**

   - `getCurrentWorkspace()` include `adminEmail` da `whatsappSettings`
   - `updateWorkspace()` gestisce aggiornamento `adminEmail`
   - Integrazione seamless con architettura esistente

4. **📮 Servizio Email**
   - Template HTML professionale con branding
   - Template testo alternativo per compatibilità
   - Gestione errori graceful (continua anche se email fallisce)
   - Supporto SMTP configurabile + Ethereal Email per sviluppo

#### **📧 Email Template Features:**

#### **🤖 ContactOperator Function Enhanced:**

#### **🚀 Funzionalità Operative Aggiornate:**

- **Destinatario Email**: `adminEmail` (operatore) invece del cliente
- **Mittente Email**: `noreply@shopme.com` (fisso, professionale)
- **Subject**: `"🔔 Cliente [NOME] richiede assistenza operatore"` (italiano)
- **AI Summary**: Riassunto intelligente conversazione ultimo giorno (10 messaggi)
- **Email Content**: Dati cliente completi + riassunto AI + istruzioni contatto
- **Error Recovery**: Continua anche con email/AI failure, logging completo
- **Graceful Degradation**: Funziona anche senza email cliente

#### **📧 Email Template per Operatore:**

#[Sezione testing rimossa - non necessaria nel PRD business]

## UI Screenshots
````
