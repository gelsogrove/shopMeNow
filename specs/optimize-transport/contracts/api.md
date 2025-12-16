# API Contracts: Order Transport Optimization

**Phase**: 1 | **Status**: Complete | **Date**: 2025-12-16

## Overview

Questa feature **NON** aggiunge nuovi endpoint REST pubblici. L'ottimizzazione è invocata dal flusso chat WhatsApp esistente tramite:

1. **Menu Option 5** nel flusso carrello (CallingFunctionsService)
2. **Internal Service Call** a OrderOptimizationService
3. **LLM Agent Call** a OrderOptimizationAgentLLM

## Internal Service Interface

### OrderOptimizationService

```typescript
// apps/backend/src/application/services/order-optimization.service.ts

export class OrderOptimizationService {
  /**
   * Analyze cart transport costs and generate optimization suggestions
   * 
   * @param workspaceId - Workspace context
   * @param cartId - Cart to analyze
   * @returns TransportAnalysis with costs and suggestions
   * @throws Error if transport types not configured
   */
  async analyzeCart(
    workspaceId: string,
    cartId: string
  ): Promise<TransportAnalysis>;

  /**
   * Check if workspace has transport prices configured
   * 
   * @param workspaceId - Workspace to check
   * @returns true if at least one TransportType has price > 0
   */
  async hasTransportPricesConfigured(workspaceId: string): Promise<boolean>;

  /**
   * Get available products for optimization suggestions
   * Filters by workspace and active status
   * 
   * @param workspaceId - Workspace context
   * @param excludeProductIds - Products already in cart
   * @returns List of available products with transport info
   */
  async getAvailableProductsForOptimization(
    workspaceId: string,
    excludeProductIds: string[]
  ): Promise<AvailableProduct[]>;
}
```

### CallingFunctionsService Extension

```typescript
// Addition to existing CallingFunctionsService

interface CartMenuOption {
  number: number;
  label: string;
  action: string;
  requiredPlan?: 'basic' | 'premium' | 'enterprise';  // NEW
}

// Menu options with plan gating
const CART_MENU_OPTIONS: CartMenuOption[] = [
  { number: 1, label: 'Visualizza carrello', action: 'view_cart' },
  { number: 2, label: 'Modifica quantità', action: 'edit_quantity' },
  { number: 3, label: 'Rimuovi prodotto', action: 'remove_product' },
  { number: 4, label: 'Procedi al checkout', action: 'checkout' },
  // NEW: Option 5 - Premium only
  { 
    number: 5, 
    label: 'Ottimizzazione dell\'ordine', 
    action: 'optimize_transport',
    requiredPlan: 'premium'  // Hidden for basic/free/trial
  },
];

// Method to filter menu by workspace plan
async getCartMenuOptions(workspaceId: string): Promise<CartMenuOption[]> {
  const workspace = await this.prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { planType: true }
  });
  
  const planHierarchy = ['trial', 'free', 'basic', 'premium', 'enterprise'];
  const workspacePlanIndex = planHierarchy.indexOf(workspace.planType);
  
  return CART_MENU_OPTIONS.filter(option => {
    if (!option.requiredPlan) return true;
    const requiredIndex = planHierarchy.indexOf(option.requiredPlan);
    return workspacePlanIndex >= requiredIndex;
  });
}
```

## LLM Agent Contract

### OrderOptimizationAgentLLM

```typescript
// apps/backend/src/application/agents/OrderOptimizationAgentLLM.ts

export class OrderOptimizationAgentLLM {
  /**
   * Model: GPT-4.1 (via OpenRouter)
   * Purpose: Generate natural language explanation of transport analysis
   */
  
  private readonly MODEL = 'openai/gpt-4.1';
  
  /**
   * Process transport analysis and generate user-friendly explanation
   * 
   * @param input - Cart analysis and available products
   * @returns Natural language explanation (Italian, to be translated)
   */
  async process(input: OrderOptimizationInput): Promise<OrderOptimizationOutput>;
}
```

### Prompt Template

```markdown
# File: apps/backend/src/templates/ecommerce/10-order-optimization.template.md

## System Prompt

Sei un assistente esperto di logistica e-commerce. Analizza i costi di trasporto 
del carrello e suggerisci ottimizzazioni per risparmiare sui costi di spedizione.

## Input Data

Riceverai un JSON con:
- `analysis`: Breakdown dei trasporti nel carrello
- `availableProducts`: Prodotti che il cliente potrebbe aggiungere

## Output Format

Rispondi in italiano con:
1. **Riepilogo costi**: Spiega i costi di trasporto attuali
2. **Suggerimenti**: Se ci sono modi per ottimizzare (es. consolidare spedizioni)
3. **Azione consigliata**: Cosa fare dopo

Usa un tono amichevole e professionale. Non inventare dati, usa solo quelli forniti.

## Example

**Input**:
```json
{
  "analysis": {
    "transports": [
      {"transportTypeName": "Frigo", "transportPrice": 8.00, "productCount": 2},
      {"transportTypeName": "Ambiente", "transportPrice": 5.00, "productCount": 1}
    ],
    "totalTransportCost": 13.00,
    "cartTotal": 45.50,
    "grandTotal": 58.50
  }
}
```

**Output**:
```json
{
  "explanation": "Il tuo carrello include prodotti con due tipi di spedizione diversi:\n- 🧊 Frigo (8,00€): 2 prodotti\n- 📦 Ambiente (5,00€): 1 prodotto\n\nTotale spedizione: 13,00€",
  "recommendations": [
    "Potresti aggiungere altri prodotti frigo per sfruttare al massimo la spedizione refrigerata già pagata."
  ],
  "nextAction": "continue_shopping"
}
```
```

## Integration Flow

```
┌─────────────────┐
│  Chat Message   │ "5" (menu option)
│  (WhatsApp)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLMRouter      │ Detect menu selection
│  Service        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CallingFunctions│ Check plan gating
│  Service        │ Get workspace.planType
└────────┬────────┘
         │ (if premium/enterprise)
         ▼
┌─────────────────┐
│  OrderOptimization│ 1. Check transport config
│  Service        │ 2. Analyze cart
│                 │ 3. Get available products
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  OrderOptimization│ Generate explanation
│  AgentLLM       │ (GPT-4.1)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Translation    │ Translate to customer language
│  Agent          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  WhatsApp       │ Send response
│  Response       │
└─────────────────┘
```

## Error Responses

| Scenario | Response to Customer |
|----------|---------------------|
| No cart | "Non hai ancora prodotti nel carrello. Vuoi vedere il catalogo?" |
| Transport not configured | "Mi dispiace, non posso calcolare i costi di spedizione al momento. Il team sta configurando i trasporti." |
| LLM timeout | "C'è stato un problema nell'analisi. Riprova tra qualche secondo." |
| Invalid plan | (Option 5 not shown - user can't trigger this) |

---

**Next**: [quickstart.md](./quickstart.md)
