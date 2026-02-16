# Custom Calling Functions per Workspace

> **Status**: 📐 Design Phase — infrastruttura DB esistente, implementazione runtime da completare  
> **Priorità**: Alta — abilita personalizzazione per-cliente senza modifiche al codice  
> **Autore**: Andrea  
> **Data**: Feb 2026

---

## Indice

1. [Obiettivo](#1-obiettivo)
2. [Architettura Attuale](#2-architettura-attuale)
3. [Infrastruttura Esistente](#3-infrastruttura-esistente)
4. [Design della Soluzione](#4-design-della-soluzione)
5. [Schema Database](#5-schema-database)
6. [Flusso Runtime](#6-flusso-runtime)
7. [Sicurezza](#7-sicurezza)
8. [Webhook Protocol](#8-webhook-protocol)
9. [Backoffice UI](#9-backoffice-ui)
10. [Esempi d'Uso](#10-esempi-duso)
11. [Piano di Implementazione](#11-piano-di-implementazione)
12. [Checklist Pre-Deploy](#12-checklist-pre-deploy)

---

## 1. Obiettivo

Permettere a ogni workspace (cliente) di registrare **funzioni custom** che il chatbot AI può invocare durante una conversazione, **senza toccare il codice sorgente**.

### Il Problema

Oggi tutte le calling functions sono hardcoded in `agent-functions.ts` e gestite da un gigante `switch` in `function-executor.service.ts`. Per aggiungere una funzione specifica di un cliente (es. "cerca precedenti legali" per un avvocato), serve una modifica al codice + deploy.

### La Soluzione

**Approccio unificato**: TUTTE le funzioni (core + custom) vivono nella tabella `WorkspaceCallingFunction`. Le funzioni **system** (productSearchAgent, customerSupportAgent, ecc.) sono create automaticamente alla creazione del workspace e NON sono cancellabili (solo disabilitabili). Le funzioni **custom** vengono aggiunte dal cliente e **eseguite via webhook** verso un endpoint esterno. L'LLM le scopre tutte dinamicamente a runtime.

```
┌──────────────────────────────────────────────────────────────────┐
│                        PRIMA (Oggi)                              │
│                                                                  │
│  agent-functions.ts (statico) → switch (hardcoded) → logica BE   │
│  Aggiungere funzione = PR + review + deploy                      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        DOPO (Approccio Unificato)                │
│                                                                  │
│  WorkspaceCallingFunction (DB unica tabella)                     │
│    ├── System functions (auto-create, non cancellabili)          │
│    │   └── productSearchAgent, customerSupportAgent, ...         │
│    └── Custom functions (aggiunte da cliente)                    │
│        └── cercaPrecedentiLegali → Webhook cliente               │
│                                                                  │
│  Aggiungere funzione = Settings → Salva → Fatto!                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Architettura Attuale

### Multi-Agent System

```
Customer Message
       │
       ▼
┌─────────────┐
│  ROUTER LLM │ ◄── getFunctionsForRouter() → tools statici
│  (GPT-4o)   │
└──────┬──────┘
       │ function_call: "productSearchAgent" / "cartManagementAgent" / ...
       ▼
┌─────────────────────────┐
│  function-executor.ts   │ ◄── switch(functionName) → 46 case hardcoded
│  (dispatch gigante)     │
└──────┬──────────────────┘
       │
       ▼
  Sub-Agent LLM (ProductSearch, Cart, Order, Support, Profile)
```

### File Chiave

| File | Ruolo | Linee |
|------|-------|-------|
| `apps/backend/src/config/agent-functions.ts` | Definizioni statiche delle funzioni (schema OpenAI) | 661 |
| `apps/backend/src/services/function-executor.service.ts` | Switch gigante per dispatch | 897 |
| `apps/backend/src/services/llm-router.service.ts` | Router LLM principale | 3612 |
| `packages/database/prisma/schema.prisma` | Schema DB con `WorkspaceCallingFunction` | 1905 |

### Funzioni Statiche Attuali

**Delegation (Router → Sub-Agent):**
- `productSearchAgent` — ricerca prodotti/catalogo
- `cartManagementAgent` — gestione carrello
- `orderTrackingAgent` — ordini/tracking/checkout
- `customerSupportAgent` — assistenza/reclami
- `profileManagementAgent` — profilo/notifiche

**Dirette:**
- `manageNotifications` — subscribe/unsubscribe push
- `RESET_ACTIVE_AGENT` — reset contesto conversazione
- `fetchWebsitePage` — scraping sito web

**Filtro E-commerce/Informational:**
```typescript
// In getFunctionsForRouter():
// sellsProductsAndServices = true  → TUTTI gli agenti
// sellsProductsAndServices = false → solo customerSupport + profileManagement + manageNotifications
```

---

## 3. Infrastruttura Esistente

### ✅ Già nel Database

Il modello `WorkspaceCallingFunction` **esiste già** nello schema Prisma e verrà esteso:

```prisma
model WorkspaceCallingFunction {
  id                    String    @id @default(cuid())
  workspaceId           String
  workspace             Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  functionName          String    // camelCase: "productSearchAgent", "cercaPrecedentiLegali"
  description           String?   @db.Text // Descrizione per l'LLM (QUANDO chiamarla)
  responseInstructions  String?   @db.Text // 🆕 Come presentare il risultato (per LLM)
  parameters            Json?     // 🆕 Schema OpenAI function calling
  
  // 🆕 Distingui system vs custom
  isSystemFunction      Boolean   @default(false)  // true = core (non cancellabile)
  executionType         String    @default("WEBHOOK")  // "DELEGATE_TO_AGENT" | "WEBHOOK" | "INTERNAL"
  
  isActive              Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([workspaceId, functionName])
  @@index([workspaceId, isActive])
  @@index([workspaceId, isSystemFunction])
  @@map("workspace_calling_functions")
}
```

**Nuovi campi:**
- `responseInstructions`: Dice all'LLM come presentare il risultato del webhook
- `isSystemFunction`: Se `true`, non può essere eliminata (solo disabilitata)
- `executionType`: Come eseguire la funzione (delegation agent / webhook / logica interna)

### ✅ Già nel Workspace Model

```prisma
model Workspace {
  webhookUrl    String?    // Esiste già (usato solo per display WhatsApp)
  // ...
  callingFunctions  WorkspaceCallingFunction[]  // Relazione inversa
}
```

### ⚠️ Codice Esistente ma Disabilitato

| Artifact | Stato | Note |
|----------|-------|------|
| `CustomAgentLLM.ts.bak` (619 linee) | 🔴 Disabilitato | Implementazione completa di un agent custom con proprio LLM, function calling loop, webhook dispatch |
| `WorkspaceCallingFunction` model | 🟡 Dead code | Schema esiste, nessun codice lo legge a runtime |
| `function-executor.service.ts` switch | 🔴 No extension point | Solo `case` hardcoded, nessun `default` per funzioni custom |

---

## 4. Design della Soluzione

### Approccio: Webhook-Based (Raccomandato)

Ogni workspace configura **un webhook URL** + **N funzioni custom**. Quando l'LLM chiama una funzione custom, il backend la inoltra al webhook del cliente.

```
┌──────────┐    function_call     ┌──────────────────┐
│ Router   │ ──────────────────→  │ function-executor │
│ LLM      │   "cercaPrecedenti"  │                  │
└──────────┘                      └────────┬─────────┘
                                           │
                    ┌──── statica? ────► switch(case...) → logica interna
                    │
                    └──── custom?  ────► POST webhook
                                           │
                                    ┌──────▼──────┐
                                    │  Webhook    │
                                    │  Cliente    │
                                    │  (API ext)  │
                                    └─────────────┘
```

### Perché Webhook e Non Plugin/Script

| Criterio | Webhook ✅ | Script in DB ❌ | Plugin Node ❌ |
|----------|-----------|----------------|---------------|
| Sicurezza | Isolato (HTTP) | Rischio eval/injection | Richiede sandbox |
| Linguaggio | Qualsiasi | Solo JS | Solo Node.js |
| Deploy | Indipendente | Accoppiato | Richiede restart |
| Debug | Log HTTP standard | Difficile | Medio |
| Scalabilità | Infinita | Limitata | Limitata |
| Latenza | ~100-500ms | ~10ms | ~10ms |

### Approccio Unificato: System + Custom Functions

**Tutte le funzioni** (core e custom) vivono nella stessa tabella `WorkspaceCallingFunction`:

```
WorkspaceCallingFunction
├── System Functions (isSystemFunction = true)
│   ├── Popolate automaticamente alla creazione workspace
│   ├── Set diverso per Ecommerce vs Informational
│   ├── NON cancellabili (DELETE bloccato da API)
│   ├── Disabilitabili (isActive = false)
│   ├── Description e responseInstructions modificabili
│   └── executionType: "DELEGATE_TO_AGENT" | "INTERNAL"
│
└── Custom Functions (isSystemFunction = false)
    ├── Aggiunte dal cliente via backoffice
    ├── Cancellabili
    ├── Totalmente configurabili
    └── executionType: "WEBHOOK"
```

#### Set Funzioni per Workspace Type

**E-commerce (`sellsProductsAndServices = true`):**
```typescript
System functions auto-create:
├── productSearchAgent       (DELEGATE_TO_AGENT)
├── cartManagementAgent      (DELEGATE_TO_AGENT)
├── orderTrackingAgent       (DELEGATE_TO_AGENT)
├── customerSupportAgent     (DELEGATE_TO_AGENT)
├── profileManagementAgent   (DELEGATE_TO_AGENT)
└── manageNotifications      (INTERNAL)
```

**Informational (`sellsProductsAndServices = false`):**
```typescript
System functions auto-create:
├── customerSupportAgent     (DELEGATE_TO_AGENT)
├── profileManagementAgent   (DELEGATE_TO_AGENT)
└── manageNotifications      (INTERNAL)
```

#### responseInstructions: Controllo Presentazione

Ogni funzione può avere `responseInstructions` che dice all'LLM **come** presentare il risultato:

```typescript
{
  functionName: "cercaPrecedentiLegali",
  description: "Cerca precedenti legali per query, anno e materia",
  responseInstructions: `
    Presenta i risultati come lista numerata.
    Per ogni precedente mostra: titolo, anno, sintesi breve.
    Se nessun risultato, suggerisci di riformulare la ricerca.
    Usa tono formale ma accessibile.
  `,
  executionType: "WEBHOOK"
}
```

Quando il webhook risponde, il sistema compone:

```typescript
// Messaggio "function" per l'LLM
const message = customFn.responseInstructions
  ? `INSTRUCTIONS: ${customFn.responseInstructions}\n\nDATA:\n${JSON.stringify(webhookResult)}`
  : JSON.stringify(webhookResult);
```

L'LLM riceve sia i dati che le istruzioni di presentazione → risposta personalizzata.

---

## 5. Schema Database

### Modifiche Necessarie

#### 5.1 — Workspace: Nuovi campi webhook

```prisma
model Workspace {
  // ... campi esistenti ...
  webhookUrl       String?   // ✅ GIÀ ESISTE — riutilizzare per custom functions
  webhookSecret    String?   // 🆕 HMAC secret per firma payload
  webhookTimeout   Int?      @default(10000) // 🆕 Timeout in ms (default 10s)
}
```

#### 5.2 — WorkspaceCallingFunction: Schema Completo

```prisma
model WorkspaceCallingFunction {
  id                    String    @id @default(cuid())
  workspaceId           String
  workspace             Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  functionName          String    // camelCase: "productSearchAgent", "cercaPrecedentiLegali"
  description           String?   @db.Text // QUANDO chiamarla (per LLM)
  responseInstructions  String?   @db.Text // COME presentare il risultato (per LLM)
  parameters            Json?     // Schema parametri (formato OpenAI function calling)
  
  isSystemFunction      Boolean   @default(false)  // true = core, non cancellabile
  executionType         String    @default("WEBHOOK")  // "DELEGATE_TO_AGENT" | "WEBHOOK" | "INTERNAL"
  
  isActive              Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([workspaceId, functionName])
  @@index([workspaceId, isActive])
  @@index([workspaceId, isSystemFunction])
  @@map("workspace_calling_functions")
}
```

#### 5.3 — Formato del campo `parameters`

Il campo `parameters` JSON segue lo **schema OpenAI function calling**:

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Testo di ricerca per cercare precedenti legali"
    },
    "anno": {
      "type": "integer",
      "description": "Anno minimo dei precedenti (opzionale)"
    },
    "materia": {
      "type": "string",
      "enum": ["civile", "penale", "amministrativo", "tributario"],
      "description": "Area del diritto"
    }
  },
  "required": ["query"]
}
```

---

## 6. Flusso Runtime

### Sequenza Completa

```
1. Cliente scrive: "Cerca precedenti su divorzio con figli"
                          │
2. llm-router.service.ts │
   callRouterLLM()        │
                          ▼
3. ┌─────────────────────────────────────────┐
   │ Carica funzioni statiche               │
   │   getFunctionsForRouter()              │
   │ + Carica funzioni custom dal DB        │
   │   WorkspaceCallingFunction.findMany()  │
   │ = tools[] completo per LLM            │
   └──────────────┬──────────────────────────┘
                  │
4. LLM riceve tools = [
     // Statiche
     { name: "productSearchAgent", ... },
     { name: "customerSupportAgent", ... },
     // Custom (da DB)
     { name: "cercaPrecedentiLegali", description: "Cerca ...", parameters: {...} },
     { name: "calcolaParcella", description: "Calcola ...", parameters: {...} }
   ]
                  │
5. LLM sceglie: function_call = "cercaPrecedentiLegali"
   args = { "query": "divorzio con figli", "materia": "civile" }
                  │
6. function-executor.service.ts
   switch(functionName) {
     case "productSearchAgent": ...  // statica
     case "cartManagementAgent": ... // statica
     ...
     default:  // 🆕 CUSTOM FUNCTION HANDLER
       → dispatchToWebhook(functionName, args, workspace)
   }
                  │
7. POST https://api.avvocato.com/webhook
   Headers:
     Content-Type: application/json
     X-Webhook-Signature: sha256=abc123...
     X-Workspace-Id: ws_123
   Body: {
     "functionName": "cercaPrecedentiLegali",
     "parameters": { "query": "divorzio con figli", "materia": "civile" },
     "customerId": "cust_456",
     "timestamp": "2026-02-16T10:30:00Z"
   }
                  │
8. Webhook risponde:
   {
     "success": true,
     "data": {
       "results": [
         { "titolo": "Cassazione 12345/2023", "sintesi": "..." },
         { "titolo": "Tribunale Milano 678/2024", "sintesi": "..." }
       ],
       "totalResults": 2
     }
   }
                  │
9. function-executor ritorna risultato → Router LLM
                  │
10. LLM genera risposta finale:
    "Ho trovato 2 precedenti rilevanti su divorzio con figli:
     1. Cassazione 12345/2023 — ...
     2. Tribunale Milano 678/2024 — ..."
```

### Codice: Loading Unified Functions

```typescript
// In llm-router.service.ts → callRouterLLM()

// Carica TUTTE le funzioni dal DB (system + custom)
const allFunctions = await this.prisma.workspaceCallingFunction.findMany({
  where: {
    workspaceId,
    isActive: true
  },
  orderBy: [
    { isSystemFunction: 'desc' },  // System prima
    { functionName: 'asc' }
  ]
});

// Converti in formato OpenAI tools
const tools = allFunctions.map(fn => ({
  type: "function" as const,
  function: {
    name: fn.functionName,
    description: fn.description || `Function: ${fn.functionName}`,
    parameters: fn.parameters || {
      type: "object",
      properties: {
        query: { type: "string", description: "Input for the function" }
      },
      required: ["query"]
    }
  }
}));

// Fallback: se DB vuoto (workspace pre-migration), usa hardcoded
if (tools.length === 0) {
  logger.warn(`No functions in DB for workspace ${workspaceId}, using fallback`);
  return getFunctionsForRouter({ 
    sellsProductsAndServices: workspace.sellsProductsAndServices 
  });
}
```

### Codice: Execution Routing

```typescript
// In function-executor.service.ts → executeFunction()

// Carica funzione dal DB
const fn = await this.prisma.workspaceCallingFunction.findFirst({
  where: {
    workspaceId: context.workspaceId,
    functionName,
    isActive: true
  },
  include: {
    workspace: {
      select: {
        webhookUrl: true,
        webhookSecret: true,
        webhookTimeout: true
      }
    }
  }
});

if (!fn) {
  return {
    success: false,
    error: `Unknown function: ${functionName}`,
    data: { message: `Function "${functionName}" not found or disabled` }
  };
}

// Routing basato su executionType
let result: any;

switch (fn.executionType) {
  case "DELEGATE_TO_AGENT":
    // Delegation a sub-agent (productSearchAgent, customerSupportAgent, etc.)
    result = await this.delegateToAgent(functionName, args, context);
    break;

  case "INTERNAL":
    // Logica interna (manageNotifications, RESET_ACTIVE_AGENT)
    result = await this.executeInternal(functionName, args, context);
    break;

  case "WEBHOOK":
    // Custom function → POST al webhook del cliente
    if (!fn.workspace?.webhookUrl) {
      return {
        success: false,
        error: "Webhook URL not configured for this workspace"
      };
    }

    const webhookResult = await this.dispatchToWebhook(
      fn.workspace.webhookUrl,
      fn.workspace.webhookSecret,
      fn.workspace.webhookTimeout || 10000,
      functionName,
      args,
      context
    );

    // Inietta responseInstructions se presente
    if (fn.responseInstructions && webhookResult.success) {
      result = {
        ...webhookResult,
        // L'LLM riceverà questo nel messaggio role: "function"
        formattedResponse: `INSTRUCTIONS: ${fn.responseInstructions}\n\nDATA:\n${JSON.stringify(webhookResult.data)}`
      };
    } else {
      result = webhookResult;
    }
    break;

  default:
    return {
      success: false,
      error: `Unknown executionType: ${fn.executionType}`
    };
}

return result;
```

---

## 7. Sicurezza

### 7.1 — HMAC Signature

Ogni richiesta webhook è firmata con HMAC-SHA256:

```typescript
import crypto from 'crypto';

function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Invio
const body = JSON.stringify(webhookPayload);
const signature = signPayload(body, workspace.webhookSecret);
headers['X-Webhook-Signature'] = `sha256=${signature}`;
```

Il client verifica:

```typescript
// Lato cliente (esempio Node.js)
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const expected = `sha256=${signPayload(JSON.stringify(req.body), MY_SECRET)}`;

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Processa la richiesta...
});
```

### 7.2 — Timeout e Retry

| Parametro | Default | Configurabile |
|-----------|---------|---------------|
| Timeout | 10s | ✅ `webhookTimeout` (1s–30s) |
| Retry | 0 | ❌ Nessun retry (LLM gestisce l'errore) |
| Max payload size | 1MB | ❌ Fisso |

### 7.3 — Validazione Nomi Funzione

**Conflitti con System Functions:**

Con l'approccio unificato, i nomi sono automaticamente protetti dal constraint `@@unique([workspaceId, functionName])`. Non puoi creare una custom function con lo stesso nome di una system function già presente.

```typescript
// Validation in API
async createFunction(req: Request, res: Response) {
  const { functionName, ...data } = req.body;
  const workspaceId = (req as any).workspaceId;

  // Check if name already exists (system or custom)
  const existing = await prisma.workspaceCallingFunction.findFirst({
    where: {
      workspaceId,
      functionName
    }
  });

  if (existing) {
    return res.status(409).json({
      error: 'Function name already exists',
      message: existing.isSystemFunction
        ? `"${functionName}" is a system function and cannot be overridden`
        : `A custom function named "${functionName}" already exists`
    });
  }

  // Create custom function
  const fn = await prisma.workspaceCallingFunction.create({
    data: {
      ...data,
      functionName,
      workspaceId,
      isSystemFunction: false,  // Always false for API-created functions
      executionType: "WEBHOOK"
    }
  });

  return res.json(fn);
}
```

**Pattern consigliati:**

Custom function names dovrebbero essere **descrittive e specifiche** del dominio del cliente:

✅ `cercaPrecedentiLegali`, `prenotaTavolo`, `calcolaMutuo`  
❌ `search`, `book`, `calculate` (troppo generici)

### 7.4 — System Function Protection

**Regole:**
- `isSystemFunction = true` → ❌ **DELETE forbidden**, ✅ **DISABLE allowed** (`isActive = false`)
- `isSystemFunction = false` → ✅ **DELETE allowed**

```typescript
// DELETE /workspaces/:workspaceId/functions/:id
async deleteFunction(req: Request, res: Response) {
  const { id } = req.params;
  const workspaceId = (req as any).workspaceId;

  const fn = await prisma.workspaceCallingFunction.findFirst({
    where: { id, workspaceId }
  });

  if (!fn) {
    return res.status(404).json({ error: 'Function not found' });
  }

  // 🚨 BLOCK: Cannot delete system functions
  if (fn.isSystemFunction) {
    return res.status(403).json({ 
      error: 'Cannot delete system function',
      message: 'System functions are core to the workspace and cannot be deleted.',
      suggestion: 'Use PATCH /functions/:id with { "isActive": false } to disable it instead.'
    });
  }

  // OK - delete custom function
  await prisma.workspaceCallingFunction.delete({ where: { id } });
  
  logger.info(`Deleted custom function ${fn.functionName} from workspace ${workspaceId}`);
  
  return res.json({ success: true, message: 'Function deleted' });
}
```

**Modifiche permesse:**

| Campo | System Function | Custom Function |
|-------|----------------|-----------------|
| `functionName` | ❌ Readonly (unique key) | ❌ Readonly (unique key) |
| `description` | ✅ Editable | ✅ Editable |
| `responseInstructions` | ✅ Editable | ✅ Editable |
| `parameters` | ❌ Readonly (schema fisso) | ✅ Editable |
| `isActive` | ✅ Editable | ✅ Editable |
| `executionType` | ❌ Readonly | ❌ Readonly |
| `isSystemFunction` | ❌ Readonly | ❌ Readonly |

### 7.5 — Rate Limiting

### 7.5 — Rate Limiting

- Max **20 custom function calls per sessione** (evita loop infiniti)
- Max **5 custom functions per workspace** (piano base)
- Max **50 custom functions per workspace** (piano enterprise)

### 7.6 — Sandbox

- Le funzioni custom **NON** possono chiamare altri sub-agent (limitazione ereditata da `CustomAgentLLM`)
- Le funzioni custom **NON** hanno accesso al database eChatbot
- Le funzioni custom ricevono solo: `functionName`, `parameters`, `customerId`, `timestamp`

---

## 8. Webhook Protocol

### Request (eChatbot → Cliente)

```http
POST https://api.cliente.com/echatbot-webhook
Content-Type: application/json
X-Webhook-Signature: sha256=abc123def456...
X-Workspace-Id: clxyz123
X-Request-Id: req_789
User-Agent: eChatbot/1.0
```

```json
{
  "event": "function_call",
  "functionName": "cercaPrecedentiLegali",
  "parameters": {
    "query": "divorzio con figli",
    "materia": "civile"
  },
  "context": {
    "customerId": "cust_456",
    "customerName": "Mario Rossi",
    "sessionId": "sess_789",
    "timestamp": "2026-02-16T10:30:00.000Z"
  },
  "metadata": {
    "workspaceId": "ws_123",
    "requestId": "req_789"
  }
}
```

### Response (Cliente → eChatbot)

**⚠️ IMPORTANTE**: Il webhook può ritornare **qualsiasi JSON**. Non c'è formato obbligatorio. Il risultato viene passato come stringa (`JSON.stringify()`) all'LLM, che lo interpreta per generare la risposta.

#### Esempi di risposte valide

```json
// ✅ Oggetto strutturato
{
  "results": [
    { "titolo": "Cassazione 12345/2023", "sintesi": "Diritto di visita..." }
  ],
  "totalResults": 1
}

// ✅ Array semplice
[
  { "nome": "Slot A", "ora": "15:00" },
  { "nome": "Slot B", "ora": "16:30" }
]

// ✅ Valore primitivo
{ "prezzo": 300, "disponibile": true }

// ✅ Stringa
"Nessun risultato trovato per la ricerca"
```

#### Gestione Errori (4xx/5xx)

In caso di errore HTTP, il sistema passa all'LLM:

```json
{
  "error": "Webhook returned status 500",
  "message": "Internal server error"
}
```

#### Gestione Errori nel Chatbot

| Stato HTTP | Comportamento |
|------------|---------------|
| 200 | Risultato passato all'LLM per risposta |
| 4xx | LLM riceve `{ error: "..." }`, risponde al cliente con messaggio chiaro |
| 5xx | LLM riceve `{ error: "Service unavailable" }`, chiede scusa |
| Timeout | LLM riceve `{ error: "Timeout" }`, suggerisce di riprovare |
| Network error | LLM riceve `{ error: "Connection failed" }` |

---

## 9. Backoffice UI

### 9.1 — Settings → Sezione "Functions"

```
┌─────────────────────────────────────────────────────┐
│  ⚙️ Settings                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📡 Webhook Configuration                          │
│  ┌─────────────────────────────────────────────┐    │
│  │ Webhook URL                                 │    │
│  │ [https://api.avvocato.com/webhook      ]    │    │
│  │                                             │    │
│  │ Webhook Secret                              │    │
│  │ [••••••••••••••]  [🔄 Generate] [👁 Show]   │    │
│  │                                             │    │
│  │ Timeout (seconds)                           │    │
│  │ [10 ▼]                                      │    │
│  │                                             │    │
│  │ [Test Connection]        [Save]             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  🔧 Functions (7 active / 9 total)                  │
│                                                     │
│  🔒 System Functions (5) — Cannot delete           │
│  ┌─────────────────────────────────────────────┐    │
│  │ ┌─────────────────────────────────────────┐ │    │
│  │ │ 🟢 productSearchAgent          [System]│ │    │
│  │ │ Delegate to Product Search Agent        │ │    │
│  │ │ 1 parameter • Active • DELEGATE         │ │    │
│  │ │                 [Disable] [Edit Desc]   │ │    │
│  │ └─────────────────────────────────────────┘ │    │
│  │ ┌─────────────────────────────────────────┐ │    │
│  │ │ 🟢 customerSupportAgent        [System]│ │    │
│  │ │ Delegate to Customer Support Agent      │ │    │
│  │ │ 1 parameter • Active • DELEGATE         │ │    │
│  │ │                 [Disable] [Edit Desc]   │ │    │
│  │ └─────────────────────────────────────────┘ │    │
│  │ ┌─────────────────────────────────────────┐ │    │
│  │ │ 🔴 orderTrackingAgent          [System]│ │    │
│  │ │ Delegate to Order Tracking Agent        │ │    │
│  │ │ 1 parameter • Disabled • DELEGATE       │ │    │
│  │ │                 [Enable] [Edit Desc]    │ │    │
│  │ └─────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  🛠 Custom Functions (2/5) — Webhook-based          │
│  ┌─────────────────────────────────────────────┐    │
│  │ ┌─────────────────────────────────────────┐ │    │
│  │ │ 🟢 cercaPrecedentiLegali               │ │    │
│  │ │ Cerca precedenti legali per query       │ │    │
│  │ │ 3 parameters • Active • WEBHOOK         │ │    │
│  │ │                        [Edit] [Delete]  │ │    │
│  │ └─────────────────────────────────────────┘ │    │
│  │ ┌─────────────────────────────────────────┐ │    │
│  │ │ 🟢 calcolaParcella                      │ │    │
│  │ │ Calcola parcella per tipo di servizio   │ │    │
│  │ │ 2 parameters • Active • WEBHOOK         │ │    │
│  │ │                        [Edit] [Delete]  │ │    │
│  │ └─────────────────────────────────────────┘ │    │
│  │                                             │    │
│  │            [+ Add Custom Function]          │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ⚠️ Note: System functions cannot be deleted,       │
│  only disabled. They are created automatically      │
│  based on workspace type (Ecommerce/Informational). │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 9.2 — Edit Function Panel (Sheet slide-in)

```
┌──────────────────────────────────────────┐
│  ✏️ Edit Custom Function                 │
│                                          │
│  Function Name (camelCase)               │
│  [cercaPrecedentiLegali            ]     │
│  ⚠️ Cannot be changed after creation     │
│                                          │
│  Description (for AI — when to call)     │
│  [ Search legal precedents by query,     ]
│  [ year, and legal area. Use when the    ]
│  [ customer asks about legal cases or    ]
│  [ court decisions.                      ]
│                                          │
│  Response Instructions (how to present)  │
│  [ Present results as numbered list.     ]
│  [ For each precedent show: title, year, ]
│  [ brief summary. If no results, suggest ]
│  [ reformulating the search. Use formal  ]
│  [ but accessible tone.                  ]
│                                          │
│  Active  [✅ ON]                         │
│                                          │
│  ── Parameters ──────────────────────    │
│                                          │
│  ┌────────────────────────────────┐      │
│  │ Name: query                   │      │
│  │ Type: [string ▼]              │      │
│  │ Description: [Search text   ] │      │
│  │ Required: [✅]                │      │
│  │                    [🗑 Remove]│      │
│  └────────────────────────────────┘      │
│  ┌────────────────────────────────┐      │
│  │ Name: anno                    │      │
│  │ Type: [integer ▼]             │      │
│  │ Description: [Minimum year  ] │      │
│  │ Required: [  ]                │      │
│  │                    [🗑 Remove]│      │
│  └────────────────────────────────┘      │
│  ┌────────────────────────────────┐      │
│  │ Name: materia                 │      │
│  │ Type: [string ▼]              │      │
│  │ Enum: civile,penale,amm,trib  │      │
│  │ Description: [Legal area    ] │      │
│  │ Required: [  ]                │      │
│  │                    [🗑 Remove]│      │
│  └────────────────────────────────┘      │
│                                          │
│  [+ Add Parameter]                       │
│                                          │
│  ── Preview (JSON) ──────────────────    │
│  {                                       │
│    "name": "cercaPrecedentiLegali",      │
│    "description": "Search legal...",     │
│    "responseInstructions": "Present...", │
│    "parameters": {                       │
│      "type": "object",                   │
│      "properties": {                     │
│        "query": { "type": "string" },    │
│        "anno": { "type": "integer" },    │
│        "materia": {                      │
│          "type": "string",               │
│          "enum": ["civile", "penale"]    │
│        }                                 │
│      },                                  │
│      "required": ["query"]               │
│    }                                     │
│  }                                       │
│                                          │
│  [Cancel]                    [Save]      │
└──────────────────────────────────────────┘
```

**Note:**
- System functions: solo description e responseInstructions modificabili (parameters readonly)
- Custom functions: tutto modificabile tranne functionName (chiave unica)

---

## 9.3 — Seed Automatico & Migrazione

### Creazione Nuovo Workspace

```typescript
// backend/src/application/services/workspace.service.ts

async createWorkspace(userId: string, data: CreateWorkspaceDto) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Create workspace
    const workspace = await tx.workspace.create({
      data: {
        name: data.name,
        slug: data.slug,
        sellsProductsAndServices: data.sellsProductsAndServices
      }
    });

    // 2. Create UserWorkspace relation
    await tx.userWorkspace.create({
      data: { userId, workspaceId: workspace.id, role: 'ADMIN' }
    });

    // 3. 🆕 Populate system functions based on workspace type
    await this.seedSystemFunctions(tx, workspace.id, data.sellsProductsAndServices);

    // 4. Create agent configs (system prompts)
    await tx.agentConfig.createMany({ ... });

    return workspace;
  });
}

private async seedSystemFunctions(
  tx: PrismaTransaction,
  workspaceId: string,
  isEcommerce: boolean
) {
  const functions: any[] = [];

  // E-commerce agents (only if selling products/services)
  if (isEcommerce) {
    functions.push(
      {
        functionName: "productSearchAgent",
        description: "Delegate to Product Search Agent for product catalog browsing, search, filters. Use when customer asks about products, prices, categories, certifications.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Customer's product search query" }
          },
          required: ["query"]
        },
        isSystemFunction: true,
        executionType: "DELEGATE_TO_AGENT",
        isActive: true
      },
      {
        functionName: "cartManagementAgent",
        description: "Delegate to Cart Management Agent for add/remove products, view cart, modify quantities. Use when customer wants to add to cart or modify cart contents.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Cart-related request" }
          },
          required: ["query"]
        },
        isSystemFunction: true,
        executionType: "DELEGATE_TO_AGENT",
        isActive: true
      },
      {
        functionName: "orderTrackingAgent",
        description: "Delegate to Order Tracking Agent for order history, tracking, checkout confirmation. Use for orders, delivery status, checkout.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Order-related question" }
          },
          required: ["query"]
        },
        isSystemFunction: true,
        executionType: "DELEGATE_TO_AGENT",
        isActive: true
      }
    );
  }

  // Always available (both Info and Ecommerce)
  functions.push(
    {
      functionName: "customerSupportAgent",
      description: "Delegate to Customer Support Agent for complaints, issues, human operator contact. Use when customer is frustrated or has problems. NOT for notification management.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Support request" }
        },
        required: ["query"]
      },
      isSystemFunction: true,
      executionType: "DELEGATE_TO_AGENT",
      isActive: true
    },
    {
      functionName: "profileManagementAgent",
      description: "Delegate to Profile Management Agent for email updates, notification preferences, profile data changes. Use for notification subscribe/unsubscribe, email change.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Profile-related request" }
        },
        required: ["query"]
      },
      isSystemFunction: true,
      executionType: "DELEGATE_TO_AGENT",
      isActive: true
    },
    {
      functionName: "manageNotifications",
      description: "Manage push notification preferences (subscribe/unsubscribe).",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["subscribe", "unsubscribe"],
            description: "Action to perform"
          }
        },
        required: ["action"]
      },
      isSystemFunction: true,
      executionType: "INTERNAL",
      isActive: true
    }
  );

  await tx.workspaceCallingFunction.createMany({
    data: functions.map(fn => ({ ...fn, workspaceId }))
  });

  logger.info(`✅ Seeded ${functions.length} system functions for workspace ${workspaceId}`);
}
```

### Migrazione Workspace Esistenti

```typescript
// backend/scripts/migrate-existing-workspaces.ts

