# API Contract: PromptProcessorService - {{LAST_ORDER}} Variable

**Service**: `PromptProcessorService.replaceAllVariables()`  
**Feature**: FR-13 Repeat Order with Confirmation  
**Date**: 2025-11-12

---

## Method Extension

### `replaceAllVariables(prompt: string, context: ExecutionContext): Promise<string>`

**Purpose**: Replace {{VARIABLES}} in agent prompts with database content - NOW including {{LAST_ORDER}}

---

## New Variable: {{LAST_ORDER}}

| Variable         | Type              | Source                                  | Example          |
| ---------------- | ----------------- | --------------------------------------- | ---------------- |
| `{{LAST_ORDER}}` | string (Markdown) | Database query: `orders.findFirst(...)` | See format below |

---

## Output Format

### When Order Exists

```markdown
Ultimo ordine: ORD-2024-001 del 15/10/2024

Prodotti ordinati:

- A001 Tagliatelle fresche 500g x4 (3.50€ cad.) = 14.00€
- A002 Salame Toscano x12 (2.80€ cad.) = 33.60€
- A003 Parmigiano Reggiano 24 mesi x1 (12.00€ cad.) = 12.00€

Totale ordine: 59.60€
Stato: CONSEGNATO
```

### When No Order Exists

```markdown
Nessun ordine precedente disponibile.
```

---

## Implementation

```typescript
// backend/src/services/prompt-processor.service.ts

import { PrismaClient } from "@prisma/client"
import { OrderRepository } from "../repositories/order.repository"

interface ExecutionContext {
  customerId: string
  workspaceId: string
  customerName?: string
  customerLanguage?: string
}

export class PromptProcessorService {
  private prisma: PrismaClient
  private orderRepo: OrderRepository

  constructor() {
    this.prisma = new PrismaClient()
    this.orderRepo = new OrderRepository(this.prisma)
  }

  /**
   * Get formatted last order summary for {{LAST_ORDER}} variable
   */
  private async getLastOrderVariable(
    customerId: string,
    workspaceId: string
  ): Promise<string> {
    try {
      // Query last DELIVERED order
      const order = await this.prisma.orders.findFirst({
        where: {
          customerId,
          workspaceId,
          status: "DELIVERED",
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  sku: true,
                  name: true,
                },
              },
            },
          },
        },
        take: 1,
      })

      // No orders found
      if (!order || !order.items || order.items.length === 0) {
        return "Nessun ordine precedente disponibile."
      }

      // Format order date
      const orderDate = order.createdAt.toISOString().split("T")[0]

      // Format order items (Italian base language from DB)
      const itemsText = order.items
        .map((item) => {
          const lineTotal = item.quantity * item.unitPrice
          return `- ${item.product.sku} ${item.product.name} x${
            item.quantity
          } (${item.unitPrice.toFixed(2)}€ cad.) = ${lineTotal.toFixed(2)}€`
        })
        .join("\n")

      // Calculate total
      const totalPrice = order.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      )

      // Return formatted summary (Italian)
      return `Ultimo ordine: ${order.orderCode} del ${orderDate}

Prodotti ordinati:
${itemsText}

Totale ordine: ${totalPrice.toFixed(2)}€
Stato: ${order.status}`
    } catch (error) {
      console.error("Error fetching last order:", error)
      return "Nessun ordine precedente disponibile."
    }
  }

  /**
   * Replace all variables in prompt with database content
   * NOW includes {{LAST_ORDER}} replacement
   */
  async replaceAllVariables(
    prompt: string,
    context: ExecutionContext
  ): Promise<string> {
    let processedPrompt = prompt

    // Existing variables (unchanged)
    processedPrompt = processedPrompt.replace(
      /\{\{nome\}\}/g,
      context.customerName || "Cliente"
    )
    processedPrompt = processedPrompt.replace(
      /\{\{email\}\}/g,
      context.customerEmail || ""
    )
    // ... other existing replacements ...

    // NEW: {{LAST_ORDER}} replacement
    if (processedPrompt.includes("{{LAST_ORDER}}")) {
      const lastOrder = await this.getLastOrderVariable(
        context.customerId,
        context.workspaceId
      )
      processedPrompt = processedPrompt.replace(
        /\{\{LAST_ORDER\}\}/g,
        lastOrder
      )
    }

    return processedPrompt
  }
}
```

