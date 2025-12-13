# Regole di prompt per il flusso LLM multi-agent

Questa pagina è la bibbia operativa: niente hardcode, tutto data-driven, un solo luogo di verità per i prompt.

---

## Principi non negoziabili

- NIENTE hardcode nel codice o nei prompt: tutti i contenuti arrivano dal DB filtrati per workspaceId.
- Usa solo placeholder e variabili. Nessun contenuto ridondante o duplicato.
- Le variabili "pesanti" vanno usate al massimo una volta per prompt: `{{products}}`, `{{services}}`, `{{offers}}`, `{{categories}}`.
- Se i dati mancano o il catalogo è vuoto, il prompt deve già prevedere una risposta di errore (es. `CATALOGO VUOTO`) o suggerire categorie/alternative reali, mai inventate.
- Nessun mapping manuale (es. niente include su parole chiave nel codice): il comportamento va descritto nel prompt e guidato dai dati reali.

---

## Cartelle template

- `templates/ecommerce/` — per flussi di vendita: catalogo, prodotti, servizi, carrello, ordini.
- `templates/informational/` — per identità, FAQ, messaggi non transazionali.

Scegli sempre la cartella coerente con il caso d'uso; non mescolare contenuti tra ecommerce e informational.

---

## Variabili disponibili (placeholders)

### Variabili Catalogo (una sola volta ciascuna per prompt)
- `{{products}}`, `{{services}}`, `{{offers}}`, `{{categories}}`
- Tutti i testi sono in italiano dal DB, già filtrati per workspaceId e sconti cliente.

### Variabili Customer (da `replaceCustomerVariables`)

| Variabile | Alias | Source |
|-----------|-------|--------|
| `{{nameUser}}` | `{{customerName}}` | customer.name |
| `{{email}}` | - | customer.email |
| `{{phone}}` | `{{customerPhone}}` | customer.phone |
| `{{discountUser}}` | - | customer.discount |
| `{{languageUser}}` | - | customer.language |
| `{{lastordercode}}` | `{{lastOrderCode}}` | customer.lastOrderCode |
| `{{pushNotificationsConsent}}` | - | customer.push_notifications_consent |

### Variabili Workspace (da `workspaceConfig` in `preProcessPrompt`)

| Variabile | Source |
|-----------|--------|
| `{{companyName}}` | workspace.name |
| `{{botIdentityResponse}}` | workspace.botIdentityResponse |
| `{{customAiRules}}` | workspace.customAiRules (usato con `{{#if}}`) |
| `{{address}}` | workspace.address |
| `{{adminEmail}}` | workspace.notificationEmail (per escalation/supporto) |

### Variabili Agente

| Variabile | Source |
|-----------|--------|
| `{{agentName}}` | assignedAgent.name |
| `{{agentPhone}}` | assignedAgent.phone |
| `{{agentEmail}}` | assignedAgent.email |
| `{{TOKEN_DURATION}}` | config tokenDuration |
| `{{channelName}}` | channel.name |

---

## Agenti e responsabilità

### Router Agent
- Decide il sotto-agente. **Non risponde MAI all'utente direttamente.**
- Usa il template Router corretto (ecommerce o informational).
- Chiama solo funzioni consentite: `productSearchAgent`, `cartManagementAgent`, `orderTrackingAgent`, `customerSupportAgent`, `safetyTranslationAgent`.
- **NON** inserisce dati di catalogo nel proprio prompt.
- **NON** gestisce FAQ - delega a `customerSupportAgent`.

### ProductSearchAgentLLM
- Risponde su prodotti/servizi usando solo `{{products}}`, `{{services}}`, `{{offers}}`, `{{categories}}` dal DB.
- Se 0 risultati: messaggio predefinito o suggerimento categorie, mai inventare.
- Function-calls: `getProductDetails`, `getServiceDetails`, `searchProductForStatistics`.
- **NON** gestisce FAQ o domande generiche.

### CartManagementAgentLLM
- Gestisce aggiunta/rimozione/quantità carrello usando i dati già noti.
- **NON** ricostruisce catalogo, **NON** gestisce FAQ.

### OrderTrackingAgentLLM
- Spiega stato ordini basandosi solo su dati DB.
- Nessun contenuto inventato, **NON** gestisce FAQ.

### CustomerSupportAgentLLM ⭐ GESTISCE LE FAQ!

**Questo è l'unico agente che ha accesso alle FAQ!**

**Responsabilità:**
- **Identità**: Risponde a "chi sei?", "chi siete?" usando `{{botIdentityResponse}}` dal workspace.
- **FAQ**: Chiama `searchFAQ()` per cercare risposte su pagamenti, spedizioni, resi, policy.
- **Escalation**: Può chiamare `contactOperator()` per escalare a operatore umano.

**Flusso FAQ:**
1. Router riceve domanda (es. "come posso pagare?")
2. Router delega: `customerSupportAgent("User is asking about payment methods")`
3. CustomerSupportAgentLLM chiama `searchFAQ({ query: "payment" })`
4. Riceve risultati FAQ dal database
5. Risponde basandosi sui dati FAQ (non inventa!)

**Function-calls disponibili:**
- `searchFAQ` - Cerca FAQ per keyword (OBBLIGATORIO prima di rispondere!)
- `getFAQByCategory` - Ottiene FAQ per categoria
- `contactOperator` - Escalation a operatore umano

### Safety/Translation Agent
- Traduzione/sanitizzazione. Non aggiunge contenuto.
- Preserva formattazione e token speciali.

---

## Flusso di orchestrazione

1. Router riceve messaggio e history, carica il template giusto, decide il sotto-agente e passa una query strutturata.
2. Il sotto-agente carica il proprio template (cartella corretta), passa dal PromptProcessor che sostituisce le variabili (una sola volta per variabile pesante) e valida duplicati.
3. Se una variabile è vuota, il prompt definisce già il fallback (es. `CATALOGO VUOTO` o suggerimento categorie presenti). Nessun dato inventato.
4. LLM produce output in italiano usando solo i dati forniti; se serve, chiama le function-calls previste.
5. Router/Translation gestiscono lingua e salvataggio history. Nessuna logica di contenuto nel codice.

---

## Regole di formattazione

- Liste numerate: `1.` `2.` `3.` senza emoji. Nome e, se previsto, prezzo per ogni voce.
- Conteggi (guidati dal template):
  - 0 risultati: messaggio di errore predefinito o suggerimento categorie reali.
  - 1-2 risultati: dettagli completi + domanda di aggiunta al carrello.
  - 3-5 risultati: lista numerata con prezzi + domanda di selezione (no add-to-cart diretto).
  - 6+ risultati: grouping secondo le regole del template (min 2, max 4 gruppi).

---

## Function-calls per agente

### ProductSearchAgentLLM
- `getProductDetails` - Dettagli prodotto (SOLO per prodotto specifico!)
- `getServiceDetails` - Dettagli servizio
- `searchProductForStatistics` - Analytics (non blocca risposta)

### CartManagementAgentLLM
- Funzioni di aggiunta/rimozione/aggiornamento carrello definite nei template di carrello.

### OrderTrackingAgentLLM
- Funzioni di recupero ordine/stato definite nei template di tracking.

### CustomerSupportAgentLLM
- `searchFAQ` - **OBBLIGATORIO** prima di rispondere a domande su policy/pagamenti/spedizioni
- `getFAQByCategory` - FAQ per categoria
- `contactOperator` - Escalation umana

### Router
- Chiama soltanto i sotto-agenti; nessuna funzione di catalogo.

---

## ⚠️ Regole function-call per ProductSearchAgent (CRITICO!)

**NON chiamare `getProductDetails()` quando:**
- L'utente chiede una CATEGORIA (es. "che formaggi avete?")
- La query è "User wants to see category 'X'"
- Devi mostrare una LISTA o GRUPPI di prodotti

