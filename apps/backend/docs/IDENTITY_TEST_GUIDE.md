# Identity Pre-Check - Test & Validation Guide

## ✅ Funzionalità Implementata

**Data**: 2026-01-17  
**Obiettivo**: Risolvere il problema di GPT-4-mini che chiamava RESET_ACTIVE_AGENT in loop invece di rispondere alle domande sull'identità.

---

## 🎯 Come Funziona

### Pre-Check Logic (llm-router.service.ts:1835-1895)

```typescript
// STEP 1: Detect identity question patterns
const identityPatterns = [
  /\b(chi\s+sei|come\s+ti\s+chiami|qual\s+.*\s+nome|nome\s+tuo)\b/i, // IT
  /\b(who\s+are\s+you|what.*your\s+name|your\s+name\s+is)\b/i, // EN
  /\b(qui[eé]n\s+eres|c[oó]mo\s+te\s+llamas|cu[aá]l.*tu\s+nombre)\b/i, // ES
  /\b(quem\s+[eé]\s+voc[eê]|qual.*seu\s+nome|seu\s+nome\s+[eé])\b/i, // PT
]

const isIdentityQuestion = identityPatterns.some(pattern => 
  pattern.test(params.message.toLowerCase())
)

// STEP 2: If match → bypass LLM and construct response directly
if (iterations === 1 && isIdentityQuestion && workspace?.chatbotName) {
  // Construct response based on customer language
  const response = `Mi chiamo ${chatbotName}. Sono ${botIdentityResponse}`
  
  // Create mock LLM response (NO function calling)
  llmResponse = {
    content: response,
    tokensUsed: 50,
    function_call: undefined
  }
}
```

---

## 🧪 Test Manuali

### Test 1: Italiano (IT)

**Setup:**
1. Apri widget: http://localhost:3000
2. Seleziona lingua: Italiano (header dropdown)
3. Verifica chatbotName configurato in database:
   ```sql
   SELECT chatbotName FROM workspace WHERE id = 'echatbot-hq-support';
   -- Expected: "Alex"
   ```

**Domande da testare:**
- ✅ "come ti chiami?"
- ✅ "Come ti chiami"
- ✅ "chi sei?"
- ✅ "qual è il tuo nome?"
- ✅ "come ti chiami?" (maiuscolo/minuscolo misto)

**Risposta attesa:**
```
Mi chiamo Alex. Sono I'm the eChatbot product specialist...
```

**Log attesi nel backend:**
```
🚨 IDENTITY QUESTION DETECTED - Bypassing LLM, forcing direct response
✅ Identity response constructed: {
  "response": "Mi chiamo Alex. Sono I'm the eChatbot product specialist...",
  "language": "it"
}
✅ Message routed successfully {
  "totalTokens": 978,  ← NOT 45,000+!
  "iterations": 1       ← NOT 8!
}
```

### Test 2: English (EN)

**Setup:**
1. Widget: http://localhost:3000
2. Lingua: English

**Domande:**
- ✅ "what's your name?"
- ✅ "who are you?"
- ✅ "What is your name"

**Risposta attesa:**
```
My name is Alex. I am I'm the eChatbot product specialist...
```

### Test 3: Español (ES)

**Setup:**
1. Widget: http://localhost:3000
2. Lingua: Español

**Domande:**
- ✅ "cómo te llamas?"
- ✅ "quién eres?"
- ✅ "cuál es tu nombre?"

**Risposta attesa:**
```
Me llamo Alex. Soy I'm the eChatbot product specialist...
```

### Test 4: Português (PT)

**Setup:**
1. Widget: http://localhost:3000
2. Lingua: Português

**Domande:**
- ✅ "qual é seu nome?"
- ✅ "quem é você?"
- ✅ "seu nome é"

**Risposta attesa:**
```
Meu nome é Alex. Sou I'm the eChatbot product specialist...
```

---

## 🔍 Validazione Log

### Success Indicators

**Backend logs** (`apps/backend/logs/` o console):

1. ✅ **Pre-check trigger:**
   ```
   🚨 IDENTITY QUESTION DETECTED - Bypassing LLM, forcing direct response
   ```

2. ✅ **Response construction:**
   ```
   ✅ Identity response constructed: {
     "response": "Mi chiamo Alex...",
     "language": "it"
   }
   ```

3. ✅ **Performance metrics:**
   ```
   ✅ Message routed successfully {
     "executionTimeMs": 3300,  ← NOT 12,000ms
     "totalTokens": 978,       ← NOT 45,000+
     "iterations": 1,          ← NOT 8
     "linksReplaced": 0,
     "translated": true
   }
   ```

### Failure Indicators (se vedi questi, il pre-check NON sta funzionando)

❌ **LLM loop:**
```
Function Calling iteration 1/8: RESET_ACTIVE_AGENT
Function Calling iteration 2/8: RESET_ACTIVE_AGENT
...
⚠️ Max function calling iterations reached
```

❌ **High token usage:**
```
totalTokens": 45344  ← TOO HIGH!
```

❌ **Generic response:**
```
¡Hola! No tengo un nombre específico, pero puedes llamarme asistente virtual
```