import { PrismaClient } from '@echatbot/database';

const prisma = new PrismaClient();

async function migrateExistingWorkspaces() {
  const workspaces = await prisma.workspace.findMany({
    select: { 
      id: true, 
      name: true,
      sellsProductsAndServices: true 
    }
  });

  console.log(`Found ${workspaces.length} workspaces to migrate`);

  for (const workspace of workspaces) {
    const existingFunctions = await prisma.workspaceCallingFunction.count({
      where: { workspaceId: workspace.id }
    });

    if (existingFunctions > 0) {
      console.log(`⏭️  Skip ${workspace.name} — already has functions`);
      continue;
    }

    // Populate with seed logic
    await seedSystemFunctions(workspace.id, workspace.sellsProductsAndServices);
    console.log(`✅ Migrated ${workspace.name}`);
  }

  console.log('✅ Migration complete');
}

async function seedSystemFunctions(workspaceId: string, isEcommerce: boolean) {
  // Same logic as workspace.service.ts
  const functions: any[] = [...];
  
  await prisma.workspaceCallingFunction.createMany({
    data: functions.map(fn => ({ ...fn, workspaceId }))
  });
}

migrateExistingWorkspaces()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run migration:**
```bash
cd apps/backend
npx ts-node scripts/migrate-existing-workspaces.ts
```

