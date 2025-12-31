# Prompt Sources Architecture

## ✅ LEGITIMATE Hardcoded Prompts

### 1. Translation-Security Service
**File**: `apps/backend/src/services/translation-security.service.ts`
**Why Hardcoded**: Security-critical rules (profanity, scam, phishing patterns)
**Reason**: MUST NOT be modifiable by workspace admins (security bypass risk)
**Status**: ✅ Correct implementation

## ❌ PROBLEMATIC Prompt Loading

### 1. SummaryAgentLLM
**File**: `apps/backend/src/services/summary-agent-llm.service.ts`
**Current**: Loads from file `docs/prompts/summary-agent.md`
**Problem**: File does NOT exist
**Used by**: `contactOperator` calling function
**Status**: ⚠️ WILL FAIL at runtime
**Fix needed**: Either create file OR migrate to DB agentConfig table

## ✅ CORRECT Pattern (Database)

All main agents load prompts from `agentConfig` table:
- ProductSearchAgentLLM
- CartManagementAgentLLM  
- OrderTrackingAgentLLM
- CustomerSupportAgentLLM
- SafetyTranslationAgent
- TranslationAgent
- Router Agent

**Pattern**:
```typescript
const config = await this.agentConfigRepo.findByType(workspaceId, AgentType.PRODUCT_SEARCH)
const systemPrompt = config.systemPrompt
```

## 📋 Summary

| Service | Prompt Source | Status | Notes |
|---------|--------------|--------|-------|
| Translation-Security | Hardcoded | ✅ OK | Security rules |
| SummaryAgentLLM | File (missing) | ❌ BROKEN | Needs fix |
| All other agents | Database | ✅ OK | Correct pattern |

**Last updated**: 2025-12-31
