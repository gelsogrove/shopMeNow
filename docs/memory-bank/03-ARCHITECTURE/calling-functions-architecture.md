# Calling Functions Architecture - Clean Architecture / DDD

**Data**: 17 Ottobre 2025  
**Branch**: `84-design-implement-new-calling-functions-addproduct-repeatorder-full-befeprompt-integration`  
**Pattern**: Clean Architecture + Domain-Driven Design  
**Status**: 5 Functions Registered & Prioritized

---

## 🎯 Obiettivo

Questo documento descrive l'architettura delle **Calling Functions** nel sistema ShopME, seguendo i principi di **Clean Architecture** e **Domain-Driven Design (DDD)**.

⚠️ **IMPORTANTE**: Per specifiche dettagliate, trigger semantici ed esempi → vedi `docs/prompt_agent.md` sezione "CALLING FUNCTIONS"

## 📊 Priorità e Funzioni Registrate (5 Total)

| Priorità | Function           | Tipo       | Descrizione                           |
| -------- | ------------------ | ---------- | ------------------------------------- |
| 🚨 1     | ContactOperator    | Bloccante  | Assistenza umana, escalation          |
| 🚨 2     | GetLinkOrderByCode | Bloccante  | Visualizza ordine specifico           |
| ⚙️ 3     | repeatOrder        | Bloccante  | Ripete ordine precedente (conferma)   |
| ⚙️ 4     | addProduct         | Bloccante  | Aggiunge singolo prodotto (conferma)  |
| 📊 5     | searchProduct      | Background | Registra ricerca prodotto (analytics) |

**Regole Disambiguazione**:

- Frustrazione utente → ContactOperator (PRIORITÀ 1)
- "Dammi ultimo ordine" → GetLinkOrderByCode (PRIORITÀ 2)
- "Ripeti ordine" → repeatOrder (PRIORITÀ 3)
- "Aggiungi burrata" → addProduct (PRIORITÀ 4, dopo conferma)
- "Hai la burrata?" → searchProduct (PRIORITÀ 5, BACKGROUND)

---

## 📐 Principi Architetturali

### Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    External Layer                        │
│  (LLM API, WhatsApp API, Database)                      │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────┐
│                 Interface/Services Layer                 │
│  services/ - External integrations (LLM, WhatsApp)      │
│  CallingFunctionsService (orchestrator)                 │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│  application/services/ - Business logic orchestration   │
│  LinkReplacementService, FunctionHandlerService         │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────┐
│                    Domain Layer                          │
│  domain/calling-functions/ - Core business logic        │
│  ContactOperator, GetLinkOrderByCode,                   │
│  AddProduct, RepeatOrder, SearchProduct                 │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Struttura Directory

### Attuale (Clean Architecture)

```
backend/src/
├── domain/
│   └── calling-functions/           # 🎯 CORE BUSINESS LOGIC (5 functions)
│       ├── ContactOperator.ts       # LLM-callable: Escalation operatore
│       ├── GetLinkOrderByCode.ts    # LLM-callable: Dettagli ordine
│       ├── AddProduct.ts            # LLM-callable: Aggiunge prodotto al carrello (NEW)
│       ├── RepeatOrder.ts           # LLM-callable: Ripete ordine precedente (NEW)
│       └── SearchProduct.ts         # LLM-callable: Background tracking ricerche (NEW)
│
├── application/services/            # 📋 APPLICATION SERVICES
│   ├── link-replacement.service.ts  # Utility: Token replacement
│   └── function-handler.service.ts  # Handler per function calls (con case per 5 funzioni)
│
├── services/                        # 🔌 EXTERNAL INTEGRATIONS
│   ├── calling-functions.service.ts # Orchestrator (con addProductToCart method)
│   ├── llm.service.ts               # OpenRouter integration
│   └── formatter.service.ts         # Response formatting
│
└── interfaces/http/                 # 🌐 HTTP LAYER
    └── controllers/
```

### ❌ Vecchia (Prima del refactoring)

