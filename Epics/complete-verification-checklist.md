# ✅ CHECKLIST COMPLETA VERIFICA - eChatbot Platform

**Obiettivo**: Verificare TUTTO prima del deploy - API, Forms, Validations, Export/Import, LLM Tests  
**Regola**: Niente al caso, tutto documentato e testato

---

## 🔍 1. API ENDPOINTS VERIFICATION

### 📋 GET Endpoints Checklist

```bash
# Test tutti i GET endpoints critici
cd apps/backend

# Products
curl -X GET "http://localhost:3001/api/v1/products?workspaceId=WORKSPACE_ID" -H "Authorization: Bearer TOKEN"
# ✅ Verifica: Returns products with characteristics
# ✅ Verifica: Workspace isolation (no cross-workspace data)

# Product by ID with characteristics
curl -X GET "http://localhost:3001/api/v1/products/PRODUCT_ID" -H "Authorization: Bearer TOKEN"
# ✅ Verifica: Returns product.characteristics array
# ✅ Verifica: Includes all fields: name, value, unit, type

# Categories
curl -X GET "http://localhost:3001/api/v1/categories?workspaceId=WORKSPACE_ID" -H "Authorization: Bearer TOKEN"
# ✅ Verifica: Returns categories with product count
# ✅ Verifica: ProductCategory pivot populated

# Workspace Settings
curl -X GET "http://localhost:3001/api/v1/workspace/WORKSPACE_ID" -H "Authorization: Bearer TOKEN"
# ✅ Verifica: Returns ALL fields including:
#   - sellsProductsAndServices
#   - hasSalesAgents
#   - toneOfVoice
#   - botIdentityResponse
#   - customAiRules
#   - businessType
#   - operatorContactMethod
#   - operatorWhatsappNumber
#   - allowedExternalLinks

# Orders
curl -X GET "http://localhost:3001/api/v1/orders?workspaceId=WORKSPACE_ID" -H "Authorization: Bearer TOKEN"
# ✅ Verifica: Workspace isolation
# ✅ Verifica: Customer data included

# Billing
curl -X GET "http://localhost:3001/api/v1/billing/owner/OWNER_ID" -H "Authorization: Bearer TOKEN"
# ✅ Verifica: Owner-based billing (NOT workspace-based)
# ✅ Verifica: Aggregates across all owned workspaces
```

### 📝 POST Endpoints Checklist

```bash
# Create Product with Characteristics
curl -X POST "http://localhost:3001/api/v1/products" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "WORKSPACE_ID",
    "name": "Appartamento Centro",
    "price": 180000,
    "description": "Luminoso appartamento",
    "characteristics": [
      {"name": "superficie", "value": "42", "unit": "mq", "type": "number"},
      {"name": "locali", "value": "2", "unit": "n.", "type": "number"},
      {"name": "piano", "value": "3", "type": "text"},
      {"name": "zona", "value": "centro", "type": "text"}
    ]
  }'
# ✅ Verifica: Product created with characteristics
# ✅ Verifica: ProductCharacteristic records created
# ✅ Verifica: Returns product with characteristics array

# Add to Cart
curl -X POST "http://localhost:3001/api/v1/cart/add" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUSTOMER_ID",
    "productId": "PRODUCT_ID",
    "quantity": 1
  }'
# ✅ Verifica: Cart item created
# ✅ Verifica: Workspace isolation

# Create Order
curl -X POST "http://localhost:3001/api/v1/orders" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUSTOMER_ID",
    "workspaceId": "WORKSPACE_ID",
    "items": [{"productId": "PRODUCT_ID", "quantity": 1}]
  }'
# ✅ Verifica: Order created
# ✅ Verifica: Billing record created (owner-based)
# ✅ Verifica: Usage tracking recorded
```

### 🔄 PUT/PATCH Endpoints Checklist

```bash
# Update Product with Characteristics
curl -X PUT "http://localhost:3001/api/v1/products/PRODUCT_ID" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Appartamento Centro Updated",
    "characteristics": [
      {"name": "superficie", "value": "45", "unit": "mq", "type": "number"}
    ]
  }'
# ✅ Verifica: Product updated
# ✅ Verifica: Characteristics updated (old removed, new added)

# Update Workspace Settings
curl -X PATCH "http://localhost:3001/api/v1/workspace/WORKSPACE_ID" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sellsProductsAndServices": true,
    "businessType": "real_estate",
    "toneOfVoice": "professional",
    "botIdentityResponse": "Sono Sofia, assistente immobiliare"
  }'
# ✅ Verifica: All fields updated
# ✅ Verifica: No fields lost
```

