# 🔧 Calling Functions - Technical Documentation

**Data aggiornamento**: 31 Ottobre 2025  
**Branch**: `122-rag-con-prodcuct`

---

## 📋 OVERVIEW

Il sistema LLM di ShopME utilizza **Calling Functions** per eseguire azioni nel sistema quando l'utente interagisce con il chatbot. 

**ARCHITETTURA ATTUALE**:
- **Router Agent**: Definisce funzioni in `backend/src/config/agent-functions.ts` → OpenRouter API
- **OLD System** (deprecated): `backend/src/services/llm.service.ts` → legacy functions

Le funzioni sono eseguite tramite `CallingFunctionsService.executeFunction()`.

---

## 🎯 FUNZIONI DISPONIBILI ROUTER AGENT (17 TOTALI)

### 🔔 **manageNotifications** 🆕

**Tipo**: Standard (Bloccante)  
**Quando usare**: Cliente richiede esplicitamente di iscriversi/disiscriversi alle notifiche push

**Trigger semantici**:
- 🇮🇹 "voglio ricevere offerte", "iscrivimi alle notifiche", "non voglio più messaggi", "disiscrivimi"
- 🇬🇧 "subscribe me", "I want offers", "unsubscribe", "stop notifications"
- 🇪🇸 "quiero recibir ofertas", "suscribirse", "cancelar suscripción"
- 🇵🇹 "quero receber ofertas", "inscrever-me", "cancelar inscrição"

**Parametri**:
```typescript
{
  action: "SUBSCRIBE" | "UNSUBSCRIBE"  // Azione da eseguire
}
```

**Comportamento**:
1. ⚠️ **IMPORTANTE**: Richiedere sempre conferma esplicita prima di chiamare funzione
2. Cliente esprime intenzione ("voglio ricevere offerte")
3. Agent conferma: "Vuoi iscriverti alle notifiche promozionali?"
4. Cliente conferma: "sì", "yes", "si"
5. Chiamare funzione con action appropriata
6. Mostrare messaggio di conferma

**Flow Conversazionale**:
```
Cliente: "Voglio ricevere le offerte"
Agent: "Perfetto! Vuoi iscriverti alle notifiche promozionali?"
Cliente: "Sì"
Agent: [CALL manageNotifications(action: "SUBSCRIBE")]
Agent: "✅ Ti sei iscritto! Riceverai notifiche sulle nostre offerte."
```

**Implementazione Router Agent**:
```typescript
// backend/src/config/agent-functions.ts
{
  name: "manageNotifications",
  description: "Manage customer's push notification subscription...",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["SUBSCRIBE", "UNSUBSCRIBE"]
      }
    },
    required: ["action"]
  }
}
```

**Esecuzione**:
```typescript
// backend/src/services/calling-functions.service.ts (line 315)
async manageNotifications(args: { action: "SUBSCRIBE" | "UNSUBSCRIBE" }, context: any) {
  const { customerId, workspaceId } = context
  
  // Update customer pushNotificationsEnabled field
  await this.prisma.customers.update({
    where: { id: customerId, workspaceId },
    data: { 
      pushNotificationsEnabled: args.action === "SUBSCRIBE" 
    }
  })
  
  const message = args.action === "SUBSCRIBE"
    ? "✅ Iscrizione confermata! Riceverai le nostre offerte."
    : "✅ Disiscrizione confermata. Non riceverai più notifiche."
    
  return { success: true, message }
}
```

**Token nel Prompt**: `{{SUBSCRIBE_MESSAGE}}` - Messaggio personalizzato per workspace

---

### 📋 **LISTA COMPLETA FUNZIONI ROUTER AGENT**

#### **Sub-Agent Delegation Functions (4)**:
1. `productSearchAgent` - Delega a specialist per ricerca prodotti complessa
2. `cartManagementAgent` - Delega a specialist per gestione carrello
3. `orderTrackingAgent` - Delega a specialist per tracking ordini
4. `customerSupportAgent` - Delega a specialist per supporto clienti