```
backend/src/
└── chatbot/
    └── calling-functions/           # ❌ CONFUSO: Mix domain + utility
        ├── ContactOperator.ts       # Domain logic
        ├── GetLinkOrderByCode.ts    # Domain logic
        └── ReplaceLinkWithToken.ts  # ❌ Utility (non domain!)
```

**Problemi risolti**:

- ❌ Mix di domain logic e utility functions
- ❌ Cartella `chatbot/` senza chiaro scopo architetturale
- ❌ Violazione Separation of Concerns

---

## 🔧 Le 5 Calling Functions (Domain Layer)

⚠️ **RIFERIMENTO COMPLETO**: Vedi `docs/prompt_agent.md` sezione "CALLING FUNCTIONS" per:

- Trigger semantici completi (multilingua)
- Esempi d'uso dettagliati
- Regole disambiguazione
- Flow obbligatori

### 1. ContactOperator (🚨 PRIORITY 1)

**File**: `domain/calling-functions/ContactOperator.ts`  
**Tipo**: Bloccante (interrompe flusso normale)  
**Scopo**: Escalation a operatore umano per assistenza specializzata o frustrazione.

**Trigger Principali**:

- Richiesta esplicita: "voglio parlare con operatore", "assistenza umana"
- Frustrazione: "stufo", "problema", "danneggiata", "sempre", "ogni volta"

**Signature**:

```typescript
export async function ContactOperator(
  request: ContactOperatorRequest
): Promise<ContactOperatorResult>

interface ContactOperatorRequest {
  phoneNumber: string
  workspaceId: string
  customerId?: string
  reason?: string
}
```

**Responsabilità**:

- ✅ Registra richiesta di escalation
- ✅ Crea ticket/record nel database
- ✅ Ritorna messaggio di conferma per il cliente
- ❌ NON invia email/notifiche (responsabilità di altro service)

---

### 2. GetLinkOrderByCode (🚨 PRIORITY 2)

**File**: Implementato in `services/calling-functions.service.ts::getOrdersListLink()`  
**Tipo**: Bloccante (interrompe flusso normale)  
**Scopo**: Genera link per visualizzare un ordine specifico o ultimo ordine.

**Trigger Principali**:

- "dammi ultimo ordine"
- "mostrami ordine ORD-123"
- "fattura ordine"
- "dettagli ordine"

**Signature**:

```typescript
// Implementato in services/calling-functions.service.ts
async getOrdersListLink(request: GetOrdersListLinkRequest): Promise<any>

interface GetOrdersListLinkRequest {
  customerId: string
  workspaceId: string
  orderCode?: string // Se omesso, usa ultimo ordine
}
```

**Responsabilità**:

- ✅ Recupera ordine da database
- ✅ Genera token sicuro con SecureTokenService
- ✅ Crea link pubblico `/orders-public?token=xxx` o `/orders-public/ORDER_CODE?token=xxx`
- ✅ Validità: 1 ora
- ❌ NON modifica stato ordine

---

### 3. repeatOrder (⚙️ PRIORITY 3)

**File**: `domain/calling-functions/RepeatOrder.ts`  
**Tipo**: Bloccante (richiede conferma utente)  
**Scopo**: Ripete esattamente lo stesso ordine precedente, aggiungendo TUTTI i prodotti al carrello.

**Trigger Principali**:

- "ripeti ordine"
- "ordina di nuovo come prima"
- "voglio lo stesso di prima"
- "come l'ultima volta"

**Flow Obbligatorio**:

1. Mostra contenuto ordine
2. Chiedi conferma: "Ricreo il tuo ultimo ordine?"
3. Se conferma → esegui repeatOrder()

**Signature**:

```typescript
export async function RepeatOrder(
  request: RepeatOrderRequest
): Promise<RepeatOrderResult>

interface RepeatOrderRequest {
  customerId: string
  workspaceId: string
  orderCode?: string // Se omesso, usa ultimo ordine
}
```

**Responsabilità**:

- ✅ Recupera ordine precedente con prodotti
- ✅ Svuota carrello esistente
- ✅ Aggiunge TUTTI i prodotti dell'ordine al carrello
- ✅ Verifica disponibilità stock
- ✅ Ritorna link carrello
- ❌ NON procede con checkout

