# Calling Functions Architecture - Clean Architecture / DDD

**Data**: 14 Ottobre 2025  
**Branch**: `01-layer-security`  
**Pattern**: Clean Architecture + Domain-Driven Design

---

## 🎯 Obiettivo

Questo documento descrive l'architettura delle **Calling Functions** nel sistema ShopME, seguendo i principi di **Clean Architecture** e **Domain-Driven Design (DDD)**.

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
│  ContactOperator, GetShipmentTrackingLink,              │
│  GetLinkOrderByCode                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Struttura Directory

### Attuale (Clean Architecture)

```
backend/src/
├── domain/
│   └── calling-functions/           # 🎯 CORE BUSINESS LOGIC
│       ├── ContactOperator.ts       # LLM-callable: Escalation operatore
│       ├── GetShipmentTrackingLink.ts  # LLM-callable: Tracking DHL
│       └── GetLinkOrderByCode.ts    # LLM-callable: Dettagli ordine
│
├── application/services/            # 📋 APPLICATION SERVICES
│   ├── link-replacement.service.ts  # Utility: Token replacement
│   └── function-handler.service.ts  # Handler per function calls
│
├── services/                        # 🔌 EXTERNAL INTEGRATIONS
│   ├── calling-functions.service.ts # Orchestrator
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
        ├── GetShipmentTrackingLink.ts  # Domain logic
        ├── GetLinkOrderByCode.ts    # Domain logic
        └── ReplaceLinkWithToken.ts  # ❌ Utility (non domain!)
```

**Problemi risolti**:
- ❌ Mix di domain logic e utility functions
- ❌ Cartella `chatbot/` senza chiaro scopo architetturale
- ❌ Violazione Separation of Concerns

---

## 🔧 Le 3 Calling Functions (Domain Layer)

### 1. ContactOperator

**File**: `domain/calling-functions/ContactOperator.ts`

**Scopo**: Escalation a operatore umano quando il cliente richiede assistenza personale.

**Trigger LLM** (da `docs/prompt_agent.md` line 177):
- "voglio parlare con operatore"
- "assistenza umana"
- "customer service"
- Trigger di frustrazione: "stufo", "problema", "danneggiata"

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

### 2. GetShipmentTrackingLink

**File**: `domain/calling-functions/GetShipmentTrackingLink.ts`

**Scopo**: Genera link DHL per tracciare la spedizione di un ordine.

**Trigger LLM** (da `docs/prompt_agent.md` line 210):
- "dov'è il mio ordine?"
- "tracking spedizione"
- "quando arriva il pacco?"
- "dove si trova il mio ordine?"

**Signature**:
```typescript
export async function GetShipmentTrackingLink(
  request: GetShipmentTrackingLinkRequest
): Promise<GetShipmentTrackingLinkResult>

interface GetShipmentTrackingLinkRequest {
  customerId: string
  workspaceId: string
  orderCode?: string // Se omesso, usa ultimo ordine
}
```

**Responsabilità**:
- ✅ Recupera ordine da database con tracking number
- ✅ Genera URL DHL: `https://www.dhl.com/.../tracking-id=XXX`
- ✅ Crea short URL tramite URLShortenerService
- ✅ Ritorna link tracciabile (1 ora validità)
- ❌ NON modifica stato ordine

---

### 3. GetLinkOrderByCode

**File**: `domain/calling-functions/GetLinkOrderByCode.ts`

**Scopo**: Genera link sicuro per visualizzare dettagli di un ordine specifico.

**Trigger LLM** (da `docs/prompt_agent.md` line 247):
- "dammi ordine"
- "mostrami ultimo ordine"
- "fattura ordine XXX"
- "dettagli ordine"

**Signature**:
```typescript
export async function GetLinkOrderByCode(
  request: GetLinkOrderByCodeRequest
): Promise<any>

interface GetLinkOrderByCodeRequest {
  customerId: string
  workspaceId: string
  orderCode?: string // Se omesso, usa ultimo ordine
  documentType?: string // 'order' | 'invoice'
  language?: string // 'it' | 'en' | 'es' | 'pt'
}
```

**Responsabilità**:
- ✅ Usa `CallingFunctionsService.getOrdersListLink()`
- ✅ Genera token sicuro con SecureTokenService
- ✅ Crea link pubblico `/orders-public?token=xxx`
- ✅ Validità: 1 ora
- ❌ NON recupera direttamente i dati ordine (delegato a controller)

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
      error: error.message
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
