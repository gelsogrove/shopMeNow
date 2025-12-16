# Data Model: Order Transport Optimization

**Phase**: 1 | **Status**: Complete | **Date**: 2025-12-16

## Schema Changes

### 1. TransportType - Add Price Field

```prisma
model TransportType {
  id          String    @id @default(uuid())
  workspaceId String
  name        String
  description String?
  isActive    Boolean   @default(true)
  
  // NEW FIELD
  price       Decimal   @db.Decimal(10, 2)  // Prezzo lordo (IVA inclusa), in EUR
  
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  products    Products[]
  
  @@index([workspaceId])
}
```

**Notes**:
- `price` è il costo di spedizione per quel tipo di trasporto
- Prezzo **lordo** (IVA 22% inclusa)
- Arrotondamento a 2 decimali (es: 12.50€)

### 2. Products - Make Transport Required

```prisma
model Products {
  // ... existing fields
  
  // CHANGE: nullable -> required
  transportTypeId String           // Was: String?
  transportType   TransportType    @relation(fields: [transportTypeId], references: [id])
  
  // ...
}
```

**Migration steps**:
1. Assegnare trasporto default a prodotti esistenti senza trasporto
2. Alterare colonna a NOT NULL
3. Aggiungere constraint FK

## Migration Script

```sql
-- Migration: add_transport_price_and_make_required

-- Step 1: Add price column to TransportType
ALTER TABLE "TransportType" ADD COLUMN "price" DECIMAL(10,2);

-- Step 2: Set default prices for existing transport types
UPDATE "TransportType" SET "price" = 
  CASE 
    WHEN LOWER("name") LIKE '%frigo%' THEN 8.00
    WHEN LOWER("name") LIKE '%surgel%' THEN 12.00
    ELSE 5.00  -- Ambiente default
  END
WHERE "price" IS NULL;

-- Step 3: Make price NOT NULL
ALTER TABLE "TransportType" ALTER COLUMN "price" SET NOT NULL;

-- Step 4: Create default transport type per workspace for products without transport
INSERT INTO "TransportType" ("id", "workspaceId", "name", "price", "isActive")
SELECT 
  gen_random_uuid(),
  w."id",
  'Ambiente',
  5.00,
  true
FROM "Workspace" w
WHERE NOT EXISTS (
  SELECT 1 FROM "TransportType" t WHERE t."workspaceId" = w."id"
);

-- Step 5: Assign default transport to products without transport
UPDATE "Products" p
SET "transportTypeId" = (
  SELECT t."id" 
  FROM "TransportType" t 
  WHERE t."workspaceId" = p."workspaceId" 
  AND t."isActive" = true
  LIMIT 1
)
WHERE p."transportTypeId" IS NULL;

-- Step 6: Make transportTypeId NOT NULL
ALTER TABLE "Products" ALTER COLUMN "transportTypeId" SET NOT NULL;
```

## New Types/Interfaces

### TransportAnalysis (Service Output)

```typescript
interface TransportAnalysis {
  workspaceId: string;
  cartId: string;
  timestamp: Date;
  
  // Transport breakdown
  transports: TransportBreakdown[];
  
  // Summary
  totalTransportCost: number;        // Somma costi trasporto
  cartTotal: number;                 // Totale carrello (prodotti)
  grandTotal: number;                // cartTotal + totalTransportCost
  
  // Optimization suggestions
  suggestions: OptimizationSuggestion[];
}

interface TransportBreakdown {
  transportTypeId: string;
  transportTypeName: string;         // e.g., "Frigo"
  transportPrice: number;            // Costo unitario spedizione
  productCount: number;              // Quanti prodotti usano questo trasporto
  products: CartProductSummary[];    // Lista prodotti
  subtotal: number;                  // Costo prodotti con questo trasporto
}

interface CartProductSummary {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface OptimizationSuggestion {
  type: 'add_product' | 'replace_product' | 'consolidate';
  transportTypeId: string;
  message: string;                   // Generato da LLM
  potentialSavings: number;          // Risparmio stimato
  suggestedProducts?: SuggestedProduct[];
}

interface SuggestedProduct {
  productId: string;
  productName: string;
  price: number;
  transportTypeName: string;
  reason: string;                    // Why suggested
}
```

### LLM Agent Input

```typescript
interface OrderOptimizationInput {
  workspaceId: string;
  customerId: string;
  language: string;                  // Customer's language (for LLM response)
  
  // Cart data (deterministic, calculated by backend)
  analysis: TransportAnalysis;
  
  // Available products for suggestions
  availableProducts: AvailableProduct[];
}

interface AvailableProduct {
  id: string;
  name: string;
  price: number;
  transportTypeName: string;
  category: string;
}
```

### LLM Agent Output

```typescript
interface OrderOptimizationOutput {
  // Natural language explanation (Italian, will be translated)
  explanation: string;
  
  // Formatted suggestions
  recommendations: string[];
  
  // Action prompt
  nextAction: 'continue_shopping' | 'proceed_checkout' | 'view_products';
}
```

## Seed Data Updates

```typescript
// prisma/seed.ts additions

// Transport Types with prices
const transportTypes = [
  { name: 'Ambiente', price: 5.00, description: 'Prodotti a temperatura ambiente' },
  { name: 'Frigo', price: 8.00, description: 'Prodotti refrigerati 0-4°C' },
  { name: 'Surgelato', price: 12.00, description: 'Prodotti surgelati -18°C' },
];

// Ensure all products have transportTypeId
// Default to 'Ambiente' if not specified
```

## Index Requirements

```prisma
// Already exists
@@index([workspaceId]) on TransportType

// Consider adding for optimization queries
@@index([transportTypeId]) on Products
@@index([workspaceId, transportTypeId]) on Products
```

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| TransportType.price | >= 0 | "Il prezzo di spedizione deve essere >= 0" |
| TransportType.price | <= 1000 | "Il prezzo di spedizione sembra troppo alto" |
| Products.transportTypeId | NOT NULL | "Ogni prodotto deve avere un tipo di trasporto" |
| Products.transportTypeId | Valid FK | "Tipo di trasporto non valido" |

---

**Next**: [contracts/](./contracts/) - API definitions