**Chiamare `getProductDetails()` SOLO quando:**
- L'utente nomina UN prodotto specifico (es. "dimmi della mozzarella")
- L'utente seleziona da una lista numerata (es. "2" dopo aver mostrato prodotti)
- La query è "User wants details of product 'X'"

**Workflow corretto:**
1. Query categoria → CONTA prodotti → Applica regole COUNT (lista o gruppi) → NESSUNA function call
2. Query prodotto specifico → Chiama `getProductDetails()` → Mostra dettagli
3. Utente seleziona da lista → Chiama `getProductDetails()` → Mostra dettagli

---

## Schema Router: numeri, sì/no, gruppi

Il Router legge l'ultima risposta dell'agente per identificare il tipo di lista:
- Categorie (pattern "(N prodotti)") → `productSearchAgent("User wants to see category '<NAME>'")`
- Prodotti (prezzi presenti, es. "€") → `productSearchAgent("User wants details of product '<NAME>'")`
- Ordini (pattern "#" + data) → `orderTrackingAgent("User wants details of order '<CODE>'")`
- Carrello (pattern "×" quantità) → `cartManagementAgent("User wants to update cart item '<NAME>'")`

Se il messaggio è un numero/si/no/yes/ok: il Router estrae la riga corrispondente dalla lista mostrata e passa nome/codice esatto. Se il numero non esiste, chiede di scegliere un'opzione valida, senza indovinare.

---

## Esempi di flusso

### Esempio: Categorie → Prodotto
```
Utente: "che categorie avete?"
Router → productSearchAgent("User wants to see catalog categories with item counts")
Risposta: "1. Formaggi (7 prodotti)\n2. Salumi (6 prodotti)..."

Utente: "1"
Router → productSearchAgent("User wants to see category 'Formaggi'")
Risposta: "1. Formaggi Freschi (3)\n2. Formaggi Stagionati (4)"
```

### Esempio: FAQ
```
Utente: "come posso pagare?"
Router → customerSupportAgent("User is asking about payment methods")
CustomerSupport chiama searchFAQ({ query: "payment" })
Risposta: "Accettiamo: Visa, Mastercard, PayPal, Bonifico..."
```

### Esempio: Identità
```
Utente: "chi siete?"
Router → customerSupportAgent("User is asking who we are")
CustomerSupport usa {{botIdentityResponse}} dal workspace
Risposta: "Sono l'assistente virtuale VIP di BellItalia..."
```

---

## ⚠️ REGOLE TECNICHE (Implementazione)

### Temperature: valori fissi nel codice

Le temperature sono **fissate nel codice** per ogni agente e NON configurabili da database:

| Agente | Temperature | Motivo |
|--------|-------------|--------|
| Router | 0 | Deterministico, stessa scelta per stesso input |
| ProductSearchAgentLLM | 0.3 | Leggera creatività per formattazione |
| CartManagementAgentLLM | 0.7 | Flessibilità varianti linguistiche |
| OrderTrackingAgentLLM | 0.7 | Flessibilità varianti linguistiche |
| CustomerSupportAgentLLM | 0.7 | Empatia nelle risposte |
| TranslationAgent | 0.3 | Fedele al testo originale |
| SummaryAgent | 0.5 | Sintesi equilibrata |

**NON** modificare le temperature senza approvazione!

### Rendering variabili: SEMPRE prima del modello

Il prompt è un **template** che deve essere **renderizzato** (variabili sostituite) PRIMA di passarlo al modello LLM.

**Flusso obbligatorio per ogni agente:**
1. `loadAndRenderTemplate()` → Carica template da file, risolve solo `{{#if}}` condizionali
2. `preProcessPrompt()` → Sostituisce **TUTTE** le variabili: `{{companyName}}`, `{{products}}`, `{{nameUser}}`, etc.
3. Solo DOPO le sostituzioni → Passa il prompt renderizzato al modello LLM

**ERRORE COMUNE (da evitare):**
```typescript
// ❌ SBAGLIATO: passa template non renderizzato al modello
const prompt = await templateLoader.loadAndRenderTemplate("AGENT_TYPE", workspaceId)
const response = await callLLM({ messages: [{ role: "system", content: prompt }] })
// Risultato: "{{companyName}}" appare nel prompt generato!
```

**PATTERN CORRETTO:**
```typescript
// ✅ CORRETTO: renderizza variabili prima di passare al modello
const templatePrompt = await templateLoader.loadAndRenderTemplate("AGENT_TYPE", workspaceId)
const processedPrompt = await promptProcessor.preProcessPrompt(
  templatePrompt,
  workspaceId,
  customerData,
  { faqs, products, categories, services, offers },
  undefined, // workspaceUrl
  { address, customAiRules, botIdentityResponse } // workspaceConfig!
)
const response = await callLLM({ messages: [{ role: "system", content: processedPrompt }] })
```

### Agenti che implementano correttamente il rendering

- ✅ **ProductSearchAgentLLM** - chiama `preProcessPrompt`
- ✅ **ProfileManagementAgentLLM** - chiama `preProcessPrompt`
- ✅ **CartManagementAgentLLM** - chiama `preProcessPrompt` + workspaceConfig
- ✅ **OrderTrackingAgentLLM** - chiama `preProcessPrompt` + workspaceConfig
- ✅ **CustomerSupportAgentLLM** - chiama `preProcessPrompt` + workspaceConfig
- ✅ **LLM Router** - chiama `preProcessPrompt`

Se crei un **nuovo agente**, DEVI seguire lo stesso pattern!

---

## Processo condiviso

- Ogni modifica ai prompt passa per le cartelle template (`ecommerce`/`informational`) e segue queste regole.
- Il codice deve solo orchestrare: caricare template, sostituire variabili, validare duplicati, chiamare function-calls, salvare history. Niente contenuto nel codice.
- Ogni nuova variabile o agente deve essere documentato qui prima della produzione.

---

## 🚀 ROADMAP MIGRAZIONE (Dicembre 2024)

> **OBIETTIVO**: Eliminare bug ricorrenti, standardizzare il flusso, rendere il sistema affidabile.

---

## ⚠️ CONTROLLI PRIORITARI NEL FLOW (NON TOCCARE!)

> **ATTENZIONE**: Il flow del Router ha controlli di sicurezza CRITICI che devono essere eseguiti IN ORDINE.
> Prima di modificare QUALSIASI cosa nel Router, verifica che questi controlli rimangano intatti!

