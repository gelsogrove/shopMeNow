# 🎯 Function Calls Display - Feature Implementation

**Data**: 29 Ottobre 2025  
**Feature**: Display function calls per agent in Agent Settings Dashboard  
**Status**: ✅ COMPLETATO

---

## 📋 Cosa Abbiamo Fatto

### 1. **Backend: Mapping Function Calls per Agent Type**

**File**: `backend/src/config/agent-function-mapping.ts` (NEW)

```typescript
export const AGENT_FUNCTION_MAPPING = {
  ROUTER: [
    "searchProducts",
    "addToCart",
    "viewCart",
    "removeFromCart",
    "updateCartQuantity",
    "clearCart",
    "repeatLastOrder",
    "getOrders",
    "contactSupport",
  ],
  PRODUCT_SEARCH: ["searchProducts", "getProductDetails"],
  CART_MANAGEMENT: [
    "addToCart",
    "removeFromCart",
    "viewCart",
    "updateCartQuantity",
    "clearCart",
    "repeatLastOrder",
  ],
  ORDER_TRACKING: ["getOrders", "getOrderDetails", "generateInvoice"],
  CUSTOMER_SUPPORT: ["contactSupport", "reportIssue"],
  SAFETY_TRANSLATION: [], // No functions - only validates and translates
}

export function getFunctionsForAgentType(agentType: string): readonly string[]
```

**Rationale**:

- Centralizza la configurazione delle function calls
- Facile manutenzione: aggiungi/rimuovi funzioni in un solo posto
- Type-safe con `readonly string[]`
- Usato da `agent.service.ts` per arricchire la risposta API

---

### 2. **Backend: Aggiornamento Agent Service**

**File**: `backend/src/application/services/agent.service.ts`

**Changes**:

```typescript
import { getFunctionsForAgentType } from "../../config/agent-function-mapping"

// In getAllForWorkspace():
const mappedAgents = agents.map((agent) => ({
  // ... existing fields
  functions: getFunctionsForAgentType(agent.agentType), // 🆕 NEW
}))
```

**Result**:

- API `/workspaces/:id/agent` ora ritorna un campo `functions` array per ogni agent
- Esempio response:
  ```json
  {
    "id": "abc123",
    "name": "Router Agent",
    "agentType": "ROUTER",
    "functions": [
      "searchProducts",
      "addToCart",
      "viewCart",
      "removeFromCart",
      "updateCartQuantity",
      "clearCart",
      "repeatLastOrder",
      "getOrders",
      "contactSupport"
    ]
  }
  ```

---

### 3. **Frontend: TypeScript Interface Update**

**File**: `frontend/src/services/agentApi.ts`

**Changes**:

```typescript
export interface Agent {
  // ... existing fields
  functions?: readonly string[] // 🆕 NEW
}
```

**Benefit**: Type-safe access to `agent.functions` in tutta la UI

---

### 4. **Frontend: Visual Timeline Enhancement**

**File**: `frontend/src/pages/AgentSettingsPage.tsx`

**Location**: Timeline visualization (VerticalTimeline)

**Changes**:

```tsx
{
  agent.agentType === "ROUTER" && (
    <p className="text-sm text-muted-foreground mt-2">
      📋 Manages conversation history (10 min window) + function calling (
      {agent.functions?.length || 0} functions)
    </p>
  )
}
{
  agent.functions && agent.functions.length > 0 && (
    <div className="mt-2">
      <p className="text-xs font-medium text-muted-foreground mb-1">
        Functions ({agent.functions.length}):
      </p>
      <div className="flex flex-wrap gap-1">
        {agent.functions.slice(0, 5).map((fn) => (
          <span
            key={fn}
            className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded"
          >
            {fn}
          </span>
        ))}
        {agent.functions.length > 5 && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
            +{agent.functions.length - 5} more
          </span>
        )}
      </div>
    </div>
  )
}
```

**Visual Result**:

- Timeline mostra prime 5 funzioni con badge
- Se più di 5 → "+X more" badge
- Count dinamico: "(9 functions)" per Router Agent

---

### 5. **Frontend: Agent Card Function List**

**File**: `frontend/src/pages/AgentSettingsPage.tsx`

**Location**: Agent CRUD cards (between parameters and system prompt)

**Changes**:

```tsx
{
  /* Function Calls - Display only */
}
{
  agent.functions && agent.functions.length > 0 && (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        Available Function Calls
        <Tooltip>
          <TooltipContent>
            Functions this agent can call to execute actions. Configured in
            agent-function-mapping.ts
          </TooltipContent>
        </Tooltip>
      </Label>
      <div className="flex flex-wrap gap-2">
        {agent.functions.map((funcName) => (
          <div
            key={funcName}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
          >
            <CheckCircle className="w-3 h-3" />
            {funcName}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Total: {agent.functions.length} function
        {agent.functions.length !== 1 ? "s" : ""} available
      </p>
    </div>
  )
}
```

**Visual Result**:

- Sezione dedicata "Available Function Calls"
- Badge con checkmark per ogni funzione
- Contatore totale: "Total: 9 functions available"
- Tooltip esplicativo
- Read-only (non editabile dalla UI)

---

## 🎨 UI/UX Preview

### Timeline View (Top of Page)

```
┌─────────────────────────────────────────────────────┐
│ 🧠 Router Agent                         Order: 0    │
│ ROUTER                                              │
│ [GPT-4o Mini] [Temp: 0.3] [Max: 2048 tokens]       │
│ 📋 Manages conversation history (10 min window) +  │
│    function calling (9 functions)                   │
│                                                     │
│ Functions (9):                                      │
│ [searchProducts] [addToCart] [viewCart]            │
│ [removeFromCart] [updateCartQuantity] +4 more      │
└─────────────────────────────────────────────────────┘
```

