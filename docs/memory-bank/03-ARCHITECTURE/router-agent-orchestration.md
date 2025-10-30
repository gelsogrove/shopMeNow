# Router Agent Orchestration Architecture

**Status**: ✅ Active  
**Last Updated**: 2025-10-30  
**Owner**: Andrea

---

## 🎯 Overview

The **Router Agent** is the central orchestrator of ShopME's multi-agent system. It maintains conversation history, checks FAQ, and intelligently delegates complex operations to specialist sub-agents while handling simple queries directly.

---

## 📐 Architecture Principles

### **Core Responsibilities**

1. **Context Management**

   - Maintains full conversation history (storico)
   - Loads and integrates FAQ database into prompt
   - Understands customer roles and permissions

2. **Intent Analysis**

   - Analyzes customer message intent
   - Decides whether to:
     - Answer directly (simple queries, FAQ matches)
     - Delegate to specialist sub-agent (complex operations)

3. **Orchestration**
   - Calls sub-agent via Call Functions
   - Receives sub-agent results
   - Integrates results into conversational response
   - Routes everything through Safety & Translation layer

---

## 🔄 Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                          CUSTOMER                                │
│                        (WhatsApp)                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ROUTER AGENT                                │
│  • Has: FAQ Database, Conversation History, All Roles            │
│  • Can: Answer directly OR delegate to sub-agents                │
│                                                                   │
│  Call Functions Available:                                       │
│  ├─ productSearchAgent     (delegate to specialist)              │
│  ├─ cartManagementAgent    (delegate to specialist)              │
│  ├─ orderTrackingAgent     (delegate to specialist)              │
│  └─ customerSupportAgent   (delegate to specialist)              │
│  └─ Direct business functions  (simple operations)               │
│     ├─ searchProducts                                            │
│     ├─ addToCart, viewCart, clearCart, etc.                      │
│     ├─ getOrders, repeatLastOrder                                │
│     └─ contactSupport                                            │
└────────┬────────────────────────────┬────────────────────────────┘
         │                            │
         │ (Delegation)               │ (Direct Answer)
         ▼                            ▼
┌──────────────────────┐    ┌──────────────────────┐
│  PRODUCT SEARCH      │    │  SAFETY &            │
│  AGENT               │    │  TRANSLATION         │
│  • searchProducts    │    │  LAYER               │
└──────────────────────┘    └──────────────────────┘
         │                            ▲
         │ (Returns result)           │
         └────────────┬───────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  CART MANAGEMENT       │
         │  AGENT                 │
         │  • addToCart           │
         │  • viewCart, etc.      │
         └────────────────────────┘
                      │
                      │ (Returns result)
                      └────────────┐
                                   │
                                   ▼
         ┌────────────────────────────────────┐
         │  ORDER TRACKING AGENT              │
         │  • getOrders                       │
         │  • repeatLastOrder                 │
         └────────────────────────────────────┘
                      │
                      │ (Returns result)
                      └────────────┐
                                   │
                                   ▼
         ┌────────────────────────────────────┐
         │  CUSTOMER SUPPORT AGENT            │
         │  • contactSupport                  │
         │  • Escalation handling             │
         └────────────────────────────────────┘
                      │
                      │ (Returns result)
                      └────────────┐
                                   │
                                   ▼
         ┌────────────────────────────────────┐
         │  ROUTER AGENT                      │
         │  Integrates result into response   │
         └────────────┬───────────────────────┘
                      │
                      ▼
         ┌────────────────────────────────────┐
         │  SAFETY & TRANSLATION LAYER        │
         │  • Content validation              │
         │  • Translation to customer lang    │
         └────────────┬───────────────────────┘
                      │
                      ▼
         ┌────────────────────────────────────┐
         │  WHATSAPP                          │
         └────────────────────────────────────┘
```

---

## 🔧 Call Functions Design

### **Router Agent Functions**

#### **Sub-Agent Delegation** (Priority: High)

```typescript
{
  name: "productSearchAgent",
  description: "Delegate to Product Search specialist for complex queries",
  parameters: { query: string }
}

{
  name: "cartManagementAgent",
  description: "Delegate to Cart Management specialist",
  parameters: { query: string }
}

{
  name: "orderTrackingAgent",
  description: "Delegate to Order Tracking specialist",
  parameters: { query: string }
}

