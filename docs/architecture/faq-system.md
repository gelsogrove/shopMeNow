# FAQ System Architecture

**Version**: 1.0.0  
**Last Updated**: January 5, 2026  
**Status**: ACTIVE

---

## Overview

The FAQ system enables the chatbot to answer frequently asked questions using content stored in the database. FAQs are loaded dynamically and injected into the CustomerSupportAgent's prompt for natural language matching and response generation.

---

## Architecture

### Data Flow

```
1. Customer asks question (e.g., "How long does onboarding take?")
   ↓
2. Router classifies intent → CUSTOMER_SUPPORT
   ↓
3. CustomerSupportAgentLLM.handleQuery()
   ↓
4. Load FAQs from database (MessageRepository.getActiveFaqs)
   ↓
5. Inject FAQs into prompt via {{faqs}} variable
   ↓
6. LLM matches question to FAQ and generates natural response
   ↓
7. SafetyTranslationAgent translates to customer's language
   ↓
8. Response sent to customer
```

---

## Components

### 1. Database Schema

**Table**: `faqs` (model: `FAQ`)

```prisma
model FAQ {
  id          String    @id @default(cuid())
  workspaceId String
  question    String
  answer      String    @db.Text
  keywords    String[]  // Array for keyword matching
  category    String?   // Optional grouping: "Ordini", "Spedizioni", etc.
  order       Int       @default(0) // Display/priority order
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, isActive])
  @@index([keywords])
  @@index([category])
  @@map("faqs")
}
```

### 2. MessageRepository

**File**: `apps/backend/src/repositories/message.repository.ts`

**Method**: `getActiveFaqs(workspaceId: string): Promise<string>`

**Functionality**:
- Loads all active FAQs for workspace
- Filters by `workspaceId` and `isActive: true`
- Formats as Q&A pairs: `D: question\nR: answer`
- Returns empty string if no FAQs

**Format Example**:
```
D: How long does onboarding typically take?
R: Starter workspaces launch in a few hours. Enterprise rollouts include a 2-week implementation sprint covering training, automations, testing and go-live checklist.

D: Can I use my own AI models or bring OpenAI keys?
R: Certainly. You can plug in your own OpenAI/Anthropic keys, set model policies per agent and even mix internal deterministic flows with LLMs.
```

### 3. CustomerSupportAgentLLM

**File**: `apps/backend/src/application/agents/CustomerSupportAgentLLM.ts`

**Key Code (lines ~175-195)**:
```typescript
// Load FAQs for customer support
const MessageRepository = require("../../repositories/message.repository").MessageRepository
const messageRepo = new MessageRepository()
const faqs = await messageRepo.getActiveFaqs(context.workspaceId)

logger.info(`📚 Loaded FAQs for CUSTOMER_SUPPORT`, {
  faqsLength: faqs.length,
  hasFaqs: faqs.length > 0,
})

const processedPrompt = await promptProcessor.preProcessPrompt(
  systemPrompt,
  context.workspaceId,
  customerDataForPrompt,
  {
    faqs: faqs, // ✅ FAQs injected into prompt
    products: "",
    categories: "",
    services: "",
    offers: "",
  },
  // ... other params
)
```

### 4. Prompt Templates

**E-commerce**: `apps/backend/src/templates/ecommerce/04-customer-support.template.md`

**Informational**: `apps/backend/src/templates/informational/04-customer-support.template.md`

**Key Section**:
```markdown
{{#if faqs}}
## 📚 FREQUENTLY ASKED QUESTIONS

Use these FAQs to answer customer questions directly:

{{faqs}}

**How to use FAQs:**
1. Find the most relevant FAQ that matches customer's question
2. Provide the answer naturally in conversation
3. Add empathy and personalization
4. Ask if they need more help

{{else}}
## 📚 FAQ MATCHING

No FAQs available. Answer questions to the best of your knowledge.

{{/if}}
```

---

## Workflow Examples

### Example 1: FAQ Match Found

**Input**: "How long does onboarding typically take?"

**Processing**:
1. Router: `CUSTOMER_SUPPORT` intent
2. CustomerSupportAgent loads 68 FAQs from database
3. LLM finds match: "How long does onboarding typically take?"
4. LLM generates natural response using FAQ answer
5. SafetyTranslation translates to customer's language (e.g., Spanish)

**Output**: 
```
¡Hola! Los espacios Starter se lanzan en pocas horas. Las implementaciones Enterprise incluyen un sprint de 2 semanas con capacitación, automatizaciones, pruebas y checklist de lanzamiento.

¿Hay algo más en lo que pueda ayudarte? 🙂
```

### Example 2: No FAQ Match

**Input**: "What is the meaning of life?"

**Processing**:
1. Router: `CUSTOMER_SUPPORT` intent
2. CustomerSupportAgent loads FAQs
3. LLM doesn't find matching FAQ
4. LLM generates generic helpful response

**Output**: 
```
Lo siento, no tengo información específica sobre eso. ¿Puedo ayudarte con algo relacionado con nuestros productos o servicios? 😊
```

