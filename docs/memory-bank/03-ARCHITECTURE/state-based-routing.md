# State-Based Agent Routing Architecture

## 🎯 Problema

Nel sistema multi-agent attuale, **Router LLM** viene chiamato per OGNI messaggio utente, anche per risposte semplici come "sì", "no", "2" durante Progressive Discovery.

### Scenario Problematico

```
User: "avete prodotti halal?"
→ Router LLM → ProductSearch → lista 5 prodotti ✅

User: "2" (seleziona prodotto #2)
→ Router LLM → ProductSearch → dettagli prodotto ✅

User: "sì" (conferma aggiunta carrello)
→ Router LLM → ❌ PROBLEMA! Router NON SA che il contesto è ProductSearch
→ Router delega a CartManagement direttamente
→ CartManagement non sa QUALE prodotto aggiungere!
```

**Root Cause**: Router LLM è **STATELESS** - non ricorda che l'ultimo agent attivo era ProductSearch con prodotto specifico.

---

## 💡 Soluzione: State-Based Routing

### Concetto

Aggiungiamo uno **STATE** alla conversazione che traccia:

- **activeAgent**: Quale agent specialist ha il controllo (null = Router decide)
- **Logica PRE-ROUTER**: Prima di chiamare Router LLM, controlla se c'è activeAgent
- **Auto-delegation**: Query semplici (sì/no/numero) → delega direttamente a activeAgent
- **Topic Change Detection**: Query complessa → Router LLM decide se cambiare agent
- **State Reset**: Quando missione completata o topic cambia → activeAgent = null

---

## 🗄️ Database Schema

Campo aggiunto a `SearchConversations`:

```prisma
model SearchConversations {
  id            String   @id @default(uuid())
  sessionId     String   @unique
  workspaceId   String
  customerId    String
  state         SearchConversationState @default(ACTIVE)
  activeAgent   AgentType? // 🆕 null = Router, oppure PRODUCT_SEARCH, CART_MANAGEMENT, etc.
  lastQuery     String?
  lastResponse  String?
  metadata      Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  expiresAt     DateTime

  workspace     Workspace @relation(fields: [workspaceId], references: [id])

  @@index([sessionId])
  @@index([customerId])
  @@index([expiresAt])
  @@map("search_conversations")
}
```

**Migration creata**: `20251108112611_add_active_agent_to_search_conversations`

---

## 🔄 Flow State-Based

### STEP 1: Conversazione Inizia

```typescript
// User: "avete prodotti halal?"
activeAgent: null

// Router LLM decide delegation
Router → ProductSearch

// Update state
activeAgent: "PRODUCT_SEARCH"
```

### STEP 2: User Risponde (Query Semplice)

```typescript
// User: "2"
activeAgent: "PRODUCT_SEARCH"

// PRE-ROUTER CHECK
if (activeAgent && query.match(/^(sì|si|yes|no|ok|\d+)$/i)) {
  // AUTO-DELEGA a ProductSearch (BYPASS Router LLM!)
  return delegateToProductSearch(query)
}

// ProductSearch mostra dettagli prodotto
activeAgent: "PRODUCT_SEARCH" // Rimane invariato
```

### STEP 3: User Conferma Carrello

```typescript
// User: "sì"
activeAgent: "PRODUCT_SEARCH"

// PRE-ROUTER CHECK → auto-delega a ProductSearch
ProductSearch risponde: "🛒 DELEGATE_TO_CART: add SALUMI-004"

// Router intercetta pattern "🛒 DELEGATE_TO_CART:"
activeAgent: "CART_MANAGEMENT"
delegateToCart("add SALUMI-004")
```

### STEP 4: Reset State

```typescript
// CASO A: Missione completata
Cart risponde: "✅ Prodotto aggiunto! Vuoi procedere all'ordine?"
activeAgent: null // RESET

// CASO B: User cambia topic
User: "voglio vedere i miei ordini"
// Query NON è semplice → Router LLM chiamato
Router capisce topic change → delega OrderTracking
activeAgent: "ORDER_TRACKING"
```

---

## 🛠️ Implementazione (TODO)

### 1. Pre-Router State Check

```typescript
// In llm-router.service.ts → routeMessage()

// Dopo STEP 2 (load conversation history)
const searchConversation = await this.prisma.searchConversations.findUnique({
  where: { sessionId: params.conversationId },
})

if (searchConversation?.activeAgent) {
  const query = params.message.trim()

  // Simple query → auto-delegate
  if (query.match(/^(sì|si|yes|no|ok|\d+)$/i)) {
    logger.info(`🎯 Auto-delegating to ${searchConversation.activeAgent}`)
    return await this.delegateToActiveAgent({
      activeAgent: searchConversation.activeAgent,
      query,
      params,
      conversationHistory,
    })
  }

  // Complex query → Router LLM will process (may change topic)
  logger.info(`🔄 Complex query - Router LLM will decide`)
}

// Continue normal Router LLM flow...
```

### 2. delegateToActiveAgent Method