---

## 10. Esempi d'Uso

### 🏛️ Studio Legale (Informational)

```
Workspace: "Studio Legale Rossi"
Type: Informational (sellsProductsAndServices = false)
Webhook: https://api.studiorossi.com/echatbot

System Functions (auto-created):
├── customerSupportAgent        (DELEGATE_TO_AGENT)
├── profileManagementAgent      (DELEGATE_TO_AGENT)
└── manageNotifications         (INTERNAL)

Custom Functions (added by client):
├── cercaPrecedentiLegali(query, anno?, materia?) → WEBHOOK
│   → Cerca nel DB giurisprudenza dello studio
├── calcolaParcella(tipoServizio, oreStimate) → WEBHOOK
│   → Calcola preventivo basato su tariffario
├── verificaScadenzaTermini(praticaId) → WEBHOOK
│   → Controlla scadenze procedurali
└── prenotaAppuntamento(data, ora, tipo) → WEBHOOK
    → Crea slot nel CRM dello studio
```

**Conversazione esempio:**
```
👤 "Quanto costa una consulenza per divorzio?"
🤖 [LLM chiama calcolaParcella({ tipoServizio: "consulenza_divorzio", oreStimate: 2 })]
🤖 "Una consulenza iniziale per divorzio ha un costo di €300 per circa 2 ore.
    Include analisi della situazione e strategia legale. Vuoi prenotare?"

👤 "Sì, giovedì pomeriggio"
🤖 [LLM chiama prenotaAppuntamento({ data: "2026-02-19", ora: "15:00", tipo: "divorzio" })]
🤖 "Appuntamento confermato per giovedì 19 febbraio alle 15:00."
```