---

### 4. addProduct (⚙️ PRIORITY 4)

**File**: `domain/calling-functions/AddProduct.ts`  
**Tipo**: Bloccante (richiede conferma utente)  
**Scopo**: Aggiunge UN SINGOLO PRODOTTO al carrello dopo conferma esplicita.

**Trigger Principali**:

- SOLO dopo conferma: "sì", "ok", "perfetto", "aggiungi", "vai"
- ⚠️ **IMPORTANTE**: Deve essere preceduta da: "Vuoi aggiungerlo al carrello?"

**Flow Obbligatorio**:

1. Mostra prodotto con prezzo e stock
2. Chiedi: "Vuoi aggiungerlo al carrello? 🛒"
3. Se conferma → esegui addProduct()

**Signature**:

```typescript
export async function AddProduct(
  request: AddProductRequest
): Promise<AddProductResult>

interface AddProductRequest {
  customerId: string
  workspaceId: string
  productCode: string // Codice esatto del prodotto
  quantity: number // Quantità (default: 1, minimo 1)
  notes?: string // Note opzionali (es: "grande", "bio")
}

interface AddProductResult {
  success: boolean
  message: string
  cartCode?: string
  productName?: string
  quantity?: number
  cartUrl?: string // URL pubblico carrello con token
  error?: string
}
```

**Responsabilità**:

- ✅ Valida parametri (customerId, workspaceId, productCode, quantity)
- ✅ Verifica esistenza prodotto
- ✅ Controlla stock disponibile (fail se insufficiente)
- ✅ Trova o crea carrello del cliente
- ✅ Aggiunge prodotto (o aggiorna quantità se già presente)
- ✅ Ritorna link carrello
- ❌ NON completa automaticamente l'ordine

---

### 5. searchProduct (📊 PRIORITY 5 - BACKGROUND)

**File**: `domain/calling-functions/SearchProduct.ts`  
**Tipo**: BACKGROUND (non-blocking, eseguito in parallelo)  
**Scopo**: Registra ricerca prodotto per analytics e trend analysis.

**Trigger Principali**:

- "hai la burrata?"
- "avete prosciutto?"
- "vendete champagne?"
- "non trovate tartufo?" (ANCHE prodotti NON trovati)

**⚠️ COMPORTAMENTO SPECIALE - BACKGROUND FUNCTION**:

- ✅ Viene eseguita in PARALLELO alla risposta LLM
- ✅ L'utente NON è consapevole della chiamata
- ✅ Il LLM continua a rispondere normalmente
- ✅ NON blocca il flusso conversazionale
- ❌ NON mostrare messaggi tipo "sto registrando"

**Signature**:

```typescript
export async function SearchProduct(
  request: SearchProductRequest
): Promise<SearchProductResult>

interface SearchProductRequest {
  customerId: string
  workspaceId: string
  productName: string // Nome prodotto cercato (max 255 caratteri)
}

interface SearchProductResult {
  success: boolean
  message: string
  recorded: boolean
  error?: string
}
```

**Responsabilità**:

- ✅ Registra ricerca nel database (table: ProductSearch)
- ✅ Salva: customerId, workspaceId, productName, timestamp, productFound (true/false)
- ✅ Aggregazione per analytics dashboard
- ❌ NON restituisce prodotti (delegato al prompt dinamico)
- ❌ NON interrompe flusso conversazionale

**Implementazione Background** (in llm.service.ts):

````typescript
// Funzioni BACKGROUND - Non bloccare il flusso conversazionale
const BACKGROUND_FUNCTIONS = ["searchProduct"]

if (BACKGROUND_FUNCTIONS.includes(functionName)) {
  // Esegui in background (non aspettare risultato)
  this.executeFunctionCall(...).catch(error => {
    console.error(`❌ [BACKGROUND] Error:`, error)
  })

  // LLM continua a rispondere normalmente
  const followUpResponse = await fetch(...)
  return { response: naturalResponse }
}
3. Cliente conferma: "Sì"
4. LLM chiama `addProduct(productCode: "BUR-001", quantity: 1)`
5. Prodotto aggiunto a carrello
6. LLM mostra link checkout