#### **Direct Business Functions (12)**:
1. `searchProducts` - Ricerca prodotti con filtri (keywords, category, price, allergens, certifications)
2. `searchProductByCertifications` - Ricerca per certificazioni specifiche (bio, halal, vegan)
3. `addToCart` - Aggiungi prodotto al carrello (productId, quantity, notes)
4. `viewCart` - Visualizza contenuto carrello attuale
5. `removeFromCart` - Rimuovi item dal carrello (cartItemId)
6. `updateCartQuantity` - Aggiorna quantità item (cartItemId, quantity)
7. `clearCart` - Svuota completamente carrello
8. `repeatLastOrder` - Ripeti ultimo ordine completato
9. `getOrders` - Lista ordini cliente (status, limit)
10. `getOrder` - Dettaglio ordine specifico (orderId)
11. `trackOrder` - Traccia stato ordine (orderId)
12. `sendInvoice` - Invia fattura via email (orderId)

#### **Customer Engagement Functions (2)**:
1. `contactSupport` - Crea ticket supporto (reason, urgency: low/medium/high)
2. `manageNotifications` 🆕 - Gestisci iscrizione push notifications (action: SUBSCRIBE/UNSUBSCRIBE)

#### **Safety Functions (1)**:
1. `sendAlertEmail` - Invia alert via email per situazioni critiche

**TOTALE: 17 FUNZIONI**

---

## 🎯 FUNZIONI LEGACY (OLD SYSTEM - 5 TOTALI)

### 1. **ContactOperator** ✅

**Tipo**: Bloccante (Standard)  
**Quando usare**: Utente richiede esplicitamente assistenza umana o mostra frustrazione

**Trigger semantici**:

- 🇮🇹 "operatore", "assistenza umana", "parlare con qualcuno"
- 🇬🇧 "operator", "human assistance", "speak with someone"

**Parametri**: Nessuno (automatico)

**Comportamento**:

1. Crea ticket di supporto nel sistema
2. Notifica team operatori
3. Ritorna messaggio conferma all'utente

**Implementazione**:

```typescript
case "ContactOperator":
  return await this.callingFunctionsService.contactOperator({
    customerId: customer.id,
    workspaceId: workspace.id,
    phoneNumber: customer.phone,
  })
```

---

### 2. **GetLinkOrderByCode** ✅

**Tipo**: Bloccante (Standard)  
**Quando usare**: Utente vuole vedere ordine specifico, fattura, o dice "ultimo ordine"

**Trigger semantici**:

- 🇮🇹 "vedi ordine", "mostra ordine", "ultimo ordine", "fattura"
- 🇬🇧 "show order", "view order", "last order", "invoice"

**Parametri**:

```typescript
{
  orderCode: string // Es: "ORD-123" o {{lastordercode}}
}
```

**Comportamento**:

1. Verifica ordine esiste nel database
2. Genera link sicuro con token temporaneo (1 ora)
3. Ritorna link all'utente

**Response Format**:

```
"Ciao! Di seguito il link dell'ordine: http://localhost:3000/s/xxx - valido per 1 ora"
```

**Implementazione**:

```typescript
case "GetLinkOrderByCode":
  return await this.callingFunctionsService.getOrdersListLink({
    customerId: customer.id,
    workspaceId: workspace.id,
    orderCode: args.orderCode || customerData?.lastordercode
  })
```

---

### 3. **searchProduct** 🆕 ⚠️ BACKGROUND FUNCTION

**Tipo**: **BACKGROUND (Non-bloccante)**  
**Quando usare**: Cliente cerca/chiede di un prodotto alimentare (trovato o non trovato)

**⚠️ CRITICAL**: Questa è una **BACKGROUND FUNCTION** - si esegue in background senza interrompere il flusso conversazionale.

**Trigger semantici**:

- 🇮🇹 "hai la burrata?", "avete prosciutto?", "mi serve del parmigiano", "vendete champagne?"
- 🇬🇧 "do you have burrata?", "do you sell prosciutto?", "I need parmesan"

**Parametri**:

```typescript
{
  productName: string // Nome prodotto cercato (max 255 char)
}
```