### 🍕 Ristorante (E-commerce)

```
Workspace: "Pizzeria Da Mario"
Type: E-commerce (sellsProductsAndServices = true)
Webhook: https://pizzeriamario.app/api/echatbot

System Functions (auto-created):
├── productSearchAgent          (DELEGATE_TO_AGENT)
├── cartManagementAgent         (DELEGATE_TO_AGENT)
├── orderTrackingAgent          (DELEGATE_TO_AGENT)
├── customerSupportAgent        (DELEGATE_TO_AGENT)
├── profileManagementAgent      (DELEGATE_TO_AGENT)
└── manageNotifications         (INTERNAL)

Custom Functions (added by client):
├── checkDisponibilitaTavolo(data, numPersone, fascia?) → WEBHOOK
│   → Verifica disponibilità nel gestionale
└── creaPrenotazione(data, ora, numPersone, nome, note?) → WEBHOOK
    → Crea prenotazione nel gestionale
```

**Conversazione esempio:**
```
👤 "Voglio ordinare una margherita e una birra"
🤖 [Usa productSearchAgent → cartManagementAgent (system functions)]
🤖 "Ho aggiunto al carrello: Pizza Margherita €8.50, Birra €4.00. Totale €12.50"

👤 "E posso prenotare un tavolo per stasera?"
🤖 [LLM chiama checkDisponibilitaTavolo({ data: "2026-02-16", numPersone: 2, fascia: "sera" })]
🤖 "Abbiamo disponibilità alle 20:00 e alle 21:30. Quale preferisci?"
```