```typescript
private async delegateToActiveAgent(options: {
  activeAgent: AgentType
  query: string
  params: RouteMessageParams
  conversationHistory: any[]
}): Promise<RouteMessageResponse> {
  // Create specialist agent instance
  const specialist = this.getSpecialistAgent(options.activeAgent)

  // Call specialist directly
  const response = await specialist.handleQuery({
    workspaceId: options.params.workspaceId,
    customerId: options.params.customerId,
    sessionId: options.params.conversationId,
    query: options.query,
    customerName: options.params.customerName,
    customerLanguage: options.params.customerLanguage
  })

  // Check for delegation handoff pattern
  if (response.output.includes("🛒 DELEGATE_TO_CART:")) {
    return await this.handleDelegationHandoff(response, options)
  }

  // Apply Safety & Translation
  const safeResponse = await this.safetyAgent.process({...})

  return {
    response: safeResponse.translatedText,
    agentUsed: options.activeAgent,
    tokensUsed: response.tokensUsed,
    executionTimeMs: Date.now() - startTime
  }
}
```

### 3. Delegation Handoff Pattern

```typescript
private async handleDelegationHandoff(
  response: any,
  options: any
): Promise<RouteMessageResponse> {
  // Extract: "🛒 DELEGATE_TO_CART: add SALUMI-004"
  const match = response.output.match(/🛒 DELEGATE_TO_CART:\s*(.+)/)
  const cartQuery = match[1].trim() // "add SALUMI-004"

  logger.info(`🔀 HANDOFF: PRODUCT_SEARCH → CART_MANAGEMENT`)

  // Update activeAgent
  await this.prisma.searchConversations.update({
    where: { sessionId: options.params.conversationId },
    data: { activeAgent: "CART_MANAGEMENT" }
  })

  // Delegate to Cart
  const cartAgent = new CartManagementAgentLLM(this.prisma)
  const cartResponse = await cartAgent.handleQuery({
    ...options.params,
    query: cartQuery
  })

  return cartResponse
}
```

### 4. State Update on Delegation

```typescript
// In Router's function calling loop
if (delegationDetected) {
  await this.prisma.searchConversations.upsert({
    where: { sessionId: params.conversationId },
    create: {
      sessionId: params.conversationId,
      workspaceId: params.workspaceId,
      customerId: params.customerId,
      activeAgent: delegationTarget, // "PRODUCT_SEARCH", etc.
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
    update: {
      activeAgent: delegationTarget,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })
}
```

### 5. State Reset Conditions

```typescript
// RESET 1: Mission complete
if (response.includes("✅ MISSION_COMPLETE")) {
  await this.prisma.searchConversations.update({
    where: { sessionId: params.conversationId },
    data: { activeAgent: null },
  })
}

// RESET 2: Topic change (detected by Router LLM)
if (newDelegationTarget !== currentActiveAgent) {
  await this.prisma.searchConversations.update({
    where: { sessionId: params.conversationId },
    data: { activeAgent: newDelegationTarget },
  })
}
```

---

## 📊 Vantaggi

| Aspetto               | Prima (Stateless)            | Dopo (State-Based)                       |
| --------------------- | ---------------------------- | ---------------------------------------- |
| **Performance**       | Router LLM chiamato SEMPRE   | Router LLM solo per query complesse      |
| **Costo Token**       | ~1500 token/richiesta        | ~500 token (query semplici bypass LLM)   |
| **Latenza**           | ~2s per ogni risposta        | ~200ms per auto-delegation               |
| **Affidabilità**      | LLM può sbagliare delegation | Logica deterministica per query semplici |
| **Context Awareness** | ❌ Router non sa contesto    | ✅ activeAgent traccia stato             |

---

## 🧪 Test Cases

### Test 1: Progressive Discovery Flow

```typescript
// STEP 1
User: "avete prodotti halal?"
Expected: activeAgent = "PRODUCT_SEARCH", lista 5 prodotti

// STEP 2
User: "2"
Expected: Auto-delegation a ProductSearch (NO Router LLM), dettagli prodotto

// STEP 3
User: "sì"
Expected: ProductSearch → "🛒 DELEGATE_TO_CART: add SALUMI-004"
         activeAgent = "CART_MANAGEMENT"
         Prodotto aggiunto a DB

// STEP 4
User: "voglio vedere ordini"
Expected: Router LLM chiamato, activeAgent = "ORDER_TRACKING"
```

### Test 2: State Reset

```typescript
// User completa acquisto
Cart: "✅ Ordine creato! Vuoi qualcos'altro?"
Expected: activeAgent = null

// User fa nuova ricerca
User: "prodotti bio"
Expected: Router LLM decide, activeAgent = "PRODUCT_SEARCH"
```

---

## 🚀 Prossimi Step

1. ✅ **Database Migration** - Campo `activeAgent` aggiunto
2. ⏳ **Implementare Pre-Router Check** - Logica prima di Router LLM
3. ⏳ **Implementare delegateToActiveAgent** - Metodo helper
4. ⏳ **Implementare handleDelegationHandoff** - Pattern "🛒 DELEGATE_TO_CART:"
5. ⏳ **Implementare State Update** - Aggiorna activeAgent dopo delegation
6. ⏳ **Implementare State Reset** - Reset activeAgent quando necessario
7. ⏳ **Test Integration** - Test E2E del flow completo
8. ⏳ **ProductSearch Prompt Update** - Istruzioni per "🛒 DELEGATE_TO_CART:" pattern

---

## 📚 Riferimenti

- **PRD**: `docs/memory-bank/PRD.md` (sezione Progressive Discovery)
- **Migration**: `backend/prisma/migrations/20251108112611_add_active_agent_to_search_conversations/`
- **Router Service**: `backend/src/services/llm-router.service.ts`
- **ProductSearch Agent**: `backend/src/application/agents/ProductSearchAgentLLM.ts`

---

**Status**: ✅ Database pronto, implementazione logica TODO
**Ultima Modifica**: 2025-11-08
**Autore**: Andrea + AI Copilot
