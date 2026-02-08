# Prompt Sources Architecture

## ✅ Prompt Sources (Current)

### 1. Translation Layer (Database)
**File**: `apps/backend/src/application/agents/TranslationAgent.ts`  
**Prompt Source**: `agentConfig` (AgentType.TRANSLATION)  
**Reason**: Workspace-specific translation tone and formatting rules.

### 2. Security Layer (Database)
**Files**:
- `apps/backend/src/application/agents/SecurityAgent.ts` (Widget / backend)
- `apps/scheduler/src/services/security-agent.service.ts` (WhatsApp scheduler)  
**Prompt Source**: `agentConfig` (AgentType.SECURITY)  
**Reason**: Security rules are editable but controlled by workspace admins.

## ❌ PROBLEMATIC Prompt Loading

### 1. SummaryAgentLLM
**File**: `apps/backend/src/services/summary-agent-llm.service.ts`
**Current**: Loads from file `docs/prompts/summary-agent.md`
**Problem**: File does NOT exist in repo (missing)
**Used by**: `contactOperator` calling function
**Status**: ⚠️ WILL FAIL at runtime
**Fix needed**: Create `docs/prompts/summary-agent.md` OR migrate SummaryAgent to DB `agentConfig`

## ✅ CORRECT Pattern (Database)

All main agents load prompts from `agentConfig` table:
- ProductSearchAgentLLM
- CartManagementAgentLLM  
- OrderTrackingAgentLLM
- CustomerSupportAgentLLM
- SecurityAgent
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
| Translation Layer | Database | ✅ OK | AgentType.TRANSLATION |
| Security Layer | Database | ✅ OK | AgentType.SECURITY |
| SummaryAgentLLM | File (missing) | ❌ BROKEN | Needs fix |
| All other agents | Database | ✅ OK | Correct pattern |

**Last updated**: 2025-12-31