**Comportamento** (BACKGROUND):

1. LLM riconosce trigger e chiama `searchProduct()` **in background**
2. Funzione registra ricerca nel database (`product_searches` table)
3. **CONTEMPORANEAMENTE** LLM genera risposta naturale:
   - Se trovato: "Sì! Abbiamo Mozzarella di Bufala Campana DOP a €7.80..."
   - Se non trovato: "Mi dispiace, il tartufo non è disponibile. Posso proporti..."
4. Utente vede **SOLO** la risposta naturale (non sa della chiamata background)

**Analytics**:

- Tutte le ricerche vengono salvate in `ProductSearch` model
- Usate per analytics "Top Searched Products"
- Dati aggregati con GROUP BY per ranking

**Implementazione**:

```typescript
// In getAvailableFunctions()
{
  name: "searchProduct",
  description: "⚠️ BACKGROUND FUNCTION - Registra la ricerca di un prodotto...",
  parameters: {
    productName: { type: "string", description: "Nome prodotto cercato..." }
  }
}

// In executeFunctionCall()
case "searchProduct":
  console.log("🔍 [BACKGROUND] searchProduct called:", args)
  return await this.callingFunctionsService.searchProduct({
    customerId: customer.id,
    workspaceId: workspace.id,
    productName: args.productName,
  })

// Background execution logic
const BACKGROUND_FUNCTIONS = ["searchProduct"]

if (BACKGROUND_FUNCTIONS.includes(functionName)) {
  // Esegui in background (no await)
  this.executeFunctionCall(...).catch(error => ...)

  // Chiedi all'LLM risposta naturale
  const followUpMessages = [
    ...conversationHistory,
    { role: "user", content: userQuery },
    { role: "assistant", tool_calls: [toolCall] },
    { role: "tool", content: "Ricerca registrata (background)" }
  ]

  // Seconda chiamata LLM per risposta naturale
  return { response: naturalResponse }
}
```

**Database Schema**:

```prisma
model ProductSearch {
  id          String    @id @default(uuid())
  query       String                    // Prodotto cercato
  workspaceId String
  customerId  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  workspace   Workspace @relation(...)
  customer    Customers? @relation(...)

  @@index([workspaceId, customerId, createdAt, query])
  @@map("product_searches")
}
```

---

### 4. **addProduct** 🆕 ✅

**Tipo**: Bloccante (Standard)  
**Quando usare**: Cliente CONFERMA di voler aggiungere UN SINGOLO PRODOTTO al carrello

**⚠️ FLOW OBBLIGATORIO**:

1. Utente chiede prodotto: "Voglio la burrata"
2. LLM mostra prodotto con prezzo
3. LLM chiede conferma: "Vuoi aggiungerlo al carrello? 🛒"
4. Se utente conferma ("sì", "ok", "perfetto") → **ALLORA** chiama `addProduct()`
5. Dopo aggiunta → mostra link carrello

**Trigger semantici per CONFERMA**:

- 🇮🇹 "sì", "si", "ok", "perfetto", "aggiungi", "va bene", "dai"
- 🇬🇧 "yes", "ok", "perfect", "sure", "add it", "go ahead"

**Parametri**:

```typescript
{
  productCode: string,   // Codice prodotto (es: "BUR-001") - OBBLIGATORIO
  quantity: number,      // Quantità (default: 1, min: 1)
  notes?: string         // Note opzionali (es: "grande", "bio")
}
```

**Comportamento**:

1. Verifica prodotto esiste e stock disponibile
2. Trova o crea carrello attivo per cliente
3. Aggiunge prodotto al carrello (o incrementa quantità se già presente)
4. Genera link sicuro al carrello
5. Ritorna conferma + link

**Response Format**:

```
"✅ Ho aggiunto 1 x Burrata di Bufala al carrello!
Pronto per il checkout? [LINK_CHECKOUT_WITH_TOKEN]"
```

**Implementazione**:

