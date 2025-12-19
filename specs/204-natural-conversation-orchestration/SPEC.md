# Feature 204: Natural Conversation Orchestration

## 📋 Overview

Transform the chatbot from robotic, repetitive responses to natural, context-aware conversations with intelligent orchestration, memory, and dynamic content mixing.

## 🎯 Goals

1. **Multi-Intent Recognition** - Recognize multiple intents in a single message
2. **History-Aware Responses** - Use conversation history to personalize answers
3. **Dynamic Content Mixing** - Blend products, FAQ, offers in ONE natural response
4. **Interactive Questions** - Ask contextual questions to understand user preferences
5. **Smart Grouping** - Group products intelligently based on filters and preferences
6. **Flag-Aware** - Respect `sellsProductsAndServices` flag (if false → no products, only FAQ/info)
7. **Guest Mode** - Allow non-registered users to chat freely, require registration only for prices/orders

## 🆓 Guest Mode (Non-Registered Users)

### Flow
1. New WhatsApp number arrives → Create customer with `isRegistered: false` (only phone)
2. Guest can: browse categories, see products (NO prices), FAQ, talk to operator
3. When guest wants prices/cart → Show registration prompt with link
4. After registration → `isRegistered: true` → full access

### Access Matrix

| Action | Guest (isRegistered=false) | Registered |
|--------|---------------------------|------------|
| See categories | ✅ | ✅ |
| See products (NO price) | ✅ | ✅ with price |
| FAQ | ✅ | ✅ |
| Talk to operator | ✅ | ✅ |
| See prices | ❌ → registration link | ✅ |
| Add to cart | ❌ → registration link | ✅ |
| Place orders | ❌ | ✅ |
| View order history | ❌ | ✅ |
| Personal discounts | ❌ | ✅ |
| Change email/data | ❌ | ✅ via link |

### Registration Prompt (LLM generates naturally)
```
"Per vedere i prezzi e fare ordini, registrati in 30 secondi! 📝
[link registrazione]

🔒 I tuoi dati sono al sicuro:
• NON vengono condivisi con terzi
• NON vengono inviati a modelli AI
• Gestiti solo da noi per il tuo servizio

Intanto posso rispondere a qualsiasi domanda! 😊"
```

### Privacy (GDPR - CRITICAL)
When asking for registration, ALWAYS include:
- ❌ Data NOT shared with third parties
- ❌ Data NOT sent to AI models
- ✅ Managed only by us for your service

### Existing Calling Functions
- Registration link → already exists (reuse)
- Change email/data link → already exists (reuse)

## 🏗️ Architecture

### Layer 1: Multi-Intent Recognition (LLM - temp 0.3)
```
User: "sto cercando prodotti freschi ma in quanto tempo arrivano?"
→ Intents: [SEARCH_PRODUCTS, ASK_FAQ]
```

### Layer 2: Parallel Data Loading (Promise.all)
```
Load simultaneously:
- Products (if sellsProductsAndServices=true)
- FAQ (semantic match)
- Offers
- Conversation History
- Customer Preferences
```

### Layer 3: Content Mixer (LLM - temp 0.9)
```
Mix all content into ONE natural response
LLM decides order based on context
```

### Layer 4: Translation (LLM - temp 0.4)
```
Always final layer - translate to customer's language
```

## 🚨 Critical Rules

### NO HARDCODING
- ❌ No hardcoded greetings, CTA, questions
- ❌ No keyword arrays for intent detection
- ❌ No static templates
- ✅ Everything dynamic via LLM + database

### PRESERVE EXISTING CONTROLS (CRITICAL!)
The orchestration MUST preserve ALL existing security/state checks:
- ✅ **Blocked User** - If user is blocked, return blocked message (no processing)
- ✅ **Channel Stopped** - If workspace.challengeStatus is stopped, return WIP message
- ✅ **No Credits** - If user has no credits/balance, handle appropriately
- ✅ **Soft Deleted** - Check deletedAt on all entities
- ✅ **Workspace Isolation** - ALL queries must filter by workspaceId
- ✅ **Session Validation** - Validate chat session exists and is active
- ✅ **Rate Limiting** - Respect existing rate limits
- ✅ **Customer Locks** - Prevent concurrent message processing per customer