### 🏠 Agenzia Immobiliare

```
Workspace: "Immobiliare Verdi"
Webhook: https://api.immobiliareverdi.it/chatbot

Funzioni:
├── cercaImmobili(zona, tipo, budgetMin?, budgetMax?, mq?)
│   → Cerca nel portafoglio immobili
├── prenotaVisita(immobileId, data, ora)
│   → Prenota visita con agente
└── calcolaMutuo(importo, anni, tassoFisso?)
    → Simulazione rata mutuo
```

### 🏥 Studio Medico

```
Workspace: "Dr. Bianchi - Dermatologo"
Webhook: https://clinicabianchi.it/api/bot

Funzioni:
├── checkDisponibilita(settimana?, dottore?)
│   → Slot liberi nel gestionale
├── prenotaVisita(data, ora, tipo, note?)
│   → Prenotazione nel gestionale
└── getInfoPrestazione(prestazione)
    → Info dettagliate su costi e preparazione
```

---

## 11. Piano di Implementazione

### Fase 1 — DB & Schema (1 giorno)

- [ ] Aggiungere campi a `Workspace`: `webhookSecret`, `webhookTimeout`
- [ ] Aggiungere campi a `WorkspaceCallingFunction`: `responseInstructions`, `parameters`, `isSystemFunction`, `executionType`
- [ ] Prisma migration: `npx prisma migrate dev --name add-unified-calling-functions`
- [ ] **Seed update**: Popolare funzioni system per workspace esistenti e nuovi
- [ ] **Migration script**: Script per popolare `WorkspaceCallingFunction` per workspace esistenti