{
  name: "customerSupportAgent",
  description: "Delegate to Customer Support specialist",
  parameters: { query: string, urgency: "low" | "medium" | "high" }
}
```

**Note**: Router does NOT have direct access to business functions. All business operations (searchProducts, addToCart, etc.) are executed by specialist sub-agents. Router only delegates via the above 4 functions.

---

## 🎭 Sub-Agent Specialists

### **1. Product Search Agent**

- **Purpose**: Product catalog search, filtering, recommendations
- **Call Functions**: `searchProducts`, `searchProductByCertifications`
- **When to use**: Complex product queries, multiple filters, recommendations, certification-based searches

### **2. Cart Management Agent**

- **Purpose**: All cart operations
- **Call Functions**: `addToCart`, `viewCart`, `removeFromCart`, `updateCartQuantity`, `clearCart`
- **When to use**: Cart modifications, viewing cart state

### **3. Order Tracking Agent**

- **Purpose**: Order history, status, tracking, invoices, repeat orders
- **Call Functions**: `getOrders`, `getOrder`, `trackOrder`, `sendInvoice`, `repeatLastOrder`
- **When to use**: Order inquiries, tracking status, invoice requests, reordering

### **4. Customer Support Agent**

- **Purpose**: Escalation, complex issues, human handoff
- **Call Functions**: `contactSupport`
- **When to use**: Frustrated customers, unresolved issues

### **5. Safety & Translation Agent** (Always Last)

- **Purpose**: Content validation, translation, security monitoring
- **Call Functions**: `sendAlertEmail` (alerts admins of security issues)
- **When to use**: ALWAYS - final step before WhatsApp
- **Alerts for**: Security violations, inappropriate content, data leakage, policy violations

---

## 📊 Decision Logic

### **When Router Answers Directly**

✅ FAQ match (high confidence)  
✅ Simple greeting/small talk  
✅ Quick info requests (no business operations needed)
✅ Clarification questions

### **When Router Delegates to Sub-Agent**

🔀 **ALWAYS** for product searches → productSearchAgent
🔀 **ALWAYS** for cart operations → cartManagementAgent
🔀 **ALWAYS** for order queries → orderTrackingAgent
🔀 **ALWAYS** for support/escalation → customerSupportAgent

**Important**: Router NEVER executes business functions directly. It only delegates to specialists.

---

## 🔒 Security & Validation

### **Safety & Translation Layer** (MANDATORY)

```
EVERY response → Safety Agent → Translation → WhatsApp
```

**Safety Checks**:

- ❌ No personal data leakage
- ❌ No inappropriate content
- ❌ No system information exposure
- ✅ Business-appropriate language

**Translation**:

- Detects customer language
- Translates to customer's preferred language
- Maintains tone and context

---

## 💾 Data Flow

### **Router Agent Context**

```typescript
{
  conversationHistory: Message[],  // Last 10 minutes
  faqDatabase: FAQ[],               // All active FAQs
  customerInfo: {
    id: string,
    name: string,
    language: string,
    roles: string[]
  },
  availableSubAgents: [
    "ProductSearch",
    "CartManagement",
    "OrderTracking",
    "CustomerSupport"
  ]
}
```

### **Sub-Agent Response Format**

```typescript
{
  success: boolean,
  result: any,                    // Function execution result
  message: string,                // Human-readable summary
  executionTimeMs: number,
  tokensUsed: number
}
```

---

## 📈 Performance Considerations

### **Token Optimization**

- Router has full context → More tokens per call
- Sub-agents are focused → Fewer tokens per call
- Direct operations → No sub-agent overhead

### **Latency**

- FAQ hit: ~50ms (database only)
- Direct operation: ~500-1000ms (Router → Function)
- Delegated operation: ~1500-2500ms (Router → Sub-Agent → Router)

### **Cost**

- Router call: ~1500-2000 tokens (with history + FAQ)
- Sub-agent call: ~500-800 tokens (focused context)
- Safety layer: ~300-500 tokens (validation + translation)

---

## 🧪 Testing Strategy

### **Router Tests**

✅ FAQ matching accuracy  
✅ Intent classification  
✅ Delegation decisions  
✅ Context management

### **Sub-Agent Tests**

✅ Function execution  
✅ Result formatting  
✅ Error handling  
✅ Token usage

### **Integration Tests**

✅ End-to-end flow  
✅ Safety layer validation  
✅ Translation accuracy

---

## 🚀 Future Enhancements

1. **Agent Learning**: Track which delegation decisions work best
2. **Dynamic FAQ**: Auto-generate FAQ from common questions
3. **Predictive Routing**: Pre-call sub-agents based on conversation flow
4. **Multi-Agent Collaboration**: Sub-agents can call other sub-agents

---

## 📝 Implementation Checklist

- [x] Router Agent prompt with FAQ + history
- [x] Sub-agent delegation Call Functions
- [x] Direct business Call Functions
- [x] Safety & Translation layer integration
- [x] Conversation history management
- [x] FAQ database integration
- [ ] Sub-agent execution handlers (callProductSearchAgent, etc.)
- [ ] Result integration logic
- [ ] Performance monitoring
- [ ] Cost tracking

---

## 🔗 Related Documentation

- [Calling Functions Architecture](./calling-functions-architecture.md)
- [Calling Functions Routing](./calling-functions-routing.md)
- [Multi-Agent Analysis](./multi-agent-analysis.md)
- [PRD - Multi-Agent System](../prd.md)

---

**Last Review**: 2025-10-30  
**Next Review**: When adding new sub-agents or modifying delegation logic