These checks happen BEFORE orchestration starts. Never bypass them!

### DATALOADER INTEGRITY
- ❌ LLM must NEVER change prices, SKU, quantities
- ✅ LLM formats data but preserves values
- ✅ Validation after LLM formatting

### FLAG-AWARE RESPONSES
```typescript
if (workspace.sellsProductsAndServices === false) {
  // NO products, NO cart, NO orders
  // ONLY: FAQ, info, conversation, support
}
```

### FILE SIZE LIMITS
- Max 300 lines per file
- Extract shared logic to utilities
- No code duplication

## 📊 Database Requirements

### Existing (no changes needed)
- `chatSession.metadata` (JSON) - conversation state
- `faq` table - FAQ answers
- `products` table - products with categories
- `offers` table - active offers
- `workspace` table - flags (sellsProductsAndServices, toneOfVoice, etc.)

### Optional Enhancement
- `products.isVegetarian`, `isBio`, `isHalal`, etc. (preference filters)
- `customer.preferences` (JSON) - saved preferences

## 🔄 Flow Examples

### Example 1: Products + FAQ in one message
```
User: "che prodotti freschi avete e in quanto tempo arrivano?"

[Intent Recognition]
→ SEARCH_PRODUCTS (filter: freschi)
→ ASK_FAQ (topic: delivery_times)

[Parallel Loading]
→ Products: [Mozzarella €8.50, Ricotta €6.00, ...]
→ FAQ: "Nord 24-48h, Sud 48-72h, Express +€5"

[Content Mixer - LLM decides order]
Output:
"Ciao Mario! 🌱

Per i prodotti freschi abbiamo:

**Formaggi Freschi** (3 prodotti)
1. Mozzarella di Bufala DOP (€8.50)
2. Ricotta Fresca (€6.00)
3. Burrata Pugliese (€12.00)

📦 **Tempi di consegna**: 
• Nord Italia: 24-48h con trasporto refrigerato ❄️
• Centro-Sud: 48-72h

Quale ti interessa? 😊"
```

### Example 2: No products mode (FAQ only)
```
workspace.sellsProductsAndServices = false

User: "che servizi offrite?"

[Intent Recognition]
→ ASK_FAQ (topic: services)

[Loading]
→ FAQ only (no products)
→ Service info from workspace

Output:
"Ciao Mario! 👋

Offriamo consulenza per:
• Importazione prodotti italiani
• Logistica e trasporto
• Supporto doganale

Vuoi sapere di più su uno di questi servizi?"
```

### Example 3: Guest Mode (not registered)
```
customer.isRegistered = false

User: "che formaggi avete?"

[Check Registration]
→ isRegistered: false → hide prices

[Loading]
→ Products WITHOUT prices
→ FAQ
→ Offers (mention exists, no details)

Output:
"Ciao! 👋 Ecco i nostri formaggi:

**Formaggi Stagionati**
• Pecorino Romano DOP
• Parmigiano Reggiano 24 mesi
• Grana Padano

**Formaggi Freschi**
• Mozzarella di Bufala DOP
• Burrata Pugliese
• Ricotta Fresca

Per vedere i prezzi e ordinare, registrati in 30 secondi! 📝
[link registrazione]

🔒 I tuoi dati sono al sicuro - non vengono condivisi con terzi né inviati a modelli AI.

Hai domande sui prodotti? Sono qui per aiutarti! 😊"
```

### Example 4: Guest tries to add to cart
```
customer.isRegistered = false

User: "aggiungi mozzarella al carrello"

[Check Registration]
→ isRegistered: false → BLOCK cart action

Output:
"Per aggiungere prodotti al carrello devi prima registrarti! 📝

Ci vogliono solo 30 secondi:
[link registrazione]

🔒 I tuoi dati sono al sicuro:
• NON vengono condivisi con terzi
• NON vengono inviati a modelli AI

Intanto posso raccontarti tutto sulla nostra Mozzarella di Bufala! È prodotta in Campania... 🧀"
```