### Agent Card (Below Timeline)

```
┌────────────────────────────────────────────────────────────┐
│ 🧠 Router Agent                           [Save Changes]   │
│ ROUTER - Order 0                                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ LLM Model: [GPT-4o Mini ▼]                                │
│ Temperature: 0.3  [━━━━━━━━━━━━━━━━━━━━━━]               │
│ Max Tokens: 2048                                           │
│                                                            │
│ Available Function Calls                          ℹ️      │
│ ┌──────────────────┐ ┌─────────────┐ ┌──────────┐        │
│ │ ✓ searchProducts │ │ ✓ addToCart │ │ ✓ viewCart│        │
│ └──────────────────┘ └─────────────┘ └──────────┘        │
│ ┌─────────────────┐ ┌────────────────────┐               │
│ │ ✓ removeFromCart│ │ ✓ updateCartQuantity│               │
│ └─────────────────┘ └────────────────────┘               │
│ ┌─────────────┐ ┌─────────────────┐ ┌──────────┐         │
│ │ ✓ clearCart │ │ ✓ repeatLastOrder│ │ ✓ getOrders│       │
│ └─────────────┘ └─────────────────┘ └──────────┘         │
│ ┌─────────────────┐                                       │
│ │ ✓ contactSupport│                                       │
│ └─────────────────┘                                       │
│                                                            │
│ Total: 9 functions available                              │
│                                                            │
│ System Prompt                                     ℹ️      │
│ [Markdown Editor...]                                       │
└────────────────────────────────────────────────────────────┘
```

---

## 🔍 Function Mapping Per Agent Type

### Router Agent (ROUTER)

**Functions**: 9

- `searchProducts` - Search catalog
- `addToCart` - Add product to cart
- `viewCart` - Display cart contents
- `removeFromCart` - Remove item from cart
- `updateCartQuantity` - Change item quantity
- `clearCart` - Empty entire cart
- `repeatLastOrder` - Reorder previous order
- `getOrders` - View order history
- `contactSupport` - Escalate to human

**Role**: Entry point, orchestrates all sub-agents via function calling

---

### Product Search Agent (PRODUCT_SEARCH)

**Functions**: 2

- `searchProducts` - Search catalog with filters
- `getProductDetails` - Get detailed product info

**Role**: Specialized in product discovery and recommendations

---

### Cart Management Agent (CART_MANAGEMENT)

**Functions**: 6

- `addToCart`
- `removeFromCart`
- `viewCart`
- `updateCartQuantity`
- `clearCart`
- `repeatLastOrder`

**Role**: Handles all cart operations

---

### Order Tracking Agent (ORDER_TRACKING)

**Functions**: 3

- `getOrders` - List customer orders
- `getOrderDetails` - Get specific order details
- `generateInvoice` - Create PDF invoice

**Role**: Order status, tracking, invoices

---

### Customer Support Agent (CUSTOMER_SUPPORT)

**Functions**: 2

- `contactSupport` - Escalate to human operator
- `reportIssue` - Log issue for analytics

**Role**: Handle frustrated customers, escalation

---

### Safety & Translation Agent (SAFETY_TRANSLATION)

**Functions**: 0 (none)

**Role**: Final validation layer - no function calling, only validates/translates responses

---

## ✅ Build Status

**Backend**:

```bash
✔ Generated Prisma Client (v6.17.1) to ./node_modules/@prisma/client in 163ms
```

✅ SUCCESS

**Frontend**:

```bash
✓ 3313 modules transformed.
✓ built in 6.07s
```

✅ SUCCESS

---

## 🎯 Benefits

1. **Trasparenza**: Andrea vede esattamente quali funzioni ogni agent può chiamare
2. **Debug Facile**: Se un agent non fa qualcosa, check subito se ha la function
3. **Manutenzione**: Cambio funzioni in `agent-function-mapping.ts` → UI aggiornata automaticamente
4. **Onboarding**: Nuovi developer capiscono subito le capabilities di ogni agent
5. **Documentation**: UI è self-documenting, no bisogno di guardare codice

---

## 🚀 Next Steps (Possibili Miglioramenti)

1. **Edit Functions via UI** (future):

   - Dropdown multiselect per aggiungere/rimuovere funzioni
   - Drag & drop per riordinare funzioni
   - Validazione: Router deve avere almeno 1 funzione

2. **Function Documentation** (future):

   - Tooltip su ogni badge con descrizione funzione
   - Link a `agent-functions.ts` con schema completo

3. **Function Analytics** (future):

   - Mostra quante volte ogni funzione è stata chiamata
   - Heatmap: funzioni più usate

4. **Function Testing** (future):
   - "Test Function" button
   - Simula chiamata con sample data
   - Verifica risultato

---

**Andrea, ora nella dashboard vedi:**

- ✅ Ogni agent mostra le sue function calls
- ✅ Timeline con count e preview (prime 5)
- ✅ Card con lista completa e badge colorati
- ✅ Contatore totale funzioni
- ✅ Tooltip esplicativo
- ✅ Read-only (configurazione in code, non editabile UI)

**Vuoi che aggiungiamo:**

- 📝 Descrizione di ogni funzione nei tooltip?
- 📊 Analytics su funzioni più usate?
- 🧪 Test button per simulare function calls?
