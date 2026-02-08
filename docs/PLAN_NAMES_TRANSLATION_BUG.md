# 🚨 Plan Names Translation Bug Analysis

**Date**: February 8, 2026  
**Reporter**: Andrea (@gelsogrove)  
**User**: +34654728753 (Spanish customer)  
**Status**: 🔧 **PARTIALLY FIXED** (Translation prompt updated, but root cause remains)

---

## 📋 Problem Statement

### What Happened
User asked:
```
[8/2/26, 19:42:37] gelsogrove: he piani avete?
```

System responded:
```
[8/2/26, 19:42:48] echatbotai: Ofrecemos planes Starter, Premium y Enterprise.

Detalles:
• Starter: Adecuado para pequeñas empresas.
• Premium: Para empresas en crecimiento con funcionalidades avanzadas.
• Enterprise: Incluye SLA personalizados y onboarding concierge.
```

### Expected Behavior
Plan names should be in **UPPERCASE** and **NEVER translated**:
- ❌ WRONG: "Starter, Premium y Enterprise" (capitalized, not uppercase)
- ✅ CORRECT: "STARTER, PREMIUM, ENTERPRISE" (all uppercase)
- ✅ CORRECT: "FREE_TRIAL, BASIC, PREMIUM, ENTERPRISE" (technical names)

### Andrea's Documentation
Andrea states that Translation Layer has this rule:
```
## NEVER TRANSLATE PLANS
- never translate words like "FREE" "BASIC" "PREMIUM" "ENTERPRICE"
```

---

## 🔍 Root Cause Analysis

### Investigation Results

#### ✅ **Level 1: Translation Prompt Missing Rule** (FIXED)
**File**: `packages/database/prisma/data/agent-templates/translation.ts`

**Problem**: The TRANSLATION agent prompt in the database **DID NOT** have the "NEVER TRANSLATE PLANS" rule.

**Evidence**:
- Checked lines 1-100 of translation.ts
- No mention of "NEVER TRANSLATE PLANS"
- No mention of "FREE", "BASIC", "PREMIUM", "ENTERPRISE"

**Fix Applied**:
Added to translation.ts (line ~60):
```typescript
## NEVER TRANSLATE PLANS
CRITICAL: The following subscription plan names MUST remain EXACTLY as written, in UPPERCASE:
- FREE_TRIAL
- BASIC
- STARTER
- PREMIUM
- ENTERPRISE

These are technical identifiers used throughout the system. Never translate, modify, or lowercase them.
Examples of CORRECT usage:
- "Ofrecemos planes PREMIUM y ENTERPRISE" (Spanish) ✅
- "We offer STARTER, PREMIUM and ENTERPRISE plans" (English) ✅  
- "I nostri piani sono BASIC, PREMIUM e ENTERPRISE" (Italian) ✅

Examples of WRONG usage:
- "planes Premium y Empresarial" ❌ (translated)
- "piani premium e enterprise" ❌ (lowercased)
- "Starter, Premium, Enterprise" ❌ (not uppercase)
```

---

#### ❌ **Level 2: LLM Generating Wrong Plan Names** (NOT FIXED)

**The Real Problem**:
1. Customer Support Agent LLM **generates** text like "Starter, Premium y Enterprise"
2. This text is **NOT from database** (database has "FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE")
3. Translation Layer receives **already-wrong** text ("Starter" instead of "STARTER")
4. Even with the new rule, Translation Layer **cannot fix** what's already wrong

**Message Flow**:
```
1. User: "he piani avete?" (Italian)
2. Customer Support Agent LLM:
   - Generates: "We offer Starter, Premium and Enterprise plans..."
   - Problem: Uses "Starter" (capitalized) instead of "STARTER" (uppercase)
   - Problem: Invents display names instead of using technical names
3. Translation Layer:
   - Receives: "We offer Starter, Premium and Enterprise plans..."
   - Translates to Spanish: "Ofrecemos planes Starter, Premium y Enterprise..."
   - Problem: "Starter" looks like a proper noun, not a technical identifier
   - Even with new rule, cannot know it should be "STARTER"
4. Output: ❌ "Starter, Premium y Enterprise" (wrong)
```