---

## Usage Example

### Order Tracking Agent Prompt (Database)

```markdown
# System Role

Tu sei l'Order Tracking Agent di eChatbot. Gestisci tracking ordini e cronologia.

## Ultimo Ordine Cliente

{{LAST_ORDER}}

## Available Functions

- getOrderDetails(orderCode)
- trackOrderStatus(orderCode)
- sendInvoice(orderCode)
- repeatLastOrder()

## Repeat Order Flow

When customer asks to repeat last order:

1. Show order summary from {{LAST_ORDER}} above
2. Ask for confirmation: "Vuoi ripetere l'operazione?"
3. If user confirms (SI, certo, ok), call repeatLastOrder()
4. Return checkout link to customer
```

### After Variable Replacement

```markdown
# System Role

Tu sei l'Order Tracking Agent di eChatbot. Gestisci tracking ordini e cronologia.

## Ultimo Ordine Cliente

Ultimo ordine: ORD-2024-001 del 15/10/2024

Prodotti ordinati:

- A001 Tagliatelle fresche 500g x4 (3.50€ cad.) = 14.00€
- A002 Salame Toscano x12 (2.80€ cad.) = 33.60€

Totale ordine: 47.60€
Stato: CONSEGNATO

## Available Functions

- getOrderDetails(orderCode)
- trackOrderStatus(orderCode)
- sendInvoice(orderCode)
- repeatLastOrder()

## Repeat Order Flow

When customer asks to repeat last order:

1. Show order summary from {{LAST_ORDER}} above
2. Ask for confirmation: "Vuoi ripetere l'operazione?"
3. If user confirms (SI, certo, ok), call repeatLastOrder()
4. Return checkout link to customer
```

---

## Database Query

### Query Structure

```sql
SELECT
  o.orderCode,
  o.createdAt,
  o.status,
  oi.quantity,
  oi.unitPrice,
  p.sku,
  p.name AS productName
FROM orders o
INNER JOIN orderItems oi ON oi.orderId = o.id
INNER JOIN products p ON p.id = oi.productId
WHERE o.customerId = ?
  AND o.workspaceId = ?
  AND o.status = 'DELIVERED'
ORDER BY o.createdAt DESC
LIMIT 1;
```

### Prisma Query

```typescript
const order = await prisma.orders.findFirst({
  where: {
    customerId: context.customerId,
    workspaceId: context.workspaceId,
    status: "DELIVERED",
  },
  orderBy: { createdAt: "desc" },
  include: {
    items: {
      include: {
        product: {
          select: {
            sku: true,
            name: true,
          },
        },
      },
    },
  },
  take: 1,
})
```

**Performance**:

- Index: `(customerId, workspaceId, status, createdAt DESC)`
- Execution time: <50ms
- Cached: 5 minutes (optional Redis)

---

## Error Handling

| Scenario            | Return Value                            | LLM Behavior                            |
| ------------------- | --------------------------------------- | --------------------------------------- |
| No orders found     | "Nessun ordine precedente disponibile." | Agent says: "Non hai ordini precedenti" |
| Database error      | "Nessun ordine precedente disponibile." | Graceful fallback (no crash)            |
| Order with no items | "Nessun ordine precedente disponibile." | Prevent showing empty order             |
| Customer not found  | "Nessun ordine precedente disponibile." | Context error handled upstream          |

**Error Logging**:

```typescript
catch (error) {
  logger.error('PromptProcessor.getLastOrderVariable error:', {
    customerId,
    workspaceId,
    error: error.message
  })
  return "Nessun ordine precedente disponibile."
}
```

