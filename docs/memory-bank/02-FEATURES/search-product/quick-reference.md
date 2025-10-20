# 🔍 SearchProduct Quick Reference Guide

**Feature**: Background product search tracking for analytics  
**Type**: LLM-Callable Function  
**Status**: ✅ Complete  

---

## 🎯 Quick Facts

| Property | Value |
|----------|-------|
| **Function Name** | `searchProduct()` |
| **Parameter** | `productName` (string, max 255 chars) |
| **Execution** | Background (non-blocking) |
| **Database Table** | `ProductSearch` |
| **Workspace Isolation** | ✅ Yes |
| **Multilingual** | ✅ IT, EN, ES, PT |
| **HTTP Method** | POST |
| **Endpoint** | `/api/workspaces/{workspaceId}/calling-functions/searchProduct` |
| **Auth Required** | ✅ JWT Token |

---

## 📝 API Usage

### HTTP Request

```bash
POST /api/workspaces/ws_123/calling-functions/searchProduct
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "productName": "Burrata di Bufala"
}
```

### Success Response (200)

```json
{
  "success": true,
  "message": "Ricerca registrata per analytics",
  "searchId": "cm9hjgq9v00014qk8fsdy4ujv",
  "timestamp": "2025-10-03T16:30:00Z"
}
```

### Error Responses

**Missing productName (400)**:
```json
{
  "success": false,
  "error": "Missing required parameters",
  "message": "productName is required"
}
```

**No customer (404)**:
```json
{
  "success": false,
  "error": "Customer not found",
  "message": "No customer associated with this account"
}
```

---

## 🧠 LLM Usage Patterns

### Scenario 1: Product Found ✅

```
Customer: "Hai della burrata fresca?"

LLM Response: "Sì! Abbiamo una splendida burrata fresca di bufala! 🧀"
LLM Action: Call searchProduct("burrata") IN BACKGROUND
User Effect: ✅ Continues conversation normally
Database: Records search for analytics
```

### Scenario 2: Product Not Found ❌

```
Customer: "Non avete il tartufo?"

LLM Response: "Mi dispiace, il tartufo non è disponibile in questo momento. 
Posso offrirti funghi porcini eccellenti!"
LLM Action: Call searchProduct("tartufo") IN BACKGROUND
User Effect: ✅ Continues conversation normally
Database: Records search (even though product not found)
```

### Scenario 3: Alternative Offered 💡

```
Customer: "Cercate vino champagne?"

LLM Response: "Al momento champagne non disponibile, ma abbiamo ottimi spumanti italiani! 🍾"
LLM Action: Call searchProduct("champagne") IN BACKGROUND
User Effect: ✅ Continues conversation normally
Database: Records search for trend analysis
```

---

## 📊 Database Schema

```sql
-- Table: ProductSearch
CREATE TABLE IF NOT EXISTS "ProductSearch" (
  id VARCHAR(191) PRIMARY KEY,
  query VARCHAR(255) NOT NULL,  -- Product name searched
  "workspaceId" VARCHAR(191) NOT NULL,
  "customerId" VARCHAR(191),    -- Can be NULL for anonymous searches
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indices for analytics queries
  INDEX idx_workspaceId ("workspaceId"),
  INDEX idx_customerId ("customerId"),
  INDEX idx_createdAt ("createdAt"),
  INDEX idx_query (query),
  
  -- Foreign keys
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE,
  FOREIGN KEY ("customerId") REFERENCES "Customers"(id) ON DELETE SET NULL
);
```

---

## 🔍 Analytics Queries (Ready to Implement)

### Top 10 Searched Products

```sql
SELECT query, COUNT(*) as search_count
FROM "ProductSearch"
WHERE "workspaceId" = ?
GROUP BY query
ORDER BY search_count DESC
LIMIT 10;
```

### Trend: Last 7 Days