### Ordine di Esecuzione (llm-router.service.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SECURITY GATE (Prima di tutto!)                               │
│    → SecurityService.validateMessage()                           │
│    → Blocca injection, spam, minacce                            │
│    → Se fallisce: return immediato, NO LLM call                 │
├─────────────────────────────────────────────────────────────────┤
│ 2. P1: CUSTOMER BLOCKED CHECK                                    │
│    → checkBlockedUser(customerId, workspaceId)                  │
│    → customer.isBlacklisted === true                            │
│    → Se blocked: return { isBlocked: true }, NO risposta        │
│    → Webhook NON invia messaggio!                               │
├─────────────────────────────────────────────────────────────────┤
│ 3. P2: CHANNEL DISABLED (WIP MODE)                               │
│    → getChannelDisabled(workspaceId)                            │
│    → workspace.channelStatus === false                          │
│    → Se disabled: return wipMessage, NO LLM call                │
├─────────────────────────────────────────────────────────────────┤
│ 4. SUBSCRIPTION CHECK (Feature 185)                              │
│    → Verificato a livello di webhook/API                        │
│    → subscription.status === 'PAUSED' | 'CANCELLED'             │
│    → Se paused: blocca API, non arriva al Router                │
├─────────────────────────────────────────────────────────────────┤
│ 5. CREDIT CHECK (Feature 185)                                    │
│    → owner.credit <= -10 (threshold configurabile)              │
│    → Se credit esaurito: workspace bloccato                     │
│    → Non arriva al Router (bloccato prima)                      │
├─────────────────────────────────────────────────────────────────┤
│ 6. REGISTRATION CHECK (Feature 177)                              │
│    → Verificato nel webhook WhatsApp                            │
│    → welcomeMessageCount > limit                                │
│    → Se superato: auto-block customer                           │
├─────────────────────────────────────────────────────────────────┤
│ ✅ TUTTI I CHECK PASSATI → Procedi con LLM Router               │
└─────────────────────────────────────────────────────────────────┘
```

### Dove sono implementati i controlli

| Check | File | Metodo | Linea ~approx |
|-------|------|--------|---------------|
| Security Gate | `llm-router.service.ts` | `routeMessage()` | 480-520 |
| P1 Blocked | `llm-router.service.ts` | `checkBlockedUser()` | 242-258 |
| P2 WIP Mode | `llm-router.service.ts` | `getChannelDisabled()` | 267-290 |
| Subscription | `subscription-billing.controller.ts` | `getSubscriptionStatus()` | 600-650 |
| Credit | `subscription-billing.controller.ts` | blocco a livello owner | 1040-1060 |
| Registration | `whatsapp-webhook.controller.ts` | limite welcome messages | Feature 177 |

### ❌ ERRORI DA EVITARE

```typescript
// ❌ SBAGLIATO: Modificare ordine dei check
if (isChannelDisabled) { ... }  // P2 prima di P1!
if (isBlocked) { ... }          // Dovrebbe essere PRIMA!

// ❌ SBAGLIATO: Rimuovere check per "semplificare"
// const isBlocked = await this.checkBlockedUser(...)
// if (isBlocked) { ... }  // ← COMMENTATO = BUG SICUREZZA!

// ❌ SBAGLIATO: Aggiungere LLM call PRIMA dei check
const llmResponse = await this.callLLM(...) // ← Spreco token se utente bloccato!
if (isBlocked) { return } // Troppo tardi!

// ✅ CORRETTO: Check PRIMA, LLM DOPO
const isBlocked = await this.checkBlockedUser(...)
if (isBlocked) { return { isBlocked: true } }
// ... altri check ...
const llmResponse = await this.callLLM(...) // Solo se tutti i check passano
```

### Flags nel Response

| Flag | Significato | Azione Webhook |
|------|-------------|----------------|
| `isBlocked: true` | Utente bloccato (P1) | NON inviare messaggio |
| `response: wipMessage` | Canale in WIP (P2) | Invia wipMessage |
| `response: ""` | Nessuna risposta | NON inviare nulla |

### Prima di modificare il flow:

- [ ] Ho verificato che i check P1/P2 rimangono nell'ordine corretto?
- [ ] Ho verificato che `isBlocked` flag è ancora restituito?
- [ ] Ho verificato che i check avvengono PRIMA delle chiamate LLM?
- [ ] Ho testato con utente bloccato?
- [ ] Ho testato con canale in WIP?
- [ ] Ho testato con subscription paused?

---

### ❌ Problemi Attuali Identificati

| Problema | Causa | Impatto |
|----------|-------|---------|
| Variabili non sostituite (`{{companyName}}`) | Ogni agente costruisce `customerData` in modo diverso | Prompt con placeholder visibili |
| Router non estrae nome da lista | LLM decide, nessuna validazione | "2" → categoria sbagliata |
| FAQ non trovate | `searchFAQ()` non chiamato sempre | "Non ho informazioni" invece di risposta |
| Delegation errata | Router passa query ambigue | ProductSearch mostra categorie invece di prodotti |
| Codice duplicato | Ogni agente ricarica customer/workspace | Query DB inutili, inconsistenza |

---

### ✅ FASE 1: Standardizzazione Variabili (COMPLETATA)

**File creati:**
- `types/prompt-variables.types.ts` - SINGLE SOURCE OF TRUTH per tutte le variabili
- `services/prompt-variable-builder.service.ts` - Builder centralizzato

**Pattern obbligatorio:**
```typescript
// Router costruisce UNA VOLTA
const promptVariables = PromptVariableBuilder.build(customer, workspace, dynamicContent)

// Sub-agenti usano SENZA ricostruire
const customerDataForPrompt = context.customerData 
  ? PromptVariableBuilder.mergeWithFallback(context.customerData, workspaceLocal)
  : PromptVariableBuilder.buildCustomerData(customer, workspace)
```

**TODO rimasti:**
- [ ] Migrare `ProfileManagementAgentLLM` al nuovo pattern
- [ ] Aggiungere validazione `PromptVariableBuilder.validate()` in tutti gli agenti
- [ ] Rimuovere costruzione manuale di `customerData` in tutti i file

---

### ✅ FASE 2: Pre-processing Messaggi Brevi (COMPLETATA)

**Problema risolto:** LLM sbagliava a estrarre nomi da liste numerate quando utente rispondeva "1", "2", "sì"

**Soluzione implementata:** `MessagePreprocessorService` + `executeFastPathDelegation`

**File creati/modificati:**
- ✅ `services/message-preprocessor.service.ts` - Parsing deterministico
- ✅ `services/llm-router.service.ts` - Integrazione fast-path

**Come funziona:**
```typescript
// 1. Preprocessor analizza il messaggio PRIMA del Router LLM
const preprocessResult = messagePreprocessorService.process(userMessage, lastOptionsMapping)

// 2. Se detecta selezione numerica con mapping valido:
// preprocessResult.forceDelegationTarget = "PRODUCT_SEARCH"
// preprocessResult.forceDelegationQuery = 'User selected category "Formaggi"'

// 3. functionCallingLoop vede forceDelegationTarget e BYPASSA il Router LLM
// → Delegation diretta al sub-agent (FAST-PATH)
// → 0 token Router, ~500ms risparmiati
```

**Pattern supportati:**
| Input | Tipo | Output |
|-------|------|--------|
| "1", "2", "3" | Numerico | Risolve a nome opzione |
| "il primo", "il secondo" | Ordinale IT | Risolve a nome opzione |
| "first", "second" | Ordinale EN | Risolve a nome opzione |
| "voglio il 2" | Numerico con testo | Estrae numero |
| "sì", "ok", "va bene" | Conferma | `selectionType: "confirmation"` |
| "no", "annulla" | Rifiuto | `selectionType: "rejection"` |

**Benefici:**
- ✅ 100% accuratezza selezioni (deterministico, non LLM)
- ✅ ~500ms più veloce (skip Router LLM)
- ✅ ~200 token risparmiati per selezione
- ✅ Debug chiaro con step "FAST-PATH" nella timeline

---

### ✅ FASE 2.5: Context Object Unificato (COMPLETATA)

**Problema:** Ogni sub-agent ricaricava customer, workspace, catalog (query duplicate)

**Soluzione:** `AppContext` - Oggetto unificato costruito UNA VOLTA nel Router, passato ovunque

**File creato:**
- ✅ `types/app-context.types.ts` - Definizione `AppContext` + `AppContextBuilder`

**Come funziona:**
```typescript
// 1. Router costruisce UNA VOLTA nel routeMessage()
const appContext = AppContextBuilder.build({
  workspace,
  customer,
  catalog: { products, categories, offers, services, faqs },
  lastOrderCode,
  promptVariables,
  customerData,
  conversationHistory,
  // ... session metadata
})

// 2. TUTTI i sub-agents ricevono appContext
productSearchAgent.handleQuery({ appContext, query })
cartAgent.handleQuery({ appContext, action })