**Validazioni**:

- ✅ ProductCode deve corrispondere a prodotto isActive
- ✅ Stock >= quantity richiesta
- ✅ Quantity deve essere intero positivo
- ✅ Workspace isolation (solo prodotti del workspace)

---

## 5. repeatOrder (NEW)

**File**: `domain/calling-functions/RepeatOrder.ts`

**Scopo**: Ripete un ordine precedente (ultimo o specifico) aggiungendo tutti i prodotti al carrello.

**Trigger LLM** (da `docs/prompt_agent.md` line 350):

- "Ripeti il mio ultimo ordine"
- "Ordina di nuovo come l'ultima volta"
- "Voglio lo stesso di prima"
- "Ordina come l'ultima volta"

**Signature**:

```typescript
export async function RepeatOrder(
  request: RepeatOrderRequest
): Promise<RepeatOrderResult>

interface RepeatOrderRequest {
  customerId: string
  workspaceId: string
  orderCode?: string // Se omesso, usa ultimo ordine
}

interface RepeatOrderResult {
  success: boolean
  message: string
  cartCode?: string
  orderCode?: string // Ordine copiato
  productsAdded?: number // Numero prodotti aggiunti
  cartUrl?: string // URL pubblico carrello
  expiresAt?: string
  timestamp: string
  error?: string
}
````

**Responsabilità**:

- ✅ Valida customerId e workspaceId
- ✅ Se orderCode omesso → trova ultimo ordine del cliente
- ✅ Se orderCode specificato → valida esista e appartenga al cliente
- ✅ Recupera tutti gli OrderItems dell'ordine
- ✅ Svuota carrello esistente (ricomincia pulito)
- ✅ Per ogni item: verifica ancora disponibile e in stock
- ✅ Aggiunge solo items disponibili al carrello
- ✅ Avvisa cliente se alcuni prodotti non sono più disponibili
- ✅ Genera token SecureToken per accesso pubblico carrello
- ✅ Ritorna URL carrello con validità 1 ora
- ❌ NON copia note/preferenze dall'ordine originale (solo quantity)

**Flow**:

1. Cliente: "Ripeti il mio ultimo ordine"
2. LLM richiede conferma: "Ricreo il tuo ultimo ordine nel carrello?"
3. Cliente: "Sì"
4. LLM chiama `repeatOrder(orderCode: undefined)` → usa ultimo
5. Carrello svuotato e ripopolato
6. LLM mostra: "Ho aggiunto 4 prodotti al carrello" + link checkout

**Validazioni**:

- ✅ OrderCode (se specificato) deve essere dell'ordine del cliente
- ✅ Solo OrderItems con status != CANCELLED aggiunti
- ✅ Verificare stock prima di aggiungere
- ✅ Workspace isolation (solo ordini del workspace)

**Gestione disponibilità**:

```typescript
// Se un prodotto non è più disponibile:
if (!product || product.stock === 0) {
  // Skip: non aggiungere al carrello
  // Notificare cliente nel messaggio di risposta
  productsSkipped.push({ name: product.name, reason: "Out of stock" })
}
```

---

## 6. searchProduct (NEW)

**File**: `domain/calling-functions/SearchProduct.ts`

**Scopo**: Registra ricerche di prodotti in background per analytics e trend analysis. È una **background function** - non interrompe il flusso conversazionale LLM.

**Tipo**: ⚠️ **BACKGROUND FUNCTION** - Nessun impatto diretto sulla conversazione

**Trigger LLM** (da `docs/prompt_agent.md` sezione 🔍 searchProduct):

**Caso 1 - Prodotto trovato**:

- "hai la burrata?"
- "cercami un vino rosso"
- "mi serve del parmigiano"
- "avete prosciutto?"

**Caso 2 - Prodotto NON trovato**:

- "non trovate il tartufo?"
- "non avete la mozzarella fresca?"
- "non vendete champagne?"
- "il salmone non lo avete?"

**Signature**:

```typescript
export async function SearchProduct(
  request: SearchProductRequest
): Promise<SearchProductResult>