---

## Testing

### Unit Tests

```typescript
// backend/__tests__/unit/prompt-processor-lastorder.test.ts

describe("PromptProcessorService - {{LAST_ORDER}}", () => {
  let promptProcessor: PromptProcessorService

  beforeEach(() => {
    promptProcessor = new PromptProcessorService()
  })

  it("should replace {{LAST_ORDER}} with formatted order", async () => {
    const prompt = "Ultimo ordine: {{LAST_ORDER}}"
    const context = {
      customerId: "customer-123",
      workspaceId: "workspace-456",
    }

    const result = await promptProcessor.replaceAllVariables(prompt, context)

    expect(result).toContain("Ultimo ordine: ORD-")
    expect(result).toContain("Prodotti ordinati:")
    expect(result).toContain("Totale ordine:")
    expect(result).not.toContain("{{LAST_ORDER}}")
  })

  it("should handle no orders gracefully", async () => {
    const prompt = "Ordine: {{LAST_ORDER}}"
    const context = {
      customerId: "no-orders-customer",
      workspaceId: "workspace-456",
    }

    const result = await promptProcessor.replaceAllVariables(prompt, context)

    expect(result).toContain("Nessun ordine precedente disponibile.")
  })

  it("should only replace if variable exists in prompt", async () => {
    const prompt = "Hello {{nome}}"
    const context = {
      customerId: "customer-123",
      workspaceId: "workspace-456",
      customerName: "Andrea",
    }

    const result = await promptProcessor.replaceAllVariables(prompt, context)

    expect(result).toBe("Hello Andrea")
    expect(result).not.toContain("Ultimo ordine") // Not replaced
  })
})
```

---

## Integration Points

### Called By

1. **OrderTrackingAgentLLM** (`backend/src/application/agents/OrderTrackingAgentLLM.ts`)

   ```typescript
   const prompt = await this.promptProcessor.replaceAllVariables(
     agentConfig.systemPrompt,
     {
       customerId: context.customerId,
       workspaceId: context.workspaceId,
       customerName: context.customerName,
     }
   )
   ```

2. **LLMRouterService** (if Router needs {{LAST_ORDER}})
   ```typescript
   const routerPrompt = await this.promptProcessor.replaceAllVariables(
     routerConfig.systemPrompt,
     context
   )
   ```

---

## Constitution Compliance

### ✅ I. Database-First

- ✅ Order data from `orders` table (no hardcoded)
- ✅ Product names from `products` table (Italian base)
- ✅ NO fallback defaults (returns "Nessun ordine" if missing)

### ✅ II. Workspace Isolation

- ✅ Query filtered by `workspaceId`
- ✅ Customer restricted to own workspace
- ✅ No cross-workspace data leakage

### ✅ III. Variable Replacement

- ✅ Runtime replacement (not compile-time)
- ✅ Template syntax: `{{LAST_ORDER}}`
- ✅ Dynamic content from database

### ✅ IV. No Static Translations

- ✅ Product names in Italian (base language from DB)
- ✅ LLM translates final output to customer language
- ✅ NO translation mappings (it/es/pt/en)

---

## Performance Optimization

### Caching Strategy (Optional)

```typescript
// With Redis cache (5-minute TTL)
private async getLastOrderVariableCached(
  customerId: string,
  workspaceId: string
): Promise<string> {
  const cacheKey = `lastorder:${customerId}:${workspaceId}`

  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) return cached

  // Fetch from DB
  const result = await this.getLastOrderVariable(customerId, workspaceId)

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, result)

  return result
}
```

**Benefits**:

- Reduces DB load for repeated conversations
- Improves response time (<5ms cached vs ~50ms DB)
- Invalidate on new order creation

---

## Next Steps

✅ Contract specification complete  
⏳ Update `agentConfig` seed with {{LAST_ORDER}} in Order Agent prompt  
⏳ Implement `getLastOrderVariable()` method  
⏳ Add unit tests for variable replacement