---

## Configuration

### Admin Management

**UI**: Admin panel → FAQs section

**Features**:
- ✅ Add/Edit/Delete FAQs
- ✅ Enable/Disable FAQs (`isActive` toggle)
- ✅ Organize by category
- ✅ Set display order
- ✅ Add keywords for better matching
- ✅ Workspace isolation (each workspace has own FAQs)

### Seeding Default FAQs

**File**: `packages/database/prisma/seed.ts`

**Example**:
```typescript
const faqData = [
  {
    category: "Deployment",
    question: "How long does onboarding typically take?",
    answer: "Starter workspaces launch in a few hours. Enterprise rollouts include a 2-week implementation sprint covering training, automations, testing and go-live checklist.",
    keywords: ["onboarding", "setup", "implementation", "deployment"],
  },
  // ... more FAQs
]

for (const faq of faqData) {
  await prisma.fAQ.create({
    data: {
      workspaceId: workspace.id,
      question: faq.question,
      answer: faq.answer,
      keywords: faq.keywords,
      category: faq.category,
      isActive: true,
    }
  })
}
```

---

## Performance Considerations

### Caching Strategy

**Current**: No caching - FAQs loaded on every request

**Recommendation for Scale**:
```typescript
// Cache FAQs in memory for 5 minutes
const faqCache = new Map<string, { faqs: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async getActiveFaqs(workspaceId: string): Promise<string> {
  const cached = faqCache.get(workspaceId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.faqs
  }
  
  const faqs = await this.loadFaqsFromDatabase(workspaceId)
  faqCache.set(workspaceId, { faqs, timestamp: Date.now() })
  return faqs
}
```

### Token Optimization

**Current FAQ Count**: Varies by workspace (e.g., 68 FAQs = ~10k tokens)

**Token Impact**:
- Small workspaces (< 20 FAQs): ~3k tokens
- Medium workspaces (20-50 FAQs): ~7k tokens
- Large workspaces (50+ FAQs): ~10k+ tokens

**Recommendation**: 
- Limit to 50 most relevant FAQs per workspace
- Use semantic search to load only relevant FAQs based on query

---

## Troubleshooting

### Issue: FAQs Not Loading

**Symptoms**: Chatbot responds "I didn't understand" to common questions

**Diagnosis**:
1. Check database: `SELECT COUNT(*) FROM faqs WHERE "workspaceId" = 'xxx' AND "isActive" = true;`
2. Check logs: Look for `📚 Loaded FAQs for CUSTOMER_SUPPORT`
3. Verify template: Ensure `{{faqs}}` placeholder exists in template

**Solution**:
```bash
# Verify FAQs exist
cd apps/backend
npm run seed

# Check if FAQs loaded
# Look for log: "faqsLength: X, hasFaqs: true"
```

### Issue: Wrong FAQ Matched

**Symptoms**: LLM returns irrelevant FAQ answer

**Solution**:
1. Add more specific keywords to FAQ
2. Improve FAQ question phrasing to match common user queries
3. Add similar questions as separate FAQ entries

### Issue: FAQ Not Updated

**Symptoms**: Old FAQ content still appearing after admin edit

**Solution**:
- Clear cache (if implemented)
- Restart backend to reload templates
- Verify database update: `SELECT * FROM faqs WHERE id = 'xxx';`

---

## Testing

### Unit Test

**File**: `apps/backend/__tests__/unit/agents/customer-support-agent-faq.spec.ts`

**Coverage**:
- ✅ FAQ loading from database
- ✅ FAQ formatting (Q&A pairs)
- ✅ Active/inactive filtering
- ✅ Workspace isolation
- ✅ Empty FAQ handling

### Integration Test

**Manual Testing**:
1. Create FAQ in admin panel
2. Send question via WhatsApp/chat
3. Verify correct answer returned
4. Test in different languages

**Test Cases**:
- Exact match: "How long does onboarding take?"
- Partial match: "onboarding time?"
- Synonym: "setup duration?"
- No match: "meaning of life"

---

## Future Enhancements

### 1. Semantic FAQ Search
**Status**: Planned  
**Description**: Use embeddings to find semantically similar FAQs, not just keyword matching

### 2. FAQ Analytics
**Status**: Planned  
**Features**:
- Track FAQ hit rate
- Identify unanswered questions
- Suggest new FAQs based on customer queries

### 3. Multi-Language FAQs
**Status**: Planned  
**Description**: Store FAQs in multiple languages, return in customer's language without translation

### 4. FAQ Categories in UI
**Status**: Planned  
**Description**: Display FAQs grouped by category in admin panel and customer chat

---

## Related Documentation

- [Registration Flow](./registration-flow.md) - Customer registration process
- [Multi-Agent Architecture](./multi-agent-flow.md) - Agent delegation patterns
- [Prompt System](./prompt-sources.md) - Template and variable system
- [UI Standards](./ui-standards.md) - Admin panel design guidelines

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-05 | 1.0.0 | Initial documentation - FAQ system implementation |