```typescript
case "addProduct":
  console.log("🛒 addProduct called:", args)
  const { AddProduct } = require("../domain/calling-functions/AddProduct")
  return await AddProduct({
    customerId: customer.id,
    workspaceId: workspace.id,
    productCode: args.productCode,
    quantity: args.quantity || 1,
    notes: args.notes,
  })
```

**Domain Function** (`AddProduct.ts`):

- Validazione parametri (productCode, quantity > 0)
- Gestione carrello (find or create)
- Database operations (Prisma transactions)
- Token generation per link sicuro
- Restituisce `AddProductResult` con success/error

---

### 5. **repeatOrder** 🆕 ✅

**Tipo**: Bloccante (Standard)  
**Quando usare**: Cliente vuole ripetere esattamente lo stesso ordine precedente

**Trigger semantici**:

- 🇮🇹 "ripeti ordine", "ordina di nuovo", "voglio lo stesso di prima", "come l'ultima volta"
- 🇬🇧 "repeat order", "order again", "same as before", "like last time"

**Parametri**:

```typescript
{
  orderCode?: string  // Opzionale: se non specificato usa ultimo ordine
}
```

**Comportamento**:

1. Trova ordine da ripetere (specificato o ultimo del cliente)
2. **Svuota carrello esistente** (ricomincia pulito)
3. Recupera tutti i prodotti dell'ordine
4. Aggiunge TUTTI i prodotti al nuovo carrello
5. Verifica disponibilità stock
6. Se prodotti non disponibili → avvisa cliente (lista prodotti skippati)
7. Genera link carrello
8. Ritorna riepilogo + link

**⚠️ IMPORTANTE**: Chiedi sempre conferma prima di chiamare la funzione:

```
"Il tuo ultimo ordine era:
- 2 x Burrata di Bufala
- 1 x Parmigiano Reggiano
Ricreo il tuo ordine? 🔄"
```

**Response Format**:

```
"✅ Ho ricreato il tuo ordine nel carrello con 4 prodotti!
Pronto per il checkout? [LINK_CHECKOUT_WITH_TOKEN]"

// Se prodotti non disponibili:
"⚠️ Ho aggiunto 3 prodotti su 4. Prosciutto di Parma non è più disponibile."
```

**Implementazione**:

```typescript
case "repeatOrder":
  console.log("🔄 repeatOrder called:", args)
  const { RepeatOrder } = require("../domain/calling-functions/RepeatOrder")
  return await RepeatOrder({
    customerId: customer.id,
    workspaceId: workspace.id,
    orderCode: args.orderCode,
  })
```

**Domain Function** (`RepeatOrder.ts`):

- Trova cliente e ordine (ultimo se non specificato)
- Retrieve order items con join su products
- Clear existing cart
- Batch insert cart items
- Stock validation
- Error handling per prodotti non disponibili
- Token generation
- Restituisce `RepeatOrderResult` con products added count

---

## 🔄 BACKGROUND FUNCTIONS PATTERN

### Definizione

Una **BACKGROUND FUNCTION** è una funzione che:

1. ✅ Si esegue **SENZA bloccare** il flusso conversazionale
2. ✅ L'utente **NON sa** che è stata chiamata
3. ✅ Il LLM **continua a rispondere normalmente** dopo la chiamata
4. ✅ Usata per **analytics, tracking, logging** senza disturbare l'utente

### Implementazione Tecnica

**Step 1**: Dichiarazione nella lista funzioni

```typescript
const BACKGROUND_FUNCTIONS = ["searchProduct"]
```

**Step 2**: Detection e branching logic

```typescript
if (BACKGROUND_FUNCTIONS.includes(functionName)) {
  // Esegui funzione in background (no await)
  this.executeFunctionCall(
    functionName,
    functionArgs,
    customer,
    workspace,
    customerData
  ).catch((error) => {
    console.error(`❌ [BACKGROUND] Error in ${functionName}:`, error)
  })

  // Chiedi subito all'LLM risposta naturale
  console.log("💬 [BACKGROUND] Asking LLM for natural response...")

  // ... seconda chiamata LLM con tool result fittizio
}
```

**Step 3**: Seconda chiamata LLM