// NO PIÙ:
// const customer = await db.findCustomer() ❌
// const workspace = await db.findWorkspace() ❌
```

**Benefici:**
- ✅ 4 query DB eliminate per messaggio (customer, workspace, catalog x2)
- ✅ Dati coerenti (stesso snapshot per tutta la richiesta)
- ✅ Type-safe (TypeScript controlla tutti i campi)
- ✅ Ready per LangChain (RunnableConfig pattern)

---

### ✅ FASE 3: Prompt Cache System (COMPLETATA)

**Problema:** Prompt caricati ad ogni messaggio (file I/O + DB query)

**Soluzione:** `PromptCacheService` - Carica prompts all'avvio, cache in memory

**File creato:**
- ✅ `services/prompt-cache.service.ts` - Cache manager con refresh background

**Come funziona:**
```typescript
// 1. Startup: onModuleInit() carica TUTTI i prompt
promptCacheService.onModuleInit()
// → Legge da agentConfig table UNA VOLTA
// → Cache in memory Map<agentType, prompt>

// 2. Runtime: Accedi al cache (0ms latency)
const prompt = await promptCacheService.getPrompt("ROUTER", workspaceId)
// → Hit cache, ritorna istantaneamente

// 3. Background refresh ogni 5 minuti
// → Aggiornamenti auto senza restart
```

**Architettura:**
- Global prompts: `Map<agentType, CachedPrompt>` (caricati all'avvio)
- Workspace overrides: `Map<workspaceId, Map<agentType, CachedPrompt>>` (lazy-loaded)
- Metadata: version, lastUpdated, variables estratte

**Benefici:**
- ✅ Zero DB/file queries per prompt durante runtime
- ✅ 100% deterministic (stesso prompt per tutta la session)
- ✅ Background refresh (aggiornamenti senza restart)
- ✅ Ready per LangChain (static typed prompts)

---

### 🔄 FASE 4: Valutare Framework (DA DECIDERE)

**Opzione A: LangChain.js**
- ✅ Template tipizzati con validazione compile-time
- ✅ Tool calling con schema Zod
- ✅ Memory management built-in
- ✅ Agent Executor con verbose logging
- ❌ Curva di apprendimento
- ❌ Overhead per casi semplici

**Opzione B: Continuare con sistema custom**
- ✅ Controllo totale
- ✅ Già conosciamo il codice
- ❌ Dobbiamo risolvere ogni bug manualmente
- ❌ Nessuna community/supporto

**DECISIONE:** _____________ (da discutere con Andrea)

**Se LangChain:**
```typescript
// I nostri repository diventano "Tools"
const tools = [
  new DynamicStructuredTool({
    name: "getProductsByCategory",
    schema: z.object({ categoryName: z.string() }),
    func: async ({ categoryName }) => productRepository.findByCategory(workspaceId, categoryName)
  })
]

// Agent Executor gestisce orchestrazione
const executor = new AgentExecutor({ agent, tools, verbose: true })
```

---

### 🔄 FASE 4: Pulizia Codice (CONTINUA)

**File da pulire:**
- [ ] `llm-router.service.ts` (3200+ righe!) - Dividere in file più piccoli
- [ ] Rimuovere codice duplicato tra agenti
- [ ] Standardizzare logging (stesso formato ovunque)
- [ ] Rimuovere TODO/FIXME vecchi

**Pattern logging standard:**
```typescript
logger.info("📦 [AgentName] Action description:", {
  workspaceId,
  customerId,
  key: value,
})
```

---

### 📋 CHECKLIST PER OGNI NUOVA FEATURE

Prima di implementare qualsiasi feature LLM:

- [ ] Le variabili sono definite in `prompt-variables.types.ts`?
- [ ] Il builder usa `PromptVariableBuilder`?
- [ ] Il template è nella cartella corretta (`ecommerce/` o `informational/`)?
- [ ] `preProcessPrompt()` viene chiamato PRIMA del modello LLM?
- [ ] Le function-calls hanno schema Zod/tipizzato?
- [ ] Il logging segue il pattern standard?
- [ ] I test coprono i casi edge (lista vuota, numero non valido, etc.)?

---

### 🎯 METRICHE DI SUCCESSO

Quando il sistema sarà "stabile":

| Metrica | Target | Attuale |
|---------|--------|---------|
| Variabili non sostituite | 0 | ❓ Da misurare |
| "Non ho informazioni" per FAQ esistenti | 0 | ❓ Da misurare |
| Delegation errata (categoria vs prodotto) | < 5% | ❓ Da misurare |
| Tempo risposta medio | < 3s | ❓ Da misurare |

**Come misurare:**
```typescript
// Aggiungere in ogni risposta finale
logger.info("📊 Response metrics:", {
  hadUnreplacedVariables: /\{\{[^}]+\}\}/.test(finalResponse),
  hadNoInfoResponse: /non ho informazioni/i.test(finalResponse),
  responseTimeMs: Date.now() - startTime,
})
```

---

### 💡 NOTE IMPORTANTI

1. **NON affidare compiti deterministici all'LLM**
   - Parsing liste → fare nel codice
   - Estrazione nomi → fare nel codice
   - Validazione input → fare nel codice

2. **LLM è bravo per:**
   - Capire l'intento dell'utente
   - Generare risposte naturali
   - Decidere quale tool/function usare

3. **Ogni volta che "funziona a volte":**
   - È un bug di architettura, non di prompt
   - Serve logica deterministica nel codice

4. **History è CRITICA:**
   - Deve essere accessibile per preprocessing
   - Deve essere strutturata (non solo stringhe)
   - Deve contenere metadata (tipo lista mostrata, etc.)

---

## ✅ ACCEPTANCE CRITERIA - SISTEMA LLM

> ⚠️ **QUESTI CRITERI DEVONO ESSERE RISPETTATI SEMPRE - NON OPZIONALI**

### AC-1: Lettura Corretta delle Risposte Numeriche

**REQUISITO:** Quando l'utente risponde con un numero ("1", "2", "3"), il sistema DEVE:
- Estrarre il numero dalla risposta
- Mapparlo all'opzione corretta dalla lista precedentemente mostrata
- Passare il NOME dell'opzione al sub-agent, NON il numero

**IMPLEMENTAZIONE (con nuovo pattern):**
```typescript
// 1. Router estrae il numero dal messaggio (codice, non LLM)
const selectedNumber = parseInt(userMessage)

// 2. Cerca nella history cosa era l'opzione N
const previousList = extractListFromHistory(history)
const selectedOption = previousList[selectedNumber - 1]

// 3. Passa il NOME (dato), non il numero (logica)
const intent = {
  type: 'SHOW_CATEGORY',
  categoryName: selectedOption.name // "Formaggi", non "5"
}

