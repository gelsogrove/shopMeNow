# Product Search - Title-Only Search (Andrea's Request)

## 📋 Requirement

**Current Behavior**: When user searches "mozzarella", the agent returns ALL products containing "mozzarella" in:
- Product name
- Description
- Certifications
- Other fields

**Desired Behavior**: Search ONLY in product **title/name** by default.

## 🎯 Examples

### ❌ WRONG (Current)
User: "avete la mozzarella?"
Response: Shows ALL products with "mozzarella" in any field (name, description, category, etc.)

### ✅ CORRECT (Desired)
User: "avete la mozzarella?"
Response: Shows ONLY products with "mozzarella" in the **product name**

### Exception
User: "dammi i prodotti **che contengono** mozzarella"
Response: In this case, search in ALL fields (name + description)

## 🔧 Solution

This is controlled by the **agent prompt** in the database (`agentConfig` table for PRODUCT_SEARCH agent).

### Current Prompt Issue
The prompt likely says something like:
```
"Search for products matching the user's query in any field"
```

### Required Prompt Update
Update the PRODUCT_SEARCH agent prompt to:
```
"When user searches for a product (e.g., 'avete la mozzarella?'):
- Search ONLY in the product NAME/TITLE by default
- If user explicitly asks for 'products that contain X' (prodotti che contengono X), then search in all fields including description
- Examples:
  - 'avete la mozzarella?' → Search only in name
  - 'mostrami i formaggi' → Search only in category/name
  - 'dammi i prodotti che contengono formaggio' → Search in name + description
"
```

## 📝 Implementation Steps

1. **Update Agent Prompt** (Database)
   - Table: `agentConfig`
   - Agent type: `PRODUCT_SEARCH`
   - Field: `systemPrompt`
   - Add instruction: "Search ONLY in product name unless user says 'prodotti che contengono'"

2. **Alternative: Code-Level Filter** (Not Recommended)
   - Modify `ProductSearchAgentLLM.ts` to filter products by name only
   - This is less flexible than LLM-based approach

## 🧪 Testing

After updating the prompt:

1. Test: "avete la mozzarella?" → Should show only products with "mozzarella" in name
2. Test: "dammi i prodotti che contengono mozzarella" → Should show products with "mozzarella" in name OR description
3. Test: "mostrami i formaggi" → Should show products in "Formaggi" category

## 📍 Current Status

- ⚠️ **NOT IMPLEMENTED** - Requires agent prompt update in database
- Agent prompt needs to distinguish between:
  - Simple product search → NAME only
  - Explicit "contains" query → ALL fields

## 💡 Andrea's Words

> "come seconda nota deve cercare solo nel titolo del prodotto a meno che l'utente non chieda dammi i prodotti che contengono mozzarella.. e' un piccolo dettaglio che fa la differenza!"

## 🔗 Related Files

- `/apps/backend/src/application/agents/ProductSearchAgentLLM.ts` - Agent implementation
- Database: `agentConfig` table → `type='PRODUCT_SEARCH'` → `systemPrompt` field