```typescript
const followUpMessages = [
  { role: "system", content: processedPrompt },
  ...conversationHistory,
  { role: "user", content: userQuery },
  { role: "assistant", content: null, tool_calls: [toolCall] },
  {
    role: "tool",
    tool_call_id: toolCall.id,
    name: functionName,
    content: JSON.stringify({
      success: true,
      message: "Ricerca registrata (background)",
    }),
  },
]

const followUpResponse = await fetch(
  "https://openrouter.ai/api/v1/chat/completions",
  {
    // ... OpenRouter API call
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: followUpMessages,
    }),
  }
)

const naturalResponse = followUpData.choices?.[0]?.message?.content
return { response: naturalResponse }
```

**Result**: Utente vede solo la risposta naturale, la funzione si esegue silenziosamente in background.

---

## 📊 FUNCTION EXECUTION FLOW

```
User Message → LLM Service
                  ↓
            generateLLMResponse()
                  ↓
         Check tool_calls in response
                  ↓
         ┌─────────────────────┐
         │ Is BACKGROUND?      │
         └─────────────────────┘
                  ↓
        Yes ↓            ↓ No
            ↓            ↓
    [BACKGROUND PATH]  [STANDARD PATH]
            ↓            ↓
    Execute async  Execute await
    (no wait)      (wait result)
            ↓            ↓
    2nd LLM call   Return function result
    for natural    formatted as response
    response
            ↓            ↓
         [RETURN NATURAL RESPONSE]
```

---

## 🔧 MAINTENANCE CHECKLIST

### Quando aggiungere nuova funzione:

1. ✅ **Define function** in `getAvailableFunctions()`:

   - Nome chiaro e descrittivo
   - Description con trigger semantici
   - Parameters con types e descriptions
   - Required parameters list

2. ✅ **Implement execution** in `executeFunctionCall()`:

   - Add new `case` per functionName
   - Call domain function o service method
   - Return proper result format

3. ✅ **Create domain function** (se necessario):

   - File in `backend/src/domain/calling-functions/`
   - Interface per Request e Result
   - Validation, database operations, error handling
   - Return structured result

4. ✅ **Update BACKGROUND_FUNCTIONS** (se background):

   - Add to `BACKGROUND_FUNCTIONS` array
   - Ensure function doesn't block conversation

5. ✅ **Document in prompt_agent.md**:

   - Add section with emoji icon
   - Describe when to use
   - List trigger semantics (multi-language)
   - Show example conversation
   - Note important behaviors

6. ✅ **Test thoroughly**:
   - Test trigger recognition
   - Test parameter extraction
   - Test database operations
   - Test error cases
   - Test multi-language support

---

## 🐛 DEBUGGING

### Console Logs Pattern:

```typescript
console.log("🔍 [BACKGROUND] Executing searchProduct...") // Background func
console.log("🛒 addProduct called:", args) // Standard func
console.log("✅ Function result:", result) // Success
console.error("❌ Error in functionName:", error) // Error
```

### Check Function Registration:

```bash
# Search for function in getAvailableFunctions
grep -A 20 "getAvailableFunctions" backend/src/services/llm.service.ts

# Verify case in executeFunctionCall
grep -A 5 "case \"functionName\"" backend/src/services/llm.service.ts
```

### Check LLM Logs:

```bash
# Recent prompts with function calls
tail -f backend/logs/prompt-debug-*.txt

# Search for specific function in logs
grep "searchProduct" backend/logs/prompt-debug-*.txt | tail -20
```

---

## 📚 REFERENCES

- **Main Implementation**: `backend/src/services/llm.service.ts`
- **Service Layer**: `backend/src/services/calling-functions.service.ts`
- **Domain Functions**: `backend/src/domain/calling-functions/*.ts`
- **Prompt Definitions**: `docs/prompt_agent.md`
- **Database Schema**: `backend/prisma/schema.prisma`

---

**Last Updated**: 17 Ottobre 2025  
**Author**: AI Code Agent  
**Status**: ✅ searchProduct, addProduct, repeatOrder IMPLEMENTED & TESTED