### 🗑️ DELETE Endpoints Checklist

```bash
# Delete Product
curl -X DELETE "http://localhost:3001/api/v1/products/PRODUCT_ID" \
  -H "Authorization: Bearer TOKEN"
# ✅ Verifica: Product deleted
# ✅ Verifica: Characteristics cascade deleted (onDelete: Cascade)
# ✅ Verifica: ProductCategory pivot deleted

# Delete Characteristic
curl -X DELETE "http://localhost:3001/api/v1/products/PRODUCT_ID/characteristics/CHAR_ID" \
  -H "Authorization: Bearer TOKEN"
# ✅ Verifica: Characteristic deleted
# ✅ Verifica: Product still exists
```

---

## 📋 2. FORM VALIDATIONS CHECKLIST

### Frontend Form Validation

```typescript
// ProductForm.tsx - Validation Rules
const productSchema = z.object({
  name: z.string().min(3, "Nome minimo 3 caratteri").max(200),
  price: z.number().positive("Prezzo deve essere positivo"),
  description: z.string().max(2000).optional(),
  characteristics: z.array(z.object({
    name: z.string().min(1, "Nome caratteristica richiesto"),
    value: z.string().min(1, "Valore richiesto"),
    unit: z.string().optional(),
    type: z.enum(["text", "number", "select", "boolean"])
  })).optional()
})

// ✅ Test Cases:
// 1. Nome vuoto → Error "Nome minimo 3 caratteri"
// 2. Prezzo negativo → Error "Prezzo deve essere positivo"
// 3. Caratteristica senza nome → Error "Nome caratteristica richiesto"
// 4. Caratteristica senza valore → Error "Valore richiesto"
// 5. Type invalido → Error "Type must be text|number|select|boolean"
```

### Backend Validation

```typescript
// products.controller.ts - Validation
import { z } from 'zod'

const createProductSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z.string().min(3).max(200),
  price: z.number().positive(),
  characteristics: z.array(z.object({
    name: z.string().min(1).max(100),
    value: z.string().min(1).max(500),
    unit: z.string().max(20).optional(),
    type: z.enum(["text", "number", "select", "boolean"]).default("text")
  })).optional()
})

// ✅ Test Cases:
// 1. workspaceId invalid → 400 "Invalid workspace ID"
// 2. name too short → 400 "Name must be at least 3 characters"
// 3. price zero → 400 "Price must be positive"
// 4. characteristics.name empty → 400 "Characteristic name required"
```

---

## 📤 3. EXPORT/IMPORT VERIFICATION

### Export Products with Characteristics

```bash
# Export endpoint
curl -X GET "http://localhost:3001/api/v1/products/export?workspaceId=WORKSPACE_ID&format=csv" \
  -H "Authorization: Bearer TOKEN" \
  -o products_export.csv

# ✅ Verifica CSV Headers:
# name,price,description,categoria,superficie,locali,piano,zona,taglia,colore,peso

# ✅ Verifica CSV Data:
# "Appartamento Centro",180000,"Luminoso","Immobili",42,2,3,"centro","","",""
# "Villa Collina",350000,"Spaziosa","Immobili",120,4,"","periferia","","",""

# ✅ Verifica:
# - Tutte le caratteristiche esportate come colonne
# - Valori vuoti per caratteristiche non presenti
# - Encoding UTF-8 corretto
```

### Import Products with Characteristics

```bash
# Import endpoint
curl -X POST "http://localhost:3001/api/v1/products/import" \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@products_import.csv" \
  -F "workspaceId=WORKSPACE_ID"

# ✅ Verifica Import Success:
# - Prodotti creati con caratteristiche
# - ProductCharacteristic records creati
# - ProductCategory pivot popolato
# - Validazione errori (duplicate SKU, invalid data)

# ✅ Test Import Error Cases:
# 1. CSV con colonne mancanti → Error "Missing required columns"
# 2. Prezzo invalido → Error "Invalid price on row 5"
# 3. Duplicate SKU → Error "Duplicate SKU: PROD-001"
# 4. Workspace non esistente → Error "Workspace not found"
```

### Export/Import Test Script

```typescript
// __tests__/integration/export-import.spec.ts
describe('Export/Import Products', () => {
  it('should export products with characteristics to CSV', async () => {
    const response = await request(app)
      .get('/api/v1/products/export')
      .query({ workspaceId, format: 'csv' })
      .set('Authorization', `Bearer ${token}`)
    
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
    
    const csv = response.text
    expect(csv).toContain('name,price,description')
    expect(csv).toContain('superficie,locali,piano')
  })

  it('should import products with characteristics from CSV', async () => {
    const csvContent = `name,price,superficie,locali,zona