---

## 🎯 The Underlying Architecture Problem

### **Database-First Architecture Violation**

From copilot-instructions.md:
```
### 1. **Database-First Architecture**
- **NEVER** use hardcoded fallbacks, default values, or mock data
- **ALL** configuration (prompts, agent configs, prices) comes from database
```

**The Issue**:
- Plan names are **hardcoded** in the LLM's knowledge (GPT-4o-mini training data knows "Starter", "Premium", "Enterprise")
- Plan names are **NOT fetched from database** and injected into the prompt
- LLM **invents** display names instead of using exact technical identifiers

### **What Should Happen** (Database-First)

1. **Fetch plan data from database**:
```typescript
const plans = await prisma.plan.findMany({
  select: { planType: true }
})
// Returns: ["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"]
```

2. **Inject into Customer Support prompt**:
```typescript
Available plans: FREE_TRIAL, BASIC, PREMIUM, ENTERPRISE
CRITICAL: Use EXACT plan names as written above. Do NOT use display names like "Starter" or "Enterprise tier".
```

3. **LLM generates correct output**:
```
We offer plans: BASIC, PREMIUM, and ENTERPRISE.
```

4. **Translation Layer preserves uppercase**:
```
Ofrecemos planes: BASIC, PREMIUM y ENTERPRISE.
```

---

## 🔧 Complete Fix Required

### **Step 1: Identify Where Plan Names Are Used** ✅ DONE

Plans are mentioned in:
- Customer Support Agent prompt
- FAQ content
- Email templates
- Billing pages

### **Step 2: Update Translation Prompt** ✅ DONE (Local DB)

Added "NEVER TRANSLATE PLANS" rule to `translation.ts`.

**Next**: Need to update **Heroku production database**:
```sql
UPDATE "AgentConfig" 
SET "systemPrompt" = '[new prompt with NEVER TRANSLATE PLANS]'
WHERE type = 'TRANSLATION' AND "workspaceId" = 'echatbot-hq-support';
```

### **Step 3: Fix Customer Support Agent Prompt** ❌ NOT DONE

**Current State**: Unknown where Customer Support prompt is stored

**Required**:
1. Find Customer Support Agent prompt source (file or DB)
2. Add section:
```
## SUBSCRIPTION PLANS

Available plans in this workspace:
- FREE_TRIAL
- BASIC
- PREMIUM
- ENTERPRISE

CRITICAL RULES:
1. Always use EXACT plan names as written above (all UPPERCASE)
2. NEVER use display names like "Starter", "Business", "Pro", etc.
3. NEVER translate plan names to other languages
4. Keep technical identifiers intact

Examples:
✅ CORRECT: "We offer BASIC, PREMIUM, and ENTERPRISE plans"
✅ CORRECT: "Ofrecemos los planes BASIC, PREMIUM y ENTERPRISE"
❌ WRONG: "We offer Starter, Premium and Enterprise plans"
❌ WRONG: "Ofrecemos planes Básico, Premium y Empresarial"
```

### **Step 4: Inject Plan Data from Database** ❌ NOT DONE

**Ideal Solution**: Fetch plan names from database and inject into prompt variables.

**Implementation**:
```typescript
// In PromptVariableBuilder.build()
const plans = await prisma.plan.findMany({
  select: { planType: true }
})

const variables = {
  ...existingVariables,
  '{{available_plans}}': plans.map(p => p.planType).join(', ')
}

// In Customer Support prompt:
"Available plans: {{available_plans}}"
```

This ensures:
- ✅ Plan names come from database (not LLM training data)
- ✅ If plans change in DB, prompts auto-update
- ✅ No hardcoding

---

## 📊 Impact Assessment

### **Current State** (After Translation Prompt Fix)
- ✅ Local DB updated with "NEVER TRANSLATE PLANS" rule
- ❌ Heroku production DB still has old prompt
- ❌ Customer Support Agent still generates wrong names
- ❌ Output still shows "Starter, Premium, Enterprise"

