# Quickstart: Order Transport Optimization

**Phase**: 1 | **Status**: Complete | **Date**: 2025-12-16

## Prerequisites

- Node.js 18+
- PostgreSQL running (Docker)
- Backend server running on port 3001
- Frontend running on port 3000

## Setup Steps

### 1. Database Migration

```bash
cd apps/backend

# Create migration for TransportType.price + Products.transportTypeId required
npx prisma migrate dev --name add_transport_price_and_require_transport

# Generate Prisma client
npx prisma generate
```

### 2. Seed Transport Prices

```bash
cd apps/backend
npm run seed
```

Il seed aggiorna i TransportType esistenti con prezzi di default:
- Ambiente: 5.00€
- Frigo: 8.00€  
- Surgelato: 12.00€

### 3. Verify Setup

```bash
# Check transport types have prices
npx prisma studio
# Navigate to TransportType table
# Verify all records have price > 0
```

### 4. Test the Feature

**Via Admin UI**:
1. Login come admin (`admin@echatbot.ai` / `venezia44`)
2. Vai su Workspace Settings
3. Verifica che il piano sia Premium o Enterprise
4. I prodotti dovrebbero avere trasporto obbligatorio

**Via Unit Tests**:
```bash
cd apps/backend
npm run test:unit -- --testPathPattern="order-optimization"
```

## Development Workflow

### Adding New Transport Types

```sql
-- Via Prisma Studio or SQL
INSERT INTO "TransportType" (id, workspaceId, name, price, isActive)
VALUES (gen_random_uuid(), 'your-workspace-id', 'Express', 15.00, true);
```

### Testing Plan Gating

```typescript
// Temporarily change workspace plan for testing
await prisma.workspace.update({
  where: { id: workspaceId },
  data: { planType: 'premium' }  // or 'basic' to hide option
});
```

### Prompt Template Location

Il template per l'agent LLM è in:
```
apps/backend/src/templates/ecommerce/10-order-optimization.template.md
```

Modifica il template e il sistema lo rilegge automaticamente (no restart needed).

## Environment Variables

Nessuna nuova variabile. Usa le esistenti:

```env
# Already configured
OPENROUTER_API_KEY=sk-or-...
DATABASE_URL=postgresql://...
```

## Troubleshooting

### "Trasporti non configurati"

1. Verifica che TransportType abbia records con `price > 0`
2. Verifica che i records siano per il `workspaceId` corretto
3. Verifica che `isActive = true`

```sql
SELECT * FROM "TransportType" 
WHERE "workspaceId" = 'your-workspace-id' 
AND "isActive" = true 
AND "price" > 0;
```

### Option 5 non appare nel menu

1. Verifica il piano workspace:
```sql
SELECT "planType" FROM "Workspace" WHERE id = 'your-workspace-id';
```

2. Deve essere `premium` o `enterprise`

### LLM non risponde

1. Check OPENROUTER_API_KEY è valido
2. Check quota OpenRouter
3. Check logs: `apps/backend/logs/`

---

**Next**: Run `/speckit.tasks` to generate implementation tasks