Appartamento,180000,42,2,centro
Villa,350000,120,4,periferia`
    
    const response = await request(app)
      .post('/api/v1/products/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csvContent), 'products.csv')
      .field('workspaceId', workspaceId)
    
    expect(response.status).toBe(200)
    expect(response.body.imported).toBe(2)
    
    // Verify characteristics created
    const products = await prisma.product.findMany({
      where: { workspaceId },
      include: { characteristics: true }
    })
    
    expect(products[0].characteristics).toHaveLength(3) // superficie, locali, zona
  })
})
```

---

## 🤖 4. LLM TESTS VERIFICATION

### Prompt Variable Replacement Test

```typescript
// __tests__/llm/prompt-variables.spec.ts
describe('Prompt Variable Replacement', () => {
  it('should replace all product variables', async () => {
    const variables = await PromptVariableBuilder.build(
      mockCustomer,
      mockWorkspace,
      { userMessage: 'dammi un piso de 40mq' }
    )
    
    // ✅ Verifica tutte le variabili esistono
    expect(variables.products).toBeDefined()
    expect(variables.productsWithDetails).toBeDefined()
    expect(variables.productsByCategory).toBeDefined()
    expect(variables.featuredProducts).toBeDefined()
    expect(variables.productCharacteristics).toBeDefined()
    
    // ✅ Verifica formato corretto
    expect(variables.productsWithDetails).toContain('📦')
    expect(variables.productsWithDetails).toContain('superficie:')
    expect(variables.productsWithDetails).toContain('locali:')
  })

  it('should NOT have unreplaced variables in prompt', async () => {
    const prompt = await buildPrompt(mockWorkspace, mockCustomer)
    
    const unreplaced = prompt.match(/\{\{[^}]+\}\}/g)
    
    expect(unreplaced).toBeNull() // NO unreplaced variables
  })
})
```

### LLM Search with Characteristics Test

```typescript
// __tests__/llm/search-characteristics.spec.ts
describe('LLM Search with Characteristics', () => {
  it('should find products by superficie characteristic', async () => {
    // Setup: Create products with characteristics
    await prisma.product.create({
      data: {
        name: 'Appartamento Centro',
        price: 180000,
        workspaceId,
        characteristics: {
          create: [
            { name: 'superficie', value: '42', unit: 'mq', type: 'number' },
            { name: 'locali', value: '2', unit: 'n.', type: 'number' }
          ]
        }
      }
    })
    
    // Test: LLM search "piso de 40mq"
    const response = await llmService.processMessage({
      message: 'dammi un piso de 40mq',
      workspaceId,
      customerId
    })
    
    // ✅ Verifica: LLM trova prodotto con superficie ~40mq
    expect(response).toContain('Appartamento Centro')
    expect(response).toContain('42mq')
    expect(response).toContain('180')
  })

  it('should handle multiple characteristic filters', async () => {
    const response = await llmService.processMessage({
      message: 'appartamento 2 locali zona centro sotto 200k',
      workspaceId,
      customerId
    })
    
    // ✅ Verifica: LLM filtra per locali + zona + prezzo
    expect(response).toContain('2 locali')
    expect(response).toContain('centro')
    expect(response).not.toContain('350000') // Escluso perché > 200k
  })
})
```

### Smart Grouping Test

```typescript
// __tests__/llm/smart-grouping.spec.ts
describe('Smart Grouping with Characteristics', () => {
  it('should group products by business type', async () => {
    // Real estate products
    const products = [
      { name: 'Appartamento A', characteristics: [{ name: 'superficie', value: '40' }] },
      { name: 'Appartamento B', characteristics: [{ name: 'superficie', value: '45' }] },
      { name: 'Villa C', characteristics: [{ name: 'superficie', value: '120' }] }
    ]
    
    const response = await llmService.processMessage({
      message: 'mostrami le case disponibili',
      workspaceId,
      customerId
    })
    
    // ✅ Verifica: Raggruppamento funziona
    expect(response).toContain('1.')
    expect(response).toContain('2.')
    
    // ✅ Verifica: groupMapping salvato
    const mapping = await optionsMappingService.loadMapping(workspaceId, conversationId)
    expect(mapping?.groupMapping).toBeDefined()
    expect(mapping?.groupMapping?.['1']?.skus).toBeDefined()
  })
})
```