### **After Complete Fix**
- ✅ Translation Layer enforces uppercase plan names
- ✅ Customer Support Agent uses exact database plan names
- ✅ No translation or modification of technical identifiers
- ✅ Consistent across all languages

---

## 🚀 Deployment Steps

### **Immediate (Translation Layer)**

1. **Update Heroku TRANSLATION prompt**:
```bash
# Option A: Re-run seed on Heroku
heroku run -a echatbot-app "cd packages/database && npm run seed"

# Option B: Direct SQL update
heroku pg:psql -a echatbot-app
UPDATE "AgentConfig" 
SET "systemPrompt" = '[full new prompt from translation.ts]'
WHERE type = 'TRANSLATION';
```

2. **Verify update**:
```sql
SELECT type, name, LENGTH("systemPrompt") as prompt_length 
FROM "AgentConfig" 
WHERE type = 'TRANSLATION' 
LIMIT 1;
```

Expected: `prompt_length` should be ~300-500 characters longer after adding "NEVER TRANSLATE PLANS" section.

### **Complete Fix (Customer Support Agent)**

1. **Find Customer Support prompt location**:
   - Check `packages/database/prisma/data/agent-templates/` directory
   - Check if stored in DB (AgentConfig table, type = 'CUSTOMER_SUPPORT' or 'INFO')

2. **Add plan name injection**:
   - Update `PromptVariableBuilder.build()` to fetch plan names
   - Add `{{available_plans}}` variable
   - Update Customer Support prompt to use this variable

3. **Add strict rules**:
   - Use EXACT plan names from variable
   - NEVER use display names
   - NEVER translate

4. **Test with +34654728753**:
   - Ask: "che piani avete?"
   - Expected: "Ofrecemos BASIC, PREMIUM y ENTERPRISE"
   - Verify: All uppercase, no translation

---

## 🧪 Testing Scenarios

### **Scenario 1: Italian User Asks About Plans**
- **Input**: "che piani avete?"
- **Expected**: "Abbiamo i piani BASIC, PREMIUM e ENTERPRISE"
- **Current**: ❌ "Abbiamo i piani Starter, Premium e Enterprise"

### **Scenario 2: Spanish User Asks About Plans**
- **Input**: "qué planes tenéis?"
- **Expected**: "Ofrecemos BASIC, PREMIUM y ENTERPRISE"
- **Current**: ❌ "Ofrecemos Starter, Premium y Enterprise"

### **Scenario 3: English User Asks About Plans**
- **Input**: "what plans do you have?"
- **Expected**: "We offer BASIC, PREMIUM, and ENTERPRISE plans"
- **Current**: ❌ "We offer Starter, Premium, and Enterprise plans"

---

## 📝 Summary

### **What Was Fixed Today**
✅ Added "NEVER TRANSLATE PLANS" rule to Translation agent prompt (local DB)

### **What Still Needs Fixing**
❌ Update Heroku production database with new Translation prompt
❌ Fix Customer Support Agent to use database plan names
❌ Implement plan name injection via PromptVariableBuilder
❌ Add strict uppercase enforcement in Customer Support prompt

### **Root Cause**
The system violates **Database-First Architecture** by letting the LLM generate plan names from its training data instead of fetching exact names from the database.

### **Priority**
🚨 **HIGH** - Plan names are customer-facing and must be consistent. Current behavior:
- Confuses customers (display names vs technical names)
- Breaks billing system integration (expects "PREMIUM", gets "Premium")
- Violates architectural principles (hardcoded data)

---

**Next Steps**:
1. Deploy Translation prompt to Heroku ← **IMMEDIATE**
2. Find and fix Customer Support Agent prompt ← **URGENT**
3. Implement database-driven plan name injection ← **ARCHITECTURAL FIX**

**Author**: GitHub Copilot  
**Reviewer**: Andrea (@gelsogrove)  
**Status**: 🔧 **IN PROGRESS**