### Fase 2 — Backend Runtime (2-3 giorni)

- [ ] **`llm-router.service.ts`**: In `callRouterLLM()`, caricare TUTTE le funzioni da DB (system + custom)
- [ ] **`function-executor.service.ts`**: Routing basato su `executionType`:
  - `DELEGATE_TO_AGENT` → delegation esistente
  - `WEBHOOK` → dispatchToWebhook()
  - `INTERNAL` → logica interna (manageNotifications)
- [ ] Creare `WebhookDispatchService`:
  - HMAC signature
  - Timeout handling
  - Error mapping
  - Logging
  - `responseInstructions` injection nel messaggio LLM
- [ ] **`workspace.service.ts`**: Popolare funzioni system in `createWorkspace()`
- [ ] Validazione: nomi riservati per custom functions
- [ ] Validazione: `isSystemFunction = true` non può essere eliminata
- [ ] Rate limiting per sessione

### Fase 3 — API CRUD (1 giorno)

- [ ] `GET /workspaces/:id/functions` — lista TUTTE le funzioni (system + custom)
- [ ] `GET /workspaces/:id/functions?type=system` — solo system
- [ ] `GET /workspaces/:id/functions?type=custom` — solo custom
- [ ] `POST /workspaces/:id/functions` — crea funzione custom (blocca se `isSystemFunction = true`)
- [ ] `PATCH /workspaces/:id/functions/:fnId` — modifica (description, responseInstructions, isActive, parameters)
- [ ] `DELETE /workspaces/:id/functions/:fnId` — elimina (blocca se `isSystemFunction = true`)
- [ ] `POST /workspaces/:id/webhook/test` — test connessione
- [ ] Swagger docs