### Example 5: Interactive preference questions
```
User: "che prodotti avete?"

[No preferences saved yet]

[Response - ask preferences]
"Ciao Mario! 👋 Abbiamo tantissime specialità italiane!

Dimmi un po':
• Sei vegetariano o vegano? 🌱
• Preferisci prodotti BIO? 🌿
• Cerchi qualcosa di particolare?

Così ti consiglio al meglio! 😊"

User: "sì sono vegetariano dammi BIO"

[Save preferences]
customer.preferences = { vegetarian: true, bio: true }

[Filter + Group products]
Output:
"Perfetto! Ecco i prodotti vegetariani BIO: 🌱

**Formaggi BIO** (3 prodotti)
1. Pecorino Toscano BIO (€15.00)
...

**Conserve BIO** (2 prodotti)
4. Pomodori San Marzano BIO (€5.00)
..."
```

## 🌡️ Temperature Strategy

| Service | Temperature | Reason |
|---------|-------------|--------|
| Intent Recognition | 0.3 | Precision - no creativity |
| FAQ Semantic Match | 0.4 | Balanced |
| Content Mixer | 0.9 | Creativity - natural flow |
| Formatting Validator | 0.2 | Strict - no errors |
| Translation | 0.4 | Faithful - no invention |

## ✅ Acceptance Criteria

1. [ ] Multi-intent recognition works ("products + FAQ" in one message)
2. [ ] FAQ answers are context-aware (fresh products → mention refrigeration)
3. [ ] No hardcoded keywords, greetings, or templates
4. [ ] `sellsProductsAndServices=false` disables all product features
5. [ ] Conversation history influences responses
6. [ ] Prices and SKU never modified by LLM
7. [ ] Responses feel natural (not robotic)
8. [ ] Interactive questions when preferences unknown
9. [ ] Smart grouping of filtered products
10. [ ] Performance < 2 seconds for full response
11. [ ] **ALL existing security checks preserved** (blocked, stopped, no credits, etc.)

## 🧪 Testing

**NO TESTS FOR NOW** - Tests will be written after implementation is working.
Focus on implementation first, tests later.

## 🧪 Testing

**NO TESTS FOR NOW** - Tests will be written after implementation is working.
Focus on implementation first, tests later.

## 📁 File Structure (Proposed)

```
backend/src/
├── application/
│   ├── orchestration/
│   │   ├── orchestration.service.ts       # Main orchestrator (< 200 lines)
│   │   ├── intent-recognition.service.ts  # Multi-intent parser (< 150 lines)
│   │   ├── content-mixer.service.ts       # Mix products + FAQ (< 150 lines)
│   │   └── preference-manager.service.ts  # User preferences (< 100 lines)
│   ├── intent/
│   │   ├── intent-parser.ts               # Existing - enhance
│   │   └── intent-types.ts                # Intent type definitions
│   └── data-loader/
│       └── parallel-loader.service.ts     # Parallel data loading (< 150 lines)
```

## 🧪 Test Cases

1. "che prodotti avete?" → Should ask preferences if none saved
2. "prodotti freschi e tempi consegna" → Should mix products + FAQ
3. "sono vegetariano dammi BIO" → Should save preferences + filter products
4. "come mi chiamo?" → Should show customer name (not products!)
5. "vorrei cambiare lingua" → Should show language change link (not products!)
6. With sellsProductsAndServices=false → Should never show products

---

## 🚀 Implementation Order

### Phase 1: Intent Recognition Enhancement
- Multi-intent parsing
- Intent types definition

### Phase 2: Parallel Data Loading
- Promise.all for parallel loading
- Flag-aware loading (skip products if sellsProductsAndServices=false)

### Phase 3: Content Mixer
- LLM-based content mixing
- History-aware FAQ responses
- Smart product grouping

### Phase 4: Preference Manager
- Save/load user preferences
- Preference-based filtering

### Phase 5: Integration
- Wire all services together
- Performance optimization
- Testing
