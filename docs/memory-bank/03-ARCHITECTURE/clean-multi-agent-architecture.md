# 🏗️ Multi-Agent Architecture - Clean Separation of Responsibilities

## 🎯 PRINCIPIO FONDAMENTALE

**OGNI LLM HA LA SUA RESPONSABILITÀ - MAI MISCHIARE LE COSE!**

## 📐 Architettura Pulita

```
Customer Message
      ↓
┌─────────────────────┐
│   Router LLM        │  ← Prompt: agentConfig.ROUTER
│  (Delegation ONLY)  │  ← Function: Delegate to specialists
└─────────────────────┘
      ↓ Delegates to
      ↓
┌─────────────────────────────────────────────────────────┐
│              SPECIALIST AGENTS (Own LLM each)            │
├─────────────────────────────────────────────────────────┤
│ ProductSearchAgentLLM    agentConfig.PRODUCT_SEARCH     │
│ CartManagementAgentLLM   agentConfig.CART_MANAGEMENT    │
│ OrderTrackingAgentLLM    agentConfig.ORDER_TRACKING     │
│ CustomerSupportAgentLLM  agentConfig.CUSTOMER_SUPPORT   │
└─────────────────────────────────────────────────────────┘
      ↓ Returns English response with [LINK_xxx] tokens
      ↓
┌─────────────────────┐
│ Router LLM          │  ← Processes specialist response
│  (Iteration 2)      │  ← Formats final response
└─────────────────────┘
      ↓
┌─────────────────────┐
│SafetyTranslationAgent│ ← Validates & translates
│  (Safety + I18n)    │ ← agentConfig.SAFETY_TRANSLATION
└─────────────────────┘
      ↓
┌─────────────────────┐
│LinkReplacementService│ ← [LINK_xxx] → Real URLs
└─────────────────────┘
      ↓
   Customer Response (Translated + Safe + With Links)
```

## 🔑 Key Components

### 1. **Router LLM** (LLMRouterService)

- **File**: `backend/src/services/llm-router.service.ts`
- **Responsibility**: DELEGATION ONLY
- **Prompt**: Database `agentConfig.type = ROUTER`
- **Functions**:
  - `productSearchAgent(query)` → Delegate to ProductSearchAgentLLM
  - `cartManagementAgent(query)` → Delegate to CartManagementAgentLLM
  - `orderTrackingAgent(query)` → Delegate to OrderTrackingAgentLLM
  - `customerSupportAgent(query)` → Delegate to CustomerSupportAgentLLM
- **NEVER**: Executes business logic directly
- **NEVER**: Calls LLMService (old monolithic system)

### 2. **Specialist Agents** (Own LLM each)

#### ProductSearchAgentLLM

- **File**: `backend/src/application/agents/ProductSearchAgentLLM.ts`
- **Responsibility**: Product search, filtering, recommendations
- **Prompt**: Database `agentConfig.type = PRODUCT_SEARCH`
- **Functions**:
  - `searchProducts(keywords, filters)` → ProductSearchAgent.search()
- **Returns**: English response with [LINK_PRODUCT_xxx] tokens

#### CartManagementAgentLLM

- **File**: `backend/src/application/agents/CartManagementAgentLLM.ts`
- **Responsibility**: Cart operations (add/remove/view/clear)
- **Prompt**: Database `agentConfig.type = CART_MANAGEMENT`
- **Functions**:
  - `viewCart()` → CartManagementAgent.getCart()
  - `addToCart(productId, quantity)` → CartManagementAgent.addToCart()
- **Returns**: English response with [LINK_CART_xxx] tokens

#### OrderTrackingAgentLLM

- **File**: `backend/src/application/agents/OrderTrackingAgentLLM.ts`
- **Responsibility**: Order history, tracking, status
- **Prompt**: Database `agentConfig.type = ORDER_TRACKING`
- **Functions**:
  - `getOrderHistory()` → OrderRepository.findByCustomerId()
  - `getOrderDetails(orderCode)` → OrderRepository.findByOrderCode()
- **Returns**: English response with [LINK_ORDER_xxx] tokens

#### CustomerSupportAgentLLM

- **File**: `backend/src/application/agents/CustomerSupportAgentLLM.ts`
- **Responsibility**: FAQ, support tickets, sales contact
- **Prompt**: Database `agentConfig.type = CUSTOMER_SUPPORT`
- **Functions**:
  - `searchFAQ(query)` → FAQRepository.searchByKeywords()
  - `createSupportTicket(subject, description)` → Create ticket
- **Returns**: English response

### 3. **Safety & Translation Layer**

- **File**: `backend/src/application/agents/SafetyTranslationAgent.ts`
- **Responsibility**:
  - Safety validation (no PII leaks, no harmful content)
  - Translation to customer language (it/es/pt/en)
- **Prompt**: Database `agentConfig.type = SAFETY_TRANSLATION`
- **Input**: English response from Router/Specialists
- **Output**: Translated + validated response

### 4. **Link Replacement Service**

- **File**: `backend/src/application/services/link-replacement.service.ts`
- **Responsibility**: Replace [LINK_xxx] tokens with real secure URLs
- **Tokens**:
  - `[LINK_PRODUCT_xxx]` → `/products/xxx?token=...`
  - `[LINK_CART]` → `/cart?token=...`
  - `[LINK_ORDER_xxx]` → `/orders/xxx?token=...`