interface SearchProductRequest {
  customerId: string
  workspaceId: string
  productName: string // Nome prodotto cercato (max 255 chars)
}

interface SearchProductResult {
  success: boolean
  message: string
  searchId?: string // ID della ricerca registrata
  timestamp: string
  error?: string
}
```

**Responsabilità**:

- ✅ Valida customerId e workspaceId
- ✅ Valida productName (non vuoto, max 255 caratteri)
- ✅ Registra ricerca in tabella `ProductSearch`
- ✅ Salva timestamp della ricerca
- ✅ Workspace isolation (legata a workspaceId)
- ✅ Non interrompe conversazione LLM (background only)
- ❌ NON modifica carrello, NON cambia ordini
- ❌ NON filtra per disponibilità (registra qualunque ricerca)

**Database**:

```typescript
// Tabella ProductSearch (schema.prisma)
model ProductSearch {
  id        String   @id @default(cuid())
  query     String   @db.VarChar(255)  // Nome prodotto cercato
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  workspaceId String
  customer  Customers? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  customerId String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId])
  @@index([customerId])
  @@index([createdAt])
  @@index([query])
}
```

**Flow**:

1. Cliente: "Hai della burrata?"
2. LLM risponde: "Sì, abbiamo burrata fresca!" (risposta normale)
3. **IN BACKGROUND**: LLM chiama `searchProduct(productName: "burrata")`
4. Ricerca registrata in ProductSearch table
5. ✅ Cliente continua conversazione senza sapere della registrazione
6. 📊 Data disponibile per analytics dashboard

**Validazioni**:

- ✅ productName non vuoto (trim + length check)
- ✅ productName max 255 caratteri
- ✅ workspaceId presente
- ✅ customerId presente (o null se anonimo)
- ✅ Salva anche ricerche di prodotti non trovati

**Gestione errori**:

```typescript
// Se productName è vuoto
if (!productName?.trim()) {
  return {
    success: false,
    error: "productName cannot be empty",
    message: "Invalid product name"
  }
}

// Se productName troppo lungo
if (productName.length > 255) {
  return {
    success: false,
    error: "productName exceeds 255 characters",
    message: "Product name too long"
  }
}

// Database error
catch (error) {
  return {
    success: false,
    error: error.message,
    message: "Failed to register search"
  }
}
```

**Analytics Use Cases**:

- 📊 **Top 10 Searched Products**: Quali prodotti cercano di più i clienti?
- 📈 **Trend Analysis**: Prodotti più cercati negli ultimi 7/30 giorni
- 🎯 **Inventory Planning**: Se molti cercano un prodotto non disponibile → opportunità stock
- 🔍 **Search Gaps**: Prodotti cercati ma non trovati nel catalog
- 👥 **Customer Behavior**: Quali clienti cercano cosa e quando

**Importante - Background Execution**:

```typescript
// ✅ CORRETTO - Registra in background senza bloccare risposta
LLM Response: "Sì, abbiamo burrata fresca!"
InBackground: searchProduct("burrata")  // NON blocca

// ❌ SBAGLIATO - Bloccherebbe la risposta
await searchProduct("burrata")  // Attende completamento
LLM Response: "Sì, abbiamo burrata fresca!"  // Ritardata
```

---

## 🛠️ Link Replacement Service (Application Layer)

### LinkReplacementService

**File**: `application/services/link-replacement.service.ts`

**Scopo**: Utility service per sostituire token placeholder con link reali.

**NON è una Calling Function LLM!** È un servizio di supporto.

**Tokens supportati**:

- `[LINK_CHECKOUT_WITH_TOKEN]` → Link carrello/checkout
- `[LINK_PROFILE_WITH_TOKEN]` → Link profilo cliente
- `[LINK_ORDERS_WITH_TOKEN]` → Link lista ordini
- `[LINK_CATALOG]` → Link catalogo prodotti
- `[USER_DISCOUNT]` → Percentuale sconto cliente
- `[LIST_OFFERS]` → Lista offerte
- `[LIST_SERVICES]` → Lista servizi
- `[LIST_CATEGORIES]` → Lista categorie

**Signature**:

```typescript
export class LinkReplacementService {
  async replaceTokens(
    params: ReplaceLinkWithTokenParams,
    customerId: string,
    workspaceId: string
  ): Promise<ReplaceLinkWithTokenResult>
}