### Fase 4 — Backoffice UI (2 giorni)

- [ ] Settings: card webhook configuration (URL, secret, timeout)
- [ ] Functions: lista unificata con separazione System/Custom
- [ ] System functions: badge "System", nessun pulsante delete, solo disable/edit
- [ ] Custom functions: pulsanti edit/delete visibili
- [ ] Edit panel: form con:
  - Name, Description, Response Instructions
  - Parameter builder (name, type, enum, required)
  - Preview JSON in tempo reale
  - Toggle isActive
- [ ] Test connection button
- [ ] Differenziazione visiva: System = 🔒, Custom = 🔧

### Fase 5 — Test & Documentazione (1 giorno)

- [ ] Unit test: WebhookDispatchService (HMAC, timeout, error mapping)
- [ ] Unit test: Unified function loading (system + custom)
- [ ] Unit test: `isSystemFunction` delete protection
- [ ] Unit test: responseInstructions injection
- [ ] Unit test: Seed automatico funzioni system (Info vs Ecommerce)
- [ ] Integration test: End-to-end webhook call
- [ ] Migration script test: popolare workspace esistenti
- [ ] Documentazione webhook per clienti (come implementare l'endpoint)

**Stima totale: 7-8 giorni**

---

## 12. Checklist Pre-Deploy

- [ ] Migration applicata su staging e production
- [ ] Script di migrazione eseguito per workspace esistenti (popolamento funzioni system)
- [ ] Funzioni statiche NON impattate (regression test)
- [ ] Seed automatico funziona per nuovi workspace (Info vs Ecommerce)
- [ ] System functions NON cancellabili (API blocca DELETE)
- [ ] Webhook test endpoint funziona
- [ ] HMAC signature verificata end-to-end
- [ ] Timeout gestito correttamente (no hang)
- [ ] Rate limit testato
- [ ] LLM riceve tool list corretta da DB (system + custom)
- [ ] responseInstructions iniettata correttamente nei messaggi LLM
- [ ] Webhook può ritornare qualsiasi JSON (testato con vari formati)
- [ ] Errori webhook mappati in risposte LLM chiare
- [ ] Backoffice UI: differenzia system vs custom
- [ ] Swagger aggiornato
- [ ] 2260+ test esistenti ancora passano