## 🔒 Security Rules

### ✅ ALWAYS

1. **Workspace Isolation**: ALL queries filtered by `workspaceId`
2. **Database Prompts**: ALL prompts from `agentConfig` table
3. **Clean Separation**: Each LLM has ONE responsibility
4. **English First**: Specialists return English, Router handles translation
5. **Token-Based Links**: Public URLs use `SecureTokenService`

### ❌ NEVER

1. **NO LLMService**: Old monolithic system - DO NOT USE
2. **NO Hardcoded Data**: Everything from database
3. **NO Mixed Responsibilities**: Router delegates, doesn't execute
4. **NO Direct Translation**: Only SafetyTranslationAgent translates
5. **NO Cross-Workspace Data**: ALWAYS filter by workspaceId

## 📝 Example Flow

### Customer: "Voglio formaggi italiani sotto 20 euro"

```
1. Router LLM receives message
   ↓ Recognizes: product search intent
   ↓ Calls function: productSearchAgent(query)

2. ProductSearchAgentLLM
   ↓ Loads prompt: agentConfig.PRODUCT_SEARCH
   ↓ Calls LLM with own functions
   ↓ Executes: searchProducts(keywords=["formaggi", "italiani"], maxPrice=20)
   ↓ Returns: "I found 5 Italian cheeses under €20: [LINK_PRODUCT_123] Parmigiano..."

3. Router LLM (Iteration 2)
   ↓ Receives specialist response
   ↓ Formats final message
   ↓ Returns: "Here are the Italian cheeses under €20: [LINK_PRODUCT_123]..."

4. SafetyTranslationAgent
   ↓ Validates: No PII, no harmful content
   ↓ Translates: "Ecco i formaggi italiani sotto €20: [LINK_PRODUCT_123]..."

5. LinkReplacementService
   ↓ [LINK_PRODUCT_123] → http://localhost:3000/products/123?token=abc...

6. Final Response to Customer
   "Ecco i formaggi italiani sotto €20: http://localhost:3000/products/123?token=abc..."
```

## 🧪 Testing

### Unit Tests

- Each Specialist Agent has isolated tests
- Mock database and external APIs
- Verify workspace isolation

### Integration Tests

- Full flow: Router → Specialist → Safety → Links
- Verify no LLMService calls
- Verify correct agent delegation

### Security Tests

- Cross-workspace data leakage prevention
- Token expiration validation
- Prompt injection prevention

## 🚀 Migration from Old System

### OLD (❌ BAD)

```typescript
// Router calls LLMService.handleMessage() with agentType
const { LLMService } = require("./llm.service")
const llmService = new LLMService()
const response = await llmService.handleMessage(
  {
    phone: customer.phone,
    workspaceId: params.workspaceId,
    chatInput: delegationQuery,
    agentType: "PRODUCT_SEARCH", // ❌ LLMService handles everything
  },
  customerData,
  true
)
```

### NEW (✅ GOOD)

```typescript
// Router calls Specialist Agent with OWN LLM
const productSearchAgent = new ProductSearchAgentLLM(this.prisma)
const response = await productSearchAgent.handleQuery({
  workspaceId: params.workspaceId,
  customerId: params.customerId,
  customerName: params.customerName,
  customerLanguage: params.customerLanguage,
  query: delegationQuery, // ✅ Specialist has own LLM + prompt
})
```

## 📚 Files Changed

### Created (New Specialist Agents)

- ✅ `backend/src/application/agents/ProductSearchAgentLLM.ts`
- ✅ `backend/src/application/agents/CartManagementAgentLLM.ts`
- ✅ `backend/src/application/agents/OrderTrackingAgentLLM.ts`
- ✅ `backend/src/application/agents/CustomerSupportAgentLLM.ts`

### Modified (Clean Architecture)

- ✅ `backend/src/services/llm-router.service.ts`
  - Import specialist agents
  - Replace LLMService calls with specialist calls
  - Update debug info structure
  - Clean up comments

### Deprecated (DO NOT USE)

- ❌ `backend/src/services/llm.service.ts` (LLMService)
  - Old monolithic system
  - Only kept for backward compatibility
  - Will be removed in future

## 🎓 Best Practices

1. **One LLM = One Responsibility**

   - Router: Delegation
   - Specialists: Execution
   - Safety: Validation + Translation

2. **Database-First**

   - NO hardcoded prompts
   - ALL config from `agentConfig` table

3. **English Pipeline**

   - Specialists return English
   - SafetyTranslationAgent translates to target language

4. **Token-Based Security**

   - [LINK_xxx] tokens in responses
   - LinkReplacementService generates secure URLs
   - Time-limited access tokens

5. **Workspace Isolation**
   - EVERY query filtered by workspaceId
   - NO cross-workspace data leakage

## ✅ Verification Checklist

Before deploying:

- [ ] All specialist agents have database prompts
- [ ] NO calls to LLMService in Router
- [ ] ALL queries have workspaceId filter
- [ ] Security tests pass
- [ ] Integration tests pass
- [ ] Documentation updated

---

**Last Updated**: 2025-11-03  
**Status**: ✅ IMPLEMENTED  
**Author**: Andrea's AI Coding Agent