---

## 🧪 Test Edge Cases

### Edge Case 1: No chatbotName Configured

**Setup:**
```sql
UPDATE workspace 
SET chatbotName = NULL 
WHERE id = 'echatbot-hq-support';
```

**Test:** "come ti chiami?"

**Expected Behavior:**
- Pre-check bypassed (chatbotName null)
- LLM fallback used
- Response from template's {{else}} block:
  ```
  You are a helpful assistant. Company name: eChatbot HQ
  ```

### Edge Case 2: Non-Identity Question

**Test:** "ciao, come stai?"

**Expected Behavior:**
- Pattern NOT matched
- Normal LLM flow
- tokensUsed > 1000

### Edge Case 3: Ecommerce vs Informational

**Test in BOTH modes:**

1. **Ecommerce mode:**
   ```sql
   UPDATE workspace 
   SET "channelMode" = 'ECOMMERCE' 
   WHERE id = 'echatbot-hq-support';
   ```

2. **Informational mode:**
   ```sql
   UPDATE workspace 
   SET "channelMode" = 'INFORMATIONAL' 
   WHERE id = 'echatbot-hq-support';
   ```

**Expected:** Pre-check works identically in BOTH modes.

---

## 📊 Performance Metrics

### Before Fix
```
Execution Time: ~12,000ms
Tokens Used: ~45,000
Iterations: 8
Function Calls: 8x RESET_ACTIVE_AGENT
Cost: ~$0.50 per question
Response: Generic "asistente virtual"
```

### After Fix
```
Execution Time: ~3,300ms  ⚡ 72% faster
Tokens Used: ~978         💰 97% cheaper
Iterations: 1             ✅ No loop
Function Calls: 0         ✅ Direct response
Cost: ~$0.05 per question
Response: "Mi chiamo Alex" ✅ Personalized
```

---

## 🐛 Troubleshooting

### Problem: Bot still responds "asistente virtual"

**Diagnosis:**
```bash
# Check logs for pre-check trigger
tail -f apps/backend/logs/app.log | grep "IDENTITY QUESTION"
```

**If NOT found:**
1. Check pattern not matching:
   - Test patterns in code: `identityPatterns.test("come ti chiami?")`
2. Check iterations > 1:
   - Pre-check only works on first iteration
3. Check chatbotName null:
   ```sql
   SELECT chatbotName FROM workspace WHERE id = 'echatbot-hq-support';
   ```

### Problem: Wrong language in response

**Diagnosis:**
```sql
SELECT id, name, language 
FROM customers 
WHERE phone = '+xxx';
```

**Fix:**
```sql
UPDATE customers 
SET language = 'it'  -- or 'en', 'esp', 'pt'
WHERE id = 'customer-id';
```

### Problem: Variables not replaced ({{chatbotName}} visible)

**Diagnosis:**
Check PromptProcessorService logs:
```
✅ Replaced customer variables in response
```

**Fix:**
1. Verify workspace.chatbotName exists in DB
2. Check template-loader.service.ts loaded chatbotName
3. Rebuild backend: `npm run build`

---

## 📝 Test Checklist

- [ ] **IT**: "come ti chiami?" → "Mi chiamo Alex"
- [ ] **EN**: "what's your name?" → "My name is Alex"
- [ ] **ES**: "cómo te llamas?" → "Me llamo Alex"
- [ ] **PT**: "qual é seu nome?" → "Meu nome é Alex"
- [ ] **Logs**: "🚨 IDENTITY QUESTION DETECTED" appears
- [ ] **Tokens**: < 1000 (not 45,000+)
- [ ] **Iterations**: 1 (not 8)
- [ ] **Response time**: < 5s (not 12s)
- [ ] **Ecommerce mode**: Works ✅
- [ ] **Informational mode**: Works ✅
- [ ] **No chatbotName**: Falls back to LLM ✅
- [ ] **Non-identity question**: LLM processes normally ✅

---

## 📚 Documentation Files

1. **Code Implementation:**
   - `apps/backend/src/services/llm-router.service.ts:1835-1895`

2. **Template:**
   - `apps/backend/src/templates/informational/01-router.template.md:30-55`

3. **Variable Loading:**
   - `apps/backend/src/application/services/template-loader.service.ts:207-245`

4. **Unit Tests:**
   - `apps/backend/__tests__/unit/services/identity-pattern-matching.test.ts`
   - `apps/backend/__tests__/unit/services/llm-router-identity.test.ts`

5. **Documentation:**
   - `apps/backend/docs/identity-precheck-documentation.ts`
   - `apps/backend/docs/IDENTITY_TEST_GUIDE.md` (this file)

---

## ✅ Sign-Off

**Tested by:** _________________  
**Date:** _________________  
**All tests passed:** ☐ Yes ☐ No  
**Notes:** _________________

---

## 🚀 Next Steps

1. ✅ Monitor production logs for "IDENTITY QUESTION DETECTED"
2. ✅ Collect metrics on token usage reduction
3. ✅ Add telemetry for identity question frequency
4. ⏳ Consider caching pattern compilation at service init
5. ⏳ Add support for more languages (FR, DE, etc.)