// 4. ProductSearchAgent riceve intent già risolto
// Non deve indovinare cosa volesse dire "5"
```

**ANTI-PATTERN (❌ SBAGLIATO):**
```typescript
// Passare il numero al LLM e sperare capisca
delegateToProductSearch({ query: "5" })
// LLM: "Cosa è 5? Bah, mostro Formaggi"
```

**TEST OBBLIGATORI:**
- [ ] Utente risponde "1" → seleziona prima opzione
- [ ] Utente risponde "2" → seleziona seconda opzione
- [ ] Utente risponde numero invalido ("99") → gestisce errore gracefully
- [ ] Utente risponde testo insieme a numero ("voglio il 2") → estrae correttamente

---

### AC-2: Delegation Corretta ai Sub-Agent

**REQUISITO:** Il Router DEVE:
- Delegare al sub-agent corretto basandosi sull'intent
- Passare i dati RISOLTI (nomi, non numeri)
- Includere sempre `customerData` completo nella delegation

**MAPPING INTENTS:**
| Intent | Sub-Agent | Dati Necessari |
|--------|-----------|----------------|
| Visualizzare categorie | `ProductSearchAgentLLM` | `action: "showCategories"` |
| Prodotti di una categoria | `ProductSearchAgentLLM` | `categoryName: string` |
| Dettaglio prodotto | `ProductSearchAgentLLM` | `productId: string` |
| Stato ordine | `OrderTrackingAgentLLM` | `orderCode?: string` |
| Carrello | `CartManagementAgentLLM` | `action: "view" \| "add" \| "remove"` |
| FAQ/Supporto | `CustomerSupportAgentLLM` | `question: string` |
| Profilo | `ProfileManagementAgentLLM` | `action: "view" \| "edit"` |

**PATTERN RICHIESTO:**
```typescript
// Router passa SEMPRE customerData risolto
await this.delegateToSubAgent("ProductSearchAgentLLM", {
  intent: "showCategoryProducts",
  categoryName: "Formaggi",        // MAI "2"
  customerData: promptVariables,   // Costruito con PromptVariableBuilder
})
```

---

### AC-3: Caricamento Modelli LLM Corretto

**REQUISITO:** I modelli LLM DEVONO essere caricati dinamicamente in base a:
1. `salesAgentAndService` boolean del workspace
2. Tipo di canale (WhatsApp, Widget, etc.)
3. Configurazione dell'agent (`agentConfig` table)

**LOGICA:**
```typescript
// salesAgentAndService = true  → Usa templates "ecommerce/"
// salesAgentAndService = false → Usa templates "informational/"

const templatePath = workspace.salesAgentAndService 
  ? 'ecommerce/router.md' 
  : 'informational/router.md'
```

**CARICAMENTO AGENTI:**
```typescript
// Caricare SOLO gli agenti necessari per il tipo workspace
if (workspace.salesAgentAndService) {
  // E-commerce: tutti gli agenti
  this.loadAgents(['ProductSearch', 'Cart', 'OrderTracking', 'CustomerSupport', 'Profile'])
} else {
  // Informational: solo supporto e profile
  this.loadAgents(['CustomerSupport', 'Profile'])
}
```

**⚠️ NO HARDCODE:** Mai caricare sempre tutti gli agenti - spreco di risorse

---

### AC-4: Ogni LLM Fa SOLO il Suo Lavoro

**REQUISITO:** Separazione chiara delle responsabilità:

| Agent | Responsabilità UNICHE | NON Deve Fare |
|-------|----------------------|---------------|
| Router | Capire intent, delegare | Generare risposte finali, accedere DB prodotti |
| ProductSearch | Cercare prodotti, mostrare categorie | Gestire carrello, ordini |
| Cart | Aggiungere/rimuovere dal carrello | Cercare prodotti, completare ordine |
| OrderTracking | Stato ordini, storico | Modificare ordini, cercare prodotti |
| CustomerSupport | FAQ, supporto generico | Operazioni su prodotti/ordini |
| Profile | Dati utente, preferenze | Qualsiasi altra cosa |

**ANTI-PATTERN DA EVITARE:**
```typescript
// ❌ SBAGLIATO: ProductSearch che gestisce il carrello
class ProductSearchAgentLLM {
  async handle() {
    if (userWantsToAddToCart) {
      await this.cartService.add(...) // ❌ NON FARE!
    }
  }
}

// ✅ CORRETTO: ProductSearch ritorna intent per delegation
class ProductSearchAgentLLM {
  async handle() {
    if (userWantsToAddToCart) {
      return { 
        requiresDelegation: true,
        delegateTo: "CartManagementAgentLLM",
        data: { productId, quantity }
      }
    }
  }
}
```

---

### AC-5: Traduzione SEMPRE Rispettata

**REQUISITO:** La traduzione DEVE:
1. Essere applicata a TUTTI i messaggi in uscita
2. Usare la lingua del customer (`customer.language`)
3. Non tradurre: nomi prodotti, codici, prezzi, brand

**FLOW:**
```
[Sub-Agent genera risposta in ITALIANO]
       ↓
[TranslationLayer verifica customer.language]
       ↓
[Se diverso da 'it' → chiama LLM traduzione]
       ↓
[Risposta tradotta al customer]
```

**ECCEZIONI DA NON TRADURRE:**
- Nomi prodotti: "Parmigiano Reggiano DOP" rimane così
- Codici ordine: "#ORD-ABC123" rimane così
- Prezzi: "€25.50" rimane così
- Brand/Aziende: Nome workspace rimane così
- Emoji: Rimangono invariate

**IMPLEMENTAZIONE:**
```typescript
// TranslationAgentLLM o TranslationService
async translateIfNeeded(response: string, targetLang: string): Promise<string> {
  if (targetLang === 'it') return response // No traduzione necessaria
  
  return await this.llm.translate({
    text: response,
    from: 'it',
    to: targetLang,
    preservePatterns: [
      /€[\d.,]+/g,           // Prezzi
      /#[A-Z0-9-]+/gi,       // Codici ordine
      /"[^"]+"/g,            // Testo tra virgolette (nomi prodotti)
    ]
  })
}
```

---

### AC-6: Prompt Generati e POI Salvati

**REQUISITO:** I prompt NON devono essere generati on-the-fly ma:
1. **Pre-generati** al deploy o al cambio configurazione
2. **Salvati** nel database (`agentConfig` table)
3. **Caricati** all'avvio del servizio (cached)
4. **Processati** solo per sostituire variabili runtime

**FLOW:**
```
[1. Deploy/Config Change]
       ↓
[2. npm run generate-prompts]  ← Genera da template + config
       ↓
[3. Salva in DB agentConfig]
       ↓