// Legacy export per backward compatibility
export async function ReplaceLinkWithToken(...)
```

**Usato da**:

- `LLMService` - Sostituisce token in risposte AI
- `FormatterService` - Formatta risposte prima dell'invio
- `PromptProcessorService` - Processa prompt template

---

## 🔄 Flusso di Esecuzione

### Scenario: Cliente chiede "dov'è il mio ordine?"

```
1. Cliente WhatsApp
   └─> "Dov'è il mio ordine?"

2. LLMService.handleMessage()
   └─> OpenRouter API (Claude-3.5-Haiku)
       └─> System prompt con available_functions
           └─> LLM decide: GetShipmentTrackingLink()

3. FunctionHandlerService.handleGetShipmentTrackingLink()
   └─> require("../../domain/calling-functions/GetShipmentTrackingLink")
       └─> GetShipmentTrackingLink({ customerId, workspaceId })

4. Domain Layer: GetShipmentTrackingLink.ts
   ├─> Prisma: trova ordine + trackingNumber
   ├─> Genera URL DHL
   ├─> URLShortenerService: crea short link
   └─> Return: { success: true, linkUrl: "short.link/abc123" }

5. LLMService.handleMessage()
   ├─> Formatta risposta: "Ecco il tracking: [link]"
   └─> LinkReplacementService NON necessario (link già generato)

6. FormatterService.formatResponse()
   └─> Markdown → WhatsApp formatting

7. WhatsApp API
   └─> Cliente riceve: "Ecco il tracking della tua spedizione: short.link/abc123"
```

---

## ✅ Best Practices Seguite

### 1. Separation of Concerns

✅ **Domain Logic** separata da **Application Logic** separata da **Infrastructure**

- `domain/calling-functions/` → Solo business logic pura
- `application/services/` → Orchestrazione e utility
- `services/` → Integrazioni esterne (LLM, WhatsApp)

### 2. Dependency Rule

✅ **Dipendenze puntano sempre verso l'interno**

```
External APIs → Services → Application → Domain
     ↓              ↓            ↓           ↓
  (nessuna dipendenza verso esterno) ← Domain è puro
```

### 3. Single Responsibility Principle

✅ **Ogni function ha una sola responsabilità**

- `ContactOperator` → Solo escalation
- `GetShipmentTrackingLink` → Solo tracking link
- `GetLinkOrderByCode` → Solo order details link
- `LinkReplacementService` → Solo token replacement

### 4. Open/Closed Principle

✅ **Estendibile senza modifiche**

Aggiungere nuova calling function:

1. Crea file in `domain/calling-functions/`
2. Registra in `CallingFunctionsService`
3. Aggiungi al system prompt LLM

**NON serve modificare** altre calling functions esistenti.

### 5. Dependency Inversion Principle

✅ **Domain non dipende da dettagli implementativi**

- Domain functions NON importano Prisma direttamente (usano require locale)
- Domain functions NON conoscono WhatsApp API
- Domain functions NON conoscono OpenRouter

---

## 🧪 Testing Strategy

### Unit Tests

**File**: `src/__tests__/unit/calling-functions.spec.ts`

**Verifica**:

1. ✅ File structure (3 file in `domain/calling-functions/`)
2. ✅ Export/import corretto
3. ✅ Signature functions corretta
4. ✅ Integrazione con CallingFunctionsService
5. ✅ Allineamento con `docs/prompt_agent.md`

**Test Coverage**:

- File existence verification
- Import/export validation
- Function signature checks
- Integration with service layer
- Documentation alignment

### Integration Tests

**Scenario**:

1. Mock database con ordini test
2. Call `GetShipmentTrackingLink({ customerId, workspaceId })`
3. Verify: link DHL generato, short URL creato, 1h expiry

---

## 📋 Migration Guide

### Per aggiungere nuova Calling Function

#### 1. Crea file in domain layer

```typescript
// domain/calling-functions/NewFunction.ts