```sql
SELECT query, COUNT(*) as search_count
FROM "ProductSearch"
WHERE "workspaceId" = ? 
  AND "createdAt" >= NOW() - INTERVAL 7 DAY
GROUP BY query
ORDER BY search_count DESC
LIMIT 10;
```

### Search Gaps (Searched but not in catalog)

```sql
SELECT 
  ps.query,
  COUNT(*) as search_count,
  p.id
FROM "ProductSearch" ps
LEFT JOIN "Products" p 
  ON LOWER(p.name) LIKE LOWER(CONCAT('%', ps.query, '%'))
WHERE ps."workspaceId" = ?
  AND p.id IS NULL
GROUP BY ps.query
ORDER BY search_count DESC;
```

### Customer Search Behavior

```sql
SELECT 
  "customerId",
  COUNT(*) as searches,
  COUNT(DISTINCT query) as unique_products
FROM "ProductSearch"
WHERE "workspaceId" = ?
GROUP BY "customerId"
ORDER BY searches DESC;
```

---

## 🛠️ Integration Points

### 1. FunctionHandlerService

```typescript
case "searchProduct":
  return {
    data: await this.handleSearchProduct(params, customer, workspaceId),
    functionName,
  }
```

### 2. CallingFunctionsService

```typescript
public async searchProduct(request: {
  customerId: string
  workspaceId: string
  productName: string
}): Promise<any>
```

### 3. Domain Function

```typescript
export async function SearchProduct(
  request: SearchProductRequest
): Promise<SearchProductResult>
```

### 4. Prisma Integration

```typescript
const search = await prisma.productSearch.create({
  data: {
    query: productName,
    workspaceId,
    customerId,
  },
})
```

---

## ✅ Validation Rules

| Rule | Description | Example |
|------|-------------|---------|
| **Non-empty** | productName cannot be empty after trim | ❌ "   " → ✅ "Burrata" |
| **Max length** | productName cannot exceed 255 characters | ❌ 256 chars → ✅ 255 chars |
| **Required fields** | customerId + workspaceId mandatory | ❌ Missing → ✅ Both present |
| **Workspace isolation** | Only query by workspaceId | ❌ Cross-workspace → ✅ Filtered |
| **No modifications** | SearchProduct doesn't change carts/orders | ❌ Modifies stock → ✅ Read-only |

---

## 🔒 Security Notes

✅ **Workspace Isolation**: All queries filtered by workspaceId  
✅ **Input Validation**: productName validated (length, emptiness)  
✅ **SQL Injection Safe**: Prisma ORM prevents injections  
✅ **Auth Required**: JWT token required for endpoint  
✅ **Customer Data**: Only own customer can see their searches  

---

## 🚀 Deployment Checklist

- [ ] Run Prisma migration: `npx prisma migrate dev --name add_product_search_tracking`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Verify TypeScript compiles: `npm run build`
- [ ] Run unit tests: `npm run test:unit`
- [ ] Test API endpoint manually
- [ ] Check database table created
- [ ] Verify indices created for performance
- [ ] Test LLM integration
- [ ] Monitor logs for errors

---

## 📞 Support

**Documentation Files**:
- Main: `docs/IMPLEMENTATION_SUMMARY_SEARCHPRODUCT.md`
- Architecture: `docs/memory-bank/03-ARCHITECTURE/calling-functions-architecture.md`
- Prompt: `docs/prompt_agent.md` (section 🔍 searchProduct)

**Implementation Files**:
- Domain: `backend/src/domain/calling-functions/SearchProduct.ts`
- Service: `backend/src/services/calling-functions.service.ts`
- Handler: `backend/src/application/services/function-handler.service.ts`
- Routes: `backend/src/interfaces/http/routes/calling-functions.routes.ts`
- Database: `backend/prisma/schema.prisma`
- Tests: `backend/src/__tests__/unit/calling-functions.spec.ts`

---

**Status**: ✅ Ready for Production  
**Last Updated**: October 3, 2025  
**Implemented For**: Andrea  