[4. Servizio carica all'avvio]
       ↓
[5. Runtime: solo replace variabili]
```

**PATTERN:**
```typescript
// ❌ SBAGLIATO: Generare prompt ad ogni richiesta
async handleMessage(message) {
  const template = await fs.readFile('templates/router.md')
  const prompt = this.processTemplate(template, ...) // ❌ Ogni volta!
  return await llm.chat(prompt)
}

// ✅ CORRETTO: Prompt pre-cached, solo variabili runtime
class LLMService {
  private promptCache: Map<string, string> = new Map()
  
  async onInit() {
    // Carica UNA VOLTA all'avvio
    const configs = await agentConfigRepository.findAll(workspaceId)
    configs.forEach(c => this.promptCache.set(c.agentType, c.promptContent))
  }
  
  async handleMessage(message) {
    const basePrompt = this.promptCache.get('router') // Già in memoria
    const finalPrompt = this.replaceRuntimeVariables(basePrompt, customerData)
    return await llm.chat(finalPrompt)
  }
}
```

---

### AC-7: Performance - Nessuna Query Duplicata

**REQUISITO:** Per ogni messaggio ricevuto, le query DB NON devono essere duplicate:

**QUERY CONSENTITE (1 sola volta per messaggio):**
- `getCustomer(phoneNumber)` → 1 volta
- `getWorkspace(id)` → 1 volta  
- `getChatSession(customerId)` → 1 volta
- `getAgentConfig(workspaceId, agentType)` → 1 volta per tipo agent usato
- `getProducts/Categories` → solo se necessario per il tipo richiesta

**PATTERN:**
```typescript
// ❌ SBAGLIATO: Query duplicate
class Router {
  async handle() {
    const customer = await customerRepo.findByPhone(phone)
    // ... logica
    const customerAgain = await customerRepo.findByPhone(phone) // ❌ DUPLICATA!
  }
}

// ✅ CORRETTO: Context object passato
class Router {
  async handle() {
    const context = await this.buildContext(phone) // UNA VOLTA
    // context.customer, context.workspace, context.session già caricati
    
    await this.delegateToSubAgent(context) // Passa tutto il context
  }
}
```

**LOGGING OBBLIGATORIO:**
```typescript
// Logga OGNI query per identificare duplicati in sviluppo
logger.debug("🔍 DB Query:", { 
  table: "customer", 
  operation: "findByPhone", 
  params: { phone } 
})
```

---

### AC-8: ZERO Hardcode nel Codice

**REQUISITO:** NESSUN valore hardcoded. TUTTO da database o configurazione.

**VIETATI:**
```typescript
// ❌ TUTTI QUESTI SONO VIETATI
const welcomeMessage = "Benvenuto nel nostro negozio!"
const companyName = "ShopME"
const maxProducts = 10
const currency = "EUR"
const defaultLanguage = "it"
if (category === "Formaggi") { ... }  // Nome categoria hardcoded
const agents = ["ProductSearch", "Cart"] // Lista agenti hardcoded
```

**PATTERN CORRETTO:**
```typescript
// ✅ TUTTO DA DATABASE
const welcomeMessage = workspace.welcomeMessage
const companyName = workspace.companyName
const maxProducts = workspace.displaySettings?.maxProducts ?? 10
const currency = workspace.currency
const defaultLanguage = workspace.defaultLanguage

// ✅ Categorie/prodotti SEMPRE da query
const categories = await categoryRepo.findActive(workspaceId)

// ✅ Lista agenti da configurazione workspace
const enabledAgents = await agentConfigRepo.findEnabled(workspaceId)
```

**ECCEZIONI CONSENTITE:**
- Costanti tecniche: HTTP status codes, regex patterns, API URLs
- Defaults per nuovi workspace (ma poi sovrascritti da config)

---

### AC-9: Prompt Generici - Non Solo Cibo

**REQUISITO:** I prompt DEVONO essere scritti in modo generico:
- **Oggi:** E-commerce alimentare (formaggi, salumi)
- **Domani:** Auto, elettronica, servizi, B2B

**PATTERN SBAGLIATO:**
```markdown
# ❌ Troppo specifico per cibo
Sei un assistente per un negozio di prodotti alimentari italiani.
Aiuta i clienti a scegliere formaggi e salumi di qualità.
Le categorie sono: Formaggi, Salumi, Vini, Dolci.
```

**PATTERN CORRETTO:**
```markdown
# ✅ Generico con variabili
Sei un assistente per {{companyName}}.
{{companyDescription}}

Il negozio offre {{productCount}} prodotti in {{categoryCount}} categorie.
{{#if hasActiveOffers}}
Ci sono {{offerCount}} offerte attive.
{{/if}}
```

**TERMINOLOGIA GENERICA:**
| Specifico (❌) | Generico (✅) |
|---------------|--------------|
| "formaggi freschi" | "prodotti della categoria selezionata" |
| "peso al kg" | "unità di misura del prodotto" |
| "stagionatura" | "caratteristiche del prodotto" |
| "abbinamento vini" | "suggerimenti correlati" |

---

### AC-10: Prompt Ottimizzati Senza Ridondanze

**REQUISITO:** I prompt DEVONO essere:
1. **Concisi** - Nessuna ripetizione di istruzioni
2. **Strutturati** - Sezioni chiare con header
3. **Token-efficient** - Ogni parola conta (€ per token!)

**OTTIMIZZAZIONI:**

```markdown
# ❌ RIDONDANTE (spreco token)
Tu sei un assistente virtuale. Il tuo ruolo è quello di assistere i clienti.
Come assistente, devi sempre essere cortese. Ricordati di essere cortese.
Quando rispondi, sii cortese e professionale. La cortesia è importante.

# ✅ OTTIMIZZATO
## Comportamento
- Tono: cortese, professionale
- Risposte: concise, informative
```

**STRUTTURA PROMPT STANDARD:**
```markdown
## Ruolo
[1-2 righe max]

## Contesto
{{companyName}}: {{companyDescription}}

## Regole
1. [Regola 1]
2. [Regola 2]

## Output Atteso
[Formato risposta]
```

**⚠️ LIMITE VARIABILI:** Mai usare stessa variabile 2 volte (vedi AC-11)

---

### AC-11: Unicità Variabili - Max 1 Occorrenza

**REQUISITO CRITICO:** Ogni variabile "pesante" può apparire MAX 1 VOLTA per prompt:
- `{{products}}` → può iniettare 50k+ token
- `{{categories}}` 
- `{{offers}}`
- `{{services}}`

**VALIDAZIONE OBBLIGATORIA:**
```typescript
// Prima di salvare prompt in DB
validatePromptVariables(promptContent: string): void {
  const heavyVars = ['products', 'offers', 'categories', 'services']
  
  for (const varName of heavyVars) {
    const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g')
    const matches = promptContent.match(regex)
    
    if (matches && matches.length > 1) {
      throw new ValidationError(
        `{{${varName}}} può apparire solo 1 volta. Trovate ${matches.length} occorrenze.`
      )
    }
  }
}
```

---

### AC-12: Dialogo Fluido

**REQUISITO:** La conversazione DEVE essere naturale e coerente:

**REGOLE:**
1. **Contesto mantenuto** - Non chiedere informazioni già fornite
2. **Risposte proporzionate** - Domanda breve → risposta breve
3. **No loop** - Se utente non capisce, prova approccio diverso
4. **Conferme intuitive** - "Sì", "Ok", "Va bene" → prosegui, non chiedere conferma

**ANTI-PATTERN:**
```
👤 "Voglio vedere i formaggi"
🤖 "Certo! Ecco i formaggi..."
👤 "Il secondo"
🤖 "Cosa intendi con 'il secondo'?" ❌ SBAGLIATO - deve capire dal contesto!
```

**PATTERN CORRETTO:**
```
👤 "Voglio vedere i formaggi"
🤖 "Ecco i formaggi disponibili:
    1. Parmigiano Reggiano - €18/kg
    2. Gorgonzola DOP - €15/kg"
👤 "Il secondo"
🤖 "Ottima scelta! Il Gorgonzola DOP a €15/kg..." ✅
```

---

### AC-13: Test via MCP (Model Context Protocol)

**REQUISITO:** Il funzionamento DEVE essere verificabile tramite MCP:

**COME TESTARE:**
```bash
# Usare MCP tool per simulare conversazione
mcp_gitkraken_git_status  # Verificare che il codice compili

# Testare endpoint direttamente
curl -X POST localhost:3001/api/workspaces/{id}/chat/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Mostrami i formaggi"}'
```

**LOG DA VERIFICARE:**
```typescript
// Ogni step deve essere loggato per debug
logger.info("🔍 [Router] Received message:", { message, customerId })
logger.info("🎯 [Router] Detected intent:", { intent, confidence })
logger.info("📤 [Router] Delegating to:", { agent, data })
logger.info("✅ [SubAgent] Response generated:", { responseLength, hasVariables })
```

---

## 📋 CHECKLIST FINALE PRE-DEPLOY

Prima di deployare qualsiasi modifica al sistema LLM:

### Acceptance Criteria
- [ ] AC-1: Numeri estratti correttamente da liste
- [ ] AC-2: Delegation corretta con dati risolti
- [ ] AC-3: Modelli caricati in base a `salesAgentAndService`
- [ ] AC-4: Ogni agent fa solo il suo lavoro
- [ ] AC-5: Traduzione applicata a tutti i messaggi
- [ ] AC-6: Prompt pre-generati e cached
- [ ] AC-7: Zero query duplicate per messaggio
- [ ] AC-8: Zero hardcode nel codice
- [ ] AC-9: Prompt generici (non food-specific)
- [ ] AC-10: Prompt ottimizzati senza ridondanze
- [ ] AC-11: Variabili pesanti max 1 occorrenza
- [ ] AC-12: Dialogo fluido e contestuale
- [ ] AC-13: Testato via MCP/curl

### Performance
- [ ] Tempo risposta < 3 secondi
- [ ] Cache prompt attiva
- [ ] Query DB minimizzate

### Security
- [ ] Workspace isolation mantenuta
- [ ] Priority checks (P1/P2) funzionanti
- [ ] Nessun dato sensibile nei log

---

## 🔍 PATTERN: Backend Validation nel Prompt

**NUOVO PATTERN**: Il prompt deve spiegare al modello ESATTAMENTE quale validazione il codice farà.

**Razionale:** 
- LLM sa che il codice controllerà specificamente il suo output
- LLM sa che risposte sbagliate verranno RIFIUTATE e farà "retry"
- LLM incentivato a rispettare le regole la PRIMA volta (non spreca token)

**Dove applicarlo:**
- Ogni regola che il backend validate DEVE essere spiegata nel prompt
- Il prompt deve descrivere ESATTAMENTE il pattern che il codice cerca

**ESEMPIO: Grouping Rule per 6+ prodotti**

```markdown
### 🔍 BACKEND VALIDATION - YOUR RESPONSE WILL BE CHECKED

If you respond with **6 or more lines like "1. Product Name - €Price"**:
- ❌ The backend detects this pattern: `^\d+\.\s+[^(]+€[\d.,]+$`
- ❌ Validation fails
- ❌ **Your response is REJECTED and you must retry**

If you respond with **2-4 group titles with counts like "1. Group Name (3)"**:
- ✅ Validation passes
- ✅ Response is sent to customer
- ✅ **Conversation flows smoothly**
```

**Benefici:**
- ✅ Modello sa COME il codice validerà
- ✅ Modello è incentivato a seguire regole
- ✅ Meno rejections e retry necessari
- ✅ Migliore esperienza utente (meno errori)

---

## 🏗️ PATTERN: Codice decide, LLM formatta (ARCHITETTURA CORRETTA)

**PROBLEMA SCOPERTO**: Passare 45kb+ di dati al modello causa confusione.

**SOLUZIONE**: Codice decide COSA mostrare, LLM formatta QUELLO che riceve.

### Flusso SBAGLIATO (❌ Attuale)
```
Router → ProductSearchAgent riceve query vaga
       → ProductSearchAgent carica INTERO catalogo (45kb)
       → LLM legge 45kb, decide autonomamente cosa fare
       → LLM si confonde, risponde male
       → Risultato: aleatorio
```

### Flusso CORRETTO (✅ Nuovo)
```
Router → ProductSearchAgent riceve query
       → Codice: parseIntent(query) → tipo di risposta
       → Codice: carica SOLO dati necessari (100-1000 bytes)
       → Template: riceve dati specifici per tipo
       → LLM: formatta il dato passato (NO logica)
       → Risultato: deterministico, rapido, corretto
```

### Implementazione Pattern

**1. Query Intent Parser (CODICE, non LLM)**
```typescript
type ProductSearchIntent = 
  | { type: 'SHOW_CATEGORIES' }
  | { type: 'SHOW_CATEGORY'; categoryName: string }
  | { type: 'SHOW_PRODUCT'; productId: string }

function parseProductSearchQuery(query: string): ProductSearchIntent {
  // Parsing deterministico
  if (query.includes('categor') && !query.includes('specific')) {
    return { type: 'SHOW_CATEGORIES' }
  }
  if (query.match(/User wants to see category '([^']+)'/)) {
    const categoryName = RegExp.$1
    return { type: 'SHOW_CATEGORY', categoryName }
  }
  if (query.match(/product.*([A-Z0-9-]+)/)) {
    const productId = RegExp.$1
    return { type: 'SHOW_PRODUCT', productId }
  }
  // Default: mostra categorie
  return { type: 'SHOW_CATEGORIES' }
}
```

**2. Carica SOLO dati necessari (CODICE, non prompt)**
```typescript
async function prepareDataForTemplate(intent: ProductSearchIntent) {
  if (intent.type === 'SHOW_CATEGORIES') {
    // Carica SOLO categorie (~500 bytes)
    return {
      mode: 'SHOW_CATEGORIES',
      categories: await db.getCategories(),
      // NO prodotti, NO dettagli
    }
  }
  
  if (intent.type === 'SHOW_CATEGORY') {
    // Carica SOLO prodotti di quella categoria (~2kb)
    const products = await db.getProductsByCategory(intent.categoryName)
    return {
      mode: 'SHOW_CATEGORY',
      categoryName: intent.categoryName,
      products, // Solo questi
      count: products.length,
    }
  }
  
  if (intent.type === 'SHOW_PRODUCT') {
    // Carica SOLO quel prodotto (~500 bytes)
    return {
      mode: 'SHOW_PRODUCT',
      product: await db.getProductById(intent.productId),
    }
  }
}
```

**3. Template riceve dati + mode (TEMPLATE MINIMALISTA)**
```markdown
{{#if mode === 'SHOW_CATEGORIES'}}
## Categorie

{{#each categories}}
{{@index + 1}}. **{{this.name}}** ({{this.productCount}} prodotti)
{{/each}}

Quale categoria ti interessa?
{{/if}}

{{#if mode === 'SHOW_CATEGORY'}}
## {{categoryName}}

{{#if count === 0}}
Nessun prodotto trovato. [show categories]
{{/if}}

{{#if count === 1 || count === 2}}
{{#each products}}
**{{this.name}}** - {{this.price}}
{{this.description}}

Vuoi aggiungerlo al carrello?
{{/each}}
{{/if}}

{{#if count >= 3 && count <= 5}}
{{#each products}}
{{@index + 1}}. **{{this.name}}** - {{this.price}}
{{/each}}

Quale prodotto ti interessa?
{{/if}}

{{#if count >= 6}}
[GROUPS - apply grouping logic]
{{/if}}
{{/if}}
```

**4. LLM formatta il template (LLM FA SOLO FORMATTING)**
```typescript
const template = getTemplateForMode(intent.type)
const prompt = template.render(data) // data = { mode, categories/products/... }

const response = await llm.generate({
  messages: [
    { 
      role: 'system', 
      content: 'You are a formatting assistant. Format the provided data according to the template structure. Do NOT add or remove data.'
    },
    {
      role: 'user',
      content: prompt
    }
  ],
  temperature: 0.3, // Basso: solo formatting, no creativity
})
```

### Vantaggi di questo pattern

| Aspetto | Sbagliato ❌ | Corretto ✅ |
|---------|-----------|----------|
| Dati al modello | 45kb catalogo | ~500 bytes dati necessari |
| Logica | LLM decide | Codice decide |
| Consistenza | Aleatorio | Deterministico |
| Velocità | 3-5 secondi | ~500ms |
| Token usage | 7000+ | 1000-2000 |
| Costo | $0.0015 | $0.0003 |
| Debugging | Difficile (cosa pensava LLM?) | Facile (vedi parseIntent output) |

### Quando usare questo pattern

- ✅ **Sempre** quando hai scelte logiche (categorie vs prodotti vs dettagli)
- ✅ **Sempre** quando i dati sono grandi
- ✅ **Sempre** quando vuoi risultati deterministici
- ❌ **NO** solo per formattazione pura (ma anche lì aiuta)

### Implementazione nel codebase

**File da creare:**
- `services/product-search-intent-parser.service.ts` - Parsing della query
- `services/product-search-data-loader.service.ts` - Carica dati specifici per tipo
- `templates/ecommerce/product-search-modes.md` - Template con {{#if mode}}

**File da modificare:**
- `product-search-agent.llm.ts` - Usa il parser, non carica tutto il catalogo
- `02-product-search.template.md` - Rimuovi 45kb, rimpiazza con {{#if mode}}

---

## 🏗️ PRINCIPI ARCHITETTURALI (FONDAMENTALI)

### Principio 1: Codice decide, LLM formatta

**Mai** lasciare che LLM decida la logica di business.

```
❌ SBAGLIATO:
LLM riceve: "Cosa vuoi?"
LLM pensa: "Hm, potrebbe volere categorie o prodotti..."
LLM risponde: "Ecco i formaggi!" (sbagliato!)

✅ CORRETTO:
Codice riceve: "Cosa vuoi?"
Codice parse: "Query contiene 'categor' → SHOW_CATEGORIES"
Codice carica: db.getCategories() → 500 bytes
LLM riceve: "Formatta queste 9 categorie"
LLM risponde: "1. Formaggi (7)..." (corretto!)
```

### Principio 2: Carica SOLO dati necessari

**Non passare mai 45kb quando ne bastano 500.**

| Scenario | Dati Necessari | Size | LLM Processing |
|----------|---|------|---|
| Mostra categorie | 9 categorie con count | ~500 bytes | ~100ms |
| Mostra prodotti di categoria | 7 prodotti della categoria | ~2kb | ~300ms |
| Mostra dettaglio prodotto | 1 prodotto completo | ~500 bytes | ~100ms |
| ❌ SBAGLIATO: Carica tutto | Intero catalogo | 45kb | 3-5s |

### Principio 3: Template deve avere MENO logica possibile

**Template riceve dati già filtrati + mode, fa SOLO formatting.**

```markdown
{{#if mode === 'SHOW_CATEGORIES'}}
// Mostra categorie
{{/if}}

{{#if mode === 'SHOW_CATEGORY'}}
// Mostra prodotti di categoria
// COUNT rules applicate dal codice (not LLM)
{{/if}}

// NO: "If user seems to want...", "If products are expensive..."
// Solo: "{{#if condition}}"
```

### Principio 4: Parsing è codice deterministico

**Non LLM, non prompt tricks, non vibes.**

```typescript
// Determinist parsing
if (query.includes('categor')) { intent = SHOW_CATEGORIES }
if (query.includes("'Formaggi'")) { intent = SHOW_CATEGORY('Formaggi') }
if (query.includes('#')) { intent = SHOW_ORDER }

// NO: "Let LLM decide what the user means"
```

### Principio 5: Validation è codice, non prompt

```typescript
// ✅ CORRETTO: Codice valida
if (products.length >= 6 && !hasGrouping(response)) {
  throw new ValidationError("Must group 6+ items")
}

// ❌ SBAGLIATO: Prompt spera che LLM capisca
// "You must group 6+ items..." (maybe LLM will do it)
```

---

## 💡 CHECKLIST ARCHITETTURALE

Prima di scrivere QUALSIASI prompt:

- [ ] **Chi decide la logica?** Codice, non LLM
- [ ] **Quanti dati passo?** SOLO necessari (< 5kb per messaggio)
- [ ] **Template ha {{#if}}?** Sì, per i diversi modi
- [ ] **Parsing è deterministico?** Sì, regex o if/else
- [ ] **Validation è nel codice?** Sì, non nel prompt
- [ ] **LLM fa formatting o logica?** SOLO formatting

Se rispondi NO a uno di questi → riconsiderai l'architettura.

---

## 🧹 PROMPT CLEANUP REPORT (2025-12-12)

### Stato iniziale
- ❌ 8 template con variabili duplicate (`{{companyName}}`, `{{botIdentityResponse}}`)
- ❌ 3 template con examples food-specific hardcoded ("Formaggi", "Formaggi Freschi", "Formaggi Stagionati")
- ✅ Totale 8 template auditati

### Violazioni AC-11 trovate e risolte
**AC-11: Variabili pesanti max 1 occorrenza per prompt**

| Template | Variabile | Occorrenze | Fix |
|----------|-----------|-----------|-----|
| `ecommerce/01-router` | `{{companyName}}` | ✅ 1 (titolo) | N/A |
| `ecommerce/02-product-search` | Hardcoded food examples | ❌ 3+ | ✅ Convertiti a `{{categoryExample1-3}}` |
| `ecommerce/03-order-tracking` | `{{companyName}}` | ❌ 2 | ✅ Ridotto a 1 nel titolo |
| `ecommerce/04-customer-support` | `{{companyName}}`, `{{botIdentityResponse}}` | ❌ 2 each | ✅ Deduplicate |
| `ecommerce/05-profile-management` | `{{companyName}}` | ❌ 2 | ✅ Ridotto a 1 nel titolo |
| `informational/01-router` | `{{companyName}}` | ❌ 2 | ✅ Ridotto a 1 nel titolo |
| `informational/04-customer-support` | `{{companyName}}` | ❌ 2 | ✅ Ridotto a 1 nel titolo |
| `informational/05-profile-management` | `{{companyName}}` | ❌ 2 | ✅ Ridotto a 1 nel titolo |
| `shared/06-security` | `{{companyName}}` | ❌ 2 | ✅ Ridotto a 1 nel titolo |
| `shared/07-translation` | Hardcoded food items | ⚠️ Note only | Removed from examples |
| `shared/08-summary` | `{{companyName}}` | ❌ 2 | ✅ Ridotto a 1 nel titolo |

### Modifiche applicate

**1. Rimosso hardcoding food-specific:**
- `router.template.md`: "Formaggi", "Category A/B/C", "Product A/B" → `{{categoryExample1-3}}`, `{{productExample1-2}}`
- `product-search.template.md`: "Formaggi (7 prodotti)", "Formaggi Freschi/Stagionati" → `{{categoryName}}`, `{{groupExample1-2}}`

**2. Deduplicate {{companyName}}:**
- Mantenuto SOLO nel titolo (line 1) per ogni template
- Rimosso dalle descrizioni (line 2-3)
- Pattern: "AGENT TITLE - {{companyName}}" + "You are the..." (senza ripetere companyName)

**3. Deduplicate {{botIdentityResponse}}:**
- `customer-support.template.md`: Una sola occorrenza nella sezione IDENTITY

**4. Conversione template generici:**
- Tutti gli esempi con dati hardcoded → template placeholders
- Esempi ora usano `{{variableName}}` pattern per renderizzazione runtime

### Template Status
- ✅ `ecommerce/01-router.template.md` — CLEAN
- ✅ `ecommerce/02-product-search.template.md` — CLEAN
- ✅ `ecommerce/03-order-tracking.template.md` — CLEAN
- ✅ `ecommerce/04-customer-support.template.md` — CLEAN
- ✅ `ecommerce/05-profile-management.template.md` — CLEAN
- ✅ `informational/01-router.template.md` — CLEAN
- ✅ `informational/04-customer-support.template.md` — CLEAN
- ✅ `informational/05-profile-management.template.md` — CLEAN
- ✅ `shared/06-security.template.md` — CLEAN
- ✅ `shared/07-translation.template.md` — CLEAN (no hardcoded items, generic rules)
- ✅ `shared/08-summary.template.md` — CLEAN

### Compliance
- ✅ **AC-9 (Generico, non food-specific)**: Tutti gli examples usano placeholder
- ✅ **AC-11 (Max 1 occorrenza variabili pesanti)**: `{{companyName}}` = 1 per template
- ✅ **AC-6 (Pre-generato, non on-the-fly)**: Template structure mantenuto, variabili renderizzate runtime
- ✅ **AC-10 (Ottimizzato)**: Rimossi duplicati, righe consolidate

---

## 📞 Contatti per Decisioni

- **Architettura LLM**: Discutere con Andrea prima di cambiare flusso
- **Nuove variabili**: Aggiungere QUI prima di usarle nel codice
- **Framework (LangChain)**: Decisione pending con Andrea