export interface NewFunctionRequest {
  customerId: string
  workspaceId: string
  // ... parametri specifici
}

export async function NewFunction(
  request: NewFunctionRequest
): Promise<NewFunctionResult> {
  try {
    // Business logic pura
    // NO dependencies da services esterni
    // NO side effects globali

    return {
      success: true,
      // ... risultato
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    }
  }
}
```

#### 2. Registra in CallingFunctionsService

```typescript
// services/calling-functions.service.ts

public async newFunction(
  request: NewFunctionRequest
): Promise<StandardResponse> {
  try {
    const { NewFunction } = require("../domain/calling-functions/NewFunction")
    const result = await NewFunction(request)
    return result
  } catch (error) {
    return this.createErrorResponse(error, "newFunction")
  }
}
```

#### 3. Aggiungi al system prompt

```markdown
<!-- docs/prompt_agent.md -->

## 📌 NewFunction(params)

**QUANDO USARE**: [descrizione trigger]

**TRIGGER SEMANTICI**:

- "frase trigger 1"
- "frase trigger 2"

**LOGICA**:

- [descrizione comportamento]
```

#### 4. Aggiungi test

```typescript
// src/__tests__/unit/calling-functions.spec.ts

it("should export NewFunction function", async () => {
  const { NewFunction } = require("../../domain/calling-functions/NewFunction")
  expect(NewFunction).toBeDefined()
  expect(typeof NewFunction).toBe("function")
})
```

---

## 🔍 Debugging & Troubleshooting

### Problema: "Cannot find module '../chatbot/calling-functions/XXX'"

**Causa**: Vecchio import path non aggiornato

**Soluzione**:

```bash
# Cerca vecchi import
grep -r "chatbot/calling-functions" backend/src/

# Sostituisci con nuovi path
# Domain functions: domain/calling-functions/
# LinkReplacement: application/services/link-replacement.service
```

### Problema: "Calling function non viene chiamata dall'LLM"

**Checklist**:

1. ✅ Function definita in `docs/prompt_agent.md`?
2. ✅ Trigger semantici chiari e specifici?
3. ✅ Function registrata in `CallingFunctionsService`?
4. ✅ Function signature corretta (async, return Promise)?
5. ✅ LLMService ha accesso al system prompt aggiornato?

### Problema: "Function ritorna sempre error"

**Debug**:

```typescript
// Aggiungi console.log nella function
console.log("📞 NewFunction called with:", request)
console.log("✅ NewFunction result:", result)
console.log("❌ NewFunction error:", error)
```

Controlla logs: `backend/logs/`

---

## 📚 Riferimenti

### Documentazione Interna

- [PRD.md](../../PRD.md) - Product Requirements Document
- [prompt_agent.md](../../prompt_agent.md) - System prompt LLM con calling functions
- [backend-best-practices.md](../04-BEST-PRACTICES/backend-best-practices.md) - Clean Architecture guide

### Pattern & Principles

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) - Uncle Bob
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html) - Martin Fowler
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID) - Wikipedia

### Testing

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](../04-BEST-PRACTICES/backend-best-practices.md#testing)

---

## 🎯 Conclusioni

### ✅ Vantaggi Architettura Attuale

1. **Chiara separazione** Domain vs Application vs Services
2. **Facile testing** - Functions isolate e pure
3. **Estendibilità** - Aggiungere functions senza modificare esistenti
4. **Manutenibilità** - Ogni file ha scope ben definito
5. **Documentazione** - Struttura auto-documentante

### 🚀 Prossimi Step

- [ ] Aggiungere integration tests per ogni calling function
- [ ] Creare OpenAPI schema per calling functions
- [ ] Implementare rate limiting per calling functions
- [ ] Aggiungere metrics/telemetry per monitoring
- [ ] Documentare error codes standard

---

**Ultimo aggiornamento**: 14 Ottobre 2025  
**Autore**: Andrea + AI Assistant  
**Status**: ✅ PRODUCTION READY - Clean Architecture implementata