---

## 🔒 5. SECURITY TESTS

### Workspace Isolation Test

```typescript
// __tests__/security/workspace-isolation.spec.ts
describe('Workspace Isolation', () => {
  it('should NOT return products from other workspace', async () => {
    const workspaceA = await createWorkspace('Workspace A')
    const workspaceB = await createWorkspace('Workspace B')
    
    await createProduct({ name: 'Product A', workspaceId: workspaceA.id })
    await createProduct({ name: 'Product B', workspaceId: workspaceB.id })
    
    const response = await request(app)
      .get('/api/v1/products')
      .query({ workspaceId: workspaceA.id })
      .set('Authorization', tokenWorkspaceA)
    
    expect(response.body).toHaveLength(1)
    expect(response.body[0].name).toBe('Product A')
    expect(response.body[0].name).not.toBe('Product B') // ✅ Isolated
  })

  it('should NOT allow cross-workspace product access', async () => {
    const productWorkspaceA = await createProduct({ workspaceId: workspaceA.id })
    
    const response = await request(app)
      .get(`/api/v1/products/${productWorkspaceA.id}`)
      .set('Authorization', tokenWorkspaceB) // Different workspace token
    
    expect(response.status).toBe(403) // ✅ Forbidden
  })
})
```

### Input Validation Security Test

```typescript
// __tests__/security/input-validation.spec.ts
describe('Input Validation Security', () => {
  it('should reject SQL injection in product name', async () => {
    const response = await request(app)
      .post('/api/v1/products')
      .set('Authorization', token)
      .send({
        name: "'; DROP TABLE products;--",
        price: 100,
        workspaceId
      })
    
    expect(response.status).toBe(400) // ✅ Rejected
  })

  it('should sanitize XSS in characteristics', async () => {
    const response = await request(app)
      .post('/api/v1/products')
      .set('Authorization', token)
      .send({
        name: 'Product',
        price: 100,
        workspaceId,
        characteristics: [{
          name: '<script>alert("xss")</script>',
          value: 'test'
        }]
      })
    
    expect(response.status).toBe(400) // ✅ Rejected
  })
})
```

---

## 📊 6. COMPLETE TEST SUITE

### Run All Tests Script

```bash
#!/bin/bash
# test-all.sh - Complete test suite

echo "🧪 Running Complete Test Suite..."

cd apps/backend

# 1. Unit Tests
echo "📋 1/6 Running Unit Tests..."
npm run test:unit
if [ $? -ne 0 ]; then echo "❌ Unit tests failed"; exit 1; fi

# 2. Integration Tests
echo "📋 2/6 Running Integration Tests..."
npm run test:integration
if [ $? -ne 0 ]; then echo "❌ Integration tests failed"; exit 1; fi

# 3. Security Tests
echo "📋 3/6 Running Security Tests..."
npm run test:security
if [ $? -ne 0 ]; then echo "❌ Security tests failed"; exit 1; fi

# 4. LLM Tests
echo "📋 4/6 Running LLM Tests..."
npm run test:llm
if [ $? -ne 0 ]; then echo "❌ LLM tests failed"; exit 1; fi

# 5. Export/Import Tests
echo "📋 5/6 Running Export/Import Tests..."
npm run test:export-import
if [ $? -ne 0 ]; then echo "❌ Export/Import tests failed"; exit 1; fi

# 6. E2E Tests
echo "📋 6/6 Running E2E Tests..."
npm run test:e2e
if [ $? -ne 0 ]; then echo "❌ E2E tests failed"; exit 1; fi

echo "✅ All tests passed!"
```

---

## ✅ FINAL CHECKLIST

### Pre-Deploy Verification

- [ ] **API Endpoints**: All GET/POST/PUT/DELETE tested
- [ ] **Form Validations**: Frontend + Backend validation working
- [ ] **Export/Import**: CSV export/import with characteristics working
- [ ] **LLM Tests**: Prompt variables, search, grouping tested
- [ ] **Security**: Workspace isolation, input validation tested
- [ ] **Database**: Migrations applied, seed working
- [ ] **Documentation**: All endpoints documented in Swagger
- [ ] **Test Coverage**: >80% coverage on critical paths

### Deploy Confidence Score

```
🟢 100% - All tests pass, documentation complete
🟡 80-99% - Minor issues, can deploy with monitoring
🔴 <80% - DO NOT DEPLOY, fix issues first
```

**🎯 REGOLA D'ORO: Se non è testato, non funziona. Se non è documentato, non esiste.**